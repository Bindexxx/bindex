// ── ui/phone.ui.js ─────────────────────────────────────────────────────
// Home "smartphone simulato": griglia di widget dentro una cornice
// (placeholder oggi in assets/frame/, in futuro immagine scelta
// dall'utente da un bucket Supabase — vedi _applicaCorniceUtente più
// sotto), ognuno apre a schermo intero (con tasto indietro) esattamente
// la stessa view-section che oggi apriva la voce corrispondente nel
// vecchio menu laterale, oppure un'azione diretta (vedi 'azione' nel
// catalogo). Nessuna nuova query Supabase: ogni widget riusa dati/
// funzioni già esistenti in home.ui.js/navigation.ui.js/queue.repository.js
// — vedi commento su ogni preview.
//
// Dipende da: state globale carteReali (state/cards.state.js), switchTab/
// currentMode/openQrModal (ui/navigation.ui.js), _contaCodaErrori/
// _elencoPrezziScaduti/_dispositiviAttiviOra/apriFlipCardHome/
// aggiornaStatCardHome/caricaAvvisiHome (ui/home.ui.js), prefWidgetLayoutGet/
// Set (data/preferences.repository.js), _urlImmagineVisualizzabile/
// escapeHtml (utils condivisi).
//
// DUE WIDGET BLOCCATI (Claudio, sessione 2026-08-24): "Match trovati" ed
// "Estensione: stato rapido" compaiono nel catalogo ma con dati statici —
// il primo richiede il corpo completo di caricaMatch()/queue.ui.js (finora
// letti solo i nomi delle funzioni, mai il contenuto), il secondo richiede
// extension.ui.js (mai aperto in questa sessione). Niente inventato: sono
// segnalati con bloccato:true, vedi resa in renderWidgetHome().

