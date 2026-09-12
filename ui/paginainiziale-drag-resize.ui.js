// ═══════════════════════════════════════════════════════════════════════
// PAGINAINIZIALE-DRAG-RESIZE.UI.JS — drag&drop riordino + resize
// interattivo delle tessere (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP 4 del piano di taglio di ui/paginainiziale.ui.js (concordato con
// Claudio il 2026-09-11). Estratto da ui/paginainiziale.ui.js. NESSUNA
// riscrittura del codice esistente: solo spostamento, zero cambi di
// comportamento per l'utente finale.
//
// Contiene: _dragState/_resizeState/_peekTimeout/_riordinoInCorso/
// _listenerChiusuraMenuSpostaAgganciato, _toggleMenuSpostaWidget,
// _chiudiMenuSpostaWidget, _aggiornaMenuSpostaWidget, _attivaDragEResize,
// _onResizeHandlePointerDown/Move/Up, _onWidgetPointerDown/Move/Up,
// _avviaDragVero, _riordinaConAnimazione, _mostraPeek/_nascondiPeek,
// _rettangoloSchermoCornice, _posizionaContainerNelloSchermo.
//
// NOTA: _rettangoloSchermoCornice/_posizionaContainerNelloSchermo sono
// riusate anche da ui/paginainiziale-dettaglio.ui.js (STEP 1) — restano
// QUI (dove sono nate, legate al calcolo del rettangolo cornice durante
// il resize/drag) e vengono chiamate cross-file da apriDettaglioWidget,
// stesso meccanismo già in uso ovunque in questa ristrutturazione.
//
// Dipende da: _layoutWidget, _salvaLayoutWidget, renderWidgetHome,
// _vibraSeSupportato, _tagliaEffettiva/_leggiTaglia (paginazione/kernel).
// Nessuna istruzione qui gira a tempo di caricamento script — l'ordine
// rispetto agli altri file paginainiziale-*.ui.js è indifferente (vedi
// nota identica negli STEP precedenti).
// ───────────────────────────────────────────────────────────────────────

// ── DRAG & DROP (riordino) + RIDIMENSIONAMENTO — Pointer Events ─────────
// Un solo set di listener via Pointer Events (non HTML5 Drag&Drop, che su
// touch è inaffidabile) funziona identico con mouse e dito. Attivati solo
// in modalità modifica, ri-agganciati ad ogni renderWidgetHome() perché il
// markup viene rigenerato da zero ogni volta.
let _dragState = null;
let _resizeState = null;
let _peekTimeout = null;
let _riordinoInCorso = false;
let _listenerChiusuraMenuSpostaAgganciato = false;

// ── MENU A COMPARSA "SPOSTA" (Piano B, Claudio 2026-09-10) ──────────────
// Apre/chiude il menu con su/giù/pagina prec/succ per UN widget alla
// volta. Il trascinamento resta il modo primario di riordinare; questo
// menu è il ripiego per chi non vuole/non può trascinare (es. spostamenti
// precisi, o dispositivi dove il drag è scomodo).
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
    // Chiude il menu "sposta" al click fuori — agganciato una volta sola
    // (questa funzione viene richiamata ad ogni render): i click DENTRO
    // .widget-edit-controls/.widget-menu-sposta non arrivano mai qui
    // grazie all'onclick="event.stopPropagation()" già sul loro markup.
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

