-- Migration 30: colonna per "nascondi match" persistente per-utente.
--
-- Claudio (2026-08-28, risposta 2): la scelta deve seguire l'utente tra
-- dispositivi, non essere per-dispositivo come matchVisti in localStorage
-- (data/preferences.repository.js) — quindi vive qui, su preferenze_utente
-- (owner_id, RLS "ALL, auth.uid() = owner_id" già verificata: il client
-- può leggere/scrivere solo la propria riga, nessuna nuova policy serve).
--
-- Tipo TEXT contenente un array JSON, non JSONB: stessa convenzione già
-- in uso nel progetto per dati strutturati in colonna singola (vedi
-- binders.layout, anch'essa text con JSON serializzato) — coerenza con
-- lo schema esistente piuttosto che introdurre un tipo nuovo nel progetto.
--
-- Valore: JSON di un array di stringhe, le chiavi stabili già usate da
-- _chiaveMatch/renderPaginaMatch (es. "carta123_wishlist456"). NULL o
-- assente = nessun match nascosto (stato iniziale per tutti).

ALTER TABLE public.preferenze_utente
  ADD COLUMN match_nascosti text;

-- Query di verifica dopo l'esecuzione:
-- select column_name, data_type from information_schema.columns
-- where table_schema='public' and table_name='preferenze_utente'
-- order by ordinal_position;
