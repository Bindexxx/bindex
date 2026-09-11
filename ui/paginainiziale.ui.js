// ═══════════════════════════════════════════════════════════════════════
// PAGINAINIZIALE.UI.JS — motore della home a widget (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP 0 della ristrutturazione file widget home (vedi
// Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md, caricata nel repo).
// Estratto da ui/phone.ui.js il 2026-09-11: griglia, drag&drop, resize,
// paginazione, layout, salvataggio per-utente, apertura/chiusura generica
// del dettaglio widget, modifica, peek, resize cornice, polling, orologio,
// presenza, avvio. NESSUNA riscrittura: solo spostamento di codice, zero
// cambi di comportamento per l'utente finale.
//
// ⚠ NOTA NOME FILE (importante se riprendi il lavoro in un'altra chat):
// la roadmap originale proponeva "home-widget.ui.js" per evitare la
// collisione col file già esistente ui/home.ui.js (vecchia tab
// Visualizzazione, dominio diverso). Claudio ha poi scelto il nome
// definitivo "paginainiziale.ui.js" — NON home-widget.ui.js. Se stai
// leggendo un vecchio compilato/roadmap che parla di "home-widget.ui.js",
// è lo stesso file: solo il nome è cambiato. Nessuna collisione con
// ui/home.ui.js.
//
// Caricato PRIMA di ui/phone.ui.js in index.html (che oggi contiene ancora
// tutti i widget non ancora estratti — verranno spostati un file alla
// volta nei prossimi step, vedi roadmap).
//
// CATALOGO_WIDGET: dichiarato QUI come registro vuoto. Oggi (STEP 0) viene
// popolato da ui/phone.ui.js con le 22 voci non ancora estratte (via
// Object.assign, vedi commento in phone.ui.js al posto dove prima c'era la
// dichiarazione). Nei prossimi step, ogni widget estratto smetterà di
// vivere in quell'Object.assign e scriverà la propria voce direttamente
// nel proprio file widget-<nome>.ui.js (es. CATALOGO_WIDGET.wishlist = {...}).
//
// ⚠ SECONDO GIRO DI RISTRUTTURAZIONE (avviato 2026-09-11, piano approvato
// da Claudio in sessione): questo file (il MOTORE della home, non i
// widget) viene a sua volta spezzato in file paginainiziale-*.ui.js più
// piccoli, un pezzo alla volta, stessa filosofia zero-riscrittura del
// primo giro. Estratti finora: paginainiziale-dettaglio.ui.js (STEP 1,
// apertura/chiusura dettaglio widget). Resta da fare: paginazione,
// render+azioni tessera, drag&resize, cornice/statusbar-bridge,
// polling/avvio, e forse un file a parte per stato/persistenza layout.
const CATALOGO_WIDGET = {};

// ───────────────────────────────────────────────────────────────────────
// SEZIONE 1 — Catalogo/taglie, paginazione, layout/salvataggio, densità,
// vibrazione (originariamente righe 1082-1714 di phone.ui.js)
// ───────────────────────────────────────────────────────────────────────

const ORDINE_WIDGET_DEFAULT = ['visualizzazione', 'inserimento', 'prezzi', 'binder', 'sealed'];
// TEMPORANEO (Claudio, 2026-08-28): nessun limite, per poter provare tutti
// i widget del catalogo insieme in home. Da RIPRISTINARE a 10 quando finito
// — è l'unica riga da cambiare, usata solo qui sotto e in _mostraWidget().
const MAX_WIDGET_VISIBILI = Infinity;
// TAGLIE_CICLO — SUPERATO dalla griglia a 6 colonne (2026-09-03). Resta
// SOLO come elenco delle 4 taglie del vecchio modello a 2 colonne: serve a
// _migraTagliaWidget() per riconoscere un layout salvato prima del cambio.
// Non usarlo più come whitelist delle taglie ammesse: oggi sono libere.
const TAGLIE_CICLO = ['1x1', '2x1', '1x2', '2x2'];

