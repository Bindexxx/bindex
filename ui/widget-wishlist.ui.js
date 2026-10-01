// ═══════════════════════════════════════════════════════════════════════
// WIDGET-WISHLIST.UI.JS — tessera + pagina "Wishlist" (id catalogo
// 'wishlist_obiettivi') (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP 22 della ristrutturazione file widget home (vedi
// Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md). Estratto da
// ui/phone.ui.js il 2026-09-11. NESSUNA riscrittura: solo spostamento di
// codice, zero cambi di comportamento per l'utente finale.
//
// CATEGORIA A: pagina propria con ricerca + 4 filtri (Tutte/Raggiunte/In
// corso/Senza obiettivo), ordinamento fisso (raggiunte prima per sconto
// più grande, poi in corso per vicinanza, poi senza obiettivo alfabetico —
// deciso da Claudio). "Vai alla Wishlist" salta direttamente al binder di
// tipo wishlist.
//
// COSA RESTA FUORI (non spostato qui, invariato):
// - apriDettaglioWidget (ui/paginainiziale.ui.js) continua a chiamare
//   renderPaginaWishlist() per tabId === 'wishlist', e _vaiAlBinderWishlist
//   qui sotto continua a chiamare apriDettaglioWidget('binder', evt) —
//   motore home, dispatch generico, non toccato in questo step.
// - _ballCORPI.wishlist_obiettivi / _ballASPETTO.wishlist_obiettivi /
//   _ballTITOLI_BREVI.wishlist_obiettivi / _ballRigaBarra / _ballPill
//   (ui/widget-render-condiviso.ui.js) — motore visivo, non toccato.
//   Verificato: legge d.raggiunte/d.totale/d.lista dal 'dati' restituito
//   dal preview() qui sotto — forma confermata coerente.
// - _bindersElenco, apriBinderDettaglio (ui/binder.ui.js), apriFlipCardHome,
//   _urlImmagineVisualizzabile, escapeHtml: esterne, non toccate.
// ───────────────────────────────────────────────────────────────────────

// ── VOCE DI CATALOGO ──────────────────────────────────────────────────
CATALOGO_WIDGET.wishlist_obiettivi = {
        titolo: 'Wishlist', icona: 'fa-heart',
        preview: () => {
            const desiderate = carteReali.filter(c => c.tabella === 'wishlist' || c.stato === 'wishlist');
            const conObiettivo = desiderate.filter(c => c.prezzoObiettivo != null && c.prezzoObiettivo > 0);
            const raggiunte = conObiettivo.filter(c => c.price > 0 && c.price <= c.prezzoObiettivo);
            if (desiderate.length === 0) return { righe: ['Wishlist vuota'], dati: { totale: 0, raggiunte: 0, conObiettivo: 0, lista: [] } };
            return {
                righe: [raggiunte.length > 0 ? `${raggiunte.length} sotto obiettivo` : `${desiderate.length} carte desiderate`],
                stato: raggiunte.length > 0 ? 'ok' : undefined,
                dati: {
                    totale: desiderate.length,
                    conObiettivo: conObiettivo.length,
                    raggiunte: raggiunte.length,
                    lista: (raggiunte.length ? raggiunte : conObiettivo).slice(0, 3).map(c => ({
                        nome: c.name || '—',
                        prezzo: Number(c.price) || 0,
                        obiettivo: Number(c.prezzoObiettivo) || 0,
                        id: c.id
                    }))
                }
            };
        },
        // MODIFICATO (2026-08-30): prima apriva semplicemente Binder
        // (tab:'binder') — ora ha una pagina propria dedicata (#wishlist
        // in index.html, renderPaginaWishlist() sotto). Nessun impatto sul
        // tracciamento missioni (registrano l'evento su w.id=
        // 'wishlist_obiettivi', non su def.tab).
        tab: 'wishlist',
};

// ── PAGINA "WISHLIST" (2026-08-30) ──────────────────────────────────────
// Secondo widget con pagina di dettaglio propria, stesso pattern di
// renderPaginaValoreCollezione() sopra. A differenza di quella, qui la
// pagina mostra TUTTA la wishlist (non solo il preview a 3 carte del
// widget) — letta direttamente da carteReali (stessa fonte del preview,
// senza il .slice(0,3)), zero query nuove.
//
// Ordinamento: raggiunte prima (le carte con prezzo attuale <= obiettivo,
// ordinate per sconto più grande), poi le altre con obiettivo impostato
// (ordinate per vicinanza — prezzo più vicino all'obiettivo prima), infine
// quelle senza obiettivo impostato in fondo (alfabetico) — deciso da
// Claudio.
let _wishlistCarteComputate = [];
let _wishlistFiltroAttivo = 'tutte';
let _wishlistRicercaTesto = '';

