-- ============================================================================
-- 77 — SICUREZZA, SECONDO GIRO: chiusura accessi anonimi residui
-- (audit 2026-09-25, dopo la 76 e il controllo automatico di Supabase)
-- Scritto partendo dai dati LIVE letti il 2026-09-25 alle 19:4x via
-- connessione diretta al DB (firme, permessi attuali, corpo delle funzioni):
-- nessuna deduzione dal codice client per la parte DB (Regola d'Oro #3).
--
-- COSA FA (una transazione: o tutto o niente):
--  A) 39 funzioni SECURITY DEFINER che solo utenti loggati usano (admin,
--     richieste di scambio, chat, missioni/traguardi, claim del controllo
--     prezzi, nickname, contributi, trigger della vista coda_carte):
--     tolto il permesso ad anon/PUBLIC, confermato ad authenticated e
--     service_role. Molte controllavano già chi le chiama al loro interno;
--     ora anche chi non ha fatto l'accesso non può più nemmeno chiamarle.
--  B) search_path fissato a 'public' sulle 9 funzioni (trigger e helper,
--     NON security definer) segnalate da Supabase. Verificato il corpo:
--     usano solo funzioni di sistema e auth.uid() con nome completo.
--
-- RESTANO APERTE A CHI NON HA FATTO L'ACCESSO (volutamente, 16):
--  le letture delle pagine pubbliche (leggi_binder_*, leggi_scaffale_*,
--  leggi_wishlist_*, leggi_sealed_condiviso, leggi_card_back_approvata,
--  leggi_colore_cornice_pubblico, leggi_media_binder_pubblico,
--  leggi_binder_id_owner), registra_apertura_binder/scaffale_pubblico,
--  request_password_reset (si usa proprio quando non si riesce ad entrare),
--  verifica_versione_minima, is_admin (usata dentro le policy RLS: deve
--  restare eseguibile da tutti i ruoli, altrimenti le query dei visitatori
--  anonimi andrebbero in errore).
-- NON TOCCATE (funzioni di sistema/autenticazione):
--  handle_password_verification_attempt — hook chiamato da Supabase Auth
--    ad OGNI login: riceve il permesso SOLO tramite PUBLIC, revocarlo
--    bloccherebbe tutti i login.
--  handle_new_user (trigger su auth.users), rls_auto_enable (di Supabase).
--
-- PER ANNULLARE: sql/77_sicurezza_secondo_giro_ROLLBACK.sql riporta i
-- permessi e i search_path ESATTAMENTE allo stato del 2026-09-25.
-- ============================================================================

begin;

