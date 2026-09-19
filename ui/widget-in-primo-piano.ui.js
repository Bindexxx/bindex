// ═══════════════════════════════════════════════════════════════════════
// WIDGET-IN-PRIMO-PIANO.UI.JS — tessera "In primo piano" (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP 10 della ristrutturazione file widget home (vedi
// Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md). Estratto da
// ui/phone.ui.js il 2026-09-11.
//
// id catalogo: 'primo_piano' (il titolo mostrato in home è "In primo
// piano", il file prende il nome da lì per coerenza con gli altri step).
//
// ── RISCRITTURA DEL 2026-09-19 (sessione widget "Primo Piano") ──────────
// Richieste di Claudio, tutte concordate prima di scrivere codice:
//   1. Il numero di carte mostrate NON è più fisso a 3 per categoria:
//      la carta ha una misura fissa (--pp-w in index.html) e il CSS ne
//      mostra quante ne stanno nello spazio reale del tile, senza
//      scrollare. Misura sempre il tile (quindi la cornice), mai la
//      finestra. Vedi il blocco "IN PRIMO PIANO" in index.html.
//   2. Categorie: Valore più alto / Oscillazione + / Oscillazione − e una
//      quarta, "Box di maggior valore" (prodottiSealedReali, dominio
//      SEPARATO dalle carte — vedi data/sealed.repository.js). Priorità di
//      taglio se lo spazio non basta: nell'ordine, l'ultima sparisce per
//      prima. Una categoria vuota non occupa spazio: lo cede alle altre.
//   3. Le carte con la stessa identità (nome+codice+lingua+condizione+
//      reverseHolo+firstEd, stessa chiave di Doppioni) sono UNA sola
//      miniatura con "×N" (N = copie totali, somma delle qty di tutte le
//      righe fisiche). Dopo lo split di Doppioni la stessa carta può
//      stare in più righe di 'carte': senza raggruppare comparirebbe più
//      volte nella stessa fila. La chiave è DUPLICATA qui, non condivisa
//      con widget-doppioni.ui.js (Regola d'Oro #1).
//   4. Badge sulla miniatura: nelle due categorie di oscillazione, la
//      variazione in euro (es. "+€3,20"). Carte e box di Scambio contano
//      già: lo Scambio è un tag su binder_carte, non uno stato, quindi
//      le righe sono comunque in carteReali.
//   5. Il titolo di ogni categoria è cliccabile e apre la pagina "In
//      primo piano" (view-section #primopiano) con TUTTE le voci di quella
//      categoria, in ordine, come griglia di tessere alla maniera di
//      Doppioni (stessa formula e stesso slider dei Binder, classi
//      dedicate pp-pag-* in index.html). Il click sul resto del tile
//      resta quello di prima: apre la carta di valore più alto nel
//      flip-modal.
//
// COSA SIGNIFICA "OSCILLAZIONE" QUI (aggiornato il 2026-09-19, sql/64):
// variazione in euro DALL'ULTIMA VISITA. La baseline la decide il DB
// (registra_visita: una nuova visita comincia dopo PRIMO_PIANO_PAUSA_
// VISITA_ORE di pausa, e un ricaricamento a breve distanza NON la sposta);
// il prezzo di ogni oggetto alla baseline arriva da leggi_variazioni_da()
// (data/visite.repository.js), che legge lo storico prezzi e restituisce
// solo gli oggetti cambiati. La variazione e' prezzo_ora - prezzo_base;
// un oggetto tornato al prezzo di partenza non oscilla.
// RIPIEGO (prima visita in assoluto, RPC assenti o in errore): la vecchia
// definizione, variazioneNumerica (ui/cards.ui.js) = prezzo -
// prezzo_precedente, cioe' rispetto all'ULTIMO AGGIORNAMENTO del prezzo di
// quella carta. La nota della pagina dice sempre quale delle due e' attiva,
// cosi' il sito funziona anche PRIMA di eseguire sql/64.
// I box non hanno oscillazione nel widget (categoria solo per valore).
//
// DOVE VIVE IL RESTO: il corpo grafico della tessera è _primoPianoCorpo()
// qui sotto, richiamato da _ballCORPI.primo_piano (ui/widget-render-
// corpi.ui.js, che ripiega sul vecchio corpo se questa funzione manca).
// _ballASPETTO.primo_piano / _ballTITOLI_BREVI.primo_piano
// (ui/widget-render-condiviso.ui.js) restano invariati. Il CSS è in
// index.html; la pagina è registrata in ui/paginainiziale-dettaglio.ui.js.
//
// LA MINIATURA È COSTRUITA QUI (_ppMini) e non con _ballMiniCarta, perché
// serve un click diverso per i box (apriFlipCardHome cerca solo in
// carteReali e su un box non farebbe nulla), i due badge e l'escape di
// nomi e id. _ballMiniCarta (condivisa) non è stata toccata.
// ───────────────────────────────────────────────────────────────────────

