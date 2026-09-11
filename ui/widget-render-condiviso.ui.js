// ═══════════════════════════════════════════════════════════════════════
// WIDGET-RENDER-CONDIVISO.UI.JS — motore visivo condiviso dei widget
// (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP 1 della ristrutturazione file widget home (vedi
// Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md). Estratto da
// ui/phone.ui.js il 2026-09-11: palette/emblemi, disegno sfera, animazione
// di cattura, semaforo, particelle, componenti visivi riusati (_ballRiga,
// _ballPill, _ballSparkline, _ballMiniCarta, ecc.), _ballCORPI (il corpo
// grafico di ogni widget in modalità tessera), _ballCorpoWidget. NESSUNA
// riscrittura: solo spostamento di codice, zero cambi di comportamento.
//
// Caricato SUBITO DOPO ui/paginainiziale.ui.js e PRIMA di ui/phone.ui.js
// in index.html — ogni widget successivo (estratto nei prossimi step) lo
// userà per disegnare la propria tessera.
//
// DIPENDENZA CRITICA (segnalata già nella roadmap): _ballCORPI contiene,
// per ogni id, la funzione che disegna il corpo grande della tessera —
// undici di queste fanno riferimento ai 'dati' prodotti dal preview() del
// widget corrispondente (oggi ancora in CATALOGO_WIDGET dentro
// phone.ui.js). Restano QUI (motore visuale, non logica del widget) ma
// vanno riverificate una per una quando si estrae ogni widget nei
// prossimi step, per assicurarsi che la forma dei 'dati' non cambi.
//
// NOTA: la "LIBRERIA DEI SET" (_ballLIBRERIA_MANUALE, _ballLIBRERIA_SET,
// _ballCaricaLibreriaDaDb, _ballSetBase, _ballALIAS_TESTA,
// _ballSetBaseConAlias, _ballLeggiCodice — righe 34-230 circa di
// phone.ui.js) NON è stata spostata qui nonostante il prefisso "_ball":
// verificato leggendo il codice, è usata ESCLUSIVAMENTE dal preview() del
// widget Set (CATALOGO_WIDGET.set_completamento) — è dato/logica
// specifica di quel widget, non motore condiviso. Resta in phone.ui.js e
// si sposterà in widget-set.ui.js allo STEP 18, non prima. Il prefisso
// "_ball" qui è solo convenzione anti-collisione di nomi globali, non
// indica appartenenza al motore grafico.
// ───────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════
// GRAFICA POKÉ BALL DEI WIDGET (sessione 2026-08-27)
// ═══════════════════════════════════════════════════════════════════════
// Sostituisce l'icona FontAwesome delle tessere con una sfera disegnata in
// SVG. Origine: mockup approvato da Claudio (mockup-widget.html), a sua
// volta derivato dal modulo di Opus.
//
// ROLLBACK IN UNA RIGA: mettere BALL_ATTIVA a false qui sotto. Il markup
// vecchio (icona FontAwesome) è ancora tutto in renderWidgetHome(), dentro
// il ramo else — non è stato cancellato niente.
//
// NOMI: tutto ciò che vive qui è prefissato _ball/_pkdx perché gli script
// del sito condividono un unico scope globale (niente moduli): nomi come
// TEMPI, EMBLEMI o miscela() avrebbero potuto collidere con qualunque
// altro dei 29 file e rompere l'intera pagina in fase di parsing.
const BALL_ATTIVA = true;

// Tempi originali dell'animazione di cattura. Alzare/abbassare qui cambia
// tutta la sequenza senza toccare i singoli fotogrammi.
const _ballTEMPI = { lancio: 300, scosse: 1500, click: 720 };
const _ballAMPIEZZA = [19, 14, 10];

// viewBox ritagliato ESATTAMENTE sulla sfera (centro 64,70 raggio 48), così
// il riquadro CSS coincide con la sfera e il diametro è il lato del box.
// Quello originale ('0 0 128 124') lasciava margine per le skin sporgenti
// (orecchie, code): servirà se un giorno arriveranno, oggi renderebbe la
// sfera solo il 75% del riquadro.
const _ballVIEWBOX = '16 22 96 96';

// ── PALETTE: la ball segue il TEMA, non il singolo widget ────────────────
// Claudio: calotta lavanda sul viola, verde sul tema verde; nei temi scuri
// la pancia diventa grigia (mai bianca: su fondo scuro abbaglia) e la
// calotta si incupisce.
// I colori per-widget originali sono conservati in CATALOGO_WIDGET.colore e
// oggi inutilizzati: diventeranno un tema a sé ("ball colorate" sbloccabili)
// riportando _ballPaletteWidget a true.
let _ballPaletteWidget = false;

const _ballPALETTE = {
    viola:       { calotta: '#9b7ce0', pancia: ['#ffffff', '#f0efeb', '#c9c8c2'] },
    verde:       { calotta: '#5aa860', pancia: ['#ffffff', '#f0efeb', '#c9c8c2'] },
    pokemon:     { calotta: '#4f93de', pancia: ['#ffffff', '#f0efeb', '#c9c8c2'] },
    scuro_viola: { calotta: '#5b4a86', pancia: ['#a9a8b0', '#94939c', '#6f6e77'] },
    scuro_verde: { calotta: '#3c6b45', pancia: ['#a9aca8', '#949892', '#6e726d'] },
    scuro_poke:  { calotta: '#2f5687', pancia: ['#a8abb2', '#93969d', '#6d7077'] }
};

function _ballTemaAttivo() {
    const b = document.body.classList;
    const scuro = b.contains('dark-mode');
    const verde = b.contains('theme-verde');
    const poke  = b.contains('theme-pokemon');
    if (scuro) return _ballPALETTE[verde ? 'scuro_verde' : (poke ? 'scuro_poke' : 'scuro_viola')];
    if (verde) return _ballPALETTE.verde;
    if (poke)  return _ballPALETTE.pokemon;
    return _ballPALETTE.viola;
}

// ── COLORI DERIVATI ──────────────────────────────────────────────────────
function _ballMiscela(hex, target, q) {
    let h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    let r = parseInt(h.substring(0,2),16), g = parseInt(h.substring(2,4),16), b = parseInt(h.substring(4,6),16);
    r = Math.round(r + (target-r)*q); g = Math.round(g + (target-g)*q); b = Math.round(b + (target-b)*q);
    return `rgb(${r},${g},${b})`;
}
const _ballSchiarisci = (h, q) => _ballMiscela(h, 255, q);
const _ballScurisci   = (h, q) => _ballMiscela(h, 0, q);

// ── EMBLEMI (sagome bianche piene, riquadro 24x24) ───────────────────────
// I primi dieci vengono dal modulo di Opus; gli ultimi quattro (persone,
// pin, lampadina, orologio) sono stati disegnati per i widget che non
// avevano corrispondenza.
const _ballEMBLEMI = {
    carte: (c) => {
        const st = ` stroke="${_ballScurisci(c, 0.5)}" stroke-width="1.6" stroke-linejoin="round"`;
        return `<rect x="1.8" y="6.5" width="8.5" height="13" rx="1.6" transform="rotate(-26 6.05 13)"${st}/>` +
               `<rect x="13.7" y="6.5" width="8.5" height="13" rx="1.6" transform="rotate(26 17.95 13)"${st}/>` +
               `<rect x="7.75" y="4.5" width="8.5" height="15" rx="1.6"${st}/>`;
    },
    piu: () => '<rect x="9.8" y="2.6" width="4.4" height="18.8" rx="2.2"/>' +
               '<rect x="2.6" y="9.8" width="18.8" height="4.4" rx="2.2"/>',
    scambio: () => '<path d="M2.5 6.4h11.2V2.4l7.8 5.6-7.8 5.6V9.6H2.5z"/>' +
                   '<path d="M21.5 17.6H10.3v4l-7.8-5.6 7.8-5.6v4h11.2z"/>',
    monete: (c) => '<ellipse cx="12" cy="5.6" rx="9" ry="3.4"/>' +
        '<path d="M3 8.4v3.1c0 1.9 4 3.4 9 3.4s9-1.5 9-3.4V8.4c0 1.9-4 3.4-9 3.4S3 10.3 3 8.4z"/>' +
        '<path d="M3 14.4v3.1c0 1.9 4 3.4 9 3.4s9-1.5 9-3.4v-3.1c0 1.9-4 3.4-9 3.4s-9-1.5-9-3.4z"/>' +
        `<ellipse cx="12" cy="5.6" rx="3.4" ry="1.3" fill="${c}"/>`,
    cuore: () => '<path d="M12 21.2l-1.7-1.6C4.3 14.1 1 11.1 1 7.6 1 4.5 3.4 2 6.5 2c1.8 0 3.5.9 4.5 2.2C12 2.9 13.7 2 15.5 2 18.6 2 21 4.5 21 7.6c0 3.5-3.3 6.5-9.3 12z"/>',
    album: (c) => '<path d="M2 4.6C4.6 3 8.4 3 11 4.6v15.2C8.4 18.2 4.6 18.2 2 19.8z"/>' +
        '<path d="M13 4.6C15.6 3 19.4 3 22 4.6v15.2c-2.6-1.6-6.4-1.6-9 0z"/>' +
        `<rect x="11.2" y="3.4" width="1.6" height="17" rx=".8" fill="${c}"/>`,
    bustina: (c) => '<path d="M5.5 7L7.1 4.9 8.8 7l1.6-2.1L12 7l1.6-2.1L15.3 7l1.6-2.1L18.5 7v13.6a1.4 1.4 0 01-1.4 1.4H6.9a1.4 1.4 0 01-1.4-1.4z"/>' +
        `<rect x="5.5" y="11.9" width="13" height="2.4" fill="${c}"/>`,
    polvere: () => '<path d="M12 0.8l2.6 6.6 6.6 2.6-6.6 2.6L12 19.2 9.4 12.6 2.8 10l6.6-2.6z"/>' +
        '<path d="M19.4 14.6l1.1 2.8 2.8 1.1-2.8 1.1-1.1 2.8-1.1-2.8-2.8-1.1 2.8-1.1z"/>' +
        '<circle cx="4.4" cy="18.4" r="2.1"/>',
    regalo: (c) => '<rect x="3" y="9.5" width="18" height="11.8" rx="1.8"/>' +
        '<rect x="1.8" y="5.6" width="20.4" height="4.6" rx="1.6"/>' +
        `<rect x="10.4" y="4.5" width="3.2" height="17" fill="${c}"/>` +
        '<path d="M12 6.2C10.2 2.2 5.6 2.6 6.1 5.6c.4 2.1 3.5 1.7 5.9.6z"/>' +
        '<path d="M12 6.2c1.8-4 6.4-3.6 5.9-.6-.4 2.1-3.5 1.7-5.9.6z"/>',
    ingranaggio: (c) => '<path d="M12 1.8l1.7 2.7 3.2-.7.5 3.2 3 1.3-1.6 2.8 1.6 2.8-3 1.3-.5 3.2-3.2-.7L12 22.2l-1.7-2.7-3.2.7-.5-3.2-3-1.3L5.2 13 3.6 10.2l3-1.3.5-3.2 3.2.7z"/>' +
        `<circle cx="12" cy="12" r="3.7" fill="${c}"/>`,

    persone: (c) => '<circle cx="8.6" cy="7.4" r="4.3"/>' +
        '<path d="M1.6 20.6c0-3.9 3.1-6.6 7-6.6s7 2.7 7 6.6z"/>' +
        '<circle cx="17.2" cy="8.6" r="3.4" opacity=".92"/>' +
        '<path d="M13.4 20.6c0-3.2 1.9-5.4 4.6-5.4 2.6 0 4.4 2 4.4 5.4z" opacity=".92"/>' +
        `<path d="M13.9 15.6c.9-.3 2-.4 3.3-.4" stroke="${c}" stroke-width="1.2" fill="none"/>`,
    pin: (c) => '<path d="M12 1.6c-4.2 0-7.4 3.2-7.4 7.3 0 5.3 6.4 12.6 6.7 12.9a1 1 0 001.4 0c.3-.3 6.7-7.6 6.7-12.9 0-4.1-3.2-7.3-7.4-7.3z"/>' +
        `<circle cx="12" cy="8.8" r="3.1" fill="${c}"/>`,
    lampadina: (c) => '<path d="M12 1.8a7 7 0 00-4.1 12.7c.7.5 1.1 1.2 1.1 2v.4h6v-.4c0-.8.4-1.5 1.1-2A7 7 0 0012 1.8z"/>' +
        '<rect x="8.8" y="18" width="6.4" height="2.2" rx="1.1"/>' +
        '<rect x="9.6" y="21" width="4.8" height="1.8" rx=".9"/>' +
        `<path d="M10.4 14.6h3.2" stroke="${c}" stroke-width="1.1" fill="none"/>`,
    orologio: (c) => '<circle cx="12" cy="12.4" r="9.6"/>' +
        `<circle cx="12" cy="12.4" r="7.4" fill="${c}"/>` +
        '<rect x="11.2" y="6.6" width="1.7" height="6.6" rx=".85"/>' +
        '<rect x="11.2" y="11.6" width="5.6" height="1.7" rx=".85"/>' +
        '<circle cx="12" cy="12.4" r="1.4"/>'
};

