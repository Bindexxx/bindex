// Widget e pagina Location.

CATALOGO_WIDGET.location = {
        titolo: 'Location', icona: 'fa-map-pin',
        preview: () => {
            const collezione = carteReali.filter(c => c.stato === 'collezione');
            const agg = {};
            collezione.forEach(c => {
                const k = c.location || '—';
                const a = agg[k] || (agg[k] = { nome: k, n: 0, valore: 0 });
                a.n += 1;
                a.valore += (Number(c.price) || 0) * (Number(c.qty) || 1);
            });
            const inAttesa = agg['?'] ? agg['?'].n : 0;
            const voci = Object.values(agg)
                .filter(v => v.nome !== '?' && v.nome !== '—')
                .sort((a, b) => b.valore - a.valore || b.n - a.n);
            if (!voci.length && !inAttesa) return { righe: ['Nessuna carta'] };
            const totale = voci.length;
            return {
                righe: [`${totale} location${inAttesa ? ` · ${inAttesa} in “?”` : ''}`],
                dati: { voci, totale, inAttesa },
            };
        },
        tab: 'location',
};

const _LOC_SISTEMA = ['?', 'SCAMBIO', 'WISHLIST'];
let _locDati = { voci: [], binder: {}, copertine: {}, scambioAuto: new Set(), scambioAutoPronto: false };
let _locSelezione = new Set();
let _locModale = null;
let _locOccupato = false;
let _locOrd = 'valore';
let _locSelezionando = false;
let _locModaleResizeHandler = null;
let _locVista = 'location';          // sql/162: 'location' | 'contenitori'
let _contSel = null;                 // contenitore aperto nel pannello (PC)

function _locSistema(nome) { return _LOC_SISTEMA.includes(String(nome).trim().toUpperCase()); }
function _locInerte(nome) { return nome === '—'; }
function _locModificabile(nome) { return !_locSistema(nome) && !_locInerte(nome); }
function _locRiservata(nome) { return _locSistema(nome) || _locInerte(String(nome).trim()); }
function _locConteggioLive(nome) {
    return carteReali.filter(c => c.stato === 'collezione' && (c.location || '—') === nome).length;
}
function _locVoce(nome) { return _locDati.voci.find(v => v.nome === nome) || null; }
function _locAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }
function _locCarte(n) { return `${n} cart${n === 1 ? 'a' : 'e'}`; }
function _locEur(v) {
    return formattaEuro(v);
}
function _locIconaFallback(nome) {
    const u = String(nome).trim().toUpperCase();
    if (u === '?') return 'fa-circle-question';
    if (u === 'SCAMBIO') return 'fa-right-left';
    if (u === 'WISHLIST') return 'fa-heart';
    if (nome === '—') return 'fa-circle-question';
    return 'fa-box-open';
}

function _locInvalidaCache() {
    _locationDisponibiliCache = null;
    _locationCaricate = false;
    _locationComuneCaricata = false;
}

async function _locDopoModificaCarte() {
    _locInvalidaCache();
    if (typeof caricaCarteReali === 'function') await caricaCarteReali();
    _locSelezione.clear();
    await renderPaginaLocation({ mantieni: true });
}

