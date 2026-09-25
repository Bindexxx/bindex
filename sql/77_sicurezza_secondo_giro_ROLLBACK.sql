-- ============================================================================
-- 77 — ROLLBACK di sql/77_sicurezza_secondo_giro.sql
-- Ripristina ESATTAMENTE i permessi e i search_path del 2026-09-25 (letti
-- dal DB live prima della 77). Una transazione: o tutto o niente.
-- ============================================================================

begin;

grant execute on function public._cardsync_registra_storico_prezzo() to public, anon;
revoke execute on function public._cardsync_registra_storico_prezzo() from service_role;
grant execute on function public._coda_carte_view_delete() to public, anon;
revoke execute on function public._coda_carte_view_delete() from service_role;
grant execute on function public._coda_carte_view_insert() to public, anon;
revoke execute on function public._coda_carte_view_insert() from service_role;
grant execute on function public._coda_carte_view_update() to public, anon;
revoke execute on function public._coda_carte_view_update() from service_role;
grant execute on function public.accetta_riga_richiesta(p_riga_id uuid) to public, anon;
revoke execute on function public.accetta_riga_richiesta(p_riga_id uuid) from service_role;
grant execute on function public.admin_ban_user(p_target uuid, p_until timestamp with time zone, p_reason text) to public, anon;
revoke execute on function public.admin_ban_user(p_target uuid, p_until timestamp with time zone, p_reason text) from service_role;
grant execute on function public.admin_hard_delete_user(p_target uuid) to public, anon;
revoke execute on function public.admin_hard_delete_user(p_target uuid) from service_role;
grant execute on function public.admin_process_pending_request(p_request_id uuid, p_decisione text, p_payload jsonb) to public, anon;
revoke execute on function public.admin_process_pending_request(p_request_id uuid, p_decisione text, p_payload jsonb) from service_role;
grant execute on function public.admin_reset_password(p_target uuid, p_new_password text) to public, anon;
revoke execute on function public.admin_reset_password(p_target uuid, p_new_password text) from service_role;
grant execute on function public.admin_restore_user(p_target uuid) to public, anon;
revoke execute on function public.admin_restore_user(p_target uuid) from service_role;
grant execute on function public.admin_revoke_sessions(p_target uuid) to public, anon;
revoke execute on function public.admin_revoke_sessions(p_target uuid) from service_role;
grant execute on function public.admin_soft_delete_user(p_target uuid) to public, anon;
revoke execute on function public.admin_soft_delete_user(p_target uuid) from service_role;
grant execute on function public.admin_unban_user(p_target uuid) to public, anon;
revoke execute on function public.admin_unban_user(p_target uuid) from service_role;
grant execute on function public.annulla_riga_richiesta(p_riga_id uuid, p_motivo text) to public, anon;
revoke execute on function public.annulla_riga_richiesta(p_riga_id uuid, p_motivo text) from service_role;
grant execute on function public.blocca_utente(p_bloccato_id uuid) to public, anon;
revoke execute on function public.blocca_utente(p_bloccato_id uuid) from service_role;
grant execute on function public.concludi_riga_richiesta(p_riga_id uuid, p_location_scelta text) to public, anon;
revoke execute on function public.concludi_riga_richiesta(p_riga_id uuid, p_location_scelta text) from service_role;
grant execute on function public.conta_carte_da_controllare_gruppo(p_owner_id_richiesto uuid, p_solo_proprie boolean, p_filtro_location text[], p_solo_vecchie boolean, p_giorni_minimi integer) to public, anon;
revoke execute on function public.conta_carte_da_controllare_gruppo(p_owner_id_richiesto uuid, p_solo_proprie boolean, p_filtro_location text[], p_solo_vecchie boolean, p_giorni_minimi integer) from service_role;
grant execute on function public.conta_prodotti_sealed_da_controllare_gruppo(p_owner_id_richiesto uuid, p_solo_proprie boolean, p_filtro_scaffali uuid[], p_solo_vecchie boolean, p_giorni_minimi integer) to public, anon;
revoke execute on function public.conta_prodotti_sealed_da_controllare_gruppo(p_owner_id_richiesto uuid, p_solo_proprie boolean, p_filtro_scaffali uuid[], p_solo_vecchie boolean, p_giorni_minimi integer) from service_role;
grant execute on function public.imposta_nickname(p_nickname text) to public, anon;
revoke execute on function public.imposta_nickname(p_nickname text) from service_role;
grant execute on function public.invia_messaggio(p_conversazione_id uuid, p_testo text) to public, anon;
revoke execute on function public.invia_messaggio(p_conversazione_id uuid, p_testo text) from service_role;
grant execute on function public.invia_richiesta_scambio(p_proprietario_id uuid, p_righe jsonb) to public, anon;
revoke execute on function public.invia_richiesta_scambio(p_proprietario_id uuid, p_righe jsonb) from service_role;
grant execute on function public.leggi_contributi_gruppo() to anon;
revoke execute on function public.leggi_contributi_gruppo() from service_role;
grant execute on function public.leggi_scambio_condiviso(p_owner_id uuid) to public, anon;
revoke execute on function public.leggi_scambio_condiviso(p_owner_id uuid) from service_role;
grant execute on function public.leggi_stato_claim_gruppo(p_soglia_minuti integer) to public, anon;
revoke execute on function public.leggi_stato_claim_gruppo(p_soglia_minuti integer) from service_role;
grant execute on function public.log_admin_action(p_action text, p_target uuid, p_details jsonb) to public, anon;
revoke execute on function public.log_admin_action(p_action text, p_target uuid, p_details jsonb) from service_role;
grant execute on function public.ottieni_nicknames(p_owner_ids uuid[]) to public, anon;
revoke execute on function public.ottieni_nicknames(p_owner_ids uuid[]) from service_role;
grant execute on function public.ottieni_o_crea_conversazione(p_altro_id uuid) to public, anon;
revoke execute on function public.ottieni_o_crea_conversazione(p_altro_id uuid) from service_role;
grant execute on function public.registra_aiuto_gruppo(p_riga_id text, p_owner_riga uuid, p_tipo text) to anon;
revoke execute on function public.registra_aiuto_gruppo(p_riga_id text, p_owner_riga uuid, p_tipo text) from service_role;
grant execute on function public.rifiuta_riga_richiesta(p_riga_id uuid) to public, anon;
revoke execute on function public.rifiuta_riga_richiesta(p_riga_id uuid) from service_role;
grant execute on function public.rilascia_claim_controllo_prezzi(p_dispositivo text) to public, anon;
revoke execute on function public.rilascia_claim_controllo_prezzi(p_dispositivo text) from service_role;
grant execute on function public.rilascia_claim_controllo_prezzi_sealed(p_dispositivo text) to public, anon;
revoke execute on function public.rilascia_claim_controllo_prezzi_sealed(p_dispositivo text) from service_role;
grant execute on function public.riscatta_missione_completata(p_missione_id text, p_finestra text, p_periodo text) to public, anon;
revoke execute on function public.riscatta_missione_completata(p_missione_id text, p_finestra text, p_periodo text) from service_role;
grant execute on function public.riscatta_traguardo(p_traguardo_id text) to public, anon;
revoke execute on function public.riscatta_traguardo(p_traguardo_id text) from service_role;
grant execute on function public.sblocca_riga_richiesta(p_riga_id uuid, p_motivo text) to public, anon;
revoke execute on function public.sblocca_riga_richiesta(p_riga_id uuid, p_motivo text) from service_role;
grant execute on function public.sblocca_utente(p_bloccato_id uuid) to public, anon;
revoke execute on function public.sblocca_utente(p_bloccato_id uuid) from service_role;
grant execute on function public.segna_letti_conversazione(p_conversazione_id uuid) to public, anon;
revoke execute on function public.segna_letti_conversazione(p_conversazione_id uuid) from service_role;
grant execute on function public.segnala_conversazione(p_conversazione_id uuid, p_motivo text) to public, anon;
revoke execute on function public.segnala_conversazione(p_conversazione_id uuid, p_motivo text) from service_role;
grant execute on function public.tagga_dispositivo_claim_gruppo(p_ids uuid[], p_dispositivo text) to public, anon;
revoke execute on function public.tagga_dispositivo_claim_gruppo(p_ids uuid[], p_dispositivo text) from service_role;
grant execute on function public.tagga_dispositivo_claim_gruppo_sealed(p_ids uuid[], p_dispositivo text) to public, anon;
revoke execute on function public.tagga_dispositivo_claim_gruppo_sealed(p_ids uuid[], p_dispositivo text) from service_role;

alter function public._binders_blocca_rinomina_diretta() reset search_path;
alter function public._binders_forza_condivisione() reset search_path;
alter function public._cardsync_traccia_prezzo_precedente() reset search_path;
alter function public._chat_ha_link_esterno(p_testo text) reset search_path;
alter function public._chat_ha_parolacce(p_testo text) reset search_path;
alter function public._chat_restrizioni_traccia_modifica() reset search_path;
alter function public._rank_condizione(p_condizione text) reset search_path;
alter function public._rank_integrita(p_integrita text) reset search_path;
alter function public.aggiorna_updated_at() reset search_path;

commit;
