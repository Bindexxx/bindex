-- ============================================================================
-- CardSync Pro — 40: Fase 1.2 (parte estensione) — nuovo tipo ordine
-- 'controlla_prezzi_sealed' + CHECK reale su ordini.tipo
--
-- SCOPERTA (verificato dal vivo, Regola d'Oro #3 — non dedotto dal file):
-- sql/12_schema_tabelle_base.sql (riga ~232) descrive un CHECK su
-- ordini.tipo che ammetterebbe solo 'aggiungi_carta','aggiungi_wishlist',
-- 'controlla_prezzi','controlla_prezzi_wishlist' — ma sul DB REALE questo
-- CHECK non esiste affatto. pg_constraint su public.ordini mostra solo
-- ordini_pkey (PK) e due FOREIGN KEY (creato_da, preso_in_carico_da),
-- nessun CHECK. Stessa classe di incongruenza file-storico-vs-DB-reale già
-- documentata nell'audit di Fase 0 (es. trova_match_scambio_wishlist in
-- sql/13 stale rispetto a sql/29).
--
-- CONSEGUENZA: un ordine con tipo='controlla_prezzi_sealed' viene già
-- accettato oggi SENZA questa migration (nessun CHECK lo blocca). Eseguita
-- comunque su richiesta esplicita di Claudio, per sicurezza futura — non
-- per sbloccare nulla che sia bloccato ora.
--
-- SECONDA INCONGRUENZA trovata mentre si scriveva questo CHECK: sql/12 usa
-- 'aggiungi_carta' (singolare), ma background.js (estensione) controlla
-- 'aggiungi_carte' (plurale) — due grafie diverse per lo stesso tipo.
-- Verificato: NESSUN punto del sito crea oggi ordini con questo tipo (grep
-- su ordiniInsert — solo controlla_prezzi/controlla_prezzi_wishlist/
-- controlla_prezzi_sealed vengono creati), quindi nessun flusso attivo si
-- romperebbe scegliendo la grafia sbagliata — ma per non escludere per
-- errore un futuro utilizzo, il CHECK sotto ammette ENTRAMBE le grafie
-- invece di sceglierne una a caso. Da chiarire con Claudio quale sia quella
-- "giusta" se/quando questo tipo ordine verrà davvero usato.
-- ============================================================================

ALTER TABLE public.ordini ADD CONSTRAINT ordini_tipo_check
  CHECK (tipo = ANY (ARRAY[
    'aggiungi_carta'::text,
    'aggiungi_carte'::text,
    'aggiungi_wishlist'::text,
    'controlla_prezzi'::text,
    'controlla_prezzi_wishlist'::text,
    'controlla_prezzi_sealed'::text
  ]));

-- ============================================================================
-- VERIFICA POST-ESECUZIONE
-- ============================================================================
-- select pg_get_constraintdef(oid)
-- from pg_constraint
-- where conrelid = 'public.ordini'::regclass and conname = 'ordini_tipo_check';
-- -- deve includere 'controlla_prezzi_sealed' nell'elenco
