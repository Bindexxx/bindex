// ── utils/theme-colori.js ────────────────────────────────────────────────
// Derivazione delle variabili CSS del tema e della palette Poké Ball a
// partire da DUE soli colori scelti dall'utente (Principale/Secondario),
// invece dei 3 preset fissi Viola/Verde/Pokémon di prima.
//
// STEP 1 del restyle "cornice Pokédex" (vedi Roadmap_Restyle_Home_
// Pokedex_2026-09-17.txt). Funzioni pure, nessuna dipendenza da altri
// file — stesso principio di utils/formatters.js.
//
// ALGORITMO: mix RGB lineare verso bianco o nero, stesso identico
// principio già usato in ui/widget-render-condiviso.ui.js per le sfere
// Poké Ball (_ballMiscela/_ballSchiarisci/_ballScurisci) — qui duplicato
// invece di riusato perché questo file deve restare senza dipendenze e
// caricarsi PRIMA di widget-render-condiviso.ui.js (Regola d'Oro #1:
// preferire una piccola duplicazione a un accoppiamento cross-file).
//
// CALIBRAZIONE: i rapporti (terzo argomento "q" delle funzioni schiarisci/
// scurisci) sono stati scelti per riprodurre IL PIÙ VICINO POSSIBILE i
// valori esadecimali del vecchio tema "Viola Soft" (#7c4dff) quando
// Principale/Secondario hanno i valori di default — ma alcuni valori
// storici erano scelti a mano (non un mix lineare pulito), quindi il
// risultato è VICINO, non pixel-identico. Verificare dal vivo al primo
// avvio e aggiustare qui i "q" se qualche tono stona.
// ───────────────────────────────────────────────────────────────────────

// Default: identici al vecchio tema "Viola Soft" — primo avvio dopo
// l'aggiornamento resta visivamente quasi invariato per chi non ha ancora
// scelto un colore. Secondario di default = il vecchio --text-muted
// viola (#756a8a), che già faceva da "colore attenuato" nel tema
// precedente.
const TEMA_COLORE_PRINCIPALE_DEFAULT = '#7c4dff';
const TEMA_COLORE_SECONDARIO_DEFAULT = '#756a8a';

function _temaEsadecimaleARgb(hex) {
    let h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) return { r: 124, g: 77, b: 255 }; // fallback: principale default
    return { r, g, b };
}

function _temaRgbAEsadecimale(r, g, b) {
    const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
    return '#' + c(r) + c(g) + c(b);
}

// Mix lineare verso un bersaglio (255 = bianco, 0 = nero), quantità q in
// [0,1]. Stesso identico principio di _ballMiscela in
// ui/widget-render-condiviso.ui.js.
function _temaMiscela(hex, target, q) {
    const { r, g, b } = _temaEsadecimaleARgb(hex);
    const mix = (v) => v + (target - v) * q;
    return _temaRgbAEsadecimale(mix(r), mix(g), mix(b));
}
const _temaSchiarisci = (hex, q) => _temaMiscela(hex, 255, q);
const _temaScurisci = (hex, q) => _temaMiscela(hex, 0, q);

