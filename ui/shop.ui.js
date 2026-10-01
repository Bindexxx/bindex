// ── ui/shop.ui.js ────────────────────────────────────────────────────────
// RESTYLE BINDEX FASE 9 (sql/91): pagina Polvere = Shop, con le schede
// Negozio / Zaino / Movimenti (tavole OK-shop-l, OK-shop-sh, PC-shop-l,
// PC-shop-retro, OK-polvere-mov, PC-polvere-mov-l). Si apre dalla tessera
// Polvere (tab 'shop') e dal saldo ✧ nella barra in alto.
//
// Effetti (decisione Claudio 2026-10-01, "Base + cornici/retro"):
//  - cornici e retro carta si vedono SUBITO nella carta a tutto schermo
//    (shopApplicaAllaCarta, chiamata da apriFlipCardHome);
//  - sfere, scaffali e tema si comprano e si attivano, l'effetto grafico
//    arriva dopo: segnati "In arrivo".
// Nessuna chiamata a Supabase qui: tutto passa da data/shop.repository.js.

const SHOP_CATEGORIE = [
    { id: 'sfere', nome: 'Sfere', sotto: 'skin sfere' },
    { id: 'scaffali', nome: 'Scaffali', sotto: 'skin scaffali' },
    { id: 'tema', nome: 'Tema sito', sotto: 'tema del sito' },
    { id: 'cornici', nome: 'Cornici foto', sotto: 'cornice per la foto' },
    { id: 'retro', nome: 'Retro carta', sotto: 'sul retro della carta' },
    { id: 'bustine', nome: 'Bustine', sotto: 'bustine da aprire' },
    { id: 'altro', nome: 'Altro', sotto: 'altro' },
];
const SHOP_EFFETTO_IN_ARRIVO = ['sfere', 'scaffali', 'tema'];

let _shop = {
    articoli: [], possessi: new Map(), acquisti: [], saldo: null,
    scheda: 'negozio', categoria: 'tutto', selId: null, foglioId: null,
    destinatari: null, regaloA: '', inCorso: false, errore: '', caricato: false,
    movimenti: null, altri: null, filtroMov: 'tutti', mioId: null,
};

// Effetti attivi (cornice / retro) letti anche fuori dalla pagina Shop.
let _shopEffetti = { cornice: null, retro: [] };

function _shopCat(id) { return SHOP_CATEGORIE.find(c => c.id === id) || { id, nome: id, sotto: '' }; }
function _shopEPC() { const s = document.getElementById('shop'); return !!s && s.clientWidth >= 780; }
function _shopNum(n) { return (Number(n) || 0).toLocaleString('it-IT'); }
function _shopInVendita(a) {
    return a.stato === 'in_vendita' || (a.stato === 'a_tempo' && a.fino_al && new Date(a.fino_al) > new Date());
}
function _shopNuovo(a) {
    return _shopInVendita(a) && a.in_vendita_dal && (Date.now() - new Date(a.in_vendita_dal).getTime()) < 7 * 86400000;
}
function _shopEstetico(a) { return a.categoria !== 'bustine' && a.categoria !== 'altro'; }

// ── caricamento ─────────────────────────────────────────────────────────
async function _shopCarica() {
    const userId = await authGetUserId();
    if (!userId) return false;
    _shop.mioId = userId;
    const [art, pos, acq, saldo] = await Promise.all([
        shopArticoliLeggi(), shopPossessiLeggi(userId), shopAcquistiMieiLeggi(), polvereSaldoLeggi(),
    ]);
    if (art.error) { _shop.errore = 'Lo Shop non è ancora pronto (manca sql/91).'; console.error('[shop]', art.error); return false; }
    _shop.articoli = art.data || [];
    _shop.possessi = new Map((pos.data || []).map(p => [String(p.articolo_id), p]));
    _shop.acquisti = acq.data || [];
    if (!saldo.error) _shop.saldo = Number(saldo.data) || 0;
    _shop.caricato = true;
    _shop.errore = '';
    _shopCalcolaEffetti();
    return true;
}

