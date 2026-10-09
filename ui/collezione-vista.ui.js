// ── ui/collezione-vista.ui.js ────────────────────────────────────────────
// RESTYLE BINDEX — pagina Collezione (tavole OK-vis_lista-l, OK-vis_griglia-l,
// PC-coll-l, PC-coll-griglia, PC-coll-tutti-l). Vale SOLO per la tab
// 'visualizzazione': Scambio/Wishlist/Sealed, che condividono la stessa
// sezione, restano col render di sempre (renderViewTable in ui/cards.ui.js).
//
// Gancio unico: in testa a renderViewTable(), se currentMode è
// 'visualizzazione', si chiama collezioneRender(data) e si esce.
// Il filtro (ricerca, location, lingua, tipi) resta quello di filterTable():
// i comandi nuovi scrivono nei campi vecchi (#searchInput, #filterLocation,
// #filterLang) e richiamano filterTable(). Nessuna chiamata a Supabase qui:
// le modifiche passano dalle funzioni esistenti (modificaCampoInline,
// modificaLocationInline, apriModificaCarta, eliminaCarta...).
//
// Regole: la miniatura (con la lente) apre SEMPRE la carta a tutto schermo;
// in griglia si apre toccando la carta. Telefono: tocco sulla riga = azioni
// sotto la riga. PC: clic sulla riga = pannello dettagli a destra.

let _collVista = 'lista';
try { if (localStorage.getItem('bindex_coll_vista') === 'griglia') _collVista = 'griglia'; } catch (_) { /* niente */ }
let _collSelId = null;          // riga aperta nel pannello dettagli (PC)
let _collAzioniId = null;       // riga con le azioni aperte (telefono)
let _collOrdine = 'prezzo_giu'; // vedi _COLL_ORDINI
let _collUltimiDati = [];

const _COLL_ORDINI = {
    prezzo_giu: { etichetta: 'prezzo ↓', chiave: c => Number(c.price) || 0, giu: true },
    prezzo_su: { etichetta: 'prezzo ↑', chiave: c => Number(c.price) || 0, giu: false },
    nome: { etichetta: 'nome A-Z', chiave: c => String(c.name || '').toLowerCase(), giu: false },
    recenti: { etichetta: 'più recenti', chiave: c => String(c.createdAt || ''), giu: true },
    variazione: { etichetta: 'variazione ↓', chiave: c => Number(c.variazioneNumerica) || 0, giu: true },
    location: { etichetta: 'location', chiave: c => String(c.location || '').toLowerCase(), giu: false },
    qty: { etichetta: 'quantità ↓', chiave: c => Number(c.qty) || 0, giu: true },
};
const _COLL_CICLO = ['prezzo_giu', 'prezzo_su', 'nome', 'recenti'];

function _collEPC() {
    const s = document.getElementById('visualizzazione');
    return !!s && s.clientWidth >= 780;
}

function _collOrdina(data) {
    const o = _COLL_ORDINI[_collOrdine] || _COLL_ORDINI.prezzo_giu;
    return data.slice().sort((a, b) => {
        const va = o.chiave(a), vb = o.chiave(b);
        if (va < vb) return o.giu ? 1 : -1;
        if (va > vb) return o.giu ? -1 : 1;
        return 0;
    });
}

function collCambiaOrdine() {
    const i = _COLL_CICLO.indexOf(_collOrdine);
    _collOrdine = _COLL_CICLO[(i + 1) % _COLL_CICLO.length];
    filterTable();
}

// Intestazioni della tabella PC: clic = ordina per quella colonna
// (secondo clic sulla stessa colonna inverte prezzo).
function collOrdinaColonna(chiave) {
    if (chiave === 'prezzo') _collOrdine = _collOrdine === 'prezzo_giu' ? 'prezzo_su' : 'prezzo_giu';
    else _collOrdine = chiave;
    filterTable();
}

function collImpostaVista(v) {
    _collVista = v === 'griglia' ? 'griglia' : 'lista';
    try { localStorage.setItem('bindex_coll_vista', _collVista); } catch (_) { /* niente */ }
    filterTable();
}

