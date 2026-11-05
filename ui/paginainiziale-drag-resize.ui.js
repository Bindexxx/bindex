// Home: spostamento e ridimensionamento delle tessere.

let _dragState = null;
let _resizeState = null;
let _peekTimeout = null;
let _riordinoInCorso = false;
let _listenerChiusuraMenuSpostaAgganciato = false;

function _toggleMenuSpostaWidget(instanceId, e) {
    if (e) e.stopPropagation();
    _menuSpostaWidgetApertoId = _menuSpostaWidgetApertoId === instanceId ? null : instanceId;
    _aggiornaMenuSpostaWidget();
}
function _chiudiMenuSpostaWidget() {
    if (!_menuSpostaWidgetApertoId) return;
    _menuSpostaWidgetApertoId = null;
    _aggiornaMenuSpostaWidget();
}
function _aggiornaMenuSpostaWidget() {
    document.querySelectorAll('.widget-menu-sposta').forEach(m => {
        m.classList.toggle('aperto', m.id === 'menuSposta_' + _menuSpostaWidgetApertoId);
    });
}

function _attivaDragEResize() {
    if (!_listenerChiusuraMenuSpostaAgganciato) {
        document.addEventListener('click', _chiudiMenuSpostaWidget);
        _listenerChiusuraMenuSpostaAgganciato = true;
    }
    document.querySelectorAll('.widget-tile[data-widget-id]').forEach(tile => {
        tile.addEventListener('pointerdown', _onWidgetPointerDown);
    });
    document.querySelectorAll('.widget-resize-handle').forEach(handle => {
        handle.addEventListener('pointerdown', _onResizeHandlePointerDown);
    });
}

function _onResizeHandlePointerDown(e) {
    e.stopPropagation();
    e.preventDefault();
    const id = e.currentTarget.dataset.widgetId;
    const tile = document.querySelector(`.widget-tile[data-widget-id="${id}"]`);
    const grid = tile ? tile.closest('.widget-griglia') : null;
    const w = _layoutWidget.find(x => x.instanceId === id);
    if (!tile || !grid || !w) return;
    const tileRect = tile.getBoundingClientRect();
    const gridStyle = getComputedStyle(grid);
    const gap = parseFloat(gridStyle.columnGap) || 0;
    const rowGap = parseFloat(gridStyle.rowGap) || 0;

    const colonneVere = _misuraPaginaWidget().colonne;
    const numColonneGriglia = Math.max(colonneVere, COLONNE_GRIGLIA_WIDGET);
    const larghezzaGriglia = grid.clientWidth
        - (parseFloat(gridStyle.paddingLeft) || 0)
        - (parseFloat(gridStyle.paddingRight) || 0);
    const cellW = Math.max(1, (larghezzaGriglia + gap) / numColonneGriglia - gap);

    const _ta = _tagliaEffettiva(w, _misuraPaginaWidget());
    const rowSpanAttuale = _ta.row;
    const cellH = (tileRect.height - rowGap * (rowSpanAttuale - 1)) / rowSpanAttuale;

    _resizeState = {
        id, originLeft: tileRect.left, originTop: tileRect.top,
        cellW, cellH, gap, rowGap,
        maxColSpan: Math.max(1, numColonneGriglia),
        maxRowSpan: (() => {
            const wrap = grid.closest('.widget-pagina') || document.getElementById('phoneWidgetHomeWrap') || grid.parentElement;
            const hVisibile = wrap ? wrap.getBoundingClientRect().height : 0;
            const cellHTot = cellH + rowGap;
            if (!hVisibile || cellHTot <= 0) return RIGHE_MAX_WIDGET;
            return Math.max(1, Math.min(RIGHE_MAX_WIDGET, Math.floor((hVisibile + rowGap) / cellHTot)));
        })(),
    };
    tile.classList.add('widget-tile-resizing');
    window.addEventListener('pointermove', _onResizeHandlePointerMove);
    window.addEventListener('pointerup', _onResizeHandlePointerUp, { once: true });
    window.addEventListener('pointercancel', _onResizeHandlePointerUp, { once: true });
}

