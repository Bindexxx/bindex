// Widget e pagina Match trovati.

CATALOGO_WIDGET.match = {
        titolo: 'Match trovati', icona: 'fa-handshake',
        preview: () => {
            const scambio = typeof _numNuoviMatchScambio !== 'undefined' ? _numNuoviMatchScambio : 0;
            const wishlist = typeof _numNuoviMatchWishlist !== 'undefined' ? _numNuoviMatchWishlist : 0;
            const totale = scambio + wishlist;
            const dati = { scambio, wishlist };
            if (totale === 0) return { righe: [(typeof _matchLetturaFallita !== 'undefined' && _matchLetturaFallita) ? '—' : 'Nessuna novità'], dati };
            return { righe: [`${totale} corrispondenz${totale === 1 ? 'a nuova' : 'e nuove'}`], stato: 'ok', azioni: totale, dati };
        },
        azione: (dati, evt) => { apriDettaglioWidget('match', evt); },
};

let _matchTabAttivo = 'cerchi';
let _matchDati = null;
let _matchPersonaSel = { hai: null, cerchi: null };
let _matchSelezionate = new Set();
let _matchMostraNascoste = false;
let _matchMenuIdx = 0;

function _matchCartaMia(id) {
    return (typeof carteReali !== 'undefined' ? carteReali : []).find(c => String(c.id) === String(id)) || null;
}

async function renderPaginaMatch() {
    const container = document.getElementById('matchLista');
    if (!container) return;
    container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;"><i class="fa-solid fa-spinner fa-spin"></i> Cerco corrispondenze…</p>';
    _matchTabAttivo = 'cerchi';
    _matchPersonaSel = { hai: null, cerchi: null };
    _matchSelezionate = new Set();
    _matchMostraNascoste = false;

    const userId = await authGetUserId();
    if (!userId) { container.innerHTML = ''; return; }

    const [{ data: dataScambio, error: errS }, { data: dataWishlist, error: errW }, { data: dataScambioSealed, error: errSs }, { data: dataWishlistSealed, error: errWs }] = await Promise.all([
        trovaMatch('trova_match_scambio_wishlist', userId),
        trovaMatch('trova_match_wishlist_scambio', userId),
        trovaMatch('trova_match_scambio_wishlist_sealed', userId),
        trovaMatch('trova_match_wishlist_scambio_sealed', userId),
    ]);
    if (errS || errW) {
        container.innerHTML = `<p style="text-align:center; color:var(--danger); font-size:0.85rem; padding:1rem 0;">Errore nella ricerca match: ${escapeHtml((errS || errW).message)}</p>`;
        return;
    }
    if (errSs) console.error('Errore match scambio sealed:', errSs.message);
    if (errWs) console.error('Errore match wishlist sealed:', errWs.message);

    const daCarta = (mioId) => {
        const c = _matchCartaMia(mioId) || {};
        return { nome: c.name || '', code: c.code || '', lang: c.lang || '', cond: c.cond || '', img: c.immagine || null, miaId: c.id || null };
    };
    const righe = [];
    (dataScambio || []).forEach(m => righe.push({
        chiave: `${m.mia_carta_id}_${m.altra_wishlist_id}`, lato: 'hai', tipo: 'carta', ownerAltro: m.altro_owner_id,
        ...daCarta(m.mia_carta_id), nome: m.mio_nome || daCarta(m.mia_carta_id).nome,
        prezzo: Number(m.mio_prezzo) || 0, obiettivo: m.altro_prezzo_obiettivo,
    }));
    (dataWishlist || []).forEach(m => righe.push({
        chiave: `${m.mia_wishlist_id}_${m.altra_carta_id}`, lato: 'cerchi', tipo: 'carta', ownerAltro: m.altro_owner_id,
        ...daCarta(m.mia_wishlist_id), nome: m.mio_nome || daCarta(m.mia_wishlist_id).nome,
        prezzo: Number(m.altro_prezzo) || 0, obiettivo: m.mio_prezzo_obiettivo, oggettoId: m.altra_carta_id,
        disponibili: m.altra_disponibili,
    }));
    (dataScambioSealed || []).forEach(m => righe.push({
        chiave: `s_${m.mio_prodotto_id}_${m.altra_wishlist_sealed_id}`, lato: 'hai', tipo: 'sealed', ownerAltro: m.altro_owner_id,
        nome: m.mio_nome || '', code: '', lang: '', cond: '', img: null,
        prezzo: Number(m.mio_prezzo) || 0, obiettivo: m.altro_prezzo_obiettivo,
    }));
    (dataWishlistSealed || []).forEach(m => righe.push({
        chiave: `s_${m.mia_wishlist_sealed_id}_${m.altro_prodotto_id}`, lato: 'cerchi', tipo: 'sealed', ownerAltro: m.altro_owner_id,
        nome: m.mio_nome || '', code: '', lang: '', cond: '', img: null,
        prezzo: Number(m.altro_prezzo) || 0, obiettivo: m.mio_prezzo_obiettivo, oggettoId: m.altro_prodotto_id,
        disponibili: m.altra_disponibili,
    }));

    const nascosti = await _matchNascostiSet(userId);

    const nicknameMap = {};
    [dataScambio, dataWishlist, dataScambioSealed, dataWishlistSealed].forEach(arr => {
        (arr || []).forEach(m => { if (m.altro_nickname) nicknameMap[m.altro_owner_id] = m.altro_nickname; });
    });
    const idsDistinti = [...new Set(righe.map(r => r.ownerAltro).filter(id => id && !nicknameMap[id]))];
    if (idsDistinti.length > 0) {
        try {
            const { data: nicknamesData, error: errN } = await chatOttieniNicknames(idsDistinti);
            if (errN) console.error('Errore lettura nickname:', errN.message);
            else (nicknamesData || []).forEach(n => { if (n.nickname) nicknameMap[n.owner_id] = n.nickname; });
        } catch (e) { console.error('Errore lettura nickname:', e); }
    }

    const visti = _matchVisti();
    const nuovi = new Set(righe.filter(r => !nascosti.has(r.chiave) && !visti.has(r.chiave)).map(r => r.chiave));
    _matchDati = { righe, nicknameMap, nuovi, nascosti };

    const daSegnare = righe.filter(r => !nascosti.has(r.chiave)).map(r => r.chiave);
    if (daSegnare.length) {
        _segnaMatchVisti(daSegnare);
        if (typeof aggiornaBadgeMatch === 'function') aggiornaBadgeMatch().catch(e => console.error('aggiornaBadgeMatch:', e));
    }

    _matchRenderDaDati();
}