function collCerca(valore) {
    const vecchio = document.getElementById('searchInput');
    if (vecchio) vecchio.value = valore;
    filterTable();
}

function collToggleTipo(tipo) {
    toggleFiltroTipo(tipo); // aggiorna _filtriTipo, i bottoni vecchi e rifà il filtro
}

// Pannello "Filtri": copia le opzioni dalle tendine vecchie (che restano la
// fonte letta da filterTable) e ne rispecchia il valore.
function collApriFiltri() {
    const box = document.getElementById('collFiltri');
    if (!box) return;
    const aperto = box.style.display !== 'none';
    if (aperto) { box.style.display = 'none'; return; }
    [['filterLocation', 'collFiltroLoc'], ['filterLang', 'collFiltroLang']].forEach(([da, a]) => {
        const s1 = document.getElementById(da), s2 = document.getElementById(a);
        if (!s1 || !s2) return;
        s2.innerHTML = s1.innerHTML;
        s2.value = s1.value;
    });
    box.style.display = '';
}

function collCambiaFiltro(idVecchio, valore) {
    const s = document.getElementById(idVecchio);
    if (s) s.value = valore;
    filterTable();
}

function collAzzeraFiltri() {
    ['filterLocation', 'filterLang', 'collFiltroLoc', 'collFiltroLang'].forEach(id => {
        const s = document.getElementById(id); if (s) s.value = '';
    });
    filterTable();
}

// ── helper di riga ──────────────────────────────────────────────────────
function _collAttr(v) { return escapeJsAttr(String(v == null ? '' : v)); }

// 2026-10-09: i prodotti sealed vivono in prodotti_sealed (non in carteReali).
// Per mostrarli in Collezione si costruiscono righe "finte" con tabella
// 'sealed', SOLO per la vista (carteReali non viene toccato, quindi statistiche,
// Binder, Doppioni ecc. restano come prima). Azioni limitate: Modifica
// (modale sealed), Cardmarket, Elimina.
function _collRigheSealed() {
    if (typeof prodottiSealedReali === 'undefined' || !Array.isArray(prodottiSealedReali)) return [];
    return prodottiSealedReali.map(p => ({
        id: p.id, tabella: 'sealed', stato: 'collezione', tipo: 'sealed',
        name: p.name || '', code: p.codice || '', location: '', qty: p.qty || 1,
        lang: p.lingua || 'IT', cond: '', price: Number(p.price) || 0, variation: '—',
        link: p.url || '#', notes: p.note || '', immagine: p.immagine || null,
    }));
}
function _collEdSealed(card) { return card && card.tabella === 'sealed'; }

function _collMiniatura(card, classe) {
    const id = _collAttr(card.id);
    const src = _urlImmagineVisualizzabile(card.immagine);
    const segnaposto = card.tipo === 'sealed' ? 'fa-box' : 'fa-clone';
    const apri = _collEdSealed(card) ? `apriModificaSealed('${id}')` : `apriImmagineIngrandita('${id}')`;
    return `<button type="button" class="${classe}" onclick="event.stopPropagation(); ${apri}" aria-label="Apri la carta a tutto schermo">
        ${src ? `<img src="${src}" alt="" loading="lazy" onerror="this.remove()">` : ''}
        <i class="fa-solid ${segnaposto} coll-segnaposto"></i>
        <span class="coll-lente"><i class="fa-solid fa-magnifying-glass-plus"></i></span></button>`;
}

function _collVarHtml(card) {
    if (card.tabella === 'wishlist') {
        return card.prezzoObiettivo != null ? `<span class="coll-obiettivo">obiettivo ${formattaEuro(card.prezzoObiettivo)}</span>` : '';
    }
    const v = String(card.variation || '');
    if (v.includes('▲')) return `<span class="coll-var su">${escapeHtml(v)}</span>`;
    if (v.includes('▼')) return `<span class="coll-var giu">${escapeHtml(v)}</span>`;
    return `<span class="coll-var">—</span>`;
}

