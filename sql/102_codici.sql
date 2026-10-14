-- ============================================================================
-- 102 — CODICI DA RISCATTARE (Impostazioni → Codici; richiesta di Claudio
-- 2026-10-14: "una sezione per redimere i codici che attiveremo in seguito")
--
-- NON ANCORA ESEGUITO. Da lanciare nell'SQL editor di Supabase con OK
-- esplicito di Claudio (contiene REVOKE: il connettore lo annullerebbe).
-- Finché non è eseguito il sito mostra la sezione e risponde "I codici non
-- sono ancora attivi" (la funzione riscatta_codice non esiste).
--
-- Scritto partendo dallo schema LIVE letto il 2026-10-14 (sola lettura):
--  - nessuna tabella o funzione "codici" esiste già;
--  - le ricompense stanno in inventario_ricompense(owner_id, tipo,
--    riferimento_id, quantita, ottenuto_il), tipo in ('polvere', 'stampino',
--    'bustina', 'skip_missione') (CHECK inventario_ricompense_tipo_check);
--  - stesso schema di riscatta_traguardo: SECURITY DEFINER, search_path
--    public, una riga in inventario_ricompense per ricompensa.
--    riferimento_id = 'codice:<CODICE>' (lo Shop lo mostra come "Codice").
--
-- COSA FA
--  - codici: i codici (solo admin li vede; si creano dall'SQL editor, vedi
--    esempio in fondo). Ogni codice ha un elenco di ricompense, es.
--    [{"tipo":"polvere","quantita":100},{"tipo":"bustina","quantita":1}],
--    è spento finché attivo = false, può avere date di validità e un numero
--    massimo di usi totali.
--  - codici_riscattati: chi ha usato quale codice (ognuno vede solo i suoi),
--    con descrizione e ricompense copiate al momento (per l'elenco "Codici
--    usati" senza dare accesso alla tabella codici).
--  - codici_tentativi: i tentativi sbagliati, per il limite di 10 all'ora
--    per utente (contro chi prova codici a caso). Nessuno la legge dal sito.
--  - riscatta_codice(p_codice): normalizza (maiuscolo, senza spazi), controlla
--    limite tentativi, esistenza, attivo, date, usi; registra l'uso (una volta
--    per utente), accredita le ricompense. Non solleva eccezioni per i casi
--    normali: risponde {ok:false, errore:'...'} così il tentativo sbagliato
--    resta registrato (un'eccezione annullerebbe anche quello).
--
-- PER ANNULLARE: sql/102_codici_ROLLBACK.sql
-- ============================================================================

begin;

create table public.codici (
    codice text primary key check (codice ~ '^[A-Z0-9-]{4,32}$'),
    descrizione text not null default '',
    ricompense jsonb not null default '[]'::jsonb check (jsonb_typeof(ricompense) = 'array'),
    attivo boolean not null default false,
    valido_dal timestamptz,
    valido_al timestamptz,
    usi_max integer check (usi_max is null or usi_max > 0),
    usi_fatti integer not null default 0,
    creato_il timestamptz not null default now()
);
alter table public.codici enable row level security;
revoke all on table public.codici from anon, authenticated;
grant select on table public.codici to authenticated;
create policy "codici: solo admin legge" on public.codici
    for select to authenticated using ((select public.is_admin()));

create table public.codici_riscattati (
    codice text not null references public.codici(codice) on delete cascade,
    owner_id uuid not null references auth.users(id) on delete cascade,
    descrizione text not null default '',
    ricompense jsonb not null default '[]'::jsonb,
    riscattato_il timestamptz not null default now(),
    primary key (codice, owner_id)
);
create index codici_riscattati_owner_idx on public.codici_riscattati (owner_id, riscattato_il desc);
alter table public.codici_riscattati enable row level security;
revoke all on table public.codici_riscattati from anon, authenticated;
grant select on table public.codici_riscattati to authenticated;
create policy "codici_riscattati: ognuno vede i suoi" on public.codici_riscattati
    for select to authenticated using (owner_id = (select auth.uid()));

create table public.codici_tentativi (
    id bigint generated always as identity primary key,
    owner_id uuid not null references auth.users(id) on delete cascade,
    tentato_il timestamptz not null default now()
);
create index codici_tentativi_owner_idx on public.codici_tentativi (owner_id, tentato_il desc);
alter table public.codici_tentativi enable row level security;
revoke all on table public.codici_tentativi from anon, authenticated;

create function public.riscatta_codice(p_codice text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
    v_uid uuid := auth.uid();
    v_cod text;
    v public.codici%rowtype;
    r jsonb;
    v_tipo text;
    v_q integer;
    v_date jsonb := '[]'::jsonb;
begin
    if v_uid is null then
        return jsonb_build_object('ok', false, 'errore', 'Accedi per riscattare un codice.');
    end if;

    v_cod := upper(regexp_replace(coalesce(p_codice, ''), '\s', '', 'g'));

    if (select count(*) from public.codici_tentativi
        where owner_id = v_uid and tentato_il > now() - interval '1 hour') >= 10 then
        return jsonb_build_object('ok', false, 'errore', 'Troppi tentativi sbagliati: riprova tra un''ora.');
    end if;

    select * into v from public.codici where codice = v_cod for update;
    if not found or not v.attivo
       or (v.valido_dal is not null and now() < v.valido_dal)
       or (v.valido_al is not null and now() > v.valido_al) then
        insert into public.codici_tentativi (owner_id) values (v_uid);
        delete from public.codici_tentativi where owner_id = v_uid and tentato_il < now() - interval '1 day';
        return jsonb_build_object('ok', false, 'errore', 'Codice non valido o scaduto.');
    end if;

    if v.usi_max is not null and v.usi_fatti >= v.usi_max then
        return jsonb_build_object('ok', false, 'errore', 'Questo codice è esaurito.');
    end if;

    if exists (select 1 from public.codici_riscattati where codice = v_cod and owner_id = v_uid) then
        return jsonb_build_object('ok', false, 'errore', 'Hai già usato questo codice.');
    end if;

    for r in select * from jsonb_array_elements(v.ricompense) loop
        v_tipo := r->>'tipo';
        v_q := coalesce(nullif(r->>'quantita', '')::integer, 1);
        if v_tipo in ('polvere', 'stampino', 'bustina', 'skip_missione') and v_q > 0 then
            insert into public.inventario_ricompense (owner_id, tipo, riferimento_id, quantita, ottenuto_il)
            values (v_uid, v_tipo, 'codice:' || v_cod, v_q, now());
            v_date := v_date || jsonb_build_object('tipo', v_tipo, 'quantita', v_q);
        end if;
    end loop;

    insert into public.codici_riscattati (codice, owner_id, descrizione, ricompense)
    values (v_cod, v_uid, v.descrizione, v_date);
    update public.codici set usi_fatti = usi_fatti + 1 where codice = v_cod;

    return jsonb_build_object('ok', true, 'codice', v_cod, 'descrizione', v.descrizione, 'ricompense', v_date);
end;
$function$;
revoke all on function public.riscatta_codice(text) from public, anon;
grant execute on function public.riscatta_codice(text) to authenticated;

commit;

-- VERIFICA (dopo)
-- select relname, relrowsecurity from pg_class where relname in ('codici','codici_riscattati','codici_tentativi'); -- 3 x true
-- select tablename, policyname, cmd from pg_policies where tablename like 'codici%';                              -- 2 righe
-- select has_function_privilege('anon', 'public.riscatta_codice(text)', 'EXECUTE');                               -- false
-- select has_function_privilege('authenticated', 'public.riscatta_codice(text)', 'EXECUTE');                      -- true

-- ESEMPIO: creare un codice (dall'SQL editor), attivo, 100 Polvere + 1 bustina,
-- valido fino a fine anno, al massimo 6 usi in tutto:
-- insert into public.codici (codice, descrizione, ricompense, attivo, valido_al, usi_max)
-- values ('BINDEX-2026', 'Benvenuto in Bindex',
--         '[{"tipo":"polvere","quantita":100},{"tipo":"bustina","quantita":1}]', true,
--         '2026-12-31 23:59:59+01', 6);
-- Spegnere un codice:  update public.codici set attivo = false where codice = 'BINDEX-2026';
