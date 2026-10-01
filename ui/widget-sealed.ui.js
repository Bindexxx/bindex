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
// RESTYLE BINDEX FASE 3g (2026-10-01, tavole "Sealed"): tre riquadri
// (prodotti, valore, scaffali), ricerca, ordini, una riga per prodotto con
// "codice · ×N · in Scambio" e lo scaffale dove sta; il tocco apre i
// DETTAGLI (prima apriva direttamente la modifica). "Aggiungi" porta
// all'Inserimento già sulla scheda Sealed.
let _sealedProdottiComputati = [];
let _sealedOrdinamento = 'valore';
let _sealedRicercaTesto = '';
let _sealedAssoc = [];        // scaffale_prodotti dell'utente
let _sealedDettaglioId = null;

// Scaffali e associazioni: stesse letture della pagina Scaffali, servono
// per "dove si trova" e "in Scambio". Aggiorna anche le cache globali che
// usa la finestra della quantità offerta (ui/scaffali.ui.js).
async function _sealedCaricaContesto(userId) {
    const [rs, ra] = await Promise.all([scaffaliList(userId), scaffaleProdottiTuttiUtente(userId)]);
    if (rs.error) console.error('[sealed] scaffali:', rs.error.message);
    if (ra.error) console.error('[sealed] associazioni:', ra.error.message);
    _scaffaliElenco = rs.data || [];
    _sealedAssoc = ra.data || [];
    const scambio = _scaffaliElenco.find(x => x.tipo === 'scambio');
    _scaffaleScambioId = scambio ? scambio.id : null;
    _quantitaOfferteScambioSealed = {};
    if (scambio) _sealedAssoc.filter(r => String(r.scaffale_id) === String(scambio.id))
        .forEach(r => { _quantitaOfferteScambioSealed[String(r.prodotto_id)] = r.quantita_offerta; });
    _prodottiSealedCache = prodottiSealedReali.map(p => ({ id: p.id, nome: p.name, codice: p.codice, qty: p.qty, prezzo: p.price, immagine: p.immagine }));
}

function _sealedScaffaliDi(prodottoId) {
    return _sealedAssoc.filter(r => String(r.prodotto_id) === String(prodottoId))
        .map(r => _scaffaliElenco.find(x => String(x.id) === String(r.scaffale_id))).filter(Boolean);
}

function _sealedCalcola() {
    const righe = prodottiSealedReali.map(p => {
        const qty = Number(p.qty) || 1;
        const prezzoUnitario = Number(p.price) || 0;
        const scaffali = _sealedScaffaliDi(p.id);
        const normali = scaffali.filter(x => x.tipo !== 'scambio');
        return {
            id: p.id, nome: p.name || '—', codice: p.codice || '', immagine: p.immagine || null, qty, prezzoUnitario,
            valoreTotale: prezzoUnitario * qty,
            inScambio: Number(_quantitaOfferteScambioSealed[String(p.id)]) || 0,
            scaffale: normali.length ? normali.map(x => _scaNomeScaffale(x)).join(', ') : '',
        };
    });
    _sealedProdottiComputati = righe;
    return {
        totale: righe.length,
        valore: righe.reduce((t, r) => t + r.valoreTotale, 0),
    };
}

function _sealedApriInserimento() {
    switchTab('inserimento', document.getElementById('mNav-inserimento'));
    impostaTipoInserimento('sealed');
}