function _wishlistClassificaEOrdina() {
    const desiderate = carteReali.filter(c => c.tabella === 'wishlist' || c.stato === 'wishlist');
    const conPrezzo = (c) => Number(c.price) || 0;
    const conObiettivoVal = (c) => (c.prezzoObiettivo != null && Number(c.prezzoObiettivo) > 0) ? Number(c.prezzoObiettivo) : null;

    const righe = desiderate.map(c => {
        const obiettivo = conObiettivoVal(c);
        const prezzo = conPrezzo(c);
        const raggiunta = obiettivo != null && prezzo > 0 && prezzo <= obiettivo;
        return { id: c.id, nome: c.name || '—', codice: c.code || '', immagine: c.immagine || null, prezzo, obiettivo, raggiunta, variazione: c.variazioneNumerica, link: c.link };
    });

    const raggiunte = righe.filter(r => r.raggiunta)
        .sort((a, b) => (b.obiettivo - b.prezzo) - (a.obiettivo - a.prezzo)); // sconto più grande prima
    const inCorso = righe.filter(r => !r.raggiunta && r.obiettivo != null)
        .sort((a, b) => (a.prezzo - a.obiettivo) - (b.prezzo - b.obiettivo)); // più vicine prima
    const senzaObiettivo = righe.filter(r => r.obiettivo == null)
        .sort((a, b) => a.nome.localeCompare(b.nome));

    _wishlistCarteComputate = [...raggiunte, ...inCorso, ...senzaObiettivo];
    return { totale: righe.length, conObiettivo: raggiunte.length + inCorso.length, raggiunte: raggiunte.length };
}

// RESTYLE (2026-10-01, tavole "Wishlist"): riepilogo "N carte · sotto
// obiettivo", Carte/Sealed, ricerca con vista Elenco/Libro (Libro = binder
// Wishlist), filtri e ordinamento; ogni riga con la barra verso
// l'obiettivo ("mancano X €" / "sotto di X €"). Su PC: tabella con
// distanza, variazione e "Nel gruppo" (chi ce l'ha in Scambio, dai Match),
// e a destra il dettaglio con il prezzo nel tempo e la linea dell'obiettivo.
let _wishlistOrdine = 'vicine';      // 'vicine' | 'prezzo' | 'az'
let _wishlistSelId = null;
let _wishlistNelGruppo = new Map();  // id wishlist -> [{ owner, nickname }]

function _wishlistEPC() { const s = document.getElementById('wishlist'); return !!s && s.clientWidth >= 780; }

async function _wishlistCaricaNelGruppo() {
    _wishlistNelGruppo = new Map();
    try {
        const userId = await authGetUserId();
        if (!userId || typeof trovaMatch !== 'function') return;
        const { data } = await trovaMatch('trova_match_wishlist_scambio', userId);
        (data || []).forEach(m => {
            const k = String(m.mia_wishlist_id);
            if (!_wishlistNelGruppo.has(k)) _wishlistNelGruppo.set(k, []);
            const l = _wishlistNelGruppo.get(k);
            if (!l.some(x => x.owner === m.altro_owner_id)) l.push({ owner: m.altro_owner_id, nickname: m.altro_nickname || 'Qualcuno' });
        });
    } catch (e) { console.error('[wishlist] nel gruppo:', e); }
}