function _locAssicuraStile() {
    if (document.getElementById('locStileWidget')) return;
    const st = document.createElement('style');
    st.id = 'locStileWidget';
    st.textContent = `
        .loc-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(max(var(--ball-misura-binder, 90px), 110px), 1fr)); gap:0.8rem; margin-top:0.4rem; }
        .loc-tile { cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:0.3rem; padding:0.55rem 0.4rem 0.6rem; border-radius:12px; border:1px solid transparent; transition:background-color .15s ease; min-width:0; }
        .loc-tile:hover { background-color:var(--bg-color); }
        .loc-tile.loc-sel { background:var(--primary-light); border-color:var(--primary); }
        .loc-tile.loc-vuota { background:rgba(211,47,47,.09); border-color:rgba(211,47,47,.55); }
        .loc-cover { position:relative; width:58.2%; margin:0 auto; aspect-ratio:63 / 88; border-radius:10px; background:var(--border-color); display:flex; align-items:center; justify-content:center; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,.12); }
        .loc-cover img { width:100%; height:100%; object-fit:cover; }
        .loc-cover > i.loc-ico { font-size:1.6rem; color:var(--text-muted); }
        .loc-tile.loc-vuota .loc-cover img, .loc-tile.loc-vuota .loc-cover > i.loc-ico { opacity:.45; }
        .loc-check { position:absolute; top:4px; right:4px; width:22px; height:22px; border-radius:50%; background:color-mix(in srgb, var(--card-bg) 88%, transparent); border:1px solid var(--border-color); display:flex; align-items:center; justify-content:center; cursor:pointer; z-index:2; }
        .loc-check input { width:14px; height:14px; margin:0; cursor:pointer; accent-color:var(--primary); }
        .loc-lock { position:absolute; top:4px; right:4px; width:22px; height:22px; border-radius:50%; background:color-mix(in srgb, var(--card-bg) 88%, transparent); display:flex; align-items:center; justify-content:center; font-size:.7rem; color:var(--text-muted); z-index:2; }
        .loc-attesa { position:absolute; top:4px; left:4px; width:22px; height:22px; border-radius:50%; background:#b8860b; color:#fff; display:flex; align-items:center; justify-content:center; font-size:.68rem; z-index:2; }
        .loc-badge-vuota { position:absolute; left:0; right:0; bottom:0; background:var(--danger); color:#fff; font-size:.7rem; font-weight:800; letter-spacing:.08em; text-align:center; padding:3px 0; z-index:2; }
        .loc-nome { font-size:.8rem; font-weight:700; color:var(--text-dark); text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100%; }
        .loc-meta { font-size:.68rem; color:var(--text-muted); text-align:center; line-height:1.25; }
        .loc-meta b { color:var(--text-dark); font-weight:650; }
        .loc-testa { display:flex; align-items:center; justify-content:space-between; gap:10px; }
        .loc-btn { display:inline-flex; align-items:center; justify-content:center; gap:7px; padding:10px 16px; border-radius:999px; border:1px solid var(--border-color); background:var(--card-bg); color:var(--text-dark); font-family:inherit; font-weight:800; font-size:.85rem; cursor:pointer; }
        .loc-btn-pieno { background:var(--primary); border-color:var(--primary); color:var(--on-primary, #fff); }
        .loc-riga-sopra { display:flex; align-items:center; justify-content:space-between; gap:10px; margin:2px 0 12px; }
        .loc-riga-sopra .pg-sotto { margin:0; flex:1; min-width:0; }
        .loc-chips { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px; }
        .loc-chip { padding:7px 13px; border-radius:999px; border:1px solid var(--border-color); background:var(--card-bg); color:var(--text-muted); font-weight:800; font-size:.8rem; cursor:pointer; }
        .loc-chip.attivo { background:var(--primary-light); border-color:var(--primary); color:var(--primary-text, var(--primary)); }
        .loc-barra { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px; }
        .loc-barra button { padding:8px 14px; border-radius:999px; border:1px solid var(--border-color); background:var(--card-bg); color:var(--text-dark); font-family:inherit; font-weight:800; font-size:.8rem; cursor:pointer; }
        .loc-barra-hint { width:100%; font-size:.78rem; color:var(--text-muted); }
        .loc-grid.loc-rest { grid-template-columns:repeat(2, 1fr); gap:12px; }
        @container (min-width:780px) { .loc-grid.loc-rest { grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); } }
        #location { container-type:inline-size; }
        .loc-grid.loc-rest .loc-tile { background:var(--card-bg); border:1px solid var(--border-color); border-radius:18px; padding:14px 12px 14px; gap:6px; position:relative; }
        .loc-grid.loc-rest .loc-tile:hover { border-color:var(--primary); }
        .loc-grid.loc-rest .loc-tile.loc-sel { background:var(--primary-light); border-color:var(--primary); }
        .loc-grid.loc-rest .loc-tile.loc-vuota { background:rgba(211,47,47,.08); border-color:rgba(211,47,47,.5); }
        .loc-grid.loc-rest .loc-cover { width:84px; aspect-ratio:1 / 1; border-radius:16px; background:var(--primary-light); box-shadow:none; }
        .loc-grid.loc-rest .loc-cover > i.loc-ico { font-size:1.9rem; color:var(--text-muted); }
        .loc-grid.loc-rest .loc-nome { font-size:.95rem; font-weight:800; }
        .loc-grid.loc-rest .loc-meta { font-size:.78rem; }
        .loc-bar { width:100%; height:7px; border-radius:999px; background:var(--primary-light); overflow:hidden; margin-top:2px; }
        .loc-bar > span { display:block; height:100%; border-radius:999px; background:var(--primary); }
        .loc-grid.loc-rest .loc-lock { top:10px; right:10px; background:transparent; }
        .loc-grid.loc-rest .loc-check { top:10px; right:10px; }
        .loc-grid.loc-rest .loc-attesa { top:10px; left:10px; }
        .loc-grid.loc-rest .loc-badge-vuota { position:absolute; left:12px; top:10px; right:auto; bottom:auto; border-radius:999px; padding:3px 10px; }
        .loc-pannello { display:none; }
        @container (min-width:780px) {
            #location .pg-pagina { max-width:1240px; }
            .loc-layout { display:grid; grid-template-columns:minmax(0,1fr) 360px; gap:18px; align-items:start; }
            .loc-layout .loc-grid.loc-rest { grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); background:var(--card-bg); border:1px solid var(--border-color); border-radius:18px; padding:14px; }
            .loc-grid.loc-rest .loc-tile.loc-attiva { border-color:var(--primary); box-shadow:0 0 0 2px var(--primary-light); }
            .loc-pannello { display:block; position:sticky; top:8px; background:var(--card-bg); border:1px solid var(--border-color); border-radius:18px; padding:18px; }
        }
        .loc-p-invito { display:flex; flex-direction:column; align-items:center; gap:8px; color:var(--text-muted); padding:2rem 0; text-align:center; }
        .loc-p-invito i { font-size:1.5rem; }
        .loc-p-testa { display:flex; gap:14px; align-items:center; }
        .loc-p-cover { width:72px; height:72px; border-radius:16px; background:var(--primary); color:var(--on-primary, #fff); display:flex; align-items:center; justify-content:center; font-size:1.8rem; overflow:hidden; flex:0 0 auto; }
        .loc-p-cover img { width:100%; height:100%; object-fit:cover; }
        .loc-p-nome { font-size:1.35rem; font-weight:800; color:var(--text-dark); }
        .loc-p-meta { font-size:.8rem; color:var(--text-muted); margin-top:2px; }
        .loc-p-meta b { color:var(--text-dark); }
        .loc-p-azioni { display:flex; flex-wrap:wrap; gap:8px; margin:14px 0 4px; }
        .loc-p-azioni .loc-btn { padding:8px 12px; font-size:.8rem; }
        .loc-p-titolo { display:flex; justify-content:space-between; align-items:baseline; margin-top:14px; }
        .loc-p-titolo b { color:var(--text-dark); }
        .loc-p-titolo span { font-size:.76rem; color:var(--text-muted); }
        .loc-p-lista { max-height:360px; overflow-y:auto; }
        .loc-p-riga { display:flex; align-items:center; gap:10px; padding:9px 0; border-bottom:1px solid var(--border-color); cursor:pointer; }
        .loc-p-riga img, .loc-p-fig { width:26px; height:36px; border-radius:4px; object-fit:cover; flex:0 0 auto; background:var(--primary-light); }
        .loc-p-riga div { flex:1; min-width:0; display:flex; flex-direction:column; }
        .loc-p-riga div b { font-size:.85rem; color:var(--text-dark); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .loc-p-riga div span { font-size:.74rem; color:var(--text-muted); }
        .loc-p-riga > b { font-size:.85rem; color:var(--text-dark); font-variant-numeric:tabular-nums; }
        .loc-p-nota { font-size:.74rem; color:var(--text-muted); margin-top:12px; }
        .loc-scambio-auto { display:flex; align-items:flex-start; gap:10px; margin:12px 0 4px; padding:10px 12px; border:1px solid var(--border-color); border-radius:12px; cursor:pointer; text-align:left; }
        .loc-scambio-auto input { width:auto; margin-top:3px; accent-color:var(--primary); flex:0 0 auto; }
        .loc-scambio-auto b { display:block; font-size:.85rem; color:var(--text-dark); }
        .loc-scambio-auto span { display:block; font-size:.74rem; color:var(--text-muted); margin-top:2px; }
        .loc-scambio-auto.attivo { border-color:var(--primary); background:var(--primary-light); }
        .loc-auto-segno { position:absolute; top:4px; right:4px; width:22px; height:22px; border-radius:50%; background:var(--primary); color:#fff; display:flex; align-items:center; justify-content:center; font-size:.66rem; z-index:2; }
        .loc-grid.loc-rest .loc-auto-segno { top:10px; right:10px; }
        #locGestisciModal.modal-overlay { align-items:stretch; justify-content:stretch; padding:0; }
        #locGestisciModal .modal-content { max-width:none; width:100%; height:100%; max-height:none; }
        #locGestisciModal .loc-mcover { width:120px; margin:0 auto 0.8rem; aspect-ratio:63 / 88; border-radius:12px; background:var(--border-color); display:flex; align-items:center; justify-content:center; overflow:hidden; box-shadow:0 4px 14px rgba(0,0,0,.2); position:relative; }
        #locGestisciModal .loc-mcover img { width:100%; height:100%; object-fit:cover; }
        #locGestisciModal .loc-mcover i { font-size:2.2rem; color:var(--text-muted); }
        #locGestisciModal .loc-mbtn { width:100%; margin-top:0.55rem; }
        #locGestisciModal .loc-mbadge-vuota { display:inline-block; font-size:.78rem; font-weight:800; letter-spacing:.08em; padding:4px 12px; border-radius:999px; background:var(--danger); color:#fff; }
    `;
    document.head.appendChild(st);
}

function _locModalePosiziona() {
    const modal = document.getElementById('locGestisciModal');
    const r = (typeof _rettangoloPaginaSottoBarra === 'function') ? _rettangoloPaginaSottoBarra()
        : (typeof _rettangoloSchermoCornice === 'function') ? _rettangoloSchermoCornice() : null;
    if (!modal || !r) return;
    modal.style.top = r.top + 'px';
    modal.style.left = r.left + 'px';
    modal.style.width = r.width + 'px';
    modal.style.height = r.height + 'px';
    modal.style.borderRadius = r.borderRadius;
    const contenuto = modal.querySelector('.modal-content');
    if (contenuto) contenuto.style.borderRadius = r.borderRadius;
}

function _locAssicuraModale() {
    _locAssicuraStile();
    let m = document.getElementById('locGestisciModal');
    if (m) return m;
    m = document.createElement('div');
    m.id = 'locGestisciModal';
    m.className = 'modal-overlay';
    m.setAttribute('onclick', '_locChiudiModale()');
    m.innerHTML = `
        <div class="modal-content" onclick="event.stopPropagation()">
            <div class="page-header loc-mtesta">
                <button type="button" class="pg-indietro" onclick="_locChiudiModale()" aria-label="Indietro"><i class="fa-solid fa-chevron-left"></i></button>
                <span class="page-title" id="locModaleTitolo" style="flex:1; min-width:0; word-break:break-word;"></span>
            </div>
            <div id="locModaleCorpo" style="max-width:380px; margin:0 auto;"></div>
        </div>`;
    document.body.appendChild(m);
    return m;
}

function _locApriModale(stato) {
    _locModale = stato;
    const modal = _locAssicuraModale();
    _locModaleDisegna();
    modal.style.display = 'flex';
    _locModalePosiziona();
    if (!_locModaleResizeHandler) {
        _locModaleResizeHandler = () => _locModalePosiziona();
        window.addEventListener('resize', _locModaleResizeHandler);
    }
}

function _locChiudiModale() {
    _locModale = null;
    const modal = document.getElementById('locGestisciModal');
    if (modal) modal.style.display = 'none';
    if (_locModaleResizeHandler) {
        window.removeEventListener('resize', _locModaleResizeHandler);
        _locModaleResizeHandler = null;
    }
}

