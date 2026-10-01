// ── ui/admin-shop.ui.js ──────────────────────────────────────────────────
// RESTYLE BINDEX FASE 9 (sql/91): sezione "Shop" dell'admin (tavola
// PC-adm-shop). Elenco articoli con stato, venduti e polvere spesa; pannello
// laterale per creare/modificare (immagine, dati, stato, limite per utente,
// regalabile solo per le bustine) e "Ritira dallo Shop" (rimborsa chi lo
// possiede). Tutte le chiamate passano da data/shop.repository.js.

const ADM_SHOP_CATEGORIE = {
    sfere: 'Skin sfere', scaffali: 'Skin scaffali', tema: 'Tema sito', cornici: 'Cornici foto',
    retro: 'Retro carta', bustine: 'Bustine', altro: 'Altro',
};
const ADM_SHOP_STATI = { bozza: 'Bozza', in_vendita: 'In vendita', a_tempo: 'A tempo', ritirato: 'Ritirato' };
let _admShop = { articoli: [], numeri: {}, filtro: 'tutto', aperto: null, nuovaImmagine: null };

async function caricaShopAdmin() {
    const box = document.getElementById('shop-admin-lista');
    if (!box) return;
    const [art, acq] = await Promise.all([shopArticoliLeggi(), shopAdminAcquistiLeggi()]);
    if (art.error) {
        box.innerHTML = '<div class="empty-state">Lo Shop non è ancora pronto: va eseguito sql/91_shop.sql.</div>';
        return;
    }
    _admShop.articoli = art.data || [];
    _admShop.numeri = {};
    (acq.data || []).forEach(a => {
        const n = _admShop.numeri[a.articolo_id] || (_admShop.numeri[a.articolo_id] = { venduti: 0, polvere: 0 });
        if (!a.rimborsato_il) { n.venduti++; n.polvere += Number(a.prezzo) || 0; }
    });
    _admShopDisegna();
}

function admShopFiltro(f) { _admShop.filtro = f; _admShopDisegna(); }

function _admShopDisegna() {
    const box = document.getElementById('shop-admin-lista');
    const conti = document.getElementById('shop-admin-conti');
    const tutti = _admShop.articoli;
    const per = (s) => tutti.filter(a => a.stato === s).length;
    if (conti) conti.textContent = `${tutti.length} oggetti · ${per('in_vendita')} in vendita · ${per('bozza')} bozze · ${per('a_tempo')} a tempo · ${per('ritirato')} ritirati`;
    const filtri = document.getElementById('shop-admin-filtri');
    if (filtri) {
        const c = (k) => tutti.filter(a => a.categoria === k).length;
        filtri.innerHTML = [`<button class="ash-chip${_admShop.filtro === 'tutto' ? ' on' : ''}" onclick="admShopFiltro('tutto')">Tutto (${tutti.length})</button>`]
            .concat(Object.keys(ADM_SHOP_CATEGORIE).filter(k => c(k)).map(k =>
                `<button class="ash-chip${_admShop.filtro === k ? ' on' : ''}" onclick="admShopFiltro('${k}')">${ADM_SHOP_CATEGORIE[k]} (${c(k)})</button>`)).join('');
    }
    const lista = tutti.filter(a => _admShop.filtro === 'tutto' || a.categoria === _admShop.filtro);
    box.innerHTML = lista.length ? `<div class="ash-griglia">${lista.map(a => {
        const n = _admShop.numeri[a.id] || { venduti: 0 };
        const img = a.immagine_path ? `<img src="${escAttr(shopImmagineUrl(a.immagine_path))}" alt="">` : `<span class="ash-noimg">${escAttr((a.nome || '?').slice(0, 1))}</span>`;
        const extra = a.stato === 'a_tempo' && a.fino_al ? `fino al ${new Date(a.fino_al).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}`
            : (a.stato === 'bozza' ? 'non visibile' : (a.regalabile ? `regalabile · ${n.venduti} venduti` : `${n.venduti} venduti`));
        return `<button class="ash-tessera${_admShop.aperto && _admShop.aperto.id === a.id ? ' sel' : ''}" onclick="admShopApri('${a.id}')">
            <span class="ash-img"><span class="ash-stato s-${a.stato}">${ADM_SHOP_STATI[a.stato]}</span>${img}</span>
            <b>${escAttr(a.nome)}</b>
            <span class="ash-sotto">${ADM_SHOP_CATEGORIE[a.categoria] || a.categoria} · ${escAttr(extra)}<em>${a.prezzo} ✧</em></span>
        </button>`;
    }).join('')}</div>` : '<div class="empty-state">Nessun articolo.</div>';
}

