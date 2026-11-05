-- ============================================================================
-- 127 — VERSIONE MINIMA DELL'ESTENSIONE → 5.50
-- Letto sul DB LIVE il 2026-11-05: configurazione_app.versione_minima = '5.47'
-- (sql/125, 28/10). Tabella dei PC (dispositivi_estensione): PC-K9RO4
-- (francesco) su 5.50 (visto 05/11 14:14 UTC), PC-DL8LI (ire) su 5.48 (29/10).
--
-- PERCHÉ: la 5.50 (PR #141) porta il login con la grafica del sito e include la
-- 5.48 (coda in orario in secondo piano) e la 5.49 (carte degli altri anonime).
--
-- ATTENZIONE: PC-DL8LI resta su 5.48 e si blocca finché non lancia
-- aggiorna_cardsync.bat. Deciso da Claudio il 05/11 ("non preoccuparti per
-- l'altro pc").
--
-- Rieseguibile (upsert sulla chiave).
-- PER ANNULLARE: sql/127_versione_minima_estensione_5_50_ROLLBACK.sql
-- ============================================================================
insert into public.configurazione_app (chiave, valore)
values ('versione_minima', '5.50')
on conflict (chiave) do update
  set valore = excluded.valore,
      aggiornato_il = now();

-- Verifica: deve restituire "versione_minima | 5.50", poi true, poi l'errore
-- ESTENSIONE_NON_AGGIORNATA per la 5.49 (lanciare le righe una alla volta).
select chiave, valore, aggiornato_il from public.configurazione_app where chiave = 'versione_minima';
-- select public.verifica_versione_minima('5.50');
-- select public.verifica_versione_minima('5.49');