// ── RIDIMENSIONAMENTO ─────────────────────────────────────────────────
// FIX (Claudio: "macchinoso e impreciso, non si capisce il senso, si
// finisce per farlo 4x4 senza volerlo"): la versione precedente sommava
// insieme lo spostamento orizzontale e verticale in un unico numero e
// ciclava attraverso 4 taglie fisse ad ogni soglia di 40px superata anche
// nella STESSA gestualità continua — trascinando in una direzione sola,
// avanzava ripetutamente nel ciclo, "scappando" fino a 2×2. Ora larghezza
// e altezza sono due assi INDIPENDENTI, calcolati direttamente dalla
// posizione del dito rispetto all'angolo in alto a sinistra della
// tessera (stessa logica dei quadratini di ridimensionamento su Android:
// il bordo segue il dito 1:1, non "a scatti"), quindi trascinare a
// destra allarga, trascinare in basso allunga, in diagonale fa entrambe
// le cose insieme — mai l'una al posto dell'altra.
function _onResizeHandlePointerDown(e) {
    e.stopPropagation();
    e.preventDefault();
    const id = e.currentTarget.dataset.widgetId;
    const tile = document.querySelector(`.widget-tile[data-widget-id="${id}"]`);
    // Con le pagine multiple le griglie sono N: quella giusta e' quella che
    // contiene QUESTA tessera, non piu' un id unico nel documento.
    const grid = tile ? tile.closest('.widget-griglia') : null;
    const w = _layoutWidget.find(x => x.instanceId === id);
    if (!tile || !grid || !w) return;
    const tileRect = tile.getBoundingClientRect();
    const gridStyle = getComputedStyle(grid);
    const numColonneGriglia = gridStyle.gridTemplateColumns.split(' ').filter(Boolean).length;
    const gap = parseFloat(gridStyle.columnGap) || 0;
    const rowGap = parseFloat(gridStyle.rowGap) || 0;

    // Dimensione di UNA cella dedotta dalla tessera stessa (che oggi
    // occupa 1-2 celle in ciascun asse): più affidabile che ricalcolare a
    // mano le colonne in px.
    const _ta = _leggiTaglia(w.size);
    const colSpanAttuale = _ta.col;
    const rowSpanAttuale = _ta.row;
    const cellW = (tileRect.width - gap * (colSpanAttuale - 1)) / colSpanAttuale;
    const cellH = (tileRect.height - rowGap * (rowSpanAttuale - 1)) / rowSpanAttuale;

    _resizeState = {
        id, originLeft: tileRect.left, originTop: tileRect.top,
        cellW, cellH, gap, rowGap,
        maxColSpan: Math.max(1, numColonneGriglia),
        // Tetto in altezza = quante righe stanno nella PAGINA visibile, non
        // nella griglia (che cresce col contenuto). Cosi' "un widget solo
        // che riempie la pagina" (Claudio) e' esattamente il massimo
        // raggiungibile trascinando, e non si puo' andare oltre lo schermo.
        maxRowSpan: (() => {
            const wrap = grid.closest('.widget-pagina') || document.getElementById('phoneWidgetHomeWrap') || grid.parentElement;
            const hVisibile = wrap ? wrap.clientHeight : 0;
            const cellHTot = cellH + rowGap;
            if (!hVisibile || cellHTot <= 0) return RIGHE_MAX_WIDGET;
            return Math.max(1, Math.min(RIGHE_MAX_WIDGET, Math.floor((hVisibile + rowGap) / cellHTot)));
        })(),
    };
    tile.classList.add('widget-tile-resizing');
    window.addEventListener('pointermove', _onResizeHandlePointerMove);
    // FIX (2026-09-01): serve ANCHE pointercancel, non solo pointerup. Se il
    // gesto viene interrotto dal sistema (gesto di navigazione del telefono,
    // notifica in arrivo, cambio scheda a metà trascinamento) il browser
    // manda pointercancel e non manderà mai pointerup: senza questa riga il
    // listener di pointermove restava agganciato per sempre e _resizeState
    // non veniva mai azzerato, lasciando la tessera bloccata in stato
    // "in ridimensionamento" fino al ricaricamento della pagina. Il libro
    // sfogliabile del Binder (_libroInitGesti, ui/binder.ui.js) gestiva già
    // entrambi gli eventi, qui mancava.
    window.addEventListener('pointerup', _onResizeHandlePointerUp, { once: true });
    window.addEventListener('pointercancel', _onResizeHandlePointerUp, { once: true });
}