// ── GRIGLIA WIDGET: 6 COLONNE (Claudio, 2026-09-03) ─────────────────────
// "Massima personalizzazione possibile e immaginabile": icone piccolissime
// E widget che riempiono la pagina. Entrambe erano impossibili non per un
// limite del codice ma perche' la griglia aveva 2 colonne — con 2 colonne
// una cella e' mezzo schermo, quindi un'icona non puo' essere piccola e un
// widget non puo' essere largo 6.
//
// PERCHE' 6 E NON DI PIU': sotto i ~44px un bersaglio non e' piu' toccabile
// con affidabilita'. Su uno schermo telefono 6 colonne danno ~55px (sopra
// soglia); 8 ne darebbero ~40 (sotto). "Il minimo" ha un pavimento fisico
// ed e' piu' o meno qui.
const COLONNE_GRIGLIA_WIDGET = 6;

// TETTO DI LARGHEZZA (Claudio, 2026-09-03: "voglio poter mettere i widget
// in orizzontale per tutta la lunghezza anche").
// In verticale la griglia ha 6 colonne fisse. In ORIZZONTALE invece e'
// elastica (auto-fill di celle da 30-37px, vedi index.html), quindi su uno
// schermo largo le colonne sono molte di piu' di 6 — e fermare la
// larghezza a 6 impediva di occupare tutta la riga proprio dove c'era piu'
// spazio. Il limite vero resta comunque quello vivo, calcolato in
// _onResizeHandlePointerDown dal numero reale di colonne della griglia:
// questo e' solo il tetto assoluto oltre il quale non si genera CSS.
// NOTA sul ritorno in verticale: una larghezza maggiore di 6 su una
// griglia da 6 colonne viene ridotta dal browser alla larghezza della
// griglia (regola di CSS Grid sugli span che eccedono le tracce
// esplicite). Quindi un widget portato a tutta lunghezza in orizzontale
// si ritrova a tutta larghezza in verticale: nessun layout rotto, nessuna
// conversione da scrivere.
const COLONNE_MAX_WIDGET = 36;

// Tetto di sicurezza all'altezza. Il limite VERO e' l'altezza della pagina
// ed e' calcolato dal vivo in _onResizeHandlePointerDown (maxRowSpan): un
// widget non puo' crescere oltre lo schermo che lo contiene. Questo qui
// serve solo a impedire che un layout salvato corrotto produca un widget
// alto 400 righe.
const RIGHE_MAX_WIDGET = 24;

// Soglia sotto la quale la tessera diventa ICONA STATICA (niente sfera,
// niente animazione, solo icona + numerino di notifica).
// Claudio: "non saranno piu' widget con animazione ma icone statiche con
// numerino di notifica".
// NOTA: questa soglia risolve un conflitto con una decisione precedente
// dello stesso Claudio, incisa nel CSS: "la ball non deve MAI
// rimpicciolire" (--ball-misura fissa a 90px). In una cella da 55px una
// sfera da 90px non ci sta. Le due regole convivono cosi': sotto la soglia
// la sfera non c'e' proprio, sopra la soglia e' quella di sempre, intatta.
// Non abbassare questa soglia senza rendere la sfera elastica.
const CELLE_MIN_PER_SFERA = 3;

// STANDARD 2×2 IN ZONA ICONA (Claudio, 2026-09-10). La modalita' icona
// (vedi _iconaStatica sotto, stessa soglia) nasconde gia' il contenuto
// ricco, ma i due assi restavano liberi di muoversi indipendenti fino a
// un minimo di 1 cella — due bug distinti, corretti in due momenti:
//   1) una cella poteva finire 1x6 o 6x1 (striscia lunga e vuota) — primo
//      giro di fix, sotto.
//   2) BUG (Claudio, screenshot 2026-09-10: "mi permette di rendere i
//      widget troppo piccoli"): il fix del punto 1 usava Math.min(x, 2),
//      che puo' SOLO abbassare un valore gia' grande — su un asse gia'
//      piccolo (es. 1) non fa nulla, quindi 1x1 restava raggiungibile
//      trascinando fino in fondo. Math.min non e' un pavimento, e' un
//      tetto: serviva FISSARE la taglia, non limitarla solo dall'alto.
// Ora: in zona icona la taglia e' SEMPRE esattamente 2x2, mai piu' piccola
// e mai piu' "a striscia" — uno standard fisso, non un intervallo.
// Standard uguale per tutti i widget per ora — Claudio si e' riservato di
// valutare eccezioni per singolo widget in futuro (stesso pattern di
// 'tagliaDefault' nel catalogo, non ancora fatto).
// Applicata in TRE punti: _onResizeHandlePointerMove (non si puo' creare
// uno stato fuori standard trascinando), la migrazione dentro
// _caricaLayoutWidget() (corregge una volta sola, e salva, chi aveva gia'
// uno stato fuori standard da prima di questa regola) e _tagliaEffettiva
// (rete di sicurezza a ogni render, nel caso qualche altro punto in
// futuro scriva w.size senza passare da qui).
function _correggiTagliaZonaIcona(col, row) {
    const zonaIcona = col < CELLE_MIN_PER_SFERA || row < 2;
    if (!zonaIcona) return { col, row };
    return { col: 2, row: 2 };
}

