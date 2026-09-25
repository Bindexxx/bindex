-- ============================================================================
-- 76 — SICUREZZA: chiusura accessi anonimi (audit 2026-09-25, S1/S2/S4)
-- Scritto partendo dallo schema LIVE esportato il 2026-09-25
-- (sql/schema_live_2026-09-25.sql) — firme, permessi e policy verificati lì,
-- non dedotti dal codice client (Regola d'Oro #3).
--
-- COSA FA (3 blocchi, tutto in UNA transazione: o passa tutto o niente):
--  A) 19 funzioni SECURITY DEFINER oggi eseguibili anche da chi NON è
--     loggato (ruolo anon) e senza controlli su chi le chiama: tolto il
--     permesso ad anon/PUBLIC, confermato ad authenticated e service_role.
--     Chi le usa davvero (estensione per "Aiuta il gruppo" e coda carte,
--     sito per i Match) le chiama SEMPRE da loggato: nessun cambiamento
--     per voi. Le 3 funzioni della vecchia coda_lavoro (completa_lavoro,
--     reclama_lavoro, conta_lavoro_pendente) e pulisci_storico_prezzi non
--     sono chiamate da nessun file di sito/estensione.
--  B) Storage Bustina: bustina-immagini e bustina-testi erano scrivibili
--     (caricare/sovrascrivere/CANCELLARE) da chiunque, anche senza account;
--     bustina-assets da qualunque utente loggato. Ora: lettura invariata,
--     scrittura solo admin. Il sito legge soltanto questi bucket (verificato
--     in data/bustina.repository.js) e i caricamenti dalla dashboard
--     Supabase non passano dalle policy: continuano a funzionare.
--  C) search_path fissato a 'public' sulle 4 funzioni SECURITY DEFINER che
--     non l'avevano (stesso valore già usato dalle altre 81): usano solo
--     tabelle di public, comportamento identico.
--
-- NON TOCCA (volutamente, serve una decisione a parte):
--  - ordini (policy using(true)): il modello "qualunque dispositivo del
--    gruppo esegue l'ordine" dipende da quella apertura.
--  - immagini-carte (sovrascrivibile da ogni loggato): l'estensione ci
--    salva le immagini delle carte di tutto il gruppo.
--  - rls_auto_enable: funzione di sistema di Supabase.
--
-- PER ANNULLARE: sql/76_sicurezza_accessi_anonimi_ROLLBACK.sql riporta
-- tutto esattamente allo stato del 2026-09-25.
-- ============================================================================

begin;

