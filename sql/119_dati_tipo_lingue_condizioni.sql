-- ============================================================================
-- 119 — DATI DELLE CARTE: TIPO, LINGUE, CONDIZIONI (estensione 5.39)
-- Piano 2026-10-23, Fase 3.4 (D14) e 3.5 (B10, Q7). Tabella approvata da
-- Claudio il 23/10; carta SEALED decisa il 24/10 ("NM + sigillata").
--
-- Letto sul DB LIVE il 2026-10-24 (conteggi rifatti prima di applicare,
-- uguali a quelli del 23/10 per le righe che cambiano):
-- - carte.tipo: default 'carta', ma 643 carte con tipo NULL (scritte da
--   completa_riga_coda_carte con p_tipo NULL, che scavalca il default). Dalla
--   5.39 l'estensione manda 'carta'.
-- - lingua 'CIN' 22 carte: non è una sigla Cardmarket ('CHN' = cinese
--   semplificato, id 6). Lingua '?' 18 e NULL 1: restano (nessun filtro).
-- - condizione 'EXC' 3 → 'EX'; 'EXC+' 1 → 'EX' (Cardmarket non ha EX+);
--   'POOR' 1 → 'PO'; '?' 23: restano (nessun filtro).
-- - condizione 'SEALED' 1 (Pecharunt SVP 129, di Francesco): è la carta ancora
--   nella bustina → condizione 'NM' e sigillata_originale = true.
-- - Trigger su carte: storico e prezzo_precedente scattano solo se cambia il
--   prezzo (qui no); updated_at si aggiorna sulle righe toccate (nessun uso
--   sul sito). Nessun movimento in movimenti_collezione.
-- - wishlist, coda attiva e correzioni: nessun valore da sistemare.
--
-- Le sigle alias (CIN, EXC, POOR, …) restano comunque riconosciute
-- dall'estensione dalla 5.39 (una sola mappa in shared.js).
-- Ritorno indietro: 119_..._ROLLBACK.sql (lingue e condizioni, per id).
-- ============================================================================

update public.carte set tipo = 'carta' where tipo is null;

update public.carte set lingua = 'CHN' where lingua = 'CIN';

update public.carte set condizione = 'EX' where condizione in ('EXC', 'EXC+');
update public.carte set condizione = 'PO' where condizione = 'POOR';

update public.carte set condizione = 'NM', sigillata_originale = true
 where condizione = 'SEALED';
