// ── state/binder-pubblico.state.js ────────────────────────────────────────
// Stato di binder-pubblico.html: carte caricate, id binder dalla querystring,
// timer del flip-modal, sleeve già risolta (una sola volta per pagina, il
// binder è sempre lo stesso per tutta la sessione di navigazione).

        let carte = [];
        let _binderId = null;
        let _ownerUserId = null;
        let _binderInfo = null; // { nome, tipo, location_valore } — da leggi_binder_pubblico_info
        let _binderPagina = 0;
        let _modalita = 'elenco';
        let _flipCardTimeout = null;
        let _sleeveRisolta = null; // { url, metadata } oppure null se non c'è/non ancora richiesta
        // selezioni: aggiunta 26/08/2026 (Fase 1 consolidamento Scambio →
        // binder-pubblico.html) — richiesta da utils/shared-public.js
        // (toggleSelezione/modificaQty/aggiornaTotale) e da
        // ui/binder-flipbook.ui.js quando _libroSelezionabile=true. Vuoto
        // di default: la vetrina generica (location/extra) non la usa mai,
        // resta un oggetto vuoto innocuo.
        let selezioni = {};
        // FASE 2 CONSOLIDAMENTO (26/08/2026): nome del proprietario della
        // wishlist, passato nell'URL dal sito privato — stesso identico
        // pattern di state/wishlist.state.js (ora ritirato dal flusso di
        // condivisione, ma il file resta sul server per rollback). Link
        // vecchi/altri tipi di binder senza questo parametro restano
        // compatibili: null, testo generico di fallback in copiaRiepilogo().
        const _nomeProprietarioWishlist = new URLSearchParams(window.location.search).get('nome');
        // _copertinaRisolta: SPOSTATA in ui/binder-flipbook.ui.js il 26/08/2026
        // (estrazione del motore libro, condiviso ora anche da scambio/wishlist)
        // — dichiararla anche qui causerebbe un errore di parsing per
        // doppia dichiarazione "let" nello stesso scope globale di pagina.