function _locModaleDisegna() {
    const corpo = document.getElementById('locModaleCorpo');
    if (!corpo || !_locModale) return;
    const titoloEl = document.getElementById('locModaleTitolo');
    if (titoloEl) titoloEl.textContent = _locModale.tipo === 'sposta' ? 'Sposta le carte' : (_locModale.tipo === 'contenitore' ? (_locModale.nome ? '📦 ' + _locModale.nome : 'Senza contenitore') : (_locModale.nome || ''));
    if (_locModale.tipo === 'contenitore') { corpo.innerHTML = _contDettaglioHtml(_locModale.nome, true); return; }

    if (_locModale.tipo === 'sposta') {
        const sorgenti = _locModale.sorgenti;
        const totale = sorgenti.reduce((somma, nome) => somma + _locConteggioLive(nome), 0);
        const opzioni = _locDati.voci
            .map(v => v.nome)
            .filter(n => (_locModificabile(n) || n === '?') && !sorgenti.includes(n))
            .map(n => `<option value="${_locAttr(n)}">${escapeHtml(n)}</option>`).join('');
        corpo.innerHTML = `
            <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1rem;">${_locCarte(totale)} da ${sorgenti.map(n => `<b style="color:var(--text-dark);">${escapeHtml(n)}</b>`).join(', ')} in:</p>
            <select id="locDestSelect" class="pg-cerca">
                <option value="">— scegli una location —</option>${opzioni}
            </select>
            <input id="locDestNuova" class="pg-cerca" type="text" style="margin-top:0.55rem;" placeholder="oppure scrivi il nome di una nuova location" onkeydown="if(event.key==='Enter'){event.preventDefault(); _locConfermaSposta();}">
            <p style="font-size:0.72rem; color:var(--text-muted); margin-top:0.6rem;">Le location di partenza NON vengono eliminate: restano, vuote e ben evidenziate.</p>
            <button type="button" class="btn-main loc-mbtn" onclick="_locConfermaSposta()">Sposta</button>
            <button type="button" class="btn-secondary loc-mbtn" onclick="_locChiudiModale()">Annulla</button>`;
        return;
    }

    const nome = _locModale.nome;
    const v = _locVoce(nome);
    if (!v) { corpo.innerHTML = '<p style="color:var(--text-muted);">Location non trovata.</p>'; return; }
    const b = _locDati.binder[nome];
    const url = _locDati.copertine[nome];
    const vuota = v.n === 0 && _locModificabile(nome);
    const cover = url
        ? `<img src="${_locAttr(url)}" alt="${_locAttr(nome)}" onerror="this.remove();">`
        : `<i class="fa-solid ${_locIconaFallback(nome)}"></i>`;
    const meta = vuota
        ? '<span class="loc-mbadge-vuota">VUOTA</span>'
        : `<b style="color:var(--text-dark);">${_locCarte(v.n)}</b> · ${_locEur(v.valore)}`;
    const inAttesa = (b && b.nome_in_attesa)
        ? `<p style="font-size:0.78rem; color:#b8860b; font-weight:600; margin-top:0.6rem;">⏳ Binder: ${escapeHtml(b.nome)} (${escapeHtml(b.nome_in_attesa)} — in attesa di approvazione)</p>` : '';
    const modificabile = _locModificabile(nome);
    const nota = modificabile ? '' : `<p style="font-size:0.78rem; color:var(--text-muted); margin-top:0.6rem;">${
        nome === '?' ? 'Fallback: qui finiscono le carte in attesa di una location. Non si rinomina né si elimina.'
        : _locInerte(nome) ? 'Carte senza location.'
        : 'Contenitore di sistema: ci sono funzioni del sito che si basano su questo nome. Non modificabile.'}</p>`;

    let azioni = '';
    if (v.n > 0) azioni += `<button type="button" class="btn-main loc-mbtn" onclick="_locVediCarte()"><i class="fa-solid fa-eye"></i> Vedi le carte</button>`;
    if (modificabile) {
        azioni += `<button type="button" class="btn-secondary loc-mbtn" onclick="_locRinominaModale()"><i class="fa-solid fa-pen"></i> Rinomina</button>`;
        if (v.n > 0) azioni += `<button type="button" class="btn-secondary loc-mbtn" onclick="_locSpostaModale()"><i class="fa-solid fa-arrow-right"></i> Sposta tutte le carte in un'altra location</button>`;
        if (v.n === 0) azioni += `<button type="button" class="btn-secondary loc-mbtn" style="color:var(--danger);" onclick="_locEliminaModale()"><i class="fa-solid fa-trash"></i> Elimina questa location (è vuota)</button>`;
    }

    corpo.innerHTML = `
        <div class="loc-mcover">${cover}</div>
        <div style="font-size:0.85rem; color:var(--text-muted);">${meta}</div>
        ${inAttesa}${_locScambioAutoHtml(nome)}${nota}
        ${_locContenitoriDellaLocationHtml(nome)}
        <div style="margin-top:0.8rem;">${azioni}</div>`;
}

function _locScambioAutoHtml(nome) {
    if (!_locDati.scambioAutoPronto || !_locModificabile(nome)) return '';
    const attivo = _locDati.scambioAuto.has(nome);
    return `<label class="loc-scambio-auto${attivo ? ' attivo' : ''}">
        <input type="checkbox" ${attivo ? 'checked' : ''} onchange="_locCambiaScambioAuto('${escapeJsAttr(nome)}', this)">
        <div><b><i class="fa-solid fa-right-left"></i> Va in Scambio da sola</b>
        <span>${attivo ? 'Le carte di questa location sono in Scambio con tutte le copie, anche quelle che arrivano.' : 'Le carte che stanno qui vanno in Scambio con tutte le copie; quelle che escono ne escono.'}</span></div>
    </label>`;
}

async function _locCambiaScambioAuto(nome, casella) {
    const attivo = !!casella.checked;
    if (_locOccupato) { casella.checked = !attivo; return; }
    const n = _locConteggioLive(nome);
    const ok = await chiediConferma(attivo
        ? { titolo: `Mandare "${nome}" in Scambio?`, testo: `${_locCarte(n)} vanno in Scambio con tutte le copie. Da ora ci andranno anche le carte che arrivano in "${nome}", e ne usciranno quelle che sposti altrove.`, conferma: 'Attiva' }
        : { titolo: `Togliere "${nome}" dallo Scambio?`, testo: `${_locCarte(n)} escono dallo Scambio, anche quelle che avevi messo a mano.`, conferma: 'Togli', pericolo: true });
    if (!ok) { casella.checked = !attivo; return; }
    _locOccupato = true;
    try {
        const { error } = await locationImpostaScambioAutomatico(nome, attivo);
        if (error) { casella.checked = !attivo; mostraAvviso('❌ Non sono riuscito a cambiare la location: ' + error.message); return; }
        await _locDopoModificaCarte();
        avvisoBreve(attivo ? `"${nome}" va in Scambio da sola.` : `"${nome}" non va più in Scambio.`, { tipo: 'ok' });
    } finally { _locOccupato = false; }
}

function _locApriGestione(i) {
    if (_locOccupato) return;
    const v = _locDati.voci[i];
    if (v) _locApriModale({ tipo: 'gestisci', nome: v.nome });
}
function _locVediCarte() {
    if (!_locModale || _locModale.tipo !== 'gestisci') return;
    const nome = _locModale.nome;
    _locChiudiModale();
    _ballAzioneRiga(null, 'location', nome);
}
async function _locRinominaModale() {
    if (!_locModale || _locModale.tipo !== 'gestisci') return;
    await _locRinomina(_locModale.nome);
}
function _locSpostaModale() {
    if (!_locModale || _locModale.tipo !== 'gestisci') return;
    _locApriSposta([_locModale.nome]);
}
async function _locEliminaModale() {
    if (!_locModale || _locModale.tipo !== 'gestisci') return;
    await _locElimina([_locModale.nome]);
}