// Quante carte per categoria vengono preparate per il tile (il CSS ne
// mostra solo quante ne stanno). La pagina invece mostra TUTTE le voci
// della categoria, in ordine (nessun tetto).
const PRIMO_PIANO_MAX_TILE = 16;
// Ore di pausa che separano due "visite" (passate a registra_visita) e ogni
// quanto si rilegge il prezzo alla baseline durante la sessione, cosi' un
// controllo prezzi fatto mentre il sito e' aperto compare senza ricaricare.
const PRIMO_PIANO_PAUSA_VISITA_ORE = 4;
const PRIMO_PIANO_RINFRESCO_VARIAZIONI_MS = 60000;

// Origini registrate dalle missioni quando la carta si apre da qui (le
// stesse di prima della riscrittura, vedi ui/flip-card-detail.ui.js).
const _PP_ORIGINE = { valore: 'top_valore', su: 'oscillazione_su', giu: 'oscillazione_giu' };

// ── UTILITY LOCALI ────────────────────────────────────────────────────
// Escape completo, virgolette incluse: escapeHtml() (utils/formatters.js)
// passa da textContent/innerHTML e NON escapa le virgolette, quindi non è
// sicuro dentro un attributo.
function _ppEsc(v) {
    return String(v == null ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function _ppEur(v) {
    return '€ ' + Number(v || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Variazione per il badge: "+€3,20" / "−€12,40" (meno vero, come nel titolo
// "Oscillazione −"). Sopra i 100 € niente decimali: il badge sta su una
// miniatura da ~56px.
function _ppFmtVar(v) {
    const a = Math.abs(Number(v) || 0);
    const testo = a >= 100 ? String(Math.round(a)) : a.toFixed(2).replace('.', ',');
    return (v > 0 ? '+' : '−') + '€' + testo;
}

// Stessa chiave di _doppioniChiaveCarta / _doppioniChiaveBox
// (ui/widget-doppioni.ui.js), duplicata di proposito.
function _ppChiaveCarta(c) {
    return [c.name, c.code, c.lang, c.cond, !!c.reverseHolo, !!c.firstEd].join('||');
}
function _ppChiaveBox(p) {
    return [p.name, p.codice, p.setEspansione, p.lingua, p.integrita].join('||');
}

// ── BASELINE "ULTIMA VISITA" ──────────────────────────────────────────
// pronta: true = RPC risposta (anche con da=null alla prima visita);
// da: baseline (ISO) o null; mappa: 'carte:<id>' -> prezzo alla baseline,
// SOLO per gli oggetti cambiati da allora (gli altri non hanno variazione).
let _ppBaseline = { pronta: false, da: null, mappa: new Map() };
let _ppBaselineAvviata = false;
let _ppRinfrescoAttivo = false;

async function _ppRicaricaVariazioni() {
    if (!_ppBaseline.pronta || !_ppBaseline.da) return;
    const { data, error } = await variazioniPrezziDa(_ppBaseline.da);
    if (error) { console.error('[primo piano] rilettura variazioni:', error.message); return; }
    const mappa = new Map();
    (data || []).forEach(r => mappa.set(r.tabella + ':' + r.oggetto_id, Number(r.prezzo_base)));
    _ppBaseline = { pronta: true, da: _ppBaseline.da, mappa };
}

// Chiamata UNA volta per caricamento del sito, da _avviaSitoDopoAccesso()
// (ui/auth.ui.js), fire-and-forget: se sql/64 non e' ancora stata eseguita
// o qualcosa fallisce, il widget ripiega sulla vecchia definizione.
async function primoPianoCaricaBaseline() {
    if (_ppBaselineAvviata) return;
    _ppBaselineAvviata = true;
    try {
        const { data: da, error } = await visitaRegistra(PRIMO_PIANO_PAUSA_VISITA_ORE);
        if (error) throw error;
        _ppBaseline = { pronta: true, da: da || null, mappa: new Map() };
        await _ppRicaricaVariazioni();
        if (_ppBaseline.da && !_ppRinfrescoAttivo) {
            _ppRinfrescoAttivo = true;
            setInterval(() => { if (!document.hidden) _ppRicaricaVariazioni(); }, PRIMO_PIANO_RINFRESCO_VARIAZIONI_MS);
        }
    } catch (e) {
        console.error('[primo piano] baseline ultima visita:', e && e.message ? e.message : e);
        _ppBaseline = { pronta: false, da: null, mappa: new Map() };
        _ppBaselineAvviata = false; // permette un nuovo tentativo alla prossima chiamata
    } finally {
        // Stesse condizioni del polling della Home: mai ridisegnare sotto un
        // dettaglio aperto o in modifica; ci pensa il giro successivo.
        if (typeof renderWidgetHome === 'function' && !document.body.classList.contains('phone-detail-open') && !(typeof _editModeWidget !== 'undefined' && _editModeWidget)) {
            renderWidgetHome();
        }
    }
}

// Variazione in euro di una riga di carteReali: dall'ultima visita se c'e'
// una baseline, altrimenti (ripiego) dall'ultimo aggiornamento del prezzo.
function _ppVariazione(r) {
    if (!(_ppBaseline.pronta && _ppBaseline.da)) {
        return r.variazioneNumerica != null ? r.variazioneNumerica : null;
    }
    const base = _ppBaseline.mappa.get('carte:' + r.id);
    if (base == null) return null; // nessuna variazione registrata dalla baseline
    const d = (Number(r.price) || 0) - base;
    return Math.abs(d) < 0.005 ? null : d; // tornato al prezzo di partenza
}

// Testo sotto l'elenco delle due categorie di oscillazione.
function _ppNotaOscillazione() {
    if (_ppBaseline.pronta && _ppBaseline.da) {
        const quando = new Date(_ppBaseline.da).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        return `Variazione in euro rispetto all'ultima visita (${quando}).`;
    }
    const base = 'Variazione in euro rispetto all\'ultimo aggiornamento del prezzo di ciascuna carta.';
    return _ppBaseline.pronta ? base + ' Dalla prossima visita si confronta con l\'ultimo accesso.' : base;
}

// ── CALCOLO DELLE CATEGORIE ───────────────────────────────────────────
// Tutto da carteReali / prodottiSealedReali, già in memoria: ZERO query
// nuove, si può rivalutare a ogni giro di polling senza costo.
// Ogni gruppo di identità diventa UNA voce; la riga "rappresentante" (di
// cui si prendono id, prezzo e variazione) è quella col valore più alto
// per la categoria. 'copie' = somma delle qty di tutte le righe del gruppo.
function _ppCategorie(max) {
    const carte = (typeof carteReali !== 'undefined' ? carteReali : [])
        .filter(c => c.stato === 'collezione' && c.tipo !== 'sealed');

    const gruppi = new Map();
    carte.forEach(c => {
        const k = _ppChiaveCarta(c);
        let g = gruppi.get(k);
        if (!g) { g = { righe: [], copie: 0 }; gruppi.set(k, g); }
        g.righe.push(c);
        g.copie += Number(c.qty) || 1;
    });
    const lista = Array.from(gruppi.values());

    const voceCarta = (g, r) => ({
        id: r.id, nome: r.name || '—', prezzo: Number(r.price) || 0,
        varia: _ppVariazione(r),
        immagine: r.immagine || null, copie: g.copie, tipo: 'carta',
    });
    // Sceglie nel gruppo la riga con il valore più estremo secondo 'punteggio'
    // (null = riga esclusa) e restituisce { riga, punteggio } oppure null.
    const migliore = (g, punteggio) => {
        let best = null;
        g.righe.forEach(r => {
            const p = punteggio(r);
            if (p == null) return;
            if (!best || p > best.p) best = { r, p };
        });
        return best ? { g, r: best.r, p: best.p } : null;
    };
    const classifica = (punteggio) => lista
        .map(g => migliore(g, punteggio))
        .filter(Boolean)
        .sort((a, b) => b.p - a.p)
        .slice(0, max)
        .map(x => voceCarta(x.g, x.r));

    const perValore = classifica(r => Number(r.price) || 0);
    // Oscillazione +: variazione positiva più alta. Oscillazione −: la
    // negativa più profonda (punteggio invertito, così l'ordinamento è
    // sempre "dal più grande").
    const su = classifica(r => { const v = _ppVariazione(r); return (v != null && v > 0) ? v : null; });
    const giu = classifica(r => { const v = _ppVariazione(r); return (v != null && v < 0) ? -v : null; });

    // Box: dominio separato (prodottiSealedReali). Solo prezzo, nessuna
    // variazione disponibile.
    const sealed = typeof prodottiSealedReali !== 'undefined' ? prodottiSealedReali : [];
    const gruppiBox = new Map();
    sealed.forEach(p => {
        const k = _ppChiaveBox(p);
        let g = gruppiBox.get(k);
        if (!g) { g = { rappr: p, copie: 0 }; gruppiBox.set(k, g); }
        if ((Number(p.price) || 0) > (Number(g.rappr.price) || 0)) g.rappr = p;
        g.copie += Number(p.qty) || 1;
    });
    const box = Array.from(gruppiBox.values())
        .sort((a, b) => (Number(b.rappr.price) || 0) - (Number(a.rappr.price) || 0))
        .slice(0, max)
        .map(g => ({
            id: g.rappr.id, nome: g.rappr.name || '—', prezzo: Number(g.rappr.price) || 0,
            varia: null, immagine: g.rappr.immagine || null, copie: g.copie, tipo: 'box',
        }));

    return { perValore, su, giu, box };
}

// ── VOCE DI CATALOGO ──────────────────────────────────────────────────
CATALOGO_WIDGET.primo_piano = {
        titolo: 'In primo piano', icona: 'fa-crown',
        // Sotto questa taglia il corpo con le carte non ha spazio e il
        // widget non mostrerebbe cio' per cui esiste. Sopra, il CSS decide
        // da solo quante carte e quante categorie mostrare.
        tagliaDefault: '6x8',
        preview: () => {
            const cat = _ppCategorie(PRIMO_PIANO_MAX_TILE);
            const top = cat.perValore[0];
            if (!top) return { righe: ['Nessuna carta ancora'], dati: cat };
            const righe = [`${top.nome}`, `€ ${(Number(top.prezzo) || 0).toFixed(2)}`];
            if (cat.su[0]) righe.push(`↑ ${cat.su[0].nome}`);
            return {
                righe,
                // NIENTE 'immagine': con una foto la tessera perde la sfera
                // e mostra icona piatta + miniatura (vedi il ramo BALL_ATTIVA
                // in renderWidgetHome). Il risultato era che questo widget e
                // "Ultime aggiunte" venivano resi in due modi diversi a
                // seconda che la prima carta avesse o meno una foto — un
                // dettaglio che non c'entra niente con il widget. La sfera
                // resta sempre; la foto della carta si vede aprendola.
                badge: false,
                // dati = { perValore, su, giu, box }: ogni voce ha id, nome,
                // prezzo, varia, immagine, copie, tipo ('carta'|'box').
                dati: cat,
            };
        },
        // Stesso gesto della home fissa: la carta si apre nel flip-modal,
        // non cambia tab.
        azione: (dati) => {
            const primo = dati && dati.perValore && dati.perValore[0];
            if (primo && typeof apriFlipCardHome === 'function') apriFlipCardHome(primo.id);
        },
};

// ── CORPO DELLA TESSERA (richiamato da _ballCORPI.primo_piano) ────────
// Struttura: .pp-wrap contiene un .pp-gruppo per categoria NON vuota;
// ognuno ha un titolo cliccabile e una .pp-fila di miniature. Niente
// .ball-gruppi/.ball-strip di proposito: _potaContenutoFuoriTessera()
// (ui/paginainiziale-render.ui.js) e le regole .wf-largo di index.html
// non devono toccare questo corpo, che si adatta da solo via CSS.
function _primoPianoCorpo(d) {
    if (!d) return { inline: '', blocco: '' };
    const top = (d.perValore && d.perValore[0]) || null;
    // NIENTE ball-k-tit qui: renderWidgetHome stampa gia' il titolo del
    // widget accanto alla sfera, quindi si leggeva due volte (difetto visto
    // in uno screenshot di Claudio il 2026-09-03).
    const inline = top
        ? `<div class="ball-k-big ball-k-mono">${_ppEur(top.prezzo)}</div><span class="ball-k-lab">${_ppEsc(top.nome)}</span>`
        : '<div class="ball-k-mid">—</div><span class="ball-k-lab">nessuna carta ancora</span>';

    // Ordine = priorità: se lo spazio manca, l'ultima sparisce per prima.
    const categorie = [
        ['valore', 'Valore più alto', d.perValore],
        ['su', 'Oscillazione +', d.su],
        ['giu', 'Oscillazione −', d.giu],
        ['box', 'Box di maggior valore', d.box],
    ].filter(c => c[2] && c[2].length);

    if (!categorie.length) return { inline, blocco: '' };

    const html = categorie.map(([cat, titolo, voci]) =>
        `<div class="pp-gruppo" data-cat="${cat}">` +
            `<div class="pp-titolo" onclick="_ppApriPagina('${cat}', event)"><span>${titolo}</span><i class="fa-solid fa-chevron-right"></i></div>` +
            `<div class="pp-fila">${voci.map(v => _ppMini(v, cat)).join('')}</div>` +
        '</div>'
    ).join('');

    return { inline, blocco: `<div class="pp-wrap" data-n="${categorie.length}">${html}</div>` };
}

// Miniatura: stesso aspetto di _ballMiniCarta (classe .ball-mini, stesse
// due barre di ripiego sotto l'immagine), più: ×N in alto a sinistra se
// le copie sono più di una, variazione in basso a destra nelle due
// categorie di oscillazione.
function _ppMini(v, cat) {
    const nome = _ppEsc(v.nome);
    const tinta = (typeof _ballTintaDaNome === 'function') ? _ballTintaDaNome(v.nome) : 'hsl(260, 52%, 58%)';
    const url = (v.immagine && typeof _urlImmagineVisualizzabile === 'function') ? _urlImmagineVisualizzabile(v.immagine, 128) : null;
    // loading="lazy": le miniature nascoste dal CSS (categorie o carte che
    // non ci stanno) o su una pagina della Home non ancora visibile non
    // vengono scaricate.
    const img = url ? `<img src="${_ppEsc(url)}" alt="" loading="lazy" onerror="this.remove();">` : '';
    const copie = v.copie > 1 ? `<b class="pp-copie">×${v.copie}</b>` : '';
    const varia = ((cat === 'su' || cat === 'giu') && v.varia != null)
        ? `<b class="ball-mini-badge pp-var ${v.varia > 0 ? 'pp-su' : 'pp-giu'}">${_ppFmtVar(v.varia)}</b>`
        : '';
    return `<span class="ball-mini" style="background:linear-gradient(150deg, ${tinta}, rgba(0,0,0,.35))" title="${nome}" ` +
        `data-id="${_ppEsc(v.id)}" data-tipo="${v.tipo}" data-cat="${cat}" onclick="_ppClicMini(event, this)">` +
        `<i></i><u></u>${img}${copie}${varia}</span>`;
}

// Click su una miniatura (tile o pagina): carta → flip-modal; box → la
// stessa modale di modifica che apre la pagina Sealed.
function _ppClicMini(evt, el) {
    if (evt) evt.stopPropagation();
    if (typeof _editModeWidget !== 'undefined' && _editModeWidget) return;
    if (typeof _vibraSeSupportato === 'function') _vibraSeSupportato(8);
    const id = el.dataset.id;
    if (el.dataset.tipo === 'box') {
        if (typeof apriModificaSealed === 'function') apriModificaSealed(id);
        return;
    }
    const origine = _PP_ORIGINE[el.dataset.cat];
    if (typeof apriFlipCardHome === 'function') apriFlipCardHome(id, origine ? { origine } : {});
}

// Click sul titolo di una categoria: apre la pagina sulla categoria toccata.
function _ppApriPagina(cat, evt) {
    if (evt) evt.stopPropagation();
    if (typeof _editModeWidget !== 'undefined' && _editModeWidget) return;
    if (typeof _vibraSeSupportato === 'function') _vibraSeSupportato(8);
    _ppCategoriaPagina = cat;
    if (typeof apriDettaglioWidget === 'function') apriDettaglioWidget('primopiano', evt);
}

// ── PAGINA "IN PRIMO PIANO" (view-section #primopiano) ────────────────
// Registrata in ui/paginainiziale-dettaglio.ui.js (whitelist + dispatch).
// Testata e pillole con le classi pg-* delle altre pagine; l'elenco e' una
// griglia di tessere come quella di Doppioni (classi pp-pag-* in index.html).
let _ppCategoriaPagina = 'valore';

const _PP_CATEGORIE_PAGINA = [
    { id: 'valore', etichetta: 'Valore', ordine: 'ordinate per valore', unita: ['carta', 'carte'], vuoto: 'Ancora nessuna carta in collezione.' },
    { id: 'su', etichetta: 'Oscillazione +', ordine: 'ordinate per aumento maggiore', unita: ['carta', 'carte'], vuoto: 'Nessuna carta è salita di prezzo.' },
    { id: 'giu', etichetta: 'Oscillazione −', ordine: 'ordinate per calo maggiore', unita: ['carta', 'carte'], vuoto: 'Nessuna carta è scesa di prezzo.' },
    { id: 'box', etichetta: 'Box', ordine: 'ordinati per valore', unita: ['box', 'box'], vuoto: 'Nessun box in collezione.' },
];
const _PP_CAMPO_DATI = { valore: 'perValore', su: 'su', giu: 'giu', box: 'box' };

async function renderPaginaPrimoPiano() {
    const container = document.getElementById('primopianoContenuto');
    if (!container) return;

    const filtri = _PP_CATEGORIE_PAGINA.map(c =>
        `<span class="pg-filtro${c.id === _ppCategoriaPagina ? ' attivo' : ''}" data-cat="${c.id}" onclick="_ppImpostaCategoriaPagina('${c.id}')">${c.etichetta}</span>`
    ).join('');
    container.innerHTML = `
        <div class="page-header">
            <span class="page-title">In primo piano</span>
        </div>
        <div class="pg-pagina">
            <div class="pg-filtri">${filtri}</div>
            <div class="pp-pag-conteggio" id="primopianoConteggio"></div>
            <div class="pp-pag-griglia" id="primopianoElenco"></div>
            <div id="primopianoNota"></div>
        </div>
    `;
    _ppRenderElencoPagina();

    // Come la pagina Sealed: l'inserimento dei box scrive direttamente in
    // prodotti_sealed senza aggiornare prodottiSealedReali, quindi si
    // ricarica all'apertura. Non blocca la pagina se fallisce.
    if (typeof caricaProdottiSealedReali === 'function') {
        try {
            await caricaProdottiSealedReali();
        } catch (e) { console.error('[primo piano] ricarico box:', e); }
    }
    // E il prezzo alla baseline, cosi' la pagina e' aggiornata anche se il
    // giro di rinfresco non e' ancora passato.
    try { await _ppRicaricaVariazioni(); } catch (e) { console.error('[primo piano] rileggo variazioni:', e); }
    _ppRenderElencoPagina();
}

function _ppImpostaCategoriaPagina(cat) {
    _ppCategoriaPagina = cat;
    document.querySelectorAll('#primopianoContenuto .pg-filtro').forEach(el => {
        el.classList.toggle('attivo', el.dataset.cat === cat);
    });
    _ppRenderElencoPagina();
}

function _ppRenderElencoPagina() {
    const elenco = document.getElementById('primopianoElenco');
    const nota = document.getElementById('primopianoNota');
    const conteggio = document.getElementById('primopianoConteggio');
    if (!elenco) return;

    const def = _PP_CATEGORIE_PAGINA.find(c => c.id === _ppCategoriaPagina) || _PP_CATEGORIE_PAGINA[0];
    // TUTTE le voci della categoria, gia' in ordine (nessun tetto).
    const voci = _ppCategorie(Infinity)[_PP_CAMPO_DATI[def.id]] || [];
    const oscillazione = def.id === 'su' || def.id === 'giu';

    if (nota) {
        // Dice sempre quale definizione di oscillazione è attiva (ultima
        // visita oppure ripiego sull'ultimo aggiornamento del prezzo).
        nota.innerHTML = oscillazione
            ? `<p style="text-align:center; color:var(--text-muted); font-size:0.72rem; padding:0.6rem 0;">${_ppEsc(_ppNotaOscillazione())}</p>`
            : '';
    }
    if (conteggio) {
        conteggio.textContent = voci.length ? `${voci.length} ${def.unita[voci.length === 1 ? 0 : 1]} · ${def.ordine}` : '';
    }

    if (!voci.length) {
        elenco.innerHTML = `<p style="text-align:center; color:var(--text-muted); font-size:0.82rem; padding:1.2rem 0; grid-column:1/-1;">${def.vuoto}</p>`;
        return;
    }

    // Tessera alla maniera di Doppioni: copertina, moltiplicatore in alto a
    // destra (solo se le copie sono piu' di una), nome, valori. Il click e'
    // lo stesso delle miniature del widget: carta -> flip, box -> modifica.
    elenco.innerHTML = voci.map(v => {
        const src = (v.immagine && typeof _urlImmagineVisualizzabile === 'function') ? (_urlImmagineVisualizzabile(v.immagine, 200) || '') : '';
        // loading="lazy": la categoria Valore puo' avere centinaia di tessere.
        const fig = src
            ? `<img class="pp-pag-cover" src="${_ppEsc(src)}" alt="" loading="lazy" onerror="this.style.display='none';">`
            : `<div class="pp-pag-cover pp-pag-cover-vuota"><i class="fa-solid ${v.tipo === 'box' ? 'fa-box-archive' : 'fa-image'}"></i></div>`;
        const copie = v.copie > 1 ? `<div class="pp-pag-copie">×${v.copie}</div>` : '';
        const valori = oscillazione
            ? `<b class="pp-var-testo ${v.varia > 0 ? 'pp-su' : 'pp-giu'}">${_ppFmtVar(v.varia)}</b><span>ora ${_ppEur(v.prezzo)}</span>`
            : `<b>${_ppEur(v.prezzo)}</b><span>cad.</span>`;
        return `
            <div class="pp-pag-tile" data-id="${_ppEsc(v.id)}" data-tipo="${v.tipo}" data-cat="${def.id}" onclick="_ppClicMini(event, this)">
                ${fig}
                ${copie}
                <div class="pp-pag-nome">${_ppEsc(v.nome)}</div>
                <div class="pp-pag-valori">${valori}</div>
            </div>`;
    }).join('');
}