function _matchNomePersona(ownerId) {
    return (_matchDati && _matchDati.nicknameMap[ownerId]) || 'Un utente del gruppo';
}

function _matchEtichetta(r) {
    const ob = r.obiettivo;
    if (r.lato === 'hai') {
        if (ob == null) return { cls: 'bx-stato', testo: 'Senza budget' };
        if (r.prezzo <= Number(ob)) return { cls: 'bx-stato bx-stato-conclusa', testo: 'Nel suo budget' };
        return { cls: 'bx-stato bx-stato-attesa', testo: `${formattaEuro(r.prezzo - Number(ob))} sopra il suo budget` };
    }
    if (ob == null) return null;
    if (r.prezzo <= Number(ob)) return { cls: 'bx-stato bx-stato-conclusa', testo: 'Sotto il tuo obiettivo' };
    return { cls: 'bx-stato bx-stato-attesa', testo: `${formattaEuro(r.prezzo - Number(ob))} sopra il tuo obiettivo` };
}

function _matchRaggruppa(righe) {
    const perPersona = new Map();
    righe.forEach(r => { if (!perPersona.has(r.ownerAltro)) perPersona.set(r.ownerAltro, []); perPersona.get(r.ownerAltro).push(r); });
    return [...perPersona.entries()].map(([ownerAltro, rr]) => {
        const label = _matchNomePersona(ownerAltro);
        const inBudget = rr.filter(r => { const e = _matchEtichetta(r); return e && e.cls.includes('conclusa'); }).length;
        const tuttiNuovi = rr.filter(r => _matchDati.nuovi.has(r.chiave)).length;
        return { ownerAltro, label, labelSafe: escapeJsAttr(label), righe: rr, inBudget, nuovi: tuttiNuovi, totale: rr.reduce((t, r) => t + r.prezzo, 0) };
    });
}