// ── DISEGNO DELLA SFERA ──────────────────────────────────────────────────
let _ballContatore = 0;

// CACHE — indispensabile, non un'ottimizzazione facoltativa:
// renderWidgetHome() rigenera tutto l'innerHTML ogni 15s (polling veloce).
// Senza cache ricostruirebbe 10 SVG completi (5 gradienti + clipPath +
// testo su arco ciascuno) quattro volte al minuto, per sempre, e
// _ballContatore crescerebbe senza limite. L'SVG dipende solo da emblema,
// tema e testo inciso: si rigenera solo quando uno dei tre cambia.
const _ballCache = new Map();

function _ballSvgCache(emblema, coloreWidget, etichetta) {
    const pal = _ballTemaAttivo();
    const chiave = [emblema, _ballPaletteWidget ? coloreWidget : pal.calotta, pal.pancia[0], etichetta || ''].join('|');
    if (!_ballCache.has(chiave)) _ballCache.set(chiave, _ballSvg(emblema, coloreWidget, etichetta));
    return _ballCache.get(chiave);
}
function _ballSvutaCache() { _ballCache.clear(); }

function _ballSvg(emblema, coloreWidget, etichetta) {
    const u = 'b' + (++_ballContatore);
    const emblemaFn = _ballEMBLEMI[emblema] || _ballEMBLEMI.piu;
    const pal = _ballTemaAttivo();
    const colore = _ballPaletteWidget ? (coloreWidget || pal.calotta) : pal.calotta;
    const p = pal.pancia;

    // ── ETICHETTA INCISA ────────────────────────────────────────────────
    // Non è un <div> sovrapposto (piatto su una superficie curva: sembrava
    // un adesivo) ma un <textPath> lungo un arco concentrico alla sfera,
    // raggio 34 su centro (64,70): parte a ore 9, passa sotto il pulsante
    // centrale, risale a ore 3. Sweep-flag 0 = passa SOTTO (con 1 sopra).
    // Finitura incisa: copia chiara spostata di 0.9 in basso = luce nel
    // solco, copia scura sopra = il solco. Nessun rilievo, nessuna ombra.
    // Font Space Grotesk maiuscolo: già caricato dal sito, proporzionale
    // (~40% più stretto di Press Start 2P, quindi entra molto più grande
    // nello stesso arco) e senza discendenti, la forma più leggibile su
    // testo piccolo e curvo. textLength impedisce qualunque sbordo.
    let inciso = '';
    if (etichetta) {
        const testo = String(etichetta).toUpperCase()
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const n = testo.length || 1;
        const arcoUtile = 84;
        const corpoBase = n <= 6 ? 15 : (n <= 9 ? 14 : 13);
        const fs = Math.max(6.5, Math.min(corpoBase, arcoUtile / (n * 0.64)));
        const lung = Math.min(n * fs * 0.64, arcoUtile);
        const comune = `font-family="Space Grotesk, sans-serif" font-weight="700" font-size="${fs.toFixed(2)}" letter-spacing="0.35" text-anchor="middle"`;
        const pathAttr = `href="#arc-${u}" startOffset="50%" textLength="${lung.toFixed(1)}" lengthAdjust="spacingAndGlyphs"`;
        inciso =
            `<defs><path id="arc-${u}" d="M 30 70 A 34 34 0 0 0 98 70" fill="none"/></defs>` +
            '<g class="ball-inciso">' +
                `<text ${comune} fill="${p[0]}" opacity="0.8" transform="translate(0 0.9)"><textPath ${pathAttr}>${testo}</textPath></text>` +
                `<text ${comune} fill="#2b2b33" opacity="0.95"><textPath ${pathAttr}>${testo}</textPath></text>` +
            '</g>';
    }

    return `<svg class="ball-svg" viewBox="${_ballVIEWBOX}">` +
      '<defs>' +
        `<linearGradient id="t-${u}" x1="0.2" y1="0" x2="0.8" y2="1">` +
          `<stop offset="0" stop-color="${_ballSchiarisci(colore, .34)}"/>` +
          `<stop offset="0.55" stop-color="${colore}"/>` +
          `<stop offset="1" stop-color="${_ballScurisci(colore, .3)}"/></linearGradient>` +
        `<linearGradient id="f-${u}" x1="0.3" y1="0" x2="0.7" y2="1">` +
          `<stop offset="0" stop-color="${p[0]}"/><stop offset="0.6" stop-color="${p[1]}"/>` +
          `<stop offset="1" stop-color="${p[2]}"/></linearGradient>` +
        `<radialGradient id="s-${u}" cx="0.33" cy="0.27" r="0.78">` +
          '<stop offset="0" stop-color="#fff" stop-opacity="0.34"/>' +
          '<stop offset="0.45" stop-color="#fff" stop-opacity="0"/>' +
          '<stop offset="0.82" stop-color="#000" stop-opacity="0.1"/>' +
          '<stop offset="1" stop-color="#000" stop-opacity="0.42"/></radialGradient>' +
        `<linearGradient id="r-${u}" x1="0.15" y1="0.1" x2="0.85" y2="0.95">` +
          '<stop offset="0.45" stop-color="#fff" stop-opacity="0"/>' +
          '<stop offset="1" stop-color="#fff" stop-opacity="0.55"/></linearGradient>' +
        `<radialGradient id="p-${u}" cx="0.36" cy="0.32" r="0.75">` +
          `<stop offset="0" stop-color="${p[0]}"/><stop offset="0.7" stop-color="${p[1]}"/>` +
          `<stop offset="1" stop-color="${p[2]}"/></radialGradient>` +
        `<clipPath id="c-${u}"><circle cx="64" cy="70" r="48"/></clipPath>` +
      '</defs>' +
      `<g clip-path="url(#c-${u})">` +
        `<rect x="0" y="0" width="128" height="70" fill="url(#t-${u})"/>` +
        `<rect x="0" y="70" width="128" height="54" fill="url(#f-${u})"/>` +
        '<rect x="0" y="64.7" width="128" height="10.6" fill="#17171a"/>' +
        '<rect x="0" y="65.7" width="128" height="2" fill="#fff" opacity="0.13"/>' +
        '<g transform="translate(64 43.5) scale(1.42) translate(-12 -12)" fill="#ffffff" opacity="0.97">' +
          emblemaFn(colore) +
        '</g>' +
        `<circle cx="64" cy="70" r="48" fill="url(#s-${u})"/>` +
        '<ellipse cx="42" cy="41" rx="13.5" ry="7.5" transform="rotate(-34 42 41)" fill="#fff" opacity="0.26"/>' +
        '<circle cx="33" cy="53" r="3.2" fill="#fff" opacity="0.22"/>' +
        `<circle cx="64" cy="70" r="44" fill="none" stroke="url(#r-${u})" stroke-width="5"/>` +
      '</g>' +
      '<circle cx="64" cy="70" r="48" fill="none" stroke="#141416" stroke-width="3.6"/>' +
      inciso +
      '<circle cx="64" cy="70" r="13.5" fill="#17171a"/>' +
      `<circle cx="64" cy="70" r="10" fill="url(#p-${u})"/>` +
      '<circle class="btn-flash" cx="64" cy="70" r="10" fill="#ff2d20" opacity="0"/>' +
      '<circle cx="60.7" cy="66.7" r="2.9" fill="#fff" opacity="0.85"/>' +
      '<circle class="ball-flash" cx="64" cy="70" r="48" fill="#fff" opacity="0"/>' +
    '</svg>';
}

