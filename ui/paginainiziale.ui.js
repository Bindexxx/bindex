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

// ── PAGINE MULTIPLE DELLA HOME (Claudio, 2026-09-03) ────────────────────
// Ogni riga di _layoutWidget porta un campo 'pagina' (0 = prima pagina).
// Il numero di pagine NON e' uno stato salvato: e' dedotto ogni volta dal
// massimo 'pagina' fra i widget visibili. Cosi' non esiste il caso di una
// pagina "che esiste ma non contiene niente" da dover ripulire: svuoti
// l'ultima pagina e sparisce da se'.
//
// PERCHE' NESSUN GESTORE DI SWIPE SCRITTO A MANO. Sulla stessa superficie
// convivono tre gesti: lo scatto verticale fra home fissa e pagina widget
// (scroll-snap gia' esistente), il trascinamento dei widget, e ora lo
// scorrimento orizzontale fra pagine. Gli ASSI sono pero' diversi:
// scroll-snap-type y sul contenitore esterno, x su quello interno, e il
// browser li tiene separati da solo. Un gestore di pointer scritto a mano
// avrebbe dovuto arbitrare fra i tre — ed e' esattamente il terreno dei
// bug di pointercancel gia' incontrati in questo progetto. L'unico
// intervento necessario e' touch-action:none sulle tessere in modifica
// (in index.html), perche' li' il trascinamento deve vincere sullo
// scorrimento.
let _paginaWidgetCorrente = 0;

// ── TRABOCCAMENTO NELLA PAGINA SUCCESSIVA (Claudio, 2026-09-03) ─────────
// La pagina ha altezza fissa e non scorre. Prima, i widget che non ci
// stavano venivano semplicemente tagliati dal bordo e toccava all'utente
// accorgersene e spostarli a mano. Ora traboccano da soli: quello che non
// entra passa alla pagina dopo, a cascata.
//
// IL CAMPO 'pagina' RESTA L'INTENZIONE DELL'UTENTE, NON IL RISULTATO.
// Il traboccamento e' una decisione di IMPAGINAZIONE, presa a ogni render,
// e NON viene riscritta nel layout salvato. E' la scelta importante di
// questo pezzo, per due motivi:
//   - ruotando lo schermo la pagina cambia forma e capienza; se il
//     traboccamento fosse salvato, una rotazione riscriverebbe per sempre
//     la disposizione che l'utente aveva costruito a mano;
//   - quando lo spazio torna (rotazione indietro, widget rimpicciolito),
//     i widget traboccati rientrano da soli al loro posto.
// Quindi: l'utente dice DOVE vuole che un widget cominci, la capienza
// decide dove finisce davvero.

// Misura colonne, altezza di riga, spazi e altezza utile di una pagina.
// Legge dal DOM gia' impaginato quando c'e' (unico modo affidabile, visto
// che in orizzontale le colonne sono elastiche e non le sa nemmeno il
// CSS finche' non misura); al primo render ripiega sulle costanti.
function _misuraPaginaWidget() {
    const grigliaEsistente = document.querySelector('.widget-griglia');
    const paginaEsistente = document.querySelector('.widget-pagina');
    let colonne = COLONNE_GRIGLIA_WIDGET;
    let altezzaRiga = 48;
    let spazio = 11.2;
    let altezzaUtile = 0;

    if (grigliaEsistente) {
        const st = getComputedStyle(grigliaEsistente);
        const cols = st.gridTemplateColumns.split(' ').filter(Boolean).length;
        if (cols > 0) colonne = cols;
        const riga = parseFloat(st.gridAutoRows);
        if (riga > 0) altezzaRiga = riga;
        const g = parseFloat(st.rowGap);
        if (g >= 0) spazio = g;
    }
    if (paginaEsistente) {
        const st = getComputedStyle(paginaEsistente);
        altezzaUtile = paginaEsistente.clientHeight
            - (parseFloat(st.paddingTop) || 0)
            - (parseFloat(st.paddingBottom) || 0);
    } else {
        const wrap = document.getElementById('phoneWidgetHomeWrap');
        // Ripiego per il primo render: l'altezza del contenitore meno un
        // margine prudente per il padding della pagina, che non esiste
        // ancora e non si puo' misurare.
        if (wrap) altezzaUtile = wrap.clientHeight - 70;
    }

    const righe = Math.max(1, Math.floor((altezzaUtile + spazio) / (altezzaRiga + spazio)));
    return { colonne, righe };
}

// TAGLIA EFFETTIVA DI RENDERING (Claudio, 2026-09-10 — fix "widget che
// diventano non piu' visibili se ridimensionati oltre la misura dello
// schermo"): la taglia salvata (w.size) resta l'INTENZIONE dell'utente,
// esattamente come il campo 'pagina' per il traboccamento (vedi commento
// sopra _distribuisciWidgetInPagine) — non viene mai riscritta qui. Quello
// che si vede e' invece sempre clampato alla griglia VERA misurata in
// QUESTO render.
//
// PRIMA: la classe CSS widget-col-N/widget-row-N (che decide lo
// grid-column/grid-row span) veniva costruita da _leggiTaglia(w.size)
// grezza, il cui unico tetto era COLONNE_MAX_WIDGET=36/RIGHE_MAX_WIDGET=24
// — assoluto, scollegato dalle colonne VERE della griglia in quel momento
// (6 fisse in verticale, elastiche in orizzontale — vedi CSS
// .widget-griglia). Un widget con uno span maggiore delle colonne
// disponibili non viene "clippato" da CSS Grid: viene spinto fuori
// dall'area visibile. Capitava tipicamente ridimensionando su una griglia
// larga (tante colonne) e poi riaprendo su una piu' stretta (rotazione,
// resize della finestra desktop).
//
// ORA: ogni chiamante usa QUESTA funzione al posto di _leggiTaglia(w.size)
// per tutte le decisioni visive della tessera (span CSS, soglia icona
// statica, soglia incisione, corpo "grande") — mai solo per lo span,
// altrimenti la tessera potrebbe apparire clampata in larghezza ma con un
// corpo pensato per la taglia grande, sovrapponendosi comunque.
function _tagliaEffettiva(w, misura) {
    const t = _leggiTaglia(w.size);
    let col = Math.max(1, Math.min(t.col, misura.colonne));
    let row = Math.max(1, Math.min(t.row, misura.righe));
    ({ col, row } = _correggiTagliaZonaIcona(col, row));
    // Rete di sicurezza finale: lo standard 2x2 e' un PAVIMENTO, ma non
    // deve mai superare lo spazio VERO disponibile in questo render —
    // altrimenti su una griglia estrema (meno di 2 colonne/righe reali)
    // si ricrea esattamente il bug del widget che sparisce oltre i bordi
    // che _tagliaEffettiva doveva risolvere in primo luogo.
    col = Math.min(col, misura.colonne);
    row = Math.min(row, misura.righe);
    return { col, row };
}

// Distribuisce i widget nelle pagine rispettando la capienza.
// Riproduce l'algoritmo "sparse" di CSS Grid (auto-flow row): un cursore
// che non torna mai indietro, e ogni elemento nel primo posto libero a
// partire dal cursore. Riprodurlo invece di inventare una collocazione e'
// il punto: se la simulazione e il browser non fossero d'accordo, i
// widget verrebbero spostati di pagina per un traboccamento che poi non
// avviene, o viceversa.
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
        // Salto in avanti quando l'utente ha chiesto una pagina piu'
        // avanti. Mai all'indietro: un widget assegnato alla pagina 1 non
        // puo' finire sulla 0 solo perche' li' era rimasto un buco.
        const voluta = Math.max(paginaVoluta, v.pagina || 0);
        while (pagine.length - 1 < voluta) nuovaPagina();
        paginaVoluta = voluta;

        const t = _leggiTaglia(v.size);
        const dc = Math.min(t.col, colonne);
        const dr = t.row;

        // Un widget piu' alto dell'intera pagina non entrerebbe mai da
        // nessuna parte: lo si tiene dov'e' invece di mandarlo in un ciclo
        // infinito di pagine nuove. Il ridimensionamento non permette di
        // arrivarci, ma un layout salvato con una pagina piu' alta (o una
        // rotazione) puo'.
        const drEffettivo = Math.min(dr, righe);

        let messo = false;
        while (!messo) {
            let r = curR, c = curC;
            let trovato = null;
            // Scansione in avanti dal cursore, riga per riga.
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
                // Non entra: trabocca. Da qui in poi anche i successivi
                // partiranno da questa pagina nuova.
                nuovaPagina();
                paginaVoluta = pagine.length - 1;
            }
        }
    });

    return pagine;
}