// Versione del formato di _layoutWidget salvato in cardsyncWidgetLayout.
// 1 (implicita, nessun campo 'v') = modello a 2 colonne.
// 2 = modello a 6 colonne. Vedi _migraTagliaWidget().
const VERSIONE_LAYOUT_WIDGET = 2;

// FORMA della tessera, per il CSS interno della sfera. Il vecchio modello
// aveva 4 taglie fisse e il CSS ci aveva scritto sopra ~25 regole
// (dimensioni di font, righe da nascondere, altezza degli sparkline). Con
// le taglie libere quelle regole sarebbero morte: qui le 4 forme
// sopravvivono come SOGLIE, cosi' il CSS e' stato solo rinominato e non
// riscritto — e le taglie intermedie che prima non potevano esistere
// (4x2, 5x3...) ricadono nella forma piu' vicina invece di restare nude.
//   wf-piccolo = ex 1x1   wf-largo  = ex 2x1
//   wf-alto    = ex 1x2   wf-grande = ex 2x2
function _formaWidget(col, row) {
    const largo = col >= 5;
    const alto = row >= 3;
    if (largo && alto) return 'wf-grande';
    if (largo) return 'wf-largo';
    if (alto) return 'wf-alto';
    return 'wf-piccolo';
}

// TAGLIA DI NASCITA. Su un telefono vero ogni widget arriva gia' della
// dimensione giusta per cio' che mostra: il meteo piccolo, il calendario
// grande. Qui invece nascevano tutti '3x2', la taglia in cui il corpo
// ricco NON ci sta — quindi un widget appena aggiunto sembrava sempre
// "solo una sfera con due righe" e bisognava allargarlo a mano per
// scoprire a cosa serviva (Claudio: "se devo sostituire la home con dei
// widget, i widget devono avere le funzioni giuste, altrimenti non
// servono a niente").
// La taglia si dichiara nel catalogo con 'tagliaDefault'; chi non la
// dichiara continua a nascere '3x2' esattamente come prima.
function _tagliaDiNascita(id) {
    const def = CATALOGO_WIDGET[id];
    const t = def && def.tagliaDefault;
    if (!t) return '3x2';
    const letta = _leggiTaglia(t);
    return letta.col + 'x' + letta.row;
}

// Spezza 'CxR' nei due numeri, con difesa contro valori corrotti.
function _leggiTaglia(size) {
    const m = /^(\d+)x(\d+)$/.exec(String(size || ''));
    if (!m) return { col: 3, row: 2 }; // = il vecchio 1x1, default sensato
    const col = Math.max(1, Math.min(COLONNE_MAX_WIDGET, parseInt(m[1], 10)));
    const row = Math.max(1, Math.min(RIGHE_MAX_WIDGET, parseInt(m[2], 10)));
    return { col, row };
}

// MIGRAZIONE DEI LAYOUT SALVATI — la parte delicata del cambio.
// Nel vecchio modello '2x1' voleva dire "tutta la larghezza"; a 6 colonne
// vorrebbe dire "un terzo". Senza questa conversione, alla prima apertura
// la home di tutti e cinque i membri del gruppo risulterebbe scombinata.
//
// I fattori NON sono scelti a caso: sono quelli che rendono la migrazione
// INVISIBILE. Colonne x3 (2 -> 6). Righe x2, perche' la riga passa da
// 108px a 48px + 11.2px di gap = 107.2px ogni due. Tenendo il gap
// identico (0.7rem), la larghezza di 3 nuove colonne e' W/2 - 0.5*gap,
// esattamente la stessa del vecchio 1x1. Ogni widget esistente resta
// quindi della stessa identica dimensione in pixel: cambia solo cio' che
// da oggi in poi si PUO' fare, non cio' che si vede al primo avvio.
//
//   vecchio 1x1 -> 3x2      vecchio 1x2 -> 3x4
//   vecchio 2x1 -> 6x2      vecchio 2x2 -> 6x4
function _migraTagliaWidget(size) {
    const m = /^(\d+)x(\d+)$/.exec(String(size || ''));
    if (!m) return '3x2';
    const col = Math.max(1, Math.min(2, parseInt(m[1], 10))) * 3;
    const row = Math.max(1, Math.min(2, parseInt(m[2], 10))) * 2;
    return col + 'x' + row;
}