async function _locAggiungi() {
    if (_locOccupato) return;
    const nome = ((await chiediTesto({ titolo: 'Nuova location', testo: 'Nome della nuova location:', conferma: 'Crea', maxLength: 60 })) || '').trim();
    if (!nome) return;
    if (_locRiservata(nome)) { mostraAvviso(`"${nome}" è un nome di sistema (già esistente e non modificabile): scegline un altro.`); return; }
    const uguale = _locDati.voci.find(v => String(v.nome).toLowerCase() === nome.toLowerCase());
    if (uguale) { mostraAvviso(`"${uguale.nome}" esiste già.`); return; }

    _locOccupato = true;
    try {
        const userId = await authGetUserId();
        if (!userId) return;
        const { data: esistenti, error: errCheck } = await locationExists(userId, nome);
        if (errCheck) { mostraAvviso('Errore nel controllo: ' + errCheck.message); return; }
        if (esistenti && esistenti.length > 0) { mostraAvviso(`"${nome}" esiste già.`); return; }
        const { error: errIns } = await locationInsert(userId, nome);
        if (errIns) { mostraAvviso('Errore nella creazione: ' + errIns.message); return; }
        _locInvalidaCache();
        await renderPaginaLocation({ mantieni: true });
    } finally { _locOccupato = false; }
}

async function _locRinomina(nome) {
    if (_locOccupato) return;
    if (!_locVoce(nome)) return;
    if (!_locModificabile(nome)) { mostraAvviso(`"${nome}" è un contenitore di sistema: non si può rinominare.`); return; }

    const input = await chiediTesto({ titolo: 'Rinomina location', testo: `Nuovo nome per "${nome}":`, valore: nome, conferma: 'Avanti', maxLength: 60 });
    if (input === null) return;
    const nuovo = input.trim();
    if (!nuovo || nuovo === nome) return;
    if (_locRiservata(nuovo)) { mostraAvviso(`"${nuovo}" è un nome di sistema: scegline un altro.`); return; }
    const uguale = _locDati.voci.find(v => v.nome !== nome && String(v.nome).toLowerCase() === nuovo.toLowerCase());
    if (uguale) { mostraAvviso(`"${uguale.nome}" esiste già. Scegli un altro nome (oppure usa "Sposta tutte le carte" per unirle).`); return; }

    const n = _locConteggioLive(nome);
    if (!(await chiediConferma({ titolo: 'Rinominare la location?', testo: `"${nome}" → "${nuovo}"\n\nSi aggiornano anche le ${_locCarte(n)} di questa location. Il nome del binder collegato cambierà solo dopo l'approvazione di un admin.`, conferma: 'Rinomina' }))) return;

    _locOccupato = true;
    try {
        const { data, error } = await locationRinomina(nome, nuovo);
        if (error) { mostraAvviso('Errore nella rinomina: ' + error.message); return; }

        let notaRichiesta = '';
        if (data && data.proposta_nome && data.binder_id) {
            const userId = await authGetUserId();
            const { error: errRichiesta } = await creaRichiestaPendente(userId, 'binder_nome', { binder_id: data.binder_id, nome_proposto: nuovo });
            if (errRichiesta) {
                console.error('Nome binder in attesa ma richiesta non inviata:', errRichiesta.message);
                notaRichiesta = `Location rinominata. Il nuovo nome del binder è in attesa, ma la richiesta all'admin non è partita (${errRichiesta.message}). Riproponilo dal pannello Design del binder.`;
            }
        }
        _locChiudiModale();
        await _locDopoModificaCarte();
        if (notaRichiesta) mostraAvviso('⚠️ ' + notaRichiesta);
    } finally { _locOccupato = false; }
}

async function _locElimina(nomi) {
    if (_locOccupato || !nomi || nomi.length === 0) return;
    const eliminabili = [];
    const saltate = [];
    nomi.forEach(nome => {
        const n = _locConteggioLive(nome);
        if (!_locModificabile(nome)) saltate.push(`${nome} (contenitore di sistema)`);
        else if (n > 0) saltate.push(`${nome} (${_locCarte(n)})`);
        else eliminabili.push(nome);
    });
    if (eliminabili.length === 0) {
        mostraAvviso(`Nessuna location eliminabile:\n- ${saltate.join('\n- ')}\n\nSi eliminano solo le location VUOTE. Sposta prima le carte.`);
        return;
    }
    let msg = eliminabili.length === 1
        ? `Eliminare la location "${eliminabili[0]}"? È vuota.`
        : `Eliminare ${eliminabili.length} location vuote?\n- ${eliminabili.join('\n- ')}`;
    if (saltate.length > 0) msg += `\n\nNon verranno eliminate:\n- ${saltate.join('\n- ')}`;
    if (!(await chiediConferma({ titolo: 'Eliminare le location?', testo: msg, conferma: 'Elimina', pericolo: true }))) return;

    _locOccupato = true;
    try {
        const userId = await authGetUserId();
        if (!userId) return;
        const { error } = await locationDeleteBatch(userId, eliminabili);
        if (error) { mostraAvviso('Errore nella cancellazione: ' + error.message); return; }
        _locInvalidaCache();
        _locSelezione.clear();
        _locChiudiModale();
        await renderPaginaLocation({ mantieni: true });
    } finally { _locOccupato = false; }
}
function _locEliminaSelezionate() { _locElimina([..._locSelezione]); }

function _locApriSposta(nomi) {
    if (_locOccupato) return;
    const sorgenti = (nomi || []).filter(nome => _locModificabile(nome) && _locConteggioLive(nome) > 0);
    if (sorgenti.length === 0) { mostraAvviso('Nessuna carta da spostare: le location scelte sono vuote.'); return; }
    _locApriModale({ tipo: 'sposta', sorgenti });
    const sel = document.getElementById('locDestSelect');
    if (sel) sel.focus();
}
function _locSpostaSelezionate() { _locApriSposta([..._locSelezione]); }

async function _locConfermaSposta() {
    if (_locOccupato || !_locModale || _locModale.tipo !== 'sposta') return;
    const sorgenti = _locModale.sorgenti;
    const nuovaTesto = ((document.getElementById('locDestNuova') || {}).value || '').trim();
    const scelta = (document.getElementById('locDestSelect') || {}).value || '';

    let destinazione = scelta;
    let daCreare = false;
    if (nuovaTesto) {
        if (_locRiservata(nuovaTesto)) { mostraAvviso(`"${nuovaTesto}" è un nome di sistema: per "?" usa la tendina, gli altri non sono validi come destinazione.`); return; }
        const uguale = _locDati.voci.find(v => String(v.nome).toLowerCase() === nuovaTesto.toLowerCase());
        destinazione = uguale ? uguale.nome : nuovaTesto;
        daCreare = !uguale;
    }
    if (!destinazione) { mostraAvviso('Scegli una location di destinazione oppure scrivine una nuova.'); return; }
    if (sorgenti.includes(destinazione)) { mostraAvviso('La destinazione coincide con una delle location di partenza.'); return; }
    if (_locInerte(destinazione) || (_locSistema(destinazione) && destinazione !== '?')) { mostraAvviso(`"${destinazione}" non è una destinazione valida.`); return; }

    const totale = sorgenti.reduce((somma, nome) => somma + _locConteggioLive(nome), 0);
    if (totale === 0) { mostraAvviso('Nel frattempo non ci sono più carte da spostare.'); return; }
    if (!(await chiediConferma({ titolo: 'Spostare le carte?', testo: `${_locCarte(totale)} da ${sorgenti.map(n => `"${n}"`).join(', ')} in "${destinazione}".\n\nLe location di partenza NON vengono eliminate: restano, vuote e ben evidenziate.`, conferma: 'Sposta' }))) return;

    const primaDi = carteReali
        .filter(c => c.tabella === 'carte' && c.stato === 'collezione' && sorgenti.includes(c.location || '—'))
        .map(c => ({ id: c.id, location: c.location || '' }));

    _locOccupato = true;
    try {
        const userId = await authGetUserId();
        if (!userId) return;
        if (daCreare) {
            const { data: esistenti, error: errCheck } = await locationExists(userId, destinazione);
            if (errCheck) { mostraAvviso('Errore nel controllo: ' + errCheck.message); return; }
            if (!esistenti || esistenti.length === 0) {
                const { error: errIns } = await locationInsert(userId, destinazione);
                if (errIns) { mostraAvviso('Errore nella creazione della location: ' + errIns.message); return; }
            }
        }
        const { error } = await locationSpostaCarte(userId, sorgenti, destinazione);
        if (error) { mostraAvviso('❌ Errore nello spostamento: ' + error.message); return; }
        _locChiudiModale();
        await _locDopoModificaCarte();
        avvisoBreve(`${_locCarte(totale)} in "${destinazione}".`, {
            tipo: 'ok', durata: 6000,
            azione: { etichetta: 'Annulla', fn: () => _locAnnullaSposta(primaDi) },
        });
    } finally { _locOccupato = false; }
}