// ── PARTICELLE DELLA CATTURA ─────────────────────────────────────────────
const _ballSTELLE = [
    { top: 10, left: 5,  size: 11, color: '#F2C230', dx: -22, dy: -20, ritardo: 0 },
    { top: 6,  left: 77, size: 9,  color: '#ffffff', dx:  22, dy: -18, ritardo: 70 },
    { top: 70, left: 2,  size: 9,  color: '#ffffff', dx: -20, dy:  20, ritardo: 45 },
    { top: 74, left: 79, size: 12, color: '#F2C230', dx:  21, dy:  21, ritardo: 100 }
];
const _ballCORIANDOLI = [
    { size: 4, color: '#D4342C', dx: -26, dy: -22, ritardo: 0 },
    { size: 3, color: '#3B7DD8', dx:  24, dy: -26, ritardo: 40 },
    { size: 5, color: '#F2C230', dx:  30, dy:   6, ritardo: 20 },
    { size: 3, color: '#639922', dx: -30, dy:   8, ritardo: 60 },
    { size: 4, color: '#D6538F', dx:  12, dy:  28, ritardo: 80 },
    { size: 3, color: '#ffffff', dx: -14, dy:  30, ritardo: 30 }
];

function _ballParticelle() {
    let out = '';
    _ballSTELLE.forEach(s => {
        out += `<span class="pkdx-star" style="top:${s.top}%; left:${s.left}%; width:${s.size}px; height:${s.size}px; background:${s.color};"></span>`;
    });
    _ballCORIANDOLI.forEach(s => {
        out += `<span class="pkdx-conf" style="top:56.25%; left:50%; margin:${-s.size/2}px 0 0 ${-s.size/2}px; width:${s.size}px; height:${s.size}px; background:${s.color};"></span>`;
    });
    return out;
}

// ── TITOLI BREVI PER L'INCISIONE ─────────────────────────────────────────
// L'arco della pancia regge ~84 unità: "Visualizzazione" (15 caratteri) ci
// starebbe solo a un corpo illeggibile. Il titolo per esteso resta quello
// vero del catalogo e ricompare su 2x1/1x2/2x2, dove il testo sta fuori.
const _ballTITOLI_BREVI = {
    variazione_valore: 'Variazione',
    primo_piano: 'In vetrina',
    carte_recenti: 'Recenti',
    prezzi_recenti: 'Controlli',
    visualizzazione: 'Visualizza',
    inserimento: 'Inserisci',
    prezzi: 'Prezzi',
    binder: 'Binders',
    sealed: 'Sealed',
    ultima_carta: 'Preferita',
    carta_del_giorno: 'Del giorno',
    gruppo_attivo: 'Gruppo',
    location: 'Location',
    suggerimento: 'Da fare',
    orologio: 'Orologio',
    aggiungi_carta: 'Aggiungi',
    condividi: 'Condividi',
    match: 'Match',
    estensione: 'Estensione',
    valore_collezione: 'Valore',
    doppioni: 'Doppioni',
    wishlist_obiettivi: 'Wishlist',
    traguardi: 'Traguardi',
    lingue: 'Lingue',
    set_completamento: 'Set',
    bustina: 'Bustina',
    polvere: 'Polvere',
    missioni: 'Missioni'
};

// ── EMBLEMA + COLORE PER OGNI WIDGET ─────────────────────────────────────
// Il colore serve solo al tema futuro "ball colorate": oggi la calotta la
// decide _ballTemaAttivo().
const _ballASPETTO = {
    // Blocchi della home fissa diventati widget (2026-09-03). Emblemi
    // scelti fra quelli gia' disegnati, nessun disegno nuovo:
    // 'album' per la vetrina delle carte in primo piano, 'piu' per le
    // ultime aggiunte, 'orologio' per i prezzi controllati di recente.
    variazione_valore:{ emblema: 'monete',      colore: '#3FA45B' },
    primo_piano:      { emblema: 'album',       colore: '#D4A017' },
    carte_recenti:    { emblema: 'piu',         colore: '#3B7DD8' },
    prezzi_recenti:   { emblema: 'orologio',    colore: '#F2C230' },
    visualizzazione:  { emblema: 'carte',       colore: '#3B7DD8' },
    inserimento:      { emblema: 'piu',         colore: '#D4342C' },
    prezzi:           { emblema: 'monete',      colore: '#F2C230' },
    binder:           { emblema: 'album',       colore: '#7F77DD' },
    sealed:           { emblema: 'regalo',      colore: '#D6538F' },
    ultima_carta:     { emblema: 'carte',       colore: '#4EA9A4' },
    carta_del_giorno: { emblema: 'polvere',     colore: '#E8763C' },
    gruppo_attivo:    { emblema: 'persone',     colore: '#5AA8D8' },
    location:         { emblema: 'pin',         colore: '#639922' },
    suggerimento:     { emblema: 'lampadina',   colore: '#F2C230' },
    orologio:         { emblema: 'orologio',    colore: '#8A8A93' },
    aggiungi_carta:   { emblema: 'piu',         colore: '#639922' },
    condividi:        { emblema: 'scambio',     colore: '#4B9AA6' },
    match:            { emblema: 'cuore',       colore: '#D6538F' },
    estensione:       { emblema: 'ingranaggio', colore: '#7A7F8A' },
    // Widget nuovi
    valore_collezione:{ emblema: 'monete',      colore: '#C8892B' },
    doppioni:         { emblema: 'carte',       colore: '#8A6FD0' },
    wishlist_obiettivi:{ emblema: 'cuore',      colore: '#D6538F' },
    traguardi:        { emblema: 'polvere',     colore: '#F2C230' },
    lingue:           { emblema: 'album',       colore: '#4B9AA6' },
    set_completamento:{ emblema: 'carte',       colore: '#3B7DD8' },
    // Segnaposto gacha: emblemi già scelti, si accenderanno con il sistema
    bustina:          { emblema: 'bustina',     colore: '#D6538F' },
    polvere:          { emblema: 'polvere',     colore: '#7F77DD' },
    missioni:         { emblema: 'regalo',      colore: '#639922' }
};

// Il testo inciso è stretto: teniamo le prime parole, il resto lo dice la
// pagina che si apre toccando.
function _ballAccorcia(testo) {
    if (!testo) return '';
    if (testo.length <= 12) return testo;
    const parole = String(testo).split(' ');
    let out = '';
    for (const parola of parole) {
        if ((out + ' ' + parola).trim().length > 12) break;
        out = (out + ' ' + parola).trim();
    }
    return out || String(testo).slice(0, 12);
}

// ── ANIMAZIONE DI CATTURA ────────────────────────────────────────────────
function _ballFotogrammiScosse() {
    const a = _ballAMPIEZZA;
    const r = (g) => `rotate(${g}deg)`;
    return [
        { transform: r(0), offset: 0 }, { transform: r(0), offset: 0.06 },
        { transform: r(-a[0]), offset: 0.12 }, { transform: r(0), offset: 0.18 },
        { transform: r(a[0]), offset: 0.24 }, { transform: r(0), offset: 0.30 },
        { transform: r(0), offset: 0.38 },
        { transform: r(a[1]), offset: 0.44 }, { transform: r(0), offset: 0.50 },
        { transform: r(-a[1]), offset: 0.56 }, { transform: r(0), offset: 0.62 },
        { transform: r(0), offset: 0.70 },
        { transform: r(-a[2]), offset: 0.76 }, { transform: r(0), offset: 0.82 },
        { transform: r(a[2]), offset: 0.88 }, { transform: r(0), offset: 0.94 },
        { transform: r(0), offset: 1 }
    ];
}

const _ballLAMPEGGI = [
    { opacity: 0, offset: 0 }, { opacity: 0, offset: 0.27 }, { opacity: 1, offset: 0.31 },
    { opacity: 0, offset: 0.37 }, { opacity: 0, offset: 0.59 }, { opacity: 1, offset: 0.63 },
    { opacity: 0, offset: 0.69 }, { opacity: 0, offset: 0.91 }, { opacity: 1, offset: 0.95 },
    { opacity: 0, offset: 1 }
];

function _ballAttendi(ms) { return new Promise(r => setTimeout(r, ms)); }
function _ballAnimaFinito(el, f, o) {
    const a = el.animate(f, o);
    return a.finished || new Promise(r => { a.onfinish = r; });
}

// Vera o falsa a seconda delle due preferenze: "spegni tutto" vince su
// "spegni solo la cattura".
function _ballAnimazioniAttive() { return prefAnimWidgetGet(); }
function _ballCatturaAttiva() { return prefAnimWidgetGet() && prefAnimCatturaGet(); }