-- ── A) 39 funzioni: niente più esecuzione anonima ──────────────────────────
revoke execute on function public._cardsync_registra_storico_prezzo() from public, anon;
grant  execute on function public._cardsync_registra_storico_prezzo() to authenticated, service_role;
revoke execute on function public._coda_carte_view_delete() from public, anon;
grant  execute on function public._coda_carte_view_delete() to authenticated, service_role;
revoke execute on function public._coda_carte_view_insert() from public, anon;
grant  execute on function public._coda_carte_view_insert() to authenticated, service_role;
revoke execute on function public._coda_carte_view_update() from public, anon;
grant  execute on function public._coda_carte_view_update() to authenticated, service_role;
revoke execute on function public.accetta_riga_richiesta(p_riga_id uuid) from public, anon;
grant  execute on function public.accetta_riga_richiesta(p_riga_id uuid) to authenticated, service_role;
revoke execute on function public.admin_ban_user(p_target uuid, p_until timestamp with time zone, p_reason text) from public, anon;
grant  execute on function public.admin_ban_user(p_target uuid, p_until timestamp with time zone, p_reason text) to authenticated, service_role;
revoke execute on function public.admin_hard_delete_user(p_target uuid) from public, anon;
grant  execute on function public.admin_hard_delete_user(p_target uuid) to authenticated, service_role;
revoke execute on function public.admin_process_pending_request(p_request_id uuid, p_decisione text, p_payload jsonb) from public, anon;
grant  execute on function public.admin_process_pending_request(p_request_id uuid, p_decisione text, p_payload jsonb) to authenticated, service_role;
revoke execute on function public.admin_reset_password(p_target uuid, p_new_password text) from public, anon;
grant  execute on function public.admin_reset_password(p_target uuid, p_new_password text) to authenticated, service_role;
revoke execute on function public.admin_restore_user(p_target uuid) from public, anon;
grant  execute on function public.admin_restore_user(p_target uuid) to authenticated, service_role;
revoke execute on function public.admin_revoke_sessions(p_target uuid) from public, anon;
grant  execute on function public.admin_revoke_sessions(p_target uuid) to authenticated, service_role;
revoke execute on function public.admin_soft_delete_user(p_target uuid) from public, anon;
grant  execute on function public.admin_soft_delete_user(p_target uuid) to authenticated, service_role;
revoke execute on function public.admin_unban_user(p_target uuid) from public, anon;
grant  execute on function public.admin_unban_user(p_target uuid) to authenticated, service_role;
revoke execute on function public.annulla_riga_richiesta(p_riga_id uuid, p_motivo text) from public, anon;
grant  execute on function public.annulla_riga_richiesta(p_riga_id uuid, p_motivo text) to authenticated, service_role;
revoke execute on function public.blocca_utente(p_bloccato_id uuid) from public, anon;
grant  execute on function public.blocca_utente(p_bloccato_id uuid) to authenticated, service_role;
revoke execute on function public.concludi_riga_richiesta(p_riga_id uuid, p_location_scelta text) from public, anon;
grant  execute on function public.concludi_riga_richiesta(p_riga_id uuid, p_location_scelta text) to authenticated, service_role;
revoke execute on function public.conta_carte_da_controllare_gruppo(p_owner_id_richiesto uuid, p_solo_proprie boolean, p_filtro_location text[], p_solo_vecchie boolean, p_giorni_minimi integer) from public, anon;
grant  execute on function public.conta_carte_da_controllare_gruppo(p_owner_id_richiesto uuid, p_solo_proprie boolean, p_filtro_location text[], p_solo_vecchie boolean, p_giorni_minimi integer) to authenticated, service_role;
revoke execute on function public.conta_prodotti_sealed_da_controllare_gruppo(p_owner_id_richiesto uuid, p_solo_proprie boolean, p_filtro_scaffali uuid[], p_solo_vecchie boolean, p_giorni_minimi integer) from public, anon;
grant  execute on function public.conta_prodotti_sealed_da_controllare_gruppo(p_owner_id_richiesto uuid, p_solo_proprie boolean, p_filtro_scaffali uuid[], p_solo_vecchie boolean, p_giorni_minimi integer) to authenticated, service_role;
revoke execute on function public.imposta_nickname(p_nickname text) from public, anon;
grant  execute on function public.imposta_nickname(p_nickname text) to authenticated, service_role;
revoke execute on function public.invia_messaggio(p_conversazione_id uuid, p_testo text) from public, anon;
grant  execute on function public.invia_messaggio(p_conversazione_id uuid, p_testo text) to authenticated, service_role;
revoke execute on function public.invia_richiesta_scambio(p_proprietario_id uuid, p_righe jsonb) from public, anon;
grant  execute on function public.invia_richiesta_scambio(p_proprietario_id uuid, p_righe jsonb) to authenticated, service_role;
revoke execute on function public.leggi_contributi_gruppo() from public, anon;
grant  execute on function public.leggi_contributi_gruppo() to authenticated, service_role;
revoke execute on function public.leggi_scambio_condiviso(p_owner_id uuid) from public, anon;
grant  execute on function public.leggi_scambio_condiviso(p_owner_id uuid) to authenticated, service_role;
revoke execute on function public.leggi_stato_claim_gruppo(p_soglia_minuti integer) from public, anon;
grant  execute on function public.leggi_stato_claim_gruppo(p_soglia_minuti integer) to authenticated, service_role;
revoke execute on function public.log_admin_action(p_action text, p_target uuid, p_details jsonb) from public, anon;
grant  execute on function public.log_admin_action(p_action text, p_target uuid, p_details jsonb) to authenticated, service_role;
revoke execute on function public.ottieni_nicknames(p_owner_ids uuid[]) from public, anon;
grant  execute on function public.ottieni_nicknames(p_owner_ids uuid[]) to authenticated, service_role;
revoke execute on function public.ottieni_o_crea_conversazione(p_altro_id uuid) from public, anon;
grant  execute on function public.ottieni_o_crea_conversazione(p_altro_id uuid) to authenticated, service_role;
revoke execute on function public.registra_aiuto_gruppo(p_riga_id text, p_owner_riga uuid, p_tipo text) from public, anon;
grant  execute on function public.registra_aiuto_gruppo(p_riga_id text, p_owner_riga uuid, p_tipo text) to authenticated, service_role;
revoke execute on function public.rifiuta_riga_richiesta(p_riga_id uuid) from public, anon;
grant  execute on function public.rifiuta_riga_richiesta(p_riga_id uuid) to authenticated, service_role;
revoke execute on function public.rilascia_claim_controllo_prezzi(p_dispositivo text) from public, anon;
grant  execute on function public.rilascia_claim_controllo_prezzi(p_dispositivo text) to authenticated, service_role;
revoke execute on function public.rilascia_claim_controllo_prezzi_sealed(p_dispositivo text) from public, anon;
grant  execute on function public.rilascia_claim_controllo_prezzi_sealed(p_dispositivo text) to authenticated, service_role;
revoke execute on function public.riscatta_missione_completata(p_missione_id text, p_finestra text, p_periodo text) from public, anon;
grant  execute on function public.riscatta_missione_completata(p_missione_id text, p_finestra text, p_periodo text) to authenticated, service_role;
revoke execute on function public.riscatta_traguardo(p_traguardo_id text) from public, anon;
grant  execute on function public.riscatta_traguardo(p_traguardo_id text) to authenticated, service_role;
revoke execute on function public.sblocca_riga_richiesta(p_riga_id uuid, p_motivo text) from public, anon;
grant  execute on function public.sblocca_riga_richiesta(p_riga_id uuid, p_motivo text) to authenticated, service_role;
revoke execute on function public.sblocca_utente(p_bloccato_id uuid) from public, anon;
grant  execute on function public.sblocca_utente(p_bloccato_id uuid) to authenticated, service_role;
revoke execute on function public.segna_letti_conversazione(p_conversazione_id uuid) from public, anon;
grant  execute on function public.segna_letti_conversazione(p_conversazione_id uuid) to authenticated, service_role;
revoke execute on function public.segnala_conversazione(p_conversazione_id uuid, p_motivo text) from public, anon;
grant  execute on function public.segnala_conversazione(p_conversazione_id uuid, p_motivo text) to authenticated, service_role;
revoke execute on function public.tagga_dispositivo_claim_gruppo(p_ids uuid[], p_dispositivo text) from public, anon;
grant  execute on function public.tagga_dispositivo_claim_gruppo(p_ids uuid[], p_dispositivo text) to authenticated, service_role;
revoke execute on function public.tagga_dispositivo_claim_gruppo_sealed(p_ids uuid[], p_dispositivo text) from public, anon;
grant  execute on function public.tagga_dispositivo_claim_gruppo_sealed(p_ids uuid[], p_dispositivo text) to authenticated, service_role;

