// ═══════════════════════════════════════════════════════════════════════
// SCAFFALI.UI.JS — pagina "Scaffali" (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// Fase 1.3, Step 5a (2026-09-12): gestione privata BASE. Ispirato a
// ui/binder.ui.js ma più semplice di proposito — niente tipo='location'
// auto-materializzato (Scaffali non ha un equivalente, sostituisce
// location per i sealed, non la rispecchia), niente flipbook (Claudio:
// "il flipbook non serve, faremo una visualizzazione a scaffali vera e
// propria" — quella è un pezzo futuro a sé, questo file resta valido sotto
// di essa). Griglia statica: click su un prodotto nella vista scaffale
// per rimuoverlo, modale dedicata per aggiungerne.
//
// NON QUI (voluta, vedi piano 5a/5b/5c concordato con Claudio):
//  - Copertina/sleeve personalizzabili (5b, come binder-design/binder-sleeve).
//  - Link pubblico + pagina scaffali-pubblico.html dedicata (5c).
//  - Visualizzazione "a scaffali vera e propria" (pezzo a sé, dopo 5b/5c).
//
// Punto di ingresso: widget Home dedicato (come Binders), MAI switchTab()
// — 'scaffali' non è nella whitelist fissa delle 5 tab (intoccabile per
// memoria di progetto), segue lo stesso schema di sealed/wishlist/location/
// doppioni/set/bustina in apriDettaglioWidget() (mostra/nasconde
// .view-section a mano). Vedi ui/paginainiziale-dettaglio.ui.js e
// ui/widget-scaffali.ui.js (voce di catalogo + preview).
//
// Dipende da: data/scaffali.repository.js, data/sealed.repository.js
// (sealedListMie, per la modale "aggiungi prodotti"), data/
// moderation.repository.js (creaRichiestaPendente, per la rinomina —
// SEMPRE moderata, stessa scelta dei Binder oggi, coerenza col precedente),
// ui/auth.ui.js (authGetUserId), utils condivisi (escapeHtml).
// ───────────────────────────────────────────────────────────────────────

let _scaffaliElenco = [];
let _scaffaleAttivo = null;
let _scaffaleAttivoProdottiIds = []; // prodotto_id assegnati allo scaffale aperto
let _prodottiSealedCache = []; // tutti i prodotti sealed dell'utente, per la griglia+modale

// Fase 3, Step 3 (2026-09-12) — Scaffale Scambio, mirror di
// _binderScambioId/_quantitaOfferteScambio in state/binder.state.js. Qui
// non in un file state/ a sé (coerente con come il resto dello stato di
// questa pagina è già dichiarato direttamente in cima al file, non in
// state/scaffali.state.js — mai creato in questa sessione).
let _scaffaleScambioId = null;
let _quantitaOfferteScambioSealed = {}; // prodottoId -> quantita_offerta


// ── Ingresso dal widget "Scaffali" ───────────────────────────────────────
async function apriPaginaScaffali() {
    const userId = await authGetUserId();
    if (!userId) return;

    // Fase 1.3, Step 5c (2026-09-12): 'scaffali' non passa da switchTab()
    // (whitelist fissa di 5 tab, vedi header) quindi currentMode non viene
    // mai impostato automaticamente — lo faccio qui a mano, serve al
    // dispatcher di condivisione (_linkPubblicoCondivisione in
    // ui/navigation-condivisione.ui.js) per sapere che il link da generare
    // è quello di uno scaffale, non di un binder/scambio/wishlist.
    currentMode = 'scaffali';

    const [{ error: errVetrina }, { data: scambio, error: errScambio }] = await Promise.all([
        scaffaleGarantisciVetrina(userId),
        scaffaleScambioGarantisci(userId),
    ]);
    if (errVetrina) console.error('apriPaginaScaffali (vetrina):', errVetrina.message);
    if (errScambio) console.error('apriPaginaScaffali (scambio):', errScambio.message);
    else if (scambio) _scaffaleScambioId = scambio.id;

    const [{ data: scaffali, error: errList }, { data: prodotti, error: errProd }] = await Promise.all([
        scaffaliList(userId),
        sealedListMie(userId),
    ]);
    if (errList) { console.error('apriPaginaScaffali:', errList.message); return; }
    if (errProd) console.error('apriPaginaScaffali (prodotti):', errProd.message);

    _scaffaliElenco = scaffali || [];
    _prodottiSealedCache = prodotti || [];
    _scaffaleAttivo = null;

    // Fase 3, Step 3: precarica quantità offerte, servono al bottone "Offri
    // in Scambio" nella modale modifica sealed (ui/widget-sealed.ui.js) —
    // deve sapere se una carta è già offerta E con quale quantità PRIMA che
    // l'utente apra lo Scaffale Scambio (che potrebbe non aprire mai).
    if (_scaffaleScambioId) {
        const { data: righeScambio, error: errRigheScambio } = await scaffaleProdottiQueryConQuantita(userId, _scaffaleScambioId);
        if (errRigheScambio) console.error('apriPaginaScaffali (quantità scambio):', errRigheScambio.message);
        _quantitaOfferteScambioSealed = {};
        (righeScambio || []).forEach(r => { _quantitaOfferteScambioSealed[String(r.prodotto_id)] = r.quantita_offerta; });
    }

    await renderGrigliaScaffali();
}


