// ── ui/phone.ui.js ─────────────────────────────────────────────────────
// Home "smartphone simulato": griglia di widget dentro una cornice
// (placeholder oggi in assets/frame/, in futuro immagine scelta
// dall'utente da un bucket Supabase — vedi _applicaCorniceUtente più
// sotto, punto di innesto già pronto), ognuno apre a schermo intero (con
// tasto indietro) esattamente la stessa view-section che oggi apriva la
// voce corrispondente nel vecchio menu laterale. Nessuna nuova query
// Supabase: ogni widget riusa dati/funzioni già esistenti in home.ui.js/
// navigation.ui.js/queue.ui.js — vedi commento su ogni definePreview.
//
// Dipende da: state globale carteReali (state/cards.state.js), switchTab
// (ui/navigation.ui.js), _contaCodaErrori/_elencoPrezziScaduti/
// aggiornaStatCardHome/caricaAvvisiHome (ui/home.ui.js), prefWidgetLayoutGet/
// Set (data/preferences.repository.js).

// ── CATALOGO WIDGET DISPONIBILI ──────────────────────────────────────────
// Ogni voce del vecchio menu laterale diventa un widget. 'tab' è lo stesso
// tabId già accettato da switchTab() — click sul widget richiama la stessa
// identica funzione di navigazione di sempre, solo mostrata dentro il
// frame invece che nella pagina "piatta". 'preview' calcola SOLO numeri
// già disponibili in memoria (carteReali) o da funzioni già esistenti,
// mai una query nuova dedicata al widget.
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
            return { righe: [n > 0 ? `${n} da correggere` : 'Tutto ok'], allerta: n > 0 };
        },
    },
    prezzi: {
        titolo: 'Prezzi', icona: 'fa-chart-line',
        // _elencoPrezziScaduti è popolato da caricaAvvisiHome() (già
        // richiamata a intervalli da avviaPollingWidgetHome più sotto) —
        // qui lo leggiamo soltanto, non lo ricalcoliamo.
        preview: () => {
            const n = (typeof _elencoPrezziScaduti !== 'undefined' && _elencoPrezziScaduti) ? _elencoPrezziScaduti.length : 0;
            return { righe: [n > 0 ? `${n} da aggiornare` : 'Aggiornati'], allerta: n > 0 };
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
        preview: () => {
            const n = carteReali.filter(c => c.tabella === 'wishlist').length;
            return { righe: [`${n} desiderate`] };
        },
    },
    binder: {
        titolo: 'Binder', icona: 'fa-layer-group',
        preview: () => ({ righe: ['In primo piano'] }),
    },
    sealed: {
        titolo: 'Sealed', icona: 'fa-box-archive',
        preview: () => {
            const n = carteReali.filter(c => c.stato === 'collezione' && c.tipo === 'sealed').length;
            return { righe: [`${n} prodotti`] };
        },
    },
    impostazioni: {
        titolo: 'Impostazioni', icona: 'fa-gear',
        preview: () => ({ righe: ['Account, tema, estensione'] }),
    },
};

const ORDINE_WIDGET_DEFAULT = ['home', 'visualizzazione', 'inserimento', 'prezzi', 'scambio', 'wishlist', 'binder', 'sealed', 'impostazioni'];
const MAX_WIDGET_VISIBILI = 10;

let _layoutWidget = null; // [{id, visibile}], ordine = ordine di visualizzazione
let _editModeWidget = false;
let _pollingWidgetInterval = null;
let _pollingWidgetIntervalLento = null;

// ── LAYOUT: caricamento/salvataggio per-dispositivo ──────────────────────
// Stesso pattern già in uso per binder layout/sidebar compressa/riduci
// animazioni (data/preferences.repository.js, localStorage) — decisione
// confermata: per ora resta locale, non sincronizzato tra dispositivi.
function _caricaLayoutWidget() {
    let salvato = null;
    try { salvato = JSON.parse(prefWidgetLayoutGet() || 'null'); } catch (_) { salvato = null; }

    if (!Array.isArray(salvato) || salvato.length === 0) {
        _layoutWidget = ORDINE_WIDGET_DEFAULT.map(id => ({ id, visibile: true }));
        return;
    }
    // Filtra eventuali id salvati che non esistono più nel catalogo
    // (es. widget rimosso in una versione futura) — non deve mai rompere
    // il rendering, semplicemente lo ignora.
    const validi = salvato.filter(w => CATALOGO_WIDGET[w.id]);
    // Aggiunge in coda (nascosti) eventuali widget nuovi nel catalogo mai
    // visti da questo dispositivo, così compaiono nel picker "aggiungi".
    ORDINE_WIDGET_DEFAULT.forEach(id => {
        if (!validi.find(w => w.id === id)) validi.push({ id, visibile: false });
    });
    _layoutWidget = validi;
}

function _salvaLayoutWidget() {
    prefWidgetLayoutSet(JSON.stringify(_layoutWidget));
}