function _matchRenderDaDati() {
    const container = document.getElementById('matchLista');
    if (!container || !_matchDati) return;
    _matchMenuIdx = 0;
    const { righe, nascosti, nuovi } = _matchDati;
    const visibili = righe.filter(r => !nascosti.has(r.chiave));
    const nascoste = righe.filter(r => nascosti.has(r.chiave));

    if (visibili.length === 0 && nascoste.length === 0) {
        container.innerHTML = '<p class="match-vuoto">Nessuna corrispondenza al momento.</p>';
        return;
    }

    const righeCerchi = visibili.filter(r => r.lato === 'cerchi');
    const righeHai = visibili.filter(r => r.lato === 'hai');
    let tab = _matchTabAttivo;
    if (tab === 'cerchi' && righeCerchi.length === 0 && righeHai.length > 0) tab = 'hai';
    else if (tab === 'hai' && righeHai.length === 0 && righeCerchi.length > 0) tab = 'cerchi';
    _matchTabAttivo = tab;

    const persone = new Set(visibili.map(r => r.ownerAltro)).size;
    const nNuove = visibili.filter(r => nuovi.has(r.chiave)).length;
    const riepilogo = `<b>${visibili.length} corrispondenz${visibili.length === 1 ? 'a' : 'e'}</b><span class="match-riep-pc"> con ${persone} person${persone === 1 ? 'a' : 'e'} del gruppo</span>${nNuove ? ` · <b class="match-rosso">${nNuove} nuov${nNuove === 1 ? 'a' : 'e'}</b>` : ''}`;

    const righeTab = tab === 'cerchi' ? righeCerchi : righeHai;
    const nascosteTab = nascoste.filter(r => r.lato === tab);
    const gruppi = _matchRaggruppa(righeTab);
    const gruppiNascosti = _matchMostraNascoste ? _matchRaggruppa(nascosteTab) : [];
    if (gruppi.length && !gruppi.some(g => g.ownerAltro === _matchPersonaSel[tab])) _matchPersonaSel[tab] = gruppi[0].ownerAltro;

    const tabBtn = (id, icona, testo, n) =>
        `<button type="button" class="match-tabbtn ${tab === id ? 'attivo' : ''}" onclick="_matchCambiaTab('${id}')"><i class="fa-solid ${icona}"></i> ${testo} &middot; ${n}</button>`;
    const tabsHtml = `<div class="match-tabs">${tabBtn('cerchi', 'fa-heart', 'Lo cerchi', righeCerchi.length)}${tabBtn('hai', 'fa-right-left', 'Lo hai tu', righeHai.length)}</div>`;

    const descr = tab === 'cerchi' ? 'Cose della tua Wishlist che qualcuno del gruppo ha in Scambio' : 'Cose tue in Scambio che qualcuno del gruppo ha in Wishlist';
    const vuoto = tab === 'cerchi'
        ? 'Nessuna corrispondenza: nessuno ha ancora ciò che cerchi in Wishlist.'
        : 'Nessuna corrispondenza: nulla di tuo che gli altri stiano cercando al momento.';

    const elencoPC = gruppi.map(g => {
        const sotto = tab === 'cerchi'
            ? `${g.righe.length} cart${g.righe.length === 1 ? 'a' : 'e'} della tua Wishlist · ${formattaEuro(g.totale)}`
            : `cerca ${g.righe.length} tu${g.righe.length === 1 ? 'a carta' : 'e carte'} in Scambio`;
        const chip = g.inBudget ? `<span class="bx-stato bx-stato-conclusa">${g.inBudget} ${tab === 'cerchi' ? 'sotto obiettivo' : 'nel budget'}</span>` : '';
        return `<div class="match-mrow ${g.ownerAltro === _matchPersonaSel[tab] ? 'sel' : ''}" onclick="_matchSelezionaPersona('${g.ownerAltro}')">
            <div class="match-avatar" data-avatar-utente="${g.ownerAltro}">${escapeHtml(g.label.charAt(0).toUpperCase())}</div>
            <div class="match-mtesto"><div class="match-persona-nome">${escapeHtml(g.label)}${g.nuovi ? ' <span class="match-punto"></span>' : ''}</div><div class="match-persona-sotto">${sotto}</div></div>
            ${chip}<i class="fa-solid fa-chevron-right match-freccia"></i></div>`;
    }).join('');

    const nascosteHtml = nascosteTab.length
        ? `<div class="match-nascoste"><i class="fa-solid fa-eye-slash"></i> ${nascosteTab.length} nascost${nascosteTab.length === 1 ? 'a' : 'e'} · <a href="#" onclick="event.preventDefault(); _matchToggleNascoste()">${_matchMostraNascoste ? 'Nascondi' : 'Mostra'}</a></div>`
        : '';

    const card = (g, nasc) => _matchCardPersonaHtml(g, tab === 'cerchi', nasc, g.ownerAltro === _matchPersonaSel[tab]);
    const cards = gruppi.length
        ? gruppi.map(g => card(g, false)).join('')
        : `<p class="match-vuoto">${vuoto}</p>`;
    const cardsNasc = gruppiNascosti.map(g => card(g, true)).join('');

    container.innerHTML = `
        <p class="pg-sotto match-riepilogo">${riepilogo}</p>
        <div class="match-layout">
            ${tabsHtml}
            <div class="match-master">
                <div class="match-descr">${descr}</div>
                ${elencoPC}
                ${nascosteHtml}
            </div>
            <div class="match-dettaglio">${cards}${cardsNasc}${nascosteTab.length ? `<div class="match-nascoste match-nascoste-tel"><i class="fa-solid fa-eye-slash"></i> ${nascosteTab.length} nascost${nascosteTab.length === 1 ? 'a' : 'e'} · <a href="#" onclick="event.preventDefault(); _matchToggleNascoste()">${_matchMostraNascoste ? 'Nascondi' : 'Mostra'}</a></div>` : ''}</div>
        </div>`;
    if (typeof fotoProfiloApplica === 'function') fotoProfiloApplica(container);
}

