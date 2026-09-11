// ═══════════════════════════════════════════════════════════════════════
// WIDGET-BUSTINA-UTILS.UI.JS — catalogo, stato, audio, frasi, countdown
// del widget Bustina (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP separato dal piano "riduzione accoppiamento" concordato con Claudio
// il 2026-09-11 (Claudio ha chiesto esplicitamente di spezzare anche
// questo file, nonostante il consiglio di lasciarlo intero dato che le
// sue sezioni sono stadi sequenziali di un solo flusso interattivo).
// Estratto da ui/widget-bustina.ui.js. NESSUNA riscrittura del codice
// esistente: solo spostamento, zero cambi di comportamento per l'utente
// finale.
//
// Contiene: CATALOGO_WIDGET.bustina (voce di catalogo/anteprima), markup
// iniziale pagina/overlay, tutte le variabili di stato del motore
// (_bustina* — dichiarate qui ma lette/scritte per lo più dal motore
// interattivo in ui/widget-bustina.ui.js: laser, drag, cutscene, ecc.),
// audio, frase di caricamento, frase "nessuna bustina disponibile",
// countdown fino al prossimo rinnovo.
//
// ⚠ Le variabili di stato (_bustinaAudioCtx, _bustinaLaserPunti,
// _bustinaDragCarta, ecc.) vivono qui per convenzione storica del file
// originale ("stato del motore, a livello di file") ma sono usate
// ESTESAMENTE dal motore interattivo nell'altro file — è normale e
// previsto (stesso scope globale condiviso di sempre), non un errore di
// posizionamento.
//
// Nessuna istruzione qui gira a tempo di caricamento script (solo
// dichiarazioni con valori statici) — l'ordine tra questo file e
// ui/widget-bustina.ui.js nei <script> tag di index.html è indifferente.
// ───────────────────────────────────────────────────────────────────────

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

