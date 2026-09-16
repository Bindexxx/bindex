-- ============================================================================
-- CardSync Pro — 60: Fase 9 — Colonna Vetrina Achievement in preferenze_utente
--
-- Stesso pattern già in uso per match_nascosti/dafare_risolti in questo
-- stesso file (migration 30/31): TEXT con un array JSON serializzato dal
-- client, letto grezzo da userSettingsGet() ed elaborato lato JS. Nessun
-- problema di sicurezza qui (a differenza di sql/58): è una preferenza
-- personale ("quali dei MIEI achievement sbloccati voglio in vetrina"),
-- non un premio — la RLS "ALL, owner_id=auth.uid()" già esistente su
-- preferenze_utente resta corretta e invariata per questa colonna.
-- Vincolo di max 16 elementi (un 4×4 pieno) applicato lato client, non qui
-- — stesso approccio già in uso per le altre liste JSON di questa tabella.
-- ============================================================================

ALTER TABLE public.preferenze_utente ADD COLUMN achievement_vetrina text;

-- ============================================================================
-- VERIFICA POST-ESECUZIONE
-- select column_name, data_type from information_schema.columns where table_name='preferenze_utente' and column_name='achievement_vetrina';
-- ============================================================================