// ── CATALOGO WIDGET DISPONIBILI ──────────────────────────────────────────
const CATALOGO_WIDGET = {
    home: {
        titolo: 'Home', icona: 'fa-house',
        preview: () => {
            const collezione = carteReali.filter(c => c.stato === 'collezione');
            const qty = collezione.reduce((s, c) => s + (c.qty || 0), 0);
            const valore = collezione.reduce((s, c) => s + (c.price || 0) * (c.qty || 0), 0);
            return { righe: [`${qty} carte`, `€ ${valore.toFixed(2)}`] };
        },
    },
    visualizzazione: {
        titolo: 'Visualizzazione', icona: 'fa-list-check',
        preview: () => {
            const n = carteReali.filter(c => c.stato === 'collezione').length;
            return { righe: [`${n} carte totali`] };
        },
    },
    inserimento: {
        titolo: 'Inserimento', icona: 'fa-plus',
        // Riusa _contaCodaErrori() già definita in home.ui.js — stesso
        // conteggio già mostrato nell'avviso Home, nessuna query duplicata.
        preview: async () => {
            const n = await _contaCodaErrori();
            return { righe: [n > 0 ? `${n} da correggere` : 'Tutto in ordine'], stato: n > 0 ? 'allerta' : 'ok' };
        },
    },
    prezzi: {
        titolo: 'Prezzi', icona: 'fa-chart-line',
        // _elencoPrezziScaduti è popolato da caricaAvvisiHome() (già
        // richiamata a intervalli da avviaPollingWidgetHome più sotto) —
        // qui lo leggiamo soltanto. Forma confermata in home.ui.js:
        // {name, code, ultimoTesto} — la prima riga come seconda riga del
        // widget, non un dato nuovo.
        preview: () => {
            const lista = (typeof _elencoPrezziScaduti !== 'undefined' && _elencoPrezziScaduti) ? _elencoPrezziScaduti : [];
            if (lista.length === 0) return { righe: ['Tutti aggiornati'], stato: 'ok' };
            return { righe: [`${lista.length} da aggiornare`, lista[0].name || ''], stato: 'allerta' };
        },
    },
    scambio: {
        titolo: 'Scambio', icona: 'fa-right-left',
        preview: () => {
            const n = carteReali.filter(c => c.stato === 'collezione' && c.location === 'SCAMBIO').length;
            return { righe: [`${n} in scambio`] };
        },
    },
    wishlist: {
        titolo: 'Wishlist', icona: 'fa-bookmark',
        // Stesso identico filtro "sotto obiettivo" di caricaAvvisiHome in
        // home.ui.js — replicato qui (dati già in carteReali, nessuna
        // query nuova), non indovinato.
        preview: () => {
            const tutte = carteReali.filter(c => c.tabella === 'wishlist');
            const sottoObiettivo = tutte.filter(c => c.prezzoObiettivo != null && c.price > 0 && c.price <= c.prezzoObiettivo);
            const righe = [`${tutte.length} desiderate`];
            if (sottoObiettivo.length > 0) righe.push(`🎯 ${sottoObiettivo.length} sotto obiettivo`);
            return { righe, stato: sottoObiettivo.length > 0 ? 'ok' : undefined };
        },
    },
    binder: {
        titolo: 'Binder', icona: 'fa-layer-group',
        preview: () => ({ righe: ['In primo piano'] }),
    },
    sealed: {
        titolo: 'Sealed', icona: 'fa-box-archive',
        preview: () => {
            const prodotti = carteReali.filter(c => c.stato === 'collezione' && c.tipo === 'sealed');
            if (prodotti.length === 0) return { righe: ['Nessun prodotto'] };
            const inEvidenza = prodotti.slice().sort((a, b) => (b.price || 0) - (a.price || 0))[0];
            return { righe: [`${prodotti.length} prodotti`, inEvidenza.name || ''] };
        },
    },
    impostazioni: {
        titolo: 'Impostazioni', icona: 'fa-gear',
        preview: () => ({ righe: ['Account, tema, estensione'] }),
    },

    ultima_carta: {
        titolo: 'Ultima carta', icona: 'fa-clock-rotate-left',
        // Stesso ordinamento di caricaAttivitaRecentiHome in home.ui.js
        // (createdAt decrescente), qui solo la prima — dati già in
        // carteReali. Click apre il flip-modal esistente (apriFlipCardHome
        // in home.ui.js), non un popup nuovo.
        preview: () => {
            const collezione = carteReali.filter(c => c.stato === 'collezione');
            if (collezione.length === 0) return { righe: ['Nessuna carta'] };
            const ultima = collezione.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0];
            return { righe: [ultima.name || ''], immagine: ultima.immagine, cardId: ultima.id };
        },
        azione: (dati) => { if (dati && dati.cardId != null) apriFlipCardHome(dati.cardId); },
    },
    carta_del_giorno: {
        titolo: 'Carta del giorno', icona: 'fa-wand-magic-sparkles',
        // Pescata a caso una volta per sessione (non ad ogni polling, o
        // "salterebbe" ogni 15s) — vedi _cartaDelGiornoId più sotto. Click
        // apre lo stesso flip-modal riusato da tutto il sito.
        preview: () => {
            const collezione = carteReali.filter(c => c.stato === 'collezione');
            if (collezione.length === 0) return { righe: ['Nessuna carta'] };
            if (_cartaDelGiornoId == null || !collezione.find(c => String(c.id) === String(_cartaDelGiornoId))) {
                _cartaDelGiornoId = collezione[Math.floor(Math.random() * collezione.length)].id;
            }
            const carta = collezione.find(c => String(c.id) === String(_cartaDelGiornoId));
            return { righe: [carta.name || ''], immagine: carta.immagine, cardId: carta.id };
        },
        azione: (dati) => { if (dati && dati.cardId != null) apriFlipCardHome(dati.cardId); },
    },
    gruppo_attivo: {
        titolo: 'Gruppo', icona: 'fa-users',
        // Riusa _dispositiviAttiviOra() (home.ui.js) — solo sì/no per
        // scelta esplicita di Claudio (privacy), non un elenco nominale.
        preview: async () => {
            const attivo = await _dispositiviAttiviOra();
            return { righe: [attivo ? 'Qualcuno al lavoro ora' : 'Nessuno al momento'], stato: attivo ? 'ok' : undefined };
        },
    },
    location: {
        titolo: 'Location', icona: 'fa-map-pin',
        preview: () => {
            const collezione = carteReali.filter(c => c.stato === 'collezione');
            const conteggi = {};
            collezione.forEach(c => { const k = c.location || '—'; conteggi[k] = (conteggi[k] || 0) + 1; });
            const top = Object.entries(conteggi).sort((a, b) => b[1] - a[1]).slice(0, 2);
            if (top.length === 0) return { righe: ['Nessuna carta'] };
            return { righe: top.map(([k, v]) => `${k}: ${v}`) };
        },
    },
    suggerimento: {
        titolo: 'Prossima azione', icona: 'fa-lightbulb',
        // Stessa priorità/stessi segnali di _renderAvvisiHome in
        // home.ui.js (coda errori → wishlist sotto obiettivo → prezzi
        // scaduti → gruppo al lavoro), qui presa solo la prima voce attiva
        // invece di mostrarle tutte.
        preview: async () => {
            const codaErrori = await _contaCodaErrori();
            if (codaErrori > 0) return { righe: [`${codaErrori} carte da correggere`], stato: 'allerta', tabSuggerito: 'inserimento' };

            const wishlistSottoTarget = carteReali.filter(c => c.tabella === 'wishlist' && c.prezzoObiettivo != null && c.price > 0 && c.price <= c.prezzoObiettivo);
            if (wishlistSottoTarget.length > 0) return { righe: [`${wishlistSottoTarget.length} in wishlist sotto obiettivo`], stato: 'ok', tabSuggerito: 'wishlist' };

            const lista = (typeof _elencoPrezziScaduti !== 'undefined' && _elencoPrezziScaduti) ? _elencoPrezziScaduti : [];
            if (lista.length > 0) return { righe: [`${lista.length} prezzi da aggiornare`], stato: 'allerta', tabSuggerito: 'prezzi' };

            const alLavoro = await _dispositiviAttiviOra();
            if (alLavoro) return { righe: ['Il gruppo sta lavorando'], tabSuggerito: 'home' };

            return { righe: ['Tutto in ordine'], stato: 'ok', tabSuggerito: 'home' };
        },
        azione: (dati) => { switchTab((dati && dati.tabSuggerito) || 'home', null); document.body.classList.add('phone-detail-open'); _posizionaContainerNelloSchermo(); },
    },
    orologio: {
        titolo: 'Orologio', icona: 'fa-clock', decorativo: true,
        preview: () => {
            const ora = new Date();
            return { righe: [ora.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })] };
        },
    },
    aggiungi_carta: {
        titolo: 'Aggiungi carta', icona: 'fa-circle-plus',
        preview: () => ({ righe: ['Scorciatoia rapida'] }),
        tab: 'inserimento',
    },
    condividi: {
        titolo: 'Condividi', icona: 'fa-share-nodes',
        // Riusa openQrModal() (navigation.ui.js) — dipende dal
        // currentMode globale già esistente per decidere quale pagina
        // pubblica condividere (scambio/wishlist/sealed). Da un widget
        // home, senza una tab attiva di riferimento, la scelta di default
        // è 'scambio' — arbitraria, dimmi se preferisci un'altra pagina o
        // un selettore.
        preview: () => ({ righe: ['Link scambio (QR)'] }),
        azione: () => { currentMode = 'scambio'; openQrModal(); },
    },

    // ── BLOCCATI: dati statici finché non leggo i file mancanti ──────────
    match: {
        titolo: 'Match trovati', icona: 'fa-handshake', bloccato: true,
        preview: () => ({ righe: ['In attesa di verifica'] }),
    },
    estensione: {
        titolo: 'Estensione', icona: 'fa-plug', bloccato: true,
        preview: () => ({ righe: ['In attesa di verifica'] }),
    },
};

