-- ============================================================================
-- ESPORTAZIONE SCHEMA LIVE (SOLA LETTURA — nessuna modifica al database)
-- Creato 2026-09-25 (audit, punto M8). I file sql/ numerati sono STORICI e
-- incompleti (mancano migrazioni, alcuni sono superati): questa query
-- ricostruisce dallo stato REALE del DB l'intera struttura dello schema
-- public + bucket e policy di storage, come elenco di istruzioni SQL.
--
-- COME USARLA: SQL editor di Supabase → esegui → "Download CSV" (i
-- risultati sono lunghi, non copiarli a mano). La colonna "ddl" contiene
-- le istruzioni, già ordinate (tabelle → funzioni → viste → vincoli →
-- indici → RLS → policy → trigger → storage → permessi funzioni).
--
-- NON contiene dati (nessuna riga di nessuna tabella) né password/segreti.
-- Le funzioni installate da estensioni Postgres (es. pgcrypto) sono escluse.
-- ============================================================================
with
tabelle(ordine, tipo, nome, ddl) as (
    select 0, 'TABELLA', c.relname::text,
           'create table public.' || quote_ident(c.relname) || E' (\n' ||
           string_agg(
               '  ' || quote_ident(a.attname) || ' ' || format_type(a.atttypid, a.atttypmod)
               || case when a.attnotnull then ' not null' else '' end
               || coalesce(' default ' || pg_get_expr(ad.adbin, ad.adrelid), ''),
               E',\n' order by a.attnum)
           || E'\n);'
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    left join pg_attrdef ad on ad.adrelid = c.oid and ad.adnum = a.attnum
    where n.nspname = 'public' and c.relkind in ('r', 'p')
    group by c.relname
),
funzioni(ordine, tipo, nome, ddl) as (
    select 1, 'FUNZIONE', p.proname::text, pg_get_functiondef(p.oid) || ';'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind in ('f', 'p')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
),
viste(ordine, tipo, nome, ddl) as (
    select 2, 'VISTA', c.relname::text,
           'create or replace view public.' || quote_ident(c.relname) || E' as\n' || pg_get_viewdef(c.oid, true)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v'
),
vincoli(ordine, tipo, nome, ddl) as (
    select 3, 'VINCOLO', (rel.relname || '.' || con.conname)::text,
           'alter table public.' || quote_ident(rel.relname) || ' add constraint '
           || quote_ident(con.conname) || ' ' || pg_get_constraintdef(con.oid) || ';'
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public'
      and con.contype <> 'n'  -- i NOT NULL sono già dentro "create table"
),
indici(ordine, tipo, nome, ddl) as (
    select 4, 'INDICE', i.indexname::text, i.indexdef || ';'
    from pg_indexes i
    where i.schemaname = 'public'
      and not exists (select 1 from pg_constraint k where k.conname = i.indexname)
),
rls(ordine, tipo, nome, ddl) as (
    select 5, 'RLS', c.relname::text,
           'alter table public.' || quote_ident(c.relname) || ' enable row level security;'
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
),
policy_tabelle(ordine, tipo, nome, ddl) as (
    select 6, 'POLICY', (pol.tablename || '.' || pol.policyname)::text,
           'create policy ' || quote_ident(pol.policyname) || ' on public.' || quote_ident(pol.tablename)
           || ' as ' || pol.permissive || ' for ' || pol.cmd
           || ' to ' || array_to_string(pol.roles, ', ')
           || coalesce(' using (' || pol.qual || ')', '')
           || coalesce(' with check (' || pol.with_check || ')', '') || ';'
    from pg_policies pol
    where pol.schemaname = 'public'
),
trigger_tabelle(ordine, tipo, nome, ddl) as (
    select 7, 'TRIGGER', t.tgname::text, pg_get_triggerdef(t.oid) || ';'
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and not t.tgisinternal
),
bucket(ordine, tipo, nome, ddl) as (
    select 8, 'BUCKET', b.id::text,
           'insert into storage.buckets (id, name, public) values ('
           || quote_literal(b.id) || ', ' || quote_literal(b.name) || ', ' || b.public::text
           || ') on conflict (id) do nothing;'
    from storage.buckets b
),
policy_storage(ordine, tipo, nome, ddl) as (
    select 9, 'POLICY STORAGE', pol.policyname::text,
           'create policy ' || quote_ident(pol.policyname) || ' on storage.objects'
           || ' as ' || pol.permissive || ' for ' || pol.cmd
           || ' to ' || array_to_string(pol.roles, ', ')
           || coalesce(' using (' || pol.qual || ')', '')
           || coalesce(' with check (' || pol.with_check || ')', '') || ';'
    from pg_policies pol
    where pol.schemaname = 'storage' and pol.tablename = 'objects'
),
permessi_funzioni(ordine, tipo, nome, ddl) as (
    select 10, 'PERMESSI FUNZIONE', p.proname::text,
           '-- ' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ') → '
           || coalesce(array_to_string(p.proacl, ', '), 'permessi di default')
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind in ('f', 'p')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
)
select ordine, tipo, nome, ddl from tabelle
union all select * from funzioni
union all select * from viste
union all select * from vincoli
union all select * from indici
union all select * from rls
union all select * from policy_tabelle
union all select * from trigger_tabelle
union all select * from bucket
union all select * from policy_storage
union all select * from permessi_funzioni
order by ordine, nome;
