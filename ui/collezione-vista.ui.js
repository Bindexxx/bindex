// Pagina Collezione (scheda visualizzazione): lista, griglia, tabella su PC.

let _collVista = 'lista';
try { if (localStorage.getItem('bindex_coll_vista') === 'griglia') _collVista = 'griglia'; } catch (_) {   }
let _collSelId = null;
let _collAzioniId = null;
let _collOrdine = 'prezzo_giu';
let _collUltimiDati = [];
const _collSelTel = new Map();
let _collPressioneLunga = false;

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
_collOrdine = prefFiltroPaginaScegli('collezione', 'ordine', Object.keys(_COLL_ORDINI), _collOrdine);
(function _collRipristinaFiltri() {
    const lang = document.getElementById('filterLang');
    const l = prefFiltroPaginaGet('collezione', 'lingua');
    if (lang && l && [...lang.options].some(o => o.value === l)) lang.value = l;
    ['carte', 'sealed', 'wishlist'].forEach(tipo => {
        const v = prefFiltroPaginaGet('collezione', 'tipo_' + tipo);
        if (typeof v !== 'boolean' || typeof _filtriTipo === 'undefined') return;
        _filtriTipo[tipo] = v;
        document.getElementById('toggleTipo' + tipo.charAt(0).toUpperCase() + tipo.slice(1))?.classList.toggle('active', v);
    });
})();
function collRipristinaLocation() {
    const s = document.getElementById('filterLocation');
    const salvata = prefFiltroPaginaGet('collezione', 'location');
    if (!s || !salvata || s.value || ![...s.options].some(o => o.value === salvata)) return false;
    s.value = salvata;
    return true;
}
function _collSalvaFiltri() {
    const loc = document.getElementById('filterLocation'), lang = document.getElementById('filterLang');
    prefFiltroPaginaSet('collezione', 'location', loc ? loc.value : '');
    prefFiltroPaginaSet('collezione', 'lingua', lang ? lang.value : '');
}

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
    prefFiltroPaginaSet('collezione', 'ordine', _collOrdine);
    filterTable();
}

function collOrdinaColonna(chiave) {
    if (chiave === 'prezzo') _collOrdine = _collOrdine === 'prezzo_giu' ? 'prezzo_su' : 'prezzo_giu';
    else _collOrdine = chiave;
    prefFiltroPaginaSet('collezione', 'ordine', _collOrdine);
    filterTable();
}

function collImpostaVista(v) {
    _collVista = v === 'griglia' ? 'griglia' : 'lista';
    try { localStorage.setItem('bindex_coll_vista', _collVista); } catch (_) {   }
    filterTable();
}

function collCerca(valore) {
    const vecchio = document.getElementById('searchInput');
    if (vecchio) vecchio.value = valore;
    filterTable();
}

function collToggleTipo(tipo) {
    toggleFiltroTipo(tipo);
}

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
    _collSalvaFiltri();
    filterTable();
}

function collAzzeraFiltri() {
    ['filterLocation', 'filterLang', 'collFiltroLoc', 'collFiltroLang'].forEach(id => {
        const s = document.getElementById(id); if (s) s.value = '';
    });
    _collSalvaFiltri();
    filterTable();
}

function _collAttr(v) { return escapeJsAttr(String(v == null ? '' : v)); }

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
    return `<button type="button" class="${classe}" onclick="event.stopPropagation(); if (_collToccoSelezione('${id}')) return; ${apri}" aria-label="Apri la carta a tutto schermo">
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
        ${urlEsternoSicuro(card.link) ? `<a href="${urlEsternoSicuro(card.link)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()"><i class="fa-solid fa-arrow-up-right-from-square"></i> Cardmarket</a>` : ''}
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
        ${urlEsternoSicuro(card.link) ? `<a href="${urlEsternoSicuro(card.link)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()"><i class="fa-solid fa-arrow-up-right-from-square"></i> Cardmarket</a>` : ''}
        <button type="button" class="coll-elimina" onclick="event.stopPropagation(); eliminaCarta('${id}')"><i class="fa-solid fa-trash"></i> Elimina</button>`;
}

