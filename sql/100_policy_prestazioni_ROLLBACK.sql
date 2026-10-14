-- ROLLBACK di sql/100: rimette auth.uid() / auth.role() "nudi" in tutte le policy
-- pubbliche (anche in quelle create dopo, come il cestino: cambia solo la velocita').
begin;
do $$
declare
    r record;
    v_q text;
    v_w text;
begin
    for r in
        select schemaname, tablename, policyname, qual, with_check
        from pg_policies
        where schemaname = 'public'
          and (coalesce(qual, '') ~ '\( SELECT auth\.(uid|role)\(\) AS (uid|role)\)' or coalesce(with_check, '') ~ '\( SELECT auth\.(uid|role)\(\) AS (uid|role)\)')
    loop
        v_q := replace(replace(coalesce(r.qual, ''), '( SELECT auth.uid() AS uid)', 'auth.uid()'), '( SELECT auth.role() AS role)', 'auth.role()');
        v_w := replace(replace(coalesce(r.with_check, ''), '( SELECT auth.uid() AS uid)', 'auth.uid()'), '( SELECT auth.role() AS role)', 'auth.role()');
        execute format('alter policy %I on %I.%I%s%s',
            r.policyname, r.schemaname, r.tablename,
            case when r.qual is not null then format(' using (%s)', v_q) else '' end,
            case when r.with_check is not null then format(' with check (%s)', v_w) else '' end);
    end loop;
end;
$$;
commit;
