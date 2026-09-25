// ═══════════════════════════════════════════════════════════════════════
// WIDGET-SEALED.UI.JS — tessera + pagina "Sealed" (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// RISCRITTO in Fase 1 (2026-09-12, roadmap operativa): il vecchio
// meccanismo carte.tipo='sealed' è stato ritirato (mai popolato in
// produzione, zero righe — vedi audit Fase 0 e Compilato_2026-09-12).
// Il widget ora legge dalla tabella dedicata prodotti_sealed tramite un
// array in-memory parallelo a carteReali (prodottiSealedReali, dichiarato
// in state/cards.state.js), popolato da caricaProdottiSealedReali() qui
// sotto — stesso pattern di caricaCarteReali() in ui/cards.ui.js, ma
// tenuto separato per non toccare quella funzione molto condivisa
// (Regola d'Oro #1: duplicazione preferita a un'astrazione condivisa
// rischiosa).
//
// Click su una riga apre apriModificaSealed(id) (nuovo, sotto) invece di
// apriModificaCarta — i campi sono diversi (integrità packaging invece di
// condizione, niente reverse/prima edizione).
//
// NOTA: il modale di modifica (HTML) non è stato ancora aggiunto a
// index.html in questa sessione — apriModificaSealed() logga un avviso e
// non fa nulla finché quel pezzo non viene consegnato. Il resto del
// widget (preview, pagina, ricerca, ordinamento) è già funzionante.
// ───────────────────────────────────────────────────────────────────────

// ── CARICAMENTO DATI ──────────────────────────────────────────────────
async function caricaProdottiSealedReali() {
    const userId = await authGetUserId();
    if (!userId) return;

    const { data, error } = await sealedListMie(userId);
    if (error) {
        console.error('Errore caricamento prodotti sealed:', error.message);
        return;
    }

    prodottiSealedReali = (data || []).map(r => ({
        id: r.id,
        name: r.nome || '',
        codice: r.codice || '',
        setEspansione: r.set_espansione || '',
        qty: r.qty || 1,
        lingua: r.lingua || 'IT',
        integrita: r.integrita_packaging || 'sigillato_integro',
        price: r.prezzo != null ? Number(r.prezzo) : 0,
        prezzoCardmarket: r.prezzo_cardmarket != null ? Number(r.prezzo_cardmarket) : null,
        prezzoAcquisto: r.prezzo_acquisto != null ? Number(r.prezzo_acquisto) : null,
        dataAcquisizione: r.data_acquisizione || null,
        note: r.note || '',
        immagine: r.immagine || null,
    }));
}


// ── VOCE DI CATALOGO ──────────────────────────────────────────────────
CATALOGO_WIDGET.sealed = {
        titolo: 'Sealed', icona: 'fa-box-archive',
        preview: () => {
            const prodotti = prodottiSealedReali;
            if (prodotti.length === 0) return { righe: ['Nessun prodotto'], dati: { totale: 0, valore: 0, lista: [] } };
            const perValore = prodotti.slice().sort((a, b) => (b.price || 0) - (a.price || 0));
            const inEvidenza = perValore[0];
            const valore = prodotti.reduce((t, p) => t + (Number(p.price) || 0) * (Number(p.qty) || 1), 0);
            return {
                righe: [`${prodotti.length} prodotti`, inEvidenza.name || ''],
                dati: {
                    totale: prodotti.length, valore,
                    lista: perValore.slice(0, 3).map(p => ({ nome: p.name || '—', prezzo: Number(p.price) || 0 }))
                }
            };
        },
        tab: 'sealed',
};

// ── PAGINA "SEALED" ──────────────────────────────────────────────────
let _sealedProdottiComputati = [];
let _sealedOrdinamento = 'valore';
let _sealedRicercaTesto = '';

function _sealedCalcola() {
    const righe = prodottiSealedReali.map(p => {
        const qty = Number(p.qty) || 1;
        const prezzoUnitario = Number(p.price) || 0;
        return { id: p.id, nome: p.name || '—', immagine: p.immagine || null, qty, prezzoUnitario, valoreTotale: prezzoUnitario * qty };
    });
    _sealedProdottiComputati = righe;
    return {
        totale: righe.length,
        valore: righe.reduce((t, r) => t + r.valoreTotale, 0),
    };
}