// ── Elenco degli scaffali ────────────────────────────────────────────────
// RESTYLE BINDEX FASE 3f (2026-10-01, tavole "Scaffali"): una riga per
// scaffale (icona, nome, "N prodotti · valore · stato", freccia), riepilogo
// con quanti prodotti sono senza scaffale. Nessuna query nuova oltre alle
// associazioni già lette (scaffaleProdottiTuttiUtente).
function _scaValoreProdotto(p, qtaOverride) {
    const q = qtaOverride != null ? Number(qtaOverride) : (Number(p.qty) || 1);
    return (Number(p.prezzo) || 0) * q;
}
function _scaStatoEtichetta(s) {
    if (s.tipo === 'scambio') return 'sempre pubblico';
    return s.stato_pubblicazione === 'pubblico' ? 'pubblico' : 'privato';
}
function _scaNomeScaffale(s) {
    return s.nome || (s.tipo === 'vetrina' ? 'Vetrina' : (s.tipo === 'scambio' ? 'Scambio' : '(senza nome)'));
}

async function renderGrigliaScaffali() {
    const userId = await authGetUserId();
    const griglia = document.getElementById('scaffaliContenitoriGrid');
    if (!griglia) { console.error('renderGrigliaScaffali: manca #scaffaliContenitoriGrid in index.html'); return; }

    const { data: assoc, error } = await scaffaleProdottiTuttiUtente(userId);
    if (error) console.error('renderGrigliaScaffali (associazioni):', error.message);
    const perScaffale = {};
    const inQualcheScaffale = new Set();
    (assoc || []).forEach(r => {
        (perScaffale[r.scaffale_id] = perScaffale[r.scaffale_id] || []).push(r);
        inQualcheScaffale.add(String(r.prodotto_id));
    });
    const senzaScaffale = _prodottiSealedCache.filter(p => !inQualcheScaffale.has(String(p.id))).length;

    const riep = document.getElementById('scaffaliRiepilogo');
    if (riep) {
        const n = _scaffaliElenco.length;
        riep.innerHTML = `<b>${n} scaffal${n === 1 ? 'e' : 'i'}</b>` +
            (senzaScaffale ? ` &middot; <span class="sc-senza">${senzaScaffale} prodott${senzaScaffale === 1 ? 'o' : 'i'} senza scaffale</span>` : '');
    }

    if (_scaffaliElenco.length === 0) {
        griglia.innerHTML = '<div class="stato-vuoto"><i class="fa-solid fa-box-archive"></i><br>Nessuno scaffale ancora — creane uno per organizzare i tuoi prodotti sealed.</div>';
        return;
    }

    const mappaProdotti = {};
    _prodottiSealedCache.forEach(p => { mappaProdotti[String(p.id)] = p; });

    griglia.innerHTML = _scaffaliElenco.map(s => {
        const idAttr = escapeJsAttr(String(s.id));
        const righe = perScaffale[s.id] || [];
        const eScambio = s.tipo === 'scambio';
        const fisso = eScambio || s.tipo === 'vetrina';
        let valore = 0;
        righe.forEach(r => { const p = mappaProdotti[String(r.prodotto_id)]; if (p) valore += _scaValoreProdotto(p, eScambio ? r.quantita_offerta : null); });
        const n = righe.length;
        const icona = s.tipo === 'vetrina' ? 'fa-star' : (eScambio ? 'fa-right-left' : 'fa-box-archive');
        const conta = eScambio
            ? `${n} prodott${n === 1 ? 'o offerto' : 'i offerti'}`
            : `${n} prodott${n === 1 ? 'o' : 'i'}`;
        const parti = [conta];
        if (valore > 0) parti.push(formattaEuro(valore));
        parti.push(_scaStatoEtichetta(s));
        return `
            <div class="sc-riga" onclick="apriScaffaleDettaglio('${idAttr}')">
                <div class="sc-riga-icona"><i class="fa-solid ${icona}"></i></div>
                <div class="sc-riga-testo">
                    <b>${escapeHtml(_scaNomeScaffale(s))}${fisso ? ' <i class="fa-solid fa-lock sc-lucchetto" title="Scaffale fisso"></i>' : ''}</b>
                    <span>${parti.join(' · ')}</span>
                </div>
                <i class="fa-solid fa-chevron-right sc-freccia"></i>
            </div>`;
    }).join('');
}


