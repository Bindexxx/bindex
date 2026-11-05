// Pagina Scaffali.

let _scaffaliElenco = [];
let _scaffaleAttivo = null;
let _scaffaleAttivoProdottiIds = [];
let _prodottiSealedCache = [];

let _scaffaleScambioId = null;
let _quantitaOfferteScambioSealed = {};

let _scaffaleDaAprire = null;

async function apriPaginaScaffali() {
    const userId = await authGetUserId();
    if (!userId) return;

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

    if (_scaffaleScambioId) {
        const { data: righeScambio, error: errRigheScambio } = await scaffaleProdottiQueryConQuantita(userId, _scaffaleScambioId);
        if (errRigheScambio) console.error('apriPaginaScaffali (quantità scambio):', errRigheScambio.message);
        _quantitaOfferteScambioSealed = {};
        (righeScambio || []).forEach(r => { _quantitaOfferteScambioSealed[String(r.prodotto_id)] = r.quantita_offerta; });
    }

    await renderGrigliaScaffali();
    const daAprire = _scaffaleDaAprire;
    _scaffaleDaAprire = null;
    if (daAprire && _scaffaliElenco.some(sc => String(sc.id) === String(daAprire))) apriScaffaleDettaglio(daAprire);
    else if (_scaEPC() && _scaffaliElenco.length) apriScaffaleDettaglio(_scaffaliElenco[0].id);
}

function _scaEPC() { const s = document.getElementById('scaffali'); return !!s && s.clientWidth >= 780; }

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
            <div class="sc-riga${String(s.id) === String(_scaffaleAttivo) ? ' sel' : ''}" data-id="${escapeHtml(String(s.id))}" onclick="apriScaffaleDettaglio('${idAttr}')">
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

    const nome = ((await chiediTesto({ titolo: 'Nuovo scaffale', testo: 'Nome del nuovo scaffale:', conferma: 'Crea', maxLength: 60 })) || '').trim();
    if (!nome) return;

    const { error } = await scaffaleInsert(userId, nome);
    if (error) { mostraAvviso('Errore nella creazione: ' + error.message); return; }

    const { data: scaffali, error: errList } = await scaffaliList(userId);
    if (!errList) _scaffaliElenco = scaffali || [];
    await renderGrigliaScaffali();
}

let _scaEdit = false;
let _scaOrd = 'mio';
let _scaRighe = [];

async function apriScaffaleDettaglio(scaffaleId) {
    _scaffaleAttivo = scaffaleId;
    _scaEdit = false;
    _scaOrd = prefFiltroPaginaScegli('scaffali', 'ordine', ['mio', 'nome', 'tipo', 'valore'], 'mio');

    const elenco = document.getElementById('scaffaliElencoVista');
    if (elenco) elenco.style.display = _scaEPC() ? '' : 'none';
    document.querySelectorAll('#scaffaliContenitoriGrid .sc-riga').forEach(r => r.classList.toggle('sel', r.dataset.id === String(scaffaleId)));
    const wrapDettaglio = document.getElementById('scaffaleDettaglioWrap');
    if (wrapDettaglio) wrapDettaglio.style.display = 'block';

    const scaffale = _scaffaliElenco.find(s => String(s.id) === String(scaffaleId));
    if (!scaffale) return;
    const eScambio = scaffale.tipo === 'scambio';

    const titoloEl = document.getElementById('scaffaleDettaglioTitolo');
    if (titoloEl) titoloEl.textContent = _scaNomeScaffale(scaffale);

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
    prefFiltroPaginaSet('scaffali', 'ordine', o);
    _scaAggiornaTesta();
    renderScaffaleContenuto();
}

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
    renderGrigliaScaffali();
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

async function scaffaleApriDettagliProdotto(id) {
    if (typeof prodottiSealedReali === 'undefined' || !prodottiSealedReali.some(p => String(p.id) === String(id))) {
        try { await caricaProdottiSealedReali(); } catch (e) { console.error('scaffaleApriDettagliProdotto:', e); }
    }
    apriModificaSealed(id);
}

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
    if (error) { mostraAvviso('Errore nel salvare l\'ordine: ' + error.message); await _caricaProdottiScaffaleAttivo(_scaffaliElenco.find(s => String(s.id) === String(_scaffaleAttivo))); renderScaffaleContenuto(); }
}

