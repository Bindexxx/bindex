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

// AGGIORNATO (STEP 1 restyle "cornice Pokédex", 2026-09-17): la vecchia
// tabella fissa _ballPALETTE (3 temi x chiaro/scuro, 6 voci hardcoded) è
// sostituita da derivaPaletteBall() in utils/theme-colori.js, che calcola
// calotta/pancia dai DUE colori liberi (Principale/Secondario) scelti
// dall'utente invece che da un tema preimpostato. Nessun'altra riga di
// questo file cambia: _ballSvg/_ballSvgCache continuano a chiamare
// _ballTemaAttivo() esattamente come prima, ignare del cambio sotto.
function _ballTemaAttivo() {
    const scuro = document.body.classList.contains('dark-mode');
    const principale = (typeof prefColorePrincipaleGet === 'function' && prefColorePrincipaleGet()) || TEMA_COLORE_PRINCIPALE_DEFAULT;
    const secondario = (typeof prefColoreSecondarioGet === 'function' && prefColoreSecondarioGet()) || TEMA_COLORE_SECONDARIO_DEFAULT;
    return derivaPaletteBall(principale, secondario, scuro);
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
// RESTYLE BINDEX FASE 1 (2026-09-30, tavole approvate sulla tela "Bindex —
// restyle"): TUTTI gli emblemi ora hanno il bordino scuro sottile che prima
// avevano solo 'carte' (stesso tono: calotta scurita al 50%, 1.6 di
// spessore) — pieni, leggibili anche sulle sfere piccole. La sfera
// (_ballSvg) e le animazioni NON cambiano: cambia solo il contenuto
// dell'emblema. Nuovi: cartaNuova, cartellino, trend, corona, bandiera,
// stella, doppie, griglia, puzzle, nodi, fumetto, vassoio, coppa, mensole,
// fotocamera. Le chiavi vecchie restano tutte (nessun chiamante rotto).
function _ballEmbBordo(c) {
    return ` stroke="${_ballScurisci(c, 0.5)}" stroke-width="1.6" stroke-linejoin="round"`;
}
// Tratto bianco con contorno scuro (per le frecce/linee non chiuse).
function _ballEmbLinea(c, d, w) {
    return `<path d="${d}" fill="none" stroke="${_ballScurisci(c, 0.5)}" stroke-width="${w + 2.6}" stroke-linecap="round" stroke-linejoin="round"/>` +
           `<path d="${d}" fill="none" stroke="#fff" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
}
const _ballEMBLEMI = {
    carte: (c) => {
        const st = _ballEmbBordo(c);
        return `<rect x="1.8" y="6.5" width="8.5" height="13" rx="1.6" transform="rotate(-26 6.05 13)"${st}/>` +
               `<rect x="13.7" y="6.5" width="8.5" height="13" rx="1.6" transform="rotate(26 17.95 13)"${st}/>` +
               `<rect x="7.75" y="4.5" width="8.5" height="15" rx="1.6"${st}/>`;
    },
    piu: (c) => `<path d="M9.7 2.6h4.6v7.1h7.1v4.6h-7.1v7.1H9.7v-7.1H2.6V9.7h7.1z"${_ballEmbBordo(c)}/>`,
    scambio: (c) => `<path d="M2.5 6.4h11.2V2.4l7.8 5.6-7.8 5.6V9.6H2.5z"${_ballEmbBordo(c)}/>` +
                    `<path d="M21.5 17.6H10.3v4l-7.8-5.6 7.8-5.6v4h11.2z"${_ballEmbBordo(c)}/>`,
    monete: (c) => `<path d="M3 14.4v3.1c0 1.9 4 3.4 9 3.4s9-1.5 9-3.4v-3.1c0 1.9-4 3.4-9 3.4s-9-1.5-9-3.4z"${_ballEmbBordo(c)}/>` +
        `<path d="M3 8.4v3.1c0 1.9 4 3.4 9 3.4s9-1.5 9-3.4V8.4c0 1.9-4 3.4-9 3.4S3 10.3 3 8.4z"${_ballEmbBordo(c)}/>` +
        `<ellipse cx="12" cy="5.6" rx="9" ry="3.4"${_ballEmbBordo(c)}/>` +
        `<ellipse cx="12" cy="5.6" rx="3.4" ry="1.3" fill="${c}"/>`,
    cuore: (c) => `<path d="M12 21.2l-1.7-1.6C4.3 14.1 1 11.1 1 7.6 1 4.5 3.4 2 6.5 2c1.8 0 3.5.9 4.5 2.2C12 2.9 13.7 2 15.5 2 18.6 2 21 4.5 21 7.6c0 3.5-3.3 6.5-9.3 12z"${_ballEmbBordo(c)}/>`,
    album: (c) => `<path d="M2 4.6C4.6 3 8.4 3 11 4.6v15.2C8.4 18.2 4.6 18.2 2 19.8z"${_ballEmbBordo(c)}/>` +
        `<path d="M13 4.6C15.6 3 19.4 3 22 4.6v15.2c-2.6-1.6-6.4-1.6-9 0z"${_ballEmbBordo(c)}/>`,
    bustina: (c) => `<path d="M5.5 7L7.1 4.9 8.8 7l1.6-2.1L12 7l1.6-2.1L15.3 7l1.6-2.1L18.5 7v13.6a1.4 1.4 0 01-1.4 1.4H6.9a1.4 1.4 0 01-1.4-1.4z"${_ballEmbBordo(c)}/>` +
        `<rect x="5.5" y="11.9" width="13" height="2.4" fill="${c}"/>`,
    polvere: (c) => `<path d="M12 0.8l2.6 6.6 6.6 2.6-6.6 2.6L12 19.2 9.4 12.6 2.8 10l6.6-2.6z"${_ballEmbBordo(c)}/>` +
        `<path d="M19.4 14.6l1.1 2.8 2.8 1.1-2.8 1.1-1.1 2.8-1.1-2.8-2.8-1.1 2.8-1.1z"${_ballEmbBordo(c)}/>` +
        `<circle cx="4.4" cy="18.4" r="2.1"${_ballEmbBordo(c)}/>`,
    regalo: (c) => `<rect x="3" y="9.5" width="18" height="11.8" rx="1.8"${_ballEmbBordo(c)}/>` +
        `<path d="M12 6.2C10.2 2.2 5.6 2.6 6.1 5.6c.4 2.1 3.5 1.7 5.9.6z"${_ballEmbBordo(c)}/>` +
        `<path d="M12 6.2c1.8-4 6.4-3.6 5.9-.6-.4 2.1-3.5 1.7-5.9.6z"${_ballEmbBordo(c)}/>` +
        `<rect x="1.8" y="5.6" width="20.4" height="4.6" rx="1.6"${_ballEmbBordo(c)}/>` +
        `<rect x="10.4" y="5.6" width="3.2" height="15.7" fill="${c}"/>`,
    ingranaggio: (c) => `<path d="M12 1.8l1.7 2.7 3.2-.7.5 3.2 3 1.3-1.6 2.8 1.6 2.8-3 1.3-.5 3.2-3.2-.7L12 22.2l-1.7-2.7-3.2.7-.5-3.2-3-1.3L5.2 13 3.6 10.2l3-1.3.5-3.2 3.2.7z"${_ballEmbBordo(c)}/>` +
        `<circle cx="12" cy="12" r="3.7" fill="${c}"/>`,
    persone: (c) => `<circle cx="17.2" cy="8.6" r="3.4"${_ballEmbBordo(c)}/>` +
        `<path d="M13.4 20.6c0-3.2 1.9-5.4 4.6-5.4 2.6 0 4.4 2 4.4 5.4z"${_ballEmbBordo(c)}/>` +
        `<circle cx="8.6" cy="7.4" r="4.3"${_ballEmbBordo(c)}/>` +
        `<path d="M1.6 20.6c0-3.9 3.1-6.6 7-6.6s7 2.7 7 6.6z"${_ballEmbBordo(c)}/>`,
    pin: (c) => `<path d="M12 1.6c-4.2 0-7.4 3.2-7.4 7.3 0 5.3 6.4 12.6 6.7 12.9a1 1 0 001.4 0c.3-.3 6.7-7.6 6.7-12.9 0-4.1-3.2-7.3-7.4-7.3z"${_ballEmbBordo(c)}/>` +
        `<circle cx="12" cy="8.8" r="3.1" fill="${c}"/>`,
    lampadina: (c) => `<path d="M12 1.8a7 7 0 00-4.1 12.7c.7.5 1.1 1.2 1.1 2v.4h6v-.4c0-.8.4-1.5 1.1-2A7 7 0 0012 1.8z"${_ballEmbBordo(c)}/>` +
        `<rect x="8.8" y="18" width="6.4" height="2.2" rx="1.1"${_ballEmbBordo(c)}/>` +
        `<rect x="9.6" y="21" width="4.8" height="1.8" rx=".9"${_ballEmbBordo(c)}/>`,
    orologio: (c) => `<circle cx="12" cy="12.4" r="9.6"${_ballEmbBordo(c)}/>` +
        `<circle cx="12" cy="12.4" r="6.8" fill="${c}"/>` +
        '<rect x="11.2" y="6.6" width="1.7" height="6.6" rx=".85"/>' +
        '<rect x="11.2" y="11.6" width="5.6" height="1.7" rx=".85"/>' +
        '<circle cx="12" cy="12.4" r="1.4"/>',
    // ── nuovi (restyle 2026-09-30) ──
    cartaNuova: (c) => `<rect x="2.6" y="4.6" width="12.6" height="17.6" rx="2"${_ballEmbBordo(c)}/>` +
        `<rect x="5.2" y="7.3" width="7.4" height="5.6" rx="1" fill="${c}"/>` +
        `<path d="M18.5 .8l1.5 3.3 3.6.4-2.7 2.4.8 3.5-3.2-1.8-3.2 1.8.8-3.5-2.7-2.4 3.6-.4z"${_ballEmbBordo(c)}/>`,
    cartellino: (c) => `<path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h8.3c.4 0 .8.2 1.1.4l8.7 8.7c.6.6.6 1.5 0 2.1l-8.3 8.3c-.6.6-1.5.6-2.1 0L2.4 12.8c-.3-.3-.4-.7-.4-1.1z"${_ballEmbBordo(c)}/>` +
        `<circle cx="7.3" cy="7.3" r="2.1" fill="${c}"/>`,
    trend: (c) => _ballEmbLinea(c, 'M2.2 18.2l6.4-6.4 4 4 5-5', 3.2) +
        `<path d="M13 3.6h8.4v8.4z"${_ballEmbBordo(c)}/>`,
    corona: (c) => `<rect x="4.2" y="19.2" width="15.6" height="2.8" rx="1"${_ballEmbBordo(c)}/>` +
        `<path d="M2 7l5.2 4.4L12 3l4.8 8.4L22 7l-2.2 11.4H4.2z"${_ballEmbBordo(c)}/>` +
        `<circle cx="12" cy="14.2" r="1.9" fill="${c}"/>`,
    bandiera: (c) => `<rect x="3.2" y="1.8" width="2.8" height="20.6" rx="1.4"${_ballEmbBordo(c)}/>` +
        `<path d="M6 2.8h14.8l-3.7 5.1 3.7 5.1H6z"${_ballEmbBordo(c)}/>`,
    stella: (c) => `<path d="M12 1.4l3.1 6.4 7 1-5.1 5 1.2 7L12 17.5l-6.2 3.3 1.2-7-5.1-5 7-1z"${_ballEmbBordo(c)}/>`,
    doppie: (c) => `<rect x="2.4" y="1.8" width="12.6" height="16.6" rx="2"${_ballEmbBordo(c)}/>` +
        `<rect x="9" y="5.6" width="12.6" height="16.6" rx="2"${_ballEmbBordo(c)}/>` +
        `<path d="M12.3 13.9h6.2M15.4 10.8v6.2" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/>`,
    // Set: pagina di raccoglitore 3x3, caselle piene = carte del set che hai
    griglia: (c) => `<rect x="2.2" y="2.2" width="19.6" height="19.6" rx="2.6"${_ballEmbBordo(c)}/>` +
        [[0,0,1],[1,0,1],[2,0,1],[0,1,1],[1,1,1],[2,1,0],[0,2,1],[1,2,0],[2,2,0]].map(([x, y, pieno]) => {
            const X = 4.6 + x * 5.2, Y = 4.6 + y * 5.2;
            return pieno ? `<rect x="${X}" y="${Y}" width="4.2" height="4.2" rx=".8" fill="${c}"/>`
                         : `<rect x="${X + .5}" y="${Y + .5}" width="3.2" height="3.2" rx=".6" fill="none" stroke="${c}" stroke-width="1"/>`;
        }).join(''),
    // Estensione: tassello di puzzle
    puzzle: (c) => `<path d="M3.6 7.4h4.2a2.7 2.7 0 1 1 5.4 0h4.2v4.2a2.7 2.7 0 1 1 0 5.4v4.6H3.6v-4.6a2.7 2.7 0 1 0 0-5.4z"${_ballEmbBordo(c)}/>`,
    nodi: (c) => _ballEmbLinea(c, 'M6 12l12.4-6.7M6 12l12.4 6.7', 2.6) +
        `<circle cx="5.3" cy="12" r="3.7"${_ballEmbBordo(c)}/><circle cx="18.6" cy="5.2" r="3.7"${_ballEmbBordo(c)}/><circle cx="18.6" cy="18.8" r="3.7"${_ballEmbBordo(c)}/>`,
    fumetto: (c) => `<path d="M2 5.2C2 4 3 3 4.2 3h15.6C21 3 22 4 22 5.2v10.3c0 1.2-1 2.2-2.2 2.2H10l-5.4 4.4v-4.4h-.4C3 17.7 2 16.7 2 15.5z"${_ballEmbBordo(c)}/>` +
        `<circle cx="7.4" cy="10.4" r="1.7" fill="${c}"/><circle cx="12" cy="10.4" r="1.7" fill="${c}"/><circle cx="16.6" cy="10.4" r="1.7" fill="${c}"/>`,
    vassoio: (c) => `<path d="M5.4 3h13.2l3.4 9.6V20c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2v-7.4z"${_ballEmbBordo(c)}/>` +
        `<path d="M2.6 12.6h5.6l1.4 2.8h4.8l1.4-2.8h5.6" fill="none" stroke="${c}" stroke-width="1.8" stroke-linejoin="round"/>`,
    coppa: (c) => _ballEmbLinea(c, 'M6.6 4.4H3.6a3.4 3.4 0 0 0 3.6 5M17.4 4.4h3a3.4 3.4 0 0 1-3.6 5', 2) +
        `<rect x="10.6" y="13.6" width="2.8" height="4.8"${_ballEmbBordo(c)}/><rect x="6.4" y="18.4" width="11.2" height="3.8" rx="1.2"${_ballEmbBordo(c)}/>` +
        `<path d="M6.4 2h11.2v6.9a5.6 5.6 0 0 1-11.2 0z"${_ballEmbBordo(c)}/>` +
        `<path d="M12 4.6l.9 1.9 2.1.3-1.5 1.5.4 2.1-1.9-1-1.9 1 .4-2.1-1.5-1.5 2.1-.3z" fill="${c}"/>`,
    mensole: (c) => `<rect x="2" y="2" width="20" height="20" rx="2"${_ballEmbBordo(c)}/>` +
        `<rect x="2.8" y="9" width="18.4" height="1.9" fill="${c}"/><rect x="2.8" y="15.6" width="18.4" height="1.9" fill="${c}"/>` +
        `<rect x="5" y="3.8" width="3" height="5.2" rx=".5" fill="${c}"/><rect x="9" y="4.9" width="3" height="4.1" rx=".5" fill="${c}"/><rect x="13" y="11" width="4.2" height="4.6" rx=".5" fill="${c}"/>`,
    // Widget Foto carte (FASE 8c): pronto da ora, nessuno lo usa ancora.
    fotocamera: (c) => `<path d="M8.2 3.6h7.6l1.6 2.6h3a1.8 1.8 0 011.8 1.8v11a1.8 1.8 0 01-1.8 1.8H3.6a1.8 1.8 0 01-1.8-1.8V8a1.8 1.8 0 011.8-1.8h3z"${_ballEmbBordo(c)}/>` +
        `<circle cx="12" cy="13.2" r="4.6" fill="${c}"/><circle cx="12" cy="13.2" r="2.6"/>`
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
    // RESTYLE BINDEX FASE 1 (2026-09-30): un emblema proprio per ogni
    // widget (prima chat, achievement, richieste, scaffali e contributi non
    // erano elencati e ricadevano sul "più" di ripiego in
    // paginainiziale-render.ui.js). I colori restano quelli di sempre: oggi
    // la calotta la decide comunque il tema (_ballPaletteWidget = false).
    variazione_valore:{ emblema: 'trend',       colore: '#3FA45B' },
    primo_piano:      { emblema: 'corona',      colore: '#D4A017' },
    carte_recenti:    { emblema: 'cartaNuova',  colore: '#3B7DD8' },
    prezzi_recenti:   { emblema: 'orologio',    colore: '#F2C230' },
    visualizzazione:  { emblema: 'carte',       colore: '#3B7DD8' },
    inserimento:      { emblema: 'piu',         colore: '#D4342C' },
    prezzi:           { emblema: 'cartellino',  colore: '#F2C230' },
    binder:           { emblema: 'album',       colore: '#7F77DD' },
    scaffali:         { emblema: 'mensole',     colore: '#7F77DD' },
    sealed:           { emblema: 'regalo',      colore: '#D6538F' },
    ultima_carta:     { emblema: 'stella',      colore: '#4EA9A4' },
    carta_del_giorno: { emblema: 'polvere',     colore: '#E8763C' },
    gruppo_attivo:    { emblema: 'persone',     colore: '#5AA8D8' },
    location:         { emblema: 'pin',         colore: '#639922' },
    suggerimento:     { emblema: 'lampadina',   colore: '#F2C230' },
    orologio:         { emblema: 'orologio',    colore: '#8A8A93' },
    aggiungi_carta:   { emblema: 'piu',         colore: '#639922' },
    condividi:        { emblema: 'nodi',        colore: '#4B9AA6' },
    match:            { emblema: 'scambio',     colore: '#D6538F' },
    richieste:        { emblema: 'vassoio',     colore: '#4B9AA6' },
    chat:             { emblema: 'fumetto',     colore: '#5AA8D8' },
    contributi:       { emblema: 'persone',     colore: '#5AA8D8' },
    achievement:      { emblema: 'coppa',       colore: '#D4A017' },
    estensione:       { emblema: 'puzzle',      colore: '#7A7F8A' },
    valore_collezione:{ emblema: 'monete',      colore: '#C8892B' },
    doppioni:         { emblema: 'doppie',      colore: '#8A6FD0' },
    wishlist_obiettivi:{ emblema: 'cuore',      colore: '#D6538F' },
    traguardi:        { emblema: 'polvere',     colore: '#F2C230' },
    lingue:           { emblema: 'album',       colore: '#4B9AA6' },
    set_completamento:{ emblema: 'griglia',     colore: '#3B7DD8' },
    bustina:          { emblema: 'bustina',     colore: '#D6538F' },
    polvere:          { emblema: 'polvere',     colore: '#7F77DD' },
    missioni:         { emblema: 'bandiera',    colore: '#639922' }
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
    // AGGIUNTO (2026-09-24, estrazione widget Chat): stesso identico
    // criterio di 'match' sopra — senza questo caso la tessera Chat non
    // si anima MAI, anche con badge visibile, perché questa funzione non
    // gestisce widget non elencati esplicitamente (vedi commento in cima
    // al file).
    if (id === 'chat') return (anteprima.stato === 'ok' && /[1-9]/.test(anteprima.righe[0] || '')) ? 'forte' : null;
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
    if (document.hidden) return; // audit 2026-09-25, M5: nessuna animazione a scheda nascosta
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


// ── CONTENUTI DELLE TESSERE GRANDI — SPOSTATO (piano di taglio 2026-09-11)
// in ui/widget-render-tessere-grandi.ui.js. Conteneva: miniatura di una
// carta, componenti visivi condivisi (_ballRiga/_ballPill/ecc.),
// _ballCORPI, _ballCorpoWidget.