// Numero di pagine risultante dall'ultima impaginazione. Non e' piu'
// deducibile dal solo campo 'pagina', perche' il traboccamento puo'
// aggiungerne.
let _paginePresenti = 1;

// Quante pagine esistono davvero. In modifica se ne mostra SEMPRE una in
// piu', vuota: e' li' che si spinge un widget per creare una pagina nuova,
// senza bisogno di un pulsante "aggiungi pagina" e senza stato da salvare.
function _numeroPagineWidget() {
    const visibili = (_layoutWidget || []).filter(w => w.visibile);
    const maxPagina = visibili.reduce((m, w) => Math.max(m, w.pagina || 0), 0);
    // Il massimo fra "dove l'utente ha chiesto di mettere le cose" e "dove
    // sono finite davvero dopo il traboccamento".
    const base = Math.max(maxPagina + 1, _paginePresenti);
    return base + (_editModeWidget ? 1 : 0);
}

// NESSUNA PAGINA VUOTA IN MEZZO (Claudio, 2026-09-10: "fai esattamente
// come android e cancella le pagine vuote"). Il campo 'pagina' resta la
// scelta dell'utente (il traboccamento non lo tocca mai, vedi la nota
// sopra _distribuisciWidgetInPagine) — ma se un'azione (sposta widget in
// un'altra pagina, nascondi l'ultimo widget di una pagina) svuota una
// pagina che sta PRIMA di altre pagine piene, quel buco va richiuso: le
// pagine successive scalano indietro di uno, esattamente come un launcher
// Android che elimina da solo una home page svuotata.
// Richiamata a inizio di ogni renderWidgetHome() (non sparsa nei singoli
// punti che possono svuotare una pagina): stessa filosofia "auto-
// correggersi ad ogni render" già usata per _tagliaEffettiva — più
// robusto che dover ricordarsi di chiamarla in ogni punto che tocca
// 'pagina' o 'visibile'. Ritorna true se ha davvero cambiato qualcosa
// (serve al chiamante per sapere se salvare).
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

// Sposta un widget alla pagina precedente/successiva. Unico modo previsto
// per cambiare pagina a un widget: il trascinamento fino al bordo dello
// schermo per "passare di la'" e' molto piu' fragile su touch (va
// arbitrato con lo scorrimento orizzontale, e su dito grosso parte da
// solo), mentre due frecce funzionano al primo colpo. Si potra' aggiungere
// il trascinamento in seguito SOPRA questo, non al suo posto.
function _spostaWidgetInPagina(instanceId, delta) {
    const w = (_layoutWidget || []).find(x => x.instanceId === instanceId);
    if (!w) return;
    const nuova = Math.max(0, (w.pagina || 0) + delta);
    if (nuova === (w.pagina || 0)) return;
    w.pagina = nuova;
    _salvaLayoutWidget();
    _paginaWidgetCorrente = nuova;
    _menuSpostaWidgetApertoId = null; // il menu si chiude da solo dopo l'azione, come un vero menu contestuale
    renderWidgetHome();
}

// Riordino DENTRO la pagina: scambia con il widget visibile precedente/
// successivo della STESSA pagina. Il vecchio _spostaWidget lavorava su
// indici dell'intero elenco visibile e, con le pagine, avrebbe fatto
// saltare un widget da una pagina all'altra come effetto collaterale
// invisibile.
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
    _menuSpostaWidgetApertoId = null; // il menu si chiude da solo dopo l'azione, come un vero menu contestuale
    renderWidgetHome();
}

// Scorre alla pagina indicata (puntini in basso, o ritorno dopo un
// re-render). 'istantaneo' serve durante il ridimensionamento, che
// ridisegna a ogni movimento del dito: li' un'animazione morbida
// produrrebbe uno sfarfallio continuo.
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
    // Il tasto casetta compare/sparisce a seconda che tu sia sulla prima
    // pagina o no: prima lo aggiornava lo scatto verticale, che non
    // esiste piu'.
    _aggiornaTastoFisico();
}