async function _ballGiocaCattura(tile) {
    if (!_ballCatturaAttiva()) return;

    const ball = tile.querySelector('.pkdx-ball');

    // Widget con miniatura carta al posto della ball (Ultima carta, Carta
    // del giorno): non c'è sfera da scuotere, ma il tocco non deve sembrare
    // morto — un piccolo scatto sulla carta e via.
    if (!ball) {
        const thumb = tile.querySelector('.widget-tile-thumb');
        if (!thumb) return;
        await _ballAnimaFinito(thumb, [
            { transform: 'scale(1) rotate(0deg)' },
            { transform: 'scale(1.12) rotate(-4deg)', offset: 0.35 },
            { transform: 'scale(1.06) rotate(3deg)', offset: 0.65 },
            { transform: 'scale(1) rotate(0deg)' }
        ], { duration: 420, easing: 'cubic-bezier(.3,.8,.35,1)' });
        return;
    }

    const body   = ball.querySelector('.pkdx-ball-body');
    const glow   = ball.querySelector('.pkdx-ball-glow');
    const dust   = ball.querySelector('.pkdx-dust');
    const shadow = ball.querySelector('.ball-shadow');
    const sweep  = ball.querySelector('.ball-sweep');
    const flash  = ball.querySelector('.ball-flash');
    const btn    = ball.querySelector('.btn-flash');
    const rings  = ball.querySelectorAll('.pkdx-lock-ring');
    const stars  = ball.querySelectorAll('.pkdx-star');
    const confs  = ball.querySelectorAll('.pkdx-conf');
    if (!body || !shadow) return;

    const lato = ball.offsetWidth || 90;
    const k = lato / 112;
    const spazioSopra = ball.getBoundingClientRect().top - tile.getBoundingClientRect().top;
    const salto = Math.max(4, Math.min(lato * 0.23, spazioSopra - 2));

    shadow.animate([
        { transform: 'scale(.5, .6)', opacity: 0.1 },
        { transform: 'scale(1.3, 1)', opacity: 0.34, offset: 0.55 },
        { transform: 'scale(1, 1)', opacity: 0.26 }
    ], { duration: _ballTEMPI.lancio, easing: 'cubic-bezier(.3,.7,.4,1)' });

    if (dust) dust.animate([
        { opacity: 0, transform: 'scale(.4)', offset: 0 },
        { opacity: 0, transform: 'scale(.4)', offset: 0.5 },
        { opacity: 0.8, transform: 'scale(.7)', offset: 0.62 },
        { opacity: 0, transform: 'scale(1.5)' }
    ], { duration: _ballTEMPI.lancio + 160, easing: 'ease-out' });

    await _ballAnimaFinito(body, [
        { transform: `translateY(${-salto}px) scale(.94, 1.06)` },
        { transform: 'translateY(0) scale(1.1, .9)', offset: 0.5 },
        { transform: `translateY(${-salto*0.2}px) scale(.97, 1.03)`, offset: 0.74 },
        { transform: 'translateY(0) scale(1, 1)' }
    ], { duration: _ballTEMPI.lancio, easing: 'cubic-bezier(.35,.65,.35,1)' });

    _vibraSeSupportato([18, 320, 18, 320, 18]);
    if (glow) glow.animate(_ballLAMPEGGI, { duration: _ballTEMPI.scosse, easing: 'linear' });
    if (btn) btn.animate(_ballLAMPEGGI, { duration: _ballTEMPI.scosse, easing: 'linear' });

    shadow.animate([
        { transform: 'translateX(0) scaleX(1)' },
        { transform: `translateX(${2.5*k}px) scaleX(.86)`, offset: .12 },
        { transform: 'translateX(0) scaleX(1)', offset: .18 },
        { transform: `translateX(${-2.5*k}px) scaleX(.86)`, offset: .24 },
        { transform: 'translateX(0) scaleX(1)', offset: .30 },
        { transform: `translateX(${-2*k}px) scaleX(.9)`, offset: .44 },
        { transform: 'translateX(0) scaleX(1)', offset: .50 },
        { transform: `translateX(${2*k}px) scaleX(.9)`, offset: .56 },
        { transform: 'translateX(0) scaleX(1)', offset: .62 },
        { transform: `translateX(${1.4*k}px) scaleX(.94)`, offset: .76 },
        { transform: `translateX(${-1.4*k}px) scaleX(.94)`, offset: .88 },
        { transform: 'translateX(0) scaleX(1)' }
    ], { duration: _ballTEMPI.scosse, easing: 'ease-in-out' });

    await _ballAnimaFinito(body, _ballFotogrammiScosse(), { duration: _ballTEMPI.scosse, easing: 'ease-in-out' });

    _vibraSeSupportato(20);
    if (flash) flash.animate([{ opacity: 0 }, { opacity: 0.9, offset: 0.12 }, { opacity: 0 }],
        { duration: _ballTEMPI.click, easing: 'ease-out' });

    if (sweep) sweep.animate([
        { opacity: 0, transform: 'rotate(18deg) translateX(0px)' },
        { opacity: 1, transform: `rotate(18deg) translateX(${50*k}px)`, offset: 0.4 },
        { opacity: 0, transform: `rotate(18deg) translateX(${130*k}px)` }
    ], { duration: _ballTEMPI.click, delay: 60, easing: 'cubic-bezier(.2,.7,.3,1)' });

    rings.forEach((anello, r) => {
        anello.animate([
            { opacity: 0.95, transform: 'scale(.7)' },
            { opacity: 0, transform: `scale(${1.7 + r*0.35})` }
        ], { duration: _ballTEMPI.click, delay: r*90, easing: 'ease-out' });
    });

    stars.forEach((stella, i) => {
        const s = _ballSTELLE[i]; if (!s) return;
        const sx = s.dx * k * 2.4, sy = s.dy * k * 2.4;
        stella.animate([
            { opacity: 0, transform: 'scale(.2) rotate(0deg) translate(0px,0px)' },
            { opacity: 1, transform: `scale(1.1) rotate(45deg) translate(${sx*0.35}px,${sy*0.35}px)`, offset: 0.3 },
            { opacity: 0, transform: `scale(.4) rotate(120deg) translate(${sx}px,${sy}px)` }
        ], { duration: _ballTEMPI.click, delay: s.ritardo, easing: 'ease-out' });
    });

    confs.forEach((conf, j) => {
        const c = _ballCORIANDOLI[j]; if (!c) return;
        const cx = c.dx * k * 2.4, cy = c.dy * k * 2.4;
        conf.animate([
            { opacity: 0, transform: 'scale(.4) translate(0px,0px)' },
            { opacity: 1, transform: `scale(1) translate(${cx*0.4}px,${cy*0.4}px)`, offset: 0.25 },
            { opacity: 0, transform: `scale(.7) translate(${cx}px,${cy+12*k}px)` }
        ], { duration: _ballTEMPI.click + 120, delay: c.ritardo, easing: 'cubic-bezier(.2,.6,.4,1)' });
    });

    await _ballAnimaFinito(ball, [
        { transform: 'scale(1)' }, { transform: 'scale(1.16)', offset: 0.2 },
        { transform: 'scale(.97)', offset: 0.55 }, { transform: 'scale(1)' }
    ], { duration: _ballTEMPI.click, easing: 'cubic-bezier(.2,.8,.3,1)' });

    await _ballAttendi(70);
}

// ── SEMAFORO ─────────────────────────────────────────────────────────────
// Una ball si scuote e mostra i punti esclamativi solo se quel widget ha
// davvero qualcosa da fare. Il movimento È la notifica.
// Quali widget: quelli il cui preview() restituisce stato 'allerta', più
// Match (novità) ed Estensione (non rilevata) — vedi _ballChiedeAttenzione.
function _ballMostraAvviso(ball, forte, durata) {
    if (!ball) return;
    const segni = ball.querySelectorAll('.pkdx-avviso i');
    if (!segni.length) return;
    const quali = forte ? [0, 1, 2] : [1];
    const ritardi = forte ? [90, 0, 150] : [0];
    quali.forEach((idx, k) => {
        segni[idx].animate([
            { opacity: 0, transform: 'translateY(35%) scale(.3)' },
            { opacity: 1, transform: 'translateY(-12%) scale(1.18)', offset: .2 },
            { opacity: 1, transform: 'translateY(0) scale(1)', offset: .34 },
            { opacity: 1, transform: 'translateY(0) scale(1)', offset: .68 },
            { opacity: 0, transform: 'translateY(-30%) scale(.8)' }
        ], { duration: durata + 320, delay: ritardi[k], easing: 'cubic-bezier(.25,.9,.35,1)' });
    });
}

function _ballScuoti(body, forte) {
    if (!body) return;
    const a = forte ? 9 : 5;
    _ballMostraAvviso(body.parentNode, forte, forte ? 900 : 750);

    const ombra = body.parentNode && body.parentNode.querySelector('.ball-shadow');
    if (ombra) ombra.animate([
        { transform: 'translateX(0) scaleX(1)' },
        { transform: `translateX(${a*0.22}px) scaleX(.9)`, offset: .25 },
        { transform: `translateX(${-a*0.2}px) scaleX(.92)`, offset: .55 },
        { transform: 'translateX(0) scaleX(1)' }
    ], { duration: forte ? 900 : 750, easing: 'ease-in-out' });

    body.animate([
        { transform: 'rotate(0deg)' },
        { transform: `rotate(${-a}deg)`, offset: .25 },
        { transform: `rotate(${a * .9}deg)`, offset: .55 },
        { transform: `rotate(${-a * .4}deg)`, offset: .8 },
        { transform: 'rotate(0deg)' }
    ], { duration: forte ? 900 : 750, easing: 'ease-in-out' });
}

function _ballAccendiAlone(tile, forte) {
    const alone = tile.querySelector('.tile-alone');
    if (!alone) return;
    alone.animate([
        { opacity: 0 }, { opacity: forte ? .5 : .3, offset: .3 }, { opacity: 0 }
    ], { duration: forte ? 1100 : 900, easing: 'ease-in-out' });
}

// null = ferma, 'forte' = tre punti esclamativi, 'normale' = uno.
// Legge SOLO l'anteprima già calcolata dal render (nessuna query nuova).
function _ballChiedeAttenzione(id, anteprima) {
    if (!anteprima) return null;
    if (id === 'match') return (anteprima.stato === 'ok' && /[1-9]/.test(anteprima.righe[0] || '')) ? 'forte' : null;
    if (id === 'estensione') return anteprima.rilevata === false ? 'normale' : null;
    if (anteprima.stato !== 'allerta') return null;
    return (id === 'inserimento' || id === 'prezzi') ? 'forte' : 'normale';
}

// Stato di attenzione dell'ultimo render, riempito da renderWidgetHome().
let _ballAttenzioni = {};
const _BALL_INTERVALLO_SEMAFORO_MS = 5200;
let _ballSemaforoInterval = null;

function _ballGiraSemaforo() {
    if (!BALL_ATTIVA || !_ballAnimazioniAttive()) return;
    if (_editModeWidget || document.body.classList.contains('phone-detail-open')) return;

    let ritardo = 0;
    Object.keys(_ballAttenzioni).forEach(id => {
        const livello = _ballAttenzioni[id];
        if (!livello) return;
        const tile = document.querySelector(`.widget-tile[data-widget-id="${id}"]`);
        if (!tile) return;
        const forte = livello === 'forte';
        setTimeout(() => {
            _ballScuoti(tile.querySelector('.pkdx-ball-body'), forte);
            _ballAccendiAlone(tile, forte);
        }, ritardo);
        ritardo += 260;
    });
}

function _ballAvviaSemaforo() {
    if (_ballSemaforoInterval) clearInterval(_ballSemaforoInterval);
    _ballSemaforoInterval = setInterval(_ballGiraSemaforo, _BALL_INTERVALLO_SEMAFORO_MS);
}

