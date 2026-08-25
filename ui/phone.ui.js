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
// NOTA (Claudio, 2026-08-24): il widget "Home" che c'era qui è stato
// rimosso — la Home ora è la pagina principale del telefono (swipe per
// arrivare ai widget, non più il contrario), non ha più senso aprirla
// come un dettaglio da un widget. Vedi #phoneHomePage in index.html e
// initPhoneShell qui sotto per lo spostamento del nodo #home.
const CATALOGO_WIDGET = {
    visualizzazione: {
        titolo: 'Visualizzazione', icona: 'fa-images',
        preview: () => {
            const n = carteReali.filter(c => c.stato === 'collezione').length;
            return { righe: [`${n} carte totali`] };
        },
    },
    inserimento: {
        titolo: 'Inserimento', icona: 'fa-id-card',
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
    // Multi-Binder (2026-08-25): 'scambio' e 'wishlist' come widget home
    // separati sono stati rimossi — puntavano a switchTab('scambio'/
    // 'wishlist'), view-section che non esistono più in index.html (solo 5
    // restano: visualizzazione/inserimento/prezzi/binder/impostazioni).
    // Erano già inattivi prima di questa sessione. Il loro contenuto vive
    // ora dentro il widget "Binders" sotto, come binder dedicati.
    binder: {
        titolo: 'Binders', icona: 'fa-layer-group',
        // Zero query nuove (stessa filosofia degli altri preview): conta le
        // location distinte già presenti in carteReali + 2 fissi (Wishlist
        // + il binder 'extra', che esistono sempre una volta garantiti) —
        // è una STIMA del numero di binder, non il conteggio esatto letto
        // da bindersQueryTutti() (quello lo fa apriWidgetBinders() appena
        // aperto il widget, qui servirebbe una query in più solo per
        // l'anteprima e non vale il costo).
        preview: () => {
            const locationDistinte = new Set(
                carteReali.filter(c => c.tabella === 'carte' && c.stato === 'collezione' && c.location).map(c => c.location)
            ).size;
            return { righe: [`${locationDistinte + 2} binder`] };
        },
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
            return { righe: [ultima.name || ''], immagine: ultima.immagine, cardId: ultima.id, rarita: ultima.rarita };
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
            return { righe: [carta.name || ''], immagine: carta.immagine, cardId: carta.id, rarita: carta.rarita };
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
            if (wishlistSottoTarget.length > 0) return { righe: [`${wishlistSottoTarget.length} in wishlist sotto obiettivo`], stato: 'ok', tabSuggerito: 'binder' };

            const lista = (typeof _elencoPrezziScaduti !== 'undefined' && _elencoPrezziScaduti) ? _elencoPrezziScaduti : [];
            if (lista.length > 0) return { righe: [`${lista.length} prezzi da aggiornare`], stato: 'allerta', tabSuggerito: 'prezzi' };

            const alLavoro = await _dispositiviAttiviOra();
            if (alLavoro) return { righe: ['Il gruppo sta lavorando'], tabSuggerito: 'home' };

            return { righe: ['Tutto in ordine'], stato: 'ok', tabSuggerito: 'home' };
        },
        azione: (dati, evt) => {
            const tab = (dati && dati.tabSuggerito) || 'home';
            if (tab === 'home') { _vaiAllaPaginaHome(); return; }
            apriDettaglioWidget(tab, evt);
        },
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

const ORDINE_WIDGET_DEFAULT = ['visualizzazione', 'inserimento', 'prezzi', 'binder', 'sealed'];
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
        _layoutWidget = ORDINE_WIDGET_DEFAULT.map(id => ({ id, visibile: true, size: '1x1', mini: false }));
        return;
    }
    const validi = salvato
        .filter(w => CATALOGO_WIDGET[w.id])
        .map(w => ({ id: w.id, visibile: !!w.visibile, size: TAGLIE_CICLO.includes(w.size) ? w.size : '1x1', mini: !!w.mini }));
    Object.keys(CATALOGO_WIDGET).forEach(id => {
        if (!validi.find(w => w.id === id)) validi.push({ id, visibile: false, size: '1x1', mini: false });
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

        // Bordo colorato per rarità SOLO se la carta ha davvero un campo
        // 'rarita' valorizzato (mai confermato nello schema in questa
        // sessione — nessun rischio: se il campo non esiste, la classe
        // semplicemente non si applica e resta il bordo neutro di sempre).
        const classeRarita = anteprima.rarita ? ` widget-tile-thumb-r-${String(anteprima.rarita).toLowerCase().replace(/\s+/g, '_')}` : '';
        const rigaImmagine = anteprima.immagine
            ? `<div class="widget-tile-thumb-row"><img class="widget-tile-thumb${classeRarita}" src="${_urlImmagineVisualizzabile(anteprima.immagine, 96) || ''}" alt="" onerror="this.style.display='none';"></div>`
            : '';

        const azioneClick = _editModeWidget || def.decorativo ? '' : `onclick="_eseguiAzioneWidget('${w.id}', event)"`;

        return `
            <div class="widget-tile ${classeStato} ${classeCascata} widget-size-${w.size} ${w.mini ? 'widget-tile-mini' : ''}" ${stileRitardo} data-widget-id="${w.id}" data-widget-index="${indice}" ${azioneClick}>
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
async function _eseguiAzioneWidget(id, evt) {
    const def = CATALOGO_WIDGET[id];
    if (!def || def.bloccato) return;
    if (def.azione) {
        let dati = null;
        try { dati = await def.preview(); } catch (_) { dati = null; }
        def.azione(dati, evt);
        return;
    }
    apriDettaglioWidget(def.tab || id, evt);
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
let _riordinoInCorso = false;

function _attivaDragEResize() {
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
    const grid = document.getElementById('phoneWidgetGrid');
    const w = _layoutWidget.find(x => x.id === id);
    if (!tile || !grid || !w) return;

    const tileRect = tile.getBoundingClientRect();
    const gridStyle = getComputedStyle(grid);
    const numColonneGriglia = gridStyle.gridTemplateColumns.split(' ').filter(Boolean).length;
    const gap = parseFloat(gridStyle.columnGap) || 0;
    const rowGap = parseFloat(gridStyle.rowGap) || 0;

    // Dimensione di UNA cella dedotta dalla tessera stessa (che oggi
    // occupa 1-2 celle in ciascun asse): più affidabile che ricalcolare a
    // mano le colonne in px.
    const colSpanAttuale = (w.size === '2x1' || w.size === '2x2') ? 2 : 1;
    const rowSpanAttuale = (w.size === '1x2' || w.size === '2x2') ? 2 : 1;
    const cellW = (tileRect.width - gap * (colSpanAttuale - 1)) / colSpanAttuale;
    const cellH = (tileRect.height - rowGap * (rowSpanAttuale - 1)) / rowSpanAttuale;

    _resizeState = {
        id, originLeft: tileRect.left, originTop: tileRect.top,
        cellW, cellH, gap, rowGap,
        maxColSpan: numColonneGriglia >= 2 ? 2 : 1,
    };
    tile.classList.add('widget-tile-resizing');
    window.addEventListener('pointermove', _onResizeHandlePointerMove);
    window.addEventListener('pointerup', _onResizeHandlePointerUp, { once: true });
}

function _onResizeHandlePointerMove(e) {
    if (!_resizeState) return;
    const { id, originLeft, originTop, cellW, cellH, gap, rowGap, maxColSpan } = _resizeState;

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

    const w = _layoutWidget.find(x => x.id === id);
    if (!w) return;

    // Sotto lo zero su entrambi gli assi (l'utente ha trascinato la
    // maniglia oltre l'angolo opposto della cella) → modalità icona:
    // stessa cella 1×1, ma il contenuto si riduce a sola icona (vedi
    // .widget-tile-mini in index.html). Altrimenti dimensione normale,
    // ed uscire da mini se prima lo era.
    const vuoleMini = colSpanGrezzo <= 0 && rowSpanGrezzo <= 0;
    const colSpan = Math.max(1, Math.min(maxColSpan, colSpanGrezzo));
    const rowSpan = Math.max(1, Math.min(2, rowSpanGrezzo));
    const nuovaTaglia = vuoleMini ? '1x1' : `${colSpan}x${rowSpan}`;

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
    window.addEventListener('pointerup', _onWidgetPointerUp, { once: true });
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
        const idxA = _layoutWidget.indexOf(visibili.find(w => w.id === idA));
        const idxB = _layoutWidget.indexOf(visibili.find(w => w.id === idB));
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

    Promise.resolve(def.preview()).then(anteprima => {
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
    if (!schermo || !container) return;
    const rect = schermo.getBoundingClientRect();
    container.style.top = rect.top + 'px';
    container.style.left = rect.left + 'px';
    container.style.width = rect.width + 'px';
    container.style.height = rect.height + 'px';
    container.style.borderRadius = getComputedStyle(schermo).borderRadius;
}

// ── APERTURA/CHIUSURA — animazione "a Pokéball" ──────────────────────────
// Claudio ha approvato l'idea di un'apertura che richiami il tema
// Pokéball: un cerchio che si espande dal punto esatto in cui hai
// toccato/cliccato il widget (CSS clip-path, nessun asset nuovo). La
// transizione è dichiarata SEMPRE in CSS (.container.container-visibile,
// vedi index.html) — qui ci limitiamo a impostare l'origine del cerchio
// (variabili CSS --pokeball-x/-y) e a spostare le classi, MAI a
// toccare transition/clip-path a mano: è quello il pattern fragile che
// causava il blocco a metà (vedi commento CSS per i dettagli).
const DURATA_ANIMAZIONE_DETTAGLIO_MS = 300;
let _chiusuraDettaglioTimeout = null;

function _impostaOrigineAnimazione(container, evt) {
    const schermo = document.getElementById('phoneScreen');
    const rect = schermo ? schermo.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    const x = evt && evt.clientX ? evt.clientX : rect.left + rect.width / 2;
    const y = evt && evt.clientY ? evt.clientY : rect.top + rect.height / 2;
    container.style.setProperty('--pokeball-x', x + 'px');
    container.style.setProperty('--pokeball-y', y + 'px');
}

async function apriDettaglioWidget(tabId, evt) {
    clearTimeout(_chiusuraDettaglioTimeout); // annulla un'eventuale chiusura ancora in corso (riapertura rapida)

    const container = document.querySelector('.container');
    switchTab(tabId, null);
    document.body.classList.add('phone-detail-open');

    if (container) {
        _impostaOrigineAnimazione(container, evt);
        container.classList.add('container-visibile'); // display: normale, cerchio a 0% (stato di partenza dichiarato in CSS)
        _posizionaContainerNelloSchermo();
        // Un frame di distacco tra "cerchio a 0%" e "aggiungi la classe che
        // lo porta a 150%": necessario perché il browser faccia partire
        // davvero la transizione invece di saltare subito allo stato finale.
        requestAnimationFrame(() => container.classList.add('container-aperto'));
    }
    _beep(880, 70);
    _aggiornaTastoFisico();

    // Multi-Binder (2026-08-25): il caricamento dati va SEMPRE dopo
    // l'apertura visiva, mai prima — un bug introdotto in un fix precedente
    // metteva questo await PRIMA del blocco container sopra: un qualunque
    // errore in apriWidgetBinders() interrompeva la funzione lì, il
    // container non si apriva mai e da fuori sembrava che il click non
    // facesse nulla (bug segnalato da Claudio). Ora è dopo, e in try/catch:
    // un errore nel caricamento non deve mai impedire l'apertura della
    // sezione, al massimo la mostra vuota.
    if (tabId === 'binder') {
        try {
            await apriWidgetBinders();
        } catch (e) {
            console.error('apriDettaglioWidget: errore caricando i binder:', e);
        }
    }
}

function chiudiDettaglioWidget() {
    const container = document.querySelector('.container');
    if (container) container.classList.remove('container-aperto'); // la transizione CSS dichiarata fa il resto (150%→0%)
    _beep(440, 70);
    document.body.classList.remove('phone-detail-open'); // subito: il bottone deve reagire al tap, non aspettare l'animazione
    _aggiornaTastoFisico();

    clearTimeout(_chiusuraDettaglioTimeout);
    _chiusuraDettaglioTimeout = setTimeout(() => {
        if (container) container.classList.remove('container-visibile'); // SOLO ora, a transizione finita, torna display:none
        renderWidgetHome();
    }, DURATA_ANIMAZIONE_DETTAGLIO_MS);
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

// ── SFONDO (WALLPAPER) PERSONALIZZABILE — stesso pattern della cornice ──
// Oggi solo il placeholder (gradiente tenue via CSS, vedi #phoneWidgetHomeWrap
// in index.html). Punto di innesto per quando esisterà la scelta da bucket.
function _applicaSfondoUtente(url) {
    const wrap = document.getElementById('phoneWidgetHomeWrap');
    if (wrap && url) wrap.style.backgroundImage = `url('${url}')`;
}

// ── BARRA DI STATO (orario + indicatore di sync) ─────────────────────────
function _aggiornaOrologioStatusBar() {
    const el = document.getElementById('phoneStatusOra');
    if (el) el.textContent = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

// Pulsa mentre è in corso una VERA chiamata a Supabase (non ad ogni
// ricalcolo locale gratuito da carteReali) — usata attorno al polling
// "lento" e a caricaAvvisiHome.
function _impostaSyncAttivo(attivo) {
    const dot = document.getElementById('phoneSyncDot');
    if (dot) dot.classList.toggle('attivo', attivo);
}

// ── SUONI RETRO (Web Audio, nessun file esterno) ─────────────────────────
let _phoneAudioCtx = null;
function _beep(frequenza, durataMs) {
    if (!prefSuoniWidgetGet()) return;
    try {
        _phoneAudioCtx = _phoneAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
        const osc = _phoneAudioCtx.createOscillator();
        const gain = _phoneAudioCtx.createGain();
        osc.type = 'square';
        osc.frequency.value = frequenza;
        gain.gain.value = 0.025; // molto discreto, non invadente
        osc.connect(gain);
        gain.connect(_phoneAudioCtx.destination);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.0001, _phoneAudioCtx.currentTime + durataMs / 1000);
        osc.stop(_phoneAudioCtx.currentTime + durataMs / 1000 + 0.02);
    } catch (_) { /* Web Audio non disponibile o bloccato: niente suono, nessun errore visibile */ }
}

function toggleSuoniWidgetHome() {
    const nuovoStato = !prefSuoniWidgetGet();
    prefSuoniWidgetSet(nuovoStato);
    const icona = document.getElementById('iconaSuoniWidgetHome');
    if (icona) icona.className = nuovoStato ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';
    if (nuovoStato) _beep(660, 60);
}

// ── NOTIFICHE PUSH (diff sui dati già scaricati, nessuna query nuova) ────
// Confronta i contatori di rischio col giro di polling precedente — se
// sono aumentati, mostra un banner + bagliore + vibrazione + suono.
// Nessun nuovo endpoint: riusa dati già ottenuti dal polling "lento".
let _contatoriNotifichePrecedenti = null;

async function _controllaNotifichePush() {
    const codaErrori = await _contaCodaErrori();
    const prezziScaduti = (typeof _elencoPrezziScaduti !== 'undefined' && _elencoPrezziScaduti) ? _elencoPrezziScaduti.length : 0;
    const attuali = { codaErrori, prezziScaduti };

    if (_contatoriNotifichePrecedenti) {
        if (attuali.codaErrori > _contatoriNotifichePrecedenti.codaErrori) {
            _mostraNotificaPush('Nuova carta da correggere in Inserimento');
        } else if (attuali.prezziScaduti > _contatoriNotifichePrecedenti.prezziScaduti) {
            _mostraNotificaPush('Nuovi prezzi da aggiornare');
        }
    }
    _contatoriNotifichePrecedenti = attuali;
}

function _mostraNotificaPush(testo) {
    const banner = document.getElementById('phonePushBanner');
    const testoEl = document.getElementById('phonePushBannerTesto');
    const schermo = document.getElementById('phoneScreen');
    if (!banner || !testoEl) return;
    testoEl.textContent = testo;
    banner.classList.add('mostrata');
    if (schermo) schermo.classList.add('glow-notifica');
    _vibraSeSupportato(15);
    _beep(660, 90);
    setTimeout(() => {
        banner.classList.remove('mostrata');
        if (schermo) schermo.classList.remove('glow-notifica');
    }, 4000);
}

// ── POLLING ────────────────────────────────────────────────────────────
const INTERVALLO_WIDGET_VELOCE_MS = 15000;
const INTERVALLO_WIDGET_LENTO_MS = 60000;

function avviaPollingWidgetHome() {
    if (_pollingWidgetInterval) clearInterval(_pollingWidgetInterval);
    if (_pollingWidgetIntervalLento) clearInterval(_pollingWidgetIntervalLento);

    _pollingWidgetInterval = setInterval(() => {
        if (!document.body.classList.contains('phone-detail-open') && !_editModeWidget) {
            renderWidgetHome();
        }
    }, INTERVALLO_WIDGET_VELOCE_MS);

    _pollingWidgetIntervalLento = setInterval(async () => {
        if (document.body.classList.contains('phone-detail-open') || _editModeWidget) return;
        _impostaSyncAttivo(true);
        try {
            await caricaAvvisiHome();
            await _controllaNotifichePush();
        } catch (e) { console.error('Errore polling avvisi (widget prezzi/inserimento):', e); }
        _impostaSyncAttivo(false);
        renderWidgetHome();
    }, INTERVALLO_WIDGET_LENTO_MS);
}

// ── HOME COME PAGINA PRINCIPALE — swipe verso i widget ───────────────────
// #home viene spostato (appendChild — stesso nodo, stesso contenuto,
// nessuna riscrittura) dentro #phoneHomePage una sola volta, all'avvio.
// Le due pagine vivono dentro #phonePagineWrap con scroll-snap: swipe/
// scroll in giù = widget, il bottone fisico (icona casetta) torna su.
let _paginaAttivaTelefono = 'home';

function _spostaHomeNellaPaginaPrincipale() {
    const home = document.getElementById('home');
    const paginaHome = document.getElementById('phoneHomePage');
    if (home && paginaHome && home.parentElement !== paginaHome) {
        paginaHome.appendChild(home);
    }
}

function _vaiAllaPaginaHome() {
    const wrap = document.getElementById('phonePagineWrap');
    if (wrap) wrap.scrollTo({ top: 0, behavior: 'smooth' });
}

function _gestisciScrollPagine() {
    const wrap = document.getElementById('phonePagineWrap');
    if (!wrap) return;
    const indice = Math.round(wrap.scrollTop / Math.max(wrap.clientHeight, 1));
    _paginaAttivaTelefono = indice === 0 ? 'home' : 'widget';
    _aggiornaTastoFisico();
    _aggiornaMatitaBarraGlobale();
}

// Suoni/densità/matita nella barra di stato globale — visibili SOLO sulla
// pagina widget (Claudio: "quando sei in visuale widget"); se stai
// modificando e torni sulla Home, esce anche dalla modalità modifica
// (non avrebbe senso restare in modifica senza vedere i widget).
function _aggiornaMatitaBarraGlobale() {
    const idBottoniCondizionali = ['btnSuoniWidgetHome', 'btnDensitaWidgetHome', 'btnModificaWidgetHome'];
    idBottoniCondizionali.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.classList.toggle('nascosto-in-home', _paginaAttivaTelefono !== 'widget');
    });
    if (_paginaAttivaTelefono !== 'widget' && _editModeWidget) {
        _editModeWidget = false;
        const btnModifica = document.getElementById('btnModificaWidgetHome');
        if (btnModifica) btnModifica.classList.remove('attivo');
        renderWidgetHome();
    }
}

// Bottone fisico unico — tre stati, vedi commento CSS su
// #btnFisicoTelefono: nascosto (già sulla Home), casetta (sui widget,
// torna alla Home), freccia (dettaglio aperto, torna ai widget).
function _aggiornaTastoFisico() {
    const btn = document.getElementById('btnFisicoTelefono');
    if (!btn) return;
    const icona = btn.querySelector('i');

    if (document.body.classList.contains('phone-detail-open')) {
        btn.classList.remove('nascosto');
        if (icona) icona.className = 'fa-solid fa-arrow-left';
        btn.title = 'Indietro';
    } else if (_paginaAttivaTelefono === 'widget') {
        btn.classList.remove('nascosto');
        if (icona) icona.className = 'fa-solid fa-house';
        btn.title = 'Home';
    } else {
        btn.classList.add('nascosto');
    }
}

function _clickTastoFisico() {
    if (document.body.classList.contains('phone-detail-open')) {
        chiudiDettaglioWidget(); // "Indietro": torna ai widget, non salta alla Home
        return;
    }
    if (_paginaAttivaTelefono === 'widget') {
        _vaiAllaPaginaHome();
    }
    // Se sei già sulla Home, non fa nulla.
}

// ── AVVIO ─────────────────────────────────────────────────────────────
async function initPhoneShell() {
    _spostaHomeNellaPaginaPrincipale();

    _caricaLayoutWidget();
    await renderWidgetHome();
    _aggiornaOrologioStatusBar();
    setInterval(_aggiornaOrologioStatusBar, 30000);

    const iconaSuoni = document.getElementById('iconaSuoniWidgetHome');
    if (iconaSuoni) iconaSuoni.className = prefSuoniWidgetGet() ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';

    avviaPollingWidgetHome();
    window.addEventListener('resize', _gestisciResizeCorniceDebounced);
    window.addEventListener('orientationchange', _gestisciResizeCornice);

    const paginaWrap = document.getElementById('phonePagineWrap');
    if (paginaWrap) paginaWrap.addEventListener('scroll', _gestisciScrollPagine, { passive: true });
    _aggiornaTastoFisico();
    _aggiornaMatitaBarraGlobale();

    // Animazione di "accensione" — una sola volta, al caricamento.
    const frameBox = document.getElementById('phoneFrameBox');
    if (frameBox) {
        frameBox.classList.add('phone-accensione');
        setTimeout(() => frameBox.classList.remove('phone-accensione'), 700);
    }
}
