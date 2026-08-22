// ── state/app.state.js ────────────────────────────────────────────────────
// Stato globale generico dell'app (non specifico di carte/binder): auth,
// navigazione, location, inserimento carte, versione estensione. Stessi
// valori iniziali del codice originale, solo spostati fuori dallo script
// inline di index.html.
//
// Va caricato PRIMA del resto della logica applicativa (che legge/scrive
// queste variabili come globali, esattamente come prima).

        const authEmail    = document.getElementById('authEmail');
        const authPassword = document.getElementById('authPassword');
        const authError    = document.getElementById('authError');
        const authSubmit   = document.getElementById('authSubmit');
        const mantieniAccessoToggle = document.getElementById('mantieniAccesso');
        const REGEX_USERNAME = /^[a-z0-9_]{3,20}$/;
        let _locationCaricate = false;
        let _locationComuneCaricata = false;
        let _destinazioneInserimento = 'collezione';
        let _tipoInserimento = 'carta';
        let currentMode = 'visualizzazione';
        let highlightedRowId = null;
        let changelogClicks = 0;
        const NUMERO_ATTIVITA_RECENTI = 5;
        let _flipCardTimeout = null;
        let _debounceRicaricaCarte = null;
        let _resizeTimeout = null;
        const ID_ESTENSIONE_CARDSYNC = 'hoibifiiabdlndcdopfjjpahchhbmojo';
        let _ultimaVersioneRichiesta = null; // memorizzata per i ricontrolli successivi
        let _versioneVecchiaRilevata = false; // true se un'estensione (vecchia) ha risposto — determina il bivio delle istruzioni
        const CHIAVE_APRI_SEMPRE_APP = 'cardsyncApriSempreApp'; // locale a QUESTO browser/dispositivo, non nel profilo utente
        let _locationDisponibiliCache = null;
        const CHIAVE_SIDEBAR_COMPRESSA = 'cardsync_sidebar_collapsed';
        const CHIAVE_RIDUCI_ANIMAZIONI = 'cardsync_riduci_animazioni';