function admShopNuovo() {
    _admShop.aperto = { id: '', nome: '', categoria: 'cornici', descrizione: '', prezzo: 100, limite_utente: 1, regalabile: false, stato: 'bozza', fino_al: null, immagine_path: null, stile: {} };
    _admShop.nuovaImmagine = null;
    _admShopPannello();
}

function admShopApri(id) {
    const a = _admShop.articoli.find(x => x.id === id);
    if (!a) return;
    _admShop.aperto = JSON.parse(JSON.stringify(a));
    _admShop.nuovaImmagine = null;
    _admShopPannello();
    _admShopDisegna();
}

function admShopChiudi() {
    document.getElementById('shop-admin-pannello-bg').style.display = 'none';
    _admShop.aperto = null;
    _admShopDisegna();
}

function _admShopPannello() {
    const a = _admShop.aperto;
    const bg = document.getElementById('shop-admin-pannello-bg');
    const corpo = document.getElementById('shop-admin-pannello');
    const n = _admShop.numeri[a.id] || { venduti: 0, polvere: 0 };
    const ritirato = a.stato === 'ritirato';
    const fino = a.fino_al ? new Date(new Date(a.fino_al).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
    const img = _admShop.nuovaImmagine ? URL.createObjectURL(_admShop.nuovaImmagine) : (a.immagine_path ? shopImmagineUrl(a.immagine_path) : '');
    corpo.innerHTML = `
        <div class="ash-p-testa"><div><h2>${escAttr(a.nome || 'Nuovo articolo')}</h2>
            <small>${ADM_SHOP_CATEGORIE[a.categoria] || ''}${a.in_vendita_dal ? ' · in vendita dal ' + new Date(a.in_vendita_dal).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) : ''}</small></div>
            <button class="modal-close" onclick="admShopChiudi()">✕</button></div>
        <h4>Anteprima</h4>
        <div class="ash-p-img"><span>${img ? `<img src="${escAttr(img)}" alt="">` : 'nessuna immagine'}</span>
            <label class="btn-secondary ash-carica">⤒ Carica immagine<input type="file" accept="image/png,image/jpeg,image/webp" onchange="admShopImmagine(this.files[0])" ${ritirato ? 'disabled' : ''}></label>
            <small>PNG trasparente · max 2 MB · la vedono tutti nello Shop</small></div>
        <h4>Dati</h4>
        <div class="ash-campi">
            <input type="text" id="ash-nome" placeholder="Nome" maxlength="60" value="${escAttr(a.nome || '')}">
            <select id="ash-cat" onchange="_admShop.aperto.categoria=this.value; if(this.value!=='bustine') _admShop.aperto.regalabile=false; _admShopPannello()">
                ${Object.keys(ADM_SHOP_CATEGORIE).map(k => `<option value="${k}"${a.categoria === k ? ' selected' : ''}>${ADM_SHOP_CATEGORIE[k]}</option>`).join('')}</select>
            <label class="ash-lab">Prezzo ✧<input type="number" id="ash-prezzo" min="1" max="100000" value="${Number(a.prezzo) || ''}"></label>
            <label class="ash-lab">Limite per utente<input type="number" id="ash-limite" min="1" placeholder="nessuno" value="${a.limite_utente || ''}"></label>
        </div>
        <textarea id="ash-desc" rows="3" maxlength="400" placeholder="Descrizione">${escAttr(a.descrizione || '')}</textarea>
        <label class="ash-lab">Effetto (parametri, avanzato)<input type="text" id="ash-stile" value="${escAttr(JSON.stringify(a.stile || {}))}"></label>
        <h4>Vendita</h4>
        <div class="ash-stati">${['bozza', 'in_vendita', 'a_tempo'].map(s => `<button type="button" class="${a.stato === s ? 'on' : ''}" onclick="_admShopLeggiCampi(); _admShop.aperto.stato='${s}'; _admShopPannello()" ${ritirato ? 'disabled' : ''}>${ADM_SHOP_STATI[s]}</button>`).join('')}<button type="button" class="${ritirato ? 'on' : ''}" disabled>Ritirato</button></div>
        ${a.stato === 'a_tempo' ? `<label class="ash-lab">In vendita fino al<input type="datetime-local" id="ash-fino" value="${fino}"></label>` : ''}
        <div class="ash-riga"><span>Si può regalare<small>solo le bustine</small></span>
            <label class="adm-switch"><input type="checkbox" id="ash-regalo" ${a.regalabile ? 'checked' : ''} ${a.categoria !== 'bustine' || ritirato ? 'disabled' : ''}><span></span></label></div>
        ${a.id ? `<h4>Numeri</h4><div class="ash-campi"><div class="ash-num">Venduti <b>${n.venduti}</b></div><div class="ash-num">Polvere spesa <b>${n.polvere} ✧</b></div></div>` : ''}
        <div class="ash-p-piede">
            ${a.id && !ritirato ? '<button class="btn-small btn-danger" onclick="admShopRitira()">🗄 Ritira dallo Shop</button>' : '<span></span>'}
            ${ritirato ? '<span class="ash-sotto">Ritirato: non si modifica più.</span>' : '<button class="btn-main" id="ash-salva" onclick="admShopSalva()">✓ Salva</button>'}
        </div>`;
    bg.style.display = 'flex';
}

function _admShopLeggiCampi() {
    const a = _admShop.aperto;
    const v = (id) => { const e = document.getElementById(id); return e ? e.value : null; };
    if (v('ash-nome') != null) a.nome = v('ash-nome').trim();
    if (v('ash-prezzo') != null) a.prezzo = parseInt(v('ash-prezzo'), 10) || 0;
    if (v('ash-limite') != null) a.limite_utente = v('ash-limite') ? parseInt(v('ash-limite'), 10) : null;
    if (v('ash-desc') != null) a.descrizione = v('ash-desc');
    if (v('ash-fino') != null) a.fino_al = v('ash-fino') ? new Date(v('ash-fino')).toISOString() : null;
    const r = document.getElementById('ash-regalo'); if (r) a.regalabile = r.checked && a.categoria === 'bustine';
    if (v('ash-stile') != null) { try { a.stile = JSON.parse(v('ash-stile') || '{}'); } catch (_) { a._stileErrato = true; } }
}

function admShopImmagine(file) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { mostraStatus('Immagine troppo grande (max 2 MB).', false); return; }
    _admShopLeggiCampi();
    _admShop.nuovaImmagine = file;
    _admShopPannello();
}