-- ── A) Funzioni: niente più esecuzione anonima ─────────────────────────────
revoke execute on function public.aggiorna_nota_controllo_gruppo(p_id uuid, p_nota text) from public, anon;
grant  execute on function public.aggiorna_nota_controllo_gruppo(p_id uuid, p_nota text) to authenticated, service_role;
revoke execute on function public.aggiorna_prezzo_controllo_gruppo(p_id uuid, p_prezzo numeric, p_immagine text) from public, anon;
grant  execute on function public.aggiorna_prezzo_controllo_gruppo(p_id uuid, p_prezzo numeric, p_immagine text) to authenticated, service_role;
revoke execute on function public.aggiorna_prezzo_controllo_gruppo_sealed(p_id uuid, p_prezzo numeric, p_immagine text) from public, anon;
grant  execute on function public.aggiorna_prezzo_controllo_gruppo_sealed(p_id uuid, p_prezzo numeric, p_immagine text) to authenticated, service_role;
revoke execute on function public.aggiorna_url_controllo_gruppo(p_id uuid, p_url text) from public, anon;
grant  execute on function public.aggiorna_url_controllo_gruppo(p_id uuid, p_url text) to authenticated, service_role;
revoke execute on function public.aggiorna_url_controllo_gruppo_sealed(p_id uuid, p_url text) from public, anon;
grant  execute on function public.aggiorna_url_controllo_gruppo_sealed(p_id uuid, p_url text) to authenticated, service_role;
revoke execute on function public.segna_controllata_gruppo(p_id uuid) from public, anon;
grant  execute on function public.segna_controllata_gruppo(p_id uuid) to authenticated, service_role;
revoke execute on function public.segna_controllata_gruppo_sealed(p_id uuid) from public, anon;
grant  execute on function public.segna_controllata_gruppo_sealed(p_id uuid) to authenticated, service_role;
revoke execute on function public.reclama_carte_per_controllo_prezzi(p_user_id uuid, p_owner_id_richiesto uuid, p_solo_proprie boolean, p_filtro_location text[], p_solo_vecchie boolean, p_giorni_minimi integer, p_lotto_size integer) from public, anon;
grant  execute on function public.reclama_carte_per_controllo_prezzi(p_user_id uuid, p_owner_id_richiesto uuid, p_solo_proprie boolean, p_filtro_location text[], p_solo_vecchie boolean, p_giorni_minimi integer, p_lotto_size integer) to authenticated, service_role;
revoke execute on function public.reclama_prodotti_sealed_per_controllo_prezzi(p_user_id uuid, p_owner_id_richiesto uuid, p_solo_proprie boolean, p_filtro_scaffali uuid[], p_solo_vecchie boolean, p_giorni_minimi integer, p_lotto_size integer) from public, anon;
grant  execute on function public.reclama_prodotti_sealed_per_controllo_prezzi(p_user_id uuid, p_owner_id_richiesto uuid, p_solo_proprie boolean, p_filtro_scaffali uuid[], p_solo_vecchie boolean, p_giorni_minimi integer, p_lotto_size integer) to authenticated, service_role;
revoke execute on function public.completa_riga_coda_carte(p_riga_coda_id uuid, p_nome text, p_codice text, p_location text, p_qty integer, p_lingua text, p_condizione text, p_url text, p_prezzo numeric, p_note text, p_immagine text, p_tipo text, p_destinazione text, p_prezzo_obiettivo numeric) from public, anon;
grant  execute on function public.completa_riga_coda_carte(p_riga_coda_id uuid, p_nome text, p_codice text, p_location text, p_qty integer, p_lingua text, p_condizione text, p_url text, p_prezzo numeric, p_note text, p_immagine text, p_tipo text, p_destinazione text, p_prezzo_obiettivo numeric) to authenticated, service_role;
revoke execute on function public.sposta_riga_in_correzione_manuale(p_riga_id bigint, p_errore_msg text, p_opzioni jsonb) from public, anon;
grant  execute on function public.sposta_riga_in_correzione_manuale(p_riga_id bigint, p_errore_msg text, p_opzioni jsonb) to authenticated, service_role;
revoke execute on function public.completa_lavoro(p_id bigint, p_esito jsonb, p_errore_msg text) from public, anon;
grant  execute on function public.completa_lavoro(p_id bigint, p_esito jsonb, p_errore_msg text) to authenticated, service_role;
revoke execute on function public.reclama_lavoro(p_user_id uuid, p_dispositivo text, p_aiuta_gruppo boolean, p_lotto_size integer, p_tipi text[]) from public, anon;
grant  execute on function public.reclama_lavoro(p_user_id uuid, p_dispositivo text, p_aiuta_gruppo boolean, p_lotto_size integer, p_tipi text[]) to authenticated, service_role;
revoke execute on function public.conta_lavoro_pendente(p_user_id uuid, p_aiuta_gruppo boolean, p_tipi text[]) from public, anon;
grant  execute on function public.conta_lavoro_pendente(p_user_id uuid, p_aiuta_gruppo boolean, p_tipi text[]) to authenticated, service_role;
revoke execute on function public.pulisci_storico_prezzi() from public, anon;
grant  execute on function public.pulisci_storico_prezzi() to authenticated, service_role;
revoke execute on function public.trova_match_scambio_wishlist(p_owner_id uuid) from public, anon;
grant  execute on function public.trova_match_scambio_wishlist(p_owner_id uuid) to authenticated, service_role;
revoke execute on function public.trova_match_scambio_wishlist_sealed(p_owner_id uuid) from public, anon;
grant  execute on function public.trova_match_scambio_wishlist_sealed(p_owner_id uuid) to authenticated, service_role;
revoke execute on function public.trova_match_wishlist_scambio(p_owner_id uuid) from public, anon;
grant  execute on function public.trova_match_wishlist_scambio(p_owner_id uuid) to authenticated, service_role;
revoke execute on function public.trova_match_wishlist_scambio_sealed(p_owner_id uuid) from public, anon;
grant  execute on function public.trova_match_wishlist_scambio_sealed(p_owner_id uuid) to authenticated, service_role;

-- ── B) Storage Bustina: lettura invariata, scrittura solo admin ────────────
drop policy if exists "Allow anon and auth full access to bustina-immagini" on storage.objects;
drop policy if exists "Allow anon and auth full access to bustina-testi" on storage.objects;
drop policy if exists "Authenticated update bustina-assets" on storage.objects;
drop policy if exists "Authenticated write bustina-assets" on storage.objects;