async function _locAnnullaSposta(primaDi) {
    if (!primaDi || !primaDi.length) return;
    const gruppi = new Map();
    primaDi.forEach(c => { if (!gruppi.has(c.location)) gruppi.set(c.location, []); gruppi.get(c.location).push(c.id); });
    let errore = null;
    for (const [location, ids] of gruppi) {
        const { error } = await cardsUpdateLocationBatch('carte', ids, location);
        if (error) { errore = error; break; }
    }
    await _locDopoModificaCarte();
    if (errore) mostraAvviso('❌ Annullamento non riuscito: ' + errore.message);
    else avvisoBreve('Spostamento annullato.', { tipo: 'ok' });
}

function _locToggleSel(i) {
    const v = _locDati.voci[i];
    if (!v || !_locModificabile(v.nome)) return;
    if (_locSelezione.has(v.nome)) _locSelezione.delete(v.nome); else _locSelezione.add(v.nome);
    _locAggiornaSelezioneUI();
}
function _locSelezionaTutte() {
    const scelte = _locDati.voci.map(v => v.nome).filter(_locModificabile);
    if (scelte.length > 0 && scelte.every(n => _locSelezione.has(n))) _locSelezione.clear();
    else scelte.forEach(n => _locSelezione.add(n));
    _locAggiornaSelezioneUI();
}
function _locAnnullaSelezione() { _locSelezione.clear(); _locAggiornaSelezioneUI(); }

function _locAggiornaSelezioneUI() {
    document.querySelectorAll('#locationContenuto .loc-tile[data-i]').forEach(el => {
        const v = _locDati.voci[Number(el.dataset.i)];
        if (!v) return;
        const sel = _locSelezione.has(v.nome);
        el.classList.toggle('loc-sel', sel);
        const cb = el.querySelector('.loc-check input');
        if (cb) cb.checked = sel;
    });
    const barra = document.getElementById('locBarra');
    if (!barra) return;
    if (!_locSelezionando) { barra.innerHTML = ''; return; }
    const nSel = _locSelezione.size;
    const scelte = _locDati.voci.filter(v => _locModificabile(v.nome));
    const tutteSel = scelte.length > 0 && scelte.every(v => _locSelezione.has(v.nome));
    barra.innerHTML = `
        <div class="loc-barra-hint">Tocca le location da spostare o eliminare in blocco.</div>
        <button onclick="_locSelezionaTutte()">${tutteSel ? 'Deseleziona tutte' : 'Seleziona tutte'}</button>
        ${nSel > 0 ? `
        <button onclick="_locSpostaSelezionate()"><i class="fa-solid fa-arrow-right"></i> Sposta carte (${nSel})</button>
        <button onclick="_locEliminaSelezionate()" style="color:var(--danger);"><i class="fa-solid fa-trash"></i> Elimina (${nSel})</button>
        <button onclick="_locAnnullaSelezione()">Annulla</button>` : ''}`;
}

function _locOrdina() {
    const voci = _locDati.voci;
    const conCarte = (v) => (v.n > 0 ? 1 : 0);
    if (_locOrd === 'az') voci.sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
    else if (_locOrd === 'carte') voci.sort((a, b) => b.n - a.n || b.valore - a.valore || String(a.nome).localeCompare(String(b.nome)));
    else voci.sort((a, b) => conCarte(b) - conCarte(a) || b.valore - a.valore || b.n - a.n || String(a.nome).localeCompare(String(b.nome)));
}

function _locImpostaOrdine(o) { _locOrd = o; prefFiltroPaginaSet('location', 'ordine', o); _locDisegna(); }

function _locToggleSeleziona() {
    _locSelezionando = !_locSelezionando;
    if (!_locSelezionando) _locSelezione.clear();
    _locDisegna();
}

function _locClicTessera(i) {
    if (_locSelezionando) { _locToggleSel(i); return; }
    if (_locEPC()) {
        const v = _locDati.voci[i];
        if (!v) return;
        _locPannelloNome = v.nome;
        document.querySelectorAll('#location .loc-tile').forEach(t => t.classList.toggle('loc-attiva', t.dataset.i === String(i)));
        _locPannelloDisegna();
        return;
    }
    _locApriGestione(i);
}

let _locPannelloNome = null;
function _locEPC() { const s = document.getElementById('location'); return !!s && s.clientWidth >= 780; }