function _temaRgbaConAlpha(hex, alpha) {
    const { r, g, b } = _temaEsadecimaleARgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ── VARIABILI CSS DEL SITO (le stesse ~11 che ogni preset ridefiniva a
// mano) ────────────────────────────────────────────────────────────────
// Ritorna un oggetto {nomeVariabileCss: valore} pronto per essere
// applicato con document.documentElement.style.setProperty(...).
function derivaVariabiliTema(principale, secondario, scuro) {
    const P = principale || TEMA_COLORE_PRINCIPALE_DEFAULT;
    const S = secondario || TEMA_COLORE_SECONDARIO_DEFAULT;

    if (!scuro) {
        return {
            '--bg-color': _temaSchiarisci(P, 0.91),
            '--card-bg': '#ffffff',
            '--primary': P,
            // --secondary: STEP 2 (2026-09-17) — colore grezzo, non
            // mixato, usato dalla cornice CSS (gradiente #phoneFrameBox)
            // e da chiunque altro serva il Secondario "puro" invece delle
            // sue derivazioni (--border-color, --badge-loc-bg, ecc.).
            // Stesso valore in chiaro/scuro (un dispositivo fisico non
            // cambia colore col tema software).
            '--secondary': S,
            '--primary-light': _temaSchiarisci(P, 0.86),
            '--primary-dark': _temaScurisci(P, 0.24),
            '--text-dark': _temaScurisci(P, 0.80),
            '--text-muted': S,
            '--border-color': _temaSchiarisci(S, 0.86),
            '--row-hover': _temaSchiarisci(P, 0.95),
            '--row-selected-bg': _temaSchiarisci(P, 0.80),
            '--table-header-bg': _temaSchiarisci(P, 0.94),
            '--badge-loc-bg': _temaSchiarisci(S, 0.90),
            '--shadow-soft': `0 4px 20px ${_temaRgbaConAlpha(P, 0.08)}`,
        };
    }

    // Dark mode: stessa formula, mix verso NERO invece che bianco per gli
    // sfondi, e schiarito (verso bianco) per i testi — stesso principio
    // già presente nei vecchi 3 preset in dark (es. theme-verde scuro era
    // verde molto scuro, non nero piatto). --primary resta vivido
    // (invariato), --primary-dark pure (comportamento identico a prima).
    // --shadow-soft in dark era già neutro/nero in tutti e 3 i vecchi
    // preset (non tinto), quindi resta così anche qui.
    return {
        '--bg-color': _temaScurisci(P, 0.93),
        '--card-bg': _temaScurisci(P, 0.86),
        '--primary': P,
        '--secondary': S,
        '--primary-light': _temaRgbaConAlpha(P, 0.2),
        '--primary-dark': _temaScurisci(P, 0.24),
        '--text-dark': _temaSchiarisci(P, 0.92),
        '--text-muted': _temaSchiarisci(S, 0.55),
        '--border-color': _temaScurisci(S, 0.65),
        '--row-hover': _temaScurisci(P, 0.80),
        '--row-selected-bg': _temaScurisci(P, 0.45),
        '--table-header-bg': _temaScurisci(P, 0.90),
        '--badge-loc-bg': _temaScurisci(S, 0.75),
        '--shadow-soft': '0 4px 20px rgba(0, 0, 0, 0.3)',
    };
}

// ── PALETTE DELLA SFERA POKÉ BALL (calotta/pancia) ───────────────────────
// Sostituisce la vecchia tabella fissa _ballPALETTE a 6 voci (3 temi x
// chiaro/scuro) in ui/widget-render-condiviso.ui.js. Calibrato sui vecchi
// valori "viola" (calotta = principale schiarito ~25%, pancia chiara
// sempre uguale a prescindere dal tema — comportamento confermato
// osservando che viola/verde/pokemon condividevano IDENTICA pancia
// chiara ['#ffffff','#f0efeb','#c9c8c2']).
function derivaPaletteBall(principale, secondario, scuro) {
    const P = principale || TEMA_COLORE_PRINCIPALE_DEFAULT;
    const S = secondario || TEMA_COLORE_SECONDARIO_DEFAULT;

    if (!scuro) {
        return {
            calotta: _temaSchiarisci(P, 0.25),
            // Pancia chiara: costante a prescindere dal colore scelto,
            // come nei 3 vecchi preset — un bianco/crema con leggera
            // ombra, mai colorata (Claudio, sessione 2026-08-27: "nei
            // temi scuri la pancia diventa grigia, mai bianca").
            pancia: ['#ffffff', '#f0efeb', '#c9c8c2'],
        };
    }
    return {
        calotta: _temaScurisci(P, 0.35),
        pancia: [
            _temaSchiarisci(S, 0.38),
            _temaSchiarisci(S, 0.28),
            _temaSchiarisci(S, 0.12),
        ],
    };
}