function _onResizeHandlePointerMove(e) {
    if (!_resizeState) return;
    const { id, originLeft, originTop, cellW, cellH, gap, rowGap, maxColSpan, maxRowSpan } = _resizeState;

    const distX = e.clientX - originLeft + gap / 2;
    const distY = e.clientY - originTop + rowGap / 2;
    const colSpanGrezzo = Math.round(distX / (cellW + gap));
    const rowSpanGrezzo = Math.round(distY / (cellH + rowGap));

    const w = _layoutWidget.find(x => x.instanceId === id);
    if (!w) return;

    const vuoleMini = false;
    let colSpan = Math.max(1, Math.min(maxColSpan, colSpanGrezzo));
    let rowSpan = Math.max(1, Math.min(maxRowSpan, rowSpanGrezzo));
    ({ col: colSpan, row: rowSpan } = _correggiTagliaZonaIcona(colSpan, rowSpan));
    const nuovaTaglia = `${colSpan}x${rowSpan}`;

    if (w.size !== nuovaTaglia || w.mini !== vuoleMini) {
        w.size = nuovaTaglia;
        w.mini = vuoleMini;
        _salvaLayoutWidget();
        renderWidgetHome();
        const nuovaTile = document.querySelector(`.widget-tile[data-widget-id="${id}"]`);
        if (nuovaTile) nuovaTile.classList.add('widget-tile-resizing');
    }
}

function _onResizeHandlePointerUp() {
    if (_resizeState) {
        const tile = document.querySelector(`.widget-tile[data-widget-id="${_resizeState.id}"]`);
        if (tile) tile.classList.remove('widget-tile-resizing');
    }
    _resizeState = null;
    window.removeEventListener('pointermove', _onResizeHandlePointerMove);
    window.removeEventListener('pointerup', _onResizeHandlePointerUp);
    window.removeEventListener('pointercancel', _onResizeHandlePointerUp);
}

function _onWidgetPointerDown(e) {
    if (e.target.closest('.widget-edit-controls') || e.target.closest('.widget-resize-handle')) return;
    const tile = e.currentTarget;
    const id = tile.dataset.widgetId;

    _peekTimeout = setTimeout(() => { _mostraPeek(id, tile); _vibraSeSupportato(8); }, 480);

    const rect = tile.getBoundingClientRect();
    _dragState = {
        id, startX: e.clientX, startY: e.clientY,
        rectLeft: rect.left, rectTop: rect.top, rectWidth: rect.width, rectHeight: rect.height,
        iniziato: false, ghost: null,
    };
    window.addEventListener('pointermove', _onWidgetPointerMove);
    window.addEventListener('pointerup', _onWidgetPointerUp, { once: true });
    window.addEventListener('pointercancel', _onWidgetPointerUp, { once: true });
}

function _avviaDragVero(tile) {
    clearTimeout(_peekTimeout);
    _nascondiPeek();
    _dragState.iniziato = true;
    _vibraSeSupportato(12);

    const ghost = tile.cloneNode(true);
    ghost.classList.add('widget-tile-ghost');
    ghost.style.position = 'fixed';
    ghost.style.left = _dragState.rectLeft + 'px';
    ghost.style.top = _dragState.rectTop + 'px';
    ghost.style.width = _dragState.rectWidth + 'px';
    ghost.style.height = _dragState.rectHeight + 'px';
    ghost.style.margin = '0';
    ghost.style.pointerEvents = 'none';
    document.body.appendChild(ghost);
    _dragState.ghost = ghost;

    tile.classList.add('widget-tile-nascosta');
}

function _onWidgetPointerMove(e) {
    if (!_dragState) return;
    const dx = e.clientX - _dragState.startX;
    const dy = e.clientY - _dragState.startY;

    if (!_dragState.iniziato) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        const tileAttuale = document.querySelector(`.widget-tile[data-widget-id="${_dragState.id}"]`);
        if (!tileAttuale) { _dragState = null; return; }
        _avviaDragVero(tileAttuale);
    }

    _dragState.ghost.style.transform = `translate(${dx}px, ${dy}px) scale(1.05)`;

    if (_riordinoInCorso) return;
    const sotto = document.elementFromPoint(e.clientX, e.clientY);
    const tileSotto = sotto ? sotto.closest('.widget-tile[data-widget-id]') : null;
    if (tileSotto && tileSotto.dataset.widgetId !== _dragState.id) {
        const idA = _dragState.id;
        const idB = tileSotto.dataset.widgetId;
        const visibili = _layoutWidget.filter(w => w.visibile);
        const idxA = _layoutWidget.indexOf(visibili.find(w => w.instanceId === idA));
        const idxB = _layoutWidget.indexOf(visibili.find(w => w.instanceId === idB));
        if (idxA >= 0 && idxB >= 0) _riordinaConAnimazione(idxA, idxB);
    }
}

