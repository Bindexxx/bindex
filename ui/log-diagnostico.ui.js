// Registro diagnostico in memoria degli ultimi eventi ed errori della sessione.

const LOG_DIAGNOSTICO_MAX = 200;
let _logDiagnosticoBuffer = [];

function _logDiagnosticoAggiungi(livello, messaggio, extra) {
    try {
        _logDiagnosticoBuffer.push({
            livello,
            messaggio: String(messaggio || '').slice(0, 2000),
            pagina: document.querySelector('.view-section.active')?.id || '?',
            quando: new Date().toISOString(),
            extra: extra || null,
        });
        if (_logDiagnosticoBuffer.length > LOG_DIAGNOSTICO_MAX) _logDiagnosticoBuffer.shift();
    } catch (_) {   }
}

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
