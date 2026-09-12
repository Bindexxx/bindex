-- ============================================================================
-- CardSync Pro — 40: Fase 1.2 (parte estensione) — nuovo tipo ordine
-- 'controlla_prezzi_sealed'
--
-- ordini.tipo ha un CHECK che ammette solo un elenco fisso di valori
-- (sql/12_schema_tabelle_base.sql, riga ~232). Il sito deve poter creare
-- ordini di controllo prezzi per i prodotti sealed, stesso schema di
-- 'controlla_prezzi' (carte) e 'controlla_prezzi_wishlist' — serve quindi
-- un quarto valore ammesso.
--
-- Verificato prima di scrivere (Regola d'Oro #3): il constraint esistente è
--   tipo text not null check (tipo = any (array[
--     'aggiungi_carta','aggiungi_wishlist',
--     'controlla_prezzi','controlla_prezzi_wishlist'
--   ]))
-- Nome del constraint da confermare via pg_constraint prima di eseguire
-- (vedi query di verifica sotto) — DROP CONSTRAINT richiede il nome esatto.
-- ============================================================================

-- ── VERIFICA PRE-ESECUZIONE (esegui prima, per avere il nome esatto) ──────
-- select conname, pg_get_constraintdef(oid)
-- from pg_constraint
-- where conrelid = 'public.ordini'::regclass
--   and pg_get_constraintdef(oid) like '%controlla_prezzi%';

-- ── ESECUZIONE ──────────────────────────────────────────────────────────
-- NOTA: il nome del constraint sotto (ordini_tipo_check) è quello di
-- default che Postgres assegna a un CHECK inline dichiarato senza nome
-- esplicito in CREATE TABLE — va confermato con la query sopra prima di
-- eseguire questo blocco, ed eventualmente corretto.
ALTER TABLE public.ordini DROP CONSTRAINT IF EXISTS ordini_tipo_check;

ALTER TABLE public.ordini ADD CONSTRAINT ordini_tipo_check
  CHECK (tipo = ANY (ARRAY[
    'aggiungi_carta'::text,
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
