// Widget Bustina: catalogo, stato, audio, frasi, conto alla rovescia.

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
        _bustinaMostraStatoOverlay(data);
    } catch (e) {
        console.error('renderPaginaBustina:', e);
        if (container) container.innerHTML = '<p style="text-align:center; color:var(--danger); font-size:0.85rem; padding:1rem 0;">Errore nel caricamento dello stato.</p>';
    }
}

function _bustinaMostraStatoOverlay(stato) {
    _bustinaCountdownFerma();

    const puoAprire = stato.giornaliera_disponibile || stato.saldo_guadagnate > 0;
    if (puoAprire) {
        _bustinaMostraSchermata('bustinaLoaderScreen');
        const wrapEl = document.getElementById('bustinaPokeballWrap');
        wrapEl.classList.remove('scuote');
        wrapEl.classList.add('pronto');
        _bustinaOverlayPronto = true;
        document.getElementById('bustinaPreloadText').innerText = '';
        _bustinaFrase().then(f => {
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

let _bustinaAudioCtx = null;
let _bustinaOverlayCostruito = false;
let _bustinaOverlayPronto = false;
let _bustinaRisultatoCorrente = null;
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
let _bustinaNomeUtenteCorrente = 'Allenatore';
const RARITA_CSS_BUSTINA = { 'comuni': 'comune', 'non comuni': 'non-comune', 'rare': 'rara', 'ultra rare': 'ultra-rara', 'leggendarie': 'leggendaria' };
let _bustinaScale = 1;
let _bustinaCountdownTimer = null;

function _bustinaInitAudio() {
    if (!_bustinaAudioCtx) _bustinaAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_bustinaAudioCtx.state === 'suspended') _bustinaAudioCtx.resume();
}

function _bustinaSuono(tipo) {
    if (!prefSuoniWidgetGet()) return;
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
    } catch (e) {   }
}

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
    } catch (e) {   }
    return fallback[Math.floor(Math.random() * fallback.length)];
}

function _bustinaSeedOggi() {
    const oggi = new Date().toISOString().slice(0, 10);
    let seed = 0;
    for (let i = 0; i < oggi.length; i++) seed = (seed * 31 + oggi.charCodeAt(i)) % 10000000;
    return seed;
}

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
    } catch (e) {   }
    return fallback[_bustinaSeedOggi() % fallback.length];
}

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
