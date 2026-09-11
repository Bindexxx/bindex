// ═══════════════════════════════════════════════════════════════════════
// PAGINAINIZIALE-DETTAGLIO.UI.JS — apertura/chiusura dettaglio widget
// (animazione "a Pokéball") — CardSync Pro
// ═══════════════════════════════════════════════════════════════════════
// STEP 1 del piano di taglio di ui/paginainiziale.ui.js (concordato con
// Claudio il 2026-09-11, sessione "restructuring struttura file / riduzione
// accoppiamento"). Estratto da ui/paginainiziale.ui.js. NESSUNA riscrittura
// del codice esistente: solo spostamento, zero cambi di comportamento per
// l'utente finale.
//
// Contiene: apertura/chiusura del dettaglio widget con l'animazione a
// cerchio che si espande dal punto toccato (DURATA_ANIMAZIONE_DETTAGLIO_MS,
// _impostaOrigineAnimazione, apriDettaglioWidget, chiudiDettaglioWidget).
//
// Dipende da (rimasti in ui/paginainiziale.ui.js o in altri file già
// caricati): _rettangoloSchermoCornice/_posizionaContainerNelloSchermo
// (drag-resize), _beep, _aggiornaTastoFisico, renderWidgetHome, e le
// funzioni di apertura dei singoli widget con pagina propria
// (apriWidgetBinders, ecc.) chiamate dentro apriDettaglioWidget. Nessuna
// istruzione qui gira a tempo di caricamento script — tutto è dichiarato e
// invocato solo più tardi, quindi l'ordine di questo <script> rispetto
// agli altri file paginainiziale-*.ui.js è indifferente, purché tutti
// carichino prima della chiamata a initPhoneShell() in fondo a index.html.
// ───────────────────────────────────────────────────────────────────────

// ── APERTURA/CHIUSURA — animazione "a Pokéball" ──────────────────────────
// Claudio ha approvato l'idea di un'apertura che richiami il tema
// Pokéball: un cerchio che si espande dal punto esatto in cui hai
// toccato/cliccato il widget (CSS clip-path, nessun asset nuovo). La
// transizione è dichiarata SEMPRE in CSS (.container.container-visibile,
// vedi index.html) — qui ci limitiamo a impostare l'origine del cerchio
// (variabili CSS --pokeball-x/-y) e a spostare le classi, MAI a
// toccare transition/clip-path a mano: è quello il pattern fragile che
// causava il blocco a metà (vedi commento CSS per i dettagli).
const DURATA_ANIMAZIONE_DETTAGLIO_MS = 300;
let _chiusuraDettaglioTimeout = null;

function _impostaOrigineAnimazione(container, evt) {
    const schermo = document.getElementById('phoneScreen');
    const rect = schermo ? schermo.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    // FIX 2026-09-10 (bug: "schermata nera con una transizione che entra
    // da destra verso sinistra", segnalato su bustina ma riguarda OGNI
    // widget): --pokeball-x/-y alimentano clip-path: circle(... at
    // var(--pokeball-x) var(--pokeball-y)) su .container — per specifica
    // CSS quella posizione è relativa al reference box di .container
    // STESSO (il suo angolo in alto a sinistra), MAI al viewport. Prima
    // funzionava per coincidenza: .container, aperto a tutta la finestra
    // (decisione 30/08, annullata oggi per "cornice pokedex"), partiva
    // sempre da (0,0) nel viewport — le coordinate assolute del click
    // (evt.clientX/Y) coincidevano già con quelle locali. Ora che
    // .container è agganciato al rettangolo di #phoneScreen (quasi mai a
    // 0,0 nel viewport), la stessa origine assoluta finiva calcolata
    // rispetto al punto sbagliato: il cerchio nasceva ben fuori dal box
    // visibile (a destra) e "spazzava" verso sinistra crescendo fino al
    // 150% — esattamente l'effetto segnalato. Si sottrae qui
    // rect.left/rect.top (lo STESSO rettangolo che
    // _posizionaContainerNelloSchermo userà un istante dopo per il
    // top/left di .container, vedi _rettangoloSchermoCornice) per
    // riportare l'origine relativa al box giusto.
    const x = (evt && evt.clientX ? evt.clientX : rect.left + rect.width / 2) - rect.left;
    const y = (evt && evt.clientY ? evt.clientY : rect.top + rect.height / 2) - rect.top;
    container.style.setProperty('--pokeball-x', x + 'px');
    container.style.setProperty('--pokeball-y', y + 'px');
}