-- ── B) search_path fissato sulle 9 funzioni segnalate ─────────────────────
alter function public._binders_blocca_rinomina_diretta() set search_path = public;
alter function public._binders_forza_condivisione() set search_path = public;
alter function public._cardsync_traccia_prezzo_precedente() set search_path = public;
alter function public._chat_ha_link_esterno(p_testo text) set search_path = public;
alter function public._chat_ha_parolacce(p_testo text) set search_path = public;
alter function public._chat_restrizioni_traccia_modifica() set search_path = public;
alter function public._rank_condizione(p_condizione text) set search_path = public;
alter function public._rank_integrita(p_integrita text) set search_path = public;
alter function public.aggiorna_updated_at() set search_path = public;

commit;

-- (FACOLTATIVO, NON incluso sopra — decidere a parte) tabella di backup
-- rimasta da una vecchia pulizia, RLS attiva senza policy:
-- drop table public.activity_log_accessi_duplicati_bak;

-- ============================================================================
-- VERIFICA (eseguire DOPO, sola lettura). Risultato atteso: ZERO righe.
-- ============================================================================
with chiuse(firma) as (values
    ('public._cardsync_registra_storico_prezzo()'),
    ('public._coda_carte_view_delete()'),
    ('public._coda_carte_view_insert()'),
    ('public._coda_carte_view_update()'),
    ('public.accetta_riga_richiesta(uuid)'),
    ('public.admin_ban_user(uuid, timestamp with time zone, text)'),
    ('public.admin_hard_delete_user(uuid)'),
    ('public.admin_process_pending_request(uuid, text, jsonb)'),
    ('public.admin_reset_password(uuid, text)'),
    ('public.admin_restore_user(uuid)'),
    ('public.admin_revoke_sessions(uuid)'),
    ('public.admin_soft_delete_user(uuid)'),
    ('public.admin_unban_user(uuid)'),
    ('public.annulla_riga_richiesta(uuid, text)'),
    ('public.blocca_utente(uuid)'),
    ('public.concludi_riga_richiesta(uuid, text)'),
    ('public.conta_carte_da_controllare_gruppo(uuid, boolean, text[], boolean, integer)'),
    ('public.conta_prodotti_sealed_da_controllare_gruppo(uuid, boolean, uuid[], boolean, integer)'),
    ('public.imposta_nickname(text)'),
    ('public.invia_messaggio(uuid, text)'),
    ('public.invia_richiesta_scambio(uuid, jsonb)'),
    ('public.leggi_contributi_gruppo()'),
    ('public.leggi_scambio_condiviso(uuid)'),
    ('public.leggi_stato_claim_gruppo(integer)'),
    ('public.log_admin_action(text, uuid, jsonb)'),
    ('public.ottieni_nicknames(uuid[])'),
    ('public.ottieni_o_crea_conversazione(uuid)'),
    ('public.registra_aiuto_gruppo(text, uuid, text)'),
    ('public.rifiuta_riga_richiesta(uuid)'),
    ('public.rilascia_claim_controllo_prezzi(text)'),
    ('public.rilascia_claim_controllo_prezzi_sealed(text)'),
    ('public.riscatta_missione_completata(text, text, text)'),
    ('public.riscatta_traguardo(text)'),
    ('public.sblocca_riga_richiesta(uuid, text)'),
    ('public.sblocca_utente(uuid)'),
    ('public.segna_letti_conversazione(uuid)'),
    ('public.segnala_conversazione(uuid, text)'),
    ('public.tagga_dispositivo_claim_gruppo(uuid[], text)'),
    ('public.tagga_dispositivo_claim_gruppo_sealed(uuid[], text)')
),
aperte(firma) as (values
    ('public.leggi_binder_pubblico(uuid)'), ('public.leggi_scaffale_pubblico(uuid)'),
    ('public.leggi_wishlist_condivisa(uuid)'), ('public.request_password_reset(text)'),
    ('public.is_admin()'), ('public.handle_password_verification_attempt(jsonb)')
)
select 'ancora eseguibile da anon' as problema, c.firma as dettaglio
from chiuse c where has_function_privilege('anon', c.firma::regprocedure, 'execute')
union all
select 'NON più eseguibile da authenticated', c.firma
from chiuse c where not has_function_privilege('authenticated', c.firma::regprocedure, 'execute')
union all
select 'funzione che doveva restare aperta ad anon è chiusa', a.firma
from aperte a where not has_function_privilege('anon', a.firma::regprocedure, 'execute')
union all
select 'search_path non fissato', p.proname::text
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('_binders_blocca_rinomina_diretta', '_binders_forza_condivisione', '_cardsync_traccia_prezzo_precedente', '_chat_ha_link_esterno', '_chat_ha_parolacce', '_chat_restrizioni_traccia_modifica', '_rank_condizione', '_rank_integrita', 'aggiorna_updated_at')
  and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
