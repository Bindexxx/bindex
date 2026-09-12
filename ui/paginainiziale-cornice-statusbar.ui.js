// ═══════════════════════════════════════════════════════════════════════
// PAGINAINIZIALE-CORNICE-STATUSBAR.UI.JS — resize cornice, cornice/sfondo
// personalizzabili, ponte verso CSBar (orologio, sync, beep, notifiche
// push) — CardSync Pro
// ═══════════════════════════════════════════════════════════════════════
// STEP 2 del piano di taglio di ui/paginainiziale.ui.js (concordato con
// Claudio il 2026-09-11). Estratto da ui/paginainiziale.ui.js. NESSUNA
// riscrittura del codice esistente: solo spostamento, zero cambi di
// comportamento per l'utente finale.
//
// Contiene: _gestisciResizeCornice(Debounced), _applicaCorniceUtente,
// _applicaSfondoUtente, _aggiornaOrologioStatusBar, _impostaSyncAttivo,
// _phoneAudioCtx/_beep, toggleSuoniWidgetHome, _controllaNotifichePush,
// _mostraNotificaPush.
//
// NOTA: il vecchio commento "SEZIONE 5" (qui sotto, lasciato invariato)
// descriveva insieme questo blocco E quello di polling/tasto fisico/
// presenza/avvio (ora STEP 5, ui/paginainiziale-polling-avvio.ui.js) —
// erano un'unica sezione nel file originale phone.ui.js. Separati qui in
// due file distinti perché sono due concern diversi (ponte verso la UI
// vs orchestrazione periodica/bootstrap), ma la numerazione "SEZIONE 5"
// del commento storico non è stata rinominata per non alterare testo che
// non genera comportamento — puramente cosmetico, ignorabile.
//
// Dipende da: CSBar (statusbar.js), _layoutWidget/_rettangoloSchermoCornice
// (rimasti altrove), renderWidgetHome. Nessuna istruzione qui gira a tempo
// di caricamento script — l'ordine rispetto agli altri file
// paginainiziale-*.ui.js è indifferente (vedi nota identica nello STEP 1).
// ───────────────────────────────────────────────────────────────────────

// ───────────────────────────────────────────────────────────────────────
// SEZIONE 5 — Resize cornice, cornice/sfondo personalizzabili, barra di
// stato (orologio/sync), beep, notifiche push, polling, navigazione fissa,
// tasto fisico, presenza live, avvio (initPhoneShell) (originariamente
// righe 6459-fine file di phone.ui.js).
// ───────────────────────────────────────────────────────────────────────

function _gestisciResizeCornice() {
    if (document.body.classList.contains('phone-detail-open')) {
        requestAnimationFrame(_posizionaContainerNelloSchermo);
    } else if (_layoutWidget) {
        // FIX (Claudio, 2026-09-10): senza questo ramo, un layout gia'
        // disegnato con una griglia larga (tante colonne) restava con
        // quelle classi CSS anche dopo una rotazione o un resize della
        // finestra che riduce le colonne reali — il clamp di
        // _tagliaEffettiva si applica solo DURANTE un render, quindi va
        // fatto scattare di nuovo quando cambia la geometria.
        // COSTO DA TENERE D'OCCHIO: renderWidgetHome() rifa' anche le
        // preview di ogni widget (query/RPC), quindi ogni resize/
        // rotazione ripete quelle chiamate (debounced a 100ms sopra, non
        // ad ogni frame). Se in pratica risultasse troppo traffico
        // durante un resize prolungato del browser desktop, va sostituito
        // con un ricalcolo "leggero" che tocca solo le classi CSS delle
        // tessere gia' in DOM senza rifare le query — non implementato
        // ora per tenere il cambiamento contenuto.
        renderWidgetHome();
    }
}
function _gestisciResizeCorniceDebounced() {
    clearTimeout(_resizeCorniceTimeout);
    _resizeCorniceTimeout = setTimeout(_gestisciResizeCornice, 100);
}

// ── CORNICE PERSONALIZZABILE (placeholder oggi, bucket Supabase domani) ──
function _applicaCorniceUtente(urlVerticale, urlOrizzontale) {
    if (urlVerticale) document.getElementById('phoneFrameV').style.backgroundImage = `url('${urlVerticale}')`;
    if (urlOrizzontale) document.getElementById('phoneFrameO').style.backgroundImage = `url('${urlOrizzontale}')`;
}

// ── SFONDO (WALLPAPER) PERSONALIZZABILE — stesso pattern della cornice ──
// Oggi solo il placeholder (gradiente tenue via CSS, vedi #phoneWidgetHomeWrap
// in index.html). Punto di innesto per quando esisterà la scelta da bucket.
function _applicaSfondoUtente(url) {
    const wrap = document.getElementById('phoneWidgetHomeWrap');
    if (wrap && url) wrap.style.backgroundImage = `url('${url}')`;
}