async function renderPaginaSealed() {
    const container = document.getElementById('sealedContenuto');
    if (!container) return;

    // Ricarica sempre all'apertura pagina — coerente col fatto che
    // l'inserimento (ui/entry.ui.js) scrive direttamente in prodotti_sealed
    // senza passare da caricaProdottiSealedReali() in automatico.
    await caricaProdottiSealedReali();

    _sealedOrdinamento = 'valore';
    _sealedRicercaTesto = '';
    const { totale, valore } = _sealedCalcola();
    const eur = (v) => formattaEuro(v); // formato unico "12.345,00 €" (decisione Claudio 2026-09-25)

    if (totale === 0) {
        container.innerHTML = `
            <div class="page-header">
                <span class="page-title">Sealed</span>
            </div>
            <p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:2rem 0;">Nessun prodotto sealed al momento.</p>
        `;
        return;
    }

    container.innerHTML = `
        <div class="page-header">
            <span class="page-title">Sealed</span>
        </div>
        <div class="pg-pagina">
            <div class="pg-intro">
                <div class="pg-grande">${totale}</div>
                <div class="pg-sotto">valore totale ${eur(valore)}</div>
            </div>
            <div class="pg-stat">
                <div><b>${totale}</b><span>Prodotti</span></div>
                <div><b>${eur(valore)}</b><span>Valore totale</span></div>
            </div>
            <input type="text" class="pg-cerca" placeholder="Cerca tra i prodotti sealed..." oninput="_sealedCercaInput(this.value)">
            <div class="pg-filtri">
                <span class="pg-filtro attivo" data-ord="valore" onclick="_sealedImpostaOrdinamento('valore')">Valore</span>
                <span class="pg-filtro" data-ord="quantita" onclick="_sealedImpostaOrdinamento('quantita')">Quantità</span>
                <span class="pg-filtro" data-ord="alfabetico" onclick="_sealedImpostaOrdinamento('alfabetico')">Alfabetico</span>
            </div>
            <div class="pg-elenco" id="sealedElenco"></div>
        </div>
    `;
    _sealedRenderElenco();
}

function _sealedImpostaOrdinamento(ordine) {
    _sealedOrdinamento = ordine;
    document.querySelectorAll('.pg-filtri .pg-filtro').forEach(el => {
        el.classList.toggle('attivo', el.dataset.ord === ordine);
    });
    _sealedRenderElenco();
}

function _sealedCercaInput(valore) {
    _sealedRicercaTesto = (valore || '').toLowerCase();
    _sealedRenderElenco();
}

function _sealedRenderElenco() {
    const elenco = document.getElementById('sealedElenco');
    if (!elenco) return;

    const eur = (v) => formattaEuro(v); // formato unico "12.345,00 €" (decisione Claudio 2026-09-25)

    let righe = [..._sealedProdottiComputati];
    if (_sealedRicercaTesto) righe = righe.filter(r => r.nome.toLowerCase().includes(_sealedRicercaTesto));

    if (_sealedOrdinamento === 'valore') righe.sort((a, b) => b.valoreTotale - a.valoreTotale);
    else if (_sealedOrdinamento === 'quantita') righe.sort((a, b) => b.qty - a.qty);
    else righe.sort((a, b) => a.nome.localeCompare(b.nome));

    if (righe.length === 0) {
        elenco.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.82rem; padding:1.2rem 0;">Nessun prodotto corrisponde alla ricerca.</p>';
        return;
    }

    elenco.innerHTML = righe.map(r => {
        const immagineSrc = r.immagine ? (_urlImmagineVisualizzabile(r.immagine, 96) || '') : '';
        const fig = immagineSrc
            ? `<img class="pg-fig" src="${immagineSrc}" alt="" onerror="this.style.display='none';">`
            : '<div class="pg-fig"></div>';
        return `
            <div class="pg-riga" data-tocca onclick="apriModificaSealed('${r.id}');">
                ${fig}
                <div class="pg-testo"><b>${escapeHtml(r.nome)}</b><span>×${r.qty} · ${eur(r.prezzoUnitario)} cad.</span></div>
                <div class="pg-destra"><b>${eur(r.valoreTotale)}</b>totale</div>
            </div>`;
    }).join('');
}