const ORDINE_WIDGET_DEFAULT = ['home', 'visualizzazione', 'inserimento', 'prezzi', 'scambio', 'wishlist', 'binder', 'sealed', 'impostazioni'];
const MAX_WIDGET_VISIBILI = 10;
const TAGLIE_CICLO = ['1x1', '2x1', '1x2', '2x2']; // ordine di ciclo del ridimensionamento

let _layoutWidget = null; // [{id, visibile, size}], ordine = ordine di visualizzazione
let _editModeWidget = false;
let _densitaCompatta = false;
let _pollingWidgetInterval = null;
let _pollingWidgetIntervalLento = null;
let _resizeCorniceTimeout = null;
let _cartaDelGiornoId = null;
let _primoRenderWidgetFatto = false; // per la cascata d'ingresso, una sola volta per sessione

// ── LAYOUT: caricamento/salvataggio per-dispositivo ──────────────────────
function _caricaLayoutWidget() {
    let salvato = null;
    try { salvato = JSON.parse(prefWidgetLayoutGet() || 'null'); } catch (_) { salvato = null; }

    if (!Array.isArray(salvato) || salvato.length === 0) {
        _layoutWidget = ORDINE_WIDGET_DEFAULT.map(id => ({ id, visibile: true, size: '1x1' }));
        return;
    }
    const validi = salvato
        .filter(w => CATALOGO_WIDGET[w.id])
        .map(w => ({ id: w.id, visibile: !!w.visibile, size: TAGLIE_CICLO.includes(w.size) ? w.size : '1x1' }));
    Object.keys(CATALOGO_WIDGET).forEach(id => {
        if (!validi.find(w => w.id === id)) validi.push({ id, visibile: false, size: '1x1' });
    });
    _layoutWidget = validi;
}