async function creaNuovoScaffale() {
    const userId = await authGetUserId();
    if (!userId) return;

    const nome = (prompt('Nome del nuovo scaffale:') || '').trim();
    if (!nome) return;

    const { error } = await scaffaleInsert(userId, nome);
    if (error) { alert('Errore nella creazione: ' + error.message); return; }

    const { data: scaffali, error: errList } = await scaffaliList(userId);
    if (!errList) _scaffaliElenco = scaffali || [];
    await renderGrigliaScaffali();
}


// ── Vista di dettaglio ───────────────────────────────────────────────────
// RESTYLE FASE 3f: ripiano con i prodotti; "Modifica" mostra × e le frecce
// per riordinare; il clic sul prodotto apre i DETTAGLI (prima lo toglieva
// dallo scaffale). Ordini: "Come li metto io" (colonna scaffale_prodotti.
// ordine), Nome, Tipo, Valore.
let _scaEdit = false;
let _scaOrd = 'mio';
let _scaRighe = []; // [{ prodotto_id, ordine, aggiunta_il }] dello scaffale aperto

async function apriScaffaleDettaglio(scaffaleId) {
    _scaffaleAttivo = scaffaleId;
    _scaEdit = false;
    _scaOrd = 'mio';

    const elenco = document.getElementById('scaffaliElencoVista');
    if (elenco) elenco.style.display = 'none';
    const wrapDettaglio = document.getElementById('scaffaleDettaglioWrap');
    if (wrapDettaglio) wrapDettaglio.style.display = 'block';

    const scaffale = _scaffaliElenco.find(s => String(s.id) === String(scaffaleId));
    if (!scaffale) return;
    const eScambio = scaffale.tipo === 'scambio';

    const titoloEl = document.getElementById('scaffaleDettaglioTitolo');
    if (titoloEl) titoloEl.textContent = _scaNomeScaffale(scaffale);

    // Vetrina e Scambio non si eliminano né si rinominano (fissi); Scambio è
    // SEMPRE pubblico (forzato in scaffaleScambioGarantisci), nessun interruttore.
    const fisso = scaffale.tipo === 'vetrina' || eScambio;
    const btnElimina = document.getElementById('btnEliminaScaffaleAttivo');
    if (btnElimina) btnElimina.style.display = fisso ? 'none' : '';
    const btnRinomina = document.getElementById('btnRinominaScaffaleAttivo');
    if (btnRinomina) btnRinomina.style.display = fisso ? 'none' : '';

    const rigaPubblicazione = document.getElementById('scaffalePubblicazioneRiga');
    if (rigaPubblicazione) rigaPubblicazione.style.display = eScambio ? 'none' : '';
    const checkboxPub = document.getElementById('scaffalePubblicazioneCheckbox');
    if (checkboxPub) checkboxPub.checked = eScambio || scaffale.stato_pubblicazione === 'pubblico';
    _aggiornaCondivisioneScaffaleWrap(scaffale);

    // "Aggiungi o togli prodotti" non si applica a Scambio (serve una
    // QUANTITÀ: si offre dalla scheda del prodotto, "Offri in Scambio").
    const btnAssegna = document.getElementById('btnApriModaleAssegnaProdotti');
    if (btnAssegna) btnAssegna.style.display = eScambio ? 'none' : '';
    const notaScambio = document.getElementById('scaffaleScambioNota');
    if (notaScambio) notaScambio.style.display = eScambio ? '' : 'none';

    await _caricaProdottiScaffaleAttivo(scaffale);
    _scaAggiornaTesta();
    renderScaffaleContenuto();
}