// ── MODIFICA / ELIMINAZIONE ─────────────────────────────────────────────
let _sealedInModifica = null;

async function apriModificaSealed(id) {
    const prodotto = prodottiSealedReali.find(p => String(p.id) === String(id));
    if (!prodotto) return;
    _sealedInModifica = prodotto;

    document.getElementById('editSealedNome').value = prodotto.name;
    document.getElementById('editSealedCodice').value = prodotto.codice || '';
    document.getElementById('editSealedSet').value = prodotto.setEspansione || '';
    document.getElementById('editSealedLingua').value = prodotto.lingua;
    document.getElementById('editSealedQty').value = prodotto.qty;
    document.getElementById('editSealedPrezzo').value = prodotto.price || '';
    document.getElementById('editSealedPrezzoCardmarket').value = prodotto.prezzoCardmarket != null ? prodotto.prezzoCardmarket : '';
    document.getElementById('editSealedPrezzoAcquisto').value = prodotto.prezzoAcquisto != null ? prodotto.prezzoAcquisto : '';
    document.getElementById('editSealedDataAcquisizione').value = prodotto.dataAcquisizione || '';
    document.getElementById('editSealedNote').value = prodotto.note || '';

    // Elenco integrità: STESSA fonte unica di ui/entry.ui.js
    // (INTEGRITA_PACKAGING_OPZIONI, nessun CHECK a database — decisione
    // Fase 1, deve restare facile aggiungerne di nuove).
    const selIntegrita = document.getElementById('editSealedIntegrita');
    selIntegrita.innerHTML = INTEGRITA_PACKAGING_OPZIONI.map(o =>
        `<option value="${o.value}" ${prodotto.integrita === o.value ? 'selected' : ''}>${o.label}</option>`
    ).join('');

    document.getElementById('editSealedModal').style.display = 'flex';

    // Fase 3, Step 3 (2026-09-12): etichetta iniziale del bottone "Offri in
    // Scambio" — _quantitaOfferteScambioSealed è precaricata da
    // apriPaginaScaffali() in ui/scaffali.ui.js (potrebbe non esserlo se
    // l'utente non ha mai aperto la pagina Scaffali in questa sessione,
    // da qui il controllo di esistenza prima di leggerla).
    const btnScambio = document.getElementById('btnOffriScambioSealed');
    if (btnScambio) {
        const quantita = (typeof _quantitaOfferteScambioSealed !== 'undefined') ? (_quantitaOfferteScambioSealed[String(id)] ?? 0) : 0;
        btnScambio.innerHTML = quantita > 0
            ? `<i class="fa-solid fa-right-left"></i> In Scambio: ${quantita}`
            : `<i class="fa-solid fa-right-left"></i> Offri in Scambio`;
    }
}


function chiudiModificaSealed() {
    document.getElementById('editSealedModal').style.display = 'none';
    _sealedInModifica = null;
}


