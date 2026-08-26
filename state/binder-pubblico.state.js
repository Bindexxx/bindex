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
        let _copertinaRisolta = null; // url oppure false (già tentata, non trovata) — cache per il libro