async function admShopSalva() {
    _admShopLeggiCampi();
    const a = _admShop.aperto;
    if (a._stileErrato) { delete a._stileErrato; mostraStatus('Parametri effetto non validi (JSON).', false); return; }
    if (!a.nome) { mostraStatus('Manca il nome.', false); return; }
    if (!(a.prezzo > 0)) { mostraStatus('Prezzo non valido.', false); return; }
    if (a.stato === 'a_tempo' && !a.fino_al) { mostraStatus('"A tempo" vuole una data di fine.', false); return; }
    const btn = document.getElementById('ash-salva'); if (btn) btn.disabled = true;
    try {
        let immaginePath;
        if (_admShop.nuovaImmagine) {
            const f = _admShop.nuovaImmagine;
            const est = (f.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
            immaginePath = `${(a.chiave || 'art')}-${Date.now()}.${est}`;
            const { error: eUp } = await shopAdminCaricaImmagine(immaginePath, f);
            if (eUp) { mostraStatus('Caricamento immagine non riuscito: ' + eUp.message, false); return; }
        }
        const dati = {
            id: a.id || '', chiave: a.chiave || '', nome: a.nome, categoria: a.categoria, descrizione: a.descrizione || '',
            prezzo: a.prezzo, limite_utente: a.limite_utente || '', regalabile: !!a.regalabile, stato: a.stato,
            fino_al: a.stato === 'a_tempo' ? a.fino_al : '', stile: a.stile || {},
        };
        if (immaginePath) dati.immagine_path = immaginePath;
        const { data, error } = await shopAdminSalva(dati);
        if (error) { mostraStatus('Non salvato: ' + error.message, false); return; }
        mostraStatus('Articolo salvato.', true);
        await caricaShopAdmin();
        admShopApri(data);
    } finally { if (btn) btn.disabled = false; }
}

async function admShopRitira() {
    const a = _admShop.aperto;
    const n = (_admShop.numeri[a.id] || { venduti: 0 }).venduti;
    const ok = await adminDialog({
        titolo: 'Ritirare dallo Shop?',
        testo: `"${a.nome}" sparisce dal Negozio.\nChi lo ha nello Zaino riceve indietro la polvere spesa e l'oggetto viene tolto (bustine già consegnate non si rimborsano).\nAcquisti registrati: ${n}.`,
        conferma: 'Ritira e rimborsa', pericolo: true,
    });
    if (!ok) return;
    const { data, error } = await shopAdminRitira(a.id);
    if (error) { mostraStatus('Non riuscito: ' + error.message, false); return; }
    mostraStatus(`Ritirato. Rimborsat${data === 1 ? 'a 1 persona' : 'e ' + (data || 0) + ' persone'}.`, true);
    await caricaShopAdmin();
    admShopApri(a.id);
}