// Frecce ai lati dei puntini (Claudio, 2026-09-10) — stesso spostamento
// relativo di _spostaWidgetInPagina ma per la NAVIGAZIONE (non sposta
// nessun widget, sposta solo la visuale).
function _vaiAllaPaginaWidgetRelativa(delta) {
    _vaiAllaPaginaWidget(_paginaWidgetCorrente + delta);
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

// ───────────────────────────────────────────────────────────────────────
// SEZIONE 2 — Render griglia, gestione widget (mostra/nascondi/aggiungi),
// esecuzione azione widget (originariamente righe 3095-3564 di
// phone.ui.js). NOTA: subito dopo questa sezione, in phone.ui.js originale
// c'era il blocco "RICERCA CARTE per Vetrina" (_apriRicercaCartaVetrina e
// affini) — resta apposta in ui/phone.ui.js, NON qui: è logica specifica
// del widget Vetrina, non del motore home. Verrà spostata in
// widget-vetrina.ui.js allo STEP 20. _aggiungiIstanzaWidget qui sotto la
// richiama comunque (per i widget multiIstanza, oggi solo Vetrina) — è un
// accoppiamento già esistente nel codice originale, non introdotto ora:
// funziona perché tutti gli script condividono lo stesso scope globale e
// phone.ui.js è comunque caricato prima che l'utente possa cliccare.
// ───────────────────────────────────────────────────────────────────────

// ── RENDER GRIGLIA HOME ──────────────────────────────────────────────────
async function renderWidgetHome() {
    if (!_layoutWidget) await _caricaLayoutWidget();

    const cont = document.getElementById('phoneWidgetPagine');
    if (!cont) return;

    // Richiude i buchi fra pagine PRIMA di qualunque altro calcolo (vedi
    // _compattaPagineWidget) — deve girare prima che _misuraPaginaWidget/
    // _distribuisciWidgetInPagine ragionino su quali pagine esistono.
    if (_compattaPagineWidget()) _salvaLayoutWidget(false); // correzione automatica, non un'azione utente

    const visibili = _layoutWidget.filter(w => w.visibile);
    const primoRender = !_primoRenderWidgetFatto;

    // Misurata QUI, prima di costruire le tessere, cosi' la stessa misura
    // serve sia per clampare la taglia di ogni singola tessera (vedi
    // _tagliaEffettiva) sia per l'impaginazione piu' sotto — un'unica
    // fonte di verita' per "quanto spazio c'e' davvero in questo render",
    // invece di due misurazioni separate che potrebbero disallinearsi.
    const misura = _misuraPaginaWidget();

    // Raccolta locale, riversata in _ballAttenzioni a fine render: le
    // tessere si costruiscono in parallelo con Promise.all, scrivere
    // direttamente sulla globale lascerebbe residui dei widget rimossi.
    const attenzioni = {};

    const tessere = await Promise.all(visibili.map(async (w, indice) => {
        const def = CATALOGO_WIDGET[w.id];
        if (!def) return '';
        let anteprima = { righe: ['—'] };
        if (!def.bloccato) {
            try { anteprima = await def.preview(w); } catch (e) { console.error('Errore preview widget ' + w.id + ':', e); }
        } else {
            anteprima = def.preview(w);
        }

        const classeStato = anteprima.stato === 'allerta' ? 'widget-tile-allerta' : (anteprima.stato === 'ok' ? 'widget-tile-ok' : '');
        const classeCascata = primoRender ? 'widget-tile-entrata' : '';
        const stileRitardo = primoRender ? `style="animation-delay:${Math.min(indice * 45, 400)}ms"` : '';

        // CONTROLLI DI MODIFICA — ridisegnati (Claudio, 2026-09-10): prima
        // 5 bottoni fissi da 22px (su/giù/pagina prec/pagina succ/rimuovi)
        // non ci stavano in una tessera piccola (lo standard 2x2 li rende
        // comuni) e si accavallavano fra tessere vicine — vedi screenshot.
        // Il trascinamento (vedi _onWidgetPointerDown) è già il modo
        // primario e "semplice" per riordinare — su/giù/pagina prec/succ
        // restano disponibili come PIANO B dentro un menu a comparsa (⋮),
        // per chi preferisce non trascinare. Sulla tessera restano SEMPRE
        // visibili solo 2 elementi (⋮ e X), che ci stanno anche su una
        // 2x2, più la maniglia di resize.
        const menuSpostaAperto = _menuSpostaWidgetApertoId === w.instanceId;
        const controlliEdit = _editModeWidget ? `
            <div class="widget-edit-controls" onclick="event.stopPropagation()">
                <button type="button" onclick="_toggleMenuSpostaWidget('${w.instanceId}', event)" title="Sposta"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                <button type="button" onclick="_nascondiWidget('${w.instanceId}')" title="Rimuovi dalla home" class="widget-edit-remove"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="widget-menu-sposta${menuSpostaAperto ? ' aperto' : ''}" id="menuSposta_${w.instanceId}" onclick="event.stopPropagation()">
                <button type="button" onclick="_spostaWidgetNellaPagina('${w.instanceId}', -1)"><i class="fa-solid fa-arrow-up"></i> Sposta su</button>
                <button type="button" onclick="_spostaWidgetNellaPagina('${w.instanceId}', 1)"><i class="fa-solid fa-arrow-down"></i> Sposta giù</button>
                <button type="button" onclick="_spostaWidgetInPagina('${w.instanceId}', -1)" ${(w.pagina || 0) === 0 ? 'disabled' : ''}><i class="fa-solid fa-chevron-left"></i> Pagina precedente</button>
                <button type="button" onclick="_spostaWidgetInPagina('${w.instanceId}', 1)"><i class="fa-solid fa-chevron-right"></i> Pagina successiva</button>
            </div>
            <div class="widget-resize-handle" data-widget-id="${w.instanceId}" title="Trascina per ridimensionare"><i class="fa-solid fa-up-right-and-down-left-from-center"></i></div>` : '';

        // Badge Pokédex sul primo numero trovato in "righe".
        // CORREZIONE 27/08/2026: la regex era /\d+/ e su "1.284 carte
        // totali" si fermava al punto, mostrando "1" invece di "1.284" —
        // succedeva su qualunque conteggio a quattro cifre. Ora tiene
        // separatori di migliaia e decimali.
        // Il badge è anche disattivabile da Impostazioni: su una tessera
        // 1x1 ripete il dato già inciso nella pancia della ball.
        // 'badge' esplicito (oggi solo 'suggerimento': conta i segnali
        // attivi, non un numero già dentro il testo) ha la precedenza;
        // altrimenti resta il comportamento di sempre per tutti gli altri.
        const primoNumero = (anteprima.righe[0] || '').match(/\d[\d.,]*/);
        // 'badge: false' = questo widget NON ha un numerino, non estrarlo.
        // Serve agli elenchi con le date (Ultime aggiunte, Prezzi
        // aggiornati): il numero pescato da righe[0] era il GIORNO della
        // prima voce, mostrato come se fosse un conteggio di notifiche —
        // "23" per una carta aggiunta il 23/08. Difetto visto in uno
        // screenshot di Claudio il 2026-09-03.
        // null e undefined restano "estrai in automatico", come sempre:
        // nessun widget esistente cambia comportamento.
        const valoreBadge = anteprima.badge === false ? null
            : (anteprima.badge != null ? anteprima.badge : (primoNumero ? primoNumero[0] : null));
        const badge = (valoreBadge != null && prefBadgeWidgetGet()) ? `<div class="widget-badge">${valoreBadge}</div>` : '';

        // Bordo colorato per rarità SOLO se la carta ha davvero un campo
        // 'rarita' valorizzato (mai confermato nello schema in questa
        // sessione — nessun rischio: se il campo non esiste, la classe
        // semplicemente non si applica e resta il bordo neutro di sempre).
        const classeRarita = anteprima.rarita ? ` widget-tile-thumb-r-${String(anteprima.rarita).toLowerCase().replace(/\s+/g, '_')}` : '';
        const rigaImmagine = anteprima.immagine
            ? `<div class="widget-tile-thumb-row"><img class="widget-tile-thumb${classeRarita}" src="${_urlImmagineVisualizzabile(anteprima.immagine, 96) || ''}" alt="" onerror="this.style.display='none';"></div>`
            : '';

        const azioneClick = _editModeWidget || def.decorativo ? '' : `onclick="_eseguiAzioneWidget('${w.instanceId}', event)"`;

        // ── VISUALE DELLA TESSERA ───────────────────────────────────────
        // Con BALL_ATTIVA la vecchia icona FontAwesome lascia il posto alla
        // sfera. Il ramo else qui sotto è il markup ORIGINALE, intatto:
        // rimettere BALL_ATTIVA a false in cima al file riporta tutto com'era.
        // I widget con immagine (Ultima carta, Carta del giorno) restano
        // senza ball e mostrano la carta, per scelta di Claudio.
        // Taglia e modalita' icona: DEVONO stare prima della visuale.
        // BUG 2026-09-03 (segnalato da Claudio con screenshot): erano
        // calcolate piu' sotto, quindi la sfera veniva costruita anche a
        // taglia minima — 90px dentro una cella da ~50px, con le sfere che
        // si sovrapponevano l'una sull'altra e l'incisione del titolo
        // ancora leggibile. Ora la modalita' icona esclude la sfera in
        // partenza.
        const _t = _tagliaEffettiva(w, misura);
        const _iconaStatica = w.mini || _t.col < CELLE_MIN_PER_SFERA || _t.row < 2;

        let visuale;
        if (BALL_ATTIVA && !anteprima.immagine && _iconaStatica) {
            // SFERA FERMA (Claudio: "devono essere comunque piccole
            // pokeball, senza movimento e senza nome, non icone a caso").
            // Stessa sfera delle taglie grandi, ridotta al lato della
            // cella, ma SPOGLIATA di tutto cio' che si muove o occupa
            // spazio: niente alone, polvere, ombra, punti esclamativi del
            // semaforo, vetro con riflesso che scorre, anelli, particelle.
            // Niente incisione: a questa misura il testo sarebbe illeggibile
            // ed e' proprio quello che si vedeva nello screenshot.
            // Restano il corpo della sfera e il badge numerico.
            const aspettoMini = _ballASPETTO[w.id] || { emblema: 'piu', colore: null };
            visuale = `
                <div class="pkdx-icon-wrap pkdx-ball-statica"><div class="pkdx-ball">
                    <div class="pkdx-ball-body">${_ballSvgCache(aspettoMini.emblema, aspettoMini.colore, null)}</div>
                </div></div>`;
        } else if (BALL_ATTIVA && !anteprima.immagine) {
            const aspetto = _ballASPETTO[w.id] || { emblema: 'piu', colore: null };
            // L'incisione compare solo sulle 1x1: sulle altre taglie il
            // titolo per esteso sta fuori dalla ball, dove c'è spazio.
            let inciso = null;
            // Incisione solo sulla forma piccola (ex 1x1). Con le taglie
            // libere, confrontare w.size con la stringa '1x1' era diventato
            // sbagliato: '1x1' ora e' l'ICONA, dove non c'e' nemmeno la
            // sfera su cui incidere.
            if (_t.col <= 4 && _t.row <= 2 && prefScritteBallGet()) {
                const chiedeAttenzione = !!_ballChiedeAttenzione(w.id, anteprima);
                inciso = chiedeAttenzione
                    ? _ballAccorcia(anteprima.righe[0])
                    : (_ballTITOLI_BREVI[w.id] || def.titolo);
            }
            visuale = `
                <div class="pkdx-icon-wrap"><div class="pkdx-ball">
                    <span class="pkdx-ball-glow"></span>
                    <span class="pkdx-dust"></span>
                    <span class="ball-shadow"></span>
                    <span class="pkdx-avviso"><i class="a1">!</i><i class="a2">!</i><i class="a3">!</i></span>
                    <div class="pkdx-ball-body">${_ballSvgCache(aspetto.emblema, aspetto.colore, inciso)}</div>
                    <div class="ball-glass"><div class="ball-sweep"></div></div>
                    <span class="pkdx-lock-ring"></span>
                    <span class="pkdx-lock-ring ring-2"></span>
                    ${_ballParticelle()}
                </div></div>`;
        } else {
            visuale = `<i class="fa-solid ${def.icona} widget-tile-icon"></i>`;
        }

        // Chi ha bisogno di attenzione: letto qui, usato dal semaforo senza
        // rifare nessuna query (i preview sono già stati calcolati sopra).
        attenzioni[w.instanceId] = _ballChiedeAttenzione(w.id, anteprima);

        // ── CORPO DELLA TESSERA ─────────────────────────────────────────
        // 1x1 e mini: solo la sfera, col titolo inciso nella pancia.
        // Taglie grandi: due slot, uno accanto alla sfera e uno sotto (il
        // secondo solo dove c'è altezza, cioè 1x2 e 2x2 — vedi il CSS).
        // Con BALL_ATTIVA a false si torna al corpo originale del sito.
        // Sotto CELLE_MIN_PER_SFERA la tessera e' un'icona statica: niente
        // sfera, niente corpo ricco. Sopra, tutto come prima.
        const grande = BALL_ATTIVA && !_iconaStatica && !(_t.col === 3 && _t.row === 2);
        let corpo;
        if (grande) {
            const c = _ballCorpoWidget(w.id, anteprima);
            corpo = `
                <div class="ball-testa">
                    ${visuale}
                    <div class="ball-slot-inline">
                        <div class="widget-tile-titolo">${def.titolo}</div>
                        ${c.inline}
                    </div>
                </div>
                ${c.blocco ? `<div class="ball-slot-blocco">${c.blocco}</div>` : ''}
                ${rigaImmagine}`;
        } else {
            corpo = `
                ${visuale}
                <div class="widget-tile-titolo">${def.titolo}</div>
                ${rigaImmagine}
                <div class="widget-tile-righe">${anteprima.righe.map(r => `<span>${r}</span>`).join('')}</div>`;
        }

        return `
            <div class="widget-tile ${classeStato} ${classeCascata} widget-size-${w.size} widget-col-${_t.col} widget-row-${_t.row} ${_formaWidget(_t.col, _t.row)} ${_iconaStatica ? 'widget-tile-mini' : ''}" ${stileRitardo} data-widget-id="${w.instanceId}" data-widget-index="${indice}" ${azioneClick}>
                ${controlliEdit}
                ${badge}
                <div class="tile-tinta"></div><div class="tile-alone"></div>
                ${corpo}
            </div>`;
    }));

    let tileAggiungi = '';
    if (_editModeWidget && visibili.length < MAX_WIDGET_VISIBILI) {
        tileAggiungi = `
            <div class="widget-tile widget-tile-aggiungi widget-col-3 widget-row-2 wf-piccolo" onclick="_apriPickerAggiungiWidget()">
                <i class="fa-solid fa-plus widget-tile-icon"></i>
                <div class="widget-tile-titolo">Aggiungi</div>
            </div>`;
    }

    // ── COMPOSIZIONE DELLE PAGINE ───────────────────────────────────────
    // Le tessere sono gia' state costruite tutte insieme (con Promise.all,
    // che va lasciato in un blocco solo: spezzarlo per pagina moltiplica
    // le query). Qui si distribuiscono soltanto.
    // Impaginazione vera: chi non ci sta trabocca sulla pagina dopo.
    // 'misura' e' la stessa calcolata a inizio funzione (vedi sopra), non
    // ricalcolata qui: stessa fonte di verita' usata per clampare le
    // singole tessere.
    const distribuzione = _distribuisciWidgetInPagine(visibili, misura);
    _paginePresenti = distribuzione.length;

    const nPagine = _numeroPagineWidget();
    // Uscendo dalla modifica la pagina vuota di cortesia sparisce: se
    // l'utente era proprio li', va riportato sull'ultima pagina vera,
    // altrimenti resterebbe su uno scorrimento che non esiste piu' e i
    // puntini indicherebbero una pagina sbagliata.
    if (_paginaWidgetCorrente > nPagine - 1) _paginaWidgetCorrente = nPagine - 1;
    const classiGriglia = 'widget-griglia'
        + (BALL_ATTIVA ? ' ball-ui' : '')
        + (_editModeWidget ? ' in-modifica-widget' : '');
    const paginaHtml = [];
    for (let p = 0; p < nPagine; p++) {
        // La pagina di destinazione arriva dalla distribuzione, non piu'
        // dal campo 'pagina' letto direttamente: fra i due c'e' di mezzo il
        // traboccamento.
        const suQuestaPagina = distribuzione[p] || [];
        const dentro = suQuestaPagina
            .map(w => tessere[visibili.indexOf(w)])
            .join('');
        // Il tassello "Aggiungi" sta sull'ultima pagina REALE, non su
        // quella vuota di cortesia che compare solo in modifica.
        const ultimaReale = p === nPagine - 1 - (_editModeWidget ? 1 : 0);
        const vuota = !dentro && !(ultimaReale && tileAggiungi);
        paginaHtml.push(`
            <div class="widget-pagina" data-pagina="${p}">
                <div class="${classiGriglia}">${dentro}${ultimaReale ? tileAggiungi : ''}</div>
                ${vuota && _editModeWidget ? '<div class="widget-pagina-vuota">Pagina vuota<br><small>spingi qui un widget con la freccia \u203a</small></div>' : ''}
            </div>`);
    }

    // NAVIGAZIONE FRA PAGINE PIU' CHIARA (Claudio, 2026-09-10: "non è
    // chiaro come si fa"): prima erano solo puntini da 7px a bassissimo
    // contrasto (30% di opacità), l'unico modo per capire che si poteva
    // cambiare pagina era scoprirlo per caso scorrendo. Ora: puntini dentro
    // una pillola visibile (si riconosce come controllo, non come
    // decorazione) + due frecce ai lati per chi preferisce toccare invece
    // di scorrere (utile anche su desktop, dove lo swipe orizzontale non è
    // sempre comodo col mouse). Le frecce restano disabilitate a inizio/
    // fine, stesso linguaggio già usato per "pagina precedente" nel menu
    // sposta.
    const puntini = nPagine > 1
        ? `<div id="phoneWidgetPuntini">
            <button type="button" class="widget-pagina-freccia" onclick="_vaiAllaPaginaWidgetRelativa(-1)" ${_paginaWidgetCorrente === 0 ? 'disabled' : ''} aria-label="Pagina precedente"><i class="fa-solid fa-chevron-left"></i></button>
            <div class="widget-puntini-pillola">${Array.from({ length: nPagine }, (_, i) =>
                `<button type="button" class="widget-puntino${i === _paginaWidgetCorrente ? ' attivo' : ''}" onclick="_vaiAllaPaginaWidget(${i})" aria-label="Pagina ${i + 1}"></button>`).join('')}</div>
            <button type="button" class="widget-pagina-freccia" onclick="_vaiAllaPaginaWidgetRelativa(1)" ${_paginaWidgetCorrente === nPagine - 1 ? 'disabled' : ''} aria-label="Pagina successiva"><i class="fa-solid fa-chevron-right"></i></button>
        </div>`
        : '';

    // Il ridimensionamento ridisegna a ogni movimento del dito: senza
    // questa riga lo scorrimento orizzontale tornerebbe a zero e la pagina
    // "scapperebbe" alla prima sotto le dita.
    const scrollPrima = Math.min(cont.scrollLeft, _paginaWidgetCorrente * cont.clientWidth);
    cont.innerHTML = paginaHtml.join('');
    const vecchiPuntini = document.getElementById('phoneWidgetPuntini');
    if (vecchiPuntini) vecchiPuntini.remove();
    if (puntini) cont.insertAdjacentHTML('afterend', puntini);
    cont.scrollLeft = scrollPrima;

    _primoRenderWidgetFatto = true;
    _ballAttenzioni = attenzioni;
    _potaContenutoFuoriTessera();

    // Al primo render, dopo la cascata d'ingresso, un giro di semaforo
    // così chi ha qualcosa da fare si fa notare subito invece di aspettare
    // i 5,2 secondi del ciclo.
    if (primoRender && BALL_ATTIVA) setTimeout(_ballGiraSemaforo, 900);

    if (_editModeWidget) _attivaDragEResize();
}

// ── NIENTE RIGHE TAGLIATE A META' (Claudio, 2026-09-03) ─────────────────
// La tessera ha altezza fissa e taglia cio' che esce. Con un elenco, il
// taglio cadeva a meta' di una riga: si leggeva mezza scritta e mezza data,
// che sembra un difetto di resa piu' che un limite di spazio.
// Qui, a disegno finito, si nasconde ogni blocco che NON ci sta per intero.
// Il risultato e' un elenco che finisce dove finisce la tessera, come le
// liste dei widget di un telefono vero.
//
// PERCHE' DOPO IL DISEGNO E NON PRIMA: quante righe ci stiano dipende dal
// font, dalla densita' scelta, dalla lingua e dalla larghezza della
// tessera. Calcolarlo in anticipo vorrebbe dire indovinare l'altezza di un
// testo non ancora impaginato; misurarlo dopo e' esatto.
//
// COSTO: una lettura di geometria su poche decine di elementi. Gira anche
// durante il ridimensionamento (che ridisegna a ogni movimento del dito),
// quindi resta volutamente minimale: nessuna scrittura di stile se non
// serve, e nessun ciclo annidato.
function _potaContenutoFuoriTessera() {
    document.querySelectorAll('.widget-tile .ball-slot-blocco').forEach(blocco => {
        const tessera = blocco.closest('.widget-tile');
        if (!tessera) return;
        const stile = getComputedStyle(tessera);
        const fondo = tessera.getBoundingClientRect().bottom - (parseFloat(stile.paddingBottom) || 0);

        // I candidati sono i blocchi "atomici": una riga di elenco, una
        // colonna di categoria con le sue carte, un grafico. Mai le
        // singole carte dentro una fila — nascondere la terza carta di
        // tre lascerebbe una categoria monca, che e' peggio del taglio.
        // .ball-quota aggiunta il 2026-09-06 per il widget 'contributi':
        // barra + didascalia della percentuale, che vanno nascoste
        // INSIEME. Nessun altro widget usa questa classe, quindi la
        // riga non cambia il comportamento di nulla di esistente.
        blocco.querySelectorAll(':scope > .ball-riga, :scope > .ball-gruppi > .ball-gruppo, :scope > .ball-spark, :scope > .ball-strip, :scope > .ball-quota').forEach(pezzo => {
            // Sempre ripristinato prima di misurare: la tessera puo' essere
            // stata ingrandita dall'ultimo giro e cio' che prima non ci
            // stava ora ci sta.
            pezzo.style.display = '';
            if (pezzo.getBoundingClientRect().bottom > fondo + 1) pezzo.style.display = 'none';
        });
    });
}

// Esegue l'azione del widget: 'azione' personalizzata nel catalogo se
// presente (riceve gli stessi dati calcolati da preview, per widget come
// carta del giorno/ultima carta che devono sapere QUALE carta aprire),
// altrimenti apre come dettaglio la tab indicata in 'tab' o l'id stesso.
async function _eseguiAzioneWidget(instanceId, evt) {
    const w = _layoutWidget.find(x => x.instanceId === instanceId);
    const def = w && CATALOGO_WIDGET[w.id];
    if (!def || def.bloccato) return;

    // Missioni/Traguardi Fase 2 — apertura sezioni/widget (2026-08-30).
    // Fire-and-forget, stesso pattern di missioniAccessoRegistraOggi in
    // ui/auth.ui.js: un fallimento qui non deve mai bloccare l'apertura
    // del widget. Nessun dedup: ogni apertura conta (stesso approccio di
    // missioniRicercaRegistra). Loggato per TUTTI i widget, anche quelli
    // senza ancora una missione agganciata — le prossime missioni di
    // questa categoria non richiederanno un nuovo punto di scrittura, solo
    // una nuova lettura in ui/missioni.ui.js:raccogliDati().
    (async () => {
        try {
            const userId = await authGetUserId();
            if (userId) await missioniAperturaWidgetRegistra(userId, w.id);
        } catch (e) { console.error('[missioni] registrazione apertura widget:', e); }
    })();

    // Animazione di cattura PRIMA di aprire. Mai in modalità modifica: lì
    // il tocco lungo apre il peek e il trascinamento riordina, e 2,6s di
    // animazione a ogni tentativo di spostare un widget renderebbero il
    // riordino inusabile. (_eseguiAzioneWidget non viene nemmeno agganciata
    // in edit mode — vedi azioneClick nel render — ma il controllo resta
    // come rete se un giorno la si chiamasse da altrove.)
    // L'evento serve dopo per il punto d'origine dell'apertura: va
    // conservato ORA, perché dopo l'await l'oggetto evento è esaurito.
    const punto = evt ? { clientX: evt.clientX, clientY: evt.clientY, currentTarget: evt.currentTarget } : null;
    if (BALL_ATTIVA && !_editModeWidget && evt && evt.currentTarget) {
        try { await _ballGiocaCattura(evt.currentTarget); } catch (_) { /* l'animazione non deve mai bloccare l'apertura */ }
    }

    if (def.azione) {
        let dati = null;
        try { dati = await def.preview(w); } catch (_) { dati = null; }
        def.azione(dati, punto, w);
        return;
    }
    apriDettaglioWidget(def.tab || w.id, punto);
}

// SUPERATA dalle pagine multiple (2026-09-03) e senza piu' chiamanti: con
// le pagine, muovere per indice sull'elenco visibile faceva saltare un
// widget da una pagina all'altra come effetto collaterale invisibile. Le
// frecce su/giu' usano ora _spostaWidgetNellaPagina(instanceId, dir), che
// resta dentro la pagina. Lasciata qui perche' innocua e perche' un
// eventuale onclick residuo in una schermata non ancora aggiornata
// continuerebbe a funzionare invece di lanciare un errore.
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

function _nascondiWidget(instanceId) {
    const idx = _layoutWidget.findIndex(x => x.instanceId === instanceId);
    if (idx < 0) return;
    const w = _layoutWidget[idx];
    const def = CATALOGO_WIDGET[w.id];
    if (def && def.multiIstanza) {
        _layoutWidget.splice(idx, 1); // istanza effimera: via del tutto, non solo nascosta
    } else {
        w.visibile = false;
    }
    _salvaLayoutWidget();
    renderWidgetHome();
}

// Picker "Aggiungi": due tipi di voci ora. I widget multiIstanza (Vetrina)
// compaiono SEMPRE, anche se ne hai già una copia — cliccare ne crea una
// nuova. I widget normali compaiono solo se attualmente nascosti, come
// prima (_mostraWidget li riattiva, riga unica già esistente).
function _apriPickerAggiungiWidget() {
    const nascosti = _layoutWidget.filter(w => !w.visibile && !(CATALOGO_WIDGET[w.id] && CATALOGO_WIDGET[w.id].multiIstanza));
    const multi = Object.entries(CATALOGO_WIDGET).filter(([, def]) => def.multiIstanza);

    const container = document.getElementById('widgetPickerLista');
    const vociMulti = multi.map(([id, def]) => `
        <div class="widget-picker-riga" onclick="_aggiungiIstanzaWidget('${id}')">
            <i class="fa-solid ${def.icona}"></i> Aggiungi ${def.titolo}
        </div>`);
    const vociSingole = nascosti.map(w => `
        <div class="widget-picker-riga" onclick="_mostraWidget('${w.id}')">
            <i class="fa-solid ${CATALOGO_WIDGET[w.id].icona}"></i> ${CATALOGO_WIDGET[w.id].titolo}
        </div>`);
    const tutte = [...vociMulti, ...vociSingole].join('');
    container.innerHTML = tutte || '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Nessun altro widget disponibile.</p>';
    document.getElementById('widgetPickerModal').style.display = 'flex';
}

function _chiudiPickerAggiungiWidget() {
    document.getElementById('widgetPickerModal').style.display = 'none';
}

function _mostraWidget(id) {
    const visibiliCount = _layoutWidget.filter(w => w.visibile).length;
    if (visibiliCount >= MAX_WIDGET_VISIBILI) { alert(`Massimo ${MAX_WIDGET_VISIBILI} widget in home.`); return; }
    const w = _layoutWidget.find(x => x.id === id);
    if (w) {
        w.visibile = true;
        w.pagina = _paginaWidgetCorrente; // compare dove stai guardando, non sulla prima pagina
        // Se non e' mai stato ridimensionato a mano (e' ancora alla taglia
        // di ripiego), nasce alla taglia giusta per il suo contenuto.
        if (w.size === '3x2') w.size = _tagliaDiNascita(id);
    }
    _salvaLayoutWidget();
    _chiudiPickerAggiungiWidget();
    renderWidgetHome();
}

// Crea una nuova copia di un widget multiIstanza (oggi solo Vetrina) e
// apre subito la ricerca carte per scegliere cosa mostrarci — niente
// copia vuota abbandonata in giro senza che l'utente sappia cosa farci.
function _aggiungiIstanzaWidget(id) {
    const visibiliCount = _layoutWidget.filter(w => w.visibile).length;
    if (visibiliCount >= MAX_WIDGET_VISIBILI) { alert(`Massimo ${MAX_WIDGET_VISIBILI} widget in home.`); return; }
    // Nasce sulla pagina che stai guardando, non sempre sulla prima.
    const nuovo = { id, instanceId: _nuovoInstanceId(), visibile: true, size: _tagliaDiNascita(id), mini: false, cartaId: null, pagina: _paginaWidgetCorrente, v: VERSIONE_LAYOUT_WIDGET };
    _layoutWidget.push(nuovo);
    _salvaLayoutWidget();
    _chiudiPickerAggiungiWidget();
    renderWidgetHome();
    _apriRicercaCartaVetrina(nuovo.instanceId);
}

// ───────────────────────────────────────────────────────────────────────
// SEZIONE 3 — Bottone diagnostico "2x2" (originariamente righe 3644-3657
// di phone.ui.js). Usa-e-getta secondo Claudio, vedi compilati precedenti.
// ───────────────────────────────────────────────────────────────────────

// STRUMENTO DIAGNOSTICO (Claudio, 2026-09-10) — forza il PRIMO widget
// visibile a '2x2' cosi' si vede dal vivo quanto rende grande lo standard
// minimo di zona icona, senza doverci arrivare trascinando a mano.
// Usa-e-getta: modifica per davvero il widget (non e' un'anteprima finta),
// quindi resta lì finché non lo ridimensioni di nuovo — è lo scopo,
// vederlo esattamente come sarebbe per un utente vero.
function _testForzaTaglia2x2() {
    const w = (_layoutWidget || []).find(x => x.visibile);
    if (!w) return;
    w.size = '2x2';
    w.mini = false;
    _salvaLayoutWidget(false); // diagnostico, non conta come personalizzazione vera per le missioni
    renderWidgetHome();
}

// ───────────────────────────────────────────────────────────────────────
// SEZIONE 4 — Modifica/drag/resize, peek, apertura/chiusura dettaglio
// widget (originariamente righe 3659-4194 di phone.ui.js).
// ───────────────────────────────────────────────────────────────────────

function toggleModificaWidgetHome() {
    _editModeWidget = !_editModeWidget;
    const btn = document.getElementById('btnModificaWidgetHome');
    if (btn) {
        btn.classList.toggle('attivo', _editModeWidget);
        // Testo esplicito ("Fatto" mentre sei dentro, non solo un colore
        // diverso) — Claudio voleva un bottone che si capisce al volo,
        // stessa logica del perché e' stato spostato fuori dalla barra
        // affollata.
        const label = btn.querySelector('span');
        if (label) label.textContent = _editModeWidget ? 'Fatto' : 'Modifica';
    }
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
// in fondo al file). Un solo posto dove può disallinearsi, non due.
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
    // FIX 2026-09-10 (bug: "schermata nera con una transizione che entra
    // da destra verso sinistra", segnalato su bustina ma riguarda OGNI
    // widget): --pokeball-x/-y alimentano clip-path: circle(... at
    // var(--pokeball-x) var(--pokeball-y)) su .container — per specifica
    // CSS quella posizione è relativa al reference box di .container
    // STESSO (il suo angolo in alto a sinistra), MAI al viewport. Prima
    // funzionava per coincidenza: .container, aperto a tutta la finestra
    // (decisione 30/08, annullata oggi per "cornice pokedex"), partiva
    // sempre da (0,0) nel viewport — le coordinate assolute del click
    // (evt.clientX/Y) coincidevano già con quelle locali. Ora che
    // .container è agganciato al rettangolo di #phoneScreen (quasi mai a
    // 0,0 nel viewport), la stessa origine assoluta finiva calcolata
    // rispetto al punto sbagliato: il cerchio nasceva ben fuori dal box
    // visibile (a destra) e "spazzava" verso sinistra crescendo fino al
    // 150% — esattamente l'effetto segnalato. Si sottrae qui
    // rect.left/rect.top (lo STESSO rettangolo che
    // _posizionaContainerNelloSchermo userà un istante dopo per il
    // top/left di .container, vedi _rettangoloSchermoCornice) per
    // riportare l'origine relativa al box giusto.
    const x = (evt && evt.clientX ? evt.clientX : rect.left + rect.width / 2) - rect.left;
    const y = (evt && evt.clientY ? evt.clientY : rect.top + rect.height / 2) - rect.top;
    container.style.setProperty('--pokeball-x', x + 'px');
    container.style.setProperty('--pokeball-y', y + 'px');
}

async function apriDettaglioWidget(tabId, evt) {
    clearTimeout(_chiusuraDettaglioTimeout); // annulla un'eventuale chiusura ancora in corso (riapertura rapida)

    const container = document.querySelector('.container');
    if (tabId === 'dafare' || tabId === 'match' || tabId === 'condividi' || tabId === 'missioni' || tabId === 'valore' || tabId === 'wishlist' || tabId === 'location' || tabId === 'doppioni' || tabId === 'sealed' || tabId === 'set' || tabId === 'bustina') {
        // MAI switchTab() qui: quella funzione ha una whitelist fissa di 5
        // tab (navigation.ui.js r.199) ed è segnata nella memoria di
        // progetto come "deve restare stabile e intoccata" — un bug reale
        // c'è già stato lì in passato. Repliochiamo solo il minimo che
        // switchTab farebbe per una tab in whitelist (nascondi tutte le
        // view-section, mostra la mia), concordato con Claudio 2026-08-28
        // (dafare) e riusato identico per 'match', 'condividi', 'missioni'
        // e ora 'valore' (2026-08-30, pagina dedicata Valore collezione).
        document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
        document.getElementById(tabId)?.classList.add('active');
        if (tabId === 'dafare') renderPaginaDaFare();
        if (tabId === 'match') renderPaginaMatch();
        if (tabId === 'condividi') renderPaginaCondividi();
        if (tabId === 'missioni') renderPaginaMissioni();
        if (tabId === 'valore') renderPaginaValoreCollezione();
        if (tabId === 'wishlist') renderPaginaWishlist();
        if (tabId === 'location') renderPaginaLocation();
        if (tabId === 'doppioni') renderPaginaDoppioni();
        if (tabId === 'sealed') renderPaginaSealed();
        if (tabId === 'set') renderPaginaSet();
        if (tabId === 'bustina') renderPaginaBustina();
    } else {
        switchTab(tabId, null);
    }
    document.body.classList.add('phone-detail-open');

    // FIX (2026-08-30, "non c'è modo di tornare indietro"): #btnFisicoTelefono
    // vive dentro #phoneFrameBox → #phoneShell, e #phoneShell è un
    // CONTESTO DI STACKING a sé (position:fixed + z-index:10). Per una
    // regola del CSS, lo z-index di un discendente non può MAI farlo
    // emergere sopra un fratello di un ANTENATO che ha stacking context
    // proprio — l'intero sotto-albero di #phoneShell (bottone incluso)
    // resta sempre sotto .container (z-index:11), qualunque z-index dia
    // al bottone stesso. L'unico modo reale: spostarlo temporaneamente
    // fuori da quel sotto-albero, direttamente dentro <body>, mentre il
    // dettaglio è aperto — riportato al suo posto in chiudiDettaglioWidget
    // qui sotto, a fine animazione di chiusura.
    const _btnFisico = document.getElementById('btnFisicoTelefono');
    if (_btnFisico && _btnFisico.parentElement !== document.body) {
        document.body.appendChild(_btnFisico);
        _btnFisico.classList.add('a-schermo-intero');
    }

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
        // Simmetrico al reparent fatto in apriDettaglioWidget: il bottone
        // torna dentro #phoneFrameBox, ripristinando la posizione
        // percentuale calibrata sull'immagine cornice.
        const btnFisico = document.getElementById('btnFisicoTelefono');
        const frameBox = document.getElementById('phoneFrameBox');
        if (btnFisico && frameBox && btnFisico.parentElement !== frameBox) {
            frameBox.appendChild(btnFisico);
            btnFisico.classList.remove('a-schermo-intero');
        }
        renderWidgetHome();
    }, DURATA_ANIMAZIONE_DETTAGLIO_MS);
}

