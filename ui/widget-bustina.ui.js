// ═══════════════════════════════════════════════════════════════════════
// WIDGET-BUSTINA.UI.JS — apertura pacchetti "Bustina" (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP 4 della ristrutturazione file widget home (vedi
// Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md). Estratto da
// ui/phone.ui.js il 2026-09-11. NESSUNA riscrittura: solo spostamento di
// codice, zero cambi di comportamento per l'utente finale.
//
// CATEGORIA A, ma STRUTTURALMENTE DIVERSA dalle altre pagine categoria A
// (segnalato già nella roadmap, §7 punto 3): non riempie una
// <div class="view-section"> statica come le altre — costruisce un
// OVERLAY DINAMICO (_bustinaCostruisciOverlay, una sola volta, poi
// riusato) sopra #bustinaCutsceneOverlay (dichiarato in index.html, fuori
// da #phoneShell per lo stesso motivo di #btnFisicoTelefono — vedi
// commento lì). Contiene: loader/pokeball, motore cutscene (JSON
// giorno/mese), taglio busta laser su canvas, swipe-to-reveal delle
// carte, schermata di riepilogo.
//
// Contiene anche CATALOGO_WIDGET.bustina (anteprima tessera).
//
// COSA RESTA FUORI (non spostato qui, invariato):
// - apriDettaglioWidget (ui/paginainiziale.ui.js) continua a chiamare
//   renderPaginaBustina() per tabId === 'bustina', esattamente come prima
//   — motore home, dispatch generico, non toccato in questo step.
// - _ballCORPI.bustina, _ballASPETTO.bustina, _ballTITOLI_BREVI.bustina
//   (ui/widget-render-condiviso.ui.js) — motore visivo, non toccato.
// - Il markup HTML di #bustinaCutsceneOverlay in index.html — non
//   toccato, solo il commento che lo descrive è stato aggiornato per
//   puntare qui invece che a phone.ui.js.
//
// Area di lavoro attiva in sessioni recenti (integrazione bustina vera e
// propria: RPC apri_bustina(), bucket Storage cutscene/sprite) — vedi
// compilati precedenti. Questo step sposta SOLO il file, non tocca quella
// integrazione.
// ───────────────────────────────────────────────────────────────────────

// ── VOCE DI CATALOGO ──────────────────────────────────────────────────
    // SBLOCCATO (2026-09-07): schema/RPC lato DB già in produzione,
    // verificati dal vivo (Roadmap_Widget_Bustina_2026-09-07.md + compilato
    // di sessione). Nessun 'tab' esplicito: la chiave del catalogo
    // ('bustina') coincide già con l'id della view-section e con la
    // condizione in apriDettaglioWidget — stesso trucco già usato da
    // 'missioni', vedi commento lì.
CATALOGO_WIDGET.bustina = {
        titolo: 'Bustina', icona: 'fa-gift',
        preview: async () => {
            try {
                const userId = await authGetUserId();
                if (!userId) return { righe: ['Accedi per aprire le bustine'], dati: { placeholder: true } };
                const { data, error } = await bustinaStatoLeggi();
                if (error) throw error;
                if (data.giornaliera_disponibile) {
                    return { righe: ['Bustina pronta!'], stato: 'ok', dati: data };
                }
                if (data.saldo_guadagnate > 0) {
                    return { righe: [`${data.saldo_guadagnate} bustin${data.saldo_guadagnate === 1 ? 'a' : 'e'} da aprire`], stato: 'ok', dati: data };
                }
                return { righe: ['Torna domani'], dati: data };
            } catch (e) {
                console.error('[bustina widget] preview:', e);
                return { righe: ['Bustina'], dati: { placeholder: true } };
            }
        },
};

// ── PAGINA / OVERLAY BUSTINA ─────────────────────────────────────────
// RISTRUTTURATO 2026-09-10 (Claudio: "quella schermata nera non la voglio
// vedere MAI, in nessun momento — click sul widget e basta, direttamente
// alla pagina giusta"). Il tentativo precedente apriva l'overlay SUBITO
// con una pokéball "di caricamento": quella pokéball non si vedeva (causa
// non ancora trovata: niente errori JS con la console filtrata su
// "bustina", l'overlay ha dimensioni reali — il problema era probabilmente
// solo nella schermata di caricamento stessa) — ma indipendentemente dalla
// causa, Claudio non vuole PROPRIO quello step, nemmeno se lo sistemassi.
// Nuovo flusso: nessun overlay costruito né aperto finché i dati veri
// (login + bustine_stato()) non sono pronti. Il click sul widget avvia
// comunque SUBITO l'animazione del container (gestita da
// apriDettaglioWidget, non toccata qui) — è quel tempo morto (Claudio:
// "poco più di un secondo") a coprire la rete, non uno schermo dedicato.
// Se la rete fosse più lenta dell'animazione, per un istante si vede
// semplicemente lo sfondo neutro del sito (mai nero apposta) prima che
// l'overlay appaia già con la schermata corretta — un solo salto, non due.
async function renderPaginaBustina() {
    const container = document.getElementById('bustinaContenuto');
    if (container) container.innerHTML = '';

    const userId = await authGetUserId();
    if (!userId) {
        if (container) container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Accedi per aprire le bustine.</p>';
        return;
    }

    try {
        const { data, error } = await bustinaStatoLeggi();
        if (error) throw error;
        _bustinaCostruisciOverlay();
        _bustinaCountdownFerma();
        _bustinaRisultatoCorrente = null;
        const overlay = document.getElementById('bustinaCutsceneOverlay');
        overlay.classList.add('aperto');
        _bustinaRicalcolaScale();
        _bustinaMostraStatoOverlay(data); // decide countdown vs pokéball pronta, MAI uno stato intermedio
    } catch (e) {
        console.error('renderPaginaBustina:', e);
        if (container) container.innerHTML = '<p style="text-align:center; color:var(--danger); font-size:0.85rem; padding:1rem 0;">Errore nel caricamento dello stato.</p>';
    }
}