async function renderPaginaSealed() {
    const container = document.getElementById('sealedContenuto');
    if (!container) return;
    _sealedDettaglioId = null;

    // Ricarica sempre all'apertura pagina — coerente col fatto che
    // l'inserimento (ui/entry.ui.js) scrive direttamente in prodotti_sealed
    // senza passare da caricaProdottiSealedReali() in automatico.
    await caricaProdottiSealedReali();
    const userId = await authGetUserId();
    if (userId) await _sealedCaricaContesto(userId);

    _sealedOrdinamento = 'valore';
    _sealedRicercaTesto = '';
    const { totale, valore } = _sealedCalcola();
    const eur = (v) => formattaEuro(v); // formato unico "12.345,00 €" (decisione Claudio 2026-09-25)
    const testa = `
        <div class="page-header sl-testa">
            <span class="page-title">Sealed</span>
            <button type="button" class="sl-btn sl-btn-pieno" onclick="_sealedApriInserimento()"><i class="fa-solid fa-plus"></i> Aggiungi</button>
        </div>`;

    if (totale === 0) {
        container.innerHTML = `${testa}
            <div class="stato-vuoto"><i class="fa-solid fa-box"></i><br>Nessun prodotto sealed al momento.</div>`;
        return;
    }

    const nScaffali = new Set(_sealedAssoc.filter(r => { const x = _scaffaliElenco.find(y => String(y.id) === String(r.scaffale_id)); return x && x.tipo !== 'scambio'; }).map(r => r.scaffale_id)).size;
    container.innerHTML = `
        <div class="sl-layout">
        <div class="sl-pagina" id="sealedVistaElenco">
            ${testa}
            <div class="sl-stat">
                <div><i class="fa-solid fa-box"></i><b>${totale}</b><span>prodott${totale === 1 ? 'o' : 'i'}</span></div>
                <div><i class="fa-solid fa-coins"></i><b>${eur(valore)}</b><span>valore</span></div>
                <div><i class="fa-solid fa-box-archive"></i><b>${nScaffali}</b><span>scaffal${nScaffali === 1 ? 'e' : 'i'}</span></div>
            </div>
            <div class="sl-cerca"><i class="fa-solid fa-magnifying-glass"></i><input type="text" placeholder="Cerca tra i sealed…" oninput="_sealedCercaInput(this.value)"></div>
            <div class="sl-chips">
                <span class="sl-chip attivo" data-ord="valore" onclick="_sealedImpostaOrdinamento('valore')">Valore</span>
                <span class="sl-chip" data-ord="quantita" onclick="_sealedImpostaOrdinamento('quantita')">Quantità</span>
                <span class="sl-chip" data-ord="alfabetico" onclick="_sealedImpostaOrdinamento('alfabetico')">A → Z</span>
            </div>
            <div id="sealedElenco"></div>
        </div>
        <div class="sl-pagina" id="sealedVistaDettaglio" style="display:none;"></div>
        </div>
    `;
    _sealedRenderElenco();
    // RESTYLE (tavola "Sealed PC"): su PC elenco e dettagli affiancati.
    if (_sealedEPC() && _sealedProdottiComputati.length) {
        const primo = [..._sealedProdottiComputati].sort((a, b) => b.valoreTotale - a.valoreTotale)[0];
        _sealedApriDettaglio(primo.id);
    }
}

function _sealedEPC() { const s = document.getElementById('sealed'); return !!s && s.clientWidth >= 780; }

function _sealedImpostaOrdinamento(ordine) {
    _sealedOrdinamento = ordine;
    document.querySelectorAll('#sealed .sl-chip').forEach(el => {
        el.classList.toggle('attivo', el.dataset.ord === ordine);
    });
    _sealedRenderElenco();
}

function _sealedCercaInput(valore) {
    _sealedRicercaTesto = (valore || '').toLowerCase();
    _sealedRenderElenco();
}

function _sealedFigHtml(immagine, grande) {
    const src = immagine ? (_urlImmagineVisualizzabile(immagine, grande ? 320 : 120) || '') : '';
    return `<div class="sl-fig${grande ? ' sl-fig-grande' : ''}">${src ? `<img src="${src}" alt="" onerror="this.remove();">` : '<i class="fa-solid fa-box"></i>'}</div>`;
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
        const sotto = [r.codice || null, `×${r.qty}`, r.inScambio > 0 ? 'in Scambio' : null].filter(Boolean).join(' · ');
        return `
            <div class="sl-riga${String(r.id) === String(_sealedDettaglioId) ? ' sel' : ''}" data-id="${escapeHtml(String(r.id))}" onclick="_sealedApriDettaglio('${escapeJsAttr(String(r.id))}')">
                ${_sealedFigHtml(r.immagine)}
                <div class="sl-riga-testo"><b>${escapeHtml(r.nome)}</b><span>${escapeHtml(sotto)}</span></div>
                <div class="sl-riga-destra"><b>${eur(r.valoreTotale)}</b><span>${r.scaffale ? escapeHtml(r.scaffale) : 'nessuno scaffale'}</span></div>
                <i class="fa-solid fa-chevron-right sl-freccia"></i>
            </div>`;
    }).join('');
}

