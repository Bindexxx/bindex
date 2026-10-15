-- ============================================================================
-- 107 — VERSIONE MINIMA DELL'ESTENSIONE → 5.18
-- Letto sul DB LIVE il 2026-10-15: configurazione_app ha una sola riga,
-- versione_minima = '5.17' (messa da sql/103). verifica_versione_minima
-- confronta le versioni come numeri (provato sul DB il 2026-10-15: 5.17 ammessa,
-- 5.16 rifiutata, 5.100 ammessa).
--
-- PERCHÉ: la 5.18 corregge il punto 25 — senza login Cardmarket i giri
-- automatici (ordini dal sito, controllo in inattività, "mi unisco") segnavano
-- tutte le carte come controllate e scrivevano "Prezzo non trovato..." nelle
-- loro note. Una 5.17 rimasta installata su un PC del gruppo può ancora farlo:
-- alzando la versione minima, la 5.17 smette di leggere/scrivere dati finché
-- non viene aggiornata.
--
-- QUANDO: SOLO dopo che la 5.18 è pubblicata (PR unita + pubblicazione del sito
-- finita: releases/latest-version.txt online = 5.18). Mai prima, altrimenti si
-- blocca chi non ha ancora potuto aggiornare.
--
-- Da eseguire nell'SQL editor di Supabase. Rieseguibile (upsert sulla chiave).
-- PER ANNULLARE: sql/107_versione_minima_estensione_5_18_ROLLBACK.sql
-- ============================================================================
insert into public.configurazione_app (chiave, valore)
values ('versione_minima', '5.18')
on conflict (chiave) do update
  set valore = excluded.valore,
      aggiornato_il = now();

-- Verifica: deve restituire una riga "versione_minima | 5.18".
select chiave, valore, aggiornato_il
from public.configurazione_app
where chiave = 'versione_minima';