function _collChip(card) {
    if (card.tabella === 'wishlist') return '<span class="coll-chip wish">Wishlist</span>';
    if (_collEdSealed(card)) return '<span class="coll-chip">Sealed</span>';
    return `<span class="coll-chip">${escapeHtml(card.location || '—')}</span>`;
}

function _collMeta(card, conQta) {
    const parti = [card.code || null];
    if (card.tipo === 'sealed') parti.push('Sealed');
    else { parti.push(card.lang || null, card.cond || null); }
    if (conQta && Number(card.qty) > 1) parti.push('x' + card.qty);
    return parti.filter(Boolean).join(' · ');
}

function _collAzioniHtml(card) {
    const id = _collAttr(card.id), nome = _collAttr(card.name);
    if (_collEdSealed(card)) {
        return `
        <button type="button" onclick="event.stopPropagation(); apriModificaSealed('${id}')"><i class="fa-solid fa-pen"></i> Modifica</button>
        ${card.link && card.link !== '#' ? `<a href="${escapeHtml(card.link)}" target="_blank" rel="noopener" onclick="event.stopPropagation()"><i class="fa-solid fa-arrow-up-right-from-square"></i> Cardmarket</a>` : ''}
        <button type="button" class="coll-elimina" onclick="event.stopPropagation(); collEliminaSealed('${id}')"><i class="fa-solid fa-trash"></i> Elimina</button>`;
    }
    const inCollezione = card.tabella === 'carte' && card.stato === 'collezione';
    return `
        <button type="button" onclick="event.stopPropagation(); apriImmagineIngrandita('${id}')"><i class="fa-solid fa-expand"></i> Apri carta</button>
        <button type="button" onclick="event.stopPropagation(); apriModificaCarta('${id}')"><i class="fa-solid fa-pen"></i> Modifica</button>
        ${card.tabella === 'wishlist' ? `<button type="button" onclick="event.stopPropagation(); segnaOttenuta('${id}')"><i class="fa-solid fa-check"></i> Ottenuta</button>` : ''}
        ${inCollezione ? `<button type="button" class="btn-binder-toggle" data-id="${id}" onclick="event.stopPropagation(); toggleBinderMembership('${id}')"><i class="fa-solid fa-layer-group"></i> ${_idsNelBinder.has(String(card.id)) ? 'Rimuovi dal Binder' : 'Aggiungi al Binder'}</button>` : ''}
        ${inCollezione ? `<button type="button" class="btn-scambio-toggle" data-id="${id}" onclick="event.stopPropagation(); apriModaleQuantitaScambio('${id}')"><i class="fa-solid fa-right-left"></i> ${_idsInScambio.has(String(card.id)) ? `In Scambio: ${_quantitaOfferteScambio[String(card.id)] ?? 0}` : 'Offri in Scambio'}</button>` : ''}
        <button type="button" onclick="event.stopPropagation(); apriGraficoPrezzo('${id}', '${card.tabella}', '${nome}')"><i class="fa-solid fa-chart-line"></i> Andamento</button>
        ${inCollezione ? `<button type="button" onclick="event.stopPropagation(); fotoApriCarta('${id}')"><i class="fa-solid fa-camera"></i> Foto reali</button>` : ''}
        ${card.link && card.link !== '#' ? `<a href="${escapeHtml(card.link)}" target="_blank" rel="noopener" onclick="event.stopPropagation()"><i class="fa-solid fa-arrow-up-right-from-square"></i> Cardmarket</a>` : ''}
        <button type="button" class="coll-elimina" onclick="event.stopPropagation(); eliminaCarta('${id}')"><i class="fa-solid fa-trash"></i> Elimina</button>`;
}

async function collEliminaSealed(id) {
    await eliminaSealed(id);
    await caricaProdottiSealedReali();
    filterTable();
}