function _salvaLayoutWidget() {
    prefWidgetLayoutSet(JSON.stringify(_layoutWidget));
}

// ── DENSITÀ (compatta/comoda) ─────────────────────────────────────────
function toggleDensitaWidgetHome() {
    _densitaCompatta = !_densitaCompatta;
    document.getElementById('phoneWidgetHomeWrap').classList.toggle('densita-compatta', _densitaCompatta);
}

// ── VIBRAZIONE (Claudio: drag & peek con feedback aptico) ────────────────
function _vibraSeSupportato(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) { /* niente, non è critico */ }
}

// ── RENDER GRIGLIA HOME ──────────────────────────────────────────────────
async function renderWidgetHome() {
    if (!_layoutWidget) _caricaLayoutWidget();

    const grid = document.getElementById('phoneWidgetGrid');
    if (!grid) return;

    const visibili = _layoutWidget.filter(w => w.visibile);
    const primoRender = !_primoRenderWidgetFatto;

    const tessere = await Promise.all(visibili.map(async (w, indice) => {
        const def = CATALOGO_WIDGET[w.id];
        if (!def) return '';
        let anteprima = { righe: ['—'] };
        if (!def.bloccato) {
            try { anteprima = await def.preview(); } catch (e) { console.error('Errore preview widget ' + w.id + ':', e); }
        } else {
            anteprima = def.preview();
        }

        const classeStato = anteprima.stato === 'allerta' ? 'widget-tile-allerta' : (anteprima.stato === 'ok' ? 'widget-tile-ok' : '');
        const classeCascata = primoRender ? 'widget-tile-entrata' : '';
        const stileRitardo = primoRender ? `style="animation-delay:${Math.min(indice * 45, 400)}ms"` : '';

        const controlliEdit = _editModeWidget ? `
            <div class="widget-edit-controls" onclick="event.stopPropagation()">
                <button type="button" onclick="_spostaWidget(${indice}, -1)" title="Sposta su" ${indice === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
                <button type="button" onclick="_spostaWidget(${indice}, 1)" title="Sposta giù" ${indice === visibili.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
                <button type="button" onclick="_nascondiWidget('${w.id}')" title="Rimuovi dalla home" class="widget-edit-remove"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="widget-resize-handle" data-widget-id="${w.id}" title="Trascina per ridimensionare"><i class="fa-solid fa-up-right-and-down-left-from-center"></i></div>` : '';

        // Badge Pokédex solo per il primo numero trovato in "righe" (regex
        // semplice, non intacca il testo se non trova nulla).
        const primoNumero = (anteprima.righe[0] || '').match(/\d+/);
        const badge = primoNumero ? `<div class="widget-badge">${primoNumero[0]}</div>` : '';

        const rigaImmagine = anteprima.immagine
            ? `<div class="widget-tile-thumb-row"><img class="widget-tile-thumb" src="${_urlImmagineVisualizzabile(anteprima.immagine, 96) || ''}" alt="" onerror="this.style.display='none';"></div>`
            : '';

        const azioneClick = _editModeWidget || def.decorativo ? '' : `onclick="_eseguiAzioneWidget('${w.id}')"`;

        return `
            <div class="widget-tile ${classeStato} ${classeCascata} widget-size-${w.size}" ${stileRitardo} data-widget-id="${w.id}" data-widget-index="${indice}" ${azioneClick}>
                ${controlliEdit}
                ${badge}
                <i class="fa-solid ${def.icona} widget-tile-icon"></i>
                <div class="widget-tile-titolo">${def.titolo}</div>
                ${rigaImmagine}
                <div class="widget-tile-righe">${anteprima.righe.map(r => `<span>${r}</span>`).join('')}</div>
            </div>`;
    }));

    let tileAggiungi = '';
    if (_editModeWidget && visibili.length < MAX_WIDGET_VISIBILI) {
        tileAggiungi = `
            <div class="widget-tile widget-tile-aggiungi" onclick="_apriPickerAggiungiWidget()">
                <i class="fa-solid fa-plus widget-tile-icon"></i>
                <div class="widget-tile-titolo">Aggiungi</div>
            </div>`;
    }

    grid.innerHTML = tessere.join('') + tileAggiungi;
    _primoRenderWidgetFatto = true;

    if (_editModeWidget) _attivaDragEResize();
}

