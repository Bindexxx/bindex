// ── state/cards.state.js ──────────────────────────────────────────────────
// Stato della vista Collezione/Wishlist: dati caricati, ordinamento, filtri,
// carta in modifica, dettaglio foto, controllo prezzi. Stessi valori
// iniziali del codice originale.

        let carteReali = [];
        // FASE 1 (2026-09-12): array parallelo per i prodotti sealed
        // (tabella prodotti_sealed, dominio separato da carte). Popolato da
        // caricaProdottiSealedReali() in ui/widget-sealed.ui.js.
        let prodottiSealedReali = [];
        let _sortColonna = null;
        let _sortAsc = true;
        let _cartaInModifica = null;
        let _filtriTipo = { carte: true, sealed: true, wishlist: false };
        let _fotoDettaglioCartaId = null;
        let _fotoDettaglioTabella = null;
        let _ambitoControlloPrezzi = 'soloMie';
        let _pollOrdineInterval = null;
        let _pollOrdineWishlistInterval = null;
        // Fase 1.2 (2026-09-12): stato del pannello Controllo Prezzi Sealed,
        // separato da quello carte sopra. Fase 1.3 (stesso giorno):
        // _locationSealedCaricate → _scaffaliSealedCaricati, Scaffali ha
        // sostituito location come organizzatore dei sealed.
        let _scaffaliSealedCaricati = false;
        let _ambitoControlloPrezziSealed = 'soloMie';
        let _pollOrdineSealedInterval = null;
        const SOGLIA_GIORNI_PREZZO_SCADUTO = 7;
        const SOGLIA_MINUTI_CLAIM_PREZZI = 10;
        let _elencoPrezziScaduti = [];
        let _graficoPrezzoChart = null;