// ───────────────────────────────────────────────────────────────────────
// SEZIONE 5 — Resize cornice, cornice/sfondo personalizzabili, barra di
// stato (orologio/sync), beep, notifiche push, polling, navigazione fissa,
// tasto fisico, presenza live, avvio (initPhoneShell) (originariamente
// righe 6459-fine file di phone.ui.js).
// ───────────────────────────────────────────────────────────────────────

function _gestisciResizeCornice() {
    if (document.body.classList.contains('phone-detail-open')) {
        requestAnimationFrame(_posizionaContainerNelloSchermo);
    } else if (_layoutWidget) {
        // FIX (Claudio, 2026-09-10): senza questo ramo, un layout gia'
        // disegnato con una griglia larga (tante colonne) restava con
        // quelle classi CSS anche dopo una rotazione o un resize della
        // finestra che riduce le colonne reali — il clamp di
        // _tagliaEffettiva si applica solo DURANTE un render, quindi va
        // fatto scattare di nuovo quando cambia la geometria.
        // COSTO DA TENERE D'OCCHIO: renderWidgetHome() rifa' anche le
        // preview di ogni widget (query/RPC), quindi ogni resize/
        // rotazione ripete quelle chiamate (debounced a 100ms sopra, non
        // ad ogni frame). Se in pratica risultasse troppo traffico
        // durante un resize prolungato del browser desktop, va sostituito
        // con un ricalcolo "leggero" che tocca solo le classi CSS delle
        // tessere gia' in DOM senza rifare le query — non implementato
        // ora per tenere il cambiamento contenuto.
        renderWidgetHome();
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
// AGGIORNATA (2026-09-01, integrazione status bar): il vecchio puntino
// #phoneSyncDot è nascosto via CSS (vedi statusbar.css, blocco di
// integrazione) — questa funzione ora pilota lo stato "connessione" della
// nuova barra invece del puntino. Firma invariata, tutti i punti di
// chiamata esistenti nel file continuano a funzionare senza modifiche.
// Non è un mapping perfetto (CSBar distingue online/connecting/offline,
// qui abbiamo solo "sta sincronizzando ora / non sta sincronizzando"), ma
// è la stessa semplificazione già implicita nel vecchio puntino
// acceso/spento — nessuna informazione persa.
function _impostaSyncAttivo(attivo) {
    const dot = document.getElementById('phoneSyncDot'); // lasciato per rollback, nascosto via CSS
    if (dot) dot.classList.toggle('attivo', attivo);
    if (typeof CSBar !== 'undefined' && CSBar.getConnection) {
        CSBar.setConnection(attivo ? 'connecting' : 'online');
    }
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
            // Prima di questa sessione, aggiornaBadgeMatch() (queue.ui.js)
            // girava una sola volta al login (_avviaSitoDopoAccesso in
            // auth.ui.js) e mai più — i pallini restavano fermi per tutta
            // la sessione. Agganciata qui allo stesso ciclo di
            // caricaAvvisiHome() per il widget "Match trovati" (Claudio:
            // "la cosa più semplice e affidabile quando avremo anche più
            // utenti" — niente query extra sul ciclo veloce a 15s).
            await aggiornaBadgeMatch();
            await _controllaNotifichePush();
        } catch (e) { console.error('Errore polling avvisi (widget prezzi/inserimento/match):', e); }
        _impostaSyncAttivo(false);
        renderWidgetHome();
    }, INTERVALLO_WIDGET_LENTO_MS);
}

