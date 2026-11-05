// Stato di Collezione e Wishlist: dati, ordinamento, filtri, carta in modifica.

let carteReali = [];
        let prodottiSealedReali = [];
        let _sortColonna = null;
        let _sortAsc = true;
        let _cartaInModifica = null;
        let _filtriTipo = { carte: true, sealed: true, wishlist: false };
        let _fotoDettaglioCartaId = null;
        let _fotoDettaglioTabella = null;
        let _ambitoControlloPrezzi = prefAmbitoPrezziGet();
        let _pollOrdineInterval = null;
        let _pollOrdineWishlistInterval = null;
        let _scaffaliSealedCaricati = false;
        let _ambitoControlloPrezziSealed = prefAmbitoPrezziGet();
        let _pollOrdineSealedInterval = null;
        const SOGLIA_GIORNI_PREZZO_SCADUTO = 7;
        let _elencoPrezziScaduti = [];
        let _graficoPrezzoChart = null;
