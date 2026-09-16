// ── ui/log-diagnostico.ui.js ──────────────────────────────────────────────
// Fase 10, Step 3 (2026-09-13). Buffer in memoria degli ultimi eventi/
// errori di QUESTA sessione — mai retroattivo (impossibile leggere la
// console F12 di prima che questo file si caricasse, la roadmap lo dice
// esplicitamente), riparte vuoto ad ogni refresh. Caricato il più presto
// possibile in index.html (subito dopo config/supabase.js) così cattura
// anche gli errori dei primi istanti di caricamento pagina.
//
// NESSUN refactor dei ~200+ console.error() già sparsi in tutto il
// progetto: invece di toccare ogni singolo file, si "intercetta" qui
// console.error stesso (pattern comune per un log buffer passivo) — ogni
// chiamata esistente continua a scrivere in console ESATTAMENTE come
// prima (comportamento invariato), e in più finisce anche nel buffer.
// Stesso principio per gli errori davvero non gestiti (window 'error'/
// 'unhandledrejection') — quelli che oggi non arrivano da nessuna parte.

const LOG_DIAGNOSTICO_MAX = 200;
let _logDiagnosticoBuffer = [];

function _logDiagnosticoAggiungi(livello, messaggio, extra) {
    try {
        _logDiagnosticoBuffer.push({
            livello, // 'errore' | 'promise_non_gestita' | 'js_non_gestito'
            messaggio: String(messaggio || '').slice(0, 2000), // mai un messaggio gigante (es. un oggetto enorme passato per errore)
            pagina: document.querySelector('.view-section.active')?.id || '?',
            quando: new Date().toISOString(),
            extra: extra || null,
        });
        if (_logDiagnosticoBuffer.length > LOG_DIAGNOSTICO_MAX) _logDiagnosticoBuffer.shift();
    } catch (_) { /* un log che fallisce non deve mai rompere altro */ }
}

// Intercetta console.error SENZA disattivarlo — chiama sempre prima
// l'originale, poi aggiunge al buffer. Se un giorno questo file non si
// carica per qualche motivo, console.error torna a comportarsi come
// sempre (nessuna dipendenza nell'altro verso).
const _consoleErrorOriginale = console.error.bind(console);
console.error = function (...args) {
    _consoleErrorOriginale(...args);
    const testo = args.map(a => {
        if (a instanceof Error) return (a.stack || a.message);
        if (typeof a === 'object') { try { return JSON.stringify(a); } catch (_) { return String(a); } }
        return String(a);
    }).join(' ');
    _logDiagnosticoAggiungi('errore', testo);
};

window.addEventListener('error', (evt) => {
    _logDiagnosticoAggiungi('js_non_gestito', evt.message, {
        file: evt.filename, riga: evt.lineno, colonna: evt.colno,
        stack: evt.error && evt.error.stack ? evt.error.stack.slice(0, 1500) : null,
    });
});

window.addEventListener('unhandledrejection', (evt) => {
    const motivo = evt.reason;
    _logDiagnosticoAggiungi('promise_non_gestita',
        motivo instanceof Error ? motivo.message : String(motivo),
        { stack: motivo instanceof Error && motivo.stack ? motivo.stack.slice(0, 1500) : null });
});


// ── FORMATTAZIONE PER L'INVIO/LA VISUALIZZAZIONE ─────────────────────────
// Testo semplice, non JSON — più facile da leggere per un admin che apre
// una segnalazione, stesso spirito "leggibile da umano" di tutto il resto
// del progetto (commenti compresi).
function _logDiagnosticoTesto(limite = 40) {
    if (_logDiagnosticoBuffer.length === 0) return '(nessun evento registrato in questa sessione)';
    return _logDiagnosticoBuffer.slice(-limite).map(e =>
        `[${e.quando}] (${e.livello}, pagina "${e.pagina}") ${e.messaggio}${e.extra && e.extra.stack ? '\n    ' + e.extra.stack.split('\n').slice(0, 3).join('\n    ') : ''}`
    ).join('\n\n');
}

function _logDiagnosticoInfoDispositivo() {
    return `Pagina: ${document.querySelector('.view-section.active')?.id || '?'}\n` +
        `Browser: ${navigator.userAgent}\n` +
        `Schermo: ${window.innerWidth}×${window.innerHeight}\n` +
        `URL: ${window.location.href}\n` +
        `Data: ${new Date().toLocaleString('it-IT')}`;
}