function _matchCardPersonaHtml(g, eCerchi, nascoste, selPC) {
    const n = g.righe.length;
    const sotto = eCerchi
        ? `ha ${n} cart${n === 1 ? 'a' : 'e'} della tua Wishlist · totale ${formattaEuro(g.totale)}`
        : `cerca ${n} tu${n === 1 ? 'a carta' : 'e carte'} in Scambio · valore ${formattaEuro(g.totale)}`;
    const titoloPC = eCerchi ? `${escapeHtml(g.label)} ha ${n} ${n === 1 ? 'carta' : 'carte'} che cerchi` : `${escapeHtml(g.label)} cerca ${n} tu${n === 1 ? 'a carta' : 'e carte'}`;
    const selezionate = eCerchi ? g.righe.filter(r => _matchSelezionate.has(r.chiave)) : [];
    const azioneFondo = nascoste ? '' : (eCerchi
        ? `<button type="button" class="match-fondo ${selezionate.length ? 'attivo' : ''}" ${selezionate.length ? '' : 'disabled'} onclick="_matchRichiediSelezionate('${g.ownerAltro}')"><i class="fa-solid fa-paper-plane"></i> Richiedi le selezionate${selezionate.length ? ` (${selezionate.length})` : ''}</button>`
        : `<button type="button" class="match-fondo" onclick="_contattaPersonaMatch('${g.ownerAltro}', '${g.labelSafe}')"><i class="fa-solid fa-comment"></i> Proponi a ${escapeHtml(g.label)}</button>`);
    return `
        <div class="match-persona ${nascoste ? 'match-persona-nasc' : ''} ${selPC ? 'match-persona-sel' : ''}" data-owner="${g.ownerAltro}">
            <div class="match-persona-head">
                <div class="match-avatar" data-avatar-utente="${g.ownerAltro}">${escapeHtml(g.label.charAt(0).toUpperCase())}</div>
                <div style="flex:1; min-width:0;">
                    <div class="match-persona-nome"><span class="match-tel">${escapeHtml(g.label)}</span><span class="match-pc">${titoloPC}</span></div>
                    <div class="match-persona-sotto">${nascoste ? 'nascoste' : sotto}</div>
                </div>
                <button type="button" class="match-icobtn match-scrivi" onclick="event.stopPropagation(); _contattaPersonaMatch('${g.ownerAltro}', '${g.labelSafe}')" title="Scrivi a ${g.labelSafe}" aria-label="Scrivi a ${g.labelSafe}"><i class="fa-solid fa-comment"></i><span class="match-pc"> Scrivi a ${escapeHtml(g.label)}</span></button>
            </div>
            ${g.righe.map(r => _matchRigaHtml(r, eCerchi, g, nascoste)).join('')}
            ${azioneFondo ? `<div class="match-persona-fondo">${azioneFondo}</div>` : ''}
        </div>`;
}