async function apriDettaglioWidget(tabId, evt) {
    clearTimeout(_chiusuraDettaglioTimeout); // annulla un'eventuale chiusura ancora in corso (riapertura rapida)

    const container = document.querySelector('.container');
    if (tabId === 'dafare' || tabId === 'match' || tabId === 'condividi' || tabId === 'missioni' || tabId === 'valore' || tabId === 'wishlist' || tabId === 'location' || tabId === 'doppioni' || tabId === 'sealed' || tabId === 'set' || tabId === 'bustina') {
        // MAI switchTab() qui: quella funzione ha una whitelist fissa di 5
        // tab (navigation.ui.js r.199) ed è segnata nella memoria di
        // progetto come "deve restare stabile e intoccata" — un bug reale
        // c'è già stato lì in passato. Repliochiamo solo il minimo che
        // switchTab farebbe per una tab in whitelist (nascondi tutte le
        // view-section, mostra la mia), concordato con Claudio 2026-08-28
        // (dafare) e riusato identico per 'match', 'condividi', 'missioni'
        // e ora 'valore' (2026-08-30, pagina dedicata Valore collezione).
        document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
        document.getElementById(tabId)?.classList.add('active');
        if (tabId === 'dafare') renderPaginaDaFare();
        if (tabId === 'match') renderPaginaMatch();
        if (tabId === 'condividi') renderPaginaCondividi();
        if (tabId === 'missioni') renderPaginaMissioni();
        if (tabId === 'valore') renderPaginaValoreCollezione();
        if (tabId === 'wishlist') renderPaginaWishlist();
        if (tabId === 'location') renderPaginaLocation();
        if (tabId === 'doppioni') renderPaginaDoppioni();
        if (tabId === 'sealed') renderPaginaSealed();
        if (tabId === 'set') renderPaginaSet();
        if (tabId === 'bustina') renderPaginaBustina();
    } else {
        switchTab(tabId, null);
    }
    document.body.classList.add('phone-detail-open');

    // FIX (2026-08-30, "non c'è modo di tornare indietro"): #btnFisicoTelefono
    // vive dentro #phoneFrameBox → #phoneShell, e #phoneShell è un
    // CONTESTO DI STACKING a sé (position:fixed + z-index:10). Per una
    // regola del CSS, lo z-index di un discendente non può MAI farlo
    // emergere sopra un fratello di un ANTENATO che ha stacking context
    // proprio — l'intero sotto-albero di #phoneShell (bottone incluso)
    // resta sempre sotto .container (z-index:11), qualunque z-index dia
    // al bottone stesso. L'unico modo reale: spostarlo temporaneamente
    // fuori da quel sotto-albero, direttamente dentro <body>, mentre il
    // dettaglio è aperto — riportato al suo posto in chiudiDettaglioWidget
    // qui sotto, a fine animazione di chiusura.
    const _btnFisico = document.getElementById('btnFisicoTelefono');
    if (_btnFisico && _btnFisico.parentElement !== document.body) {
        document.body.appendChild(_btnFisico);
        _btnFisico.classList.add('a-schermo-intero');
    }

    if (container) {
        _impostaOrigineAnimazione(container, evt);
        container.classList.add('container-visibile'); // display: normale, cerchio a 0% (stato di partenza dichiarato in CSS)
        _posizionaContainerNelloSchermo();
        // Un frame di distacco tra "cerchio a 0%" e "aggiungi la classe che
        // lo porta a 150%": necessario perché il browser faccia partire
        // davvero la transizione invece di saltare subito allo stato finale.
        requestAnimationFrame(() => container.classList.add('container-aperto'));
    }
    _beep(880, 70);
    _aggiornaTastoFisico();

    // Multi-Binder (2026-08-25): il caricamento dati va SEMPRE dopo
    // l'apertura visiva, mai prima — un bug introdotto in un fix precedente
    // metteva questo await PRIMA del blocco container sopra: un qualunque
    // errore in apriWidgetBinders() interrompeva la funzione lì, il
    // container non si apriva mai e da fuori sembrava che il click non
    // facesse nulla (bug segnalato da Claudio). Ora è dopo, e in try/catch:
    // un errore nel caricamento non deve mai impedire l'apertura della
    // sezione, al massimo la mostra vuota.
    if (tabId === 'binder') {
        try {
            await apriWidgetBinders();
        } catch (e) {
            console.error('apriDettaglioWidget: errore caricando i binder:', e);
        }
    }
}

function chiudiDettaglioWidget() {
    const container = document.querySelector('.container');
    if (container) container.classList.remove('container-aperto'); // la transizione CSS dichiarata fa il resto (150%→0%)
    _beep(440, 70);
    document.body.classList.remove('phone-detail-open'); // subito: il bottone deve reagire al tap, non aspettare l'animazione
    _aggiornaTastoFisico();

    clearTimeout(_chiusuraDettaglioTimeout);
    _chiusuraDettaglioTimeout = setTimeout(() => {
        if (container) container.classList.remove('container-visibile'); // SOLO ora, a transizione finita, torna display:none
        // Simmetrico al reparent fatto in apriDettaglioWidget: il bottone
        // torna dentro #phoneFrameBox, ripristinando la posizione
        // percentuale calibrata sull'immagine cornice.
        const btnFisico = document.getElementById('btnFisicoTelefono');
        const frameBox = document.getElementById('phoneFrameBox');
        if (btnFisico && frameBox && btnFisico.parentElement !== frameBox) {
            frameBox.appendChild(btnFisico);
            btnFisico.classList.remove('a-schermo-intero');
        }
        renderWidgetHome();
    }, DURATA_ANIMAZIONE_DETTAGLIO_MS);
}