function _scaAggiornaTesta() {
    const scaffale = _scaffaliElenco.find(s => String(s.id) === String(_scaffaleAttivo));
    if (!scaffale) return;
    const eScambio = scaffale.tipo === 'scambio';
    const prodotti = _prodottiSealedCache.filter(p => _scaffaleAttivoProdottiIds.includes(p.id));
    let valore = 0;
    prodotti.forEach(p => { valore += _scaValoreProdotto(p, eScambio ? (_quantitaOfferteScambioSealed[String(p.id)] ?? 0) : null); });
    const n = prodotti.length;
    const parti = [`${n} prodott${n === 1 ? 'o' : 'i'}`];
    if (valore > 0) parti.push(formattaEuro(valore));
    parti.push(_scaStatoEtichetta(scaffale));
    const sotto = document.getElementById('scaffaleDettaglioSotto');
    if (sotto) sotto.textContent = parti.join(' · ');

    const btnModifica = document.getElementById('btnScaffaleModifica');
    if (btnModifica) {
        btnModifica.textContent = _scaEdit ? 'Fatto' : 'Modifica';
        btnModifica.classList.toggle('sc-btn-pieno', _scaEdit);
    }
    const banner = document.getElementById('scaffaleModificaBanner');
    if (banner) {
        banner.style.display = _scaEdit ? '' : 'none';
        banner.innerHTML = _scaOrd === 'mio' && !eScambio
            ? '<i class="fa-solid fa-pen"></i> Modifica · usa le frecce per riordinare, × per togliere'
            : '<i class="fa-solid fa-pen"></i> Modifica · × per togliere' + (eScambio ? '' : ' (per riordinare scegli "Come li metto io")');
    }
    const azioni = document.getElementById('scaffaleAzioniModifica');
    if (azioni) azioni.style.display = _scaEdit ? 'flex' : 'none';

    document.querySelectorAll('#scaffaleOrdineChips .pg-filtro').forEach(c => {
        c.classList.toggle('attivo', c.dataset.ord === _scaOrd);
    });
    const chipMio = document.querySelector('#scaffaleOrdineChips .pg-filtro[data-ord="mio"]');
    if (chipMio) chipMio.style.display = eScambio ? 'none' : '';
    if (eScambio && _scaOrd === 'mio') _scaOrd = 'nome';
}

function scaffaleToggleModifica() {
    _scaEdit = !_scaEdit;
    _scaAggiornaTesta();
    renderScaffaleContenuto();
}

function scaffaleImpostaOrdinamento(o) {
    _scaOrd = o;
    _scaAggiornaTesta();
    renderScaffaleContenuto();
}


// Mostra/nasconde il blocco "Condividi" — solo quando lo scaffale è pubblico.
function _aggiornaCondivisioneScaffaleWrap(scaffale) {
    const wrap = document.getElementById('scaffaleCondivisioneWrap');
    if (wrap) wrap.style.display = (scaffale.stato_pubblicazione === 'pubblico' || scaffale.tipo === 'scambio') ? 'flex' : 'none';
}


function tornaAllaGrigliaScaffali() {
    _scaffaleAttivo = null;
    _scaEdit = false;
    const wrapDettaglio = document.getElementById('scaffaleDettaglioWrap');
    if (wrapDettaglio) wrapDettaglio.style.display = 'none';
    const elenco = document.getElementById('scaffaliElencoVista');
    if (elenco) elenco.style.display = '';
    renderGrigliaScaffali(); // conteggi e valori aggiornati dopo le modifiche
}


async function _caricaProdottiScaffaleAttivo(scaffale) {
    const userId = await authGetUserId();
    const eScambio = scaffale.tipo === 'scambio';
    const { data, error } = eScambio
        ? await scaffaleProdottiQueryConQuantita(userId, scaffale.id)
        : await scaffaleProdottiList(userId, scaffale.id);
    if (error) { console.error('_caricaProdottiScaffaleAttivo:', error.message); _scaffaleAttivoProdottiIds = []; _scaRighe = []; return; }
    if (eScambio) {
        _quantitaOfferteScambioSealed = {};
        (data || []).forEach(r => { _quantitaOfferteScambioSealed[String(r.prodotto_id)] = r.quantita_offerta; });
    }
    _scaRighe = data || [];
    _scaffaleAttivoProdottiIds = (data || []).map(r => r.prodotto_id);
}