// ── TELEFONO: lista ─────────────────────────────────────────────────────
function _collListaTelefono(data) {
    if (!data.length) return '<p class="coll-vuoto">Nessun oggetto trovato.</p>';
    return data.map(card => {
        const id = _collAttr(card.id);
        const aperta = String(_collAzioniId) === String(card.id);
        return `<div class="coll-riga${aperta ? ' aperta' : ''}${card.tabella === 'wishlist' ? ' e-wish' : ''}" onclick="collToccaRiga('${id}')">
            <div class="coll-riga-top">
                ${_collMiniatura(card, 'coll-mini')}
                <div class="coll-riga-testo">
                    <div class="coll-nome">${escapeHtml(card.name || '(senza nome)')}</div>
                    <div class="coll-meta">${escapeHtml(_collMeta(card, true))}</div>
                </div>
                ${_collChip(card)}
                <div class="coll-prezzo">
                    <div id="prezzoCellaCompatta-${escapeHtml(String(card.id))}">${formattaEuro(card.price)}</div>
                    ${_collVarHtml(card)}
                </div>
            </div>
            ${aperta ? `<div class="coll-azioni" onclick="event.stopPropagation()">${_collAzioniHtml(card)}</div>` : ''}
        </div>`;
    }).join('');
}

function collToccaRiga(id) {
    if (_collEPC()) { _collSelId = String(_collSelId) === String(id) ? null : id; }
    else { _collAzioniId = String(_collAzioniId) === String(id) ? null : id; }
    collezioneRender(_collUltimiDati);
}

// ── GRIGLIA (telefono e PC) ─────────────────────────────────────────────
function _collGriglia(data) {
    if (!data.length) return '<p class="coll-vuoto">Nessun oggetto trovato.</p>';
    return `<div class="coll-griglia">${data.map(card => {
        const id = _collAttr(card.id);
        const src = _urlImmagineVisualizzabile(card.immagine);
        return `<button type="button" class="coll-tessera${card.tipo === 'sealed' ? ' e-sealed' : ''}${card.tabella === 'wishlist' ? ' e-wish' : ''}" onclick="${_collEdSealed(card) ? `apriModificaSealed('${id}')` : `apriImmagineIngrandita('${id}')`}">
            <span class="coll-tessera-img">${src ? `<img src="${src}" alt="" loading="lazy" onerror="this.remove()">` : ''}<i class="fa-solid ${card.tipo === 'sealed' ? 'fa-box' : 'fa-clone'} coll-segnaposto"></i></span>
            <span class="coll-tessera-nome">${escapeHtml(card.name || '(senza nome)')}</span>
            <span class="coll-tessera-sotto"><span>${card.tabella === 'wishlist' ? 'Wishlist' : (_collEdSealed(card) ? 'Sealed' : escapeHtml(card.location || '—'))}</span><b>${formattaEuro(card.price)}</b></span>
        </button>`;
    }).join('')}</div>`;
}

// ── PC: tabella + pannello dettagli ─────────────────────────────────────
function _collTh(etichetta, chiave, classe) {
    const attiva = chiave && (_collOrdine === chiave || (chiave === 'prezzo' && _collOrdine.startsWith('prezzo')));
    const freccia = !chiave ? '' : (attiva ? (chiave === 'prezzo' && _collOrdine === 'prezzo_su' ? ' ↑' : ' ↓') : ' <span class="coll-th-pigro">↕</span>');
    return `<th class="${classe || ''}${attiva ? ' attiva' : ''}"${chiave ? ` onclick="collOrdinaColonna('${chiave}')"` : ''}>${etichetta}${freccia}</th>`;
}