async function _riordinaConAnimazione(idxA, idxB) {
    _riordinoInCorso = true;

    const primaRect = {};
    document.querySelectorAll('.widget-tile[data-widget-id]').forEach(t => {
        primaRect[t.dataset.widgetId] = t.getBoundingClientRect();
    });

    [_layoutWidget[idxA], _layoutWidget[idxB]] = [_layoutWidget[idxB], _layoutWidget[idxA]];
    _salvaLayoutWidget();
    await renderWidgetHome();

    const idTrascinato = _dragState ? _dragState.id : null;
    document.querySelectorAll('.widget-tile[data-widget-id]').forEach(t => {
        const id = t.dataset.widgetId;
        if (id === idTrascinato) { t.classList.add('widget-tile-nascosta'); return; }
        const prima = primaRect[id];
        if (!prima) return;
        const dopo = t.getBoundingClientRect();
        const spostX = prima.left - dopo.left;
        const spostY = prima.top - dopo.top;
        if (spostX || spostY) {
            t.style.transition = 'none';
            t.style.transform = `translate(${spostX}px, ${spostY}px)`;
            requestAnimationFrame(() => {
                t.style.transition = 'transform 0.22s ease';
                t.style.transform = '';
            });
        }
    });

    _riordinoInCorso = false;
}

function _onWidgetPointerUp() {
    clearTimeout(_peekTimeout);
    _nascondiPeek();
    if (_dragState && _dragState.iniziato) {
        _vibraSeSupportato(6);
        if (_dragState.ghost) _dragState.ghost.remove();
        const tile = document.querySelector(`.widget-tile[data-widget-id="${_dragState.id}"]`);
        if (tile) tile.classList.remove('widget-tile-nascosta');
    }
    _dragState = null;
    window.removeEventListener('pointermove', _onWidgetPointerMove);
    window.removeEventListener('pointerup', _onWidgetPointerUp);
    window.removeEventListener('pointercancel', _onWidgetPointerUp);
}

function _mostraPeek(instanceId, tileEl) {
    const w = _layoutWidget.find(x => x.instanceId === instanceId);
    const def = w && CATALOGO_WIDGET[w.id];
    if (!def) return;
    const overlay = document.getElementById('widgetPeekOverlay');
    const rect = tileEl.getBoundingClientRect();
    overlay.innerHTML = `<div class="widget-tile-titolo"><i class="fa-solid ${def.icona}"></i> ${def.titolo}</div><div class="widget-tile-righe" id="widgetPeekRighe">Caricamento…</div>`;
    overlay.style.left = Math.max(8, Math.min(window.innerWidth - 228, rect.left)) + 'px';
    overlay.style.top = Math.max(8, rect.top - 10) + 'px';
    overlay.style.display = 'block';

    Promise.resolve(def.preview(w)).then(anteprima => {
        const el = document.getElementById('widgetPeekRighe');
        if (el) el.innerHTML = (anteprima.righe || []).map(r => `<span>${escapeHtml(r)}</span>`).join('<br>');
    }).catch(() => {});
}

function _nascondiPeek() {
    const overlay = document.getElementById('widgetPeekOverlay');
    if (overlay) overlay.style.display = 'none';
}

function _rettangoloSchermoCornice() {
    const schermo = document.getElementById('phoneScreen');
    if (!schermo) return null;
    const rect = schermo.getBoundingClientRect();
    const raggio = getComputedStyle(schermo).borderRadius;
    return { top: rect.top, left: rect.left, width: rect.width, height: rect.height, borderRadius: raggio };
}

function _rettangoloPaginaSottoBarra() {
    const r = _rettangoloSchermoCornice();
    if (!r) return null;
    const schermo = document.getElementById('phoneScreen');
    const barra = document.querySelector('.csb-bar');
    let alto = 0;
    if (barra) {
        const rb = barra.getBoundingClientRect();
        if (rb.height > 0 && rb.bottom > r.top && rb.bottom < r.top + r.height / 2) alto = rb.bottom - r.top;
    }
    const cs = schermo ? getComputedStyle(schermo) : null;
    return {
        top: r.top + alto, left: r.left, width: r.width, height: r.height - alto,
        borderRadius: alto && cs ? `0 0 ${cs.borderBottomRightRadius} ${cs.borderBottomLeftRadius}` : r.borderRadius,
    };
}

function _posizionaContainerNelloSchermo() {
    const container = document.querySelector('.container');
    const r = _rettangoloPaginaSottoBarra();
    if (!container || !r) return;
    container.style.top = r.top + 'px';
    container.style.left = r.left + 'px';
    container.style.width = r.width + 'px';
    container.style.height = r.height + 'px';
    container.style.borderRadius = r.borderRadius;
}
