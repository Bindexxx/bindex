// ═══════════════════════════════════════════════════════════════════════
// PAGINAINIZIALE-PAGINAZIONE.UI.JS — pagine multiple della home (CardSync
// Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP 3 del piano di taglio di ui/paginainiziale.ui.js (concordato con
// Claudio il 2026-09-11). Estratto da ui/paginainiziale.ui.js. NESSUNA
// riscrittura del codice esistente: solo spostamento, zero cambi di
// comportamento per l'utente finale.
//
// Contiene: _paginaWidgetCorrente, _misuraPaginaWidget, _tagliaEffettiva,
// _distribuisciWidgetInPagine, _paginePresenti, _numeroPagineWidget,
// _compattaPagineWidget, _spostaWidgetInPagina/NellaPagina,
// _vaiAllaPaginaWidget(Relativa), _gestisciScrollPaginePagineWidget,
// _aggiornaPuntiniPagine.
//
// NOTA IMPORTANTE: _tagliaEffettiva è qui (calcola lo span VISTO di un
// widget clampato alla griglia reale misurata) pur usando _leggiTaglia e
// le costanti di griglia rimaste in ui/paginainiziale.ui.js — è il fix
// del "widget che spariscono se ridimensionati oltre lo schermo" (vedi
// compilato 2026-09-11 redesign). Nessuna riscrittura, resta identico.
//
// Dipende da (rimasti in ui/paginainiziale.ui.js): _layoutWidget,
// _leggiTaglia, COLONNE_GRIGLIA_WIDGET e le altre costanti di griglia.
// Nessuna istruzione qui gira a tempo di caricamento script — l'ordine
// rispetto agli altri file paginainiziale-*.ui.js è indifferente (vedi
// nota identica negli STEP precedenti).
// ───────────────────────────────────────────────────────────────────────

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

