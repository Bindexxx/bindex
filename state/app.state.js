// Stato generale dell'app: accesso, navigazione, location, inserimento, estensione.

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
        let _ultimaVersioneRichiesta = null;
        let _versioneVecchiaRilevata = false;
        const CHIAVE_APRI_SEMPRE_APP = 'cardsyncApriSempreApp';
        let _locationDisponibiliCache = null;
        const CHIAVE_SIDEBAR_COMPRESSA = 'cardsync_sidebar_collapsed';
        const CHIAVE_RIDUCI_ANIMAZIONI = 'cardsync_riduci_animazioni';
