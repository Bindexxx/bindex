// Home: più pagine.

let _paginaWidgetCorrente = 0;

function _colonneAutoFillWidget(larghezza, diametro, gap) {
    if (!(larghezza > 0) || !(diametro > 0)) return COLONNE_GRIGLIA_WIDGET;
    return Math.max(1, Math.floor((larghezza + gap) / (diametro + gap)));
}

function _misuraPaginaWidget() {
    const grigliaEsistente = document.querySelector('.widget-griglia');
    const paginaEsistente = document.querySelector('.widget-pagina');
    const diametro = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ball-misura')) || 90;
    let colonne = COLONNE_GRIGLIA_WIDGET;
    let altezzaRiga = diametro;
    let spazio = 11.2;
    let altezzaUtile = 0;

    if (grigliaEsistente) {
        const st = getComputedStyle(grigliaEsistente);
        const riga = parseFloat(st.gridAutoRows);
        if (riga > 0) altezzaRiga = riga;
        const g = parseFloat(st.rowGap);
        if (g >= 0) spazio = g;
        const gapColonne = parseFloat(st.columnGap) || 0;
        const larghezza = grigliaEsistente.clientWidth
            - (parseFloat(st.paddingLeft) || 0)
            - (parseFloat(st.paddingRight) || 0);
        colonne = _colonneAutoFillWidget(larghezza, parseFloat(st.getPropertyValue('--ball-misura')) || diametro, gapColonne);
    } else {
        const pagine = document.getElementById('phoneWidgetPagine');
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        if (pagine && pagine.clientWidth) {
            colonne = _colonneAutoFillWidget(pagine.clientWidth - 1.8 * rem, diametro, 0.7 * rem);
        }
    }
    if (paginaEsistente) {
        const st = getComputedStyle(paginaEsistente);
        altezzaUtile = paginaEsistente.clientHeight
            - (parseFloat(st.paddingTop) || 0)
            - (parseFloat(st.paddingBottom) || 0);
    } else {
        const wrap = document.getElementById('phoneWidgetHomeWrap');
        if (wrap) altezzaUtile = wrap.clientHeight - 70;
    }

    const righe = Math.max(1, Math.floor((altezzaUtile + spazio) / (altezzaRiga + spazio)));
    return { colonne, righe };
}

function _tagliaEffettiva(w, misura) {
    const t = _leggiTaglia(w.size);
    let col = Math.max(1, Math.min(t.col, misura.colonne));
    let row = Math.max(1, Math.min(t.row, misura.righe));
    ({ col, row } = _correggiTagliaZonaIcona(col, row));
    col = Math.min(col, misura.colonne);
    row = Math.min(row, misura.righe);
    return { col, row };
}

function _tagliaAspettoWidget(w, misura) {
    return _tagliaEffettiva(w, { colonne: Math.max(misura.colonne, COLONNE_GRIGLIA_WIDGET), righe: misura.righe });
}

function _distribuisciWidgetInPagine(visibili, misura) {
    const { colonne, righe } = misura;
    const pagine = [];
    let corrente = null;
    let occupate = null;
    let curR = 0, curC = 0;

    const nuovaPagina = () => {
        corrente = [];
        pagine.push(corrente);
        occupate = [];
        curR = 0; curC = 0;
    };
    const libero = (r, c, dr, dc) => {
        for (let i = r; i < r + dr; i++) {
            const riga = occupate[i];
            if (!riga) continue;
            for (let j = c; j < c + dc; j++) if (riga[j]) return false;
        }
        return true;
    };
    const segna = (r, c, dr, dc) => {
        for (let i = r; i < r + dr; i++) {
            if (!occupate[i]) occupate[i] = [];
            for (let j = c; j < c + dc; j++) occupate[i][j] = true;
        }
    };

    nuovaPagina();
    let paginaVoluta = 0;

    visibili.forEach(v => {
        const voluta = Math.max(paginaVoluta, v.pagina || 0);
        while (pagine.length - 1 < voluta) nuovaPagina();
        paginaVoluta = voluta;

        const t = _leggiTaglia(v.size);
        const dc = Math.min(t.col, colonne);
        const dr = t.row;

        const drEffettivo = Math.min(dr, righe);

        let messo = false;
        while (!messo) {
            let r = curR, c = curC;
            let trovato = null;
            for (; r + drEffettivo <= righe && !trovato; r++, c = 0) {
                for (; c + dc <= colonne; c++) {
                    if (libero(r, c, drEffettivo, dc)) { trovato = { r, c }; break; }
                }
            }
            if (trovato) {
                segna(trovato.r, trovato.c, drEffettivo, dc);
                curR = trovato.r; curC = trovato.c + dc;
                corrente.push(v);
                messo = true;
            } else {
                nuovaPagina();
                paginaVoluta = pagine.length - 1;
            }
        }
    });

    return pagine;
}