function _onResizeHandlePointerMove(e) {
    if (!_resizeState) return;
    const { id, originLeft, originTop, cellW, cellH, gap, rowGap, maxColSpan, maxRowSpan } = _resizeState;

    // Quante celle sono "coperte" dalla posizione del dito, arrotondato
    // alla cella più vicina — segue il movimento in tempo reale, ogni
    // asse per conto suo. Qui NON clampiamo subito a un minimo di 1: il
    // valore "grezzo" (anche 0 o negativo se trascini molto verso
    // l'angolo opposto) ci serve per sapere se l'utente sta chiedendo di
    // rimpicciolire OLTRE il minimo normale (Claudio: "possono essere
    // rimpiccioliti fino a diventare solo icone come su iphone/android").
    const distX = e.clientX - originLeft + gap / 2;
    const distY = e.clientY - originTop + rowGap / 2;
    const colSpanGrezzo = Math.round(distX / (cellW + gap));
    const rowSpanGrezzo = Math.round(distY / (cellH + rowGap));

    const w = _layoutWidget.find(x => x.instanceId === id);
    if (!w) return;

    // Sotto lo zero su entrambi gli assi (l'utente ha trascinato la
    // maniglia oltre l'angolo opposto della cella) → modalità icona:
    // stessa cella 1×1, ma il contenuto si riduce a sola icona (vedi
    // .widget-tile-mini in index.html). Altrimenti dimensione normale,
    // ed uscire da mini se prima lo era.
    // Il flag 'mini' esplicito non serve piu': con 6 colonne la modalita'
    // icona si ottiene semplicemente restringendo a 1-2 celle, ed e' la
    // taglia stessa a deciderla (vedi _iconaStatica in renderWidgetHome).
    // Trascinare oltre l'angolo opposto porta quindi alla taglia minima
    // reale, 1x1, che ORA e' davvero un'icona da ~55px e non piu' una
    // cella larga mezzo schermo.
    const vuoleMini = false;
    let colSpan = Math.max(1, Math.min(maxColSpan, colSpanGrezzo));
    let rowSpan = Math.max(1, Math.min(maxRowSpan, rowSpanGrezzo));
    // Standard 2x2 in zona icona (vedi _correggiTagliaZonaIcona sopra):
    // impedisce di creare trascinando una striscia tipo 1x6.
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
    // Rimossi entrambi a mano: 'once' toglie solo quello che è scattato
    // davvero, l'altro resterebbe agganciato e se ne accumulerebbe uno ad
    // ogni ridimensionamento.
    window.removeEventListener('pointerup', _onResizeHandlePointerUp);
    window.removeEventListener('pointercancel', _onResizeHandlePointerUp);
}

// ── DRAG & DROP (riordino) ────────────────────────────────────────────
// FIX (Claudio: "innaturale, sistema per assomigliare a iPhone/Android"):
// prima la tessera trascinata restava FERMA nella griglia (solo scala +
// ombra) finché il dito non entrava nell'area di un'altra — lo scambio
// avveniva di scatto con un ri-render completo, senza che nulla seguisse
// davvero il dito. Ora: un "fantasma" (clone della tessera, posizione
// fissa) segue il puntatore 1:1 in tempo reale; la tessera originale
// diventa invisibile ma mantiene il suo posto in griglia (per non far
// saltare il layout); quando il fantasma passa sopra un'altra tessera,
// l'ordine cambia e le tessere si RIPOSIZIONANO CON UN'ANIMAZIONE
// (tecnica FLIP: misura le posizioni prima, cambia l'ordine, anima dalla
// vecchia posizione alla nuova) invece di scattare — stesso effetto di
// "far posto" che si vede spostando le icone su iPhone/Android.
function _onWidgetPointerDown(e) {
    if (e.target.closest('.widget-edit-controls') || e.target.closest('.widget-resize-handle')) return;
    const tile = e.currentTarget;
    const id = tile.dataset.widgetId;

    // Tocco lungo (peek) — annullato in _onWidgetPointerMove appena il
    // gesto si trasforma in un vero drag.
    _peekTimeout = setTimeout(() => { _mostraPeek(id, tile); _vibraSeSupportato(8); }, 480);

    const rect = tile.getBoundingClientRect();
    _dragState = {
        id, startX: e.clientX, startY: e.clientY,
        rectLeft: rect.left, rectTop: rect.top, rectWidth: rect.width, rectHeight: rect.height,
        iniziato: false, ghost: null,
    };
    window.addEventListener('pointermove', _onWidgetPointerMove);
    // FIX (2026-09-01): stesso motivo del ridimensionamento qui sopra — senza
    // pointercancel un gesto interrotto dal sistema lasciava il "fantasma"
    // della tessera appiccicato allo schermo e _dragState mai azzerato.
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
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return; // ancora un tocco fermo, non un drag
        const tileAttuale = document.querySelector(`.widget-tile[data-widget-id="${_dragState.id}"]`);
        if (!tileAttuale) { _dragState = null; return; }
        _avviaDragVero(tileAttuale);
    }

    // Il fantasma segue il dito/mouse esattamente, in tempo reale.
    _dragState.ghost.style.transform = `translate(${dx}px, ${dy}px) scale(1.05)`;

    if (_riordinoInCorso) return; // un riordino con animazione è già in corso, aspetta che finisca
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