function _shopCalcolaEffetti() {
    const attivi = _shop.articoli.filter(a => { const p = _shop.possessi.get(String(a.id)); return p && p.attivo; });
    const cornice = attivi.find(a => a.categoria === 'cornici');
    _shopEffetti = {
        cornice: cornice ? (cornice.stile && cornice.stile.cornice) || cornice.chiave : null,
        retro: attivi.filter(a => a.categoria === 'retro').map(a => ({ tipo: (a.stile || {}).retro, variante: (a.stile || {}).variante || '' })),
    };
}

// Lettura leggera all'avvio, per avere cornice/retro già pronti alla prima
// carta aperta (nessun errore visibile se lo Shop non esiste ancora).
async function shopCaricaEffetti() {
    try { await _shopCarica(); } catch (e) { console.warn('[shop] effetti:', e); }
}

// ── pagina ──────────────────────────────────────────────────────────────
async function renderPaginaShop(scheda) {
    if (scheda) _shop.scheda = scheda;
    const box = document.getElementById('shopContenuto');
    if (!box) return;
    if (!_shop.caricato) box.innerHTML = '<p class="sh-vuoto">Carico lo Shop…</p>';
    await _shopCarica();
    if (_shop.scheda === 'movimenti') await _shopCaricaMovimenti();
    _shopDisegna();
}

function shopScheda(s) {
    _shop.scheda = s; _shop.foglioId = null; _shop.errore = '';
    if (s === 'movimenti' && !_shop.movimenti) { _shopCaricaMovimenti().then(_shopDisegna); }
    _shopDisegna();
}
function shopCategoria(c) { _shop.categoria = c; _shop.selId = null; _shopDisegna(); }

function _shopDisegna() {
    const box = document.getElementById('shopContenuto');
    if (!box) return;
    const pc = _shopEPC();
    const schede = [['negozio', 'fa-store', 'Negozio'], ['zaino', 'fa-briefcase', 'Zaino'], ['movimenti', 'fa-clock-rotate-left', 'Movimenti']]
        .map(([id, ic, t]) => `<button type="button" class="sh-scheda${_shop.scheda === id ? ' attiva' : ''}" onclick="shopScheda('${id}')"><i class="fa-solid ${ic}"></i> ${t}</button>`).join('');
    const saldo = `<div class="sh-saldo" title="La tua Polvere"><b>${_shop.saldo == null ? '—' : _shopNum(_shop.saldo)}</b><i class="fa-solid fa-wand-magic-sparkles"></i></div>`;
    let corpo = '';
    if (!_shop.caricato) corpo = `<p class="sh-vuoto">${escapeHtml(_shop.errore || 'Lo Shop non è disponibile.')}</p>`;
    else if (_shop.scheda === 'zaino') corpo = _shopZaino();
    else if (_shop.scheda === 'movimenti') corpo = _shopMovimenti(pc);
    else corpo = _shopNegozio(pc);
    box.innerHTML = `
        <div class="sh-testa">
            <div class="sh-testa-titolo"><h2>Shop</h2><p class="sh-solo-pc">spendi la tua Polvere: skin, cornici, sticker per il retro, bustine</p></div>
            <div class="sh-schede sh-solo-pc">${schede}</div>
            ${saldo}
        </div>
        <div class="sh-schede sh-solo-tel">${schede}</div>
        ${corpo}
        ${!pc && _shop.foglioId ? _shopFoglio() : ''}`;
}

// ── NEGOZIO ─────────────────────────────────────────────────────────────
function _shopVisibiliNegozio() {
    // In vendita + quelli che ho già (anche se ritirati dopo: no, i ritirati
    // sono già stati rimborsati e tolti dallo Zaino).
    return _shop.articoli.filter(a => _shopInVendita(a) || (_shop.possessi.has(String(a.id)) && a.stato !== 'ritirato'));
}

