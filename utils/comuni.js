// Funzioni di formattazione e sicurezza comuni a tutte le pagine.

let _formatoEuroDueDecimali = null;
function formattaEuro(v) {
    if (!_formatoEuroDueDecimali) _formatoEuroDueDecimali = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' });
    return _formatoEuroDueDecimali.format(Number(v) || 0) + ' €';
}

let _formatoEuroIntero = null;
function formattaEuroTondo(v) {
    if (!_formatoEuroIntero) _formatoEuroIntero = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0, useGrouping: 'always' });
    return _formatoEuroIntero.format(Math.round(Number(v) || 0)) + ' €';
}
function formattaEuroVariazione(v) {
    const n = Number(v) || 0;
    if (Math.abs(n) < 0.005) return formattaEuro(0);
    return (n > 0 ? '+' : '−') + formattaEuro(Math.abs(n));
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML.replace(/"/g, '&quot;');
}

function escapeJsAttr(str) {
    return String(str == null ? '' : str)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r\n|\r|\n/g, '\\n')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function urlEsternoSicuro(url) {
    if (url == null) return null;
    const valore = String(url).trim();
    if (!valore || valore === '#') return null;
    let indirizzo;
    try {
        indirizzo = new URL(valore);
    } catch (_) {
        return null;
    }
    if (indirizzo.protocol !== 'http:' && indirizzo.protocol !== 'https:') return null;
    return escapeHtml(indirizzo.href);
}

function _urlImmagineSicura(url) {
    return String(url).replace(/"/g, '&quot;');
}

function _urlImmagineVisualizzabile(immagine, larghezza) {
    if (!immagine) return null;
    const valore = String(immagine).trim();

    if (/^data:image\/(png|jpe?g|gif|webp|avif);base64,[A-Za-z0-9+/=\s]+$/i.test(valore)) {
        return _urlImmagineSicura(valore);
    }

    let indirizzo;
    try {
        indirizzo = new URL(valore);
    } catch (_) {
        return null;
    }
    if (indirizzo.protocol !== 'http:' && indirizzo.protocol !== 'https:') return null;

    const host = indirizzo.hostname.toLowerCase();
    if (indirizzo.protocol === 'https:' && (host === 'supabase.co' || host.endsWith('.supabase.co'))) {
        return _urlImmagineSicura(indirizzo.href);
    }

    return _urlImmagineSicura(`https://images.weserv.nl/?url=${encodeURIComponent(indirizzo.href)}&w=${larghezza || 64}`);
}