function _matchRigaHtml(r, eCerchi, g, nascosta) {
    const idx = _matchMenuIdx++;
    const chiaveSafe = escapeJsAttr(r.chiave);
    const src = _urlImmagineVisualizzabile(r.img, 96);
    const zoom = (r.tipo === 'carta' && r.miaId) ? ` onclick="event.stopPropagation(); apriImmagineIngrandita('${escapeJsAttr(String(r.miaId))}')"` : '';
    const miniatura = `<span class="bx-lente match-thumb"${zoom}>${src ? `<img class="match-img" src="${src}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'match-img match-img-vuota',innerHTML:'<i class=&quot;fa-solid fa-image&quot;></i>'}))">` : `<span class="match-img match-img-vuota"><i class="fa-solid ${r.tipo === 'sealed' ? 'fa-box' : 'fa-image'}"></i></span>`}</span>`;
    const meta = [r.code, r.lang, r.cond].filter(Boolean).map(escapeHtml).join(' · ');
    const eti = _matchEtichetta(r);
    const prezzoTesto = eCerchi
        ? `Lo ha in Scambio a <b>${formattaEuro(r.prezzo)}</b>${r.obiettivo != null ? ` · tuo obiettivo ${formattaEuro(r.obiettivo)}` : ''}${r.disponibili > 0 ? ` · ne ha ${r.disponibili}` : ''}`
        : `Tuo in Scambio a <b>${formattaEuro(r.prezzo)}</b>${r.obiettivo != null ? ` · lo cerca fino a ${formattaEuro(r.obiettivo)}` : ' · nessun limite di prezzo'}`;
    const nuovo = _matchDati.nuovi.has(r.chiave) ? ' <span class="match-nuovo">NUOVO</span>' : '';
    const spunta = (eCerchi && !nascosta)
        ? `<input type="checkbox" class="match-spunta" ${_matchSelezionate.has(r.chiave) ? 'checked' : ''} onclick="event.stopPropagation(); _matchToggleSpunta('${chiaveSafe}')" aria-label="Seleziona ${escapeHtml(r.nome)}">` : '';
    const primaria = nascosta ? '' : (eCerchi
        ? `<button type="button" class="match-azione match-pc-flex" onclick="event.stopPropagation(); _matchRichiediUna('${chiaveSafe}')"><i class="fa-solid fa-paper-plane"></i> Richiedi</button>`
        : `<button type="button" class="match-azione match-pc-flex" onclick="event.stopPropagation(); _contattaPersonaMatch('${g.ownerAltro}', '${g.labelSafe}')"><i class="fa-solid fa-comment"></i> Proponi</button>`);
    const voceMenu = nascosta
        ? `<button type="button" onclick="_matchChiudiMenuAperto(); _riattivaMatch('${chiaveSafe}')"><i class="fa-solid fa-eye"></i> Mostra di nuovo</button>`
        : `<button type="button" onclick="_matchChiudiMenuAperto(); _nascondiMatch('${chiaveSafe}', event)"><i class="fa-solid fa-eye-slash"></i> Nascondi</button>`;
    return `
        <div class="match-riga">
            ${spunta}${miniatura}
            <div class="match-riga-testo">
                <div class="match-riga-nome">${escapeHtml(r.nome || '(senza nome)')}${nuovo}</div>
                ${meta ? `<div class="match-riga-meta">${meta}</div>` : ''}
                <div class="match-riga-prezzo">${prezzoTesto}</div>
                ${eti ? `<span class="${eti.cls}">${eti.testo}</span>` : ''}
            </div>
            ${primaria}
            <button type="button" class="match-icobtn" onclick="_matchToggleMenu(${idx}, event)" title="Altre azioni" aria-label="Altre azioni"><i class="fa-solid fa-ellipsis-vertical"></i></button>
            <div class="match-menu" id="matchMenu_${idx}">${voceMenu}</div>
        </div>`;
}