// Tecnica FLIP (First-Last-Invert-Play): cattura le posizioni ATTUALI di
// tutte le tessere, scambia l'ordine nell'array, ri-renderizza (async,
// per questo la guardia _riordinoInCorso), poi ogni tessera parte dalla
// SUA vecchia posizione e anima verso quella nuova via transform —
// risultato: le altre tessere scivolano per fare spazio, non scattano.
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

// ── PEEK — anteprima al tocco lungo, senza aprire il popup fullscreen ────
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
        if (el) el.innerHTML = (anteprima.righe || []).map(r => `<span>${r}</span>`).join('<br>');
    }).catch(() => {});
}

function _nascondiPeek() {
    const overlay = document.getElementById('widgetPeekOverlay');
    if (overlay) overlay.style.display = 'none';
}

// ── APERTURA/CHIUSURA DETTAGLIO FULLSCREEN DENTRO IL FRAME ───────────────
// Rettangolo REALE dello schermo dentro la cornice pokedex (#phoneScreen)
// — unica fonte di verità per chiunque debba starci dentro: sia .container
// (ogni widget, sotto) sia l'overlay bustina (vedi _bustinaRicalcolaScale
// in ui/widget-bustina.ui.js, STEP 4 ristrutturazione). Un solo posto dove
// può disallinearsi, non due.
function _rettangoloSchermoCornice() {
    const schermo = document.getElementById('phoneScreen');
    if (!schermo) return null;
    const rect = schermo.getBoundingClientRect();
    const raggio = getComputedStyle(schermo).borderRadius;
    return { top: rect.top, left: rect.left, width: rect.width, height: rect.height, borderRadius: raggio };
}

// RISTRUTTURATA 2026-09-10 (Claudio, istruzione valida per TUTTO il sito,
// non solo bustina): "cornice pokedex" (#phoneFrameBox, l'immagine rosso/
// bianco) deve sempre occupare il massimo spazio disponibile, e TUTTO
// ciò che il sito mostra deve restare CONTENUTO al suo interno. Questo
// ANNULLA la decisione del 2026-08-30 ("il cerchio ma a schermo intero")
// che mandava .container a tutta la finestra del browser ignorando
// completamente la cornice — da oggi .container torna a essere agganciato
// al rettangolo REALE di #phoneScreen (lo "schermo" ritagliato dentro la
// cornice pokedex), esattamente per ogni widget (missioni/valore/
// wishlist/doppioni/sealed/set/binder/bustina/impostazioni, tutti passano
// da qui). Effetto collaterale ACCETTATO da Claudio: su desktop con
// finestre larghe, i widget con tabelle/griglie lunghe (binder, set,
// traguardi, prezzi — segnalati esplicitamente, vedi risposta di Claudio)
// avranno meno spazio orizzontale/verticale reale e faranno più scroll
// interno — nessuna eccezione per ora, da verificare widget per widget
// quando Claudio li prova dal vivo.
function _posizionaContainerNelloSchermo() {
    const container = document.querySelector('.container');
    const r = _rettangoloSchermoCornice();
    if (!container || !r) return;
    container.style.top = r.top + 'px';
    container.style.left = r.left + 'px';
    container.style.width = r.width + 'px';
    container.style.height = r.height + 'px';
    container.style.borderRadius = r.borderRadius;
}

