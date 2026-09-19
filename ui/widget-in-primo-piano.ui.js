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
//      primo piano" (view-section #primopiano) con la top 10 di quella
//      categoria. Il click sul resto del tile resta quello di prima: apre
//      la carta di valore più alto nel flip-modal.
//
// COSA SIGNIFICA "OSCILLAZIONE" QUI (da non confondere): variazioneNumerica
// (ui/cards.ui.js) = prezzo − prezzo_precedente, cioè rispetto all'ULTIMO
// AGGIORNAMENTO DEL PREZZO di quella carta, in euro assoluti. NON è
// "dall'ultimo login": Claudio lo vuole (2026-09-19, "va fatta") ma serve
// un lavoro a parte (baseline dall'accesso precedente in activity_log +
// prezzo a quella data da storico_prezzi, verosimilmente con una RPC lato
// DB da verificare prima — Regola d'Oro #3). La pagina lo dichiara.
// I box non hanno oscillazione (nessun prezzo_precedente mappato in
// caricaProdottiSealedReali).
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
// mostra solo quante ne stanno) e quante ne mostra la pagina.
const PRIMO_PIANO_MAX_TILE = 16;
const PRIMO_PIANO_MAX_PAGINA = 10;

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
        varia: r.variazioneNumerica != null ? r.variazioneNumerica : null,
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
    const su = classifica(r => (r.variazioneNumerica != null && r.variazioneNumerica > 0) ? r.variazioneNumerica : null);
    const giu = classifica(r => (r.variazioneNumerica != null && r.variazioneNumerica < 0) ? -r.variazioneNumerica : null);

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
// Stesse classi pg-* delle altre pagine: nessun CSS nuovo per la pagina.
let _ppCategoriaPagina = 'valore';

const _PP_CATEGORIE_PAGINA = [
    { id: 'valore', etichetta: 'Valore', vuoto: 'Ancora nessuna carta in collezione.' },
    { id: 'su', etichetta: 'Oscillazione +', vuoto: 'Nessuna carta è salita di prezzo.' },
    { id: 'giu', etichetta: 'Oscillazione −', vuoto: 'Nessuna carta è scesa di prezzo.' },
    { id: 'box', etichetta: 'Box', vuoto: 'Nessun box in collezione.' },
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
            <div class="pg-elenco" id="primopianoElenco"></div>
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
            _ppRenderElencoPagina();
        } catch (e) { console.error('[primo piano] ricarico box:', e); }
    }
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
    if (!elenco) return;

    const def = _PP_CATEGORIE_PAGINA.find(c => c.id === _ppCategoriaPagina) || _PP_CATEGORIE_PAGINA[0];
    const voci = _ppCategorie(PRIMO_PIANO_MAX_PAGINA)[_PP_CAMPO_DATI[def.id]] || [];
    const oscillazione = def.id === 'su' || def.id === 'giu';

    if (nota) {
        // L'oscillazione NON è "dall'ultimo accesso": va detto, altrimenti
        // il numero si legge come una cosa che non è.
        nota.innerHTML = oscillazione
            ? '<p style="text-align:center; color:var(--text-muted); font-size:0.72rem; padding:0.6rem 0;">Variazione in euro rispetto all\'ultimo aggiornamento del prezzo di ciascuna carta.</p>'
            : '';
    }

    if (!voci.length) {
        elenco.innerHTML = `<p style="text-align:center; color:var(--text-muted); font-size:0.82rem; padding:1.2rem 0;">${def.vuoto}</p>`;
        return;
    }

    elenco.innerHTML = voci.map(v => {
        const src = (v.immagine && typeof _urlImmagineVisualizzabile === 'function') ? (_urlImmagineVisualizzabile(v.immagine, 96) || '') : '';
        const fig = src
            ? `<img class="pg-fig" src="${_ppEsc(src)}" alt="" onerror="this.style.display='none';">`
            : '<div class="pg-fig"></div>';
        const copie = v.copie > 1 ? `×${v.copie}` : '';
        let destra;
        if (oscillazione) {
            destra = `<b class="pp-var-testo ${v.varia > 0 ? 'pp-su' : 'pp-giu'}">${_ppFmtVar(v.varia)}</b>ora ${_ppEur(v.prezzo)}`;
        } else {
            destra = `<b>${_ppEur(v.prezzo)}</b>cad.`;
        }
        return `
            <div class="pg-riga" data-tocca data-id="${_ppEsc(v.id)}" data-tipo="${v.tipo}" data-cat="${def.id}" onclick="_ppClicMini(event, this)">
                ${fig}
                <div class="pg-testo"><b>${_ppEsc(v.nome)}</b><span>${copie}</span></div>
                <div class="pg-destra">${destra}</div>
            </div>`;
    }).join('');
}