// ── BARRA DI STATO (orario + indicatore di sync) ─────────────────────────
function _aggiornaOrologioStatusBar() {
    const el = document.getElementById('phoneStatusOra');
    if (el) el.textContent = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

// Pulsa mentre è in corso una VERA chiamata a Supabase (non ad ogni
// ricalcolo locale gratuito da carteReali) — usata attorno al polling
// "lento" e a caricaAvvisiHome.
// AGGIORNATA (2026-09-01, integrazione status bar): il vecchio puntino
// #phoneSyncDot è nascosto via CSS (vedi statusbar.css, blocco di
// integrazione) — questa funzione ora pilota lo stato "connessione" della
// nuova barra invece del puntino. Firma invariata, tutti i punti di
// chiamata esistenti nel file continuano a funzionare senza modifiche.
// Non è un mapping perfetto (CSBar distingue online/connecting/offline,
// qui abbiamo solo "sta sincronizzando ora / non sta sincronizzando"), ma
// è la stessa semplificazione già implicita nel vecchio puntino
// acceso/spento — nessuna informazione persa.
function _impostaSyncAttivo(attivo) {
    const dot = document.getElementById('phoneSyncDot'); // lasciato per rollback, nascosto via CSS
    if (dot) dot.classList.toggle('attivo', attivo);
    if (typeof CSBar !== 'undefined' && CSBar.getConnection) {
        CSBar.setConnection(attivo ? 'connecting' : 'online');
    }
}

// ── SUONI RETRO (Web Audio, nessun file esterno) ─────────────────────────
let _phoneAudioCtx = null;
function _beep(frequenza, durataMs) {
    if (!prefSuoniWidgetGet()) return;
    try {
        _phoneAudioCtx = _phoneAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
        const osc = _phoneAudioCtx.createOscillator();
        const gain = _phoneAudioCtx.createGain();
        osc.type = 'square';
        osc.frequency.value = frequenza;
        gain.gain.value = 0.025; // molto discreto, non invadente
        osc.connect(gain);
        gain.connect(_phoneAudioCtx.destination);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.0001, _phoneAudioCtx.currentTime + durataMs / 1000);
        osc.stop(_phoneAudioCtx.currentTime + durataMs / 1000 + 0.02);
    } catch (_) { /* Web Audio non disponibile o bloccato: niente suono, nessun errore visibile */ }
}

function toggleSuoniWidgetHome() {
    const nuovoStato = !prefSuoniWidgetGet();
    prefSuoniWidgetSet(nuovoStato);
    const icona = document.getElementById('iconaSuoniWidgetHome');
    if (icona) icona.className = nuovoStato ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';
    if (nuovoStato) _beep(660, 60);
}

// ── NOTIFICHE PUSH (diff sui dati già scaricati, nessuna query nuova) ────
// Confronta i contatori di rischio col giro di polling precedente — se
// sono aumentati, mostra un banner + bagliore + vibrazione + suono.
// Nessun nuovo endpoint: riusa dati già ottenuti dal polling "lento".
let _contatoriNotifichePrecedenti = null;

async function _controllaNotifichePush() {
    const codaErrori = await _contaCodaErrori();
    const prezziScaduti = (typeof _elencoPrezziScaduti !== 'undefined' && _elencoPrezziScaduti) ? _elencoPrezziScaduti.length : 0;
    const attuali = { codaErrori, prezziScaduti };

    if (_contatoriNotifichePrecedenti) {
        if (attuali.codaErrori > _contatoriNotifichePrecedenti.codaErrori) {
            _mostraNotificaPush('Nuova carta da correggere in Inserimento');
        } else if (attuali.prezziScaduti > _contatoriNotifichePrecedenti.prezziScaduti) {
            _mostraNotificaPush('Nuovi prezzi da aggiornare');
        }
    }
    _contatoriNotifichePrecedenti = attuali;
}

function _mostraNotificaPush(testo) {
    const banner = document.getElementById('phonePushBanner');
    const testoEl = document.getElementById('phonePushBannerTesto');
    const schermo = document.getElementById('phoneScreen');
    if (!banner || !testoEl) return;
    testoEl.textContent = testo;
    banner.classList.add('mostrata');
    if (schermo) schermo.classList.add('glow-notifica');
    _vibraSeSupportato(15);
    _beep(660, 90);
    setTimeout(() => {
        banner.classList.remove('mostrata');
        if (schermo) schermo.classList.remove('glow-notifica');
    }, 4000);
}

