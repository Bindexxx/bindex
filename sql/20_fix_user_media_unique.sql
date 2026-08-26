-- ============================================================================
-- 20_fix_user_media_unique.sql
-- Stesso bug già preso e corretto su 'binders' (17_binders_multipli.sql),
-- questa volta su 'user_media': l'indice unico creato lì
-- (user_media_user_binder_slot_uniq, su coalesce(binder_id::text,'')) è
-- un'espressione — un ON CONFLICT lato client Supabase non riesce a
-- puntarci, con errore "there is no unique or exclusion constraint
-- matching the ON CONFLICT specification". Segnalato da Claudio: upload
-- copertina e sleeve di un binder falliscono entrambi con questo errore.
--
-- binder_id è NOT NULL per ogni riga scritta dal codice attuale (sempre
-- passato esplicitamente da ui/binder.ui.js) — le uniche righe con
-- binder_id NULL sono quelle orfane pre-Multi-Binder, mai lette da nessun
-- codice nuovo (vedi commento in data/binder.repository.js). Un vincolo
-- unique su colonne semplici (NULL <> NULL) le lascia semplicemente
-- ignorate, senza bisogno dell'espressione coalesce.
-- ============================================================================

drop index if exists public.user_media_user_binder_slot_uniq;

alter table public.user_media
    add constraint user_media_user_binder_slot_uniq
    unique (user_id, binder_id, slot);