// ── PAGINE MULTIPLE DELLA HOME — SPOSTATO (STEP 3 del piano di taglio
// 2026-09-11) in ui/paginainiziale-paginazione.ui.js. Conteneva:
// _paginaWidgetCorrente, _misuraPaginaWidget, _tagliaEffettiva,
// _distribuisciWidgetInPagine, _paginePresenti, _numeroPagineWidget,
// _compattaPagineWidget, _spostaWidgetInPagina/NellaPagina,
// _vaiAllaPaginaWidget(Relativa), _gestisciScrollPaginePagineWidget,
// _aggiornaPuntiniPagine.

let _layoutWidget = null; // [{id, visibile, size, pagina}], ordine = ordine di visualizzazione
// userId risolto l'ultima volta che il layout e' stato caricato — cache
// SOLO per evitare un authGetUserId() (async) ad ogni singolo salvataggio
// (drag/resize possono chiamare _salvaLayoutWidget() molte volte al
// secondo, e quella deve restare sincrona). Impostata SOLO da
// _caricaLayoutWidget(), che gira sempre prima di qualunque salvataggio.
let _layoutWidgetUserId = null;
let _editModeWidget = false;
// Menu a comparsa "Piano B" per sposta su/giù/pagina (vedi controlliEdit in
// renderWidgetHome) — instanceId del widget il cui menu è aperto, o null.
// Uno solo alla volta: aprirne un altro chiude automaticamente questo.
let _menuSpostaWidgetApertoId = null;
let _densitaCompatta = false;
let _pollingWidgetInterval = null;
let _pollingWidgetIntervalLento = null;
let _resizeCorniceTimeout = null;
let _cartaDelGiornoId = null;
let _primoRenderWidgetFatto = false; // per la cascata d'ingresso, una sola volta per sessione