async function rimuoviProdottoDaScaffaleAttivo(prodottoId) {
    if (!_scaffaleAttivo) return;
    const userId = await authGetUserId();
    const { error } = await scaffaleProdottoRimuovi(userId, _scaffaleAttivo, prodottoId);
    if (error) { mostraAvviso('Errore: ' + error.message); return; }

    _scaffaleAttivoProdottiIds = _scaffaleAttivoProdottiIds.filter(id => String(id) !== String(prodottoId));
    _scaRighe = _scaRighe.filter(r => String(r.prodotto_id) !== String(prodottoId));
    delete _quantitaOfferteScambioSealed[String(prodottoId)];
    _scaAggiornaTesta();
    renderScaffaleContenuto();
}

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
        if (error) { mostraAvviso('Errore: ' + error.message); return; }
        if (!_scaffaleAttivoProdottiIds.includes(prodottoId)) _scaffaleAttivoProdottiIds.push(prodottoId);
    } else {
        const { error } = await scaffaleProdottoRimuovi(userId, _scaffaleAttivo, prodottoId);
        if (error) { mostraAvviso('Errore: ' + error.message); return; }
        _scaffaleAttivoProdottiIds = _scaffaleAttivoProdottiIds.filter(id => String(id) !== String(prodottoId));
    }
}

async function proponiRinominaScaffaleAttivo() {
    if (!_scaffaleAttivo) return;
    const scaffale = _scaffaliElenco.find(s => String(s.id) === String(_scaffaleAttivo));
    if (!scaffale) return;

    const nuovoNome = ((await chiediTesto({ titolo: 'Rinomina scaffale', testo: 'Nuovo nome (in attesa di approvazione admin):', valore: scaffale.nome || '', conferma: 'Proponi', maxLength: 60 })) || '').trim();
    if (!nuovoNome || nuovoNome === scaffale.nome) return;

    const userId = await authGetUserId();
    const { error } = await creaRichiestaPendente(userId, 'scaffale_nome', { scaffale_id: scaffale.id, nome_proposto: nuovoNome });
    if (error) { mostraAvviso('Errore nella richiesta: ' + error.message); return; }

    mostraAvviso('Richiesta inviata — il nuovo nome sarà visibile dopo l\'approvazione di un admin.');
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
        if (checkbox) checkbox.checked = !pubblico;
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
    if (!scaffale || scaffale.tipo === 'vetrina' || scaffale.tipo === 'scambio') return;

    if (!(await chiediConferma({ titolo: 'Eliminare lo scaffale?', testo: `"${scaffale.nome || ''}": i prodotti al suo interno NON vengono eliminati, solo l'associazione.`, conferma: 'Elimina', pericolo: true }))) return;

    const userId = await authGetUserId();
    const { error } = await scaffaleDelete(userId, scaffale.id);
    if (error) { mostraAvviso('Errore: ' + error.message); return; }

    _scaffaliElenco = _scaffaliElenco.filter(s => String(s.id) !== String(scaffale.id));
    tornaAllaGrigliaScaffali();
}

let _scambioSealedModaleProdottoId = null;

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

async function _applicaQuantitaScambioSealed(prodottoId, quantita) {
    const userId = await authGetUserId();
    if (!userId || !_scaffaleScambioId) return;

    if (quantita <= 0) {
        const { error } = await scaffaleProdottoRimuovi(userId, _scaffaleScambioId, prodottoId);
        if (error) { mostraAvviso('❌ Errore nel rimuovere il prodotto dallo Scambio: ' + error.message); return; }
        delete _quantitaOfferteScambioSealed[String(prodottoId)];
    } else {
        const { error } = await scaffaleProdottoImpostaQuantitaScambio(userId, _scaffaleScambioId, prodottoId, quantita);
        if (error) { mostraAvviso('❌ Errore nell\'aggiornare la quantità offerta: ' + error.message); return; }
        _quantitaOfferteScambioSealed[String(prodottoId)] = quantita;
    }

    _aggiornaBottoneScambioSealed(prodottoId);
    if (typeof _sealedDettaglioId !== 'undefined' && _sealedDettaglioId && typeof _sealedRinfrescaDopoModifica === 'function') _sealedRinfrescaDopoModifica();

    if (_scaffaleAttivo && String(_scaffaleAttivo) === String(_scaffaleScambioId)) {
        const scaffale = _scaffaliElenco.find(s => String(s.id) === String(_scaffaleAttivo));
        if (scaffale) { await _caricaProdottiScaffaleAttivo(scaffale); renderScaffaleContenuto(); }
    }
}

function _aggiornaBottoneScambioSealed(prodottoId) {
    const btn = document.getElementById('btnOffriScambioSealed');
    if (!btn || String(_sealedInModifica?.id) !== String(prodottoId)) return;
    const quantita = _quantitaOfferteScambioSealed[String(prodottoId)] ?? 0;
    btn.innerHTML = quantita > 0
        ? `<i class="fa-solid fa-right-left"></i> In Scambio: ${quantita}`
        : `<i class="fa-solid fa-right-left"></i> Offri in Scambio`;
}