// Aggiorna l'overlay GIÀ APERTO con lo stato reale (countdown o pokéball
// pronta) — MAI dedotto/tenuto in cache da prima: l'utente può aver
// aperto bustine da un altro dispositivo. Riusata anche dal countdown
// quando scatta il rinnovo (_bustinaCountdownTick), invece di duplicare
// la logica in due punti.
function _bustinaMostraStatoOverlay(stato) {
    _bustinaCountdownFerma(); // eventuale countdown di una lettura precedente

    const puoAprire = stato.giornaliera_disponibile || stato.saldo_guadagnate > 0;
    if (puoAprire) {
        _bustinaMostraSchermata('bustinaLoaderScreen');
        const wrapEl = document.getElementById('bustinaPokeballWrap');
        wrapEl.classList.remove('scuote');
        wrapEl.classList.add('pronto');
        _bustinaOverlayPronto = true;
        document.getElementById('bustinaPreloadText').innerText = '';
        _bustinaFrase().then(f => {
            // Solo se l'utente non ha già tappato la pokéball nel
            // frattempo (in tal caso il testo appartiene già alla fase di
            // caricamento vera, non va sovrascritto).
            if (_bustinaOverlayPronto) document.getElementById('bustinaPreloadText').innerText = f;
        });
    } else {
        _bustinaMostraSchermata('bustinaCountdownScreen');
        _bustinaOverlayPronto = false;
        document.getElementById('bustinaCdTotali').innerText = stato.aperte_totali;
        document.getElementById('bustinaCdGiorn').innerText = stato.aperte_giornaliere;
        document.getElementById('bustinaCdGuad').innerText = stato.aperte_guadagnate;
        document.getElementById('bustinaCdSaldo').innerText = stato.saldo_guadagnate;
        document.getElementById('bustinaCountdownFrase').innerText = '';
        _bustinaFraseCountdown().then(f => { document.getElementById('bustinaCountdownFrase').innerText = f; });
        _bustinaCountdownAvvia();
    }
}

// ═══════════════════════════════════════════════════════════════════════
// ESPERIENZA APERTURA BUSTINA — cutscene + taglio busta laser + swipe
// (2026-09-09). Porta FEDELE del prototipo sbusto-main.zip (decisione
// esplicita di Claudio: "tieni tutto ciò che c'è nel prototipo, è una
// bozza fedele e precisa"), con questi adattamenti obbligati:
//   - sorteggio carte NON portato: già lato server da settimane (RPC
//     apri_bustina) — qui si usa SEMPRE risultato.carte, mai Math.random()
//   - RPC prima di tutto (vedi nota sopra in _bustinaPaginaApri)
//   - CSS/markup scopati sotto #bustinaCutsceneOverlay (mai selettori
//     nudi, vedi Roadmap_Widget_Bustina_2026-09-07.md)
//   - tutte le funzioni/variabili con prefisso _bustina* per non collidere
//     con altri script a livello di file (script classici, no moduli)
//   - i 6 listener globali del prototipo (mousedown/move/up, touchstart/
//     move/end) sono scopati sull'elemento overlay stesso (mai document):
//     equivalente perché l'overlay è fixed+inset:0+z-index altissimo,
//     copre l'intero schermo quando aperto, nulla fuori da esso è
//     raggiungibile comunque
//   - suoni condizionati a prefSuoniWidgetGet() (il toggle globale
//     dell'home, non esisteva nel prototipo — richiesto dalla roadmap)
//   - riepilogo finale SENZA colonna "Qtà totale posseduta": richiederebbe
//     l'album (bustinaAlbumQuery), esplicitamente rimandato da Claudio e
//     da non toccare finché non lo richiede lui — mostra solo Nome/
//     Rarità/Esito, non un conteggio
//   - nessuna scrittura DB dal client: la RPC ha già salvato tutto PRIMA
//     che l'overlay si aprisse — qui si legge/mostra soltanto
//   - "personaggioprincipale" (hero) sempre come scritto nel json
//     dall'admin (asset 'fallback'): la sostituzione con la skin scelta
//     dall'utente è rimandata (profiles.skin_personaggio non esiste
//     ancora, decisione di Claudio 2026-09-09)
// ═══════════════════════════════════════════════════════════════════════

// ── stato del motore (a livello di file, prefissato) ────────────────────
let _bustinaAudioCtx = null;
let _bustinaOverlayCostruito = false;
let _bustinaOverlayPronto = false;      // true quando loader+cutscene sono pronti (pokeball cliccabile)
let _bustinaRisultatoCorrente = null;   // risultato RPC tenuto in memoria per tutta l'esperienza
let _bustinaCutsceneData = null;
let _bustinaCutsceneTimer = null;
let _bustinaCutsceneTime = 0;
let _bustinaDialogoAttivo = false;
let _bustinaEventiScattati = new Set();
let _bustinaLaserDisegno = false;
let _bustinaLaserPunti = [];
let _bustinaBustaTagliata = false;
let _bustinaDragCarta = null;
let _bustinaDragStartY = 0;
let _bustinaCarteSwipate = 0;
let _bustinaLaserStartPoint = { x: 0, y: 0 };
let _bustinaNomeUtenteCorrente = 'Allenatore'; // sovrascritto in _bustinaClickPokeball, vedi sotto
const RARITA_CSS_BUSTINA = { 'comuni': 'comune', 'non comuni': 'non-comune', 'rare': 'rara', 'ultra rare': 'ultra-rara', 'leggendarie': 'leggendaria' };
// Fattore di scala UNICO applicato a #bustinaScreenWrapper intero (non più
// solo a #bustinaCutsceneViewport) — vedi _bustinaRicalcolaScale. Serve
// anche a laser/drag per tradurre le coordinate "sullo schermo reale" in
// coordinate del canvas 480×270 non scalato (vedi _bustinaLaserStart/Move).
let _bustinaScale = 1;
// Countdown "nessuna bustina disponibile" — timer separato da quello della
// cutscene, ripulito da _bustinaCountdownFerma() ad ogni apertura/chiusura
// dell'overlay per non lasciarne mai due attivi insieme.
let _bustinaCountdownTimer = null;

// ── audio (porta fedele: file veri per laser/swipe, sintesi Web Audio
//    come fallback — IDENTICI al prototipo, solo col toggle in testa) ───
function _bustinaInitAudio() {
    if (!_bustinaAudioCtx) _bustinaAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_bustinaAudioCtx.state === 'suspended') _bustinaAudioCtx.resume();
}

function _bustinaSuono(tipo) {
    if (!prefSuoniWidgetGet()) return; // toggle globale suoni home — non esisteva nel prototipo, richiesto dalla roadmap
    _bustinaInitAudio();

    if (tipo === 'laser' || tipo === 'swipe') {
        const nomeFile = tipo === 'laser' ? 'strappare.mp3' : 'swush.mp3';
        const { data } = bustinaSfxUrl(nomeFile);
        const url = data?.publicUrl;
        if (url) {
            const audio = new Audio(url);
            audio.crossOrigin = 'anonymous';
            try {
                const source = _bustinaAudioCtx.createMediaElementSource(audio);
                const gainNode = _bustinaAudioCtx.createGain();
                gainNode.gain.value = 2.5;
                source.connect(gainNode);
                gainNode.connect(_bustinaAudioCtx.destination);
                audio.play().catch(() => { _bustinaSuonoFallback(tipo); });
                return;
            } catch (e) {
                audio.volume = 1.0;
                audio.play().catch(() => { _bustinaSuonoFallback(tipo); });
                return;
            }
        }
    }
    _bustinaSuonoFallback(tipo);
}