async function renderPaginaWishlist() {
    const container = document.getElementById('wishlistContenuto');
    if (!container) return;

    _wishlistFiltroAttivo = 'tutte';
    _wishlistRicercaTesto = '';
    _wishlistTabAttiva = 'carte';
    _wishlistSelId = null;
    _wishlistSealedCaricato = false; // Fase 6, Step 2: ricarica sempre ad ogni apertura pagina
    const { totale, conObiettivo, raggiunte } = _wishlistClassificaEOrdina();
    const perPrenderle = _wishlistCarteComputate.reduce((t, r) => t + (r.prezzo || 0), 0);
    const filtro = (id, t) => `<button type="button" class="wl-chip${id === 'tutte' ? ' attivo' : ''}" data-filtro="${id}" onclick="_wishlistImpostaFiltro('${id}')">${t}</button>`;

    container.innerHTML = `
        <div class="wl-pagina">
            <div class="wl-testa">
                <div class="wl-testa-sx">
                    <span class="page-title">Wishlist</span>
                    <span class="wl-conti wl-solo-pc"><b>${totale}</b> carte <b>${raggiunte}</b> sotto obiettivo <b>${formattaEuroTondo(perPrenderle)}</b> per prenderle tutte</span>
                </div>
                <div class="wl-seg wl-solo-pc"><button type="button" class="wl-segbtn attivo" data-tab="carte" onclick="_wishlistImpostaTab('carte')">Carte</button><button type="button" class="wl-segbtn" data-tab="sealed" onclick="_wishlistImpostaTab('sealed')">Sealed</button></div>
                <button type="button" class="wl-btn" onclick="_wishlistCondividi(event)"><i class="fa-solid fa-share-nodes"></i> Condividi</button>
            </div>
            <div class="wl-conti wl-solo-tel"><b>${totale} cart${totale === 1 ? 'a' : 'e'}</b> · ${raggiunte} sotto obiettivo · ${conObiettivo} con obiettivo</div>
            <div class="wl-seg wl-solo-tel"><button type="button" class="wl-segbtn attivo" data-tab="carte" onclick="_wishlistImpostaTab('carte')">Carte</button><button type="button" class="wl-segbtn" data-tab="sealed" onclick="_wishlistImpostaTab('sealed')">Sealed</button></div>
            <div id="wishlistTabCarte">
                ${totale === 0 ? `<p class="wl-vuoto">La tua wishlist di carte è vuota.</p>` : `
                <div class="wl-barra">
                    <label class="wl-cerca"><i class="fa-solid fa-magnifying-glass"></i><input type="text" placeholder="Cerca nella wishlist..." oninput="_wishlistCercaInput(this.value)"></label>
                    <div class="wl-filtri wl-solo-pc-flex">${filtro('tutte', 'Tutte')}${filtro('raggiunte', 'Raggiunte')}${filtro('in_corso', 'In corso')}${filtro('senza_obiettivo', 'Senza obiettivo')}</div>
                    <button type="button" class="wl-vista attiva" title="Elenco"><i class="fa-solid fa-list"></i></button>
                    <button type="button" class="wl-vista" title="Libro" onclick="_vaiAlBinderWishlist(event)"><i class="fa-solid fa-book-open"></i></button>
                </div>
                <div class="wl-filtri wl-solo-tel">${filtro('tutte', 'Tutte')}${filtro('raggiunte', 'Raggiunte')}${filtro('in_corso', 'In corso')}${filtro('senza_obiettivo', 'Senza obiettivo')}</div>
                <div class="wl-ordina-riga wl-solo-tel"><button type="button" class="wl-chip" id="wlOrdina" onclick="_wishlistCambiaOrdine()"></button></div>
                <div class="wl-layout">
                    <div class="wl-elenco" id="wishlistElenco"></div>
                    <div class="wl-dettaglio" id="wishlistDettaglio"></div>
                </div>
                `}
            </div>
            <div id="wishlistTabSealed" style="display:none;">
                <label class="wl-cerca"><i class="fa-solid fa-magnifying-glass"></i><input type="text" placeholder="Cerca tra i prodotti sealed desiderati..." oninput="_wishlistSealedCercaInput(this.value)"></label>
                <div class="pg-elenco" id="wishlistSealedElenco"></div>
            </div>
        </div>
    `;
    if (totale > 0) _wishlistRenderElenco();
    if (totale > 0) { await _wishlistCaricaNelGruppo(); _wishlistRenderElenco(); }
}

// ── TAB CARTE/SEALED (Fase 6, Step 2) ────────────────────────────────────
let _wishlistTabAttiva = 'carte';

function _wishlistImpostaTab(tab) {
    _wishlistTabAttiva = tab;
    document.querySelectorAll('#wishlistContenuto .wl-segbtn').forEach(el => {
        el.classList.toggle('attivo', el.dataset.tab === tab);
    });
    const tabCarte = document.getElementById('wishlistTabCarte');
    const tabSealed = document.getElementById('wishlistTabSealed');
    if (tabCarte) tabCarte.style.display = tab === 'carte' ? '' : 'none';
    if (tabSealed) tabSealed.style.display = tab === 'sealed' ? '' : 'none';
    if (tab === 'sealed') _wishlistSealedApri();
}

function _wishlistCondividi(evt) {
    apriDettaglioWidget('condividi', evt);
}

