-- ============================================================================
-- 76 — ROLLBACK di sql/76_sicurezza_accessi_anonimi.sql
-- Riporta ESATTAMENTE lo stato del 2026-09-25 (permessi, policy e
-- search_path copiati dallo schema live esportato quel giorno). Da usare
-- solo se la 76 ha rotto qualcosa. Una transazione: o tutto o niente.
-- ============================================================================

begin;

-- A) Ripristina l'esecuzione per PUBLIC e anon (com'era)
grant execute on function public.aggiorna_nota_controllo_gruppo(p_id uuid, p_nota text) to public, anon;
grant execute on function public.aggiorna_prezzo_controllo_gruppo(p_id uuid, p_prezzo numeric, p_immagine text) to public, anon;
grant execute on function public.aggiorna_prezzo_controllo_gruppo_sealed(p_id uuid, p_prezzo numeric, p_immagine text) to public, anon;
grant execute on function public.aggiorna_url_controllo_gruppo(p_id uuid, p_url text) to public, anon;
grant execute on function public.aggiorna_url_controllo_gruppo_sealed(p_id uuid, p_url text) to public, anon;
grant execute on function public.segna_controllata_gruppo(p_id uuid) to public, anon;
grant execute on function public.segna_controllata_gruppo_sealed(p_id uuid) to public, anon;
grant execute on function public.reclama_carte_per_controllo_prezzi(p_user_id uuid, p_owner_id_richiesto uuid, p_solo_proprie boolean, p_filtro_location text[], p_solo_vecchie boolean, p_giorni_minimi integer, p_lotto_size integer) to public, anon;
grant execute on function public.reclama_prodotti_sealed_per_controllo_prezzi(p_user_id uuid, p_owner_id_richiesto uuid, p_solo_proprie boolean, p_filtro_scaffali uuid[], p_solo_vecchie boolean, p_giorni_minimi integer, p_lotto_size integer) to public, anon;
grant execute on function public.completa_riga_coda_carte(p_riga_coda_id uuid, p_nome text, p_codice text, p_location text, p_qty integer, p_lingua text, p_condizione text, p_url text, p_prezzo numeric, p_note text, p_immagine text, p_tipo text, p_destinazione text, p_prezzo_obiettivo numeric) to public, anon;
grant execute on function public.sposta_riga_in_correzione_manuale(p_riga_id bigint, p_errore_msg text, p_opzioni jsonb) to public, anon;
grant execute on function public.completa_lavoro(p_id bigint, p_esito jsonb, p_errore_msg text) to public, anon;
grant execute on function public.reclama_lavoro(p_user_id uuid, p_dispositivo text, p_aiuta_gruppo boolean, p_lotto_size integer, p_tipi text[]) to public, anon;
grant execute on function public.conta_lavoro_pendente(p_user_id uuid, p_aiuta_gruppo boolean, p_tipi text[]) to public, anon;
grant execute on function public.pulisci_storico_prezzi() to public, anon;
grant execute on function public.trova_match_scambio_wishlist(p_owner_id uuid) to public, anon;
grant execute on function public.trova_match_scambio_wishlist_sealed(p_owner_id uuid) to public, anon;
grant execute on function public.trova_match_wishlist_scambio(p_owner_id uuid) to public, anon;
grant execute on function public.trova_match_wishlist_scambio_sealed(p_owner_id uuid) to public, anon;

-- B) Policy storage Bustina: via le nuove, tornano le vecchie (testo identico)
drop policy if exists "lettura pubblica bustina-immagini" on storage.objects;
drop policy if exists "lettura pubblica bustina-testi" on storage.objects;
drop policy if exists "admin scrive file bustina" on storage.objects;
drop policy if exists "admin modifica file bustina" on storage.objects;
drop policy if exists "admin elimina file bustina" on storage.objects;
create policy "Allow anon and auth full access to bustina-immagini" on storage.objects for ALL to anon, authenticated using ((bucket_id = 'bustina-immagini'::text)) with check ((bucket_id = 'bustina-immagini'::text));
create policy "Allow anon and auth full access to bustina-testi" on storage.objects for ALL to anon, authenticated using ((bucket_id = 'bustina-testi'::text)) with check ((bucket_id = 'bustina-testi'::text));
create policy "Authenticated update bustina-assets" on storage.objects for UPDATE to authenticated using ((bucket_id = 'bustina-assets'::text)) with check ((bucket_id = 'bustina-assets'::text));
create policy "Authenticated write bustina-assets" on storage.objects for INSERT to authenticated with check ((bucket_id = 'bustina-assets'::text));

-- C) search_path di nuovo non impostato (com'era)
alter function public._coda_carte_view_update() reset search_path;
alter function public.completa_lavoro(p_id bigint, p_esito jsonb, p_errore_msg text) reset search_path;
alter function public.conta_lavoro_pendente(p_user_id uuid, p_aiuta_gruppo boolean, p_tipi text[]) reset search_path;
alter function public.reclama_lavoro(p_user_id uuid, p_dispositivo text, p_aiuta_gruppo boolean, p_lotto_size integer, p_tipi text[]) reset search_path;

commit;
