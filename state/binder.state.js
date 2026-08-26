// ── state/binder.state.js ─────────────────────────────────────────────────
// Stato del Binder e del retro carta personalizzato: layout, pagina
// corrente, id nel binder, editor posizioni retro carta. Stessi valori
// iniziali del codice originale.
//
// L'ordine delle dichiarazioni qui sotto è significativo: _binderLayout usa
// BINDER_LAYOUTS e CHIAVE_BINDER_LAYOUT già definite sopra di lui in questo
// stesso file — non riordinare.

        let _idsNelBinder = new Set();
        const BINDER_LAYOUTS = {
            '2x2': { cols: 2, rows: 2 },
            '3x3': { cols: 3, rows: 3 },
            '3x4': { cols: 4, rows: 3 }, // etichetta "4×3": 4 colonne (orizzontali) × 3 righe (verticali) — nome chiave storico invariato per non rompere prefBinderLayoutGet() già salvati, corretti solo i valori (erano invertiti: prima cols:3,rows:4, cioè l'opposto di quanto mostrato in etichetta)
            '4x4': { cols: 4, rows: 4 },
        };
        const CHIAVE_BINDER_LAYOUT = 'cardsync_binder_layout';
        let _binderLayout = BINDER_LAYOUTS[prefBinderLayoutGet()] ? prefBinderLayoutGet() : '3x3';
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
        const BINDER_LAYOUT_ETICHETTE = { '2x2': '2×2', '3x3': '3×3', '3x4': '4×3', '4x4': '4×4' };
        // Multi-Binder (2026-08-25): _modificheBinderPendenti rimossa — era
        // usata solo dal modale "Aggiungi/gestisci carte nel Binder" (A6),
        // rimosso perché orfano (vedi index.html). Zero riferimenti rimasti.

        // ── Multi-Binder (2026-08-25): griglia dei contenitori ──────────────
        // _bindersElenco: righe della tabella 'binders' dell'utente (tipo,
        // nome, location_valore, id...), caricate una volta all'apertura del
        // widget Binders. _binderAttivo: id del binder aperto nella vista di
        // dettaglio (null = si è sulla griglia dei contenitori).
        let _bindersElenco = [];
        let _binderAttivo = null;

        // Modalità immagini/elenco — di default 'immagini', sovrascritta dopo
        // il caricamento di preferenze_utente (per-utente, sincronizzata,
        // vedi data/user-settings.repository.js:userSettingsUpsertBinderModalita).
        // Forzata a 'elenco' quando un binder supera SOGLIA_BINDER_SOLO_ELENCO
        // carte, qualunque sia la preferenza salvata (vedi renderBinderContenuto).
        let _binderModalita = 'immagini';
        const SOGLIA_BINDER_SOLO_ELENCO = 1088; // 4×4 per pagina, oltre: solo elenco testuale

        // Cache copertine già risolte in questa sessione (binder_id → url o
        // null) — evita di richiedere una signed URL ad ogni render della
        // griglia dei contenitori (le signed URL durano 1h, la griglia si
        // ridisegna spesso durante drag&drop/resize della home widget).
        let _coperturaBinderCache = new Map();

        // Id del binder tipo 'extra' dell'utente — garantito (get-or-create)
        // sia da caricaCarteReali() in ui/cards.ui.js (serve per popolare
        // _idsNelBinder ad ogni caricamento carte, indipendentemente dal
        // widget Binders) sia da apriWidgetBinders() qui. Un solo punto,
        // calcolato una volta, riusato da entrambi — evita due binder
        // 'extra' creati per una race condition tra i due caricamenti.
        let _binderExtraId = null;
