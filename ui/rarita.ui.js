// Rarità delle carte dal catalogo dei set.

const RARITA_VALIDITA_MS = 14 * 24 * 3600 * 1000;
const RARITA_RETRY_ERRORE_MS = 5 * 60 * 1000;
let _raritaInCorso = false;
let _raritaErroreTs = 0;

function raritaLivello(testo) {
    const t = String(testo || '').trim().toLowerCase();
    if (!t || t === 'none' || t === 'promo') return '';
    if (/secret|hyper|special illustration/.test(t)) return 'secret';
    if (/ultra|double|illustration|black white|ace spec|full art|radiant|amazing|\bv(?:max|star)?\b/.test(t)) return 'ultra_rara';
    if (/uncommon/.test(t)) return 'non_comune';
    if (/common/.test(t)) return 'comune';
    if (/rare|holo|legend|classic|prime/.test(t)) return 'rara';
    return '';
}

function raritaApplica(carte, cache) {
    let cambiato = false;
    (carte || []).forEach(c => {
        if (!c || !c.code) return;
        const letto = _ballLeggiCodice(c.code);
        if (!letto || letto.numero == null) return;
        const voce = cache[letto.set];
        if (!voce || !voce.r) return;
        const livello = voce.r[letto.numero] || '';
        if ((c.rarita || '') !== livello) { c.rarita = livello; cambiato = true; }
    });
    return cambiato;
}

async function raritaAggiorna() {
    if (typeof carteReali === 'undefined' || !Array.isArray(carteReali) || !carteReali.length) return;
    let cache = prefRaritaCacheGet();
    raritaApplica(carteReali, cache);

    if (_raritaInCorso || Date.now() - _raritaErroreTs < RARITA_RETRY_ERRORE_MS) return;
    const ora = Date.now();
    const sigle = new Set();
    carteReali.forEach(c => {
        const l = c && c.code ? _ballLeggiCodice(c.code) : null;
        if (l && l.numero != null) sigle.add(l.set);
    });
    const mancanti = [...sigle].filter(s => !cache[s] || ora - (cache[s].t || 0) > RARITA_VALIDITA_MS);
    if (!mancanti.length) return;

    _raritaInCorso = true;
    try {
        const { data, error } = await setRaritaLeggi(mancanti);
        if (error) { _raritaErroreTs = Date.now(); console.error('Rarità — lettura catalogo:', error.message || error); return; }
        const nuovo = {};
        mancanti.forEach(s => { nuovo[s] = { t: Date.now(), r: {} }; });
        (data || []).forEach(r => {
            const voce = nuovo[r.sigla] || nuovo[String(r.sigla).toUpperCase()];
            if (!voce) return;
            const livello = raritaLivello(r.rarita);
            if (!livello) return;
            if (!voce.r[r.numero] || r.variante === 'normale') voce.r[r.numero] = livello;
        });
        cache = Object.assign(prefRaritaCacheGet(), nuovo);
        prefRaritaCacheSet(cache);
        if (raritaApplica(carteReali, cache) && typeof renderWidgetHome === 'function') renderWidgetHome();
    } catch (e) {
        _raritaErroreTs = Date.now();
        console.error('Rarità:', e);
    } finally {
        _raritaInCorso = false;
    }
}