function _wishlistImpostaFiltro(filtro) {
    _wishlistFiltroAttivo = filtro;
    document.querySelectorAll('#wishlistContenuto .wl-chip[data-filtro]').forEach(el => {
        el.classList.toggle('attivo', el.dataset.filtro === filtro);
    });
    _wishlistRenderElenco();
}

function _wishlistCercaInput(valore) {
    _wishlistRicercaTesto = (valore || '').toLowerCase();
    _wishlistRenderElenco();
}

const _WL_ORDINI = { vicine: 'più vicine', prezzo: 'prezzo', az: 'A → Z' };
function _wishlistCambiaOrdine() {
    const k = Object.keys(_WL_ORDINI);
    _wishlistOrdine = k[(k.indexOf(_wishlistOrdine) + 1) % k.length];
    _wishlistRenderElenco();
}
function _wishlistOrdinaPer(o) { _wishlistOrdine = o; _wishlistRenderElenco(); }

// Distanza dall'obiettivo: negativa = sotto obiettivo (raggiunta).
function _wlDistanza(r) { return r.obiettivo != null ? r.prezzo - r.obiettivo : null; }
function _wlBarra(r) {
    if (r.obiettivo == null) return { pct: 0, cls: '', testo: 'nessun obiettivo' };
    if (!(r.prezzo > 0)) return { pct: 0, cls: '', testo: 'prezzo non ancora letto' };
    const d = _wlDistanza(r);
    if (d <= 0) return { pct: 100, cls: 'ok', testo: d === 0 ? 'all’obiettivo' : `sotto di ${formattaEuroTondo(-d)}` };
    const pct = r.prezzo > 0 ? Math.max(4, Math.min(96, r.obiettivo / r.prezzo * 100)) : 0;
    return { pct, cls: '', testo: `mancano ${formattaEuroTondo(d)}` };
}

function _wishlistRenderElenco() {
    const elenco = document.getElementById('wishlistElenco');
    if (!elenco) return;
    const eur = (v) => formattaEuro(v);
    let righe = _wishlistCarteComputate.slice();
    if (_wishlistFiltroAttivo === 'raggiunte') righe = righe.filter(r => r.raggiunta);
    else if (_wishlistFiltroAttivo === 'in_corso') righe = righe.filter(r => !r.raggiunta && r.obiettivo != null);
    else if (_wishlistFiltroAttivo === 'senza_obiettivo') righe = righe.filter(r => r.obiettivo == null);
    if (_wishlistRicercaTesto) righe = righe.filter(r => r.nome.toLowerCase().includes(_wishlistRicercaTesto) || (r.codice || '').toLowerCase().includes(_wishlistRicercaTesto));
    if (_wishlistOrdine === 'prezzo') righe.sort((a, b) => b.prezzo - a.prezzo);
    else if (_wishlistOrdine === 'az') righe.sort((a, b) => a.nome.localeCompare(b.nome));
    const o = document.getElementById('wlOrdina');
    if (o) o.textContent = `Ordina: ${_WL_ORDINI[_wishlistOrdine]} ↓`;

    if (righe.length === 0) {
        elenco.innerHTML = '<p class="wl-vuoto">Nessuna carta corrisponde alla ricerca o al filtro.</p>';
        _wishlistDettaglio();
        return;
    }
    const pc = _wishlistEPC();
    if (pc && (!_wishlistSelId || !righe.some(r => String(r.id) === String(_wishlistSelId)))) _wishlistSelId = null;
    const fig = (r) => {
        const src = r.immagine ? (_urlImmagineVisualizzabile(r.immagine, 96) || '') : '';
        return src ? `<img class="wl-fig" src="${src}" alt="" loading="lazy" onerror="this.style.visibility='hidden';">` : '<span class="wl-fig"></span>';
    };
    const id = (r) => escapeJsAttr(String(r.id));

    if (!pc) {
        elenco.innerHTML = righe.map(r => {
            const b = _wlBarra(r);
            return `
            <div class="wl-riga" onclick="apriFlipCardHome('${id(r)}', { origine: 'wishlist_pagina' })">
                ${fig(r)}
                <div class="wl-riga-corpo">
                    <div class="wl-riga-testa"><b>${escapeHtml(r.nome)}</b><b>${r.prezzo > 0 ? eur(r.prezzo) : '—'}</b></div>
                    <div class="wl-pista"><div class="${b.cls}" style="width:${b.pct}%"></div></div>
                    <div class="wl-riga-piede"><span>${r.obiettivo != null ? 'obiettivo ' + eur(r.obiettivo) : 'nessun obiettivo'}</span><span class="${b.cls ? 'wl-ok' : ''}">${r.obiettivo != null ? (b.cls ? 'sotto obiettivo' : b.testo) : ''}</span></div>
                </div>
            </div>`;
        }).join('');
        return;
    }

    const th = (k, t) => `<th class="${_wishlistOrdine === k ? 'attivo' : ''}" onclick="_wishlistOrdinaPer('${k}')">${t}${_wishlistOrdine === k ? ' ↑' : ''}</th>`;
    elenco.innerHTML = `<div class="wl-tabella-box"><table class="wl-tabella">
        <thead><tr><th>${''}</th>${th('az', 'Carta')}${th('prezzo', 'Prezzo')}<th>Obiettivo</th>${th('vicine', 'Distanza')}<th>Var.</th><th>Nel gruppo</th><th></th></tr></thead>
        <tbody>${righe.map(r => {
            const b = _wlBarra(r);
            const v = r.variazione;
            const chi = _wishlistNelGruppo.get(String(r.id)) || [];
            return `<tr class="${String(r.id) === String(_wishlistSelId) ? 'sel' : ''}" onclick="_wishlistSeleziona('${id(r)}')">
                <td><span class="bx-lente" onclick="event.stopPropagation(); apriFlipCardHome('${id(r)}', { origine: 'wishlist_pagina' })">${fig(r)}</span></td>
                <td class="wl-td-nome"><b>${escapeHtml(r.nome)}</b><span>${escapeHtml(r.codice || '')}</span></td>
                <td class="wl-num"><b>${r.prezzo > 0 ? eur(r.prezzo) : '—'}</b></td>
                <td class="wl-num">${r.obiettivo != null ? eur(r.obiettivo) : '—'}</td>
                <td class="wl-td-dist">${r.obiettivo != null ? `<div class="wl-pista"><div class="${b.cls}" style="width:${b.pct}%"></div></div><span class="${b.cls ? 'wl-ok' : ''}">${b.testo}</span>` : '<span>—</span>'}</td>
                <td class="wl-num ${v > 0 ? 'wl-su' : (v < 0 ? 'wl-giu' : '')}">${v ? (v > 0 ? '+' : '−') + formattaEuro(Math.abs(v)).replace(' €', '') : '—'}</td>
                <td>${chi.length ? `<span class="wl-gruppo">${escapeHtml(chi[0].nickname)} ce l’ha${chi.length > 1 ? ` +${chi.length - 1}` : ''}</span>` : ''}</td>
                <td><button type="button" class="wl-menu" title="Modifica" onclick="event.stopPropagation(); apriModificaCarta('${id(r)}')"><i class="fa-solid fa-ellipsis"></i></button></td>
            </tr>`;
        }).join('')}</tbody></table></div>`;
    _wishlistDettaglio();
}