async function collEliminaSealed(id) {
    await eliminaSealed(id);
    await caricaProdottiSealedReali();
    filterTable();
}

function _collPillVarianti(link) {
    if (!link || link === '#') return '';
    let p;
    try { p = new URL(link).searchParams; } catch (_) { return ''; }
    const v = [];
    if (p.get('isReverseHolo') === 'Y') v.push(['RH', 'Reverse holo']);
    if (p.get('isFirstEd') === 'Y') v.push(['1ª ed.', 'Prima edizione']);
    return v.map(([t, tit]) => ` <span title="${tit}" style="display:inline-block; font-size:0.68em; font-weight:800; line-height:1; padding:0.2em 0.45em; border-radius:6px; vertical-align:0.15em; background:var(--primary-light); color:var(--primary-text, var(--primary)); white-space:nowrap;">${t}</span>`).join('');
}

function _collRigaTelefonoHtml(card) {
    const id = _collAttr(card.id);
    const aperta = String(_collAzioniId) === String(card.id) && !_collInSelezione();
    return `<div class="coll-riga${aperta ? ' aperta' : ''}${card.tabella === 'wishlist' ? ' e-wish' : ''}${_collSelTel.has(String(card.id)) ? ' scelta' : ''}" data-coll-id="${escapeHtml(String(card.id))}" onclick="collToccaRiga('${id}')">
            ${_collCheckTel(card)}
            <div class="coll-riga-top">
                ${_collMiniatura(card, 'coll-mini')}
                <div class="coll-riga-testo">
                    <div class="coll-nome">${escapeHtml(card.name || '(senza nome)')}${_collPillVarianti(card.link)}</div>
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
}

function _collListaTelefono(data) {
    if (!data.length) return '<p class="coll-vuoto">Nessun oggetto trovato.</p>';
    return data.map(_collRigaTelefonoHtml).join('');
}

function _collRigaDom(corpo, id) {
    if (id == null) return null;
    const sel = '[data-coll-id="' + (window.CSS && CSS.escape ? CSS.escape(String(id)) : String(id).replace(/"/g, '\\"')) + '"]';
    return corpo.querySelector(sel);
}

function _collAggiornaRigheTelefono(corpo, primaAperta) {
    const vecchia = _collRigaDom(corpo, primaAperta);
    const nuova = _collRigaDom(corpo, _collAzioniId);
    if ((primaAperta != null && !vecchia) || (_collAzioniId != null && !nuova)) return false;
    if (vecchia) {
        vecchia.classList.remove('aperta');
        const az = vecchia.querySelector(':scope > .coll-azioni');
        if (az) az.remove();
    }
    if (nuova) {
        const card = _collUltimiDati.find(c => String(c.id) === String(_collAzioniId));
        if (!card) return false;
        nuova.classList.add('aperta');
        nuova.insertAdjacentHTML('beforeend', `<div class="coll-azioni" onclick="event.stopPropagation()">${_collAzioniHtml(card)}</div>`);
    }
    return true;
}

function _collAggiornaSelezionePC(corpo, primaSel) {
    const dettaglio = document.getElementById('collDettaglio');
    const vecchia = _collRigaDom(corpo, primaSel);
    const nuova = _collRigaDom(corpo, _collSelId);
    if (!dettaglio || (primaSel != null && !vecchia) || (_collSelId != null && !nuova)) return false;
    if (vecchia) vecchia.classList.remove('sel');
    if (nuova) nuova.classList.add('sel');
    dettaglio.innerHTML = _collDettaglioHtml(_collUltimiDati);
    return true;
}

function _collCheckTel(card) {
    if (_collEdSealed(card)) return '';
    const sc = _collSelTel.has(String(card.id));
    return `<input type="checkbox" class="riga-checkbox coll-check-tel" tabindex="-1" aria-hidden="true" data-id="${escapeHtml(String(card.id))}" data-tabella="${card.tabella}"${sc ? ' checked' : ''}><span class="coll-sel-segno" aria-hidden="true"><i class="fa-solid fa-check"></i></span>`;
}

function _collInSelezione() {
    return _collSelTel.size > 0 && !_collEPC();
}

function _collToccoSelezione(id) {
    if (_collPressioneLunga) { _collPressioneLunga = false; return true; }
    if (!_collInSelezione()) return false;
    collCambiaSelezioneTel(id);
    return true;
}

function collCambiaSelezioneTel(id) {
    const chiave = String(id);
    const card = (_collUltimiDati || []).find(c => String(c.id) === chiave);
    if (!card || _collEdSealed(card)) return;
    if (_collSelTel.has(chiave)) _collSelTel.delete(chiave); else _collSelTel.set(chiave, card.tabella);
    if (_collSelTel.size && _collAzioniId != null) {
        const corpo = document.getElementById('collCorpo');
        const prima = _collAzioniId;
        _collAzioniId = null;
        if (corpo) _collAggiornaRigheTelefono(corpo, prima);
    }
    const sel = '[data-coll-id="' + (window.CSS && CSS.escape ? CSS.escape(chiave) : chiave.replace(/"/g, '\\"')) + '"]';
    document.querySelectorAll('#collCorpo ' + sel).forEach(el => {
        el.classList.toggle('scelta', _collSelTel.has(chiave));
        const cb = el.querySelector('.coll-check-tel');
        if (cb) cb.checked = _collSelTel.has(chiave);
    });
    document.body.classList.toggle('coll-selezione', _collSelTel.size > 0);
    _aggiornaBarraSelezioneMultipla();
}

function collSvuotaSelezioneTel() {
    _collSelTel.clear();
    document.body.classList.remove('coll-selezione');
    document.querySelectorAll('#collCorpo .scelta').forEach(el => el.classList.remove('scelta'));
    document.querySelectorAll('#collCorpo .coll-check-tel').forEach(cb => { cb.checked = false; });
}

(function () {
    let timer = null, x0 = 0, y0 = 0;
    const ferma = () => { clearTimeout(timer); timer = null; };
    document.addEventListener('pointerdown', (e) => {
        const el = e.target.closest && e.target.closest('#collCorpo [data-coll-id]');
        if (!el || _collEPC() || (e.button != null && e.button !== 0)) return;
        if (e.target.closest('.coll-azioni')) return;
        x0 = e.clientX; y0 = e.clientY;
        ferma();
        timer = setTimeout(() => {
            timer = null;
            _collPressioneLunga = true;
            setTimeout(() => { _collPressioneLunga = false; }, 800);
            if (navigator.vibrate) { try { navigator.vibrate(15); } catch (_) {   } }
            collCambiaSelezioneTel(el.dataset.collId);
        }, 500);
    }, { passive: true });
    document.addEventListener('pointermove', (e) => { if (timer && (Math.abs(e.clientX - x0) > 10 || Math.abs(e.clientY - y0) > 10)) ferma(); }, { passive: true });
    ['pointerup', 'pointercancel', 'scroll'].forEach(ev => document.addEventListener(ev, ferma, { passive: true, capture: ev === 'scroll' }));
    document.addEventListener('contextmenu', (e) => {
        if (!_collEPC() && e.target.closest && e.target.closest('#collCorpo [data-coll-id]')) e.preventDefault();
    });
})();

function collToccaRiga(id) {
    if (_collToccoSelezione(id)) return;
    const corpo = document.getElementById('collCorpo');
    const parziale = corpo && _collVista !== 'griglia' && !_collRenderInSospeso;
    if (_collEPC()) {
        const prima = _collSelId;
        _collSelId = String(_collSelId) === String(id) ? null : id;
        if (parziale && _collUltimoPC === true && _collAggiornaSelezionePC(corpo, prima)) return;
    } else {
        const prima = _collAzioniId;
        _collAzioniId = String(_collAzioniId) === String(id) ? null : id;
        if (parziale && _collUltimoPC === false && _collAggiornaRigheTelefono(corpo, prima)) return;
    }
    collezioneRender(_collUltimiDati);
}

function collVaiACarta(id) {
    if (_collEPC()) _collSelId = id; else _collAzioniId = id;
    _collUltimaFirma = null;
    collezioneRender(_collUltimiDati);
    const riga = document.querySelector('#collCorpo [data-coll-id="' + String(id).replace(/["\\]/g, '') + '"]');
    if (riga) riga.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function _collTesseraHtml(card) {
    const id = _collAttr(card.id);
    const src = _urlImmagineVisualizzabile(card.immagine);
    return `<button type="button" class="coll-tessera${card.tipo === 'sealed' ? ' e-sealed' : ''}${card.tabella === 'wishlist' ? ' e-wish' : ''}${_collSelTel.has(String(card.id)) ? ' scelta' : ''}" data-coll-id="${escapeHtml(String(card.id))}" onclick="if (_collToccoSelezione('${id}')) return; ${_collEdSealed(card) ? `apriModificaSealed('${id}')` : `apriImmagineIngrandita('${id}')`}">
            ${_collCheckTel(card)}
            <span class="coll-tessera-img">${src ? `<img src="${src}" alt="" loading="lazy" onerror="this.remove()">` : ''}<i class="fa-solid ${card.tipo === 'sealed' ? 'fa-box' : 'fa-clone'} coll-segnaposto"></i></span>
            <span class="coll-tessera-nome">${escapeHtml(card.name || '(senza nome)')}${_collPillVarianti(card.link)}</span>
            <span class="coll-tessera-sotto"><span>${card.tabella === 'wishlist' ? 'Wishlist' : (_collEdSealed(card) ? 'Sealed' : escapeHtml(card.location || '—'))}</span><b>${formattaEuro(card.price)}</b></span>
        </button>`;
}

function _collGriglia(data) {
    if (!data.length) return '<p class="coll-vuoto">Nessun oggetto trovato.</p>';
    return `<div class="coll-griglia">${data.map(_collTesseraHtml).join('')}</div>`;
}

const _COLL_PRIMO_BLOCCO = 80;
const _COLL_BLOCCO = 200;
let _collGiroBlocchi = 0;
let _collTimerBlocchi = null;

function _collFermaBlocchi() {
    _collGiroBlocchi++;
    clearTimeout(_collTimerBlocchi);
    _collTimerBlocchi = null;
}

function _collDisegnaABlocchi(corpo, dati, rigaHtml, apri, chiudi, selContenitore) {
    if (!dati.length) { corpo.innerHTML = '<p class="coll-vuoto">Nessun oggetto trovato.</p>'; return; }
    corpo.innerHTML = apri + dati.slice(0, _COLL_PRIMO_BLOCCO).map(rigaHtml).join('') + chiudi;
    if (dati.length <= _COLL_PRIMO_BLOCCO) return;
    const dentro = selContenitore ? corpo.querySelector(selContenitore) : corpo;
    if (!dentro) return;
    const giro = ++_collGiroBlocchi;
    let i = _COLL_PRIMO_BLOCCO;
    const passo = () => {
        if (giro !== _collGiroBlocchi || !dentro.isConnected) return;
        dentro.insertAdjacentHTML('beforeend', dati.slice(i, i + _COLL_BLOCCO).map(rigaHtml).join(''));
        i += _COLL_BLOCCO;
        _collTimerBlocchi = i < dati.length ? setTimeout(passo, 0) : null;
    };
    _collTimerBlocchi = setTimeout(passo, 0);
}

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
        return `<tr class="${sel ? 'sel' : ''}${wish ? ' e-wish' : ''}" data-coll-id="${escapeHtml(String(card.id))}" onclick="collToccaRiga('${id}')">
            <td class="coll-td-check">${_collEdSealed(card) ? '' : `<input type="checkbox" class="riga-checkbox" data-id="${escapeHtml(String(card.id))}" data-tabella="${card.tabella}" onclick="event.stopPropagation(); aggiornaSelezioneMultipla();">`}</td>
            <td><div class="coll-td-carta">${_collMiniatura(card, 'coll-mini piccola')}<div><div class="coll-nome">${escapeHtml(card.name || '(senza nome)')}${_collPillVarianti(card.link)}</div><div class="coll-meta">${escapeHtml([card.code, card.tipo === 'sealed' ? 'Sealed' : null].filter(Boolean).join(' · '))}</div></div></div></td>
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
        <div class="coll-dett-nome">${escapeHtml(card.name || '(senza nome)')}${_collPillVarianti(card.link)}</div>
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

function _collAggiornaTesta(data) {
    let oggetti = 0, valore = 0;
    const location = new Set();
    data.forEach(c => {
        if (c.tabella === 'wishlist') return;
        const q = Number(c.qty) || 0;
        oggetti += q; valore += (Number(c.price) || 0) * q;
        if (c.location) location.add(c.location);
    });
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('collNumOggetti', oggetti.toLocaleString('it-IT'));
    set('collNumValore', formattaEuro(valore));
    set('collNumLocation', location.size);
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
    document.querySelectorAll('#collTesta [data-specchio]').forEach(el => {
        const src = document.getElementById(el.dataset.specchio);
        if (!src) return;
        el.textContent = src.textContent;
        if (src.style.display === 'none' && src.id === 'collNumFiltri') el.style.display = 'none';
        else if (src.id === 'collNumFiltri') el.style.display = '';
    });
}

let _collRenderInSospeso = false;
let _collUltimaFirma = null;
function _collFirma(data, pc) {
    const statoRiga = id => id == null ? null
        : [_idsNelBinder.has(String(id)), _idsInScambio.has(String(id)), _quantitaOfferteScambio[String(id)] ?? null];
    try {
        return JSON.stringify([_collVista, pc, _collOrdine, _collSelId, _collAzioniId, statoRiga(_collSelId), statoRiga(_collAzioniId), [..._collSelTel.keys()], data]);
    } catch (_) { return null; }
}
function collezioneRender(data) {
    _collUltimiDati = data;
    if (!document.body.classList.contains('phone-detail-open')) { _collRenderInSospeso = true; return; }
    _collRenderInSospeso = false;
    document.body.classList.add('coll-attiva');
    const pannelloTabella = document.getElementById('pannelloTabella');
    const compatto = document.getElementById('viewCardsCompact');
    if (pannelloTabella) pannelloTabella.style.display = 'none';
    if (compatto) { compatto.style.display = 'none'; compatto.innerHTML = ''; }
    const tbody = document.getElementById('viewTableBody');
    if (tbody) tbody.innerHTML = '';

    const pc = _collEPC();
    if (pc && _collSelTel.size) collSvuotaSelezioneTel();
    document.body.classList.toggle('coll-selezione', _collSelTel.size > 0);
    _collUltimoPC = pc;
    const corpo = document.getElementById('collCorpo');
    const firma = _collFirma(data, pc);
    if (corpo && firma !== null && firma === _collUltimaFirma && corpo.firstChild) {
        _collAggiornaTesta(data);
        _aggiornaBarraSelezioneMultipla();
        return;
    }
    _collUltimaFirma = firma;
    const ordinati = _collOrdina(data);
    if (corpo) {
        _collFermaBlocchi();
        if (_collVista === 'griglia') _collDisegnaABlocchi(corpo, ordinati, _collTesseraHtml, '<div class="coll-griglia">', '</div>', '.coll-griglia');
        else if (pc) corpo.innerHTML = _collTabellaPC(ordinati);
        else _collDisegnaABlocchi(corpo, ordinati, _collRigaTelefonoHtml, '', '', null);
    }
    document.body.classList.toggle('coll-griglia-attiva', _collVista === 'griglia');
    _collAggiornaTesta(data);
    _aggiornaBarraSelezioneMultipla();
}

let _collUltimoPC = null;
function collezioneRiallinea() {
    if (_collRenderInSospeso) { collezioneRender(_collUltimiDati); return; }
    if (!_collUltimiDati || !document.body.classList.contains('coll-attiva')) return;
    if (_collEPC() !== _collUltimoPC) collezioneRender(_collUltimiDati);
}

function collezioneDisattiva() {
    _collRenderInSospeso = false;
    _collUltimaFirma = null;
    _collFermaBlocchi();
    document.body.classList.remove('coll-attiva', 'coll-griglia-attiva');
    const corpo = document.getElementById('collCorpo');
    if (corpo) corpo.innerHTML = '';
}

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
