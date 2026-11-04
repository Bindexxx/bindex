-- ROLLBACK di sql/126: rimette i permessi letti sul DB live il 2026-11-04.
--   handle_new_user, rls_auto_enable: {=X, postgres=X, anon=X, authenticated=X}
--   _cardsync_registra_storico_prezzo, _coda_carte_view_*: {postgres=X, authenticated=X, service_role=X}
-- Da eseguire nell'SQL Editor di Supabase.
begin;

grant execute on function public.handle_new_user() to public, anon, authenticated;
grant execute on function public.rls_auto_enable() to public, anon, authenticated;
grant execute on function public._cardsync_registra_storico_prezzo() to authenticated;
grant execute on function public._coda_carte_view_insert() to authenticated;
grant execute on function public._coda_carte_view_update() to authenticated;
grant execute on function public._coda_carte_view_delete() to authenticated;

commit;

-- Controllo: handle_new_user e rls_auto_enable true/true, le altre false/true.
select p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('handle_new_user', 'rls_auto_enable', '_cardsync_registra_storico_prezzo',
                    '_coda_carte_view_insert', '_coda_carte_view_update', '_coda_carte_view_delete')
order by 1;