// Telefono ↔ PC (finestra ridimensionata): elenco o tabella.
(function () {
    let t = null, eraPC = null;
    window.addEventListener('resize', () => {
        clearTimeout(t);
        t = setTimeout(() => {
            const s = document.getElementById('wishlist');
            if (!s || !s.classList.contains('active')) return;
            const ora = _wishlistEPC();
            if (ora !== eraPC) { eraPC = ora; _wishlistRenderElenco(); }
        }, 200);
    });
})();

function _wishlistSeleziona(idCarta) {
    _wishlistSelId = idCarta;
    document.querySelectorAll('#wishlistElenco tbody tr').forEach(tr => tr.classList.toggle('sel', tr.getAttribute('onclick').includes(`'${idCarta}'`)));
    _wishlistDettaglio();
}

async function _wishlistDettaglio() {
    const box = document.getElementById('wishlistDettaglio');
    if (!box) return;
    const r = _wishlistCarteComputate.find(x => String(x.id) === String(_wishlistSelId));
    if (!r) {
        box.innerHTML = `<div class="wl-invito"><i class="fa-regular fa-hand-pointer"></i><b>Clicca una riga per vedere prezzo e obiettivo nel tempo</b><span>Clicca la miniatura per aprire la carta intera</span></div>`;
        return;
    }
    const idA = escapeJsAttr(String(r.id));
    const src = r.immagine ? (_urlImmagineVisualizzabile(r.immagine, 240) || '') : '';
    const d = _wlDistanza(r);
    const distTxt = r.obiettivo == null ? 'nessun obiettivo' : !(r.prezzo > 0) ? 'prezzo non ancora letto'
        : (d <= 0 ? `sotto di ${formattaEuro(-d)}` : `mancano ${formattaEuro(d)} (−${Math.round(d / r.prezzo * 100)}%)`);
    const chi = _wishlistNelGruppo.get(String(r.id)) || [];
    const gruppo = chi.length ? `
        <div class="wl-det-gruppo"><b>${escapeHtml(chi[0].nickname)} ce l’ha</b> · <a onclick="apriChat('${escapeJsAttr(String(chi[0].owner))}', '${escapeJsAttr(chi[0].nickname)}')">Contattal${'o'}</a> · <a onclick="apriDettaglioWidget('match', event)">Vedi nei Match →</a></div>` : '';
    box.innerHTML = `
        <div class="wl-det">
            <div class="wl-det-testa">
                <span class="bx-lente wl-det-fig" onclick="apriFlipCardHome('${idA}', { origine: 'wishlist_pagina' })">${src ? `<img src="${src}" alt="">` : ''}</span>
                <div><div class="wl-det-nome">${escapeHtml(r.nome)}</div><div class="wl-det-sotto">${escapeHtml([r.codice, r.obiettivo != null ? 'obiettivo ' + formattaEuroTondo(r.obiettivo) : null].filter(Boolean).join(' · '))}</div></div>
            </div>
            <div class="wl-det-prezzo"><b>${r.prezzo > 0 ? formattaEuro(r.prezzo) : '—'}</b><span class="${d != null && d <= 0 ? 'wl-ok' : ''}">${distTxt}</span></div>
            <div class="wl-det-grafico wl-det-carico">Carico lo storico…</div>
            <div class="wl-det-assex"></div>
            ${gruppo}
            <div class="wl-det-azioni">
                <button type="button" class="wl-azione piena" onclick="apriModificaCarta('${idA}')">Modifica obiettivo</button>
                ${r.link && r.link !== '#' ? `<a class="wl-azione" href="${escapeHtml(r.link)}" target="_blank" rel="noopener">Apri su Cardmarket</a>` : '<span></span>'}
                <button type="button" class="wl-azione" onclick="segnaOttenuta('${idA}')">Segna come ottenuta</button>
                <button type="button" class="wl-azione" onclick="eliminaCarta('${idA}')">Rimuovi</button>
            </div>
        </div>`;
    let righe = [];
    try { const { data } = await storicoPrezziGrafico(r.id, 'wishlist'); righe = data || []; } catch (e) { console.error('[wishlist] storico:', e); }
    if (String(_wishlistSelId) !== String(r.id)) return;
    const g = box.querySelector('.wl-det-grafico'), ax = box.querySelector('.wl-det-assex');
    if (!g) return;
    const serie = righe.slice(-30);
    if (serie.length < 2) { g.textContent = 'Non ci sono ancora abbastanza controlli per un grafico.'; return; }
    const val = serie.map(x => Number(x.prezzo) || 0);
    const tutti = r.obiettivo != null ? [...val, r.obiettivo] : val;
    let min = Math.min(...tutti), max = Math.max(...tutti);
    if (max === min) { max += 1; min -= 1; }
    const W = 400, H = 150, pad = 8;
    const x = i => i / (val.length - 1) * W, y = v => pad + (1 - (v - min) / (max - min)) * (H - 2 * pad);
    const linea = 'M' + val.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' L');
    const obj = r.obiettivo != null ? `<line x1="0" x2="${W}" y1="${y(r.obiettivo).toFixed(1)}" y2="${y(r.obiettivo).toFixed(1)}" class="wl-g-obj" vector-effect="non-scaling-stroke"/>` : '';
    g.classList.remove('wl-det-carico');
    g.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${obj}<path d="${linea}" class="wl-g-linea" vector-effect="non-scaling-stroke"/></svg>` +
        (r.obiettivo != null ? `<span class="wl-g-objtxt" style="top:${(y(r.obiettivo) / H * 100).toFixed(1)}%">obiettivo ${formattaEuroTondo(r.obiettivo)}</span>` : '');
    const giorno = iso => new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }).replace('.', '');
    if (ax) ax.innerHTML = `<span>${giorno(serie[0].registrato_il)} · ${formattaEuroTondo(val[0])}</span><span>oggi · ${formattaEuroTondo(val[val.length - 1])}</span>`;
}

// Salta direttamente al binder di tipo 'wishlist', invece di lasciare
// l'utente sulla griglia dei contenitori di Binder (2026-08-30). Usa SOLO
// funzioni reali già esistenti in ui/binder.ui.js, nessuna query nuova
// inventata:
//   1) apriDettaglioWidget('binder', evt) — mostra la view-section Binder
//      (switchTab interno, MAI toccato direttamente qui) E chiama già da
//      sola apriWidgetBinders() al suo interno, awaited (vedi
//      apriDettaglioWidget riga ~2733) — _bindersElenco è già garantita
//      popolata quando questa await finisce, nessuna seconda chiamata
//      necessaria.
//   2) apriBinderDettaglio(id) — cerca dentro _bindersElenco.
async function _vaiAlBinderWishlist(evt) {
    await apriDettaglioWidget('binder', evt);
    const binderWishlist = _bindersElenco.find(b => b.tipo === 'wishlist');
    if (binderWishlist) {
        await apriBinderDettaglio(binderWishlist.id);
    }
    // Se non trovato (caso limite — binderWishlistGarantisci() dovrebbe
    // impedirlo sempre, vedi _garantisciTuttiIBinder in ui/binder.ui.js):
    // resta sulla griglia dei contenitori invece di rompere la pagina.
}


// ═══════════════════════════════════════════════════════════════════════
// FASE 6, STEP 2 (2026-09-13) — TAB SEALED DELLA WISHLIST
// ═══════════════════════════════════════════════════════════════════════
// wishlist_sealed (sql/52) è un dominio a sé, NON fusa dentro carteReali
// (che tratta solo carte/wishlist carte, vedi ui/cards.ui.js) — stesso
// principio già applicato a prodottiSealedReali in ui/widget-sealed.ui.js:
// array in-memory parallelo, caricato con una query dedicata, editor
// dedicato (i campi sono diversi: integrità invece di condizione, niente
// posizione/prezzo attuale perché non è ancora posseduto).
// ───────────────────────────────────────────────────────────────────────

let wishlistSealedReali = [];
let _wishlistSealedRicercaTesto = '';
let _wishlistSealedCaricato = false;

async function _wishlistSealedApri() {
    if (!_wishlistSealedCaricato) {
        await caricaWishlistSealedReali();
        _wishlistSealedCaricato = true;
    }
    _wishlistSealedRenderElenco();
}

async function caricaWishlistSealedReali() {
    const userId = await authGetUserId();
    if (!userId) return;

    const { data, error } = await wishlistSealedListMie(userId);
    if (error) {
        console.error('Errore caricamento wishlist sealed:', error.message);
        return;
    }

    wishlistSealedReali = (data || []).map(r => ({
        id: r.id,
        name: r.nome || '',
        codice: r.codice || '',
        setEspansione: r.set_espansione || '',
        qty: r.qty || 1,
        lingua: r.lingua || '', // '' = Qualsiasi, stessa convenzione della wishlist carte
        integrita: r.integrita_minima || 'sigillato_integro',
        prezzoObiettivo: r.prezzo_obiettivo != null ? Number(r.prezzo_obiettivo) : null,
        note: r.note || '',
        immagine: r.immagine || null,
    }));
}

function _wishlistSealedCercaInput(valore) {
    _wishlistSealedRicercaTesto = (valore || '').toLowerCase();
    _wishlistSealedRenderElenco();
}

function _wishlistSealedRenderElenco() {
    const elenco = document.getElementById('wishlistSealedElenco');
    if (!elenco) return;

    const eur = (v) => v != null ? formattaEuro(v) : '—'; // formato unico "12.345,00 €" (decisione Claudio 2026-09-25)

    let righe = wishlistSealedReali;
    if (_wishlistSealedRicercaTesto) righe = righe.filter(r => r.name.toLowerCase().includes(_wishlistSealedRicercaTesto));

    if (righe.length === 0) {
        elenco.innerHTML = `<p style="text-align:center; color:var(--text-muted); font-size:0.82rem; padding:1.2rem 0;">${wishlistSealedReali.length === 0 ? 'Nessun prodotto sealed nella wishlist.' : 'Nessun prodotto corrisponde alla ricerca.'}</p>`;
        return;
    }

    elenco.innerHTML = righe.map(r => {
        const immagineSrc = r.immagine ? (_urlImmagineVisualizzabile(r.immagine, 96) || '') : '';
        const fig = immagineSrc
            ? `<img class="pg-fig" src="${immagineSrc}" alt="" onerror="this.style.display='none';">`
            : '<div class="pg-fig"></div>';
        return `
            <div class="pg-riga" data-tocca onclick="apriModificaWishlistSealed('${r.id}')">
                ${fig}
                <div class="pg-testo"><b>${escapeHtml(r.name)}</b><span>×${r.qty} · ${r.lingua ? escapeHtml(r.lingua) : 'Qualsiasi lingua'}</span></div>
                <div class="pg-destra"><b>${eur(r.prezzoObiettivo)}</b>obiettivo</div>
            </div>`;
    }).join('');
}


// ── MODIFICA / ELIMINAZIONE WISHLIST SEALED ──────────────────────────────
let _wishlistSealedInModifica = null;

async function apriModificaWishlistSealed(id) {
    const prodotto = wishlistSealedReali.find(p => String(p.id) === String(id));
    if (!prodotto) return;
    _wishlistSealedInModifica = prodotto;

    document.getElementById('editWsNome').value = prodotto.name;
    document.getElementById('editWsCodice').value = prodotto.codice || '';
    document.getElementById('editWsSet').value = prodotto.setEspansione || '';
    document.getElementById('editWsQty').value = prodotto.qty;
    document.getElementById('editWsPrezzoObiettivo').value = prodotto.prezzoObiettivo != null ? prodotto.prezzoObiettivo : '';
    document.getElementById('editWsNote').value = prodotto.note || '';

    // Lingua: stesso elenco completo delle carte + "Qualsiasi" in testa —
    // ha senso solo qui (preferenza di ricerca per il match, non un dato
    // posseduto). Ricostruita in JS, non statica nell'HTML — stesso motivo
    // del fix su #editLingua in ui/cards-modifica.ui.js.
    const selLingua = document.getElementById('editWsLingua');
    const LINGUE = ['IT', 'EN', 'DE', 'FR', 'ES', 'PT', 'JP', 'KOR', 'CHN', 'CHN-T', 'IND', 'THAI', 'RU'];
    selLingua.innerHTML = '<option value="">Qualsiasi lingua</option>' +
        LINGUE.map(l => `<option value="${l}">${l}</option>`).join('');
    selLingua.value = prodotto.lingua || '';

    // Integrità minima: STESSA fonte unica di ui/entry.ui.js
    // (INTEGRITA_PACKAGING_OPZIONI, dichiarata lì, caricata prima di
    // questo file — vedi ordine in index.html).
    const selIntegrita = document.getElementById('editWsIntegrita');
    selIntegrita.innerHTML = INTEGRITA_PACKAGING_OPZIONI.map(o =>
        `<option value="${o.value}" ${prodotto.integrita === o.value ? 'selected' : ''}>${o.label}</option>`
    ).join('');

    document.getElementById('editWishlistSealedModal').style.display = 'flex';
}


function chiudiModificaWishlistSealed() {
    document.getElementById('editWishlistSealedModal').style.display = 'none';
    _wishlistSealedInModifica = null;
}


async function salvaModificaWishlistSealed() {
    if (!_wishlistSealedInModifica) return;
    const id = _wishlistSealedInModifica.id;

    const num = (elId) => {
        const v = document.getElementById(elId).value;
        return v !== '' ? parseFloat(v) : null;
    };

    const aggiornamento = {
        nome: document.getElementById('editWsNome').value.trim(),
        codice: document.getElementById('editWsCodice').value.trim() || null,
        set_espansione: document.getElementById('editWsSet').value.trim() || null,
        lingua: document.getElementById('editWsLingua').value || null, // '' → null = Qualsiasi (sql/52)
        qty: Math.max(1, parseInt(document.getElementById('editWsQty').value, 10) || 1),
        integrita_minima: document.getElementById('editWsIntegrita').value,
        prezzo_obiettivo: num('editWsPrezzoObiettivo'),
        note: document.getElementById('editWsNote').value.trim() || null,
    };

    const btn = document.getElementById('btnSalvaModificaWishlistSealed');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvataggio...';

    const { error } = await wishlistSealedUpdate(id, aggiornamento);

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Salva Modifiche';

    if (error) {
        alert('❌ Errore nel salvare: ' + error.message);
        return;
    }

    chiudiModificaWishlistSealed();
    await caricaWishlistSealedReali();
    _wishlistSealedRenderElenco();
}


async function eliminaWishlistSealedDaModale() {
    if (!_wishlistSealedInModifica) return;
    const id = _wishlistSealedInModifica.id;
    chiudiModificaWishlistSealed();
    if (!confirm('Eliminare definitivamente questo prodotto dalla Wishlist?\n\nQuesta azione non si può annullare.')) return;
    const { error } = await wishlistSealedDelete(id);
    if (error) {
        alert('❌ Errore nell\'eliminazione: ' + error.message);
        return;
    }
    await caricaWishlistSealedReali();
    _wishlistSealedRenderElenco();
}