// ── LA HOME E' LA PAGINA A WIDGET ────────────────────────────────────────
// HOME FISSA ELIMINATA (Claudio, 2026-09-03). Prima esistevano due pagine
// sovrapposte, collegate da uno scatto verticale: #phoneHomePage (la
// "classica", che conteneva #home e scorreva all'infinito) e la pagina a
// widget. Ora c'e' solo la seconda, e le "pagine" sono quelle orizzontali
// stile telefono.
//
// _paginaAttivaTelefono resta e vale sempre 'widget': era letta da
// _aggiornaTastoFisico e da _aggiornaMatitaBarraGlobale, e toglierla
// avrebbe voluto dire riscrivere anche quelle. Lasciarla come costante
// costa nulla e mantiene leggibile il confronto con la versione
// precedente. Se un giorno non servira' piu' a nessuno, si toglie insieme
// alle sue due lettrici.
const _paginaAttivaTelefono = 'widget';

// _spostaHomeNellaPaginaPrincipale() e _gestisciScrollPagine() sono state
// RIMOSSE con la home fissa: la prima spostava #home dentro la pagina
// classica, la seconda leggeva quale delle due pagine fosse a schermo.
// Nessuna delle due ha piu' un oggetto su cui lavorare.

// "Torna alla home" ora vuol dire "torna alla PRIMA pagina di widget",
// che e' esattamente cio' che fa il tasto casetta su un telefono vero.
function _vaiAllaPaginaHome() {
    _vaiAllaPaginaWidget(0);
}