function _matchCambiaTab(tab) { _matchTabAttivo = tab; _matchRenderDaDati(); }
function _matchSelezionaPersona(ownerId) { _matchPersonaSel[_matchTabAttivo] = ownerId; _matchRenderDaDati(); }
function _matchToggleNascoste() { _matchMostraNascoste = !_matchMostraNascoste; _matchRenderDaDati(); }
function _matchToggleSpunta(chiave) {
    if (_matchSelezionate.has(chiave)) _matchSelezionate.delete(chiave); else _matchSelezionate.add(chiave);
    _matchRenderDaDati();
}

function _matchVoceRichiesta(r) {
    return { chiave: r.chiave, tipo: r.tipo, oggettoId: r.oggettoId, nome: r.nome, code: r.code, img: r.img, prezzo: r.prezzo };
}
function _matchRichiediUna(chiave) {
    const r = _matchDati && _matchDati.righe.find(x => x.chiave === chiave);
    if (!r) return;
    apriRichiediMatchMulti(r.ownerAltro, _matchNomePersona(r.ownerAltro), [_matchVoceRichiesta(r)]);
}
function _matchRichiediSelezionate(ownerId) {
    if (!_matchDati) return;
    const voci = _matchDati.righe.filter(r => r.ownerAltro === ownerId && r.lato === 'cerchi' && _matchSelezionate.has(r.chiave)).map(_matchVoceRichiesta);
    if (!voci.length) return;
    apriRichiediMatchMulti(ownerId, _matchNomePersona(ownerId), voci);
}
function _matchRichiestaInviata(chiavi) {
    (chiavi || []).forEach(c => _matchSelezionate.delete(c));
    _matchRenderDaDati();
}

function _matchToggleMenu(idx, evt) {
    evt.stopPropagation();
    const menu = document.getElementById('matchMenu_' + idx);
    if (!menu) return;
    const giaAperto = menu.classList.contains('aperto');
    _matchChiudiMenuAperto();
    if (!giaAperto) {
        menu.classList.add('aperto');
        setTimeout(() => { document.addEventListener('click', _matchChiudiMenuAperto, { once: true }); }, 0);
    }
}
function _matchChiudiMenuAperto() {
    document.querySelectorAll('#match .match-menu.aperto').forEach(m => m.classList.remove('aperto'));
}

async function _matchNascostiSet(userId) {
    if (!userId) return new Set();
    try {
        const { data, error } = await userSettingsGet(userId);
        if (error || !data || !data.match_nascosti) return new Set();
        return new Set(JSON.parse(data.match_nascosti));
    } catch (e) {
        console.error('_matchNascostiSet: errore lettura/parsing:', e);
        return new Set();
    }
}

async function _nascondiMatch(chiave, evt) {
    const tile = evt?.currentTarget?.closest('.match-riga') || evt?.target?.closest?.('.match-riga');
    if (tile) tile.style.display = 'none';
    await _matchAggiornaNascosti(chiave, true);
}

async function _riattivaMatch(chiave) {
    await _matchAggiornaNascosti(chiave, false);
}

async function _matchAggiornaNascosti(chiave, nascondi) {
    const userId = await authGetUserId();
    if (!userId) return;
    const attuali = await _matchNascostiSet(userId);
    if (nascondi) attuali.add(chiave); else attuali.delete(chiave);
    const { error } = await userSettingsUpsertMatchNascosti(userId, [...attuali]);
    if (error) { console.error('_matchAggiornaNascosti: errore salvataggio:', error.message); return; }
    if (_matchDati) {
        _matchDati.nascosti = attuali;
        if (nascondi) _matchSelezionate.delete(chiave);
        _matchRenderDaDati();
    }
}

function _apriBinderAltruiMatch(ownerAltro, binderAltro) {
    if (!ownerAltro || !binderAltro) {
        mostraAvviso('Collegamento diretto al binder non ancora disponibile.');
        return;
    }
    (async () => {
        try {
            const userId = await authGetUserId();
            if (userId) await missioniBinderPubblicoVisitatoRegistra(userId, binderAltro);
        } catch (e) { console.error('[missioni] registrazione visita binder pubblico:', e); }
    })();
    const url = new URL('binder-pubblico.html?u=' + encodeURIComponent(ownerAltro), window.location.href);
    url.searchParams.set('binder', binderAltro);
    window.open(url.href, '_blank');
}

function _contattaPersonaMatch(ownerAltro, personaLabel) {
    apriChat(ownerAltro, personaLabel);
}