// ── RENDER GRIGLIA HOME ──────────────────────────────────────────────────
async function renderWidgetHome() {
    if (!_layoutWidget) _caricaLayoutWidget();

    const grid = document.getElementById('phoneWidgetGrid');
    if (!grid) return;

    const visibili = _layoutWidget.filter(w => w.visibile);

    const tessere = await Promise.all(visibili.map(async (w, indice) => {
        const def = CATALOGO_WIDGET[w.id];
        if (!def) return '';
        let anteprima = { righe: ['—'] };
        try { anteprima = await def.preview(); } catch (e) { console.error('Errore preview widget ' + w.id + ':', e); }

        const controlliEdit = _editModeWidget ? `
            <div class="widget-edit-controls" onclick="event.stopPropagation()">
                <button type="button" onclick="_spostaWidget(${indice}, -1)" title="Sposta su" ${indice === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
                <button type="button" onclick="_spostaWidget(${indice}, 1)" title="Sposta giù" ${indice === visibili.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
                <button type="button" onclick="_nascondiWidget('${w.id}')" title="Rimuovi dalla home" class="widget-edit-remove"><i class="fa-solid fa-xmark"></i></button>
            </div>` : '';

        return `
            <div class="widget-tile ${anteprima.allerta ? 'widget-tile-allerta' : ''}" onclick="${_editModeWidget ? '' : `apriDettaglioWidget('${w.id}')`}">
                ${controlliEdit}
                <div class="widget-tile-icon"><i class="fa-solid ${def.icona}"></i></div>
                <div class="widget-tile-titolo">${def.titolo}</div>
                <div class="widget-tile-righe">${anteprima.righe.map(r => `<span>${r}</span>`).join('')}</div>
            </div>`;
    }));

    let tileAggiungi = '';
    if (_editModeWidget && visibili.length < MAX_WIDGET_VISIBILI) {
        tileAggiungi = `
            <div class="widget-tile widget-tile-aggiungi" onclick="_apriPickerAggiungiWidget()">
                <div class="widget-tile-icon"><i class="fa-solid fa-plus"></i></div>
                <div class="widget-tile-titolo">Aggiungi</div>
            </div>`;
    }

    grid.innerHTML = tessere.join('') + tileAggiungi;
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

// ── APERTURA/CHIUSURA DETTAGLIO FULLSCREEN DENTRO IL FRAME ───────────────
// Non sposta .container nel DOM (rischio zero di rompere selettori/z-index
// esistenti) — le applica solo una classe che la aggancia, via CSS, al
// rettangolo "schermo" ritagliato dentro la cornice attuale (verticale/
// orizzontale, vedi variabili CSS in index.html). switchTab() resta
// ESATTAMENTE quella di navigation.ui.js, non toccata: stessa funzione che
// girava già col vecchio menu laterale.
function apriDettaglioWidget(tabId) {
    switchTab(tabId, null);
    document.body.classList.add('phone-detail-open');
    document.getElementById('phoneScreen').classList.add('detail-active');
}

function chiudiDettaglioWidget() {
    document.body.classList.remove('phone-detail-open');
    document.getElementById('phoneScreen').classList.remove('detail-active');
    renderWidgetHome(); // i numeri potrebbero essere cambiati mentre eri nel dettaglio
}

// ── CORNICE PERSONALIZZABILE (placeholder oggi, bucket Supabase domani) ──
// Punto di innesto unico: quando esisterà la UI per scegliere la cornice
// dal bucket, basterà chiamare questa funzione con l'URL pubblico del file
// scelto — nessun'altra modifica a CSS/HTML necessaria. Oggi, se non è mai
// stata scelta una cornice, restano i placeholder caricati via CSS
// (assets/frame/frame-verticale.png e frame-orizzontale.png).
function _applicaCorniceUtente(urlVerticale, urlOrizzontale) {
    if (urlVerticale) document.getElementById('phoneFrameV').style.backgroundImage = `url('${urlVerticale}')`;
    if (urlOrizzontale) document.getElementById('phoneFrameO').style.backgroundImage = `url('${urlOrizzontale}')`;
}

// ── POLLING ────────────────────────────────────────────────────────────
// Due velocità, come da decisione: i dati già in memoria (carteReali) si
// ricalcolano spesso (gratis, nessuna rete); le funzioni che leggono dal
// DB (correzioni manuali, prezzi scaduti) girano più di rado per non
// martellare Supabase inutilmente. Nessuna nuova sottoscrizione realtime
// in questo primo giro (richiesto: si parte con polling).
const INTERVALLO_WIDGET_VELOCE_MS = 15000;
const INTERVALLO_WIDGET_LENTO_MS = 60000;

function avviaPollingWidgetHome() {
    if (_pollingWidgetInterval) clearInterval(_pollingWidgetInterval);
    if (_pollingWidgetIntervalLento) clearInterval(_pollingWidgetIntervalLento);

    _pollingWidgetInterval = setInterval(() => {
        if (!document.body.classList.contains('phone-detail-open')) renderWidgetHome();
    }, INTERVALLO_WIDGET_VELOCE_MS);

    _pollingWidgetIntervalLento = setInterval(async () => {
        if (document.body.classList.contains('phone-detail-open')) return;
        try { await caricaAvvisiHome(); } catch (e) { console.error('Errore polling avvisi (widget prezzi/inserimento):', e); }
        renderWidgetHome();
    }, INTERVALLO_WIDGET_LENTO_MS);
}

// ── AVVIO ─────────────────────────────────────────────────────────────
// Chiamata da window.onload in index.html, in parallelo a
// controlloIngressoCardsync() — il pannello di login/estensione (z-index
// 9999999) copre comunque tutto finché non viene superato, quindi non
// serve nessuna dipendenza esplicita dall'esito di quel controllo qui.
async function initPhoneShell() {
    _caricaLayoutWidget();
    await renderWidgetHome();
    avviaPollingWidgetHome();
}