// Il tema si cambia da Impostazioni con funzioni che vivono in altri file
// (setSiteTheme/toggleDarkMode, mai lette in questa sessione): invece di
// modificarle, guardiamo le classi del <body>. Se cambiano, le ball vanno
// ridisegnate — i gradienti sono scritti dentro l'SVG, una variabile CSS
// non basterebbe.
function _ballOsservaTema() {
    if (!window.MutationObserver) return;
    // Solo queste tre classi cambiano l'aspetto delle sfere. Guardare
    // l'intera className farebbe ridisegnare tutto anche per classi che non
    // c'entrano nulla — per esempio 'senza-anim-widget', che aggiungiamo noi
    // stessi e provocherebbe un secondo render inutile.
    const rilevanti = ['dark-mode', 'theme-verde', 'theme-pokemon'];
    const leggi = () => rilevanti.filter(c => document.body.classList.contains(c)).join(',');
    let ultimo = leggi();
    new MutationObserver(() => {
        const ora = leggi();
        if (ora === ultimo) return;
        ultimo = ora;
        _ballSvutaCache();
        renderWidgetHome();
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
}

// ── TOGGLE DELLE IMPOSTAZIONI ────────────────────────────────────────────
// Chiamate dai quattro interruttori in index.html (sezione Impostazioni).
function toggleAnimWidget(attive) {
    prefAnimWidgetSet(attive);
    const riga = document.getElementById('rigaAnimCattura');
    if (riga) riga.style.opacity = attive ? '1' : '0.45';
    _ballApplicaClasseAnimazioni();
    renderWidgetHome();
}

// Con le animazioni spente non deve restare NIENTE che si muova da solo:
// cattura e semaforo li fermano già le due funzioni _ballAnimazioni*, ma il
// riflesso olografico delle miniature è puro CSS e va fermato da qui.
function _ballApplicaClasseAnimazioni() {
    document.body.classList.toggle('senza-anim-widget', !prefAnimWidgetGet());
}
function toggleAnimCattura(attiva) { prefAnimCatturaSet(attiva); }
function toggleScritteBall(attive) { prefScritteBallSet(attive); _ballSvutaCache(); renderWidgetHome(); }
function toggleBadgeWidget(attivo) { prefBadgeWidgetSet(attivo); renderWidgetHome(); }

function _ballSincronizzaToggleImpostazioni() {
    const coppie = [
        ['chkAnimWidget', prefAnimWidgetGet()],
        ['chkAnimCattura', prefAnimCatturaGet()],
        ['chkScritteBall', prefScritteBallGet()],
        ['chkBadgeWidget', prefBadgeWidgetGet()]
    ];
    coppie.forEach(([id, valore]) => {
        const el = document.getElementById(id);
        if (el) el.checked = valore;
    });
    const riga = document.getElementById('rigaAnimCattura');
    if (riga) riga.style.opacity = prefAnimWidgetGet() ? '1' : '0.45';
}


// ═══════════════════════════════════════════════════════════════════════
// CONTENUTI DELLE TESSERE GRANDI (sessione 2026-08-27, seconda parte)
// ═══════════════════════════════════════════════════════════════════════
// Su 1x1 la tessera è la sola sfera col titolo inciso. Sulle taglie grandi
// (2x1, 1x2, 2x2) c'era finora lo stesso identico contenuto della 1x1 —
// titolo e una riga di testo — quindi il quadruplo dello spazio non diceva
// niente di più. Qui ogni widget disegna il proprio contenuto.
//
// DUE SLOT, come nella demo di Opus:
//   inline → accanto alla sfera, riga superiore. C'è su tutte le taglie
//            grandi, deve stare stretto (su 2x1 è l'unico spazio).
//   blocco → sotto, per intero. Solo dove c'è altezza: 1x2 e 2x2.
//
// Scelta (Claudio: "come secondo te è meglio"): sulle taglie grandi la
// grafica SOSTITUISCE le righe di testo. Ripetere "7 da aggiornare" sotto
// una barra che dice già quello è la stessa informazione due volte, e ruba
// lo spazio che serve alla grafica. Il titolo resta.
//
// PER ORA solo quattro widget (Claudio: "facciamone 4 per volta"): Prezzi,
// Visualizzazione, Location, Match. Tutti gli altri ricadono su _ballCorpoGenerico,
// che mostra le righe di testo di sempre: nessuna regressione.
//
// ZERO QUERY NUOVE: tutto ciò che serve è già in memoria (carteReali,
// _elencoPrezziScaduti, _numNuoviMatch*). I preview() sono stati estesi con
// un campo 'dati' AGGIUNTIVO — le 'righe' restano identiche, così le
// tessere piccole e il semaforo continuano a funzionare come prima.

// Righe cliccabili dentro la tessera (Claudio: "lo voglio").
// Attenzione a tre cose, tutte gestite qui:
//   - stopPropagation, o il tocco farebbe partire ANCHE la cattura da 2,6s
//     e l'apertura del widget;
//   - in modalità modifica non deve fare nulla: lì si trascina e si ridimensiona;
//   - le azioni chiamano solo funzioni VERIFICATE nei file reali:
//       apriFlipCardHome(id)          → ui/home.ui.js
//       apriModalePrezziScaduti()     → ui/prices.ui.js r.212
//       filterTable() + #filterLocation → ui/cards.ui.js r.803-833
//     ognuna protetta da un typeof: se un domani sparisse, la riga smette
//     di funzionare ma non butta giù la home.
function _ballAzioneRiga(evt, tipo, valore, origine) {
    if (evt) evt.stopPropagation();
    if (_editModeWidget) return;
    _vibraSeSupportato(8);
    switch (tipo) {
        case 'carta':
            // Missioni #39/#83 (2026-08-30): origine propagata per distinguere
            // "apertura da lista top-valore" (valore_collezione) da qualunque
            // altra apertura — vedi ui/home.ui.js:apriFlipCardHome().
            if (typeof apriFlipCardHome === 'function') apriFlipCardHome(valore, origine ? { origine } : {});
            break;

        case 'tab':
            apriDettaglioWidget(valore, evt);
            break;

        // Elenco completo delle carte con prezzo da aggiornare: esiste già
        // come modale nel sito, con nomi, codici e data dell'ultimo
        // controllo. Non apriamo la sezione Prezzi: la modale dice di più
        // ed è esattamente ciò che serve dopo aver toccato quella riga.
        case 'prezzi-scaduti':
            if (typeof apriModalePrezziScaduti === 'function') apriModalePrezziScaduti();
            else apriDettaglioWidget('prezzi', evt);
            break;

        // Location: apre Visualizzazione GIÀ FILTRATA su quella posizione.
        // filterTable() legge il valore dalla tendina #filterLocation
        // (popolata da caricaCarteReali con le location realmente presenti),
        // quindi il filtro si imposta scrivendo lì e richiamandola.
        // Il filtro va applicato DOPO l'apertura: switchTab ridisegna la
        // sezione, e farlo prima verrebbe sovrascritto.
        case 'location':
            apriDettaglioWidget('visualizzazione', evt);
            setTimeout(() => {
                const select = document.getElementById('filterLocation');
                if (!select || typeof filterTable !== 'function') return;
                // Se quella location non è tra le opzioni (dato cambiato nel
                // frattempo), meglio non filtrare che filtrare a vuoto
                // lasciando una tabella misteriosamente deserta.
                const esiste = Array.from(select.options).some(o => o.value === valore);
                if (!esiste) return;
                select.value = valore;
                filterTable();
            }, 60);
            break;
    }
}

// ── MINIATURA DI UNA CARTA ───────────────────────────────────────────────
// Ricalcata su miniCarta() del mockup (cardsync.js r.516): rettangolo con
// gradiente, una barra chiara in alto al posto dell'illustrazione e una
// sottile in basso al posto del testo, angoli morbidi e ombra leggera.
//
// DIFFERENZA VOLUTA dal mockup: lì le carte erano finte, qui esistono
// davvero. Quando c'è l'immagine la mostriamo — vale più di un rettangolo
// colorato — e il disegno di Opus resta come RIPIEGO per le carte senza
// immagine, dove finora c'era un'icona grigia.
//
// Il colore del ripiego non è casuale ad ogni render: è derivato dal nome
// della carta, così la stessa carta ha sempre la sua tinta e la striscia
// non "sfarfalla" ad ogni giro di polling.
function _ballTintaDaNome(nome) {
    let h = 0;
    const t = String(nome || '');
    for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 360;
    return `hsl(${h}, 52%, 58%)`;
}

function _ballMiniCarta(c, badge, origine) {
    const titolo = String(c.nome || '').replace(/"/g, '&quot;');
    const clic = `onclick="_ballAzioneRiga(event,'carta','${c.id}','${origine || ''}')"`;
    const badgeHtml = badge ? `<b class="ball-mini-badge">${badge}</b>` : '';

    // Holo scorrevole: nel mockup segnala le carte speciali. Qui dipende dal
    // campo 'rarita', che al 27/08/2026 NON esiste nello schema (verificato
    // in sessione precedente su information_schema.columns) — quindi oggi
    // non si accende su nulla e non costa niente. Se un giorno il campo
    // arriverà, si accenderà da solo sulle carte rare.
    const speciale = c.rarita && /rara|ultra|secret|holo/i.test(String(c.rarita));
    const classi = 'ball-mini' + (speciale ? ' holo' : '');

    if (c.immagine) {
        const url = _urlImmagineVisualizzabile(c.immagine, 96) || '';
        // Se l'immagine non carica, resta visibile il ripiego disegnato che
        // sta sotto: nessun buco grigio.
        return `<span class="${classi}" style="background:linear-gradient(150deg, ${_ballTintaDaNome(c.nome)}, rgba(0,0,0,.35))" title="${titolo}" ${clic}>
                    <i></i><u></u>
                    <img src="${url}" alt="" onerror="this.remove();">
                    ${badgeHtml}
                </span>`;
    }
    return `<span class="${classi}" style="background:linear-gradient(150deg, ${_ballTintaDaNome(c.nome)}, rgba(0,0,0,.35))" title="${titolo}" ${clic}><i></i><u></u>${badgeHtml}</span>`;
}

// ── COMPONENTI VISIVI, ricalcati dal mockup ──────────────────────────────
// Tipografia e componenti vengono da cardsync.css: k-tit (titolo), k-big
// (dato principale, 25px), k-mid, k-lab (etichetta piccola), pill, barra,
// riga, sparkline, stat-griglia, pulsante azione.
//
// NOMI PREFISSATI: nel mockup si chiamano .riga, .nome, .dato, .pill,
// .stat, .azione — nomi generici che nel CSS globale del sito sono GIÀ
// usati 17 volte. Prefissati con ball- mantenendo proprietà identiche.

// Sparkline SVG, identica a sparkline() del mockup (cardsync.js r.522):
// area sfumata sotto e linea sopra, tracciato normalizzato su min/max.
function _ballSparkline(serie, colore) {
    if (!serie || serie.length < 2) return '';
    const min = Math.min(...serie), max = Math.max(...serie);
    const span = (max - min) || 1;
    const punti = serie.map((v, i) => {
        const x = (i / (serie.length - 1)) * 100;
        const y = 30 - ((v - min) / span) * 26;
        return x.toFixed(1) + ',' + y.toFixed(1);
    });
    return `<svg class="ball-spark" viewBox="0 0 100 34" preserveAspectRatio="none">
        <polygon points="0,34 ${punti.join(' ')} 100,34" fill="${colore}" opacity=".16"/>
        <polyline points="${punti.join(' ')}" fill="none" stroke="${colore}" stroke-width="2.4"
                  stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    </svg>`;
}

// Riga con barra di avanzamento (come il corpo 'set' del mockup).
function _ballRigaBarra(nome, dato, percento, azione) {
    const p = Math.max(0, Math.min(100, percento));
    const clic = azione ? ` onclick="${azione}" class="ball-riga-set ball-clic"` : ' class="ball-riga-set"';
    return `<div${clic}>
        <div class="ball-riga"><span class="ball-nome">${nome}</span><span class="ball-dato">${dato}</span></div>
        <div class="ball-barra-out"><div class="ball-barra-in" style="width:${p}%"></div></div>
    </div>`;
}

// Riga semplice nome + valore/i.
function _ballRiga(nome, ...dati) {
    return `<div class="ball-riga">
        <span class="ball-nome">${nome}</span>
        ${dati.map(d => `<span class="ball-dato">${d}</span>`).join('')}
    </div>`;
}

// Corpo dei widget non ancora collegati (gacha): niente numeri finti, solo
// una riga che dice cosa arriverà. Ricalcato sullo stato "vuoto" del
// mockup, che trattava il primo giorno come un momento importante invece
// che come un errore.
function _ballCorpoSegnaposto(titolo, d) {
    return {
        inline:
            `<p class="ball-k-tit">${titolo}</p>` +
            '<div class="ball-k-mid ball-attesa">In arrivo</div>' +
            `<span class="ball-k-lab">${(d && d.testo) || ''}</span>`,
        blocco: ''
    };
}

function _ballPill(testo, acceso) {
    return `<span class="ball-pill${acceso ? ' acceso' : ''}">${testo}</span>`;
}

function _ballPulsante(testo, azione) {
    return `<button type="button" class="ball-azione" onclick="${azione}">${testo}</button>`;
}

// ── I QUATTRO CORPI ──────────────────────────────────────────────────────
// ── CORPI DEI TRE WIDGET NATI DALLA HOME FISSA (2026-09-03) ─────────────
// Claudio, vedendo la prima versione: "non assomigliano per niente a cio'
// che ho in home e quindi non mi servono a sostituirla". Aveva ragione: i
// widget non definivano un corpo, quindi _ballCorpoWidget ripiegava su
// _ballCorpoGenerico (tre righe di testo accanto alla sfera). Qui i corpi
// ricostruiscono davvero i blocchi della home fissa, con gli stessi
// mattoni gia' usati dagli altri widget: _ballMiniCarta per le miniature,
// .ball-strip per le file di carte, .ball-riga per gli elenchi.
//
// COME SI COMPORTANO ALLE VARIE TAGLIE: 'inline' sta accanto alla sfera e
// si vede sempre; 'blocco' sta sotto e il CSS ne mostra sempre meno man
// mano che la tessera si abbassa (vedi .wf-largo .ball-slot-blocco). Quindi
// le tre categorie complete si vedono sulle taglie alte, mentre su una
// tessera bassa resta la prima. Nessun controllo di taglia da scrivere qui.
function _ballFilaCarte(titolo, carte, origine) {
    if (!carte || !carte.length) return '';
    // Titolo e fila avvolti insieme: dentro .ball-gruppi ogni figlio e'
    // una colonna, quindi senza questo involucro il titolo finirebbe in
    // una colonna e le sue carte in quella accanto.
    return '<div class="ball-gruppo">' +
        `<span class="ball-k-lab">${titolo}</span>` +
        '<div class="ball-strip">' + carte.map(c => _ballMiniCarta(c, undefined, origine)).join('') + '</div>' +
        '</div>';
}

function _ballElencoRighe(voci) {
    if (!voci || !voci.length) return '';
    return voci.map(v => `
        <div class="ball-riga ball-clic" onclick="_ballAzioneRiga(event,'carta','${String(v.id).replace(/'/g, "\\'")}','${v.origine || ''}')">
            <span class="ball-nome">${v.nome}</span><span class="ball-dato">${v.dato}</span>
        </div>`).join('');
}

const _ballCORPI = {
    // La frase che Claudio voleva leggere: "valore salito di 45 euro,
    // aggiunte tre carte ieri dal valore complessivo di 43 euro". La
    // scomposizione arriva gia' pronta da storicoValoreConfronta().
    variazione_valore: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const eur = (v) => '€ ' + Math.abs(Number(v) || 0).toFixed(2);
        const segno = (v) => (Number(v) >= 0 ? '+' : '−');

        if (d.soloUnGiorno) {
            return {
                inline: `<div class="ball-k-big ball-k-mono">${eur(d.valore)}</div>` +
                        '<span class="ball-k-lab">primo giorno misurato</span>',
                blocco: '<span class="ball-k-lab ball-attesa">La variazione compare domani, quando ci sara' + "'" + ' un secondo giorno da confrontare.</span>',
            };
        }

        const colore = d.variazione >= 0 ? 'var(--success)' : 'var(--danger)';
        const inline =
            `<div class="ball-k-big ball-k-mono" style="color:${colore}">${segno(d.variazione)}${eur(d.variazione)}</div>` +
            `<span class="ball-k-lab">${eur(d.valoreOggi)} in totale</span>`;

        // Le due voci della scomposizione. Compaiono solo se hanno
        // qualcosa da dire: una riga "acquisti: 0,00" e' rumore.
        const voci = [];
        if (d.carteAggiunte > 0) {
            voci.push(`<div class="ball-riga">
                <span class="ball-nome">${d.carteAggiunte} cart${d.carteAggiunte === 1 ? 'a aggiunta' : 'e aggiunte'}</span>
                <span class="ball-dato">${segno(d.daAggiunte)}${eur(d.daAggiunte)}</span>
            </div>`);
        }
        if (d.rimozioniSospette) {
            // Limite noto, spiegato nella migration 36: una carta uscita
            // dalla collezione non lascia traccia, quindi finirebbe nel
            // residuo e verrebbe letta come "i prezzi sono scesi". Quando
            // i pezzi calano si dice cosa e' successo invece di attribuire
            // il calo ai prezzi.
            voci.push(`<div class="ball-riga">
                <span class="ball-nome">${d.pezziInMeno} pezz${d.pezziInMeno === 1 ? 'o uscito' : 'i usciti'} dalla collezione</span>
                <span class="ball-dato">—</span>
            </div>`);
            voci.push('<span class="ball-k-lab ball-attesa">Con dei pezzi in uscita non si puo' + "'" + ' distinguere quanto sia movimento dei prezzi.</span>');
        } else if (d.daPrezzi != null && Math.abs(d.daPrezzi) >= 0.01) {
            voci.push(`<div class="ball-riga">
                <span class="ball-nome">movimento dei prezzi</span>
                <span class="ball-dato">${segno(d.daPrezzi)}${eur(d.daPrezzi)}</span>
            </div>`);
        }

        const grafico = (d.serie && d.serie.length > 1) ? _ballSparkline(d.serie, colore) : '';
        const nota = `<span class="ball-k-lab">${d.giorniMisurati} giorn${d.giorniMisurati === 1 ? 'o' : 'i'} misurat${d.giorniMisurati === 1 ? 'o' : 'i'}</span>`;

        return { inline, blocco: grafico + voci.join('') + nota };
    },

    // Disposizione scelta da Claudio: due numeri affiancati in alto, barra
    // della quota in basso. La barra usa .ball-barra-out/.ball-barra-in,
    // gli stessi mattoni del corpo 'prezzi' — niente CSS nuovo.
    contributi: (d) => {
        // La RPC non ha risposto. Non si scrive "0": sarebbe
        // un'affermazione falsa sul lavoro del gruppo.
        if (!d) {
            return {
                inline: '<div class="ball-k-mid">\u2014</div><span class="ball-k-lab">dati non disponibili</span>',
                blocco: '',
            };
        }

        // I due numeri hanno lo stesso peso visivo ma NON la stessa scala:
        // 'miei' cresce senza tetto, 'personeAiutate' ha come massimo 4
        // (cinque membri, te esclusa) e una volta arrivato li' resta fermo
        // per sempre. Non e' un difetto: e' il dato vero, ed e' l'aspetto
        // che il widget avra' fra qualche settimana.
        const inline =
            '<div class="ball-k-duo">' +
                `<div><div class="ball-k-big ball-k-mono">${d.miei}</div><span class="ball-k-lab">carte</span></div>` +
                `<div><div class="ball-k-big ball-k-mono">${d.personeAiutate}</div><span class="ball-k-lab">person${d.personeAiutate === 1 ? 'a' : 'e'}</span></div>` +
            '</div>';

        // GUARDIA SUL DENOMINATORE. Al primo giorno sono tre zeri
        // legittimi: niente divisione, e nessun "0% del lavoro del gruppo",
        // che e' vero ma si legge come un rimprovero quando il gruppo non
        // ha ancora fatto niente.
        if (!d.gruppo) {
            return {
                inline,
                // .ball-quota: contenitore che rende la coppia
                // barra+didascalia un blocco ATOMICO per
                // _potaContenutoFuoriTessera(). Senza, in una tessera
                // stretta la didascalia veniva tagliata a meta' dal bordo:
                // la potatura conosce solo .ball-riga/.ball-gruppo/
                // .ball-spark/.ball-strip e ignorava questi due elementi.
                blocco: '<div class="ball-quota">' +
                        '<div class="ball-barra-out"><div class="ball-barra-in" style="width:0%"></div></div>' +
                        '<span class="ball-k-lab ball-attesa">Primi contributi in arrivo.</span>' +
                        '</div>',
            };
        }

        // Intero, non decimale: con numeri piccoli (1 su 3) i decimali
        // darebbero una precisione che il dato non ha.
        // 'gruppo' conta TUTTE le righe, comprese le proprie, quindi la
        // quota non puo' superare il 100%.
        const perc = Math.round((d.miei / d.gruppo) * 100);
        // Stesso contenitore atomico del ramo qui sopra: o la quota si
        // vede tutta, o sparisce tutta. Mezza didascalia e' peggio di
        // nessuna didascalia.
        const blocco =
            '<div class="ball-quota">' +
            `<div class="ball-barra-out"><div class="ball-barra-in" style="width:${perc}%"></div></div>` +
            `<span class="ball-k-lab">${perc}% del lavoro del gruppo</span>` +
            '</div>';

        return { inline, blocco };
    },

    // Le tre categorie della home fissa: valore piu' alto, oscillazione in
    // su, oscillazione in giu'. Stesse tre carte per categoria.
    primo_piano: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const top = (d.perValore && d.perValore[0]) || null;
        const eur = (v) => '€ ' + Number(v || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        // NIENTE ball-k-tit qui: renderWidgetHome stampa gia' il titolo del
        // widget accanto alla sfera, quindi si leggeva due volte ("In primo
        // piano" e subito sotto "In vetrina"). Difetto visto in uno
        // screenshot di Claudio il 2026-09-03.
        const inline = top
            ? `<div class="ball-k-big ball-k-mono">${eur(top.prezzo)}</div><span class="ball-k-lab">${top.nome}</span>`
            : '<div class="ball-k-mid">—</div><span class="ball-k-lab">nessuna carta ancora</span>';
        // Le tre categorie AFFIANCATE quando c'e' larghezza, impilate
        // quando non ce n'e' (Claudio: "dovrebbe estendersi in orizzontale
        // come nella home"). Il contenitore usa auto-fit nel CSS, quindi
        // non serve sapere qui quanto e' largo il widget: si dispone da
        // solo e si comporta bene sia a 3 colonne di griglia sia a tutta
        // riga in orizzontale.
        const blocco = '<div class="ball-gruppi">' +
            _ballFilaCarte('Valore più alto', d.perValore, 'top_valore') +
            _ballFilaCarte('Oscillazione +', d.su, 'oscillazione_su') +
            _ballFilaCarte('Oscillazione −', d.giu, 'oscillazione_giu') +
            '</div>';
        return { inline, blocco };
    },

    // Elenco delle ultime aggiunte, nome + data, come il pannello
    // "Attività recenti" della home fissa.
    carte_recenti: (d) => {
        if (!d || !d.lista || !d.lista.length) {
            return { inline: '<div class="ball-k-mid">—</div><span class="ball-k-lab">nessuna carta ancora</span>', blocco: '' };
        }
        const inline =
            `<div class="ball-k-mid">${d.lista[0].nome}</div>` +
            `<span class="ball-k-lab">aggiunta il ${d.lista[0].quando}</span>`;
        const blocco =
            '<div class="ball-strip">' + d.lista.map(c => _ballMiniCarta(c, undefined, 'ultime_aggiunte')).join('') + '</div>' +
            _ballElencoRighe(d.lista.map(c => ({ id: c.id, nome: c.nome, dato: c.quando, origine: 'ultime_aggiunte' })));
        return { inline, blocco };
    },

    // Stesso elenco per i controlli prezzo recenti. La variante e' mostrata
    // accanto al nome come fa la home fissa.
    prezzi_recenti: (d) => {
        if (!d || !d.lista || !d.lista.length) {
            return { inline: '<div class="ball-k-mid">—</div><span class="ball-k-lab">nessun controllo ancora</span>', blocco: '' };
        }
        const inline =
            `<div class="ball-k-mid">${d.lista[0].nome}</div>` +
            `<span class="ball-k-lab">controllata il ${d.lista[0].quando}</span>`;
        const blocco = _ballElencoRighe(d.lista.map(c => ({
            id: c.id,
            nome: c.nome + (c.variante ? ` <span class="ball-k-lab">${c.variante}</span>` : ''),
            dato: c.quando,
            origine: 'prezzi_recenti',
        })));
        return { inline, blocco };
    },

    set_completamento: (d) => {
        if (!d) return { inline: '', blocco: '' };
        if (!d.voci || !d.voci.length) {
            return {
                inline: '<p class="ball-k-tit">Set</p><div class="ball-k-mid">—</div>' +
                        `<span class="ball-k-lab">${d.riconosciute ? 'nessuna espansione' : 'codici non riconosciuti'}</span>`,
                blocco: ''
            };
        }
        const prima = d.voci[0];

        // Con il set in libreria si mostra l'avanzamento; senza, si mostra
        // quante carte hai — mai una percentuale su un totale ignoto.
        const inline =
            '<p class="ball-k-tit">Set</p>' +
            ((prima.totale && prima.perc != null)
                ? `<div class="ball-k-big ball-k-mono">${Math.round(prima.perc)}%</div>` +
                  `<span class="ball-k-lab">${prima.nome} · ${prima.totale - prima.hai} alla fine</span>`
                : `<div class="ball-k-big ball-k-mono">${d.voci.length}</div>` +
                  `<span class="ball-k-lab">espansioni · ${prima.nome} in testa</span>`);

        const blocco = d.voci.slice(0, 4).map(v => (v.totale && v.perc != null)
            ? _ballRigaBarra(v.nome, `${v.hai}/${v.totale}`, v.perc, `_ballAzioneRiga(event,'tab','visualizzazione')`)
            : `<div class="ball-riga ball-clic" onclick="_ballAzioneRiga(event,'tab','visualizzazione')">
                   <span class="ball-nome">${v.nome}</span><span class="ball-dato">${v.hai} carte</span>
               </div>`
        ).join('') +
        // Se nessun set è in libreria è giusto dirlo, invece di lasciare
        // pensare che l'avanzamento non esista.
        (d.inLibreria === 0 ? '<span class="ball-k-lab ball-attesa">Avanzamento non disponibile: libreria set da compilare</span>' : '');

        return { inline, blocco };
    },

    // ── SEGNAPOSTO GACHA ─────────────────────────────────────────────────
    // Stessa forma dello "stato vuoto" del mockup: dice cosa arriverà,
    // senza numeri finti e senza pulsanti che non portano da nessuna parte.
    bustina: (d) => _ballCorpoSegnaposto('Bustina', d),
    polvere: (d) => _ballCorpoSegnaposto('Polvere', d),
    missioni: (d) => _ballCorpoSegnaposto('Missioni', d),

    // ── I CINQUE WIDGET NUOVI ────────────────────────────────────────────
    valore_collezione: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const eur = (v) => '€ ' + Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 });
        const inline =
            '<p class="ball-k-tit">Valore</p>' +
            `<div class="ball-k-big ball-k-mono">${eur(d.valore)}</div>` +
            `<span class="ball-k-lab">${d.pezzi} pezzi · media ${eur(d.media)}</span>`;
        let blocco = '';
        if (d.top && d.top.length) {
            // Missioni #39/#83: origine 'top_valore', SOLO qui — non nel
            // blocco 'lista' di doppioni sotto né in quello di
            // 'visualizzazione' più in basso, che riusano la stessa
            // _ballMiniCarta ma non sono "le carte di maggior valore".
            blocco = '<div class="ball-strip">' + d.top.map(c => _ballMiniCarta(c, undefined, 'top_valore')).join('') + '</div>' +
                '<span class="ball-k-lab">Le più preziose</span>';
        }
        return { inline, blocco };
    },

    doppioni: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const inline =
            '<p class="ball-k-tit">Doppioni</p>' +
            `<div class="ball-k-big ball-k-mono">${d.copieExtra || 0}</div>` +
            `<span class="ball-k-lab">copie in più su ${d.titoli || 0} carte</span>` +
            (d.valoreExtra > 0 ? `<span class="ball-k-lab su">€ ${Math.round(d.valoreExtra).toLocaleString('it-IT')} scambiabili</span>` : '');
        let blocco = '';
        if (d.lista && d.lista.length) {
            blocco = '<div class="ball-strip">' + d.lista.map(c => _ballMiniCarta(c, '×' + c.qty)).join('') + '</div>' +
                '<span class="ball-k-lab">Le carte doppie</span>';
        }
        return { inline, blocco };
    },

    wishlist_obiettivi: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const inline =
            '<p class="ball-k-tit">Wishlist</p>' +
            `<div class="ball-k-big ball-k-mono${d.raggiunte > 0 ? ' su' : ''}">${d.raggiunte > 0 ? d.raggiunte : (d.totale || 0)}</div>` +
            `<span class="ball-k-lab">${d.raggiunte > 0 ? 'sotto il prezzo obiettivo' : 'carte desiderate'}</span>` +
            (d.raggiunte > 0 ? _ballPill('da comprare', true) : '');
        let blocco = '';
        if (d.lista && d.lista.length) {
            // Barra: quanto è vicino il prezzo attuale all'obiettivo. Piena
            // quando il prezzo è sceso fino al bersaglio.
            blocco = d.lista.map(c => {
                const perc = c.prezzo > 0 ? Math.min(100, (c.obiettivo / c.prezzo) * 100) : 0;
                return _ballRigaBarra(c.nome, `€ ${c.prezzo.toFixed(0)} / ${c.obiettivo.toFixed(0)}`, perc,
                    `_ballAzioneRiga(event,'carta','${c.id}')`);
            }).join('');
        }
        return { inline, blocco };
    },

    traguardi: (d) => {
        if (!d || !d.carte) return { inline: '', blocco: '' };
        const manca = d.carte.soglia - d.carte.valore;
        const inline =
            '<p class="ball-k-tit">Traguardi</p>' +
            `<div class="ball-k-big ball-k-mono">${manca > 0 ? manca : 0}</div>` +
            `<span class="ball-k-lab">carte al traguardo di ${d.carte.soglia}</span>`;
        const blocco =
            _ballRigaBarra('Carte', `${d.carte.valore}/${d.carte.soglia}`, d.carte.perc) +
            _ballRigaBarra('Valore', `€ ${d.euro.valore.toLocaleString('it-IT')}/${d.euro.soglia.toLocaleString('it-IT')}`, d.euro.perc) +
            _ballRigaBarra('Location', `${d.luoghi.valore}/${d.luoghi.soglia}`, d.luoghi.perc);
        return { inline, blocco };
    },

    lingue: (d) => {
        if (!d || !d.voci || !d.voci.length) return { inline: '', blocco: '' };
        const prima = d.voci[0];
        const quota = d.totale ? Math.round((prima[1] / d.totale) * 100) : 0;
        const inline =
            '<p class="ball-k-tit">Lingue</p>' +
            `<div class="ball-k-big ball-k-mono">${prima[0]}</div>` +
            `<span class="ball-k-lab">${quota}% della collezione</span>`;
        const blocco = '<div class="ball-stat-griglia">' + d.voci.slice(0, 3).map(([lang, n]) =>
            `<div class="ball-stat"><b>${n}</b><span>${lang}</span></div>`).join('') + '</div>';
        return { inline, blocco };
    },

    // ── CORPI PER I WIDGET GIÀ ESISTENTI ─────────────────────────────────
    inserimento: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const n = d.daCorreggere || 0;
        const inline =
            '<p class="ball-k-tit">Inserimento</p>' +
            `<div class="ball-k-big ball-k-mono${n > 0 ? ' giu' : ' su'}">${n}</div>` +
            `<span class="ball-k-lab">${n > 0 ? 'in coda da correggere' : 'coda pulita'}</span>`;
        const blocco = n > 0
            ? _ballPulsante('Vai alla coda', `_ballAzioneRiga(event,'tab','inserimento')`)
            : _ballPulsante('Aggiungi carta', `_ballAzioneRiga(event,'tab','inserimento')`);
        return { inline, blocco };
    },

    binder: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const inline =
            '<p class="ball-k-tit">Binders</p>' +
            `<div class="ball-k-big ball-k-mono">${d.totale || 0}</div>` +
            '<span class="ball-k-lab">raccoglitori</span>';
        let blocco = '';
        if (d.voci && d.voci.length) {
            const massimo = d.voci[0][1] || 1;
            blocco = d.voci.slice(0, 3).map(([nome, n]) =>
                _ballRigaBarra(nome, n, (n / massimo) * 100,
                    `_ballAzioneRiga(event,'location','${String(nome).replace(/'/g, "\\'")}')`)).join('');
        }
        return { inline, blocco };
    },

    sealed: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const eur = (v) => '€ ' + Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 });
        const inline =
            '<p class="ball-k-tit">Sealed</p>' +
            `<div class="ball-k-big ball-k-mono">${d.totale || 0}</div>` +
            `<span class="ball-k-lab">prodotti${d.valore ? ' · ' + eur(d.valore) : ''}</span>`;
        let blocco = '';
        if (d.lista && d.lista.length) {
            blocco = '<div class="ball-riga-set">' + d.lista.map(p =>
                `<div class="ball-riga"><span class="ball-nome">${p.nome}</span><span class="ball-dato">${eur(p.prezzo)}</span></div>`
            ).join('') + '</div>';
        }
        return { inline, blocco };
    },

    gruppo_attivo: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const inline =
            '<p class="ball-k-tit">Gruppo</p>' +
            `<div class="ball-k-mid">${d.attivo ? 'Al lavoro' : 'In pausa'}</div>` +
            '<span class="ball-k-lab">stato del gruppo adesso</span>' +
            _ballPill(d.attivo ? 'qualcuno online' : 'nessuno online', !!d.attivo);
        return { inline, blocco: '' };
    },

    suggerimento: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const inline =
            '<p class="ball-k-tit">Prossima azione</p>' +
            `<div class="ball-k-mid">${d.testo || ''}</div>` +
            '<span class="ball-k-lab">la cosa più utile ora</span>';
        const blocco = d.tab && d.tab !== 'home'
            ? _ballPulsante('Fallo adesso', `_ballAzioneRiga(event,'tab','${d.tab}')`)
            : '';
        return { inline, blocco };
    },

    estensione: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const inline =
            '<p class="ball-k-tit">Estensione</p>' +
            `<div class="ball-k-mid">${d.rilevata ? 'v' + d.versione : 'Non rilevata'}</div>` +
            `<span class="ball-k-lab">${d.rilevata ? 'collegata a questo dispositivo' : 'installala per sincronizzare'}</span>` +
            (d.rilevata ? _ballPill(d.aiutaGruppo ? 'aiuta il gruppo' : 'aiuto disattivo', !!d.aiutaGruppo) : '');
        return { inline, blocco: '' };
    },

    // Prezzi: quanti chiedono attenzione, quanto vale la collezione, la
    // quota di aggiornati come barra e le carte scadute come righe.
    prezzi: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const scaduti = d.scaduti || 0;
        const totale = d.totale || 0;
        const aggiornati = Math.max(0, totale - scaduti);
        const perc = totale > 0 ? (aggiornati / totale) * 100 : 100;

        const inline =
            '<p class="ball-k-tit">Prezzi</p>' +
            `<div class="ball-k-big ball-k-mono${scaduti > 0 ? ' giu' : ' su'}">${scaduti > 0 ? scaduti : totale}</div>` +
            `<span class="ball-k-lab">${scaduti > 0 ? 'da aggiornare' : 'tutti aggiornati'}</span>` +
            (d.valore ? `<span class="ball-k-lab">€ ${d.valore.toLocaleString('it-IT', { maximumFractionDigits: 0 })} in collezione</span>` : '');

        // .ball-quota (2026-09-06): didascalia e barra sono un blocco
        // ATOMICO per _potaContenutoFuoriTessera(). Prima erano due figli
        // diretti sciolti, che la potatura non conosce: in tessera stretta
        // la riga "Aggiornati N/M" veniva tagliata a meta' dal bordo.
        // Difetto preesistente, stesso identico caso gia' corretto sul
        // widget 'contributi'.
        let blocco =
            '<div class="ball-quota">' +
            '<div class="ball-barra-testo"><span>Aggiornati</span><span>' + aggiornati + '/' + totale + '</span></div>' +
            `<div class="ball-barra-out"><div class="ball-barra-in" style="width:${perc.toFixed(1)}%"></div></div>` +
            '</div>';

        if (d.lista && d.lista.length) {
            blocco += '<div class="ball-riga-set">' + d.lista.slice(0, 3).map(v =>
                `<div class="ball-riga ball-clic" onclick="_ballAzioneRiga(event,'prezzi-scaduti')">
                    <span class="ball-nome">${v.nome}</span><span class="ball-dato">${v.quando}</span>
                 </div>`).join('') + '</div>';
            blocco += _ballPulsante('Vedi tutte', `_ballAzioneRiga(event,'prezzi-scaduti')`);
        }
        return { inline, blocco };
    },

    // Visualizzazione: il totale, l'andamento vero degli inserimenti degli
    // ultimi 14 giorni come sparkline, e le ultime carte entrate.
    visualizzazione: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const inline =
            '<p class="ball-k-tit">Collezione</p>' +
            `<div class="ball-k-big ball-k-mono">${(d.totale || 0).toLocaleString('it-IT')}</div>` +
            '<span class="ball-k-lab">carte in collezione</span>' +
            (d.aggiunteRecenti ? `<span class="ball-k-lab su">+${d.aggiunteRecenti} negli ultimi 14 giorni</span>` : '');

        let blocco = '';
        if (d.serie && d.serie.length > 1) blocco += _ballSparkline(d.serie, 'var(--accent)');
        if (d.ultime && d.ultime.length) {
            blocco += '<div class="ball-strip">' + d.ultime.map(c => _ballMiniCarta(c)).join('') + '</div>' +
                      '<span class="ball-k-lab">Ultime aggiunte</span>';
        }
        return { inline, blocco };
    },

    // Location: quante posizioni, e una barra per ciascuna delle più piene,
    // in scala sulla maggiore. Ogni riga apre la collezione già filtrata.
    location: (d) => {
        if (!d || !d.voci || !d.voci.length) return { inline: '', blocco: '' };
        const massimo = d.voci[0][1] || 1;
        const prima = d.voci[0];
        const inline =
            '<p class="ball-k-tit">Location</p>' +
            `<div class="ball-k-big ball-k-mono">${d.voci.length}</div>` +
            `<span class="ball-k-lab">${d.voci.length === 1 ? 'posizione' : 'posizioni'} · più piena ${prima[0]}</span>`;

        const blocco = d.voci.slice(0, 4).map(([nome, n]) =>
            _ballRigaBarra(nome, n, (n / massimo) * 100,
                `_ballAzioneRiga(event,'location','${String(nome).replace(/'/g, "\\'")}')`)
        ).join('');
        return { inline, blocco };
    },

    // Match: il totale, e i due tipi come riquadri di statistica separati —
    // scambio e wishlist sono due cose diverse.
    match: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const scambio = d.scambio || 0, wishlist = d.wishlist || 0;
        const totale = scambio + wishlist;
        const inline =
            '<p class="ball-k-tit">Match trovati</p>' +
            `<div class="ball-k-big ball-k-mono${totale > 0 ? ' su' : ''}">${totale}</div>` +
            `<span class="ball-k-lab">${totale === 0 ? 'nessuna novità' : (totale === 1 ? 'corrispondenza' : 'corrispondenze')}</span>` +
            (totale > 0 ? _ballPill('da vedere', true) : '');

        const blocco =
            '<div class="ball-stat-griglia">' +
                `<div class="ball-stat ball-clic" onclick="_ballAzioneRiga(event,'tab','binder')"><b>${scambio}</b><span>Scambio</span></div>` +
                `<div class="ball-stat ball-clic" onclick="_ballAzioneRiga(event,'tab','binder')"><b>${wishlist}</b><span>Wishlist</span></div>` +
            '</div>' +
            (totale > 0 ? _ballPulsante('Apri Binders', `_ballAzioneRiga(event,'tab','binder')`) : '');
        return { inline, blocco };
    }
};

// Ripiego per gli undici widget non ancora convertiti: le righe di testo di
// sempre, così nessuno perde niente mentre procediamo quattro alla volta.
function _ballCorpoGenerico(anteprima) {
    return {
        inline: `<div class="ball-righe-testo">${(anteprima.righe || []).map(r => `<span>${r}</span>`).join('')}</div>`,
        blocco: ''
    };
}

function _ballCorpoWidget(id, anteprima) {
    const f = _ballCORPI[id];
    if (!f || !anteprima || !anteprima.dati) return _ballCorpoGenerico(anteprima);
    try {
        const c = f(anteprima.dati);
        // Un corpo vuoto (dati insufficienti) non deve lasciare la tessera
        // muta: si torna al testo.
        if (!c || (!c.inline && !c.blocco)) return _ballCorpoGenerico(anteprima);
        return c;
    } catch (e) {
        console.error('Corpo widget ' + id + ':', e);
        return _ballCorpoGenerico(anteprima);
    }
}