// Identificatore univoco di RIGA in _layoutWidget — non l'id di catalogo:
// da quando "Vetrina" può avere più copie con lo stesso id ('ultima_carta'),
// serve una chiave che distingua ciascuna copia. Usato in data-widget-id
// al posto di w.id per drag/resize/nascondi — vedi renderWidgetHome.
function _nuovoInstanceId() {
    return 'w_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// ── LAYOUT: caricamento/salvataggio per-utente E per-dispositivo ─────────
// AGGIORNATO 2026-09-10 (Claudio): prima la chiave era unica per
// dispositivo (localStorage 'cardsyncWidgetLayout'), quindi utenti diversi
// sullo stesso PC/browser condividevano — e si sovrascrivevano — lo stesso
// layout. Ora la chiave e' scoped per userId (vedi
// data/preferences.repository.js): serve risolverlo con authGetUserId()
// (async), quindi la funzione e' diventata async — entrambi i chiamanti
// (riga ~2954 e initPhoneShell) sono gia' dentro funzioni async, nessun
// altro punto la chiamava.
async function _caricaLayoutWidget() {
    const userId = await authGetUserId();
    _layoutWidgetUserId = userId || null;
    if (!_layoutWidgetUserId) {
        // Nessun utente risolto (non dovrebbe succedere qui, la home a
        // widget e' dietro login) — layout di default SENZA salvarlo: non
        // c'e' una chiave utente su cui scriverlo.
        _layoutWidget = ORDINE_WIDGET_DEFAULT.map(id => ({ id, instanceId: _nuovoInstanceId(), visibile: true, size: '3x2', mini: false, cartaId: null, pagina: 0, v: VERSIONE_LAYOUT_WIDGET }));
        return;
    }

    let salvato = null;
    try { salvato = JSON.parse(prefWidgetLayoutGet(_layoutWidgetUserId) || 'null'); } catch (_) { salvato = null; }

    if (!Array.isArray(salvato) || salvato.length === 0) {
        // '3x2' = il vecchio '1x1' nella griglia a 6 colonne: mezza
        // larghezza, stessa altezza di prima. Primo avvio identico a com'era.
        _layoutWidget = ORDINE_WIDGET_DEFAULT.map(id => ({ id, instanceId: _nuovoInstanceId(), visibile: true, size: '3x2', mini: false, cartaId: null, pagina: 0, v: VERSIONE_LAYOUT_WIDGET }));
        return;
    }
    let generatoQualcheId = false;
    let migratoQualcosa = false;
    const validi = salvato
        .filter(w => CATALOGO_WIDGET[w.id])
        .map(w => {
            if (!w.instanceId) generatoQualcheId = true; // layout salvato PRIMA di questa sessione: assegna una volta, si salva sotto
            // Riga scritta col modello a 2 colonne (nessun campo 'v'):
            // converti una volta sola. Il campo 'v' scritto qui sotto
            // impedisce che la conversione venga rifatta al prossimo avvio
            // — rifarla moltiplicherebbe di nuovo e sfonderebbe la griglia.
            let size;
            if (w.v === VERSIONE_LAYOUT_WIDGET) {
                const t = _leggiTaglia(w.size);
                const corretta = _correggiTagliaZonaIcona(t.col, t.row);
                if (corretta.col !== t.col || corretta.row !== t.row) migratoQualcosa = true; // fuori standard 2x2, corretto una tantum
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
                // Layout salvato prima delle pagine: tutto sulla prima.
                pagina: Math.max(0, parseInt(w.pagina, 10) || 0),
                v: VERSIONE_LAYOUT_WIDGET,
            };
        });
    // Bootstrap a riga singola SOLO per i widget normali: le copie di un
    // widget multiIstanza (Vetrina) nascono esclusivamente dal picker
    // "Aggiungi", mai automaticamente — un id simile qui creerebbe una
    // copia vuota e invisibile che nessuno ha chiesto.
    Object.entries(CATALOGO_WIDGET).forEach(([id, def]) => {
        if (def.multiIstanza) return;
        if (!validi.find(w => w.id === id)) validi.push({ id, instanceId: _nuovoInstanceId(), visibile: false, size: '3x2', mini: false, cartaId: null, pagina: 0, v: VERSIONE_LAYOUT_WIDGET });
    });
    _layoutWidget = validi;
    // Persiste subito gli instanceId appena generati per un layout vecchio,
    // così al prossimo giro non li rigenera (restano stabili tra i render).
    if (generatoQualcheId || migratoQualcosa) _salvaLayoutWidget(false); // migrazione interna, non un'azione utente — vedi missioni m94/m95
}

// daAzioneUtente=false SOLO per la migrazione di un layout vecchio in
// _caricaLayoutWidget() (generazione instanceId stabili) — non è
// personalizzazione vera, non deve far scattare le missioni m94/m95.
// Tutti gli altri 7 chiamanti (sposta, nascondi, mostra, aggiungi istanza,
// seleziona carta Vetrina, resize, riordino drag) sono azioni reali
// dell'utente, default true.
function _salvaLayoutWidget(daAzioneUtente = true) {
    // _layoutWidgetUserId e' impostato da _caricaLayoutWidget(), che gira
    // sempre prima di qualunque azione utente possibile su questo layout —
    // se manca (non dovrebbe succedere) non c'e' una chiave sicura su cui
    // scrivere, meglio non salvare che scrivere sotto lo userId sbagliato.
    if (!_layoutWidgetUserId) return;
    prefWidgetLayoutSet(_layoutWidgetUserId, JSON.stringify(_layoutWidget));
    if (daAzioneUtente) _missioneAggancioPersonalizzaLayout();
}

// Fire-and-forget: un fallimento qui non deve mai bloccare il salvataggio
// del layout, che è la parte importante di questa funzione. UNIQUE(owner_id,
// periodo, missione_id) in missioni_completate assorbe silenziosamente le
// chiamate ripetute nello stesso giorno (drag/resize possono chiamare
// _salvaLayoutWidget() molte volte) — solo il primo insert del giorno va a
// buon fine, gli altri falliscono con 23505 e va bene così.
async function _missioneAggancioPersonalizzaLayout() {
    try {
        const userId = await authGetUserId();
        if (!userId) return;
        const oggi = new Date().toISOString().slice(0, 10);
        await missioniInserisciCompletamento(userId, 'm94_personalizza', 'giornaliera', oggi);
        await missioniInserisciCompletamento(userId, 'm95_il_tuo_telefono', 'una_tantum', 'sempre');
    } catch (_) { /* silenzioso, vedi commento sopra */ }
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

// ── RENDER GRIGLIA HOME, GESTIONE WIDGET, AZIONE WIDGET — SPOSTATO (STEP 6
// del piano di taglio 2026-09-11, ULTIMO STEP) in
// ui/paginainiziale-render.ui.js. Conteneva: renderWidgetHome,
// _potaContenutoFuoriTessera, _eseguiAzioneWidget, _spostaWidget,
// _nascondiWidget, _apriPickerAggiungiWidget/_chiudiPickerAggiungiWidget,
// _mostraWidget, _aggiungiIstanzaWidget, _testForzaTaglia2x2,
// toggleModificaWidgetHome.
//
// Con questo step il taglio del motore home (ui/paginainiziale.ui.js,
// originariamente 2198 righe) è completo. Restano qui solo: registro
// CATALOGO_WIDGET, costanti di griglia/taglie, funzioni taglia
// (_correggiTagliaZonaIcona/_formaWidget/_leggiTaglia/_migraTagliaWidget),
// variabili di stato centrali (_layoutWidget e affini) e persistenza
// layout (_caricaLayoutWidget/_salvaLayoutWidget/_nuovoInstanceId) — tenuti
// insieme deliberatamente: sono il "nocciolo" del motore, comunque piccolo
// (~380 righe) e coeso, un settimo file qui avrebbe fatto più danno che
// bene. Vedi elenco completo dei 6 file paginainiziale-*.ui.js nel
// compilato di questa sessione.
// ── DRAG & DROP (riordino) + RIDIMENSIONAMENTO — SPOSTATO (STEP 4 del
// piano di taglio 2026-09-11) in ui/paginainiziale-drag-resize.ui.js.
// Conteneva: _dragState/_resizeState/_peekTimeout/_riordinoInCorso,
// _toggleMenuSpostaWidget, _chiudiMenuSpostaWidget, _aggiornaMenuSpostaWidget,
// _attivaDragEResize, _onResizeHandlePointer*, _onWidgetPointer*,
// _avviaDragVero, _riordinaConAnimazione, _mostraPeek/_nascondiPeek,
// _rettangoloSchermoCornice, _posizionaContainerNelloSchermo.

// ── APERTURA/CHIUSURA DETTAGLIO WIDGET — SPOSTATO (STEP 1 del piano di
// taglio 2026-09-11) in ui/paginainiziale-dettaglio.ui.js. Conteneva:
// DURATA_ANIMAZIONE_DETTAGLIO_MS, _chiusuraDettaglioTimeout,
// _impostaOrigineAnimazione, apriDettaglioWidget, chiudiDettaglioWidget.

// ── RESIZE CORNICE, CORNICE/SFONDO, PONTE STATUSBAR — SPOSTATO (STEP 2 del
// piano di taglio 2026-09-11) in ui/paginainiziale-cornice-statusbar.ui.js.
// Conteneva: _gestisciResizeCornice(Debounced), _applicaCorniceUtente,
// _applicaSfondoUtente, _aggiornaOrologioStatusBar, _impostaSyncAttivo,
// _phoneAudioCtx/_beep, toggleSuoniWidgetHome, _controllaNotifichePush,
// _mostraNotificaPush.

// ── POLLING, TASTO FISICO, PRESENZA LIVE, AVVIO — SPOSTATO (STEP 5 del
// piano di taglio 2026-09-11) in ui/paginainiziale-polling-avvio.ui.js.
// Conteneva: INTERVALLO_WIDGET_VELOCE_MS/LENTO_MS, avviaPollingWidgetHome,
// _paginaAttivaTelefono, _vaiAllaPaginaHome, _aggiornaMatitaBarraGlobale,
// _aggiornaTastoFisico, _clickTastoFisico, _avviaPresenzaLive,
// initPhoneShell (bootstrap, chiamato dall'inline <script> in fondo a
// index.html).
