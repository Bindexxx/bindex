-- ============================================================================
-- 126 — FUNZIONI DI TRIGGER NON CHIAMABILI DA FUORI (avvisi di sicurezza Supabase)
-- Letto sul DB LIVE il 2026-11-04 (pg_proc, has_function_privilege, pg_trigger,
-- pg_event_trigger). Sei funzioni SECURITY DEFINER che servono SOLO a trigger
-- erano ancora eseguibili da anon e/o authenticated via /rest/v1/rpc/…:
--   handle_new_user()                  anon, authenticated, public  (trigger su auth.users)
--   rls_auto_enable()                  anon, authenticated, public  (event trigger ensure_rls)
--   _cardsync_registra_storico_prezzo() authenticated               (carte, prodotti_sealed, wishlist)
--   _coda_carte_view_insert()          authenticated                (vista coda_carte)
--   _coda_carte_view_update()          authenticated                (vista coda_carte)
--   _coda_carte_view_delete()          authenticated                (vista coda_carte)
-- Un trigger NON controlla il permesso EXECUTE quando scatta: lo prova il DB
-- stesso, dove _cestino_registra, _foto_carte_controlla e
-- _foto_carte_pulisci_oggetto hanno già solo postgres e i loro trigger
-- lavorano (cestino con 609 righe). Nessun file del sito o dell'estensione
-- chiama queste funzioni (cercato il 2026-11-04).
--
-- Da eseguire nell'SQL Editor di Supabase (il connettore annulla i REVOKE).
-- PER ANNULLARE: sql/126_permessi_funzioni_trigger_ROLLBACK.sql
-- ============================================================================
begin;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public._cardsync_registra_storico_prezzo() from public, anon, authenticated;
revoke execute on function public._coda_carte_view_insert() from public, anon, authenticated;
revoke execute on function public._coda_carte_view_update() from public, anon, authenticated;
revoke execute on function public._coda_carte_view_delete() from public, anon, authenticated;

commit;

-- Controllo (deve dare 6 righe, tutte false, false):
select p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('handle_new_user', 'rls_auto_enable', '_cardsync_registra_storico_prezzo',
                    '_coda_carte_view_insert', '_coda_carte_view_update', '_coda_carte_view_delete')
order by 1;