// Suoni/densita': prima comparivano solo sulla pagina widget e sparivano
// sulla home fissa. Senza piu' la home fissa sei SEMPRE sui widget, quindi
// restano sempre visibili — e la classe che li nascondeva va tolta una
// volta, altrimenti resterebbe appiccicata dall'ultimo giro prima
// dell'aggiornamento.
// btnModificaWidgetHome NON e' piu' in questo elenco (2026-09-10): si e'
// spostato nell'header della home (index.html) e non ha mai avuto la
// classe 'nascosto-in-home' li' — non serve piu' nessuna pulizia per lui.
function _aggiornaMatitaBarraGlobale() {
    ['btnSuoniWidgetHome', 'btnDensitaWidgetHome'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.classList.remove('nascosto-in-home');
    });
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
    } else if (_paginaWidgetCorrente > 0) {
        // Sei su una pagina diversa dalla prima: la casetta riporta li'.
        // Prima questo stato voleva dire "sei sui widget invece che sulla
        // home fissa"; ora che la home fissa non c'e' piu', il criterio
        // giusto e' la pagina orizzontale.
        btn.classList.remove('nascosto');
        if (icona) icona.className = 'fa-solid fa-house';
        btn.title = 'Prima pagina';
    } else {
        // Prima pagina, nessun dettaglio aperto: non c'e' nessun posto
        // dove tornare.
        btn.classList.add('nascosto');
    }
}

