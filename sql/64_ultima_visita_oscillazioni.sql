-- ═══════════════════════════════════════════════════════════════════════
-- sql/64_ultima_visita_oscillazioni.sql
-- Widget "In primo piano" (2026-09-19) — oscillazione "dall'ultimo accesso".
--
-- COSA FA
--   1. Tabella ultima_visita (una riga per utente): quando ha aperto il
--      sito l'ultima volta e da quale momento va calcolata l'oscillazione.
--   2. registra_visita(p_pausa_ore): chiamata una volta per caricamento
--      del sito. Se dall'ultima apertura e' passata almeno la pausa
--      (default 4 ore) inizia una NUOVA visita e la "baseline" diventa
--      l'ultima apertura precedente; altrimenti la baseline resta quella.
--      Un ricaricamento a distanza di minuti quindi NON azzera le
--      variazioni. Restituisce la baseline (null alla primissima visita).
--   3. leggi_variazioni_da(p_da): per ogni oggetto del chiamante il cui
--      prezzo e' cambiato DOPO p_da, il prezzo che aveva a p_da. Il client
--      calcola la variazione come prezzo_ora - prezzo_base.
--
-- VERIFICATO SUL DB REALE (query A-E del 2026-09-19, Regola d'Oro #3)
--   - storico_prezzi ha owner_id NOT NULL + RLS "utenti leggono il proprio
--     storico prezzi" (SELECT, authenticated, auth.uid() = owner_id).
--   - Lo storico e' un REGISTRO DELLE VARIAZIONI: i trigger
--     trg_storico_prezzo_carte / _sealed scrivono una riga all'INSERT e a
--     ogni cambio di prezzo (invariati = 0 su 1.403 righe). Quindi il
--     prezzo a un istante T e' l'ultima riga con registrato_il <= T.
--   - carte e prodotti_sealed hanno entrambe prezzo_precedente, scritto dal
--     trigger BEFORE UPDATE _cardsync_traccia_prezzo_precedente.
--   - Indice esistente idx_storico_prezzi_carta (carta_id, registrato_il):
--     a 1.4k righe il piano e' un seq scan da 1,3 ms (EXPLAIN ANALYZE):
--     nessun indice nuovo, da rivalutare solo se lo storico cresce molto.
--   - activity_log NON e' usabile come sorgente: nessuna policy SELECT per
--     il proprietario e una riga 'accesso' per ogni ricaricamento.
--     last_sign_in_at (auth.users) non e' "l'ultima visita": la sessione
--     resta salvata per giorni.
--
-- SCELTE DI SICUREZZA
--   - NESSUNA funzione SECURITY DEFINER: entrambe sono SECURITY INVOKER e
--     lavorano sotto la RLS dell'utente chiamante. Non si tocca nessuna
--     policy, trigger o funzione esistente.
--   - ultima_visita ha RLS con una sola policy "propria visita"; niente
--     DELETE per il client. FK verso auth.users con ON DELETE CASCADE, cosi'
--     non blocca admin_hard_delete_user().
--   - EXECUTE revocato a public/anon, concesso solo ad authenticated.
--
-- LIMITE NOTO (dichiarato, non un bug): lo storico parte il 2026-08-22,
-- quindi la PRIMA variazione di una carta non ha una riga di partenza.
-- leggi_variazioni_da() la recupera da carte.prezzo_precedente solo se
-- dopo p_da c'e' UNA sola variazione registrata (in quel caso il prezzo a
-- p_da e' esattamente prezzo_precedente). Con due o piu' variazioni dopo
-- p_da e nessuna riga precedente l'oggetto e' ambiguo e viene ESCLUSO.
-- Storico pulito da pulisci_storico_prezzi(): oltre 30 giorni resta una
-- riga al giorno, quindi la baseline e' esatta entro 30 giorni.
--
-- PRIMA DI ESEGUIRE (deve tornare 0 righe — il nome non deve esistere):
--   select 1 from information_schema.tables
--    where table_schema = 'public' and table_name = 'ultima_visita';
--   select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and proname in ('registra_visita','leggi_variazioni_da');
--
-- ROLLBACK: vedi in fondo.
-- ═══════════════════════════════════════════════════════════════════════

begin;

-- 1. Tabella -----------------------------------------------------------
create table public.ultima_visita (
    owner_id        uuid primary key default auth.uid()
                        references auth.users(id) on delete cascade,
    ultima_apertura timestamptz not null default now(),
    baseline        timestamptz,
    aggiornata_il   timestamptz not null default now()
);

alter table public.ultima_visita enable row level security;

create policy "propria visita" on public.ultima_visita
    for all to authenticated
    using (owner_id = auth.uid())
    with check (owner_id = auth.uid());

revoke all on public.ultima_visita from public, anon;
grant select, insert, update on public.ultima_visita to authenticated;

-- 2. registra_visita ---------------------------------------------------
create or replace function public.registra_visita(p_pausa_ore numeric default 4)
returns timestamptz
language plpgsql
security invoker
set search_path to 'public'
as $$
declare
    v_baseline timestamptz;
begin
    if auth.uid() is null then
        raise exception 'Non autenticato';
    end if;
    if p_pausa_ore is null or p_pausa_ore < 0 or p_pausa_ore > 720 then
        raise exception 'Pausa non valida (0-720 ore)';
    end if;

    -- Un solo statement atomico: in ON CONFLICT DO UPDATE le espressioni del
    -- SET leggono i valori VECCHI della riga (u.ultima_apertura e' quella
    -- precedente anche se piu' in basso la si riassegna a now()), quindi due
    -- dispositivi che aprono insieme non possono pestarsi i piedi.
    insert into public.ultima_visita as u (owner_id, ultima_apertura, baseline, aggiornata_il)
    values (auth.uid(), now(), null, now())
    on conflict (owner_id) do update
        set baseline = case
                           when u.ultima_apertura < now() - (interval '1 hour' * p_pausa_ore)
                               then u.ultima_apertura
                           else u.baseline
                       end,
            ultima_apertura = now(),
            aggiornata_il = now()
    returning u.baseline into v_baseline;

    return v_baseline;
end;
$$;

revoke execute on function public.registra_visita(numeric) from public, anon;
grant execute on function public.registra_visita(numeric) to authenticated;

-- 3. leggi_variazioni_da -----------------------------------------------
-- Restituisce SOLO gli oggetti cambiati dopo p_da (poche righe, non tutta
-- la collezione). Ordinata: il client la legge a pagine da 1000 con
-- range(), l'ordine deve essere deterministico.
create or replace function public.leggi_variazioni_da(p_da timestamptz)
returns table (oggetto_id uuid, tabella text, prezzo_base numeric)
language sql
stable
security invoker
set search_path to 'public'
as $$
    with dopo as (
        select s.carta_id, s.tabella, count(*) as n_dopo
        from public.storico_prezzi s
        where s.owner_id = auth.uid()
          and s.registrato_il > p_da
        group by s.carta_id, s.tabella
    ),
    prima as (
        select distinct on (s.carta_id, s.tabella)
               s.carta_id, s.tabella, s.prezzo
        from public.storico_prezzi s
        join dopo d on d.carta_id = s.carta_id and d.tabella = s.tabella
        where s.owner_id = auth.uid()
          and s.registrato_il <= p_da
        order by s.carta_id, s.tabella, s.registrato_il desc
    ),
    risolto as (
        select d.carta_id, d.tabella,
               coalesce(
                   p.prezzo,
                   case when d.n_dopo = 1 then
                       case d.tabella
                           when 'carte' then
                               (select c.prezzo_precedente from public.carte c where c.id = d.carta_id)
                           when 'prodotti_sealed' then
                               (select b.prezzo_precedente from public.prodotti_sealed b where b.id = d.carta_id)
                       end
                   end
               ) as prezzo_base
        from dopo d
        left join prima p on p.carta_id = d.carta_id and p.tabella = d.tabella
    )
    select r.carta_id, r.tabella, r.prezzo_base
    from risolto r
    where r.prezzo_base is not null
    order by r.tabella, r.carta_id;
$$;

revoke execute on function public.leggi_variazioni_da(timestamptz) from public, anon;
grant execute on function public.leggi_variazioni_da(timestamptz) to authenticated;

commit;

-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICA DOPO L'ESECUZIONE (incollami l'output)
-- Nel SQL Editor auth.uid() e' null: per provare le funzioni si simula
-- l'utente dentro una transazione che poi si ANNULLA (non lascia nulla).
-- Sostituisci l'uuid se il tuo non e' questo.
--
--   begin;
--   set local role authenticated;
--   select set_config('request.jwt.claims',
--       '{"sub":"87048bf9-dcde-4bab-a44d-98651c425871","role":"authenticated"}', true);
--   select public.registra_visita(4);               -- 1a volta: null
--   select public.registra_visita(4);               -- subito dopo: null
--   select * from public.leggi_variazioni_da(now() - interval '7 days');
--   select * from public.ultima_visita;             -- 1 riga, la tua
--   rollback;
--
--   Piano della funzione (deve restare nell'ordine dei millisecondi):
--   begin;
--   set local role authenticated;
--   select set_config('request.jwt.claims',
--       '{"sub":"87048bf9-dcde-4bab-a44d-98651c425871","role":"authenticated"}', true);
--   explain (analyze, buffers)
--     select * from public.leggi_variazioni_da(now() - interval '7 days');
--   rollback;
--
--   Permessi (anon NON deve poter chiamarle — atteso: false, false):
--   select has_function_privilege('anon', 'public.registra_visita(numeric)', 'execute'),
--          has_function_privilege('anon', 'public.leggi_variazioni_da(timestamptz)', 'execute');
-- ═══════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════
-- ROLLBACK (solo se serve tornare indietro; il client ripiega da solo
-- sulla vecchia definizione di oscillazione se le RPC non rispondono):
--   begin;
--   drop function if exists public.leggi_variazioni_da(timestamptz);
--   drop function if exists public.registra_visita(numeric);
--   drop table if exists public.ultima_visita;
--   commit;
-- ═══════════════════════════════════════════════════════════════════════
