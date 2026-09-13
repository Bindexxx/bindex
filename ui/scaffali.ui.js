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


// ── Griglia degli scaffali ───────────────────────────────────────────────
// Riusa le classi CSS .binder-contenitore-* (puro stile visivo, stessa
// tessera dei Binder) — nessuna dipendenza di comportamento da binder.ui.js.
async function renderGrigliaScaffali() {
    const userId = await authGetUserId();
    const griglia = document.getElementById('scaffaliContenitoriGrid');
    if (!griglia) { console.error('renderGrigliaScaffali: manca #scaffaliContenitoriGrid in index.html'); return; }

    const { data: conteggiRighe, error } = await scaffaleProdottiConteggiTutti(userId);
    if (error) console.error('renderGrigliaScaffali (conteggi):', error.message);
    const conteggi = {};
    (conteggiRighe || []).forEach(r => { conteggi[r.scaffale_id] = (conteggi[r.scaffale_id] || 0) + 1; });

    if (_scaffaliElenco.length === 0) {
        griglia.innerHTML = '<div class="stato-vuoto"><i class="fa-solid fa-box-archive"></i><br>Nessuno scaffale ancora — creane uno per organizzare i tuoi prodotti sealed.</div>';
        return;
    }

    griglia.innerHTML = _scaffaliElenco.map(s => {
        const idAttr = String(s.id).replace(/'/g, "\\'");
        const nomeAttr = escapeHtml(s.nome || (s.tipo === 'vetrina' ? 'Vetrina' : '(senza nome)'));
        const conteggio = conteggi[s.id] || 0;
        const icona = s.tipo === 'vetrina' ? 'fa-star' : 'fa-box-archive';
        return `
            <div class="binder-contenitore-tile" onclick="apriScaffaleDettaglio('${idAttr}')" title="${nomeAttr}">
                <div class="binder-contenitore-cover"><i class="fa-solid ${icona}"></i></div>
                <div class="binder-contenitore-nome">${nomeAttr}</div>
                <div class="binder-contenitore-conteggio">${conteggio} prodott${conteggio === 1 ? 'o' : 'i'}</div>
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


// ── Vista di dettaglio (griglia statica dei prodotti assegnati) ─────────
async function apriScaffaleDettaglio(scaffaleId) {
    _scaffaleAttivo = scaffaleId;

    document.getElementById('scaffaliContenitoriGrid').style.display = 'none';
    const wrapDettaglio = document.getElementById('scaffaleDettaglioWrap');
    if (wrapDettaglio) wrapDettaglio.style.display = 'block';

    const scaffale = _scaffaliElenco.find(s => String(s.id) === String(scaffaleId));
    if (!scaffale) return;
    const eScambio = scaffale.tipo === 'scambio';

    const titoloEl = document.getElementById('scaffaleDettaglioTitolo');
    if (titoloEl) titoloEl.textContent = scaffale.nome || (scaffale.tipo === 'vetrina' ? 'Vetrina' : (eScambio ? 'Scambio' : ''));

    // Rinomina/pubblicazione/eliminazione: Vetrina e Scambio non si
    // eliminano (fissi, un solo esemplare per utente — stesso motivo per
    // cui il binder 'extra'/'scambio' non sono mai eliminabili).
    const btnElimina = document.getElementById('btnEliminaScaffaleAttivo');
    if (btnElimina) btnElimina.style.display = (scaffale.tipo === 'vetrina' || eScambio) ? 'none' : '';

    // Fase 3, Step 3 (2026-09-12): Scambio è SEMPRE pubblico (forzato già
    // in scaffaleScambioGarantisci) — checkbox nascosta, non ha senso
    // mostrarla come se fosse una scelta libera dell'utente (stesso
    // trattamento del binder Scambio in ui/binder.ui.js, eGiaPubblicoFisso).
    const rigaPubblicazione = document.getElementById('scaffalePubblicazioneRiga');
    if (rigaPubblicazione) rigaPubblicazione.style.display = eScambio ? 'none' : '';
    const checkboxPub = document.getElementById('scaffalePubblicazioneCheckbox');
    if (checkboxPub) checkboxPub.checked = eScambio || scaffale.stato_pubblicazione === 'pubblico';
    _aggiornaCondivisioneScaffaleWrap(scaffale);

    // "Aggiungi prodotti" (checkbox sì/no) non si applica a Scambio, che ha
    // bisogno di una QUANTITÀ — si offre un prodotto dalla sua modale di
    // modifica sealed (bottone "Offri in Scambio", ui/widget-sealed.ui.js),
    // non da qui. Bottone nascosto per evitare di suggerire un flusso che
    // non fa quello che sembra.
    const btnAssegna = document.getElementById('btnApriModaleAssegnaProdotti');
    if (btnAssegna) btnAssegna.style.display = eScambio ? 'none' : '';
    const notaScambio = document.getElementById('scaffaleScambioNota');
    if (notaScambio) notaScambio.style.display = eScambio ? '' : 'none';

    await _caricaProdottiScaffaleAttivo(scaffale);
    renderScaffaleContenuto();
}


// Mostra/nasconde il blocco "Condividi" — solo quando lo scaffale è
// pubblico, stesso schema di binder.ui.js (_aggiornaControlliRinomina...),
// più semplice qui perché Scaffali ha un solo tipo di pagina pubblica.
function _aggiornaCondivisioneScaffaleWrap(scaffale) {
    const wrap = document.getElementById('scaffaleCondivisioneWrap');
    if (wrap) wrap.style.display = (scaffale.stato_pubblicazione === 'pubblico') ? 'flex' : 'none';
}


function tornaAllaGrigliaScaffali() {
    _scaffaleAttivo = null;
    const wrapDettaglio = document.getElementById('scaffaleDettaglioWrap');
    if (wrapDettaglio) wrapDettaglio.style.display = 'none';
    document.getElementById('scaffaliContenitoriGrid').style.display = '';
}


async function _caricaProdottiScaffaleAttivo(scaffale) {
    const userId = await authGetUserId();
    const eScambio = scaffale.tipo === 'scambio';
    const { data, error } = eScambio
        ? await scaffaleProdottiQueryConQuantita(userId, scaffale.id)
        : await scaffaleProdottiList(userId, scaffale.id);
    if (error) { console.error('_caricaProdottiScaffaleAttivo:', error.message); _scaffaleAttivoProdottiIds = []; return; }
    if (eScambio) {
        _quantitaOfferteScambioSealed = {};
        (data || []).forEach(r => { _quantitaOfferteScambioSealed[String(r.prodotto_id)] = r.quantita_offerta; });
    }
    _scaffaleAttivoProdottiIds = (data || []).map(r => r.prodotto_id);
}


function renderScaffaleContenuto() {
    const wrap = document.getElementById('scaffaleContenutoGrid');
    if (!wrap) return;

    const scaffale = _scaffaliElenco.find(s => String(s.id) === String(_scaffaleAttivo));
    const eScambio = scaffale && scaffale.tipo === 'scambio';

    const prodotti = _prodottiSealedCache.filter(p => _scaffaleAttivoProdottiIds.includes(p.id));
    if (prodotti.length === 0) {
        wrap.innerHTML = eScambio
            ? '<div class="stato-vuoto"><i class="fa-solid fa-right-left"></i><br>Nessun prodotto offerto in Scambio — usa "Offri in Scambio" dalla modifica di un prodotto sealed.</div>'
            : '<div class="stato-vuoto"><i class="fa-solid fa-box-open"></i><br>Nessun prodotto in questo scaffale — usa "Aggiungi prodotti" per popolarlo.</div>';
        return;
    }

    wrap.innerHTML = prodotti.map(p => {
        const idAttr = String(p.id).replace(/'/g, "\\'");
        const nomeAttr = escapeHtml(p.nome || p.codice || '(senza nome)');
        const onclickAttr = eScambio ? `apriModaleQuantitaScambioSealed('${idAttr}')` : `rimuoviProdottoDaScaffaleAttivo('${idAttr}')`;
        const badge = eScambio
            ? `<div class="binder-slot-qty-badge" style="position:static; margin-top:0.2rem;">Offerte: ${_quantitaOfferteScambioSealed[idAttr] ?? 0}</div>`
            : '';
        return `
            <div class="binder-contenitore-tile" onclick="${onclickAttr}" title="${eScambio ? 'Modifica quantità offerta' : `Rimuovi ${nomeAttr}`}">
                <div class="binder-contenitore-cover">
                    ${p.immagine ? `<img src="${escapeHtml(p.immagine)}" alt="${nomeAttr}" loading="lazy" onerror="this.remove();">` : `<i class="fa-solid fa-box"></i>`}
                </div>
                <div class="binder-contenitore-nome">${nomeAttr}</div>
                ${badge}
            </div>`;
    }).join('');
}


async function rimuoviProdottoDaScaffaleAttivo(prodottoId) {
    if (!_scaffaleAttivo) return;
    if (!confirm('Rimuovere questo prodotto dallo scaffale?')) return;

    const userId = await authGetUserId();
    const { error } = await scaffaleProdottoRimuovi(userId, _scaffaleAttivo, prodottoId);
    if (error) { alert('Errore: ' + error.message); return; }

    _scaffaleAttivoProdottiIds = _scaffaleAttivoProdottiIds.filter(id => String(id) !== String(prodottoId));
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


function chiudiModaleAssegnaProdotti() {
    const modal = document.getElementById('scaffaleAssegnaProdottiModal');
    if (modal) modal.style.display = 'none';
    renderScaffaleContenuto(); // riflette eventuali aggiunte/rimozioni fatte nella modale
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
    await renderGrigliaScaffali();
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