function _shopNegozio(pc) {
    const vis = _shopVisibiliNegozio();
    if (!vis.length) return `<div class="sh-pannello"><p class="sh-vuoto">Lo Shop apre presto: non ci sono ancora articoli in vendita.<br><small>Intanto la Polvere si accumula: niente scade.</small></p></div>`;
    const conta = (c) => vis.filter(a => a.categoria === c).length;
    const chips = [`<button type="button" class="sh-chip${_shop.categoria === 'tutto' ? ' attiva' : ''}" onclick="shopCategoria('tutto')">Tutto · ${vis.length}</button>`]
        .concat(SHOP_CATEGORIE.filter(c => conta(c.id)).map(c =>
            `<button type="button" class="sh-chip${_shop.categoria === c.id ? ' attiva' : ''}" onclick="shopCategoria('${c.id}')">${c.nome} · ${conta(c.id)}</button>`)).join('');
    const lista = vis.filter(a => _shop.categoria === 'tutto' || a.categoria === _shop.categoria);
    let inEvidenza = '';
    const nuovo = !pc && _shop.categoria === 'tutto' ? lista.find(_shopNuovo) : null;
    if (nuovo) {
        inEvidenza = `<button type="button" class="sh-evidenza" onclick="shopApri('${nuovo.id}')">
            <span class="sh-ev-anteprima">${_shopAnteprima(nuovo)}</span>
            <span class="sh-ev-testo"><span class="sh-badge-nuovo">NUOVO</span><b>${escapeHtml(nuovo.nome)}</b><span class="sh-prezzo">${_shopNum(nuovo.prezzo)} ✧</span></span>
        </button>`;
    }
    const tessere = lista.filter(a => a !== nuovo).map(a => _shopTessera(a)).join('');
    let nota = '';
    if (_shop.categoria !== 'tutto') {
        const mio = lista.find(a => _shop.possessi.has(String(a.id)));
        if (mio) nota = `<div class="sh-nota"><i class="fa-solid fa-lightbulb"></i> <b>Anche nello Zaino</b><p>${escapeHtml(mio.nome)} è già tuo: lo attivi o lo togli dallo Zaino, senza spendere di nuovo.</p></div>`;
    }
    const griglia = `<div class="sh-pannello"><div class="sh-chips">${chips}</div>${inEvidenza}<div class="sh-griglia">${tessere}</div>${nota}</div>`;
    if (!pc) return griglia;
    const sel = lista.find(a => String(a.id) === String(_shop.selId)) || lista[0];
    if (sel && !_shop.selId) _shop.selId = sel.id;
    return `<div class="sh-due">${griglia}<aside class="sh-pannello sh-dettaglio">${sel ? _shopDettaglio(sel) : ''}</aside></div>`;
}

function _shopTessera(a) {
    const pos = _shop.possessi.get(String(a.id));
    const sel = String(_shop.selId) === String(a.id) && _shopEPC();
    let piede = `<span class="sh-prezzo">${_shopNum(a.prezzo)} ✧</span>`;
    if (pos) piede = pos.attivo ? '<span class="sh-in-uso">In uso</span>' : '<span class="sh-tuo-testo">Nello Zaino</span>';
    const badge = pos ? '<span class="sh-badge-tuo">TUO</span>' : (_shopNuovo(a) ? '<span class="sh-badge-nuovo">NUOVO</span>' : '');
    return `<button type="button" class="sh-tessera${sel ? ' sel' : ''}" onclick="shopApri('${a.id}')">
        <span class="sh-anteprima">${_shopAnteprima(a)}${badge}</span>
        <b>${escapeHtml(a.nome)}</b>
        <span class="sh-sotto">${escapeHtml(_shopCat(a.categoria).sotto)}${SHOP_EFFETTO_IN_ARRIVO.includes(a.categoria) ? ' · <em>effetto in arrivo</em>' : ''}${a.stato === 'a_tempo' ? ` · fino al ${new Date(a.fino_al).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}` : ''}</span>
        ${piede}
    </button>`;
}

