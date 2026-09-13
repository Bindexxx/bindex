-- ============================================================================
-- CardSync Pro — 50: Correzione FK richieste_scambio_righe.carta_id/
-- prodotto_sealed_id
--
-- Trovato durante il test guidato di concludi_riga_richiesta: le FK verso
-- carte/prodotti_sealed non avevano ON DELETE specificato (default NO
-- ACTION) — quando concludi_riga_richiesta elimina la riga carte originale
-- (qty arrivata a 0, "non lasciare quantità zero" da roadmap), il DELETE
-- falliva perché richieste_scambio_righe la referenzia ancora. Corretto
-- con ON DELETE SET NULL: la riga storica perde il riferimento diretto ma
-- mantiene tutto il necessario nello snapshot jsonb (già progettato per
-- essere la fonte di verità storica, non la riga live).
--
-- Conseguenza: dopo la correzione, una riga conclusa il cui oggetto è stato
-- eliminato può avere carta_id E prodotto_sealed_id ENTRAMBI null — il
-- CHECK richieste_scambio_righe_un_solo_tipo (sql/47, "esattamente uno dei
-- due") va rilassato ad "al massimo uno dei due", altrimenti la SET NULL
-- stessa lo violerebbe. Alla creazione (invia_richiesta_scambio) resta
-- comunque garantito che uno dei due sia valorizzato — lì non è un
-- INSERT con entrambi null, la RPC lo impedisce a monte.
-- ============================================================================

ALTER TABLE public.richieste_scambio_righe DROP CONSTRAINT richieste_scambio_righe_carta_id_fkey;
ALTER TABLE public.richieste_scambio_righe ADD CONSTRAINT richieste_scambio_righe_carta_id_fkey
    FOREIGN KEY (carta_id) REFERENCES public.carte(id) ON DELETE SET NULL;

ALTER TABLE public.richieste_scambio_righe DROP CONSTRAINT richieste_scambio_righe_prodotto_sealed_id_fkey;
ALTER TABLE public.richieste_scambio_righe ADD CONSTRAINT richieste_scambio_righe_prodotto_sealed_id_fkey
    FOREIGN KEY (prodotto_sealed_id) REFERENCES public.prodotti_sealed(id) ON DELETE SET NULL;

ALTER TABLE public.richieste_scambio_righe DROP CONSTRAINT richieste_scambio_righe_un_solo_tipo;
ALTER TABLE public.richieste_scambio_righe ADD CONSTRAINT richieste_scambio_righe_un_solo_tipo CHECK (
    (carta_id IS NOT NULL)::int + (prodotto_sealed_id IS NOT NULL)::int <= 1
);


-- ============================================================================
-- VERIFICA POST-ESECUZIONE
-- ============================================================================
-- select conname, pg_get_constraintdef(oid) from pg_constraint
-- where conrelid = 'richieste_scambio_righe'::regclass and contype in ('f','c');
-- -- le due FK devono mostrare "ON DELETE SET NULL", il CHECK "<= 1"
