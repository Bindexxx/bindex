// ── ui/phone.ui.js ─────────────────────────────────────────────────────
// Home "smartphone simulato": griglia di widget dentro una cornice
// (placeholder oggi in assets/frame/, in futuro immagine scelta
// dall'utente da un bucket Supabase — vedi _applicaCorniceUtente più
// sotto, punto di innesto già pronto), ognuno apre a schermo intero (con
// tasto indietro) esattamente la stessa view-section che oggi apriva la
// voce corrispondente nel vecchio menu laterale. Nessuna nuova query
// Supabase: ogni widget riusa dati/funzioni già esistenti in home.ui.js/
// navigation.ui.js/queue.ui.js — vedi commento su ogni preview.
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
let _resizeCorniceTimeout = null;

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

// ── CORNICE: ritaglio "cover" ricalcolato a runtime ──────────────────────
// FIX 2/2 (segnalato da Claudio, screenshot "è schiacciato... sistemare la
// larghezza"): la cornice riempie sempre tutta la finestra (CSS
// background-size:cover su #phoneShell, vedi index.html) invece di
// restare piccola al centro con margini vuoti. "cover" ritaglia
// automaticamente l'eccesso di bordo decorativo sopra/sotto (finestre
// larghe) o ai lati (finestre strette) — qui ricalcoliamo dove finisce
// DAVVERO lo schermo dei widget dopo quel ritaglio, replicando la stessa
// matematica che il browser usa per "cover" (dimensioni reali delle due
// immagini + percentuali di schermo misurate pixel per pixel una volta
// sola su base_V.png/base_O.png), e la scriviamo come variabili CSS
// (--phone-screen-top/bottom/left/right) che sia #phoneScreen sia il
// tasto Indietro leggono già. Va richiamata ad ogni resize/rotazione.
const _CORNICE_NATURALE = {
    verticale: { w: 885, h: 1777, top: 0.092, bottom: 0.093, left: 0.176, right: 0.136 },
    orizzontale: { w: 1536, h: 1024, top: 0.163, bottom: 0.188, left: 0.102, right: 0.101 },
};

function _ricalcolaLayoutCornice() {
    const landscape = window.matchMedia('(orientation: landscape)').matches;
    const nat = landscape ? _CORNICE_NATURALE.orizzontale : _CORNICE_NATURALE.verticale;

    const boxW = window.innerWidth;
    const boxH = window.innerHeight;

    // Stessa formula di CSS background-size:cover: scala per riempire il
    // box (il maggiore dei due rapporti), poi ritaglio centrato sull'asse
    // che eccede.
    const scale = Math.max(boxW / nat.w, boxH / nat.h);
    const renderedW = nat.w * scale;
    const renderedH = nat.h * scale;
    const cropXFrac = Math.max(0, (renderedW - boxW) / renderedW / 2);
    const cropYFrac = Math.max(0, (renderedH - boxH) / renderedH / 2);
    const visibleFracX = Math.max(1 - 2 * cropXFrac, 0.01); // guardia anti-divisione-per-zero
    const visibleFracY = Math.max(1 - 2 * cropYFrac, 0.01);

    const pct = (v) => Math.max(0, Math.min(100, v * 100)) + '%';

    const root = document.documentElement.style;
    root.setProperty('--phone-screen-top', pct((nat.top - cropYFrac) / visibleFracY));
    root.setProperty('--phone-screen-bottom', pct((nat.bottom - cropYFrac) / visibleFracY));
    root.setProperty('--phone-screen-left', pct((nat.left - cropXFrac) / visibleFracX));
    root.setProperty('--phone-screen-right', pct((nat.right - cropXFrac) / visibleFracX));
}

// ── APERTURA/CHIUSURA DETTAGLIO FULLSCREEN DENTRO IL FRAME ───────────────
// .container non viene spostata nel DOM (rischio zero di rompere
// selettori/z-index esistenti) — le si impostano solo, via JS, top/left/
// width/height/border-radius ESATTI letti da #phoneScreen.
// getBoundingClientRect() (coordinate già relative al viewport, quindi
// direttamente utilizzabili per un elemento position:fixed, nessuna
// conversione). Più robusto della sola CSS: qualunque sia la strategia di
// ritaglio della cornice (cover, contain, futura scelta utente da
// bucket), .container si allinea sempre a ciò che lo schermo mostra
// DAVVERO, senza dover duplicare percentuali in due punti diversi.
// switchTab() resta ESATTAMENTE quella di navigation.ui.js, non toccata.
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

function apriDettaglioWidget(tabId) {
    switchTab(tabId, null);
    document.body.classList.add('phone-detail-open');
    _posizionaContainerNelloSchermo();
}

function chiudiDettaglioWidget() {
    document.body.classList.remove('phone-detail-open');
    renderWidgetHome(); // i numeri potrebbero essere cambiati mentre eri nel dettaglio
}

// Ridimensionamento/rotazione: ricalcola sempre il ritaglio cornice, e se
// sei nel dettaglio riallinea anche .container di conseguenza (dopo il
// reflow del nuovo --phone-screen-*, da qui il requestAnimationFrame).
function _gestisciResizeCornice() {
    _ricalcolaLayoutCornice();
    if (document.body.classList.contains('phone-detail-open')) {
        requestAnimationFrame(_posizionaContainerNelloSchermo);
    }
}
function _gestisciResizeCorniceDebounced() {
    clearTimeout(_resizeCorniceTimeout);
    _resizeCorniceTimeout = setTimeout(_gestisciResizeCornice, 100);
}

// ── CORNICE PERSONALIZZABILE (placeholder oggi, bucket Supabase domani) ──
// Punto di innesto unico: quando esisterà la UI per scegliere la cornice
// dal bucket, basterà chiamare questa funzione con l'URL pubblico del file
// scelto E le sue dimensioni reali (naturalWidth/naturalHeight, servono al
// ricalcolo del ritaglio) — nessun'altra modifica a CSS necessaria.
function _applicaCorniceUtente(urlVerticale, dimVerticale, urlOrizzontale, dimOrizzontale) {
    if (urlVerticale) document.getElementById('phoneFrameV').style.backgroundImage = `url('${urlVerticale}')`;
    if (urlOrizzontale) document.getElementById('phoneFrameO').style.backgroundImage = `url('${urlOrizzontale}')`;
    if (dimVerticale) Object.assign(_CORNICE_NATURALE.verticale, { w: dimVerticale.w, h: dimVerticale.h });
    if (dimOrizzontale) Object.assign(_CORNICE_NATURALE.orizzontale, { w: dimOrizzontale.w, h: dimOrizzontale.h });
    _gestisciResizeCornice();
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
    _ricalcolaLayoutCornice();
    _caricaLayoutWidget();
    await renderWidgetHome();
    avviaPollingWidgetHome();
    window.addEventListener('resize', _gestisciResizeCorniceDebounced);
    window.addEventListener('orientationchange', _gestisciResizeCornice);
}