-- Lettura (come prima: chiunque, anche senza login — i bucket sono pubblici)
create policy "lettura pubblica bustina-immagini" on storage.objects
    for select to anon, authenticated using (bucket_id = 'bustina-immagini');
create policy "lettura pubblica bustina-testi" on storage.objects
    for select to anon, authenticated using (bucket_id = 'bustina-testi');
-- ("Public read bustina-assets" esiste già e resta com'è.)

-- Scrittura: solo admin, sui tre bucket
create policy "admin scrive file bustina" on storage.objects
    for insert to authenticated
    with check (bucket_id in ('bustina-immagini', 'bustina-testi', 'bustina-assets') and public.is_admin());
create policy "admin modifica file bustina" on storage.objects
    for update to authenticated
    using (bucket_id in ('bustina-immagini', 'bustina-testi', 'bustina-assets') and public.is_admin())
    with check (bucket_id in ('bustina-immagini', 'bustina-testi', 'bustina-assets') and public.is_admin());
create policy "admin elimina file bustina" on storage.objects
    for delete to authenticated
    using (bucket_id in ('bustina-immagini', 'bustina-testi', 'bustina-assets') and public.is_admin());

-- ── C) search_path fissato ──────────────────────────────────────────────
alter function public._coda_carte_view_update() set search_path = public;
alter function public.completa_lavoro(p_id bigint, p_esito jsonb, p_errore_msg text) set search_path = public;
alter function public.conta_lavoro_pendente(p_user_id uuid, p_aiuta_gruppo boolean, p_tipi text[]) set search_path = public;
alter function public.reclama_lavoro(p_user_id uuid, p_dispositivo text, p_aiuta_gruppo boolean, p_lotto_size integer, p_tipi text[]) set search_path = public;

commit;

-- ============================================================================
-- VERIFICA (eseguire DOPO, sola lettura). Risultato atteso: ZERO righe.
-- Ogni riga = qualcosa che non è andato come previsto.
-- ============================================================================
-- (firme con i soli TIPI dei parametri: è il formato richiesto da ::regprocedure)
with attese(firma) as (values
    ('public.aggiorna_nota_controllo_gruppo(uuid, text)'),
    ('public.aggiorna_prezzo_controllo_gruppo(uuid, numeric, text)'),
    ('public.aggiorna_prezzo_controllo_gruppo_sealed(uuid, numeric, text)'),
    ('public.aggiorna_url_controllo_gruppo(uuid, text)'),
    ('public.aggiorna_url_controllo_gruppo_sealed(uuid, text)'),
    ('public.segna_controllata_gruppo(uuid)'),
    ('public.segna_controllata_gruppo_sealed(uuid)'),
    ('public.reclama_carte_per_controllo_prezzi(uuid, uuid, boolean, text[], boolean, integer, integer)'),
    ('public.reclama_prodotti_sealed_per_controllo_prezzi(uuid, uuid, boolean, uuid[], boolean, integer, integer)'),
    ('public.completa_riga_coda_carte(uuid, text, text, text, integer, text, text, text, numeric, text, text, text, text, numeric)'),
    ('public.sposta_riga_in_correzione_manuale(bigint, text, jsonb)'),
    ('public.completa_lavoro(bigint, jsonb, text)'),
    ('public.reclama_lavoro(uuid, text, boolean, integer, text[])'),
    ('public.conta_lavoro_pendente(uuid, boolean, text[])'),
    ('public.pulisci_storico_prezzi()'),
    ('public.trova_match_scambio_wishlist(uuid)'),
    ('public.trova_match_scambio_wishlist_sealed(uuid)'),
    ('public.trova_match_wishlist_scambio(uuid)'),
    ('public.trova_match_wishlist_scambio_sealed(uuid)')
)
select 'funzione ancora eseguibile da anon' as problema, a.firma as dettaglio
from attese a
where has_function_privilege('anon', a.firma::regprocedure, 'execute')
union all
select 'funzione NON più eseguibile da authenticated', a.firma
from attese a
where not has_function_privilege('authenticated', a.firma::regprocedure, 'execute')
union all
select 'policy bustina con scrittura aperta ancora presente', p.policyname::text
from pg_policies p
where p.schemaname = 'storage' and p.tablename = 'objects'
  and p.policyname in ('Allow anon and auth full access to bustina-immagini',
                       'Allow anon and auth full access to bustina-testi',
                       'Authenticated update bustina-assets',
                       'Authenticated write bustina-assets')
union all
select 'search_path non fissato', p.proname::text
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('_coda_carte_view_update', 'completa_lavoro', 'conta_lavoro_pendente', 'reclama_lavoro')
  and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