// Esegue l'azione del widget: 'azione' personalizzata nel catalogo se
// presente (riceve gli stessi dati calcolati da preview, per widget come
// carta del giorno/ultima carta che devono sapere QUALE carta aprire),
// altrimenti apre come dettaglio la tab indicata in 'tab' o l'id stesso.
async function _eseguiAzioneWidget(id) {
    const def = CATALOGO_WIDGET[id];
    if (!def || def.bloccato) return;
    if (def.azione) {
        let dati = null;
        try { dati = await def.preview(); } catch (_) { dati = null; }
        def.azione(dati);
        return;
    }
    apriDettaglioWidget(def.tab || id);
}

function _spostaWidget(indiceVisibile, direzione) {
    const visibili = _layoutWidget.filter(w => w.visibile);
    const target = visibili[indiceVisibile];
    const idxReale = _layoutWidget.indexOf(target);
    const idxScambio = _layoutWidget.indexOf(visibili[indiceVisibile + direzione]);
    if (idxScambio === undefined || idxScambio < 0) return;
    [_layoutWidget[idxReale], _layoutWidget[idxScambio]] = [_layoutWidget[idxScambio], _layoutWidget[idxReale]];
    _salvaLayoutWidget();
    renderWidgetHome();
}

function _nascondiWidget(id) {
    const w = _layoutWidget.find(x => x.id === id);
    if (w) w.visibile = false;
    _salvaLayoutWidget();
    renderWidgetHome();
}

function _apriPickerAggiungiWidget() {
    const nascosti = _layoutWidget.filter(w => !w.visibile);
    const container = document.getElementById('widgetPickerLista');
    if (nascosti.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Nessun altro widget disponibile.</p>';
    } else {
        container.innerHTML = nascosti.map(w => `
            <div class="widget-picker-riga" onclick="_mostraWidget('${w.id}')">
                <i class="fa-solid ${CATALOGO_WIDGET[w.id].icona}"></i> ${CATALOGO_WIDGET[w.id].titolo}
            </div>`).join('');
    }
    document.getElementById('widgetPickerModal').style.display = 'flex';
}

function _chiudiPickerAggiungiWidget() {
    document.getElementById('widgetPickerModal').style.display = 'none';
}

function _mostraWidget(id) {
    const visibiliCount = _layoutWidget.filter(w => w.visibile).length;
    if (visibiliCount >= MAX_WIDGET_VISIBILI) { alert(`Massimo ${MAX_WIDGET_VISIBILI} widget in home.`); return; }
    const w = _layoutWidget.find(x => x.id === id);
    if (w) w.visibile = true;
    _salvaLayoutWidget();
    _chiudiPickerAggiungiWidget();
    renderWidgetHome();
}

function toggleModificaWidgetHome() {
    _editModeWidget = !_editModeWidget;
    document.getElementById('btnModificaWidgetHome').classList.toggle('attivo', _editModeWidget);
    renderWidgetHome();
}

// ── DRAG & DROP (riordino) + RIDIMENSIONAMENTO — Pointer Events ─────────
// Un solo set di listener via Pointer Events (non HTML5 Drag&Drop, che su
// touch è inaffidabile) funziona identico con mouse e dito. Attivati solo
// in modalità modifica, ri-agganciati ad ogni renderWidgetHome() perché il
// markup viene rigenerato da zero ogni volta.
let _dragState = null;
let _resizeState = null;
let _peekTimeout = null;

function _attivaDragEResize() {
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
    _resizeState = { id, startX: e.clientX, startY: e.clientY };
    window.addEventListener('pointermove', _onResizeHandlePointerMove);
    window.addEventListener('pointerup', _onResizeHandlePointerUp, { once: true });
}