let _paginePresenti = 1;

function _numeroPagineWidget() {
    const visibili = (_layoutWidget || []).filter(w => w.visibile);
    const maxPagina = visibili.reduce((m, w) => Math.max(m, w.pagina || 0), 0);
    const base = Math.max(maxPagina + 1, _paginePresenti);
    return base + (_editModeWidget ? 1 : 0);
}

function _compattaPagineWidget() {
    const visibili = (_layoutWidget || []).filter(w => w.visibile);
    const usate = [...new Set(visibili.map(w => w.pagina || 0))].sort((a, b) => a - b);
    const mappa = {};
    usate.forEach((vecchia, nuova) => { mappa[vecchia] = nuova; });
    let cambiato = false;
    visibili.forEach(w => {
        const nuova = mappa[w.pagina || 0];
        if (nuova !== (w.pagina || 0)) { w.pagina = nuova; cambiato = true; }
    });
    return cambiato;
}

function _spostaWidgetInPagina(instanceId, delta) {
    const w = (_layoutWidget || []).find(x => x.instanceId === instanceId);
    if (!w) return;
    const nuova = Math.max(0, (w.pagina || 0) + delta);
    if (nuova === (w.pagina || 0)) return;
    w.pagina = nuova;
    _salvaLayoutWidget();
    _paginaWidgetCorrente = nuova;
    _menuSpostaWidgetApertoId = null;
    renderWidgetHome();
}

function _spostaWidgetNellaPagina(instanceId, direzione) {
    if (!_layoutWidget) return;
    const w = _layoutWidget.find(x => x.instanceId === instanceId);
    if (!w) return;
    const pagina = w.pagina || 0;
    const compagni = _layoutWidget.filter(x => x.visibile && (x.pagina || 0) === pagina);
    const pos = compagni.indexOf(w);
    const altro = compagni[pos + direzione];
    if (!altro) return;
    const iA = _layoutWidget.indexOf(w);
    const iB = _layoutWidget.indexOf(altro);
    _layoutWidget[iA] = altro;
    _layoutWidget[iB] = w;
    _salvaLayoutWidget();
    _menuSpostaWidgetApertoId = null;
    renderWidgetHome();
}

function _vaiAllaPaginaWidget(indice, istantaneo) {
    const cont = document.getElementById('phoneWidgetPagine');
    if (!cont) return;
    const max = _numeroPagineWidget() - 1;
    _paginaWidgetCorrente = Math.max(0, Math.min(max, indice));
    cont.scrollTo({ left: _paginaWidgetCorrente * cont.clientWidth, behavior: istantaneo ? 'auto' : 'smooth' });
    _aggiornaPuntiniPagine();
}

function _gestisciScrollPaginePagineWidget() {
    const cont = document.getElementById('phoneWidgetPagine');
    if (!cont) return;
    const indice = Math.round(cont.scrollLeft / Math.max(cont.clientWidth, 1));
    if (indice === _paginaWidgetCorrente) return;
    _paginaWidgetCorrente = indice;
    _aggiornaPuntiniPagine();
    _aggiornaTastoFisico();
}

function _vaiAllaPaginaWidgetRelativa(delta) {
    _vaiAllaPaginaWidget(_paginaWidgetCorrente + delta);
}

function _clickPokeballDecorativa(lato) {
    if (document.body.classList.contains('phone-detail-open')) return;
    if (typeof _editModeWidget !== 'undefined' && _editModeWidget) return;
    if (lato === 'sinistra') apriRicercaGlobale();
    else apriDettaglioWidget('inserimento', null);
}

function _aggiornaPuntiniPagine() {
    document.querySelectorAll('#phoneWidgetPuntini .widget-puntino').forEach((el, i) => {
        el.classList.toggle('attivo', i === _paginaWidgetCorrente);
    });
    const frecce = document.querySelectorAll('#phoneWidgetPuntini .widget-pagina-freccia');
    const nPuntini = document.querySelectorAll('#phoneWidgetPuntini .widget-puntino').length;
    if (frecce[0]) frecce[0].disabled = _paginaWidgetCorrente === 0;
    if (frecce[1]) frecce[1].disabled = _paginaWidgetCorrente === nPuntini - 1;
}