function _collTabellaPC(data) {
    const righe = data.map(card => {
        const id = _collAttr(card.id);
        const sel = String(_collSelId) === String(card.id);
        const wish = card.tabella === 'wishlist';
        return `<tr class="${sel ? 'sel' : ''}${wish ? ' e-wish' : ''}" onclick="collToccaRiga('${id}')">
            <td class="coll-td-check">${_collEdSealed(card) ? '' : `<input type="checkbox" class="riga-checkbox" data-id="${escapeHtml(String(card.id))}" data-tabella="${card.tabella}" onclick="event.stopPropagation(); aggiornaSelezioneMultipla();">`}</td>
            <td><div class="coll-td-carta">${_collMiniatura(card, 'coll-mini piccola')}<div><div class="coll-nome">${escapeHtml(card.name || '(senza nome)')}</div><div class="coll-meta">${escapeHtml([card.code, card.tipo === 'sealed' ? 'Sealed' : null].filter(Boolean).join(' · '))}</div></div></div></td>
            <td>${_collChip(card)}</td>
            <td>${escapeHtml(card.lang || '—')}</td>
            <td>${card.tipo === 'sealed' ? '—' : escapeHtml(card.cond || '—')}</td>
            <td class="num">${wish ? '—' : (Number(card.qty) || 0)}</td>
            <td class="num forte" id="prezzoCella-${escapeHtml(String(card.id))}">${formattaEuro(card.price)}</td>
            <td class="num">${_collVarHtml(card)}</td>
            <td class="coll-td-nota">${card.notes ? `<i class="fa-solid fa-note-sticky" title="${escapeHtml(card.notes)}"></i>` : '<i class="fa-regular fa-note-sticky vuota"></i>'}</td>
            <td class="coll-td-menu"><i class="fa-solid fa-ellipsis"></i></td>
        </tr>`;
    }).join('');
    return `<div class="coll-pc">
        <div class="coll-tabella-box"><table class="coll-tabella">
            <thead><tr>
                <th class="coll-td-check"><input type="checkbox" onchange="toggleSelezionaTutte(this.checked)" title="Seleziona tutte (quelle filtrate)"></th>
                ${_collTh('Carta', 'nome')}${_collTh('Location', 'location')}${_collTh('Lingua')}${_collTh('Cond.')}
                ${_collTh('Q.tà', 'qty', 'num')}${_collTh('Prezzo', 'prezzo', 'num')}${_collTh('Var.', 'variazione', 'num')}${_collTh('Note')}<th></th>
            </tr></thead>
            <tbody>${righe || '<tr><td colspan="10" class="coll-vuoto">Nessun oggetto trovato.</td></tr>'}</tbody>
        </table></div>
        <aside class="coll-dettaglio" id="collDettaglio">${_collDettaglioHtml(data)}</aside>
    </div>`;
}

