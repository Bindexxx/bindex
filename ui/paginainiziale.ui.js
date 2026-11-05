// Home a widget: motore principale.

const CATALOGO_WIDGET = {};

const ORDINE_WIDGET_DEFAULT = ['visualizzazione', 'inserimento', 'prezzi', 'binder', 'sealed'];
const MAX_WIDGET_VISIBILI = Infinity;

const COLONNE_GRIGLIA_WIDGET = 6;

const COLONNE_MAX_WIDGET = 36;

const RIGHE_MAX_WIDGET = 24;

const CELLE_MIN_PER_SFERA = 3;

function _correggiTagliaZonaIcona(col, row) {
    const zonaIcona = col < CELLE_MIN_PER_SFERA || row < 2;
    if (!zonaIcona) return { col, row };
    return { col: 2, row: 2 };
}

const VERSIONE_LAYOUT_WIDGET = 2;

function _formaWidget(col, row) {
    const largo = col >= 5;
    const alto = row >= 3;
    if (largo && alto) return 'wf-grande';
    if (largo) return 'wf-largo';
    if (alto) return 'wf-alto';
    return 'wf-piccolo';
}

function _tagliaDiNascita(id) {
    const def = CATALOGO_WIDGET[id];
    const t = def && def.tagliaDefault;
    if (!t) return '3x2';
    const letta = _leggiTaglia(t);
    return letta.col + 'x' + letta.row;
}

function _leggiTaglia(size) {
    const m = /^(\d+)x(\d+)$/.exec(String(size || ''));
    if (!m) return { col: 3, row: 2 };
    const col = Math.max(1, Math.min(COLONNE_MAX_WIDGET, parseInt(m[1], 10)));
    const row = Math.max(1, Math.min(RIGHE_MAX_WIDGET, parseInt(m[2], 10)));
    return { col, row };
}

function _migraTagliaWidget(size) {
    const m = /^(\d+)x(\d+)$/.exec(String(size || ''));
    if (!m) return '3x2';
    const col = Math.max(1, Math.min(2, parseInt(m[1], 10))) * 3;
    const row = Math.max(1, Math.min(2, parseInt(m[2], 10))) * 2;
    return col + 'x' + row;
}

let _layoutWidget = null;
let _layoutWidgetUserId = null;
let _editModeWidget = false;
let _menuSpostaWidgetApertoId = null;
let _densitaCompatta = false;
let _pollingWidgetInterval = null;
let _pollingWidgetIntervalLento = null;
let _resizeCorniceTimeout = null;
let _primoRenderWidgetFatto = false;

function _nuovoInstanceId() {
    return 'w_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function _aggiungiWidgetCatalogoMancanti(lista) {
    Object.entries(CATALOGO_WIDGET).forEach(([id, def]) => {
        if (def.multiIstanza) return;
        if (!lista.find(w => w.id === id)) lista.push({ id, instanceId: _nuovoInstanceId(), visibile: false, size: '3x2', mini: false, cartaId: null, pagina: 0, v: VERSIONE_LAYOUT_WIDGET });
    });
    return lista;
}

async function _caricaLayoutWidget() {
    const userId = await authGetUserId();
    _layoutWidgetUserId = userId || null;
    if (!_layoutWidgetUserId) {
        _layoutWidget = _aggiungiWidgetCatalogoMancanti(ORDINE_WIDGET_DEFAULT.map(id => ({ id, instanceId: _nuovoInstanceId(), visibile: true, size: '3x2', mini: false, cartaId: null, pagina: 0, v: VERSIONE_LAYOUT_WIDGET })));
        return;
    }

    let salvato = null;
    try { salvato = JSON.parse(prefWidgetLayoutGet(_layoutWidgetUserId) || 'null'); } catch (_) { salvato = null; }

    if (!Array.isArray(salvato) || salvato.length === 0) {
        _layoutWidget = _aggiungiWidgetCatalogoMancanti(ORDINE_WIDGET_DEFAULT.map(id => ({ id, instanceId: _nuovoInstanceId(), visibile: true, size: '3x2', mini: false, cartaId: null, pagina: 0, v: VERSIONE_LAYOUT_WIDGET })));
        _salvaLayoutWidget(false);
        return;
    }
    let generatoQualcheId = false;
    let migratoQualcosa = false;
    const validi = salvato
        .filter(w => CATALOGO_WIDGET[w.id])
        .map(w => {
            if (!w.instanceId) generatoQualcheId = true;
            let size;
            if (w.v === VERSIONE_LAYOUT_WIDGET) {
                const t = _leggiTaglia(w.size);
                const corretta = _correggiTagliaZonaIcona(t.col, t.row);
                if (corretta.col !== t.col || corretta.row !== t.row) migratoQualcosa = true;
                size = corretta.col + 'x' + corretta.row;
            } else {
                migratoQualcosa = true;
                size = _migraTagliaWidget(w.size);
            }
            return {
                id: w.id,
                instanceId: w.instanceId || _nuovoInstanceId(),
                visibile: !!w.visibile,
                size: size,
                mini: !!w.mini,
                cartaId: w.cartaId != null ? w.cartaId : null,
                pagina: Math.max(0, parseInt(w.pagina, 10) || 0),
                v: VERSIONE_LAYOUT_WIDGET,
            };
        });
    _aggiungiWidgetCatalogoMancanti(validi);
    _layoutWidget = validi;
    if (generatoQualcheId || migratoQualcosa) _salvaLayoutWidget(false);
}

function _salvaLayoutWidget(daAzioneUtente = true) {
    if (!_layoutWidgetUserId) return;
    prefWidgetLayoutSet(_layoutWidgetUserId, JSON.stringify(_layoutWidget));
    if (daAzioneUtente) _missioneAggancioPersonalizzaLayout();
}

async function _missioneAggancioPersonalizzaLayout() {
    try {
        const userId = await authGetUserId();
        if (!userId) return;
        const oggi = new Date().toISOString().slice(0, 10);
        await missioneRiscattaCompletamento('m94_personalizza', 'giornaliera', oggi);
        const { data: nuovo } = await traguardoRiscatta('t_il_tuo_telefono');
        if (nuovo && typeof _missioniNotificaCompletamenti === 'function' && typeof CATALOGO_TRAGUARDI !== 'undefined') {
            const t = CATALOGO_TRAGUARDI.find(x => x.id === 't_il_tuo_telefono');
            if (t) _missioniNotificaCompletamenti([], [t]);
        }
    } catch (_) {   }
}

function toggleDensitaWidgetHome() {
    _densitaCompatta = !_densitaCompatta;
    document.getElementById('phoneWidgetHomeWrap').classList.toggle('densita-compatta', _densitaCompatta);
}

function _vibraSeSupportato(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) {   }
}