function _onResizeHandlePointerMove(e) {
    if (!_resizeState) return;
    const dx = e.clientX - _resizeState.startX;
    const dy = e.clientY - _resizeState.startY;
    // Soglia di 40px prima di considerare il gesto un "passo" di
    // ridimensionamento — evita di ciclare la taglia per un tremolio.
    if (Math.abs(dx) < 40 && Math.abs(dy) < 40) return;

    const w = _layoutWidget.find(x => x.id === _resizeState.id);
    if (!w) return;
    const idxAttuale = TAGLIE_CICLO.indexOf(w.size);
    const cresce = dx + dy > 0;
    const nuovoIdx = Math.max(0, Math.min(TAGLIE_CICLO.length - 1, idxAttuale + (cresce ? 1 : -1)));
    if (TAGLIE_CICLO[nuovoIdx] !== w.size) {
        w.size = TAGLIE_CICLO[nuovoIdx];
        _resizeState.startX = e.clientX;
        _resizeState.startY = e.clientY;
        _salvaLayoutWidget();
        renderWidgetHome();
        _attivaDragEResize();
    }
}

function _onResizeHandlePointerUp() {
    _resizeState = null;
    window.removeEventListener('pointermove', _onResizeHandlePointerMove);
}

function _onWidgetPointerDown(e) {
    if (e.target.closest('.widget-edit-controls') || e.target.closest('.widget-resize-handle')) return;
    const tile = e.currentTarget;
    const id = tile.dataset.widgetId;

    // Tocco lungo (peek) — solo se poi NON si trasforma in un vero drag
    // (annullato in _onWidgetPointerMove appena il dito si sposta).
    _peekTimeout = setTimeout(() => { _mostraPeek(id, tile); _vibraSeSupportato(8); }, 480);

    _dragState = { id, tile, startX: e.clientX, startY: e.clientY, iniziato: false };
    window.addEventListener('pointermove', _onWidgetPointerMove);
    window.addEventListener('pointerup', _onWidgetPointerUp, { once: true });
}

function _onWidgetPointerMove(e) {
    if (!_dragState) return;
    const dx = Math.abs(e.clientX - _dragState.startX);
    const dy = Math.abs(e.clientY - _dragState.startY);

    if (!_dragState.iniziato) {
        if (dx < 10 && dy < 10) return; // ancora un tocco fermo, non un drag
        clearTimeout(_peekTimeout);
        _nascondiPeek();
        _dragState.iniziato = true;
        _dragState.tile.classList.add('widget-tile-dragging');
        _vibraSeSupportato(12);
    }

    // Individua su quale altra tessera è passato il dito/mouse, e scambia
    // subito la posizione nell'array — il ri-render successivo mostra lo
    // scambio, semplice e robusto (nessuna libreria di drag&drop esterna).
    const sotto = document.elementFromPoint(e.clientX, e.clientY);
    const tileSotto = sotto ? sotto.closest('.widget-tile[data-widget-id]') : null;
    if (tileSotto && tileSotto !== _dragState.tile) {
        const idA = _dragState.id;
        const idB = tileSotto.dataset.widgetId;
        const visibili = _layoutWidget.filter(w => w.visibile);
        const idxA = _layoutWidget.indexOf(visibili.find(w => w.id === idA));
        const idxB = _layoutWidget.indexOf(visibili.find(w => w.id === idB));
        if (idxA >= 0 && idxB >= 0) {
            [_layoutWidget[idxA], _layoutWidget[idxB]] = [_layoutWidget[idxB], _layoutWidget[idxA]];
            _salvaLayoutWidget();
            renderWidgetHome();
            const nuovaTile = document.querySelector(`.widget-tile[data-widget-id="${idA}"]`);
            if (nuovaTile) { nuovaTile.classList.add('widget-tile-dragging'); _dragState.tile = nuovaTile; }
        }
    }
}

function _onWidgetPointerUp() {
    clearTimeout(_peekTimeout);
    _nascondiPeek();
    if (_dragState && _dragState.iniziato) {
        _vibraSeSupportato(6);
        const tile = document.querySelector(`.widget-tile[data-widget-id="${_dragState.id}"]`);
        if (tile) tile.classList.remove('widget-tile-dragging');
    }
    _dragState = null;
    window.removeEventListener('pointermove', _onWidgetPointerMove);
}

