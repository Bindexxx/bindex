// Colori del tema a partire dai due colori scelti dall'utente.

const TEMA_COLORE_PRINCIPALE_DEFAULT = '#7c4dff';
const TEMA_COLORE_SECONDARIO_DEFAULT = '#756a8a';

function _temaEsadecimaleARgb(hex) {
    let h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) return { r: 124, g: 77, b: 255 };
    return { r, g, b };
}

function _temaRgbAEsadecimale(r, g, b) {
    const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
    return '#' + c(r) + c(g) + c(b);
}

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

const TEMA_CONTRASTO_MIN_TESTO = 4.5;
const TEMA_COLORE_SCRITTA_SCURA = '#17171a';
const TEMA_COLORE_SCRITTA_CHIARA = '#ffffff';

function _temaLuminanza(hex) {
    const { r, g, b } = _temaEsadecimaleARgb(hex);
    const lin = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function _temaContrasto(hexA, hexB) {
    const la = _temaLuminanza(hexA), lb = _temaLuminanza(hexB);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function temaColoreSuSfondo(sfondo) {
    return _temaContrasto(TEMA_COLORE_SCRITTA_CHIARA, sfondo) >= _temaContrasto(TEMA_COLORE_SCRITTA_SCURA, sfondo)
        ? TEMA_COLORE_SCRITTA_CHIARA : TEMA_COLORE_SCRITTA_SCURA;
}

function temaColoreLeggibile(colore, sfondi, versoScuro, minimo) {
    const soglia = minimo || TEMA_CONTRASTO_MIN_TESTO;
    const ok = (c) => sfondi.every(sf => _temaContrasto(c, sf) >= soglia);
    if (ok(colore)) return colore;
    for (let q = 0.05; q <= 1.0001; q += 0.05) {
        const c = _temaMiscela(colore, versoScuro ? 0 : 255, q);
        if (ok(c)) return c;
    }
    return versoScuro ? '#000000' : '#ffffff';
}

function _temaSuSfondoOpaco(hex, alpha, base) {
    const a = _temaEsadecimaleARgb(hex), b = _temaEsadecimaleARgb(base);
    return _temaRgbAEsadecimale(a.r * alpha + b.r * (1 - alpha), a.g * alpha + b.g * (1 - alpha), a.b * alpha + b.b * (1 - alpha));
}

function derivaVariabiliTema(principale, secondario, scuro) {
    const P = principale || TEMA_COLORE_PRINCIPALE_DEFAULT;
    const S = secondario || TEMA_COLORE_SECONDARIO_DEFAULT;

    if (!scuro) {
        const bgChiaro = _temaSchiarisci(P, 0.91);
        const primaryLight = _temaSchiarisci(P, 0.86);
        const sfondiChiari = ['#ffffff', bgChiaro, primaryLight];
        return {
            '--bg-color': bgChiaro,
            '--card-bg': '#ffffff',
            '--primary': P,
            '--on-primary': temaColoreSuSfondo(P),
            '--primary-text': temaColoreLeggibile(P, sfondiChiari, true),
            '--secondary': S,
            '--primary-light': primaryLight,
            '--primary-dark': _temaScurisci(P, 0.24),
            '--text-dark': _temaScurisci(P, 0.80),
            '--text-muted': temaColoreLeggibile(S, sfondiChiari, true),
            '--border-color': _temaSchiarisci(S, 0.86),
            '--row-hover': _temaSchiarisci(P, 0.95),
            '--row-selected-bg': _temaSchiarisci(P, 0.80),
            '--table-header-bg': _temaSchiarisci(P, 0.94),
            '--badge-loc-bg': _temaSchiarisci(S, 0.90),
            '--shadow-soft': `0 4px 20px ${_temaRgbaConAlpha(P, 0.08)}`,
        };
    }

    const bgScuro = _temaScurisci(P, 0.93);
    const cardScuro = _temaScurisci(P, 0.86);
    const sfondiScuri = [bgScuro, cardScuro, _temaSuSfondoOpaco(P, 0.2, cardScuro)];
    return {
        '--bg-color': bgScuro,
        '--card-bg': cardScuro,
        '--primary': P,
        '--on-primary': temaColoreSuSfondo(P),
        '--primary-text': temaColoreLeggibile(P, sfondiScuri, false),
        '--secondary': S,
        '--primary-light': _temaRgbaConAlpha(P, 0.2),
        '--primary-dark': _temaScurisci(P, 0.24),
        '--text-dark': _temaSchiarisci(P, 0.92),
        '--text-muted': temaColoreLeggibile(_temaSchiarisci(S, 0.55), sfondiScuri, false),
        '--border-color': _temaScurisci(S, 0.65),
        '--row-hover': _temaScurisci(P, 0.80),
        '--row-selected-bg': _temaScurisci(P, 0.45),
        '--table-header-bg': _temaScurisci(P, 0.90),
        '--badge-loc-bg': _temaScurisci(S, 0.75),
        '--shadow-soft': '0 4px 20px rgba(0, 0, 0, 0.3)',
    };
}

function derivaPaletteBall(principale, secondario, scuro) {
    const P = principale || TEMA_COLORE_PRINCIPALE_DEFAULT;
    const S = secondario || TEMA_COLORE_SECONDARIO_DEFAULT;

    if (!scuro) {
        return {
            calotta: _temaSchiarisci(P, 0.25),
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
