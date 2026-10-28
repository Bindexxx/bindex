-- ============================================================================
-- 125 — VERSIONE MINIMA DELL'ESTENSIONE → 5.47 (Piano 2026-10-23, Fase 10.2)
-- Letto sul DB LIVE il 2026-10-28: configurazione_app (chiave PK, valore,
-- aggiornato_il), una riga versione_minima = '5.35' (messa il 23/10, passo 0a),
-- nessun trigger, solo la policy di lettura. verifica_versione_minima confronta
-- le versioni come numeri (string_to_array(...)::int[]).
-- Tabella dei PC (dispositivi_estensione, sql/122): un solo PC, PC-DL8LI, su
-- 5.47 (visto 2026-10-28 14:48 UTC). Altri PC nelle carte (dispositivo): ultima
-- prenotazione il 15/10 (PC-RXCNU), prima della 5.40 che li registra.
--
-- PERCHÉ: con la 5.35 ammessa, un PC rimasto indietro lavora ancora con i
-- difetti corretti nelle Fasi 1-9 (doppio turno del ritmo, motore vecchio dopo
-- il bat, Cloudflare non contato, ecc.). Con 5.47 smette di leggere e scrivere
-- finché non lancia aggiorna_cardsync.bat.
--
-- QUANDO: la 5.47 è già pubblicata (PR #133 unita, bat eseguito su PC-DL8LI).
--
-- Da eseguire nell'SQL editor di Supabase. Rieseguibile (upsert sulla chiave).
-- PER ANNULLARE: sql/125_versione_minima_estensione_5_47_ROLLBACK.sql
-- ============================================================================
insert into public.configurazione_app (chiave, valore)
values ('versione_minima', '5.47')
on conflict (chiave) do update
  set valore = excluded.valore,
      aggiornato_il = now();

-- Verifica: deve restituire "versione_minima | 5.47", poi true, poi l'errore
-- ESTENSIONE_NON_AGGIORNATA per la 5.46 (lanciare le righe una alla volta).
select chiave, valore, aggiornato_il from public.configurazione_app where chiave = 'versione_minima';
-- select public.verifica_versione_minima('5.47');
-- select public.verifica_versione_minima('5.46');