// Prodotti dello scaffale aperto nell'ordine scelto.
function _scaProdottiOrdinati() {
    const scaffale = _scaffaliElenco.find(s => String(s.id) === String(_scaffaleAttivo));
    const eScambio = scaffale && scaffale.tipo === 'scambio';
    const mappa = {};
    _prodottiSealedCache.forEach(p => { mappa[String(p.id)] = p; });
    let elenco = _scaRighe.map((r, i) => ({ r, p: mappa[String(r.prodotto_id)], i })).filter(x => x.p);
    const nome = (x) => String(x.p.nome || x.p.codice || '');
    if (_scaOrd === 'nome') elenco.sort((a, b) => nome(a).localeCompare(nome(b)));
    else if (_scaOrd === 'tipo') elenco.sort((a, b) => String(a.p.codice || '').localeCompare(String(b.p.codice || '')) || nome(a).localeCompare(nome(b)));
    else if (_scaOrd === 'valore') elenco.sort((a, b) => _scaValoreProdotto(b.p, eScambio ? b.r.quantita_offerta : null) - _scaValoreProdotto(a.p, eScambio ? a.r.quantita_offerta : null));
    else elenco.sort((a, b) => {
        const oa = a.r.ordine == null ? Infinity : a.r.ordine, ob = b.r.ordine == null ? Infinity : b.r.ordine;
        if (oa !== ob) return oa < ob ? -1 : 1;
        return String(a.r.aggiunta_il || '').localeCompare(String(b.r.aggiunta_il || '')) || a.i - b.i;
    });
    return elenco;
}

function renderScaffaleContenuto() {
    const wrap = document.getElementById('scaffaleContenutoGrid');
    if (!wrap) return;

    const scaffale = _scaffaliElenco.find(s => String(s.id) === String(_scaffaleAttivo));
    const eScambio = scaffale && scaffale.tipo === 'scambio';
    const elenco = _scaProdottiOrdinati();

    if (elenco.length === 0) {
        wrap.innerHTML = eScambio
            ? '<div class="stato-vuoto"><i class="fa-solid fa-right-left"></i><br>Nessun prodotto offerto in Scambio — usa "Offri in Scambio" dalla scheda di un prodotto sealed.</div>'
            : '<div class="stato-vuoto"><i class="fa-solid fa-box-open"></i><br>Nessun prodotto in questo scaffale — usa "Aggiungi o togli prodotti" per popolarlo.</div>';
        return;
    }

    const riordina = _scaEdit && _scaOrd === 'mio' && !eScambio;
    wrap.innerHTML = '<div class="sc-ripiano">' + elenco.map((x, pos) => {
        const p = x.p;
        const idAttr = escapeJsAttr(String(p.id));
        const nomeAttr = escapeHtml(p.nome || p.codice || '(senza nome)');
        const offerte = _quantitaOfferteScambioSealed[String(p.id)] ?? 0;
        // Clic = dettagli del prodotto (scheda sealed); su Scambio il clic
        // apre la quantità offerta, come prima.
        const onclick = eScambio ? `apriModaleQuantitaScambioSealed('${idAttr}')` : `scaffaleApriDettagliProdotto('${idAttr}')`;
        const src = _urlImmagineVisualizzabile(p.immagine, 200);
        const valore = _scaValoreProdotto(p, eScambio ? offerte : null);
        return `
            <div class="sc-prod" onclick="${onclick}" title="${nomeAttr}">
                <div class="sc-prod-img">
                    ${src ? `<img src="${src}" alt="${nomeAttr}" loading="lazy" onerror="this.remove();">` : '<i class="fa-solid fa-box"></i>'}
                    ${eScambio ? `<span class="sc-badge-off"><i class="fa-solid fa-right-left"></i> ${offerte} offert${offerte === 1 ? 'o' : 'i'}</span>` : ''}
                    ${_scaEdit ? `<button type="button" class="sc-x" onclick="event.stopPropagation(); rimuoviProdottoDaScaffaleAttivo('${idAttr}')" aria-label="Togli dallo scaffale"><i class="fa-solid fa-xmark"></i></button>` : ''}
                    ${riordina ? `<div class="sc-sposta">
                        <button type="button" ${pos === 0 ? 'disabled' : ''} onclick="event.stopPropagation(); scaffaleSposta('${idAttr}', -1)" aria-label="Sposta prima"><i class="fa-solid fa-chevron-left"></i></button>
                        <button type="button" ${pos === elenco.length - 1 ? 'disabled' : ''} onclick="event.stopPropagation(); scaffaleSposta('${idAttr}', 1)" aria-label="Sposta dopo"><i class="fa-solid fa-chevron-right"></i></button>
                    </div>` : ''}
                </div>
                <div class="sc-prod-nome">${nomeAttr}</div>
                <div class="sc-prod-prezzo">${valore > 0 ? formattaEuro(valore) : ''}</div>
            </div>`;
    }).join('') + '</div>';
}