// ── PEEK — anteprima al tocco lungo, senza aprire il popup fullscreen ────
function _mostraPeek(id, tileEl) {
    const def = CATALOGO_WIDGET[id];
    if (!def) return;
    const overlay = document.getElementById('widgetPeekOverlay');
    const rect = tileEl.getBoundingClientRect();
    overlay.innerHTML = `<div class="widget-tile-titolo"><i class="fa-solid ${def.icona}"></i> ${def.titolo}</div><div class="widget-tile-righe" id="widgetPeekRighe">Caricamento…</div>`;
    overlay.style.left = Math.max(8, Math.min(window.innerWidth - 228, rect.left)) + 'px';
    overlay.style.top = Math.max(8, rect.top - 10) + 'px';
    overlay.style.display = 'block';

    Promise.resolve(def.bloccato ? def.preview() : def.preview()).then(anteprima => {
        const el = document.getElementById('widgetPeekRighe');
        if (el) el.innerHTML = (anteprima.righe || []).map(r => `<span>${r}</span>`).join('<br>');
    }).catch(() => {});
}

function _nascondiPeek() {
    const overlay = document.getElementById('widgetPeekOverlay');
    if (overlay) overlay.style.display = 'none';
}

// ── APERTURA/CHIUSURA DETTAGLIO FULLSCREEN DENTRO IL FRAME ───────────────
function _posizionaContainerNelloSchermo() {
    const schermo = document.getElementById('phoneScreen');
    const container = document.querySelector('.container');
    const btnIndietro = document.getElementById('btnIndietroDettaglioWidget');
    if (!schermo || !container) return;
    const rect = schermo.getBoundingClientRect();
    container.style.top = rect.top + 'px';
    container.style.left = rect.left + 'px';
    container.style.width = rect.width + 'px';
    container.style.height = rect.height + 'px';
    container.style.borderRadius = getComputedStyle(schermo).borderRadius;
    if (btnIndietro) {
        btnIndietro.style.top = (rect.top + 10) + 'px';
        btnIndietro.style.left = (rect.left + 14) + 'px';
    }
}

function apriDettaglioWidget(tabId) {
    switchTab(tabId, null);
    document.body.classList.add('phone-detail-open');
    _posizionaContainerNelloSchermo();
}

function chiudiDettaglioWidget() {
    document.body.classList.remove('phone-detail-open');
    renderWidgetHome();
}

function _gestisciResizeCornice() {
    if (document.body.classList.contains('phone-detail-open')) {
        requestAnimationFrame(_posizionaContainerNelloSchermo);
    }
}
function _gestisciResizeCorniceDebounced() {
    clearTimeout(_resizeCorniceTimeout);
    _resizeCorniceTimeout = setTimeout(_gestisciResizeCornice, 100);
}

// ── CORNICE PERSONALIZZABILE (placeholder oggi, bucket Supabase domani) ──
function _applicaCorniceUtente(urlVerticale, urlOrizzontale) {
    if (urlVerticale) document.getElementById('phoneFrameV').style.backgroundImage = `url('${urlVerticale}')`;
    if (urlOrizzontale) document.getElementById('phoneFrameO').style.backgroundImage = `url('${urlOrizzontale}')`;
}

// ── POLLING ────────────────────────────────────────────────────────────
const INTERVALLO_WIDGET_VELOCE_MS = 15000;
const INTERVALLO_WIDGET_LENTO_MS = 60000;

function avviaPollingWidgetHome() {
    if (_pollingWidgetInterval) clearInterval(_pollingWidgetInterval);
    if (_pollingWidgetIntervalLento) clearInterval(_pollingWidgetIntervalLento);

    _pollingWidgetInterval = setInterval(() => {
        if (!document.body.classList.contains('phone-detail-open') && !_editModeWidget) renderWidgetHome();
    }, INTERVALLO_WIDGET_VELOCE_MS);

    _pollingWidgetIntervalLento = setInterval(async () => {
        if (document.body.classList.contains('phone-detail-open') || _editModeWidget) return;
        try { await caricaAvvisiHome(); } catch (e) { console.error('Errore polling avvisi (widget prezzi/inserimento):', e); }
        renderWidgetHome();
    }, INTERVALLO_WIDGET_LENTO_MS);
}

// ── AVVIO ─────────────────────────────────────────────────────────────
async function initPhoneShell() {
    _caricaLayoutWidget();
    await renderWidgetHome();
    avviaPollingWidgetHome();
    window.addEventListener('resize', _gestisciResizeCorniceDebounced);
    window.addEventListener('orientationchange', _gestisciResizeCornice);
}