function _clickTastoFisico() {
    if (document.body.classList.contains('phone-detail-open')) {
        chiudiDettaglioWidget(); // "Indietro": torna ai widget, non salta alla Home
        return;
    }
    if (_paginaWidgetCorrente > 0) {
        _vaiAllaPaginaHome();
    }
    // Se sei già sulla prima pagina, non fa nulla.
}

// ── PRESENZA LIVE (2026-09-01, punto 4 status bar) ──────────────────────
// Supabase Realtime, prima volta usato nel progetto — solo Presence pura
// (channel().track()), effimera: nessuna tabella, nessuna RLS, nessuna
// migration, niente scritto su Postgres. Un canale unico condiviso da
// tutti e 5: chi ha il canale sottoscritto in questo momento risulta
// "collegato". DIFENSIVO: se il canale non si sottoscrive per qualunque
// motivo (Realtime disattivato sul progetto, rete, ecc.) non succede
// nulla di visibile all'utente — solo un avviso in console.
//
// SICUREZZA (corretto 2026-09-01, segnalato da Claudio): un canale
// Realtime come questo NON è protetto da RLS a meno che il progetto non
// abbia i "private channels" di Supabase configurati esplicitamente (non
// verificato in questa sessione, nessun accesso diretto al DB). Chiunque
// conosca il nome del canale — visibile a chiunque legga il codice
// sorgente del sito — potrebbe collegarsi e leggere cosa viene
// trasmesso, senza bisogno di essere autenticato come uno degli utenti
// reali. Per questo qui si traccia SOLO una chiave anonima (l'id utente,
// già necessario come chiave di presenza) e NESSUN dato identificativo
// (niente email, niente nome) — la barra mostra solo un conteggio, non
// ha mai bisogno di sapere CHI è online. Se in futuro servisse mostrare
// i nomi, va prima verificato/configurato un canale privato con
// autorizzazione RLS lato Supabase, non aggiunto qui alla leggera.
async function _avviaPresenzaLive() {
    if (typeof CSBar === 'undefined' || typeof supabaseClient === 'undefined') return;
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;
        const canale = supabaseClient.channel('presenza-cardsync', {
            config: { presence: { key: user.id } },
        });
        canale
            .on('presence', { event: 'sync' }, () => {
                const stato = canale.presenceState();
                CSBar.setPresence({ count: Object.keys(stato).length, label: 'persone stanno usando CardSync' });
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await canale.track({ online: true }); // nessun dato identificativo, vedi nota sopra
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.warn('[presenza] canale realtime non disponibile (status: ' + status + ') — controllare che Realtime sia attivo sul progetto Supabase.');
                }
            });
    } catch (e) { console.error('[presenza] errore avvio:', e); }
}