// Dettagli del prodotto: usa la scheda sealed (modifica/dettaglio), dopo
// essersi assicurati che l'elenco del widget Sealed sia caricato.
async function scaffaleApriDettagliProdotto(id) {
    if (typeof prodottiSealedReali === 'undefined' || !prodottiSealedReali.some(p => String(p.id) === String(id))) {
        try { await caricaProdottiSealedReali(); } catch (e) { console.error('scaffaleApriDettagliProdotto:', e); }
    }
    apriModificaSealed(id);
}


// Riordino "Come li metto io": scambia di posto col vicino e riscrive
// l'ordine 1..N sulle righe dello scaffale.
async function scaffaleSposta(prodottoId, delta) {
    if (!_scaffaleAttivo) return;
    const elenco = _scaProdottiOrdinati();
    const idx = elenco.findIndex(x => String(x.p.id) === String(prodottoId));
    const j = idx + delta;
    if (idx < 0 || j < 0 || j >= elenco.length) return;
    const ids = elenco.map(x => x.r.prodotto_id);
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    const mappaRiga = {};
    _scaRighe.forEach(r => { mappaRiga[String(r.prodotto_id)] = r; });
    ids.forEach((id, k) => { if (mappaRiga[String(id)]) mappaRiga[String(id)].ordine = k + 1; });
    renderScaffaleContenuto();
    const userId = await authGetUserId();
    const { error } = await scaffaleProdottiImpostaOrdine(userId, _scaffaleAttivo, ids);
    if (error) { alert('Errore nel salvare l\'ordine: ' + error.message); await _caricaProdottiScaffaleAttivo(_scaffaliElenco.find(s => String(s.id) === String(_scaffaleAttivo))); renderScaffaleContenuto(); }
}


async function rimuoviProdottoDaScaffaleAttivo(prodottoId) {
    if (!_scaffaleAttivo) return;
    const userId = await authGetUserId();
    const { error } = await scaffaleProdottoRimuovi(userId, _scaffaleAttivo, prodottoId);
    if (error) { alert('Errore: ' + error.message); return; }

    _scaffaleAttivoProdottiIds = _scaffaleAttivoProdottiIds.filter(id => String(id) !== String(prodottoId));
    _scaRighe = _scaRighe.filter(r => String(r.prodotto_id) !== String(prodottoId));
    delete _quantitaOfferteScambioSealed[String(prodottoId)];
    _scaAggiornaTesta();
    renderScaffaleContenuto();
}


