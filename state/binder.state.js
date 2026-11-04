// Stato del binder e dell'editor del retro carta.

let _idsNelBinder = new Set();
        let _idsInScambio = new Set();
        let _quantitaOfferteScambio = {};
        const BINDER_LAYOUTS = {
            '2x2': { cols: 2, rows: 2 },
            '3x3': { cols: 3, rows: 3 },
            '3x4': { cols: 4, rows: 3 },
            '4x4': { cols: 4, rows: 4 },
        };
        const CHIAVE_BINDER_LAYOUT = 'cardsync_binder_layout';
        let _binderLayout = '3x3';
        let _binderPagina = 0;
        const BINDER_COVER_W = 1024;
        const BINDER_COVER_H = 1419;
        const CARD_BACK_W = 900;
        const CARD_BACK_H = 1260;
        const DEFAULT_STATE_CARD_BACK = {
            pokemon:    { left: 13.48, top: 9.33,  scale: 1 },
            condition:  { left: 27.19, top: 31.82, scale: 1 },
            variazione: { left: 27.19, top: 55.25, scale: 1 },
            price:      { left: 66.44, top: 78.27, scale: 1 }
        };
        let _cardBackFieldState = null;
        let _cardBackDragInitDone = false;

        let _bindersElenco = [];
        let _binderAttivo = null;

        let _binderModalita = 'immagini';
        const SOGLIA_BINDER_SOLO_ELENCO = 1088;

        let _coperturaBinderCache = new Map();

        let _binderExtraId = null;

        let _binderScambioId = null;