// ── Dettagli del prodotto ────────────────────────────────────────────
function _sealedDataLunga(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, '');
}

function _sealedApriDettaglio(id) {
    const p = prodottiSealedReali.find(x => String(x.id) === String(id));
    if (!p) return;
    _sealedDettaglioId = id;
    const el = document.getElementById('sealedVistaElenco');
    const det = document.getElementById('sealedVistaDettaglio');
    if (!el || !det) return;
    const pc = _sealedEPC();
    el.style.display = pc ? '' : 'none';
    det.style.display = '';
    document.querySelectorAll('#sealedElenco .sl-riga').forEach(r => r.classList.toggle('sel', r.dataset.id === String(id)));
    _sealedRenderDettaglio();
    if (pc) return;
    const scroller = document.getElementById('sealed');
    if (scroller) scroller.scrollTop = 0;
}

function _sealedChiudiDettaglio() {
    _sealedDettaglioId = null;
    const el = document.getElementById('sealedVistaElenco');
    const det = document.getElementById('sealedVistaDettaglio');
    if (det) det.style.display = 'none';
    if (el) el.style.display = '';
}

function _sealedRenderDettaglio() {
    const det = document.getElementById('sealedVistaDettaglio');
    const p = prodottiSealedReali.find(x => String(x.id) === String(_sealedDettaglioId));
    if (!det || !p) return;
    const eur = (v) => formattaEuro(v);
    const qty = Number(p.qty) || 1;
    const integrita = { sigillato_integro: 'Sigillato integro', sigillato: 'Sigillato', aperto: 'Aperto' }[p.integrita] || String(p.integrita || '').replace(/_/g, ' ');
    const lingue = { IT: 'Italiano', EN: 'Inglese', JP: 'Giapponese', DE: 'Tedesco', FR: 'Francese', ES: 'Spagnolo' };
    const sopra = [p.setEspansione || p.codice, lingue[p.lingua] || p.lingua, integrita].filter(Boolean).join(' · ');

    // Guadagno sull'acquisto: SOLO se c'è il prezzo d'acquisto.
    let guadagno = '';
    if (p.prezzoAcquisto != null && p.prezzoAcquisto > 0 && p.price) {
        const diff = (p.price - p.prezzoAcquisto) * qty;
        const perc = Math.round(((p.price - p.prezzoAcquisto) / p.prezzoAcquisto) * 100);
        const su = diff >= 0;
        guadagno = `<div class="sl-guadagno ${su ? 'su' : 'giu'}">${su ? '+' : '−'}${eur(Math.abs(diff))} sull’acquisto (${su ? '+' : '−'}${Math.abs(perc)}%)</div>`;
    }
    const origine = p.prezzoCardmarket != null && Number(p.prezzoCardmarket) === Number(p.price)
        ? 'calcolato su Cardmarket' : 'prezzo impostato da te';

    const righeInfo = [
        ['Cardmarket', p.prezzoCardmarket != null ? eur(p.prezzoCardmarket) : null],
        ['Acquisto', p.prezzoAcquisto != null ? eur(p.prezzoAcquisto) : null],
        ['Acquisito il', _sealedDataLunga(p.dataAcquisizione)],
        ['Quantità', qty > 1 ? `×${qty} (totale ${eur((p.price || 0) * qty)})` : null],
        ['Note', p.note ? escapeHtml(p.note) : null],
    ].filter(r => r[1]).map(r => `<div class="sl-info-riga"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');

    const scaffali = _sealedScaffaliDi(p.id);
    const normali = scaffali.filter(x => x.tipo !== 'scambio');
    const offerte = Number(_quantitaOfferteScambioSealed[String(p.id)]) || 0;
    const dove = normali.map(x => `
        <div class="sl-dove" onclick="_sealedVaiAScaffale('${escapeJsAttr(String(x.id))}')">
            <div class="sl-dove-icona"><i class="fa-solid ${x.tipo === 'vetrina' ? 'fa-star' : 'fa-box-archive'}"></i></div>
            <b>${escapeHtml(_scaNomeScaffale(x))}</b>
        </div>`).join('') + `
        <div class="sl-dove">
            <div class="sl-dove-icona"><i class="fa-solid fa-right-left"></i></div>
            <b>Scambio</b><span>${offerte > 0 ? `${offerte} offert${offerte === 1 ? 'o' : 'i'}` : 'non offerto'}</span>
        </div>`;

    det.innerHTML = `
        <div class="page-header sl-testa">
            <button type="button" class="sl-indietro" onclick="_sealedChiudiDettaglio()" aria-label="Torna ai sealed"><i class="fa-solid fa-chevron-left"></i></button>
            <span class="page-title" style="flex:1; min-width:0; font-size:1.2rem;">${escapeHtml(p.name || '—')}</span>
        </div>
        <div class="sl-det-testa">
            ${_sealedFigHtml(p.immagine, true)}
            <div class="sl-det-prezzi">
                <div class="sl-det-sopra">${escapeHtml(sopra)}</div>
                <div class="sl-det-prezzo">${eur(p.price || 0)}</div>
                ${guadagno}
                <div class="sl-det-origine">${origine}</div>
            </div>
        </div>
        <div class="sl-info">${righeInfo}</div>
        <div class="sl-sezione">Dove si trova</div>
        ${dove}
        <div class="sl-azioni">
            <button type="button" class="sl-btn sl-btn-pieno" onclick="apriModificaSealed('${escapeJsAttr(String(p.id))}')"><i class="fa-solid fa-pen"></i> Modifica</button>
            <button type="button" class="sl-btn" onclick="_sealedOffriInScambio()"><i class="fa-solid fa-right-left"></i> ${offerte > 0 ? 'In Scambio: ' + offerte : 'Offri in Scambio'}</button>
        </div>`;
}

// "Offri in Scambio": stessa finestra della quantità usata dagli Scaffali.
// Se lo scaffale Scambio non esiste ancora lo crea (scaffaleScambioGarantisci).
async function _sealedOffriInScambio() {
    if (!_sealedDettaglioId) return;
    if (!_scaffaleScambioId) {
        const userId = await authGetUserId();
        const { data, error } = await scaffaleScambioGarantisci(userId);
        if (error || !data) { alert('Errore: impossibile preparare lo Scambio.'); return; }
        _scaffaleScambioId = data.id;
    }
    apriModaleQuantitaScambioSealed(_sealedDettaglioId);
}

function _sealedVaiAScaffale(scaffaleId) {
    apriDettaglioWidget('scaffali', null);
    setTimeout(() => { if (typeof apriScaffaleDettaglio === 'function') apriScaffaleDettaglio(scaffaleId); }, 600);
}

// Dopo una modifica (scheda sealed o quantità offerta): ricalcola e, se il
// dettaglio è aperto, lo ridisegna.
async function _sealedRinfrescaDopoModifica() {
    if (!document.getElementById('sealedVistaElenco')) { if (document.getElementById('sealedContenuto')) renderPaginaSealed(); return; }
    const aperto = _sealedDettaglioId;
    await caricaProdottiSealedReali();
    const userId = await authGetUserId();
    if (userId) await _sealedCaricaContesto(userId);
    _sealedCalcola();
    _sealedRenderElenco();
    if (aperto && prodottiSealedReali.some(x => String(x.id) === String(aperto))) _sealedRenderDettaglio();
    else if (aperto) _sealedChiudiDettaglio();
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
    await _sealedRinfrescaDopoModifica();
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
    await _sealedRinfrescaDopoModifica();
}