// Anteprima: immagine caricata dall'admin, altrimenti un disegno CSS.
function _shopAnteprima(a, grande) {
    if (a.immagine_path) return `<img src="${escapeHtml(shopImmagineUrl(a.immagine_path))}" alt="" loading="lazy">`;
    const s = a.stile || {};
    const cls = grande ? ' grande' : '';
    switch (a.categoria) {
        case 'sfere': return `<span class="sh-pv-sfera v-${escapeHtml(s.sfera || 'base')}${cls}"><i></i></span>`;
        case 'scaffali': return `<span class="sh-pv-scaffale v-${escapeHtml(s.scaffale || 'base')}${cls}"><i></i><i></i><u></u></span>`;
        case 'tema': return `<span class="sh-pv-tema v-${escapeHtml(s.tema || 'base')}${cls}"><i></i><u></u></span>`;
        case 'cornici': return `<span class="sh-pv-carta shop-cornice-${escapeHtml(s.cornice || 'base')}${cls}"><i></i></span>`;
        case 'retro': return `<span class="sh-pv-retro${cls}">${_shopRetroHtml([{ tipo: s.retro, variante: s.variante || '' }], { prezzo: '95 €', cond: 'NM' })}</span>`;
        case 'bustine': return `<span class="sh-pv-bustina${cls}"><i class="fa-solid fa-box-open"></i>${Number(s.bustine) > 1 ? `<b>×${Number(s.bustine)}</b>` : ''}</span>`;
        default: return `<span class="sh-pv-altro${cls}"><i class="fa-solid ${s.ricompensa === 'skip_missione' ? 'fa-forward' : 'fa-gift'}"></i></span>`;
    }
}

function shopApri(id) {
    _shop.errore = '';
    _shop.regaloA = '';
    if (_shopEPC()) { _shop.selId = id; }
    else { _shop.foglioId = id; }
    const a = _shop.articoli.find(x => String(x.id) === String(id));
    if (a && a.regalabile && !_shop.destinatari) {
        shopDestinatariRegalo().then(({ data }) => { _shop.destinatari = data || []; _shopDisegna(); });
    }
    _shopDisegna();
}
function shopChiudiFoglio() { _shop.foglioId = null; _shopDisegna(); }