function _collDettaglioHtml(data) {
    const card = _collSelId != null ? data.find(c => String(c.id) === String(_collSelId)) : null;
    if (!card) {
        return `<div class="coll-dettaglio-vuoto"><i class="fa-regular fa-hand-pointer"></i>
            <b>Clicca una riga per vedere i dettagli</b><span>Clicca la miniatura per aprire la carta intera</span></div>`;
    }
    const id = _collAttr(card.id), t = card.tabella;
    const src = _urlImmagineVisualizzabile(card.immagine);
    const campo = (etichetta, valore, azione) => `<div class="coll-campo${azione ? ' editabile' : ''}"${azione ? ` onclick="${azione}" title="Clicca per modificare"` : ''}><span>${etichetta}</span><b>${valore}</b></div>`;
    const wish = t === 'wishlist';
    if (_collEdSealed(card)) {
        return `
        <button type="button" class="coll-dett-img" onclick="apriModificaSealed('${id}')" aria-label="Apri il prodotto">
            ${src ? `<img src="${src}" alt="" onerror="this.remove()">` : ''}<i class="fa-solid fa-box coll-segnaposto"></i></button>
        <div class="coll-dett-nome">${escapeHtml(card.name || '(senza nome)')}</div>
        <div class="coll-meta">Sealed</div>
        <div class="coll-dett-prezzo"><span>${formattaEuro(card.price)}</span></div>
        <div class="coll-campi">
            ${campo('Lingua', escapeHtml(card.lang || '—'))}
            ${campo('Quantità', Number(card.qty) || 0)}
            ${campo('Prezzo', formattaEuro(card.price))}
        </div>
        <div class="coll-campo coll-note"><span>Note</span><b>${card.notes ? escapeHtml(card.notes) : '—'}</b></div>
        <div class="coll-azioni coll-azioni-pc">${_collAzioniHtml(card)}</div>`;
    }
    return `
        <button type="button" class="coll-dett-img" onclick="apriImmagineIngrandita('${id}')" aria-label="Apri la carta a tutto schermo">
            ${src ? `<img src="${src}" alt="" onerror="this.remove()">` : ''}<i class="fa-solid ${card.tipo === 'sealed' ? 'fa-box' : 'fa-clone'} coll-segnaposto"></i>
            <span class="coll-lente"><i class="fa-solid fa-magnifying-glass-plus"></i></span></button>
        <div class="coll-dett-nome">${escapeHtml(card.name || '(senza nome)')}</div>
        <div class="coll-meta">${escapeHtml(_collMeta(card, false))}</div>
        <div class="coll-dett-prezzo"><span>${formattaEuro(card.price)}</span>${_collVarHtml(card)}</div>
        <div class="coll-campi">
            ${wish ? campo('Location', 'Wishlist') : campo('Location', escapeHtml(card.location || '—'), `modificaLocationInline(event, '${id}', '${t}', '${_collAttr(card.location)}')`)}
            ${campo('Lingua', escapeHtml(card.lang || 'Qualsiasi'), `modificaLinguaInline(event, '${id}', '${t}', '${_collAttr(card.lang)}')`)}
            ${card.tipo === 'sealed' ? '' : campo('Condizione', escapeHtml(card.cond || '—'), `modificaCondizioneInline(event, '${id}', '${t}', '${_collAttr(card.cond)}')`)}
            ${wish ? '' : campo('Quantità', Number(card.qty) || 0, `modificaCampoInline('${id}', '${t}', 'qty', ${Number(card.qty) || 0}, 'Quantità', 'intero')`)}
            ${campo('Prezzo', formattaEuro(card.price), `modificaCampoInline('${id}', '${t}', 'prezzo', ${Number(card.price) || 0}, 'Prezzo (€)', 'numero')`)}
            ${campo('Codice', escapeHtml(card.code || '—'), `modificaCampoInline('${id}', '${t}', 'codice', '${_collAttr(card.code)}', 'Codice')`)}
        </div>
        <div class="coll-campo coll-note editabile" onclick="modificaCampoInline('${id}', '${t}', 'note', '${_collAttr(card.notes)}', 'Note', 'facoltativo')" title="Clicca per modificare">
            <span>Note</span><b>${card.notes ? escapeHtml(card.notes) : '—'}</b></div>
        <div class="coll-azioni coll-azioni-pc">${_collAzioniHtml(card)}</div>`;
}

