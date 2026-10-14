-- ============================================================================
-- 100 — POLICY RLS PIU' VELOCI (consiglio dell'advisor Supabase "auth_rls_initplan")
-- Scritto partendo dalle policy LIVE lette il 2026-10-14 (connettore in sola
-- lettura): 75 policy su 47 tabelle chiamano auth.uid() / auth.role() senza
-- (select ...), quindi Postgres le ricalcola per OGNI riga letta.
--
-- COSA FA: riscrive ognuna con (select auth.uid()) / (select auth.role()), che
-- viene calcolato una volta sola per query. Il significato NON cambia: stesse
-- condizioni, stessi ruoli, stessi comandi. ALTER POLICY non tocca i ruoli
-- (non c'e' TO) ne' il tipo (permissive/restrictive).
-- Salta le policy gia' corrette (quelle con "( SELECT auth.uid() AS uid)").
--
-- PER ANNULLARE: sql/100_policy_prestazioni_ROLLBACK.sql
-- ============================================================================

begin;

do $$
declare
    r record;
    v_q text;
    v_w text;
    v_n int := 0;
begin
    for r in
        select schemaname, tablename, policyname, qual, with_check
        from pg_policies
        where schemaname = 'public'
          and (coalesce(qual, '') ~ 'auth\.(uid|role)\(\)' or coalesce(with_check, '') ~ 'auth\.(uid|role)\(\)')
    loop
        -- protegge le forme gia' avvolte, poi avvolge le altre
        v_q := replace(replace(replace(replace(coalesce(r.qual, ''),
                  '( SELECT auth.uid() AS uid)', '@@UID@@'),
                  '( SELECT auth.role() AS role)', '@@ROLE@@'),
                  'auth.uid()', '(select auth.uid())'),
                  'auth.role()', '(select auth.role())');
        v_q := replace(replace(v_q, '@@UID@@', '(select auth.uid())'), '@@ROLE@@', '(select auth.role())');
        v_w := replace(replace(replace(replace(coalesce(r.with_check, ''),
                  '( SELECT auth.uid() AS uid)', '@@UID@@'),
                  '( SELECT auth.role() AS role)', '@@ROLE@@'),
                  'auth.uid()', '(select auth.uid())'),
                  'auth.role()', '(select auth.role())');
        v_w := replace(replace(v_w, '@@UID@@', '(select auth.uid())'), '@@ROLE@@', '(select auth.role())');

        execute format('alter policy %I on %I.%I%s%s',
            r.policyname, r.schemaname, r.tablename,
            case when r.qual is not null then format(' using (%s)', v_q) else '' end,
            case when r.with_check is not null then format(' with check (%s)', v_w) else '' end);
        v_n := v_n + 1;
    end loop;
    raise notice 'policy riscritte: %', v_n;
end;
$$;

commit;

-- VERIFICA (dopo): deve dare 0 (nessuna policy con auth.uid()/auth.role() "nuda")
-- select count(*) from pg_policies where schemaname = 'public'
--   and (regexp_replace(coalesce(qual,'') || coalesce(with_check,''), '\( SELECT auth\.(uid|role)\(\) AS (uid|role)\)', '', 'g') ~ 'auth\.(uid|role)\(\)');