function _shopDettaglio(a) {
    const pos = _shop.possessi.get(String(a.id));
    const saldo = _shop.saldo || 0;
    const miei = _shop.acquisti.filter(x => String(x.articolo_id) === String(a.id) && String(x.compratore_id) === String(_shop.mioId) && !x.rimborsato_il).length;
    const limiteRaggiunto = a.limite_utente != null && miei >= a.limite_utente;
    let azione;
    if (pos) {
        azione = `<button type="button" class="sh-btn-primario${pos.attivo ? ' spento' : ''}" onclick="shopAttivaArticolo('${a.id}', ${!pos.attivo})" ${_shop.inCorso ? 'disabled' : ''}>
            ${pos.attivo ? '<i class="fa-solid fa-xmark"></i> Togli' : '<i class="fa-solid fa-check"></i> Usa'}</button>
            <p class="sh-piccolo">È già tuo: lo trovi nello Zaino, senza spendere di nuovo.</p>`;
    } else if (!_shopInVendita(a)) {
        azione = '<p class="sh-piccolo">Non è più in vendita.</p>';
    } else if (limiteRaggiunto) {
        azione = `<p class="sh-piccolo">Hai raggiunto il limite per questo articolo (${a.limite_utente}).</p>`;
    } else {
        const manca = a.prezzo - saldo;
        const regalo = a.regalabile ? `<label class="sh-regalo">Per chi?
            <select onchange="_shop.regaloA = this.value; _shopDisegna()">
                <option value="">Per me</option>
                ${(_shop.destinatari || []).map(d => `<option value="${escapeHtml(d.user_id)}"${_shop.regaloA === d.user_id ? ' selected' : ''}>🎁 ${escapeHtml(d.nickname)}</option>`).join('')}
            </select></label>` : '';
        azione = `${regalo}
            <button type="button" class="sh-btn-primario" onclick="shopCompraArticolo('${a.id}')" ${manca > 0 || _shop.inCorso ? 'disabled' : ''}>
                <i class="fa-solid fa-wand-magic-sparkles"></i> ${_shop.regaloA ? 'Regala' : 'Compra'} per ${_shopNum(a.prezzo)} ✧</button>
            <p class="sh-piccolo">${manca > 0 ? `ti mancano ${_shopNum(manca)} ✧` : `ti restano ${_shopNum(saldo - a.prezzo)} ✧${_shopEstetico(a) ? ' · si applica subito, lo trovi nello Zaino' : (a.categoria === 'bustine' ? ' · la trovi nella Bustina' : '')}`}</p>`;
    }
    const nota = SHOP_EFFETTO_IN_ARRIVO.includes(a.categoria)
        ? '<p class="sh-in-arrivo"><i class="fa-solid fa-hourglass-half"></i> Effetto in arrivo: puoi già comprarlo e attivarlo, si vedrà con un prossimo aggiornamento.</p>' : '';
    return `
        <div class="sh-det-anteprima">${_shopAnteprima(a, true)}</div>
        <h3 class="sh-det-nome">${escapeHtml(a.nome)}</h3>
        <p class="sh-det-desc">${escapeHtml(a.descrizione || _shopCat(a.categoria).sotto)}</p>
        ${a.stato === 'a_tempo' ? `<p class="sh-piccolo">In vendita fino al ${new Date(a.fino_al).toLocaleString('it-IT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</p>` : ''}
        ${nota}
        ${_shop.errore ? `<p class="sh-errore">${escapeHtml(_shop.errore)}</p>` : ''}
        ${azione}`;
}

function _shopFoglio() {
    const a = _shop.articoli.find(x => String(x.id) === String(_shop.foglioId));
    if (!a) return '';
    return `<div class="sh-velo" onclick="shopChiudiFoglio()"><div class="sh-foglio" onclick="event.stopPropagation()">
        <div class="sh-maniglia" onclick="shopChiudiFoglio()"></div>${_shopDettaglio(a)}</div></div>`;
}

async function shopCompraArticolo(id) {
    if (_shop.inCorso) return;
    _shop.inCorso = true; _shop.errore = ''; _shopDisegna();
    try {
        const { data, error } = await shopCompra(id, _shop.regaloA || null);
        if (error) { _shop.errore = error.message || 'Acquisto non riuscito'; return; }
        if (data && data.saldo != null) {
            _shop.saldo = Number(data.saldo);
            if (typeof CSBar !== 'undefined') try { CSBar.setCurrency({ value: _shop.saldo, glyph: '✧', label: 'Polvere' }); } catch (_) { /* niente */ }
            if (typeof _widgetPolvereSaldo !== 'undefined') { _widgetPolvereSaldo.valore = _shop.saldo; }
        }
        _shop.regaloA = '';
        _shop.movimenti = null;
        await _shopCarica();
    } catch (e) {
        _shop.errore = 'Acquisto non riuscito: riprova.'; console.error('[shop] compra:', e);
    } finally { _shop.inCorso = false; _shopDisegna(); }
}

async function shopAttivaArticolo(id, attivo) {
    if (_shop.inCorso) return;
    _shop.inCorso = true; _shop.errore = '';
    try {
        const { error } = await shopAttiva(id, attivo);
        if (error) { _shop.errore = error.message || 'Non riuscito'; return; }
        await _shopCarica();
    } catch (e) { console.error('[shop] attiva:', e); }
    finally { _shop.inCorso = false; _shopDisegna(); }
}

// ── ZAINO ───────────────────────────────────────────────────────────────
function _shopZaino() {
    const miei = _shop.articoli.filter(a => _shop.possessi.has(String(a.id)));
    const gruppi = SHOP_CATEGORIE.filter(c => miei.some(a => a.categoria === c.id)).map(c => `
        <h4 class="sh-zaino-cat">${c.nome}</h4>
        <div class="sh-zaino-lista">${miei.filter(a => a.categoria === c.id).map(a => {
            const p = _shop.possessi.get(String(a.id));
            return `<div class="sh-zaino-riga">
                <span class="sh-anteprima mini">${_shopAnteprima(a)}</span>
                <span class="sh-zaino-testo"><b>${escapeHtml(a.nome)}</b><span>${p.attivo ? '<span class="sh-in-uso">In uso</span>' : 'non in uso'}${SHOP_EFFETTO_IN_ARRIVO.includes(a.categoria) ? ' · effetto in arrivo' : ''}</span></span>
                <button type="button" class="sh-btn${p.attivo ? '' : ' primario'}" onclick="shopAttivaArticolo('${a.id}', ${!p.attivo})">${p.attivo ? 'Togli' : 'Usa'}</button>
            </div>`;
        }).join('')}</div>`).join('');
    return `<div class="sh-pannello">
        ${gruppi || '<p class="sh-vuoto">Lo Zaino è vuoto: quello che compri nel Negozio finisce qui.</p>'}
        <div class="sh-zaino-extra">
            <button type="button" class="sh-btn" onclick="apriDettaglioWidget('bustina')"><i class="fa-solid fa-box-open"></i> Bustine: aprile dalla Bustina</button>
        </div>
    </div>`;
}

// ── MOVIMENTI ───────────────────────────────────────────────────────────
async function _shopCaricaMovimenti() {
    try {
        const [mov, altri] = await Promise.all([polvereMovimentiLeggi(), ricompenseAltreLeggi()]);
        _shop.movimenti = mov.error ? [] : (mov.data || []);
        _shop.altri = altri.error ? [] : (altri.data || []);
    } catch (e) { console.error('[shop] movimenti:', e); _shop.movimenti = []; _shop.altri = []; }
}

function _shopFonteMovimento(r) {
    const rif = String(r.riferimento_id || '');
    if (rif === 'doppione') return { fonte: 'doppioni', titolo: 'Doppioni nella bustina', sotto: 'Bustina', icona: 'fa-box-open' };
    if (rif.startsWith('shop:') || rif.startsWith('rimborso:')) {
        const acq = _shop.acquisti.find(x => String(x.id) === rif.split(':')[1]);
        const art = acq ? _shop.articoli.find(a => String(a.id) === String(acq.articolo_id)) : null;
        const nome = art ? art.nome : 'articolo dello Shop';
        if (rif.startsWith('rimborso:')) return { fonte: 'shop', titolo: `Rimborso “${nome}”`, sotto: 'Shop · articolo ritirato', icona: 'fa-rotate-left' };
        const regalo = acq && acq.destinatario_id && String(acq.destinatario_id) !== String(acq.compratore_id);
        return { fonte: 'shop', titolo: `${regalo ? 'Regalo' : 'Acquisto'} “${nome}”`, sotto: 'Shop', icona: regalo ? 'fa-gift' : 'fa-store' };
    }
    const m = (typeof CATALOGO_MISSIONI !== 'undefined') ? CATALOGO_MISSIONI.find(x => x.id === rif) : null;
    if (m) return { fonte: 'missioni', titolo: `Missione “${m.titolo}”`, sotto: m.finestra === 'settimanale' ? 'Missioni della settimana' : 'Missioni', icona: 'fa-bullseye' };
    const t = (typeof CATALOGO_TRAGUARDI !== 'undefined') ? CATALOGO_TRAGUARDI.find(x => x.id === rif) : null;
    if (t) return { fonte: 'traguardi', titolo: `Traguardo “${t.titolo}”`, sotto: 'Traguardi', icona: 'fa-trophy' };
    return { fonte: 'missioni', titolo: 'Ricompensa', sotto: rif, icona: 'fa-star' };
}

function shopFiltroMovimenti(f) { _shop.filtroMov = f; _shopDisegna(); }

function _shopMovimenti(pc) {
    if (!_shop.movimenti) return '<p class="sh-vuoto">Carico i movimenti…</p>';
    const righe = _shop.movimenti.map(r => Object.assign({ r }, _shopFonteMovimento(r)));
    // Settimana: guadagni dal lunedì (i rimborsi non contano come guadagno).
    const lun = new Date(); lun.setHours(0, 0, 0, 0); lun.setDate(lun.getDate() - ((lun.getDay() + 6) % 7));
    const settimana = righe.filter(x => x.r.quantita > 0 && x.fonte !== 'shop' && new Date(x.r.ottenuto_il) >= lun).reduce((t, x) => t + x.r.quantita, 0);
    const fonti = [['missioni', 'Missioni', 'fa-bullseye'], ['traguardi', 'Traguardi', 'fa-trophy'], ['doppioni', 'Doppioni della bustina', 'fa-box-open']];
    const tot = {}; const n = {};
    righe.forEach(x => { if (x.r.quantita > 0 && x.fonte !== 'shop') { tot[x.fonte] = (tot[x.fonte] || 0) + x.r.quantita; n[x.fonte] = (n[x.fonte] || 0) + 1; } });
    const max = Math.max(1, ...fonti.map(f => tot[f[0]] || 0));
    const daDove = `<div class="sh-pannello"><h3>Da dove arriva</h3>${fonti.map(([id, nome, ic]) => `
        <div class="sh-fonte"><span class="sh-ico"><i class="fa-solid ${ic}"></i></span>
            <span class="sh-fonte-testo"><b>${nome}</b> <small>· ${n[id] || 0}</small><span class="sh-barra"><i style="width:${Math.round(((tot[id] || 0) / max) * 100)}%"></i></span></span>
            <b class="sh-fonte-tot">${_shopNum(tot[id] || 0)} ✧</b></div>`).join('')}</div>`;

    const filtri = [['tutti', 'Tutti'], ['missioni', 'Missioni'], ['traguardi', 'Traguardi'], ['doppioni', 'Doppioni'], ['shop', 'Shop']]
        .map(([id, t]) => `<button type="button" class="sh-chip${_shop.filtroMov === id ? ' attiva' : ''}" onclick="shopFiltroMovimenti('${id}')">${t}</button>`).join('');
    const filtrate = righe.filter(x => _shop.filtroMov === 'tutti' || x.fonte === _shop.filtroMov);
    const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
    const etichettaGiorno = (d) => {
        const g = new Date(d); g.setHours(0, 0, 0, 0);
        const diff = Math.round((oggi - g) / 86400000);
        if (diff === 0) return 'Oggi';
        if (diff === 1) return 'Ieri';
        return g.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'short' });
    };
    let ultimo = '';
    const lista = filtrate.slice(0, 150).map(x => {
        const g = etichettaGiorno(x.r.ottenuto_il);
        const testa = g !== ultimo ? `<div class="sh-giorno">${escapeHtml(g)}</div>` : '';
        ultimo = g;
        const ora = new Date(x.r.ottenuto_il).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        const q = Number(x.r.quantita) || 0;
        return `${testa}<div class="sh-mov"><span class="sh-ico"><i class="fa-solid ${x.icona}"></i></span>
            <span class="sh-mov-testo"><b>${escapeHtml(x.titolo)}</b><span>${escapeHtml(x.sotto)} · ${ora}</span></span>
            <b class="sh-mov-q${q < 0 ? ' meno' : ''}">${q > 0 ? '+' : ''}${_shopNum(q)} ✧</b></div>`;
    }).join('') || '<p class="sh-vuoto">Nessun movimento.</p>';
    const movimenti = `<div class="sh-pannello"><h3>Movimenti</h3><div class="sh-chips">${filtri}</div>${lista}</div>`;

    const somma = (tipo) => (_shop.altri || []).filter(r => r.tipo === tipo).reduce((t, r) => t + (Number(r.quantita) || 0), 0);
    const altri = `<div class="sh-pannello"><h3 class="sh-h-piccolo"><i class="fa-solid fa-gift"></i> Altri premi</h3><div class="sh-altri">
        <div><i class="fa-solid fa-box-open"></i><b>${_shopNum(somma('bustina'))}</b><span>bustine da aprire</span></div>
        <div><i class="fa-solid fa-stamp"></i><b>${_shopNum(somma('stampino'))}</b><span>stampini</span></div>
        <div><i class="fa-solid fa-forward"></i><b>${_shopNum(somma('skip_missione'))}</b><span>salta missione</span></div></div></div>`;
    const come = `<div class="sh-pannello"><h3 class="sh-h-piccolo"><i class="fa-solid fa-lightbulb"></i> Come guadagnarne</h3>
        <div class="sh-come"><span class="sh-ico"><i class="fa-solid fa-bullseye"></i></span><span><b>Missioni del giorno</b><small>ogni giorno nuove missioni</small></span><button type="button" class="sh-btn" onclick="apriDettaglioWidget('missioni')">Vai</button></div>
        <div class="sh-come"><span class="sh-ico"><i class="fa-solid fa-trophy"></i></span><span><b>Traguardi</b><small>collezione, valore, scambi</small></span><button type="button" class="sh-btn" onclick="apriDettaglioWidget('achievement')">Vai</button></div>
        <div class="sh-come"><span class="sh-ico"><i class="fa-solid fa-box-open"></i></span><span><b>Doppioni della bustina</b><small>una bustina al giorno · più rara, più polvere</small></span><button type="button" class="sh-btn" onclick="apriDettaglioWidget('bustina')">Vai</button></div></div>`;
    const testa = `<div class="sh-mov-saldo"><b>${_shop.saldo == null ? '—' : _shopNum(_shop.saldo)}</b><i class="fa-solid fa-wand-magic-sparkles"></i>${settimana > 0 ? `<span>+${_shopNum(settimana)} ✧ questa settimana</span>` : ''}</div>`;
    if (pc) return `${testa}<div class="sh-due"><div class="sh-colonna">${daDove}${movimenti}</div><aside class="sh-colonna">${come}${altri}</aside></div>`;
    return `${testa}${daDove}${altri}${movimenti}`;
}

// ── EFFETTI SULLA CARTA A TUTTO SCHERMO ─────────────────────────────────
function _shopRetroHtml(elementi, dati) {
    return (elementi || []).map(e => {
        if (e.tipo === 'sticker') return `<span class="shop-retro-sticker v-${escapeHtml(e.variante)}"><b>${escapeHtml(dati.cond || '—')}</b><i>${escapeHtml(dati.prezzo || '')}</i></span>`;
        if (e.tipo === 'timbro') return `<span class="shop-retro-timbro v-${escapeHtml(e.variante)}">${escapeHtml(dati.cond || '—')}</span>`;
        if (e.tipo === 'medaglia') return `<span class="shop-retro-medaglia v-${escapeHtml(e.variante)}"><i class="fa-solid fa-star"></i></span>`;
        return '';
    }).join('');
}

function shopApplicaAllaCarta(card) {
    const fronte = document.querySelector('#flipCardInner .flip-card-front');
    const retro = document.querySelector('#flipCardInner .flip-card-back');
    if (!fronte || !retro) return;
    fronte.className = fronte.className.replace(/\bshop-cornice-\S+/g, '').trim();
    if (_shopEffetti.cornice) fronte.classList.add('shop-cornice-' + _shopEffetti.cornice);
    let strato = document.getElementById('shopRetroStrato');
    if (!strato) {
        strato = document.createElement('div');
        strato.id = 'shopRetroStrato';
        strato.className = 'shop-retro-strato';
        retro.appendChild(strato);
    }
    strato.innerHTML = card ? _shopRetroHtml(_shopEffetti.retro, { cond: card.cond || '', prezzo: formattaEuro(card.price) }) : '';
}

// Il saldo ✧ nella barra in alto apre lo Shop.
document.addEventListener('click', (e) => {
    const chip = e.target.closest && e.target.closest('.csb-currency');
    if (!chip || typeof apriDettaglioWidget !== 'function') return;
    apriDettaglioWidget('shop');
});

// Telefono ↔ PC: ridisegna (foglio vs pannello).
(function () {
    let t = null, era = null;
    window.addEventListener('resize', () => {
        clearTimeout(t);
        t = setTimeout(() => {
            const s = document.getElementById('shop');
            if (!s || !s.classList.contains('active') || !_shop.caricato) return;
            const ora = _shopEPC();
            if (ora !== era) { era = ora; _shop.foglioId = null; _shopDisegna(); }
        }, 200);
    });
})();