// ── Modale "Aggiungi prodotti" — checkbox su TUTTI i prodotti sealed
// dell'utente, spuntati quelli già nello scaffale aperto. Multi-scaffale
// (sql/41: UNIQUE(owner_id,scaffale_id,prodotto_id)): un prodotto può
// comparire spuntato in più scaffali contemporaneamente, nessun conflitto.
function apriModaleAssegnaProdotti() {
    const modal = document.getElementById('scaffaleAssegnaProdottiModal');
    const lista = document.getElementById('scaffaleAssegnaProdottiLista');
    if (!modal || !lista) return;

    if (_prodottiSealedCache.length === 0) {
        lista.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:1rem 0;">Nessun prodotto sealed in collezione ancora.</p>';
    } else {
        lista.innerHTML = _prodottiSealedCache.map(p => {
            const idAttr = String(p.id).replace(/'/g, "\\'");
            const nomeAttr = escapeHtml(p.nome || p.codice || '(senza nome)');
            const checked = _scaffaleAttivoProdottiIds.includes(p.id) ? 'checked' : '';
            return `
                <label style="display:flex; align-items:center; gap:0.6rem; padding:0.5rem 0; border-bottom:1px solid var(--border-color); cursor:pointer;">
                    <input type="checkbox" ${checked} onchange="_toggleAssegnazioneProdottoModale('${idAttr}', this.checked)">
                    <span style="font-size:0.85rem;">${nomeAttr}</span>
                </label>`;
        }).join('');
    }
    modal.style.display = 'flex';
}


async function chiudiModaleAssegnaProdotti() {
    const modal = document.getElementById('scaffaleAssegnaProdottiModal');
    if (modal) modal.style.display = 'none';
    // riflette aggiunte/rimozioni fatte nella modale (righe e ordine da DB)
    const scaffale = _scaffaliElenco.find(s => String(s.id) === String(_scaffaleAttivo));
    if (scaffale) await _caricaProdottiScaffaleAttivo(scaffale);
    _scaAggiornaTesta();
    renderScaffaleContenuto();
}


async function _toggleAssegnazioneProdottoModale(prodottoId, spuntato) {
    if (!_scaffaleAttivo) return;
    const userId = await authGetUserId();

    if (spuntato) {
        const { error } = await scaffaleProdottoAggiungi(userId, _scaffaleAttivo, prodottoId);
        if (error) { alert('Errore: ' + error.message); return; }
        if (!_scaffaleAttivoProdottiIds.includes(prodottoId)) _scaffaleAttivoProdottiIds.push(prodottoId);
    } else {
        const { error } = await scaffaleProdottoRimuovi(userId, _scaffaleAttivo, prodottoId);
        if (error) { alert('Errore: ' + error.message); return; }
        _scaffaleAttivoProdottiIds = _scaffaleAttivoProdottiIds.filter(id => String(id) !== String(prodottoId));
    }
}


// ── Rinomina — SEMPRE moderata (coerenza col precedente Binder: lì è così
// per QUALUNQUE tipo, non solo i pubblici, nonostante la prima risposta di
// Claudio suggerisse "solo se pubblico" — verificato nel codice binder.ui.js
// prima di scrivere, poi confermato da Claudio di seguire lo stesso schema).
async function proponiRinominaScaffaleAttivo() {
    if (!_scaffaleAttivo) return;
    const scaffale = _scaffaliElenco.find(s => String(s.id) === String(_scaffaleAttivo));
    if (!scaffale) return;

    const nuovoNome = (prompt('Nuovo nome (in attesa di approvazione admin):', scaffale.nome || '') || '').trim();
    if (!nuovoNome || nuovoNome === scaffale.nome) return;

    const userId = await authGetUserId();
    const { error } = await creaRichiestaPendente(userId, 'scaffale_nome', { scaffale_id: scaffale.id, nome_proposto: nuovoNome });
    if (error) { alert('Errore nella richiesta: ' + error.message); return; }

    alert('Richiesta inviata — il nuovo nome sarà visibile dopo l\'approvazione di un admin.');
}


async function impostaPubblicazioneScaffaleAttivo(pubblico) {
    if (!_scaffaleAttivo) return;
    const scaffale = _scaffaliElenco.find(s => String(s.id) === String(_scaffaleAttivo));
    if (!scaffale) return;

    const userId = await authGetUserId();
    const { error } = await scaffaleImpostaPubblicazione(userId, scaffale.id, pubblico);
    if (error) {
        console.error('impostaPubblicazioneScaffaleAttivo:', error.message);
        const checkbox = document.getElementById('scaffalePubblicazioneCheckbox');
        if (checkbox) checkbox.checked = !pubblico; // rollback visivo
        return;
    }
    scaffale.stato_pubblicazione = pubblico ? 'pubblico' : 'privato';
    scaffale.condivisibile = pubblico;
    _aggiornaCondivisioneScaffaleWrap(scaffale);
    _scaAggiornaTesta();
}


async function eliminaScaffaleAttivo() {
    if (!_scaffaleAttivo) return;
    const scaffale = _scaffaliElenco.find(s => String(s.id) === String(_scaffaleAttivo));
    if (!scaffale || scaffale.tipo === 'vetrina' || scaffale.tipo === 'scambio') return; // rete di sicurezza, il bottone è già nascosto per vetrina/scambio

    if (!confirm(`Eliminare lo scaffale "${scaffale.nome || ''}"? I prodotti al suo interno NON vengono eliminati, solo l'associazione.`)) return;

    const userId = await authGetUserId();
    const { error } = await scaffaleDelete(userId, scaffale.id);
    if (error) { alert('Errore: ' + error.message); return; }

    _scaffaliElenco = _scaffaliElenco.filter(s => String(s.id) !== String(scaffale.id));
    tornaAllaGrigliaScaffali();
}


// ── Modale quantità offerta — Scaffale Scambio (Fase 3, Step 3, 2026-09-12)
// Mirror ESATTO di apriModaleQuantitaScambio/confermaQuantitaScambio/
// _applicaQuantitaScambio in ui/binder.ui.js, per prodotti sealed invece
// che carte. Duplicazione intenzionale (Regola d'Oro #1) — dominio
// diverso (scaffali vs binder), nessun rischio di toccare la logica carte
// riusando/generalizzando queste funzioni.
let _scambioSealedModaleProdottoId = null;

// Wrapper chiamato dal bottone statico nella modale modifica sealed
// (ui/widget-sealed.ui.js, _sealedInModifica) — legge il prodotto in
// modifica al momento del click, dato che il bottone non viene rigenerato
// per ogni prodotto.
function apriScambioSealedDaModifica() {
    if (!_sealedInModifica) return;
    apriModaleQuantitaScambioSealed(_sealedInModifica.id);
}

function apriModaleQuantitaScambioSealed(prodottoId) {
    const prodotto = _prodottiSealedCache.find(p => String(p.id) === String(prodottoId));
    if (!prodotto) return;
    _scambioSealedModaleProdottoId = prodottoId;

    document.getElementById('scambioSealedQuantitaTitolo').textContent = prodotto.nome || prodotto.codice || '';
    const attuale = _quantitaOfferteScambioSealed[String(prodottoId)] ?? 0;
    const input = document.getElementById('scambioSealedQuantitaInput');
    input.value = attuale;
    input.max = prodotto.qty || 1;
    document.getElementById('scambioSealedQuantitaMax').textContent = `Ne possiedi ${prodotto.qty || 1}.`;
    document.getElementById('btnRimuoviScambioSealed').style.display = attuale > 0 ? '' : 'none';

    document.getElementById('scambioSealedQuantitaModal').style.display = 'flex';
}

function chiudiModaleQuantitaScambioSealed() {
    document.getElementById('scambioSealedQuantitaModal').style.display = 'none';
    _scambioSealedModaleProdottoId = null;
}

async function confermaQuantitaScambioSealed() {
    if (!_scambioSealedModaleProdottoId) return;
    const prodottoId = _scambioSealedModaleProdottoId;
    const input = document.getElementById('scambioSealedQuantitaInput');
    const quantita = Math.max(0, parseInt(input.value) || 0);

    await _applicaQuantitaScambioSealed(prodottoId, quantita);
    chiudiModaleQuantitaScambioSealed();
}

async function rimuoviDaScambioSealed() {
    if (!_scambioSealedModaleProdottoId) return;
    await _applicaQuantitaScambioSealed(_scambioSealedModaleProdottoId, 0);
    chiudiModaleQuantitaScambioSealed();
}

// Quantità 0: elimina la riga invece di scrivere 0 — coerente con "offerta
// a 0 = non ancora messa in vendita" già usato lato RPC pubblica (sql/45b,
// stesso principio applicato qui anche se la RPC pubblica scambio sealed
// non è ancora stata scritta, vedi Step 4).
async function _applicaQuantitaScambioSealed(prodottoId, quantita) {
    const userId = await authGetUserId();
    if (!userId || !_scaffaleScambioId) return;

    if (quantita <= 0) {
        const { error } = await scaffaleProdottoRimuovi(userId, _scaffaleScambioId, prodottoId);
        if (error) { alert('❌ Errore nel rimuovere il prodotto dallo Scambio: ' + error.message); return; }
        delete _quantitaOfferteScambioSealed[String(prodottoId)];
    } else {
        const { error } = await scaffaleProdottoImpostaQuantitaScambio(userId, _scaffaleScambioId, prodottoId, quantita);
        if (error) { alert('❌ Errore nell\'aggiornare la quantità offerta: ' + error.message); return; }
        _quantitaOfferteScambioSealed[String(prodottoId)] = quantita;
    }

    _aggiornaBottoneScambioSealed(prodottoId);
    // RESTYLE FASE 3g: se i dettagli Sealed sono aperti, si ridisegnano.
    if (typeof _sealedDettaglioId !== 'undefined' && _sealedDettaglioId && typeof _sealedRinfrescaDopoModifica === 'function') _sealedRinfrescaDopoModifica();

    // Se lo Scaffale Scambio è aperto proprio ora, la cache locale
    // (_scaffaleAttivoProdottiIds) è disallineata — stesso motivo di
    // _applicaQuantitaScambio in ui/binder.ui.js.
    if (_scaffaleAttivo && String(_scaffaleAttivo) === String(_scaffaleScambioId)) {
        const scaffale = _scaffaliElenco.find(s => String(s.id) === String(_scaffaleAttivo));
        if (scaffale) { await _caricaProdottiScaffaleAttivo(scaffale); renderScaffaleContenuto(); }
    }
}

// Aggiorna il bottone "Offri in Scambio" nella modale modifica sealed
// (ui/widget-sealed.ui.js), se presente nel DOM in questo momento.
function _aggiornaBottoneScambioSealed(prodottoId) {
    const btn = document.getElementById('btnOffriScambioSealed');
    if (!btn || String(_sealedInModifica?.id) !== String(prodottoId)) return;
    const quantita = _quantitaOfferteScambioSealed[String(prodottoId)] ?? 0;
    btn.innerHTML = quantita > 0
        ? `<i class="fa-solid fa-right-left"></i> In Scambio: ${quantita}`
        : `<i class="fa-solid fa-right-left"></i> Offri in Scambio`;
}