async function salvaModificaSealed() {
    if (!_sealedInModifica) return;
    const idProdotto = _sealedInModifica.id;

    const num = (elId) => {
        const v = document.getElementById(elId).value;
        return v !== '' ? parseFloat(v) : null;
    };

    const aggiornamento = {
        nome: document.getElementById('editSealedNome').value.trim(),
        codice: document.getElementById('editSealedCodice').value.trim() || null,
        set_espansione: document.getElementById('editSealedSet').value.trim() || null,
        lingua: document.getElementById('editSealedLingua').value,
        qty: Math.max(1, parseInt(document.getElementById('editSealedQty').value, 10) || 1),
        integrita_packaging: document.getElementById('editSealedIntegrita').value,
        prezzo: num('editSealedPrezzo'),
        prezzo_cardmarket: num('editSealedPrezzoCardmarket'),
        prezzo_acquisto: num('editSealedPrezzoAcquisto'),
        data_acquisizione: document.getElementById('editSealedDataAcquisizione').value || null,
        note: document.getElementById('editSealedNote').value.trim() || null,
    };

    const btn = document.getElementById('btnSalvaModificaSealed');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvataggio...';

    const { error } = await sealedUpdate(idProdotto, aggiornamento);

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Salva Modifiche';

    if (error) {
        alert('❌ Errore nel salvare: ' + error.message);
        return;
    }

    // Fase 8, Step 2 (2026-09-13): stessa logica di modificaCampoInline
    // (ui/cards-modifica.ui.js) per le carte — qui in un colpo solo perché
    // il modale sealed salva tutti i campi insieme, non riga per riga.
    // _sealedInModifica è lo stato PRIMA di questa modifica (catturato da
    // apriModificaSealed). Fire-and-forget, mai bloccante.
    (async () => {
        const movimenti = [];
        const prezzoCambiato = Number(aggiornamento.prezzo) !== Number(_sealedInModifica.price || 0)
            && aggiornamento.prezzo != null;
        const qtyCambiata = Number(aggiornamento.qty) !== Number(_sealedInModifica.qty || 0);
        if (prezzoCambiato) {
            movimenti.push({
                tipo_evento: 'prezzo_manuale',
                quantita_delta: null,
                prezzo_unitario: aggiornamento.prezzo,
                valore_delta: (Number(aggiornamento.prezzo) - Number(_sealedInModifica.price || 0)) * (Number(_sealedInModifica.qty) || 1),
            });
        }
        if (qtyCambiata) {
            movimenti.push({
                tipo_evento: 'variazione_quantita',
                quantita_delta: Number(aggiornamento.qty) - Number(_sealedInModifica.qty || 0),
                prezzo_unitario: aggiornamento.prezzo,
                valore_delta: (Number(aggiornamento.qty) - Number(_sealedInModifica.qty || 0)) * (Number(aggiornamento.prezzo) || 0),
            });
        }
        if (movimenti.length === 0) return;
        const userId = await authGetUserId();
        if (!userId) return;
        const righe = movimenti.map(m => ({
            owner_id: userId,
            oggetto_tipo: 'sealed',
            oggetto_id: idProdotto,
            nome_snapshot: aggiornamento.nome || _sealedInModifica.name || '',
            fonte: 'sito',
            ...m,
        }));
        const { error: errMov } = await movimentiCollezioneInsertRighe(righe);
        if (errMov) console.error('Log movimenti (modifica sealed):', errMov.message);
    })();

    chiudiModificaSealed();
    await caricaProdottiSealedReali();
    if (typeof renderPaginaSealed === 'function') renderPaginaSealed();
}


async function eliminaSealedDaModale() {
    if (!_sealedInModifica) return;
    const id = _sealedInModifica.id;
    chiudiModificaSealed();
    await eliminaSealed(id);
}


async function eliminaSealed(id) {
    if (!confirm('Eliminare definitivamente questo prodotto sealed dalla collezione?\n\nQuesta azione non si può annullare.')) return;
    // Fase 8, Step 2 (2026-09-13): snapshot PRIMA della delete — l'oggetto
    // non esisterà più per rileggerlo dopo.
    const prodotto = prodottiSealedReali.find(p => String(p.id) === String(id));
    const { error } = await sealedDelete(id);
    if (error) {
        alert('❌ Errore nell\'eliminazione: ' + error.message);
        return;
    }
    if (prodotto) {
        (async () => {
            const userId = await authGetUserId();
            if (!userId) return;
            const { error: errMov } = await movimentiCollezioneInsertRighe([{
                owner_id: userId, tipo_evento: 'rimozione', oggetto_tipo: 'sealed',
                oggetto_id: id, nome_snapshot: prodotto.name || '',
                quantita_delta: -(Number(prodotto.qty) || 1), prezzo_unitario: prodotto.price || null,
                valore_delta: prodotto.price != null ? -(prodotto.price * (Number(prodotto.qty) || 1)) : null,
                fonte: 'sito',
            }]);
            if (errMov) console.error('Log movimenti (eliminazione sealed):', errMov.message);
        })();
    }
    await caricaProdottiSealedReali();
    if (typeof renderPaginaSealed === 'function') renderPaginaSealed();
}