// ── AVVIO ─────────────────────────────────────────────────────────────
async function initPhoneShell() {
    // _spostaHomeNellaPaginaPrincipale() rimossa con la home fissa.

    await _caricaLayoutWidget();
    await renderWidgetHome();
    // _aggiornaOrologioStatusBar()/relativo setInterval RIMOSSI da qui
    // (2026-09-01): la nuova status bar (CSBar) ha un proprio orologio
    // interno. Funzione lasciata definita più sopra (dead code, per
    // rollback) — il vecchio elemento #phoneStatusOra è nascosto via CSS.

    const iconaSuoni = document.getElementById('iconaSuoniWidgetHome');
    if (iconaSuoni) iconaSuoni.className = prefSuoniWidgetGet() ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';

    // ── STATUS BAR (2026-09-01) ─────────────────────────────────────────
    // Prima integrazione: solo estetica/interazione base (orologio, stato
    // connessione, tendina, valuta) — niente notifiche automatiche,
    // presenza live, coda offline o PWA (rimandati, "fase 2" per esplicita
    // decisione di Claudio). Montata dentro #phoneScreen (non sul body:
    // resta nel mockup del telefono, non copre tutto il browser — vedi
    // opts.container in statusbar.js).
    if (typeof CSBar !== 'undefined') {
        CSBar.init({
            container: '#phoneScreen',
            persist: true,
            installPrompt: false,       // fuori scope in questa integrazione
            systemNotifications: false, // fuori scope in questa integrazione
            watchNetwork: true,

            // Notifiche di sistema (2026-09-01, 4 eventi confermati da
            // Claudio — "scambio da confermare" rimandato: non esiste
            // ancora come funzione nel progetto, richiede una feature a
            // sé, non solo un aggancio). 'text' di default sotto viene
            // sempre sovrascritto con quello reale al momento della
            // chiamata (vedi avvisa() nei punti di aggancio) — qui sono
            // solo fallback se mai chiamati senza 'extra'.
            // FIX (2026-09-01) sui 'target': erano '#traguardi' e '#scambio',
            // che NON esistono come id in index.html (le sezioni reali sono
            // 'missioni' e 'match'; "scambio" è un currentMode della tab
            // Visualizzazione, non una sezione). E anche '#wishlist', che
            // come id esiste, non sarebbe bastato: statusbar.js su un target
            // che inizia per '#' imposta location.hash, ma questa app non usa
            // il routing via hash (nessun listener hashchange) e le
            // view-section sono in display:none finché non attive — il clic
            // sulla notifica non apriva nulla. Ora i target puntano alle
            // sezioni vere e ci pensa onNotificationClick qui sotto ad
            // aprirle davvero.
            notificationTypes: {
                'missione-completata': {
                    icon: '\u2726', title: 'Missione completata', text: '',
                    target: '#missioni', group: 'missioni-oggi', groupLabel: 'missioni completate',
                },
                'traguardo-sbloccato': {
                    icon: '\u2b50', title: 'Traguardo sbloccato', text: '',
                    // I traguardi vivono nella stessa pagina delle missioni
                    // (#missioniListaTraguardi dentro la sezione 'missioni').
                    target: '#missioni', group: 'traguardi-oggi', groupLabel: 'traguardi sbloccati',
                    priority: 'high',
                },
                'match-trovato': {
                    icon: '\u21c4', title: 'Nuovo Match', text: '',
                    target: '#match', group: 'match-nuovi', groupLabel: 'nuovi Match',
                },
                'prezzo-obiettivo': {
                    icon: '\u2713', title: 'Prezzo obiettivo raggiunto', text: '',
                    target: '#wishlist', group: 'prezzo-obiettivo', groupLabel: 'obiettivi di prezzo raggiunti',
                    priority: 'high',
                },
            },

            // Apertura reale della sezione al clic sulla notifica. Se questo
            // gestore c'è, statusbar.js lo usa AL POSTO di location.hash
            // (vedi openNotification) — quindi il target torna ad essere solo
            // un'etichetta della destinazione, letta qui. apriDettaglioWidget
            // gestisce già 'missioni', 'match' e 'wishlist': sono tutte e tre
            // nell'elenco delle sezioni con pagina propria, nessun caso nuovo
            // da aggiungere lì.
            onNotificationClick: (n) => {
                if (!n || !n.target) return;
                const sezione = n.target.charAt(0) === '#' ? n.target.slice(1) : n.target;
                apriDettaglioWidget(sezione, null);
            },

            // Suoni/densità (2026-09-01): spostati dalla vecchia barra
            // (sempre nascosta ora) ai "quickActions" della tendina —
            // Claudio ha confermato l'approccio. Cambia la scopribilità
            // (prima visibili solo sulla pagina widget, ora sempre
            // raggiungibili dalla tendina): nota, non un difetto silenzioso.
            // 'active' letto dallo stato REALE del progetto al momento
            // dell'avvio, cosi CSBar parte sincronizzato — poi le due
            // funzioni restano allineate perché ogni tap passa sempre da
            // qui (onToggle chiama SEMPRE la funzione reale del progetto).
            // La voce 'modifica' (Personalizza widget) e' stata TOLTA da
            // qui il 2026-09-10: ridondante col bottone #btnModificaWidgetHome
            // ora fisso e visibile nell'header della home (index.html) —
            // due strade per la stessa azione avrebbero richiesto tenerle
            // sincronizzate (stato 'attivo'/testo) senza un vantaggio reale.
            // Voce diagnostica 'test2x2' (Claudio, 2026-09-10, screenshot:
            // "metti un tasto... così lo clicco e vedo quanto diventa
            // grande"): forza il PRIMO widget visibile a 2x2 per giudicare
            // a occhio la taglia minima standard, dal vivo, senza dover
            // trascinare a mano fino in fondo. Strumento usa-e-getta, non
            // pensato per restare per sempre — stesso spirito dei bottoni
            // diagnostici della bustina rimossi in un'altra sessione: se
            // non serve più basta togliere questa riga.
            quickActions: [
                { id: 'suoni', label: 'Suoni', glyph: '\u266a', active: prefSuoniWidgetGet(), onToggle: () => toggleSuoniWidgetHome() },
                { id: 'densita', label: 'Densità comoda', glyph: '\u25a6', active: _densitaCompatta, onToggle: () => toggleDensitaWidgetHome() },
                { id: 'test2x2', label: '2x2', glyph: '\u25a2', type: 'action', onToggle: () => _testForzaTaglia2x2() },
            ],

            onSettings: () => apriDettaglioWidget('impostazioni'),
            // Riusa il vero menu profilo (#profiloContainer, spostato qui
            // sotto), non ricostruito — chiama la stessa funzione che
            // apriva/chiudeva il menu dalla vecchia barra.
            onProfile: () => { if (typeof toggleMenuProfilo === 'function') toggleMenuProfilo(); },
        });

        // #profiloContainer (menu profilo completo: nome, email, cambio
        // username, logout) esiste già nell'HTML dentro la vecchia barra
        // (ora nascosta) — spostato qui via appendChild, stesso nodo DOM,
        // stessa logica interna intatta (il menu si posiziona da solo
        // rispetto al proprio contenitore, non rispetto alla pagina).
        // Il pulsante profilo "finto" di CSBar resta nascosto via CSS
        // (.csb-profile { display:none }) al suo posto.
        const profiloContainer = document.getElementById('profiloContainer');
        const csbRight = document.querySelector('#phoneScreen .csb-right');
        if (profiloContainer && csbRight) csbRight.appendChild(profiloContainer);

        _avviaPresenzaLive(); // fire-and-forget, vedi commento sulla funzione sopra

        // Valuta (2026-09-01): collegata al saldo reale di
        // inventario_ricompense. AGGIORNATO 2026-09-07: usa polvere_saldo()
        // (RPC, somma lato Postgres) invece di ricompenseSaldo(userId,
        // 'polvere') (data/missioni.repository.js, somma lato client —
        // tronca oltre ~1000 righe senza segnalarlo, vedi
        // data/bustina.repository.js per il dettaglio). 'polvere' resta il
        // tipo ricompensa reale usato in tutto il catalogo missioni/
        // traguardi, non inventato. Aggiornata di nuovo dopo ogni
        // valutazione missioni (vedi renderPaginaMissioni), dove vengono
        // davvero accreditate nuove ricompense.
        (async () => {
            try {
                const userId = await authGetUserId();
                if (!userId) return;
                const { data: saldo, error } = await polvereSaldoLeggi();
                if (!error) CSBar.setCurrency({ value: saldo || 0, glyph: '\u2727', label: 'Polvere' });
            } catch (e) { console.error('[statusbar] saldo polvere iniziale:', e); }
        })();
    }

    avviaPollingWidgetHome();

    // ── Grafica Poké Ball ───────────────────────────────────────────────
    // Il semaforo ha un ciclo suo (5,2s), separato dal polling dei dati:
    // muovere le ball non richiede di rileggere niente, usa le attenzioni
    // già calcolate dall'ultimo render.
    if (BALL_ATTIVA) {
        _ballApplicaClasseAnimazioni();
        // Non bloccante: la home si disegna subito con la libreria dal file
        // statico, e si aggiorna da sola se la tabella risponde.
        _ballCaricaLibreriaDaDb();
        _ballAvviaSemaforo();
        _ballOsservaTema();
        _ballSincronizzaToggleImpostazioni();
    }

    window.addEventListener('resize', _gestisciResizeCorniceDebounced);
    window.addEventListener('orientationchange', _gestisciResizeCornice);

    // Il listener di scroll verticale su #phonePagineWrap e' stato tolto
    // con la home fissa: quel contenitore non scorre piu'.
    const contPagineWidget = document.getElementById('phoneWidgetPagine');
    if (contPagineWidget) contPagineWidget.addEventListener('scroll', _gestisciScrollPaginePagineWidget, { passive: true });
    _aggiornaTastoFisico();
    _aggiornaMatitaBarraGlobale();

    // Animazione di "accensione" — una sola volta, al caricamento.
    const frameBox = document.getElementById('phoneFrameBox');
    if (frameBox) {
        frameBox.classList.add('phone-accensione');
        setTimeout(() => frameBox.classList.remove('phone-accensione'), 700);
    }
}