// ── testata: conteggi e bottoni ─────────────────────────────────────────
function _collAggiornaTesta(data) {
    let oggetti = 0, valore = 0;
    const location = new Set();
    data.forEach(c => {
        if (c.tabella === 'wishlist') return; // la wishlist non entra nel valore
        const q = Number(c.qty) || 0;
        oggetti += q; valore += (Number(c.price) || 0) * q;
        if (c.location) location.add(c.location);
    });
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('collNumOggetti', oggetti.toLocaleString('it-IT'));
    set('collNumValore', formattaEuro(valore));
    set('collNumLocation', location.size);
    // Le statistiche vecchie restano allineate (qualcuno potrebbe leggerle).
    set('stat-count', oggetti); set('stat-value', formattaEuro(valore)); set('stat-locations', location.size);
    const nota = document.getElementById('collNotaWishlist');
    if (nota) nota.style.display = _filtriTipo.wishlist ? '' : 'none';
    ['carte', 'sealed', 'wishlist'].forEach(t => {
        document.querySelectorAll(`.coll-tipo[data-tipo="${t}"]`).forEach(b => b.classList.toggle('attivo', !!_filtriTipo[t]));
    });
    document.querySelectorAll('.coll-vista-btn').forEach(b => b.classList.toggle('attivo', b.dataset.vista === _collVista));
    const ord = document.getElementById('collOrdineTesto');
    if (ord) ord.textContent = (_COLL_ORDINI[_collOrdine] || _COLL_ORDINI.prezzo_giu).etichetta;
    const loc = document.getElementById('filterLocation'), lang = document.getElementById('filterLang');
    const nFiltri = (loc && loc.value ? 1 : 0) + (lang && lang.value ? 1 : 0);
    const bf = document.getElementById('collNumFiltri');
    if (bf) { bf.textContent = nFiltri; bf.style.display = nFiltri ? '' : 'none'; }
    const cerca = document.getElementById('collCercaInput'), vecchio = document.getElementById('searchInput');
    if (cerca && vecchio && document.activeElement !== cerca && cerca.value !== vecchio.value) cerca.value = vecchio.value;
    // Copie degli stessi numeri (versione telefono / versione PC).
    document.querySelectorAll('#collTesta [data-specchio]').forEach(el => {
        const src = document.getElementById(el.dataset.specchio);
        if (!src) return;
        el.textContent = src.textContent;
        if (src.style.display === 'none' && src.id === 'collNumFiltri') el.style.display = 'none';
        else if (src.id === 'collNumFiltri') el.style.display = '';
    });
}

// ── punto d'ingresso, chiamato da renderViewTable ───────────────────────
function collezioneRender(data) {
    _collUltimiDati = data;
    document.body.classList.add('coll-attiva');
    const pannelloTabella = document.getElementById('pannelloTabella');
    const compatto = document.getElementById('viewCardsCompact');
    if (pannelloTabella) pannelloTabella.style.display = 'none';
    if (compatto) { compatto.style.display = 'none'; compatto.innerHTML = ''; }
    const tbody = document.getElementById('viewTableBody');
    if (tbody) tbody.innerHTML = ''; // niente checkbox doppie nella tabella vecchia nascosta

    const ordinati = _collOrdina(data);
    const pc = _collEPC();
    _collUltimoPC = pc;
    const corpo = document.getElementById('collCorpo');
    if (corpo) {
        corpo.innerHTML = _collVista === 'griglia' ? _collGriglia(ordinati)
            : (pc ? _collTabellaPC(ordinati) : _collListaTelefono(ordinati));
    }
    document.body.classList.toggle('coll-griglia-attiva', _collVista === 'griglia');
    _collAggiornaTesta(data);
    _aggiornaBarraSelezioneMultipla();
}

// La sezione viene disegnata mentre il pannello è ancora nascosto (larghezza
// 0 = "telefono"): appena il pannello è visibile si rifà il render se la
// misura vera dice PC. Chiamata da apriDettaglioWidget.
let _collUltimoPC = null;
function collezioneRiallinea() {
    if (!_collUltimiDati || !document.body.classList.contains('coll-attiva')) return;
    if (_collEPC() !== _collUltimoPC) collezioneRender(_collUltimiDati);
}

// Uscendo dalla tab Collezione la classe va tolta, altrimenti le altre tab
// (stessa sezione) resterebbero con i comandi vecchi nascosti.
function collezioneDisattiva() {
    document.body.classList.remove('coll-attiva', 'coll-griglia-attiva');
    const corpo = document.getElementById('collCorpo');
    if (corpo) corpo.innerHTML = '';
}

// Telefono ↔ PC (rotazione, finestra ridimensionata): rifà il render.
(function () {
    let t = null, eraPC = null;
    window.addEventListener('resize', () => {
        clearTimeout(t);
        t = setTimeout(() => {
            if (typeof currentMode === 'undefined' || currentMode !== 'visualizzazione') return;
            const s = document.getElementById('visualizzazione');
            if (!s || !s.classList.contains('active')) return;
            const ora = _collEPC();
            if (ora !== eraPC) { eraPC = ora; filterTable(); }
        }, 200);
    });
})();
