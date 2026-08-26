// ── state/binder-pubblico.state.js ────────────────────────────────────────
// Stato di binder-pubblico.html: carte caricate, id binder dalla querystring,
// timer del flip-modal, sleeve già risolta (una sola volta per pagina, il
// binder è sempre lo stesso per tutta la sessione di navigazione).

        let carte = [];
        let _binderId = null;
        let _flipCardTimeout = null;
        let _sleeveRisolta = null; // { url, metadata } oppure null se non c'è/non ancora richiesta
