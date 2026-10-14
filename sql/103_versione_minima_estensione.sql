-- ============================================================================
-- 103 — VERSIONE MINIMA DELL'ESTENSIONE (configurazione_app.versione_minima)
-- Letto sul DB LIVE il 2026-10-14: configurazione_app è VUOTA (nessuna chiave);
-- colonne chiave text PRIMARY KEY, valore text NOT NULL, aggiornato_il default
-- now(); RLS attiva con la sola SELECT per authenticated → si scrive solo da
-- SQL editor. verifica_versione_minima(p_versione_client) confronta le versioni
-- come array di interi (5.9 < 5.16 < 5.17 < 5.100, verificato sul DB): se la
-- versione dell'estensione è più bassa solleva ESTENSIONE_NON_AGGIORNATA; se la
-- riga non c'è lascia passare tutti.
--
-- EFFETTO: dalla 5.17 in poi l'estensione si rifiuta di leggere/scrivere dati
-- se è sotto questa versione (supabase_adapter.js, "Controllo 2"). La 5.16 e
-- precedenti NON tengono conto di questo valore (era il bug corretto nella
-- 5.17), quindi eseguirlo non blocca chi è ancora sulla 5.16: lo blocca già,
-- come sempre, il controllo su releases/latest-version.txt.
--
-- QUANDO: dopo aver pubblicato la 5.17 (zip + latest-version.txt su main).
-- A OGNI RILASCIO FUTURO: prima si pubblica la nuova versione, POI si alza
-- questo valore — mai prima, altrimenti si blocca chi non ha ancora potuto
-- aggiornare.
--
-- Da eseguire nell'SQL editor di Supabase. Rieseguibile (upsert sulla chiave).
-- PER ANNULLARE: sql/103_versione_minima_estensione_ROLLBACK.sql
-- ============================================================================
insert into public.configurazione_app (chiave, valore)
values ('versione_minima', '5.17')
on conflict (chiave) do update
  set valore = excluded.valore,
      aggiornato_il = now();

-- Verifica: deve restituire una riga "versione_minima | 5.17".
select chiave, valore, aggiornato_il
from public.configurazione_app
where chiave = 'versione_minima';