function _locPannelloDisegna() {
    const box = document.getElementById('locPannello');
    if (!box) return;
    const v = _locPannelloNome != null ? _locVoce(_locPannelloNome) : null;
    if (!v) { box.innerHTML = '<div class="loc-p-invito"><i class="fa-regular fa-hand-pointer"></i><b>Clicca una location per gestirla qui</b></div>'; return; }
    const nome = v.nome;
    const b = _locDati.binder[nome];
    const url = _locDati.copertine[nome];
    const modificabile = _locModificabile(nome);
    const totale = _locDati.voci.reduce((t, x) => t + x.valore, 0);
    const perc = totale > 0 && v.valore > 0 ? Math.round(v.valore / totale * 100) : 0;
    const cover = url ? `<img src="${_locAttr(url)}" alt="" onerror="this.remove();">` : `<i class="fa-solid ${_locIconaFallback(nome)}"></i>`;
    const carte = carteReali.filter(c => c.stato === 'collezione' && (c.location || '—') === nome)
        .sort((a, b2) => (Number(b2.price) || 0) * (Number(b2.qty) || 1) - (Number(a.price) || 0) * (Number(a.qty) || 1));
    const righe = carte.map(c => {
        const src = c.immagine ? (_urlImmagineVisualizzabile(c.immagine, 96) || '') : '';
        const q = Number(c.qty) || 1;
        return `<div class="loc-p-riga" onclick="apriFlipCardHome('${escapeJsAttr(String(c.id))}')">
            ${src ? `<img src="${src}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : '<span class="loc-p-fig"></span>'}
            <div><b>${escapeHtml(c.name || '—')}</b><span>${q > 1 ? `x${q} · ${formattaEuro(c.price)} cad.` : formattaEuro(c.price)}</span></div>
            <b>${formattaEuro((Number(c.price) || 0) * q)}</b></div>`;
    }).join('');
    const btn = [];
    if (v.n > 0) btn.push(`<button type="button" class="loc-btn loc-btn-pieno" onclick="_ballAzioneRiga(null, 'location', '${escapeJsAttr(nome)}')"><i class="fa-solid fa-eye"></i> Vedi in Collezione</button>`);
    if (modificabile) btn.push(`<button type="button" class="loc-btn" onclick="_locRinomina('${escapeJsAttr(nome)}')"><i class="fa-solid fa-pen"></i> Rinomina</button>`);
    if (modificabile && v.n > 0) btn.push(`<button type="button" class="loc-btn" onclick="_locApriSposta(['${escapeJsAttr(nome)}'])"><i class="fa-solid fa-arrow-right"></i> Sposta tutte le carte</button>`);
    if (modificabile && v.n === 0) btn.push(`<button type="button" class="loc-btn" style="color:var(--danger);" onclick="_locElimina(['${escapeJsAttr(nome)}'])"><i class="fa-solid fa-trash"></i> Elimina (è vuota)</button>`);
    const nota = modificabile ? 'Elimina compare solo quando la location è vuota. Le location vuote non spariscono mai da sole.'
        : (nome === '?' ? 'Qui finiscono le carte in attesa di una location: non si rinomina né si elimina.' : 'Contenitore di sistema: non modificabile.');
    box.innerHTML = `
        <div class="loc-p-testa">
            <div class="loc-p-cover">${cover}</div>
            <div><div class="loc-p-nome">${escapeHtml(nome)}</div>
                <div class="loc-p-meta"><b>${_locCarte(v.n)}</b> · ${_locEur(v.valore)}${perc ? ` · ${perc}% del valore` : ''}</div>
                ${b ? `<div class="loc-p-meta"><i class="fa-solid fa-book"></i> collegata al binder “${escapeHtml(b.nome || nome)}”${b.nome_in_attesa ? ` (in attesa: ${escapeHtml(b.nome_in_attesa)})` : ''}</div>` : ''}</div>
        </div>
        <div class="loc-p-azioni">${btn.join('')}</div>
        ${_locScambioAutoHtml(nome)}
        ${_locContenitoriDellaLocationHtml(nome)}
        ${carte.length ? `<div class="loc-p-titolo"><b>Carte in questa location</b><span>per valore</span></div><div class="loc-p-lista">${righe}</div>` : ''}
        <p class="loc-p-nota">${nota}</p>`;
}

function _locDisegna() {
    const container = document.getElementById('locationContenuto');
    if (!container) return;
    _locAssicuraStile();
    if (_locVista === 'contenitori') { _contDisegna(container); return; }
    _locOrdina();
    const voci = _locDati.voci;

    if (voci.length === 0) {
        container.innerHTML = `
            <div class="page-header">
                <span class="page-title">Location</span>
            </div>
            ${_locVisteHtml()}
            <div class="stato-vuoto"><i class="fa-solid fa-map-pin"></i><br>Nessuna carta ha ancora una location.</div>
            <div class="pg-bottoni" style="justify-content:center;">
                <button class="primario" onclick="_locAggiungi()">+ Crea la prima location</button>
            </div>
        `;
        return;
    }

    const top = voci.reduce((m, v) => (v.valore > (m ? m.valore : 0) ? v : m), null);
    const maxValore = Math.max(0, ...voci.map(v => v.valore));

    const tessere = voci.map((v, i) => {
        const { nome, n, valore } = v;
        const modificabile = _locModificabile(nome);
        const sistema = _locSistema(nome);
        const vuota = n === 0 && modificabile;
        const b = _locDati.binder[nome];
        const url = _locDati.copertine[nome];
        const sel = _locSelezione.has(nome);
        const cover = url
            ? `<img src="${_locAttr(url)}" alt="${_locAttr(nome)}" loading="lazy" onerror="this.outerHTML='<i class=&quot;fa-solid ${_locIconaFallback(nome)} loc-ico&quot;></i>';">`
            : `<i class="fa-solid ${_locIconaFallback(nome)} loc-ico"></i>`;
        const check = (modificabile && _locSelezionando)
            ? `<label class="loc-check" title="Seleziona" onclick="event.stopPropagation();"><input type="checkbox" ${sel ? 'checked' : ''} onclick="event.stopPropagation(); _locToggleSel(${i})"></label>`
            : (sistema ? '<span class="loc-lock" title="Contenitore di sistema"><i class="fa-solid fa-lock"></i></span>' : '');
        const attesa = (b && b.nome_in_attesa)
            ? `<span class="loc-attesa" title="${_locAttr(`Binder: ${b.nome} (${b.nome_in_attesa} — in attesa di approvazione)`)}"><i class="fa-solid fa-hourglass-half"></i></span>` : '';
        const badge = (vuota ? '<span class="loc-badge-vuota">VUOTA</span>' : '')
            + (_locDati.scambioAuto.has(nome) ? '<span class="loc-auto-segno" title="Va in Scambio da sola"><i class="fa-solid fa-right-left"></i></span>' : '');
        const meta = vuota
            ? '<div class="loc-meta">0 carte</div>'
            : (nome === '?' && n === 0
                ? '<div class="loc-meta">0 carte<br>in attesa di una location</div>'
                : `<div class="loc-meta"><b>${n}</b> ${n === 1 ? 'carta' : 'carte'} &middot; ${_locEur(valore)}</div>`);
        const perc = maxValore > 0 ? Math.max(valore > 0 ? 3 : 0, Math.round((valore / maxValore) * 100)) : 0;
        const barra = (!vuota && !(nome === '?' && n === 0)) ? `<div class="loc-bar"><span style="width:${perc}%;"></span></div>` : '';
        return `
            <div class="loc-tile${vuota ? ' loc-vuota' : ''}${sel ? ' loc-sel' : ''}" data-i="${i}" title="${_locAttr(nome)}" onclick="_locClicTessera(${i})">
                ${badge}${check}${attesa}
                <div class="loc-cover">${cover}</div>
                <div class="loc-nome">${escapeHtml(nome)}</div>
                ${meta}
                ${barra}
            </div>`;
    }).join('');

    const chip = (o, etichetta) => `<span class="loc-chip${_locOrd === o ? ' attivo' : ''}" onclick="_locImpostaOrdine('${o}')">${etichetta}</span>`;
    container.innerHTML = `
        <div class="pg-pagina">
            <div class="page-header loc-testa">
                <span class="page-title">Location</span>
                <button type="button" class="loc-btn loc-btn-pieno" onclick="_locAggiungi()"><i class="fa-solid fa-plus"></i> Nuova location</button>
            </div>
            ${_locVisteHtml()}
            <div class="loc-riga-sopra">
                <div class="pg-sotto"><b>${voci.length} location</b>${top ? ` &middot; la più preziosa è ${escapeHtml(top.nome)}` : ''}</div>
                <button type="button" class="loc-btn" onclick="_locToggleSeleziona()"><i class="fa-solid ${_locSelezionando ? 'fa-square-check' : 'fa-square-check'}"></i> ${_locSelezionando ? 'Fine' : 'Seleziona'}</button>
            </div>
            <div class="loc-chips">${chip('valore', 'Per valore')}${chip('carte', 'Per numero di carte')}${chip('az', 'A → Z')}</div>
            <div class="loc-barra" id="locBarra"></div>
            <div class="loc-layout">
                <div class="loc-grid loc-rest">${tessere}</div>
                <div class="loc-pannello" id="locPannello"></div>
            </div>
        </div>
    `;
    _locAggiornaSelezioneUI();
    if (_locPannelloNome == null || !_locVoce(_locPannelloNome)) _locPannelloNome = voci.length ? voci[0].nome : null;
    const iSel = voci.findIndex(v => v.nome === _locPannelloNome);
    if (iSel >= 0) container.querySelector(`.loc-tile[data-i="${iSel}"]`)?.classList.add('loc-attiva');
    _locPannelloDisegna();
}

async function renderPaginaLocation(opzioni) {
    const container = document.getElementById('locationContenuto');
    if (!container) return;
    _locAssicuraStile();

    const mantieni = !!(opzioni && opzioni.mantieni === true);
    if (!mantieni) {
        _locSelezione.clear();
        _locSelezionando = false;
        _locOrd = prefFiltroPaginaScegli('location', 'ordine', ['valore', 'carte', 'az'], 'valore');
        _locVista = prefFiltroPaginaScegli('location', 'vista', ['location', 'contenitori'], 'location');
        _locChiudiModale();
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Caricamento…</p>';
    }

    const agg = {};
    try {
        carteReali.filter(c => c.stato === 'collezione').forEach(c => {
            const k = c.location || '—';
            const a = agg[k] || (agg[k] = { nome: k, n: 0, valore: 0 });
            a.n += 1;
            a.valore += (Number(c.price) || 0) * (Number(c.qty) || 1);
        });
    } catch (e) {
        console.error('renderPaginaLocation:', e);
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Errore nel caricamento.</p>';
        return;
    }
    const voci = Object.values(agg);

    const binder = {};
    const copertine = {};
    const scambioAuto = new Set();
    let scambioAutoPronto = false;
    const userId = await authGetUserId();
    if (userId) {
        try {
            const { data, error } = await locationsScambioAutomatico(userId);
            if (error) throw error;
            (data || []).forEach(r => { if (r.scambio_automatico) scambioAuto.add(r.nome); });
            scambioAutoPronto = true;
        } catch (e) {
            console.error('renderPaginaLocation (scambio automatico):', e && e.message);
        }
        try {
            const { data: tutte, error } = await locationsList(userId);
            if (error) throw error;
            const nomiConCarte = new Set(voci.map(v => v.nome));
            (tutte || []).forEach(r => {
                if (r.nome && !nomiConCarte.has(r.nome)) voci.push({ nome: r.nome, n: 0, valore: 0 });
            });
        } catch (e) {
            console.error('renderPaginaLocation (locationsList):', e);
        }
        try {
            const { data: binders, error } = await bindersQueryTutti(userId);
            if (error) throw error;
            (binders || []).filter(b => b.tipo === 'location' && b.location_valore).forEach(b => { binder[b.location_valore] = b; });
            if (typeof _risolviCopertinaBinder === 'function') {
                await Promise.all(voci.map(async v => {
                    const b = binder[v.nome];
                    if (!b) return;
                    try { copertine[v.nome] = await _risolviCopertinaBinder(userId, b); }
                    catch (e) { console.error('renderPaginaLocation (copertina):', e); }
                }));
            }
        } catch (e) {
            console.error('renderPaginaLocation (binders):', e);
        }
    }

    voci.sort((a, b) => (b.n > 0) - (a.n > 0)
        || b.valore - a.valore
        || b.n - a.n
        || String(a.nome).localeCompare(String(b.nome)));

    let contenitori = [];
    if (userId) {
        try {
            const { data, error } = await contenitoriList(userId);
            if (error) throw error;
            contenitori = (data || []).map(r => r.nome);
        } catch (e) {
            console.error('renderPaginaLocation (contenitori):', e && e.message);
        }
    }

    _locDati = { voci, binder, copertine, scambioAuto, scambioAutoPronto, contenitori };
    const nomi = new Set(voci.map(v => v.nome));
    _locSelezione = new Set([..._locSelezione].filter(n => nomi.has(n)));
    if (_locModale) {
        const ok = _locModale.tipo === 'contenitore' ? (!_locModale.nome || _contVoci().some(v => v.nome === _locModale.nome))
            : _locModale.tipo === 'gestisci' ? nomi.has(_locModale.nome) : _locModale.sorgenti.every(n => nomi.has(n));
        if (!ok) _locChiudiModale(); else _locModaleDisegna();
    }

    _locDisegna();
}


// ─────────────────────────── Contenitori (sql/162) ───────────────────────────
// Dove sta fisicamente una carta (Toploader, Binder Scambi…), facoltativo e a parte dalla location:
// un contenitore può avere carte di più location. Sulla carta è location_secondaria.

function _locVisteHtml() {
    const b = (v, et, ico) => `<span class="loc-chip${_locVista === v ? ' attivo' : ''}" onclick="_locImpostaVista('${v}')"><i class="fa-solid ${ico}"></i> ${et}</span>`;
    return `<div class="loc-chips loc-viste">${b('location', 'Location', 'fa-map-pin')}${b('contenitori', 'Contenitori', 'fa-box-archive')}</div>`;
}

function _locImpostaVista(v) {
    _locVista = v === 'contenitori' ? 'contenitori' : 'location';
    prefFiltroPaginaSet('location', 'vista', _locVista);
    _locSelezionando = false;
    _locSelezione.clear();
    _locDisegna();
}

function _contCarte() {
    return carteReali.filter(c => c.tabella === 'carte' && c.stato === 'collezione');
}

// I contenitori: quelli dell'elenco (anche vuoti) e quelli scritti sulle carte. Ognuno con quante
// carte ha, il valore e come si dividono per location.
function _contVoci() {
    const voci = new Map();
    const voce = (nome) => {
        const k = nome.toLowerCase();
        if (!voci.has(k)) voci.set(k, { nome, n: 0, valore: 0, perLoc: new Map() });
        return voci.get(k);
    };
    (_locDati.contenitori || []).forEach(voce);
    _contCarte().forEach(c => {
        if (!c.locationSecondaria) return;
        const v = voce(c.locationSecondaria);
        const val = (Number(c.price) || 0) * (Number(c.qty) || 1);
        v.n += 1; v.valore += val;
        const loc = c.location || '—';
        const l = v.perLoc.get(loc) || { n: 0, valore: 0 };
        l.n += 1; l.valore += val;
        v.perLoc.set(loc, l);
    });
    return [...voci.values()].sort((a, b) => (b.n > 0) - (a.n > 0) || b.valore - a.valore || a.nome.localeCompare(b.nome, 'it', { sensitivity: 'base' }));
}

function _contSenza() {
    const s = { nome: '', n: 0, valore: 0, perLoc: new Map() };
    _contCarte().forEach(c => {
        if (c.locationSecondaria) return;
        const val = (Number(c.price) || 0) * (Number(c.qty) || 1);
        s.n += 1; s.valore += val;
        const loc = c.location || '—';
        const l = s.perLoc.get(loc) || { n: 0, valore: 0 };
        l.n += 1; l.valore += val;
        s.perLoc.set(loc, l);
    });
    return s;
}

function _contVoce(nome) {
    if (!nome) return _contSenza();
    return _contVoci().find(v => v.nome === nome) || null;
}

function _contRiassuntoLoc(v, quante = 3) {
    const voci = [...v.perLoc.entries()].sort((a, b) => b[1].n - a[1].n);
    const testo = voci.slice(0, quante).map(([n, x]) => `${escapeHtml(n)} ${x.n}`).join(' · ');
    return testo + (voci.length > quante ? ` · +${voci.length - quante}` : '');
}

function _contDisegna(container) {
    const voci = _contVoci();
    const senza = _contSenza();
    const tessera = (v, i) => {
        const vuoto = v.n === 0;
        return `
            <div class="loc-tile${vuoto ? ' loc-vuota' : ''}${_contSel === v.nome ? ' loc-attiva' : ''}" data-cont="${i}" title="${_locAttr(v.nome || 'Senza contenitore')}" onclick="_contClic(${i})">
                ${vuoto ? '<span class="loc-badge-vuota">VUOTO</span>' : ''}
                <div class="loc-cover"><i class="fa-solid ${v.nome ? 'fa-box-archive' : 'fa-circle-question'} loc-ico"></i></div>
                <div class="loc-nome">${v.nome ? escapeHtml(v.nome) : 'Senza contenitore'}</div>
                <div class="loc-meta"><b>${v.n}</b> ${v.n === 1 ? 'carta' : 'carte'}${v.n ? ` &middot; ${_locEur(v.valore)}` : ''}</div>
                ${v.n ? `<div class="loc-meta">${_contRiassuntoLoc(v)}</div>` : ''}
            </div>`;
    };
    const tutte = [...voci, ...(senza.n ? [senza] : [])];
    window._contVociDisegnate = tutte;
    if (_contSel != null && !tutte.some(v => v.nome === _contSel)) _contSel = null;
    if (_contSel == null && tutte.length) _contSel = tutte[0].nome;
    container.innerHTML = `
        <div class="pg-pagina">
            <div class="page-header loc-testa">
                <span class="page-title">Contenitori</span>
                <button type="button" class="loc-btn loc-btn-pieno" onclick="_contCrea()"><i class="fa-solid fa-plus"></i> Nuovo contenitore</button>
            </div>
            ${_locVisteHtml()}
            <div class="loc-riga-sopra"><div class="pg-sotto">Dove stanno fisicamente le carte. È facoltativo: la location (il gruppo) non cambia, e in un contenitore possono stare carte di più location.</div></div>
            ${tutte.length ? `<div class="loc-layout">
                <div class="loc-grid loc-rest">${tutte.map(tessera).join('')}</div>
                <div class="loc-pannello" id="locPannello"></div>
            </div>` : `<div class="stato-vuoto"><i class="fa-solid fa-box-archive"></i><br>Nessun contenitore. Creane uno, oppure scegline uno dalle carte (Modifica, selezione multipla, Inserimento, Import CSV).</div>`}
        </div>`;
    const box = document.getElementById('locPannello');
    if (box) box.innerHTML = _contSel === null ? '' : _contDettaglioHtml(_contSel, false);
}

function _contClic(i) {
    const v = (window._contVociDisegnate || [])[i];
    if (!v) return;
    if (_locEPC()) {
        _contSel = v.nome;
        document.querySelectorAll('#location .loc-tile[data-cont]').forEach(t => t.classList.toggle('loc-attiva', t.dataset.cont === String(i)));
        const box = document.getElementById('locPannello');
        if (box) box.innerHTML = _contDettaglioHtml(v.nome, false);
        return;
    }
    _locApriModale({ tipo: 'contenitore', nome: v.nome });
}

function _contDettaglioHtml(nome, inModale) {
    const v = _contVoce(nome);
    if (!v) return '<p style="color:var(--text-muted);">Contenitore non trovato.</p>';
    const j = escapeJsAttr(nome || '');
    const righe = [...v.perLoc.entries()].sort((a, b) => b[1].valore - a[1].valore || b[1].n - a[1].n).map(([loc, x]) => `
        <div class="loc-p-riga" onclick="_contVediCarte('${j}', '${escapeJsAttr(loc)}')">
            <span class="loc-p-fig" style="display:flex; align-items:center; justify-content:center; height:26px;"><i class="fa-solid fa-map-pin" style="font-size:.75rem; color:var(--text-muted);"></i></span>
            <div><b>${escapeHtml(loc)}</b><span>${x.n} ${x.n === 1 ? 'carta' : 'carte'}</span></div>
            <b>${_locEur(x.valore)}</b></div>`).join('');
    const bottone = inModale ? 'loc-mbtn' : '';
    const btn = [];
    if (v.n > 0) btn.push(`<button type="button" class="${inModale ? 'btn-main' : 'loc-btn loc-btn-pieno'} ${bottone}" onclick="_contVediCarte('${j}', '')"><i class="fa-solid fa-eye"></i> Vedi in Collezione</button>`);
    if (nome) {
        btn.push(`<button type="button" class="${inModale ? 'btn-secondary' : 'loc-btn'} ${bottone}" onclick="_contRinomina('${j}')"><i class="fa-solid fa-pen"></i> Rinomina</button>`);
        if (v.n > 0) btn.push(`<button type="button" class="${inModale ? 'btn-secondary' : 'loc-btn'} ${bottone}" onclick="_contSvuota('${j}', false)"><i class="fa-solid fa-eraser"></i> Svuota</button>`);
        btn.push(`<button type="button" class="${inModale ? 'btn-secondary' : 'loc-btn'} ${bottone}" style="color:var(--danger);" onclick="_contSvuota('${j}', true)"><i class="fa-solid fa-trash"></i> Elimina</button>`);
    }
    const nota = nome
        ? 'Svuota toglie il contenitore dalle carte (restano nella loro location). Elimina fa lo stesso e toglie il contenitore dall\'elenco.'
        : 'Le carte della collezione che non hanno un contenitore.';
    return `
        <div class="loc-p-testa">
            <div class="loc-p-cover"><i class="fa-solid ${nome ? 'fa-box-archive' : 'fa-circle-question'}"></i></div>
            <div><div class="loc-p-nome">${nome ? escapeHtml(nome) : 'Senza contenitore'}</div>
                <div class="loc-p-meta"><b>${v.n} ${v.n === 1 ? 'carta' : 'carte'}</b>${v.n ? ` · ${_locEur(v.valore)}` : ''}${v.perLoc.size ? ` · ${v.perLoc.size} location` : ''}</div></div>
        </div>
        <div class="loc-p-azioni">${btn.join('')}</div>
        ${righe ? `<div class="loc-p-titolo"><b>Per location</b><span>tocca per vedere le carte</span></div><div class="loc-p-lista">${righe}</div>` : ''}
        <p class="loc-p-nota">${nota}</p>`;
}

// Nella location: in quali contenitori stanno le sue carte.
function _locContenitoriDellaLocationHtml(nomeLocation) {
    const carte = _contCarte().filter(c => (c.location || '—') === nomeLocation);
    if (!carte.length || !carte.some(c => c.locationSecondaria)) return '';
    const conti = new Map();
    carte.forEach(c => { const k = c.locationSecondaria || ''; conti.set(k, (conti.get(k) || 0) + 1); });
    const voci = [...conti.entries()].sort((a, b) => (a[0] === '') - (b[0] === '') || b[1] - a[1]).map(([k, n]) =>
        `<span class="loc-chip" onclick="_contVediCarte('${escapeJsAttr(k)}', '${escapeJsAttr(nomeLocation)}')" title="Vedi queste carte">${k ? '📦 ' + escapeHtml(k) : 'senza contenitore'} <b>${n}</b></span>`).join('');
    return `<div class="loc-p-titolo"><b>Nei contenitori</b><span>tocca per vedere le carte</span></div><div class="loc-chips" style="margin:8px 0 0;">${voci}</div>`;
}

// Collezione filtrata per contenitore (e location, se data). nome '' = senza contenitore.
function _contVediCarte(nome, location) {
    _locChiudiModale();
    apriDettaglioWidget('visualizzazione');
    setTimeout(() => {
        if (typeof _popolaFiltroContenitoreCarte === 'function') _popolaFiltroContenitoreCarte();
        const selCont = document.getElementById('filterContenitore');
        const selLoc = document.getElementById('filterLocation');
        if (!selCont || typeof filterTable !== 'function') return;
        const v = nome || FILTRO_SENZA_CONTENITORE;
        if ([...selCont.options].some(o => o.value === v)) selCont.value = v;
        if (selLoc) selLoc.value = location && [...selLoc.options].some(o => o.value === location) ? location : '';
        filterTable();
    }, 60);
}

async function _contDopoModifica() {
    if (typeof _contenitoriInvalida === 'function') _contenitoriInvalida();
    if (typeof caricaCarteReali === 'function') await caricaCarteReali();
    await renderPaginaLocation({ mantieni: true });
}

async function _contCrea() {
    if (_locOccupato || typeof contenitoreNuovo !== 'function') return;
    _locOccupato = true;
    try {
        const nome = await contenitoreNuovo();
        if (!nome) return;
        _contSel = nome;
        await renderPaginaLocation({ mantieni: true });
    } finally { _locOccupato = false; }
}

async function _contRinomina(nome) {
    if (_locOccupato || !nome) return;
    const input = await chiediTesto({ titolo: 'Rinomina contenitore', testo: `Nuovo nome per "${nome}":`, valore: nome, conferma: 'Rinomina', maxLength: 60 });
    if (input === null) return;
    const nuovo = input.trim();
    if (!nuovo || nuovo === nome) return;
    if (nuovo === '?') { mostraAvviso('"?" non va bene come nome di un contenitore.'); return; }
    _locOccupato = true;
    try {
        const { error } = await contenitoreRinomina(nome, nuovo);
        if (error) { mostraAvviso('❌ Errore nella rinomina: ' + error.message); return; }
        _contSel = nuovo;
        if (_locModale && _locModale.tipo === 'contenitore') _locModale.nome = nuovo;
        await _contDopoModifica();
        avvisoBreve(`Contenitore rinominato in "${nuovo}".`, { tipo: 'ok' });
    } finally { _locOccupato = false; }
}

// elimina = svuota e toglie dall'elenco
async function _contSvuota(nome, elimina) {
    if (_locOccupato || !nome) return;
    const v = _contVoce(nome);
    const n = v ? v.n : 0;
    const testo = elimina
        ? `Eliminare il contenitore "${nome}"?${n ? `\n\n${_locCarte(n)} lo perdono e restano nella loro location.` : ''}`
        : `Togliere il contenitore "${nome}" da ${_locCarte(n)}? Restano nella loro location; il contenitore resta nell'elenco, vuoto.`;
    if (!(await chiediConferma({ titolo: elimina ? 'Eliminare il contenitore?' : 'Svuotare il contenitore?', testo, conferma: elimina ? 'Elimina' : 'Svuota', pericolo: true }))) return;
    _locOccupato = true;
    try {
        const userId = await authGetUserId();
        if (!userId) return;
        if (n > 0) {
            const { error } = await contenitoreSvuota(userId, nome);
            if (error) { mostraAvviso('❌ Errore nello svuotare: ' + error.message); return; }
        }
        if (elimina) {
            const { error } = await contenitoreElimina(userId, nome);
            if (error) { mostraAvviso('❌ Errore nell\'eliminare: ' + error.message); await _contDopoModifica(); return; }
            _contSel = null;
            _locChiudiModale();
        }
        await _contDopoModifica();
        avvisoBreve(elimina ? `Contenitore "${nome}" eliminato.` : `Contenitore "${nome}" svuotato.`, { tipo: 'ok' });
    } finally { _locOccupato = false; }
}
