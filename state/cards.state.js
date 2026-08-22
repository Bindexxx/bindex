// ── state/cards.state.js ──────────────────────────────────────────────────
// Stato della vista Collezione/Wishlist: dati caricati, ordinamento, filtri,
// carta in modifica, dettaglio foto, controllo prezzi. Stessi valori
// iniziali del codice originale.

        let carteReali = [];
        let _sortColonna = null;
        let _sortAsc = true;
        let _cartaInModifica = null;
        let _filtriTipo = { carte: true, sealed: true, wishlist: false };
        let _fotoDettaglioCartaId = null;
        let _fotoDettaglioTabella = null;
        let _ambitoControlloPrezzi = 'soloMie';
        let _pollOrdineInterval = null;
        let _pollOrdineWishlistInterval = null;
        const SOGLIA_GIORNI_PREZZO_SCADUTO = 7;
        const SOGLIA_MINUTI_CLAIM_PREZZI = 10;
        let _elencoPrezziScaduti = [];
        let _graficoPrezzoChart = null;