function _bustinaSuonoFallback(tipo) {
    try {
        const now = _bustinaAudioCtx.currentTime;
        const masterGain = _bustinaAudioCtx.createGain();
        masterGain.gain.setValueAtTime(1.5, now);
        masterGain.connect(_bustinaAudioCtx.destination);

        if (tipo === 'laser') {
            const bufferSize = _bustinaAudioCtx.sampleRate * 0.3;
            const buffer = _bustinaAudioCtx.createBuffer(1, bufferSize, _bustinaAudioCtx.sampleRate);
            const dati = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) dati[i] = Math.random() * 2 - 1;
            const noise = _bustinaAudioCtx.createBufferSource();
            noise.buffer = buffer;
            const filtro = _bustinaAudioCtx.createBiquadFilter();
            filtro.type = 'bandpass';
            filtro.frequency.setValueAtTime(1000, now);
            filtro.frequency.exponentialRampToValueAtTime(300, now + 0.3);
            const gain = _bustinaAudioCtx.createGain();
            gain.gain.setValueAtTime(0.8, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            noise.connect(filtro); filtro.connect(gain); gain.connect(masterGain);
            noise.start(now);
        } else if (tipo === 'swipe') {
            const osc = _bustinaAudioCtx.createOscillator();
            const gain = _bustinaAudioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(120, now + 0.2);
            gain.gain.setValueAtTime(0.7, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.connect(gain); gain.connect(masterGain);
            osc.start(now); osc.stop(now + 0.2);
        } else if (tipo === 'gb_boot') {
            const osc = _bustinaAudioCtx.createOscillator();
            const gain = _bustinaAudioCtx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(587.33, now);
            osc.frequency.setValueAtTime(880.00, now + 0.08);
            gain.gain.setValueAtTime(0.6, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
            osc.connect(gain); gain.connect(masterGain);
            osc.start(now); osc.stop(now + 0.6);
        }
    } catch (e) { /* niente suono, nessun errore visibile — stesso comportamento del prototipo */ }
}

// ── frase di caricamento (stessa logica: seed sulla data, stesso array
//    di fallback del prototipo, invariato su richiesta di Claudio) ──────
async function _bustinaFrase() {
    const fallback = [
        'Catturando Snorlax...', 'Cercando il Pokéflauto...', 'Gettando via la Pietrastante...',
        'Consultando il Pokédex...', 'Svegliando uno Snorlax assonnato...', 'Lucidando le Medaglie...',
        'Ricaricando il Repellente...'
    ];
    try {
        const { data } = bustinaQuotesUrl();
        const res = await fetch(`${data.publicUrl}?t=${Date.now()}`);
        if (res.ok) {
            const frasi = await res.json();
            if (Array.isArray(frasi) && frasi.length > 0) {
                const oggi = new Date().toISOString().slice(0, 10);
                let seed = 0;
                for (let i = 0; i < oggi.length; i++) seed = (seed * 31 + oggi.charCodeAt(i)) % 10000000;
                return frasi[seed % frasi.length];
            }
        }
    } catch (e) { /* fallback sotto */ }
    return fallback[Math.floor(Math.random() * fallback.length)];
}

// Seed numerico sulla data odierna (stesso algoritmo di _bustinaFrase,
// estratto qui per non duplicarlo nella variante countdown sotto).
function _bustinaSeedOggi() {
    const oggi = new Date().toISOString().slice(0, 10);
    let seed = 0;
    for (let i = 0; i < oggi.length; i++) seed = (seed * 31 + oggi.charCodeAt(i)) % 10000000;
    return seed;
}

// ── frase per la schermata "nessuna bustina disponibile" (2026-09-10) ──
// Stessa logica di stabilità di _bustinaFrase (seed sulla data → stessa
// frase per tutto il giorno, decisione di Claudio "fisse come
// bustinaFrase"), ma file/array separati: sono frasi di ATTESA, non di
// caricamento. NIENTE segnaposto tipo [tempo] nel json — il countdown vero
// (HH:MM:SS) è un elemento a parte già in pagina, la frase è solo
// atmosfera (decisione esplicita di Claudio, 2026-09-10).
async function _bustinaFraseCountdown() {
    const fallback = [
        'Snorlax sta ancora dormendo di traverso sul sentiero.',
        'Il Professor Oak è uscito a catturare qualche Pikachu.',
        'Le Pokéball sono in carica al Centro Pokémon.',
        'La Joy locale sta ancora controllando lo scorsoio.',
        'Team Rocket ha smarrito di nuovo la chiave del magazzino.',
        'Bill sta sistemando il suo PC di archiviazione.',
        'Un Voltorb dorme sopra il distributore di bustine.',
    ];
    try {
        const { data } = bustinaCountdownQuotesUrl();
        const res = await fetch(`${data.publicUrl}?t=${Date.now()}`);
        if (res.ok) {
            const frasi = await res.json();
            if (Array.isArray(frasi) && frasi.length > 0) return frasi[_bustinaSeedOggi() % frasi.length];
        }
    } catch (e) { /* fallback sotto */ }
    return fallback[_bustinaSeedOggi() % fallback.length];
}

// ── countdown dal vivo fino al prossimo rinnovo (mezzanotte Europe/Rome,
//    confermato dal corpo reale di bustine_stato() in produzione — la
//    funzione ragiona in quel fuso, non in UTC, non in quello del
//    browser). Un tick al secondo, robusto ai cambi ora legale perché
//    ricalcola la lettura wall-clock ad ogni tick invece di sommare
//    millisecondi a un timestamp fisso. ─────────────────────────────────
function _bustinaMsAlRinnovo() {
    const ora = new Date();
    const parti = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).formatToParts(ora).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
    const secondiOggi = (parseInt(parti.hour, 10) % 24) * 3600 + parseInt(parti.minute, 10) * 60 + parseInt(parti.second, 10);
    return (86400 - secondiOggi) * 1000 - ora.getMilliseconds();
}

function _bustinaFormattaCountdown(ms) {
    const totSec = Math.max(0, Math.floor(ms / 1000));
    const h = String(Math.floor(totSec / 3600)).padStart(2, '0');
    const m = String(Math.floor((totSec % 3600) / 60)).padStart(2, '0');
    const s = String(totSec % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
}

function _bustinaCountdownTick() {
    const el = document.getElementById('bustinaCountdownTimer');
    if (!el) return;
    const ms = _bustinaMsAlRinnovo();
    el.innerText = _bustinaFormattaCountdown(ms);
    // Rinnovo scattato mentre l'utente guarda la schermata: non
    // indoviniamo un nuovo stato, si rilegge bustine_stato() per davvero
    // (il countdown potrebbe anche azzerarsi qualche secondo prima/dopo
    // per via di piccoli scarti di clock lato client, meglio verificare).
    if (ms <= 500) {
        _bustinaCountdownFerma();
        bustinaStatoLeggi().then(({ data, error }) => { if (!error) _bustinaMostraStatoOverlay(data); });
    }
}

function _bustinaCountdownAvvia() {
    _bustinaCountdownFerma();
    _bustinaCountdownTick();
    _bustinaCountdownTimer = setInterval(_bustinaCountdownTick, 1000);
}

function _bustinaCountdownFerma() {
    if (_bustinaCountdownTimer) { clearInterval(_bustinaCountdownTimer); _bustinaCountdownTimer = null; }
}

// ── costruzione overlay (idempotente: markup creato una sola volta,
//    listener scopati attaccati una sola volta) ─────────────────────────
function _bustinaCostruisciOverlay() {
    if (_bustinaOverlayCostruito) return;
    const root = document.getElementById('bustinaCutsceneOverlay');
    if (!root) return;

    root.innerHTML = `
        <div id="bustinaGbFrame">
            <div id="bustinaCloseBtn" onclick="_bustinaChiudiOverlay()"><i class="fa-solid fa-xmark"></i></div>
            <div id="bustinaScreenWrapper">

                <!-- Bustina/e disponibili: pokéball pronta al tap. Niente
                     RPC ancora — parte solo al click (vedi
                     _bustinaClickPokeball più sotto: ordine deciso da
                     Claudio 2026-09-10, opzione B). _bustinaMostraStatoOverlay
                     la mostra già in stato 'pronto' quando c'è qualcosa da
                     aprire; la classe 'scuote' torna utile solo DOPO il
                     tap, mentre RPC+cutscene caricano davvero. -->
                <div id="bustinaLoaderScreen" class="bs-screen attiva">
                    <div class="bs-pokeball-wrap scuote" id="bustinaPokeballWrap">
                        <div class="bs-pokeball" id="bustinaPokeball">
                            <div class="bs-pokeball-centro"><div class="bs-pokeball-centro-inner"></div></div>
                        </div>
                        <div id="bustinaPreloadText"></div>
                    </div>
                </div>

                <!-- Nessuna bustina disponibile: countdown al prossimo
                     rinnovo (mezzanotte Europe/Rome — confermato dal corpo
                     REALE di bustine_stato() in produzione, 2026-09-10:
                     v_oggi := (now() AT TIME ZONE 'Europe/Rome')::date,
                     non UTC) + le 4 statistiche che prima stavano nella
                     vecchia pagina pg-* (ora rimossa). -->
                <div id="bustinaCountdownScreen" class="bs-screen">
                    <div class="bs-countdown-icona"><i class="fa-solid fa-clock"></i></div>
                    <div class="bs-countdown-frase" id="bustinaCountdownFrase"></div>
                    <div class="bs-countdown-timer" id="bustinaCountdownTimer">--:--:--</div>
                    <div class="bs-countdown-sotto">alla prossima bustina giornaliera</div>
                    <div class="bs-countdown-stats">
                        <div><b id="bustinaCdTotali">0</b><span>Totali</span></div>
                        <div><b id="bustinaCdGiorn">0</b><span>Giorn.</span></div>
                        <div><b id="bustinaCdGuad">0</b><span>Guad.</span></div>
                        <div><b id="bustinaCdSaldo">0</b><span>Saldo</span></div>
                    </div>
                </div>

                <div id="bustinaCutsceneScreen" class="bs-screen">
                    <div id="bustinaCutsceneViewport">
                        <div id="bustinaCutsceneBg" style="position:absolute; width:480px; height:270px; background-size:cover; background-position:center; z-index:1;"></div>
                        <div id="bustinaSpritesLayer" style="position:absolute; width:480px; height:270px; z-index:2; pointer-events:none;"></div>
                        <div class="bs-stat-box">
                            <div>GIORNO: <span id="bustinaValGiorno">1</span>/30 | MESI: <span id="bustinaValMesi">0</span></div>
                            <div>POLVERE: <span id="bustinaValPolvere">0</span></div>
                        </div>
                        <div class="bs-dialogue-box" id="bustinaDialogueBox">
                            <div class="bs-speaker-name" id="bustinaSpeakerName"></div>
                            <div class="bs-dialogue-text" id="bustinaDialogueText"></div>
                            <div class="bs-dialogue-hint">[TOCCA PER AVANZARE]</div>
                        </div>
                    </div>
                    <audio id="bustinaGbMusic" loop></audio>
                </div>

                <div id="bustinaPackScreen" class="bs-screen">
                    <div class="bs-sparkles" id="bustinaSparkles"></div>
                    <div id="bustinaBoosterContainer">
                        <div style="font-size:0.4rem; margin-bottom:8px; color:#ffd700;">TRACCIA IL FULMINE SULLA BUSTA (90%)!</div>
                        <div style="position:relative;">
                            <canvas id="bustinaLaserCanvas"></canvas>
                            <div class="bs-booster-pack" id="bustinaBoosterPack">
                                <div class="bs-booster-shine"></div>
                                <div class="bs-booster-top">CARDSYNC</div>
                                <div class="bs-booster-bottom">
                                    <img src="favicon.ico" class="bs-booster-logo" alt="Logo">
                                </div>
                            </div>
                        </div>
                    </div>
                    <div id="bustinaCardsArea" style="display:none; flex-direction:column; align-items:center; width:100%; z-index:4;">
                        <div style="font-size:0.4rem; margin-bottom:4px; color:#ffd700;">SOLLEVA VERSO L'ALTO (SWIPE UP)</div>
                        <div class="bs-card-container" id="bustinaCardsStack"></div>
                    </div>
                    <div id="bustinaSummaryScreen" style="display:none;">
                        <div class="bs-summary-titolo">HAI APERTO LA BUSTINA</div>
                        <table class="bs-summary-table">
                            <thead><tr><th>Nome</th><th>Rarità</th><th>Esito</th></tr></thead>
                            <tbody id="bustinaSummaryBody"></tbody>
                        </table>
                        <button onclick="_bustinaChiudiOverlay()" style="width:100%;">CONTINUA</button>
                    </div>
                </div>

            </div>
        </div>
    `;

    // Listener scopati SULL'OVERLAY (mai su document — vedi nota di testa):
    // equivalenti ai 6 globali del prototipo perché l'overlay copre tutto
    // lo schermo quando aperto (fixed, inset:0, z-index altissimo).
    root.addEventListener('mousedown', _bustinaLaserStart);
    root.addEventListener('mousemove', _bustinaLaserMove);
    root.addEventListener('mouseup', _bustinaLaserEnd);
    root.addEventListener('touchstart', _bustinaLaserStart, { passive: false });
    root.addEventListener('touchmove', _bustinaLaserMove, { passive: false });
    root.addEventListener('touchend', _bustinaLaserEnd);

    document.getElementById('bustinaPokeballWrap').addEventListener('click', _bustinaClickPokeball);
    document.getElementById('bustinaCutsceneScreen').addEventListener('click', _bustinaClickCutscene);
    window.addEventListener('resize', _bustinaRicalcolaScale);
    window.addEventListener('orientationchange', _bustinaRicalcolaScale);

    _bustinaOverlayCostruito = true;
}

function _bustinaMostraSchermata(id) {
    document.querySelectorAll('#bustinaCutsceneOverlay .bs-screen').forEach(s => s.classList.remove('attiva'));
    const target = document.getElementById(id);
    if (target) target.classList.add('attiva');
}

// Un solo fattore di scala per TUTTA l'esperienza (countdown, pokéball,
// cutscene, laser, swipe, riepilogo): #bustinaScreenWrapper è un canvas
// fisso 480×270 (vedi index.html), qui lo si riduce/ingrandisce in blocco
// per riempire lo spazio disponibile dentro #bustinaGbFrame.
// RIVISTO 2026-09-10 (Claudio: "cornice pokedex" — tutto ciò che il sito
// mostra deve starci dentro, non a tutta la finestra del browser):
// l'overlay stesso viene ora agganciato al rettangolo REALE di
// #phoneScreen tramite _rettangoloSchermoCornice() (stessa funzione usata
// da _posizionaContainerNelloSchermo per .container, unica fonte di
// verità) invece di riempire l'intero viewport con "inset:0". Resta
// position:fixed (non absolute) apposta: .container ha un padding
// (calc(2.6rem + safe-area) 1rem 1rem) che sposterebbe verso l'interno
// un discendente position:absolute — da fixed l'overlay è un fratello di
// .container nello stesso contesto di stacking di radice, ignora quel
// padding e combacia esattamente col rettangolo schermo, bordo a bordo.
// _bustinaScale resta calcolato sullo spazio DISPONIBILE dentro quel
// rettangolo (non più tutta la finestra) — richiesta esplicita e non
// negoziabile di Claudio: la pagina resta "calcolata" a 480×270 e viene
// solo zoomata, mai ricalcolata per la dimensione reale. _bustinaScale è
// riusato anche da laser/drag per tradurre le coordinate del tocco in
// coordinate del canvas 480×270 non scalato — vedi _bustinaLaserStart/Move.
function _bustinaRicalcolaScale() {
    const overlay = document.getElementById('bustinaCutsceneOverlay');
    if (!overlay || !overlay.classList.contains('aperto')) return;

    const r = _rettangoloSchermoCornice();
    if (r) {
        overlay.style.top = r.top + 'px';
        overlay.style.left = r.left + 'px';
        overlay.style.width = r.width + 'px';
        overlay.style.height = r.height + 'px';
        overlay.style.borderRadius = r.borderRadius;
    }

    const frame = document.getElementById('bustinaGbFrame');
    const wrapper = document.getElementById('bustinaScreenWrapper');
    if (!frame || !wrapper) return;
    _bustinaScale = Math.max(0.01, Math.min(frame.clientWidth / 480, frame.clientHeight / 270));
    wrapper.style.transform = `scale(${_bustinaScale})`;
}

// ── tap sulla pokéball: la RPC parte SOLO ORA ───────────────────────────
// Ordine deciso da Claudio 2026-09-10 (opzione B — cambia la decisione
// del 09/09 che faceva partire apri_bustina() subito al tap sul widget):
// finché la pokéball non viene toccata, NESSUNA bustina è consumata. Da
// qui in poi il comportamento è identico a prima: RPC → cutscene/mese →
// nome utente, tutto in parallelo con un tempo minimo di "carica", poi
// l'animazione di apertura della pokéball e la cutscene vera.
async function _bustinaClickPokeball() {
    if (!_bustinaOverlayPronto) return;
    _bustinaOverlayPronto = false;
    _bustinaSuono('laser');

    const wrapEl = document.getElementById('bustinaPokeballWrap');
    const textEl = document.getElementById('bustinaPreloadText');
    wrapEl.classList.remove('pronto');
    wrapEl.classList.add('scuote');
    textEl.innerText = await _bustinaFrase();

    const timerMinimo = new Promise(resolve => setTimeout(resolve, 1500));

    // RPC vera — la bustina è consumata da qui in poi. Se fallisce (es.
    // rinnovo appena scattato/consumata da un altro dispositivo nel
    // frattempo) si mostra il messaggio della RPC as-is e si torna alla
    // schermata corretta rileggendo lo stato reale, MAI si prosegue con
    // dati inventati.
    let risultato = null;
    let erroreApertura = null;
    const apertura = (async () => {
        try {
            const { data, error } = await bustinaApri();
            if (error) throw error;
            risultato = data;
        } catch (e) {
            erroreApertura = e;
        }
    })();

    // Nome utente reale (stessa fonte di #profiloMenuNome): sessione →
    // email → _nomeDaEmail() (ui/auth.ui.js). Se per qualunque motivo la
    // sessione non risponde, resta il fallback 'Allenatore' già impostato.
    const nomeUtente = (async () => {
        try {
            const sessione = await authGetSession();
            if (sessione?.user?.email) _bustinaNomeUtenteCorrente = _nomeDaEmail(sessione.user.email);
        } catch (e) { /* resta 'Allenatore' */ }
    })();

    // Attende PRIMA il risultato della RPC (il calcolo del mese dipende
    // da risultato.mesi_completati: non si può partire prima).
    await apertura;

    if (erroreApertura) {
        await timerMinimo;
        wrapEl.classList.remove('scuote');
        // .innerText, non .innerHTML: nessun escaping manuale necessario.
        textEl.innerText = erroreApertura.message || 'Errore durante l\'apertura.';
        // Ririlegge lo stato vero (niente saldo "inventato") e ridisegna
        // la schermata giusta dopo una breve pausa, per lasciare leggere
        // il messaggio.
        setTimeout(async () => {
            const { data, error } = await bustinaStatoLeggi();
            if (!error) _bustinaMostraStatoOverlay(data);
        }, 1800);
        return;
    }

    _bustinaRisultatoCorrente = risultato;

    const caricamento = (async () => {
        // Mese da usare: mesi_completati+1, clampato all'ultimo mese
        // REALMENTE presente nel bucket (decisione di Claudio: se manca
        // la cartella del mese "in corso", restare sull'ultimo esistente).
        let mese = (risultato.mesi_completati || 0) + 1;
        try {
            const { data: cartelle, error } = await bustinaCutsceneMesiDisponibili();
            if (!error && Array.isArray(cartelle) && cartelle.length > 0) {
                const numeri = cartelle
                    .map(c => { const m = /^mese(\d+)$/.exec(c.name); return m ? parseInt(m[1], 10) : null; })
                    .filter(n => n !== null);
                if (numeri.length > 0) {
                    const meseMassimo = Math.max(...numeri);
                    if (mese > meseMassimo) mese = meseMassimo;
                }
            }
        } catch (e) { /* mese resta quello calcolato, nessun clamp possibile */ }

        const giorno = risultato.cutscene_giorno;
        try {
            const { data } = bustinaCutsceneUrl(mese, giorno);
            const res = await fetch(`${data.publicUrl}?t=${Date.now()}`);
            _bustinaCutsceneData = res.ok ? await res.json() : null;
        } catch (e) { _bustinaCutsceneData = null; }

        if (!_bustinaCutsceneData) {
            // Fallback identico nello spirito al prototipo: nessun asset,
            // un solo dialogo di benvenuto.
            _bustinaCutsceneData = {
                background: '', music: '',
                actors: [],
                events: [{ id: 1, type: 'dialogue', speaker: 'CARDSYNC', text: 'Hai aperto una nuova bustina!', start: 0, duration: 3 }]
            };
        }
    })();

    await Promise.all([caricamento, timerMinimo, nomeUtente]);

    // Ora sì: l'animazione "a scoppio" della pokéball, poi la cutscene.
    const pokeballEl = document.getElementById('bustinaPokeball');
    wrapEl.classList.remove('scuote');
    textEl.innerText = '';
    pokeballEl.classList.add('apertura');

    setTimeout(() => {
        pokeballEl.classList.remove('apertura');
        _bustinaMostraSchermata('bustinaCutsceneScreen');
        const r = _bustinaRisultatoCorrente;
        document.getElementById('bustinaValGiorno').innerText = r.cutscene_giorno;
        document.getElementById('bustinaValMesi').innerText = r.mesi_completati;
        document.getElementById('bustinaValPolvere').innerText = r.polvere_totale || 0;
        _bustinaAvviaCutscenePlayback();
    }, 600);
}

// ── motore cutscene (porta fedele di startCutscenePlayback) ─────────────
function _bustinaAvviaCutscenePlayback() {
    const bgEl = document.getElementById('bustinaCutsceneBg');
    const audioEl = document.getElementById('bustinaGbMusic');
    const spritesLayer = document.getElementById('bustinaSpritesLayer');
    const cd = _bustinaCutsceneData;

    spritesLayer.innerHTML = '';
    _bustinaEventiScattati.clear();
    _bustinaCutsceneTime = 0;
    _bustinaDialogoAttivo = false;

    if (cd.background) {
        const { data } = bustinaAssetUrl(cd.background);
        bgEl.style.backgroundImage = `url('${data.publicUrl}')`;
    } else {
        bgEl.style.backgroundImage = '';
    }

    if (cd.music && prefSuoniWidgetGet()) {
        const { data } = bustinaAssetUrl(cd.music);
        audioEl.src = data.publicUrl;
        audioEl.play().catch(() => {});
    } else {
        audioEl.pause();
        audioEl.removeAttribute('src');
    }

    const meta = cd.meta || {};
    const baseWidth = meta.stageBaseWidth || 480;
    const baseHeight = meta.stageBaseHeight || 270;
    const spriteSize = meta.spriteBaseSize || 48;
    const scalaGlobale = (cd.spriteScalePercentage !== undefined) ? (cd.spriteScalePercentage / 100) : 1.0;

    const elementiAttori = {};
    const posizioniCorrenti = {};

    (cd.actors || []).forEach(actor => {
        const img = document.createElement('img');
        img.className = 'bs-actor-sprite';
        // asset vuoto (2026-09-09, deciso con Claudio):
        //   1) se actor.type è presente → sprite/{type}/fallback/standing.png
        //      (campo 'type' = nome cartella 1:1, es. "personaggioprincipale",
        //      "companion", "png" — l'admin scrive già il valore corretto
        //      nel tool di creazione cutscene, nessuna traduzione qui)
        //   2) direzione: SEMPRE 'standing' — lo sprite non cambia con la
        //      direzione di movimento (rimandato, Claudio ha rinunciato nel
        //      prototipo; un eventuale campo "direzione" nel json, se mai
        //      comparirà, va ignorato per ora)
        //   3) se manca anche actor.type → favicon.ico del sito (nessuna
        //      categoria nota, non si può indovinare la cartella)
        let assetUrl;
        if (actor.asset) {
            assetUrl = actor.asset.startsWith('http') ? actor.asset : bustinaAssetUrl(actor.asset).data.publicUrl;
        } else if (actor.type) {
            assetUrl = bustinaAssetUrl(`sprite/${actor.type}/fallback/standing.png`).data.publicUrl;
        } else {
            assetUrl = 'favicon.ico';
        }
        img.src = assetUrl;

        let startX = 100, startY = 100;
        if (actor.pos && Array.isArray(actor.pos)) {
            startX = actor.pos[0]; startY = actor.pos[1];
        } else if (actor.posPercentage && Array.isArray(actor.posPercentage)) {
            startX = (actor.posPercentage[0] / 100) * baseWidth;
            startY = (actor.posPercentage[1] / 100) * baseHeight;
        }
        posizioniCorrenti[actor.id] = { x: startX, y: startY };

        img.style.left = `${startX}px`;
        img.style.top = `${startY}px`;
        img.style.width = `${spriteSize * scalaGlobale}px`;
        img.style.height = `${spriteSize * scalaGlobale}px`;

        spritesLayer.appendChild(img);
        elementiAttori[actor.id] = img;
    });

    let maxEventEnd = 10.0;
    if (typeof cd.duration === 'number' && !isNaN(cd.duration)) {
        maxEventEnd = cd.duration;
    } else if (Array.isArray(cd.events) && cd.events.length > 0) {
        cd.events.forEach(ev => { const fine = (ev.start || 0) + (ev.duration || 0); if (fine > maxEventEnd) maxEventEnd = fine; });
    }

    if (_bustinaCutsceneTimer) clearInterval(_bustinaCutsceneTimer);

    _bustinaCutsceneTimer = setInterval(() => {
        if (_bustinaDialogoAttivo) return;

        (cd.events || []).forEach(ev => {
            if (ev.type === 'move') {
                const elapsed = _bustinaCutsceneTime - ev.start;
                if (elapsed >= 0 && elapsed <= ev.duration) {
                    const progress = Math.min(elapsed / ev.duration, 1.0);
                    const chiaveAttore = Object.keys(elementiAttori).find(k =>
                        k.toLowerCase() === String(ev.actor).toLowerCase() ||
                        (cd.actors && cd.actors.find(a => a.id === k && a.name && a.name.toLowerCase() === String(ev.actor).toLowerCase()))
                    );
                    if (chiaveAttore) {
                        const posDefault = posizioniCorrenti[chiaveAttore] || { x: 100, y: 100 };
                        let daCoord = [posDefault.x, posDefault.y];
                        if (ev.from && Array.isArray(ev.from)) daCoord = ev.from;
                        else if (ev.fromPercentage && Array.isArray(ev.fromPercentage)) daCoord = [(ev.fromPercentage[0] / 100) * baseWidth, (ev.fromPercentage[1] / 100) * baseHeight];

                        let aCoord = [posDefault.x + 50, posDefault.y];
                        if (ev.to && Array.isArray(ev.to)) aCoord = ev.to;
                        else if (ev.toPercentage && Array.isArray(ev.toPercentage)) aCoord = [(ev.toPercentage[0] / 100) * baseWidth, (ev.toPercentage[1] / 100) * baseHeight];

                        const currentX = daCoord[0] + (aCoord[0] - daCoord[0]) * progress;
                        const currentY = daCoord[1] + (aCoord[1] - daCoord[1]) * progress;
                        posizioniCorrenti[chiaveAttore] = { x: currentX, y: currentY };
                        const el = elementiAttori[chiaveAttore];
                        if (el) { el.style.left = `${currentX}px`; el.style.top = `${currentY}px`; }
                    }
                }
            }

            if (!_bustinaEventiScattati.has(ev.id) && _bustinaCutsceneTime >= ev.start) {
                if (ev.type === 'dialogue') {
                    _bustinaEventiScattati.add(ev.id);
                    _bustinaDialogoAttivo = true;
                    const speakerEl = document.getElementById('bustinaSpeakerName');
                    const boxEl = document.getElementById('bustinaDialogueBox');
                    const textEl = document.getElementById('bustinaDialogueText');

                    if (ev.speaker && ev.speaker.toLowerCase() === 'narratore') {
                        speakerEl.style.display = 'none';
                        textEl.style.fontStyle = 'italic';
                        textEl.style.textAlign = 'center';
                    } else {
                        speakerEl.style.display = 'block';
                        speakerEl.innerText = ev.speaker;
                        textEl.style.fontStyle = 'normal';
                        textEl.style.textAlign = 'left';
                    }
                    // Placeholder [nome] → nome utente reale, stessa fonte
                    // già usata dal sito per #profiloMenuNome: sessione →
                    // email → _nomeDaEmail() (funzione già esistente in
                    // ui/auth.ui.js, es. "irene@cardsyncpro.local" →
                    // "Irene") — nessuna colonna profiles inventata.
                    // Risolto una volta in _bustinaClickPokeball, prima
                    // che la cutscene parta, e tenuto in
                    // _bustinaNomeUtenteCorrente per tutta l'esperienza.
                    textEl.innerText = ev.text.replace(/\[nome\]/g, _bustinaNomeUtenteCorrente);
                    boxEl.style.display = 'block';
                }
            }
        });

        _bustinaCutsceneTime += 0.05;
        if (_bustinaCutsceneTime >= maxEventEnd) {
            clearInterval(_bustinaCutsceneTimer);
            document.getElementById('bustinaGbMusic').pause();
            _bustinaVaiAPack();
        }
    }, 50);
}

function _bustinaClickCutscene() {
    if (_bustinaDialogoAttivo) {
        document.getElementById('bustinaDialogueBox').style.display = 'none';
        _bustinaDialogoAttivo = false;
    }
}

// ── taglio busta (laser) + rivelazione carte REALI (mai sorteggiate qui) ─
function _bustinaVaiAPack() {
    _bustinaMostraSchermata('bustinaPackScreen');
    document.getElementById('bustinaBoosterContainer').style.display = 'flex';
    document.getElementById('bustinaCardsArea').style.display = 'none';
    document.getElementById('bustinaSummaryScreen').style.display = 'none';

    const pack = document.getElementById('bustinaBoosterPack');
    pack.classList.remove('sliced-open');
    _bustinaBustaTagliata = false;
    setTimeout(_bustinaSetupLaserCanvas, 50);

    const container = document.getElementById('bustinaCardsStack');
    container.innerHTML = '';
    _bustinaCarteSwipate = 0;

    const carte = _bustinaRisultatoCorrente.carte;
    carte.forEach((carta, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'bs-card-wrapper';
        wrapper.style.zIndex = 4 - index;

        const dupHTML = carta.doppione ? `<div class="bs-duplicate-tag">DOPPIONE</div>` : '';
        const rarityCss = RARITA_CSS_BUSTINA[carta.rarita] || 'comune';

        const { data: img } = bustinaImmagineUrl(carta.rarita, carta.nome_file);
        const { data: imgFallback } = bustinaImmagineUrl(carta.rarita, 'fallback');
        const urlImg = img?.publicUrl || '';
        const urlFallback = imgFallback?.publicUrl || '';

        wrapper.innerHTML = `
            <div class="bs-pokemon-card ${rarityCss} bs-card-glow-reveal">
                <div class="bs-card-inner-frame">
                    <div class="bs-title-container">
                        <span style="font-size:0.4rem; color:#ffd700;">${escapeHtml(carta.nome)}</span>
                    </div>
                    <div class="bs-card-image-box">
                        <img src="${urlImg}" alt="${escapeHtml(carta.nome)}" onerror="this.onerror=null; this.src='${urlFallback}';">
                    </div>
                    <div class="bs-card-description-box">
                        <span id="bustinaCardDesc${index}" class="bs-card-description-text">"${escapeHtml(carta.rarita)}"</span>
                    </div>
                </div>
                ${dupHTML}
            </div>
        `;
        container.appendChild(wrapper);

        // Testo carta reale se il bucket bustina-testi risponde — stesso
        // fallback "silenzioso" già usato dal vecchio _bustinaMostraRisultato.
        (async () => {
            try {
                const { data: txt } = bustinaTestoUrl(carta.rarita, carta.nome_file);
                const res = await fetch(txt.publicUrl);
                if (res.ok) {
                    const testo = (await res.text()).trim();
                    const descEl = document.getElementById(`bustinaCardDesc${index}`);
                    if (descEl && testo) descEl.innerText = `"${testo}"`;
                }
            } catch (e) { /* resta il testo di fallback già mostrato */ }
        })();
    });
}

function _bustinaSetupLaserCanvas() {
    const canvas = document.getElementById('bustinaLaserCanvas');
    const pack = document.getElementById('bustinaBoosterPack');
    if (canvas && pack) { canvas.width = pack.offsetWidth; canvas.height = pack.offsetHeight; }
}

function _bustinaLaserStart(e) {
    if (!document.getElementById('bustinaCutsceneOverlay').classList.contains('aperto')) return;
    _bustinaInitAudio();
    const pack = document.getElementById('bustinaBoosterPack');
    const cardTarget = e.target.closest && e.target.closest('.bs-card-wrapper');

    if (cardTarget && !cardTarget.classList.contains('bs-card-swipata')) {
        _bustinaDragCarta = cardTarget;
        _bustinaDragCarta.classList.add('trascinamento');
        _bustinaDragCarta.classList.remove('ritorno');
        _bustinaDragStartY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
        return;
    }

    if (!pack) return;
    const rect = pack.getBoundingClientRect();
    const clientX = e.clientX || (e.touches ? e.touches[0].clientX : null);
    const clientY = e.clientY || (e.touches ? e.touches[0].clientY : null);

    if (clientX !== null && clientY !== null && clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom && !_bustinaBustaTagliata) {
        _bustinaLaserDisegno = true;
        // rect (getBoundingClientRect) è in pixel REALI a schermo, già
        // scalati dal transform su #bustinaScreenWrapper. Il canvas invece
        // ha risoluzione = offsetWidth/offsetHeight di .bs-booster-pack,
        // cioè le dimensioni AUTORATE in CSS (non scalate). Per disegnare
        // nel posto giusto va quindi convertito: coordinate-schermo /
        // _bustinaScale = coordinate-canvas. La soglia di taglio (sotto)
        // resta invece in coordinate-schermo, non va convertita: misura
        // quanto ha viaggiato il dito sul vetro, indipendente dallo zoom.
        const startX = clientX - rect.left, startY = clientY - rect.top;
        _bustinaLaserPunti = [{ x: startX / _bustinaScale, y: startY / _bustinaScale }];
        _bustinaLaserStartPoint = { x: startX, y: startY };
        _bustinaSuono('laser');
    }
}

function _bustinaLaserMove(e) {
    if (e.cancelable && (_bustinaLaserDisegno || _bustinaDragCarta)) e.preventDefault();

    if (_bustinaLaserDisegno && !_bustinaBustaTagliata) {
        const pack = document.getElementById('bustinaBoosterPack');
        if (!pack) return;
        const rect = pack.getBoundingClientRect();
        const clientX = e.clientX || (e.touches ? e.touches[0].clientX : null);
        const clientY = e.clientY || (e.touches ? e.touches[0].clientY : null);
        if (clientX === null || clientY === null) return;

        const localX = clientX - rect.left, localY = clientY - rect.top;
        _bustinaLaserPunti.push({ x: localX / _bustinaScale, y: localY / _bustinaScale });
        _bustinaDisegnaLaser();

        const distX = Math.abs(localX - _bustinaLaserStartPoint.x);
        const distY = Math.abs(localY - _bustinaLaserStartPoint.y);
        if (distX >= rect.width * 0.9 || distY >= rect.height * 0.9) {
            _bustinaBustaTagliata = true;
            _bustinaLaserDisegno = false;
            pack.classList.add('sliced-open');
            _bustinaSuono('laser');
            setTimeout(() => {
                document.getElementById('bustinaBoosterContainer').style.display = 'none';
                document.getElementById('bustinaCardsArea').style.display = 'flex';
                _bustinaPuliscCanvas();
            }, 700);
        }
    } else if (_bustinaDragCarta) {
        const clientY = e.clientY || (e.touches ? e.touches[0].clientY : null);
        if (clientY !== null) {
            let dy = clientY - _bustinaDragStartY;
            if (dy > 0) dy = 0;
            // dy è un delta in pixel REALI (quanto si è mosso il dito):
            // la traslazione va invece espressa in coordinate-canvas
            // (dominio 480×270, poi scalato dall'ancestor) perché la
            // carta segua il dito 1:1 a qualunque livello di zoom —
            // altrimenti a schermo piccolo la carta si muoverebbe meno
            // del dito. La rotazione resta su dy "reale": è un effetto
            // visivo, non deve seguire pixel per pixel.
            _bustinaDragCarta.style.transform = `translateY(${dy / _bustinaScale}px) rotate(${dy / 40}deg)`;
        }
    }
}

function _bustinaLaserEnd(e) {
    if (_bustinaLaserDisegno) { _bustinaLaserDisegno = false; _bustinaPuliscCanvas(); }
    if (_bustinaDragCarta) {
        _bustinaDragCarta.classList.remove('trascinamento');
        const clientY = (e.changedTouches ? e.changedTouches[0].clientY : e.clientY) || 0;
        const dy = clientY - _bustinaDragStartY;
        if (dy < -80) {
            _bustinaDragCarta.style.transform = '';
            _bustinaSwipeCarta(_bustinaDragCarta);
        } else {
            _bustinaDragCarta.classList.add('ritorno');
            _bustinaDragCarta.style.transform = 'translateY(0px) rotate(0deg)';
        }
        _bustinaDragCarta = null;
    }
}

function _bustinaDisegnaLaser() {
    const canvas = document.getElementById('bustinaLaserCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (_bustinaLaserPunti.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(_bustinaLaserPunti[0].x, _bustinaLaserPunti[0].y);
    for (let i = 1; i < _bustinaLaserPunti.length; i++) {
        const p = _bustinaLaserPunti[i];
        ctx.lineTo(p.x + (Math.random() * 8 - 4), p.y + (Math.random() * 8 - 4));
    }
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.shadowColor = '#00ffff'; ctx.shadowBlur = 20;
    ctx.stroke();
    ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 2;
    ctx.stroke();
}

function _bustinaPuliscCanvas() {
    const canvas = document.getElementById('bustinaLaserCanvas');
    if (!canvas) return;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    _bustinaLaserPunti = [];
}

function _bustinaSwipeCarta(wrapper) {
    if (wrapper.classList.contains('bs-card-swipata')) return;
    _bustinaSuono('swipe');
    wrapper.classList.add('bs-card-swipata');
    _bustinaCarteSwipate++;
    if (_bustinaCarteSwipate === 4) {
        setTimeout(() => {
            document.getElementById('bustinaCardsArea').style.display = 'none';
            _bustinaMostraRiepilogo();
        }, 600);
    }
}

// ── riepilogo finale (dati reali, senza colonna Qtà — vedi nota di testa) ─
function _bustinaMostraRiepilogo() {
    const tbody = document.getElementById('bustinaSummaryBody');
    tbody.innerHTML = '';
    _bustinaRisultatoCorrente.carte.forEach(carta => {
        const nota = carta.doppione ? `+${carta.polvere} Polvere` : 'Nuova!';
        const colore = carta.doppione ? '#8b0000' : '#2e8b57';
        tbody.innerHTML += `
            <tr>
                <td>${escapeHtml(carta.nome)}</td>
                <td>${escapeHtml(carta.rarita)}</td>
                <td style="color:${colore}; font-weight:bold;">${nota}</td>
            </tr>`;
    });
    document.getElementById('bustinaSummaryScreen').style.display = 'block';
}

// ── chiusura: pulizia stato, torna alla home come qualunque altro widget ─
// RISTRUTTURATO 2026-09-10: non esiste più una "pagina bustina" dietro
// l'overlay da ridisegnare (era _bustinaAggiornaStato, rimossa insieme
// alla vecchia pagina pg-*) — l'overlay ORA È l'intera esperienza del
// widget. Chiudere l'overlay deve quindi chiudere il widget stesso: si
// riusa chiudiDettaglioWidget() (navigation.ui.js/phone.ui.js, la stessa
// funzione del tasto fisico/freccia indietro per tutti gli altri widget),
// così l'animazione di chiusura, il ripristino di #btnFisicoTelefono e il
// ridisegno della home restano IDENTICI al resto del sito — zero
// duplicazione, zero rischio di whitelist/stato disallineati.
function _bustinaChiudiOverlay() {
    const overlay = document.getElementById('bustinaCutsceneOverlay');
    if (overlay) overlay.classList.remove('aperto');
    if (_bustinaCutsceneTimer) { clearInterval(_bustinaCutsceneTimer); _bustinaCutsceneTimer = null; }
    _bustinaCountdownFerma();
    const musica = document.getElementById('bustinaGbMusic');
    if (musica) { musica.pause(); musica.removeAttribute('src'); }
    _bustinaDialogoAttivo = false;
    _bustinaLaserDisegno = false;
    _bustinaDragCarta = null;
    _bustinaOverlayPronto = false;
    chiudiDettaglioWidget();
}
