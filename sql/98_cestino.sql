-- ============================================================================
-- 98 — CESTINO (S8, piano 2026-10-12; scelta di Claudio: "Cestino nel DB")
-- Scritto partendo dallo schema LIVE letto il 2026-10-12 (connettore in sola
-- lettura). Da eseguire con OK esplicito di Claudio.
--
-- COSA FA
--  - Ogni carta (tabella carte) e ogni prodotto sealed (prodotti_sealed) che
--    viene eliminato — dal sito, dall'estensione o da un'unione di doppioni —
--    finisce nel cestino per 30 giorni: la riga intera (jsonb) più le sue
--    appartenenze a binder (binder_carte) o scaffali (scaffale_prodotti), che
--    altrimenti sparirebbero in cascata.
--  - ripristina_dal_cestino(id): rimette la riga com'era (stesso id) e le
--    appartenenze ai binder/scaffali che esistono ancora. Il punto che il
--    trigger dello storico prezzi aggiunge al reinserimento viene tolto (il
--    ripristino non è un nuovo prezzo); nel registro movimenti entra una
--    "aggiunta" (fonte 'rpc', nota "ripristino dal cestino").
--  - Ognuno vede e svuota SOLO il proprio cestino (RLS). Nessuna scrittura
--    diretta dal sito: entra solo dal trigger, esce col ripristino, con
--    l'eliminazione definitiva o dopo 30 giorni (pulizia a ogni nuova
--    eliminazione dello stesso utente: niente pg_cron, che non è installato).
--  - Wishlist esclusa: "Ottenuta" sposta la carta eliminando la riga della
--    wishlist, il cestino si riempirebbe di righe non perse davvero.
--
-- NON TORNANO col ripristino: le foto reali (il trigger esistente
-- _foto_carte_pulisci_oggetto le mette in coda di cancellazione all'eliminazione,
-- invariato) e il collegamento alle richieste di scambio (ON DELETE SET NULL).
-- Utente eliminato definitivamente (admin_hard_delete_user): il suo cestino se
-- ne va in cascata con auth.users.
--
-- PER ANNULLARE: sql/98_cestino_ROLLBACK.sql
-- ============================================================================

begin;

create table public.cestino (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    tabella text not null check (tabella in ('carte', 'prodotti_sealed')),
    oggetto_id uuid not null,
    riga jsonb not null,
    collegamenti jsonb not null default '[]'::jsonb,
    eliminato_il timestamptz not null default now()
);
create index cestino_owner_idx on public.cestino (owner_id, eliminato_il desc);

alter table public.cestino enable row level security;
revoke all on table public.cestino from anon, authenticated;
grant select, delete on table public.cestino to authenticated;
create policy "cestino: ognuno vede il suo" on public.cestino
    for select to authenticated using (owner_id = (select auth.uid()));
create policy "cestino: ognuno svuota il suo" on public.cestino
    for delete to authenticated using (owner_id = (select auth.uid()));

-- Trigger: prima dell'eliminazione (le appartenenze ci sono ancora, la
-- cascata scatta dopo) copia riga e appartenenze nel cestino.
create function public._cestino_registra()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
    v_collegamenti jsonb;
begin
    if tg_table_name = 'carte' then
        select coalesce(jsonb_agg(to_jsonb(b)), '[]'::jsonb) into v_collegamenti
        from public.binder_carte b where b.carta_id = old.id;
    else
        select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) into v_collegamenti
        from public.scaffale_prodotti s where s.prodotto_id = old.id;
    end if;

    insert into public.cestino (owner_id, tabella, oggetto_id, riga, collegamenti)
    values (old.owner_id, tg_table_name, old.id, to_jsonb(old), v_collegamenti);

    delete from public.cestino
    where owner_id = old.owner_id and eliminato_il < now() - interval '30 days';

    return old;
end;
$function$;
revoke all on function public._cestino_registra() from public, anon, authenticated;

create trigger trg_carte_cestino before delete on public.carte
    for each row execute function public._cestino_registra();
create trigger trg_prodotti_sealed_cestino before delete on public.prodotti_sealed
    for each row execute function public._cestino_registra();

-- Ripristino: solo dal proprio cestino, solo se l'oggetto non esiste già.
create function public.ripristina_dal_cestino(p_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
    v public.cestino%rowtype;
begin
    select * into v from public.cestino where id = p_id and owner_id = auth.uid();
    if not found then
        raise exception 'Elemento non trovato nel cestino';
    end if;

    if v.tabella = 'carte' then
        if exists (select 1 from public.carte where id = v.oggetto_id) then
            raise exception 'La carta è già nella collezione';
        end if;
        insert into public.carte select * from jsonb_populate_record(null::public.carte, v.riga);
        insert into public.binder_carte
            select * from jsonb_populate_recordset(null::public.binder_carte, v.collegamenti) b
            where exists (select 1 from public.binders x where x.id = b.binder_id and x.owner_id = v.owner_id)
        on conflict do nothing;
    else
        if exists (select 1 from public.prodotti_sealed where id = v.oggetto_id) then
            raise exception 'Il prodotto è già nella collezione';
        end if;
        insert into public.prodotti_sealed select * from jsonb_populate_record(null::public.prodotti_sealed, v.riga);
        insert into public.scaffale_prodotti
            select * from jsonb_populate_recordset(null::public.scaffale_prodotti, v.collegamenti) s
            where exists (select 1 from public.scaffali x where x.id = s.scaffale_id and x.owner_id = v.owner_id)
        on conflict do nothing;
    end if;

    -- Il trigger dello storico registra un prezzo a ogni inserimento: qui non
    -- è un prezzo nuovo, si toglie (stessa transazione = stesso now()).
    delete from public.storico_prezzi
    where carta_id = v.oggetto_id and tabella = v.tabella and registrato_il = now();

    -- Registro movimenti (come fa il sito per aggiunte e rimozioni): il
    -- ripristino è un'aggiunta, così lo storico non resta fermo a "Rimossa".
    insert into public.movimenti_collezione
        (owner_id, tipo_evento, oggetto_tipo, oggetto_id, nome_snapshot,
         quantita_delta, prezzo_unitario, valore_delta, fonte, note)
    values (
        v.owner_id, 'aggiunta', case when v.tabella = 'carte' then 'carta' else 'sealed' end, v.oggetto_id,
        coalesce(v.riga->>'nome', ''),
        nullif(v.riga->>'qty', '')::integer,
        nullif(v.riga->>'prezzo', '')::numeric,
        nullif(v.riga->>'prezzo', '')::numeric * coalesce(nullif(v.riga->>'qty', '')::integer, 1),
        'rpc', 'ripristino dal cestino');

    delete from public.cestino where id = p_id;
    return jsonb_build_object('tabella', v.tabella, 'id', v.oggetto_id);
end;
$function$;
revoke all on function public.ripristina_dal_cestino(uuid) from public, anon;
grant execute on function public.ripristina_dal_cestino(uuid) to authenticated;

commit;

-- VERIFICA (dopo)
-- select relrowsecurity from pg_class where oid = 'public.cestino'::regclass;            -- true
-- select policyname, cmd from pg_policies where tablename = 'cestino';                    -- 2 righe
-- select tgname from pg_trigger where tgname like '%cestino%';                             -- 2 trigger
-- select has_function_privilege('anon', 'public.ripristina_dal_cestino(uuid)', 'EXECUTE'); -- false
