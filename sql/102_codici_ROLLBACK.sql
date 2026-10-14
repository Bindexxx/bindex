-- ============================================================================
-- 102 — ROLLBACK di sql/102_codici.sql
-- Toglie funzione e tabelle dei codici. ATTENZIONE: si perde l'elenco di chi
-- ha usato quali codici. Le ricompense già accreditate restano in
-- inventario_ricompense (riferimento_id 'codice:...'): se vanno tolte anche
-- quelle, decommentare la riga DELETE qui sotto.
-- Il sito torna da solo a "I codici non sono ancora attivi".
-- ============================================================================
begin;
drop function if exists public.riscatta_codice(text);
drop table if exists public.codici_tentativi;
drop table if exists public.codici_riscattati;
drop table if exists public.codici;
-- delete from public.inventario_ricompense where riferimento_id like 'codice:%';
commit;
