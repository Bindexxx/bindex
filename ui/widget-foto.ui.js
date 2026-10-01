// ═══════════════════════════════════════════════════════════════════════
// WIDGET-FOTO.UI.JS — tessera + pagina "Foto carte" (Bindex)
// ═══════════════════════════════════════════════════════════════════════
// RESTYLE BINDEX FASE 8c (2026-10-01, tavole "Foto carte"). Foto REALI delle
// proprie carte: fronte, retro e fino a 4 difetti con etichetta (sql/89).
// Decisioni di Claudio (2026-10-01): fotocamera dentro la pagina (sagoma,
// scatto ritagliato sulla sagoma, Galleria, torcia se c'è); solo carte;
// visibili al proprietario e, per gli altri, solo se la carta sta in un
// binder pubblico; nulla di obbligatorio (una carta è "fatta" con almeno
// una foto); missione "fotografa N carte" rimandata.
//
// Parti:
//  - CATALOGO_WIDGET.foto (tessera) — corpo grande in widget-render-corpi;
//  - renderPaginaFoto() → #fotoContenuto (view-section #foto in index.html):
//    riepilogo, filtri, elenco; su PC pannello a destra (Fronte/Retro/
//    Difetti con trascina-o-scegli, Salta/Prossima carta, QR per il telefono);
//  - sessione fotocamera (#ftSessione, creata al volo): passi Fronte → Retro
//    → Difetti, revisione Rifai/Va bene, Salta, chiudi.
//  - pulizia dei file delle carte cancellate (foto_carte_da_pulire, sql/89).
//
// Dipende da: carteReali/_idsInScambio (ui/cards.ui.js), authGetUserId,
// data/photos.repository.js, utils/foto-reali.js, escapeHtml/formattaEuro/
// _urlImmagineVisualizzabile (utils), apriDettaglioWidget, QRCode (CDN).

let _fotoCache = { quando: 0, userId: null, perCarta: null }; // Map carta_id → {fronte, retro, difetti[]}
let _fotoFiltro = 'dafare';
let _fotoSelId = null;           // PC: carta nel pannello
let _fotoEtichettaPC = null;     // PC: etichetta scelta per il prossimo difetto
let _fotoSessione = null;        // stato della fotocamera

const _FOTO_FILTRI = [
    ['dafare', 'Da fare'], ['scambio', 'In Scambio'], ['preziose', 'Più preziose'],
    ['senzaretro', 'Senza retro'], ['fatte', 'Fatte'],
];

// ── DATI ─────────────────────────────────────────────────────────────────
function _fotoCarteMie() {
    return (typeof carteReali !== 'undefined' ? carteReali : [])
        .filter(c => c.tabella === 'carte' && c.stato === 'collezione');
}
function _fotoInScambio(c) {
    return typeof _idsInScambio !== 'undefined' && _idsInScambio && _idsInScambio.has(String(c.id));
}
async function _fotoCarica(forza) {
    const userId = await authGetUserId();
    if (!userId) return null;
    if (!forza && _fotoCache.perCarta && _fotoCache.userId === userId && Date.now() - _fotoCache.quando < 60000) return _fotoCache.perCarta;
    const { data, error } = await fotoCarteMie(userId);
    if (error) { console.error('[foto] lettura:', error.message); return _fotoCache.perCarta; }
    const mappa = new Map();
    (data || []).forEach(f => {
        const k = String(f.carta_id);
        if (!mappa.has(k)) mappa.set(k, { fronte: null, retro: null, difetti: [] });
        const v = mappa.get(k);
        if (f.tipo === 'fronte') v.fronte = f;
        else if (f.tipo === 'retro') v.retro = f;
        else v.difetti.push(f);
    });
    _fotoCache = { quando: Date.now(), userId, perCarta: mappa };
    return mappa;
}
function _fotoSvuotaCache() { _fotoCache.quando = 0; }
function _fotoDi(id) {
    return (_fotoCache.perCarta && _fotoCache.perCarta.get(String(id))) || { fronte: null, retro: null, difetti: [] };
}
function _fotoFatta(id) { const f = _fotoDi(id); return !!(f.fronte || f.retro || f.difetti.length); }

// Ordine di lavoro: prima quelle in Scambio, poi le più preziose.
function _fotoOrdinaLavoro(lista) {
    return lista.slice().sort((a, b) => (_fotoInScambio(b) - _fotoInScambio(a)) || ((b.price || 0) - (a.price || 0)) || String(a.name).localeCompare(String(b.name), 'it'));
}
function _fotoDaFare() { return _fotoOrdinaLavoro(_fotoCarteMie().filter(c => !_fotoFatta(c.id))); }

function _fotoFiltra(filtro) {
    const tutte = _fotoCarteMie();
    if (filtro === 'dafare') return _fotoDaFare();
    if (filtro === 'scambio') return _fotoOrdinaLavoro(tutte.filter(_fotoInScambio));
    if (filtro === 'preziose') return tutte.slice().sort((a, b) => (b.price || 0) - (a.price || 0)).slice(0, 30);
    if (filtro === 'senzaretro') return _fotoOrdinaLavoro(tutte.filter(c => _fotoFatta(c.id) && !_fotoDi(c.id).retro));
    if (filtro === 'fatte') return _fotoOrdinaLavoro(tutte.filter(c => _fotoFatta(c.id)));
    return tutte;
}

// Pulizia dei file di carte cancellate (fire-and-forget).
async function _fotoPulisciOrfane() {
    try {
        const { data, error } = await fotoDaPulireList();
        if (error || !data || !data.length) return;
        const paths = data.map(r => r.storage_path);
        await storageFotoCarteRemoveMolti(paths);
        await fotoDaPulireTogli(paths);
    } catch (e) { console.warn('[foto] pulizia file:', e); }
}

// ── TESSERA ──────────────────────────────────────────────────────────────
CATALOGO_WIDGET.foto = {
    titolo: 'Foto carte', icona: 'fa-camera',
    tab: 'foto',
    tagliaDefault: '6x4',
    preview: async () => {
        const mappa = await _fotoCarica(false);
        if (!mappa) return { righe: ['—'], dati: null };
        const tutte = _fotoCarteMie();
        const fatte = tutte.filter(c => _fotoFatta(c.id)).length;
        const daFare = _fotoDaFare();
        return {
            righe: [tutte.length ? `${fatte} / ${tutte.length} con foto` : 'Nessuna carta'],
            dati: {
                fatte, totale: tutte.length, daFare: daFare.length,
                prossime: daFare.slice(0, 3).map(c => ({
                    id: c.id, name: c.name, price: c.price, immagine: c.immagine,
                    fronte: !!_fotoDi(c.id).fronte, retro: !!_fotoDi(c.id).retro, scambio: _fotoInScambio(c),
                })),
            },
        };
    },
};

// Dalla tessera: apre la pagina e (telefono) la sessione.
function fotoAvviaSessioneDaTessera(evt) {
    if (evt) evt.stopPropagation();
    if (typeof _editModeWidget !== 'undefined' && _editModeWidget) return;
    apriDettaglioWidget('foto', evt);
    setTimeout(() => fotoAvviaSessione(), (typeof DURATA_ANIMAZIONE_DETTAGLIO_MS !== 'undefined' ? DURATA_ANIMAZIONE_DETTAGLIO_MS : 400) + 80);
}

// Link dal QR "Più comodo col telefono": ?apri=foto (chiamata a fine avvio).
function fotoApriDaLinkSeRichiesto() {
    let p;
    try { p = new URLSearchParams(window.location.search); } catch (_) { return; }
    if (p.get('apri') !== 'foto') return;
    try { const u = new URL(window.location.href); u.searchParams.delete('apri'); history.replaceState(null, '', u.href); } catch (_) { /* niente */ }
    setTimeout(() => { if (typeof apriDettaglioWidget === 'function') apriDettaglioWidget('foto', null); }, 600);
}

// ── PAGINA ───────────────────────────────────────────────────────────────
function _fotoEPC() {
    const pg = document.getElementById('foto');
    return !!pg && pg.clientWidth >= 780;
}

async function renderPaginaFoto() {
    const wrap = document.getElementById('fotoContenuto');
    if (!wrap) return;
    wrap.innerHTML = '<p class="ft-nota"><i class="fa-solid fa-spinner fa-spin"></i> Caricamento…</p>';
    _fotoPulisciOrfane();
    await _fotoCarica(true);
    _fotoDisegnaPagina();
}

function _fotoChipsHtml(id) {
    const f = _fotoDi(id);
    const c = (_fotoCarteMie().find(x => String(x.id) === String(id))) || {};
    return `<span class="ft-chip ${f.fronte ? 'ok' : ''}">${f.fronte ? '<i class="fa-solid fa-check"></i> ' : ''}Fronte</span>
        <span class="ft-chip ${f.retro ? 'ok' : ''}">${f.retro ? '<i class="fa-solid fa-check"></i> ' : ''}Retro</span>
        ${f.difetti.length ? `<span class="ft-chip ok">${f.difetti.length} dettagl${f.difetti.length === 1 ? 'io' : 'i'}</span>` : ''}
        ${_fotoInScambio(c) ? '<span class="ft-chip scambio">Scambio</span>' : ''}`;
}

function _fotoMiniaturaHtml(c) {
    const src = _urlImmagineVisualizzabile(c.immagine, 96);
    return src ? `<img class="ft-mini" src="${src}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : '<span class="ft-mini ft-mini-vuota"><i class="fa-solid fa-image"></i></span>';
}

function _fotoDisegnaPagina() {
    const wrap = document.getElementById('fotoContenuto');
    if (!wrap) return;
    const tutte = _fotoCarteMie();
    const fatte = tutte.filter(c => _fotoFatta(c.id)).length;
    const daFare = _fotoDaFare();
    const perc = tutte.length ? Math.round((fatte / tutte.length) * 100) : 0;
    const pc = _fotoEPC();
    const conta = { dafare: daFare.length, scambio: tutte.filter(_fotoInScambio).length, senzaretro: _fotoFiltra('senzaretro').length, fatte };

    const lista = _fotoFiltra(_fotoFiltro);
    if (pc && (!_fotoSelId || !lista.some(c => String(c.id) === String(_fotoSelId)))) _fotoSelId = lista.length ? lista[0].id : null;

    const chips = _FOTO_FILTRI.map(([k, t]) =>
        `<button type="button" class="ft-filtro ${_fotoFiltro === k ? 'attivo' : ''}" onclick="_fotoImpostaFiltro('${k}')">${k === 'scambio' ? '<i class="fa-solid fa-right-left"></i> ' : ''}${t}${conta[k] != null ? ` (${conta[k]})` : ''}</button>`).join('');

    const righe = lista.map(c => {
        const idA = escapeJsAttr(String(c.id));
        return `<div class="ft-riga ${pc && String(c.id) === String(_fotoSelId) ? 'sel' : ''}" onclick="_fotoApriRiga('${idA}')">
            ${_fotoMiniaturaHtml(c)}
            <div class="ft-riga-testo"><b>${escapeHtml(c.name || '(senza nome)')}</b>
                <span>${escapeHtml(String(c.code || '').replace(/\s+/g, ' ').trim())}${c.price ? ' · ' + formattaEuro(c.price) : ''}</span>
                <div class="ft-chips">${_fotoChipsHtml(c.id)}</div></div>
            ${pc ? `<button type="button" class="ft-btn" onclick="event.stopPropagation(); _fotoApriRiga('${idA}')"><i class="fa-solid fa-camera"></i> Foto</button>` : '<i class="fa-solid fa-chevron-right ft-freccia"></i>'}
        </div>`;
    }).join('') || `<p class="ft-vuoto">${_fotoFiltro === 'dafare' ? 'Tutte le carte hanno almeno una foto. 🎉' : 'Nessuna carta in questo gruppo.'}</p>`;

    wrap.innerHTML = `
        <div class="ft-testa">
            <div class="ft-numeri"><b>${fatte}</b><span>/ ${tutte.length}</span><em>carte con foto vere${daFare.length ? ` · ${daFare.length} da fare, prima quelle in Scambio` : ''}</em></div>
            <div class="ft-barra"><i style="width:${perc}%"></i></div>
            ${daFare.length ? `<button type="button" class="ft-avvia" onclick="fotoAvviaSessione()"><i class="fa-solid fa-camera"></i> Inizia sessione foto · ${daFare.length}</button>` : ''}
        </div>
        <div class="ft-layout">
            <div class="ft-colonna">
                <div class="ft-filtri">${chips}</div>
                <div class="ft-elenco">${righe}</div>
            </div>
            ${pc ? `<div class="ft-pannello" id="ftPannello">${_fotoPannelloHtml()}</div>` : ''}
        </div>`;
    if (pc) _fotoDisegnaQr();
}

function _fotoImpostaFiltro(k) { _fotoFiltro = k; _fotoSelId = null; _fotoDisegnaPagina(); }

function _fotoApriRiga(id) {
    if (_fotoEPC()) { _fotoSelId = id; _fotoEtichettaPC = null; _fotoDisegnaPagina(); return; }
    fotoAvviaSessione([id]);
}

// Dal sito (carta in Collezione, vecchio bottone "Foto dettaglio"): apre la
// pagina posizionata sulla carta (PC) o la fotocamera su quella carta (telefono).
function fotoApriCarta(id) {
    apriDettaglioWidget('foto', null);
    setTimeout(async () => {
        await _fotoCarica(false);
        if (_fotoEPC()) { _fotoFiltro = 'tutte'; _fotoSelId = id; _fotoDisegnaPagina(); }
        else fotoAvviaSessione([id]);
    }, (typeof DURATA_ANIMAZIONE_DETTAGLIO_MS !== 'undefined' ? DURATA_ANIMAZIONE_DETTAGLIO_MS : 400) + 80);
}

// ── PANNELLO PC ──────────────────────────────────────────────────────────
function _fotoSlotHtml(foto, tipo, etichetta) {
    if (foto) {
        const url = fotoRealeUrl(foto.storage_path);
        return `<div class="ft-slot pieno">
            <img src="${escapeHtml(url)}" alt="" onclick="apriFotoRealeGrande('${escapeHtml(url)}', '${escapeHtml(fotoRealeNome(foto))}')">
            <span class="ft-slot-ok"><i class="fa-solid fa-check"></i></span>
            <button type="button" class="ft-slot-via" onclick="_fotoElimina('${escapeJsAttr(String(foto.id))}')" aria-label="Elimina la foto"><i class="fa-solid fa-trash"></i></button>
        </div>`;
    }
    const titolo = tipo === 'difetto' ? (etichetta ? `Aggiungi: ${FOTO_ETICHETTE[etichetta]}` : 'Aggiungi un dettaglio') : 'Trascina qui la foto<br>o clicca per sceglierla';
    const ico = tipo === 'difetto' ? 'fa-magnifying-glass-plus' : 'fa-cloud-arrow-up';
    return `<label class="ft-slot vuoto" ondragover="event.preventDefault(); this.classList.add('sopra')" ondragleave="this.classList.remove('sopra')" ondrop="_fotoDrop(event, '${tipo}')">
        <input type="file" accept="image/*" onchange="_fotoScegliFile(this, '${tipo}')">
        <i class="fa-solid ${ico}"></i><span>${titolo}</span></label>`;
}

function _fotoPannelloHtml() {
    const c = _fotoCarteMie().find(x => String(x.id) === String(_fotoSelId));
    if (!c) return '<p class="ft-vuoto">Scegli una carta dall’elenco.</p>';
    const f = _fotoDi(c.id);
    const difetti = f.difetti.map(d => _fotoSlotHtml(d, 'difetto')).join('');
    const etichette = Object.entries(FOTO_ETICHETTE).map(([k, t]) =>
        `<button type="button" class="ft-etichetta ${_fotoEtichettaPC === k ? 'attivo' : ''}" onclick="_fotoScegliEtichettaPC('${k}')">${t}</button>`).join('');
    return `
        <div class="ft-pan-testa">${_fotoMiniaturaHtml(c)}<div><h3>${escapeHtml(c.name || '')}</h3>
            <span>${escapeHtml(String(c.code || '').replace(/\s+/g, ' ').trim())} · ${escapeHtml(c.lang || '')} · ${escapeHtml(c.cond || '')}${_fotoInScambio(c) ? ' · in Scambio' : ''}</span></div></div>
        <div class="ft-slots">
            <div><p>Fronte</p>${_fotoSlotHtml(f.fronte, 'fronte')}</div>
            <div><p>Retro</p>${_fotoSlotHtml(f.retro, 'retro')}</div>
            <div><p>Difetti <em>(facoltativo)</em></p><div class="ft-difetti${f.difetti.length ? '' : ' uno'}">${difetti}${f.difetti.length < 4 ? _fotoSlotHtml(null, 'difetto', _fotoEtichettaPC) : ''}</div></div>
        </div>
        ${f.difetti.length < 4 ? `<p class="ft-etichette-tit">Cosa mostra il dettaglio?</p><div class="ft-etichette">${etichette}</div>` : '<p class="ft-nota">Hai già 4 dettagli per questa carta (il massimo).</p>'}
        <div class="ft-info"><i class="fa-solid fa-eye"></i> Le foto le vedono tutti quelli che aprono un tuo binder pubblico con questa carta. Le salvo già ridotte e leggere.</div>
        <div class="ft-pan-bottoni">
            <button type="button" class="ft-btn" onclick="_fotoPannelloProssima()">Salta</button>
            <button type="button" class="ft-btn pieno" onclick="_fotoPannelloProssima()"><i class="fa-solid fa-arrow-right"></i> Prossima carta</button>
        </div>
        <div class="ft-qr"><div id="ftQr"></div><div><b>Più comodo col telefono</b><span>Inquadra il codice: apri Foto carte sul telefono e continua con la fotocamera.</span></div></div>`;
}

function _fotoDisegnaQr() {
    const box = document.getElementById('ftQr');
    if (!box || typeof QRCode === 'undefined') { const q = document.querySelector('#foto .ft-qr'); if (q && typeof QRCode === 'undefined') q.style.display = 'none'; return; }
    box.innerHTML = '';
    try {
        const u = new URL(window.location.href); u.search = '?apri=foto'; u.hash = '';
        new QRCode(box, { text: u.href, width: 96, height: 96 });
    } catch (e) { console.warn('[foto] QR:', e); }
}

function _fotoScegliEtichettaPC(k) { _fotoEtichettaPC = _fotoEtichettaPC === k ? null : k; _fotoRidisegnaPannello(); }
function _fotoRidisegnaPannello() {
    const p = document.getElementById('ftPannello');
    if (p) { p.innerHTML = _fotoPannelloHtml(); _fotoDisegnaQr(); }
}
function _fotoPannelloProssima() {
    const lista = _fotoFiltra(_fotoFiltro);
    const i = lista.findIndex(c => String(c.id) === String(_fotoSelId));
    const prossima = lista[(i + 1) % Math.max(1, lista.length)];
    _fotoSelId = prossima ? prossima.id : null;
    _fotoEtichettaPC = null;
    _fotoDisegnaPagina();
}
function _fotoDrop(evt, tipo) {
    evt.preventDefault();
    evt.currentTarget.classList.remove('sopra');
    const file = evt.dataTransfer && evt.dataTransfer.files && evt.dataTransfer.files[0];
    if (file) _fotoCaricaDaPannello(file, tipo);
}
function _fotoScegliFile(input, tipo) {
    const file = input.files && input.files[0];
    input.value = '';
    if (file) _fotoCaricaDaPannello(file, tipo);
}
async function _fotoCaricaDaPannello(file, tipo) {
    if (!/^image\//.test(file.type || '')) { alert('Scegli un’immagine.'); return; }
    if (tipo === 'difetto' && !_fotoEtichettaPC) { alert('Scegli prima cosa mostra il dettaglio (Angolo, Bordo, …).'); return; }
    const p = document.getElementById('ftPannello');
    if (p) p.classList.add('in-corso');
    try {
        const blob = await fotoComprimi(file);
        await _fotoSalva(_fotoSelId, tipo, tipo === 'difetto' ? _fotoEtichettaPC : null, blob);
        if (tipo === 'difetto') _fotoEtichettaPC = null;
    } catch (e) {
        alert('❌ ' + (e && e.message ? e.message : 'Caricamento non riuscito'));
    }
    await _fotoCarica(true);
    _fotoDisegnaPagina();
}

// ── SALVATAGGIO ──────────────────────────────────────────────────────────
// Fronte/retro: una sola per carta (indice unico) → la vecchia si toglie
// DOPO aver caricato il file nuovo, così un errore non lascia la carta senza.
async function _fotoSalva(cartaId, tipo, etichetta, blob) {
    const userId = await authGetUserId();
    if (!userId) throw new Error('Accesso scaduto, rientra');
    const path = `${userId}/${cartaId}/${tipo}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
    const { error: errUp } = await storageFotoCarteUploadJpeg(path, blob);
    if (errUp) throw new Error('Caricamento della foto non riuscito: ' + errUp.message);
    const vecchia = (tipo === 'fronte' || tipo === 'retro') ? _fotoDi(cartaId)[tipo] : null;
    if (vecchia) {
        const { error: errDel } = await fotoCarteDelete(vecchia.id);
        if (errDel) { await storageFotoCarteRemove(path); throw new Error(errDel.message); }
    }
    const { error: errIns } = await fotoCarteInsert({ carta_id: cartaId, tabella: 'carte', owner_id: userId, storage_path: path, tipo, etichetta: etichetta || null });
    if (errIns) { await storageFotoCarteRemove(path); throw new Error(errIns.message); }
    if (vecchia) storageFotoCarteRemove(vecchia.storage_path).catch(() => {});
    _fotoSvuotaCache();
}

async function _fotoElimina(fotoId) {
    let foto = null;
    (_fotoCache.perCarta || new Map()).forEach(v => {
        [v.fronte, v.retro, ...v.difetti].forEach(f => { if (f && String(f.id) === String(fotoId)) foto = f; });
    });
    if (!foto || !confirm('Eliminare questa foto?')) return;
    const { error } = await fotoCarteDelete(foto.id);
    if (error) { alert('❌ ' + error.message); return; }
    storageFotoCarteRemove(foto.storage_path).catch(() => {});
    await _fotoCarica(true);
    _fotoDisegnaPagina();
}

// ── SESSIONE FOTOCAMERA ──────────────────────────────────────────────────
// coda: id delle carte da fotografare (default: tutte le "da fare").
async function fotoAvviaSessione(coda) {
    await _fotoCarica(false);
    const ids = (coda && coda.length) ? coda : _fotoDaFare().map(c => c.id);
    if (!ids.length) { alert('Non ci sono carte da fotografare.'); return; }
    _fotoSessione = { coda: ids.map(String), idx: 0, passo: 'fronte', etichetta: null, stream: null, blob: null, torcia: false, origine: null };
    _fotoSessioneMonta();
    _fotoSessionePasso(_fotoPassoIniziale(ids[0]));
}

function _fotoPassoIniziale(id) {
    const f = _fotoDi(id);
    if (!f.fronte) return 'fronte';
    if (!f.retro) return 'retro';
    return 'difetti';
}

function _fotoSessioneMonta() {
    let el = document.getElementById('ftSessione');
    if (!el) {
        el = document.createElement('div');
        el.id = 'ftSessione';
        el.className = 'ft-sessione';
        document.body.appendChild(el);
        document.addEventListener('keydown', _fotoSessioneTasto);
    }
    document.body.style.overflow = 'hidden';
}
function _fotoSessioneTasto(e) { if (e.key === 'Escape') fotoChiudiSessione(); }

function _fotoSessioneCarta() {
    const s = _fotoSessione;
    return s ? _fotoCarteMie().find(c => String(c.id) === s.coda[s.idx]) : null;
}

function _fotoSessioneTestaHtml(sottotitolo, conTorcia) {
    const s = _fotoSessione, c = _fotoSessioneCarta() || {};
    const f = _fotoDi(c.id);
    const prossima = s.coda[s.idx + 1] ? (_fotoCarteMie().find(x => String(x.id) === s.coda[s.idx + 1]) || {}).name : '';
    const sotto = sottotitolo || (s.coda.length > 1 ? `${s.idx + 1} di ${s.coda.length}${prossima ? ' · poi ' + escapeHtml(prossima) : ''}` : '');
    const attivo = (k) => s.passo === k || (k === 'difetti' && s.passo === 'difetto');
    const passo = (k, t, fatto) => `<button type="button" class="ft-passo ${attivo(k) ? 'attivo' : ''} ${fatto ? 'fatto' : ''}" onclick="_fotoSessionePasso('${k}')">${fatto && !attivo(k) ? '<i class="fa-solid fa-check"></i> ' : ''}${t}</button>`;
    return `<div class="ft-ses-testa">
            <button type="button" class="ft-tondo" onclick="fotoChiudiSessione()" aria-label="Chiudi"><i class="fa-solid fa-xmark"></i></button>
            <div class="ft-ses-tit"><b>${escapeHtml(c.name || '')}</b><span>${sotto}</span></div>
            ${conTorcia ? `<button type="button" class="ft-tondo ${s.torcia ? 'acceso' : ''}" id="ftTorcia" onclick="_fotoTorcia()" aria-label="Torcia" style="display:none;"><i class="fa-solid fa-bolt"></i></button>` : '<span class="ft-tondo-vuoto"></span>'}
        </div>
        <div class="ft-passi">${passo('fronte', '1 · Fronte', !!f.fronte)}${passo('retro', '2 · Retro', !!f.retro)}${passo('difetti', `+ Difetti${f.difetti.length ? ' (' + f.difetti.length + ')' : ''}`, f.difetti.length > 0)}</div>`;
}

function _fotoSessionePasso(passo) {
    const s = _fotoSessione;
    if (!s) return;
    s.passo = passo;
    s.blob = null;
    if (passo === 'difetti') { _fotoSessioneDifetti(); return; }
    _fotoSessioneCamera();
}

async function _fotoSessioneCamera() {
    const s = _fotoSessione, el = document.getElementById('ftSessione');
    if (!s || !el) return;
    const etichetta = s.passo === 'difetto' && s.etichetta ? ` · ${FOTO_ETICHETTE[s.etichetta]}` : '';
    el.innerHTML = `${_fotoSessioneTestaHtml(null, true)}
        <div class="ft-mirino" id="ftMirino">
            <video id="ftVideo" playsinline muted autoplay></video>
            <div class="ft-sagoma" id="ftSagoma"><i></i><i></i><i></i><i></i></div>
            <p class="ft-mirino-aiuto" id="ftAiuto"><i class="fa-solid fa-crop-simple"></i> Allinea la carta alla sagoma e scatta${etichetta}</p>
        </div>
        <div class="ft-comandi">
            <label class="ft-comando"><input type="file" accept="image/*" onchange="_fotoSessioneGalleria(this)"><i class="fa-regular fa-image"></i><span>Galleria</span></label>
            <button type="button" class="ft-scatto" id="ftScatto" onclick="_fotoScatta()" aria-label="Scatta"></button>
            <button type="button" class="ft-comando" onclick="_fotoSessioneSalta()"><i class="fa-solid fa-forward"></i><span>Salta</span></button>
        </div>`;
    const video = document.getElementById('ftVideo');
    try {
        if (!s.stream) {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('nessuna fotocamera');
            s.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        }
        if (!_fotoSessione) { _fotoFermaCamera(s); return; } // chiusa nel frattempo
        video.srcObject = s.stream;
        await video.play().catch(() => {});
        const traccia = s.stream.getVideoTracks()[0];
        const cap = traccia && traccia.getCapabilities ? traccia.getCapabilities() : {};
        const t = document.getElementById('ftTorcia');
        if (t && cap && cap.torch) t.style.display = '';
    } catch (e) {
        console.warn('[foto] fotocamera:', e);
        const aiuto = document.getElementById('ftAiuto');
        if (aiuto) aiuto.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Fotocamera non disponibile: usa Galleria';
        const sc = document.getElementById('ftScatto'); if (sc) sc.disabled = true;
    }
}

async function _fotoTorcia() {
    const s = _fotoSessione;
    if (!s || !s.stream) return;
    const traccia = s.stream.getVideoTracks()[0];
    try {
        s.torcia = !s.torcia;
        await traccia.applyConstraints({ advanced: [{ torch: s.torcia }] });
        const t = document.getElementById('ftTorcia'); if (t) t.classList.toggle('acceso', s.torcia);
    } catch (e) { console.warn('[foto] torcia:', e); }
}

// Scatto: ritaglia il fotogramma sul rettangolo della sagoma (stessa
// trasformazione di object-fit: cover usata per mostrare il video).
async function _fotoScatta() {
    const video = document.getElementById('ftVideo');
    const sagoma = document.getElementById('ftSagoma');
    if (!video || !sagoma || !video.videoWidth) return;
    const rv = video.getBoundingClientRect(), rs = sagoma.getBoundingClientRect();
    const vw = video.videoWidth, vh = video.videoHeight;
    const scala = Math.max(rv.width / vw, rv.height / vh);
    const offX = (vw * scala - rv.width) / 2, offY = (vh * scala - rv.height) / 2;
    let sx = (rs.left - rv.left + offX) / scala, sy = (rs.top - rv.top + offY) / scala;
    let sw = rs.width / scala, sh = rs.height / scala;
    sx = Math.max(0, sx); sy = Math.max(0, sy); sw = Math.min(vw - sx, sw); sh = Math.min(vh - sy, sh);
    const c = document.createElement('canvas');
    c.width = Math.round(sw); c.height = Math.round(sh);
    c.getContext('2d').drawImage(video, sx, sy, sw, sh, 0, 0, c.width, c.height);
    try { _fotoSessione.blob = await fotoComprimi(c); } catch (e) { alert('❌ ' + e.message); return; }
    _fotoSessioneRevisione(true);
}

async function _fotoSessioneGalleria(input) {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file || !_fotoSessione) return;
    try { _fotoSessione.blob = await fotoComprimi(file); } catch (e) { alert('❌ ' + e.message); return; }
    _fotoSessioneRevisione(false);
}

function _fotoSessioneRevisione(ritagliata) {
    const s = _fotoSessione, el = document.getElementById('ftSessione');
    if (!s || !el || !s.blob) return;
    const url = URL.createObjectURL(s.blob);
    const nomePasso = s.passo === 'fronte' ? 'Fronte' : s.passo === 'retro' ? 'Retro' : (FOTO_ETICHETTE[s.etichetta] || 'Dettaglio');
    const c = _fotoSessioneCarta() || {};
    const chips = s.passo === 'retro' && _fotoDi(c.id).difetti.length < 4
        ? `<p class="ft-domanda">Vuoi aggiungere un difetto da mostrare?</p>
           <div class="ft-etichette scuro">${Object.entries(FOTO_ETICHETTE).map(([k, t]) => `<button type="button" class="ft-etichetta ${s.etichettaDopo === k ? 'attivo' : ''}" onclick="_fotoEtichettaDopo('${k}')">${t}</button>`).join('')}</div>` : '';
    el.innerHTML = `${_fotoSessioneTestaHtml(`${escapeHtml(nomePasso)} · ${ritagliata ? 'ritagliata sulla sagoma · ' : ''}puoi rifarla`, false)}
        <div class="ft-revisione"><img src="${url}" alt="Anteprima"></div>
        ${chips}
        <div class="ft-rev-bottoni">
            <button type="button" class="ft-btn grande" onclick="_fotoSessioneRifai()"><i class="fa-solid fa-rotate-left"></i> Rifai</button>
            <button type="button" class="ft-btn grande pieno" id="ftVaBene" onclick="_fotoSessioneVaBene()"><i class="fa-solid fa-check"></i> Va bene</button>
        </div>`;
    s.urlAnteprima && URL.revokeObjectURL(s.urlAnteprima);
    s.urlAnteprima = url;
}

function _fotoEtichettaDopo(k) {
    const s = _fotoSessione; if (!s) return;
    s.etichettaDopo = s.etichettaDopo === k ? null : k;
    document.querySelectorAll('#ftSessione .ft-etichetta').forEach(b => b.classList.toggle('attivo', b.getAttribute('onclick').includes(`'${s.etichettaDopo}'`)));
}

function _fotoSessioneRifai() {
    const s = _fotoSessione; if (!s) return;
    s.blob = null;
    _fotoSessioneCamera();
}

async function _fotoSessioneVaBene() {
    const s = _fotoSessione; if (!s || !s.blob) return;
    const btn = document.getElementById('ftVaBene');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvo…'; }
    const cartaId = s.coda[s.idx];
    const tipo = s.passo === 'difetto' ? 'difetto' : s.passo;
    try {
        await _fotoSalva(cartaId, tipo, tipo === 'difetto' ? s.etichetta : null, s.blob);
        await _fotoCarica(true);
    } catch (e) {
        alert('❌ ' + (e && e.message ? e.message : 'Salvataggio non riuscito'));
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-check"></i> Va bene'; }
        return;
    }
    s.blob = null;
    if (tipo === 'fronte') { _fotoSessionePasso('retro'); return; }
    if (tipo === 'retro' && s.etichettaDopo) { s.etichetta = s.etichettaDopo; s.etichettaDopo = null; s.passo = 'difetto'; _fotoSessioneCamera(); return; }
    _fotoSessioneDifetti();
}

// Schermata "Difetti": scegli cosa mostrare (max 4) oppure passa alla prossima.
function _fotoSessioneDifetti() {
    const s = _fotoSessione, el = document.getElementById('ftSessione');
    if (!s || !el) return;
    s.passo = 'difetti';
    const c = _fotoSessioneCarta() || {};
    const f = _fotoDi(c.id);
    const fatte = [f.fronte, f.retro, ...f.difetti].filter(Boolean);
    const ultima = s.idx >= s.coda.length - 1;
    el.innerHTML = `${_fotoSessioneTestaHtml(null, false)}
        <div class="ft-difetti-sessione">
            ${fatte.length ? fotoRealiStripHtml(fatte) : '<p class="ft-nota chiaro">Nessuna foto ancora per questa carta.</p>'}
            ${f.difetti.length < 4 ? `<p class="ft-domanda">Vuoi aggiungere un difetto da mostrare?</p>
            <div class="ft-etichette scuro">${Object.entries(FOTO_ETICHETTE).map(([k, t]) => `<button type="button" class="ft-etichetta" onclick="_fotoSessioneDifetto('${k}')">${t}</button>`).join('')}</div>` : '<p class="ft-nota chiaro">Hai già 4 dettagli per questa carta (il massimo).</p>'}
        </div>
        <div class="ft-rev-bottoni">
            <button type="button" class="ft-btn grande pieno" onclick="${ultima ? 'fotoChiudiSessione()' : '_fotoSessioneSalta()'}"><i class="fa-solid ${ultima ? 'fa-check' : 'fa-arrow-right'}"></i> ${ultima ? 'Fine' : 'Prossima carta'}</button>
        </div>`;
}

function _fotoSessioneDifetto(k) {
    const s = _fotoSessione; if (!s) return;
    s.etichetta = k;
    s.passo = 'difetto';
    _fotoSessioneCamera();
}

function _fotoSessioneSalta() {
    const s = _fotoSessione; if (!s) return;
    if (s.idx >= s.coda.length - 1) { fotoChiudiSessione(); return; }
    s.idx++;
    s.etichetta = null; s.etichettaDopo = null; s.blob = null;
    _fotoSessionePasso(_fotoPassoIniziale(s.coda[s.idx]));
}

function _fotoFermaCamera(s) {
    if (s && s.stream) { s.stream.getTracks().forEach(t => { try { t.stop(); } catch (_) { /* niente */ } }); s.stream = null; }
}

function fotoChiudiSessione() {
    const s = _fotoSessione;
    _fotoSessione = null;
    _fotoFermaCamera(s);
    if (s && s.urlAnteprima) URL.revokeObjectURL(s.urlAnteprima);
    const el = document.getElementById('ftSessione');
    if (el) el.remove();
    document.removeEventListener('keydown', _fotoSessioneTasto);
    document.body.style.overflow = '';
    if (document.getElementById('foto') && document.getElementById('foto').classList.contains('active')) _fotoDisegnaPagina();
}

// ── CARTA A TUTTO SCHERMO (sito privato) ─────────────────────────────────
// Riempie #flipCardFotoReali con le foto della carta aperta (solo le mie).
async function fotoRealiInFlipCard(card) {
    const box = document.getElementById('flipCardFotoReali');
    if (!box) return;
    box.innerHTML = '';
    if (!card || card.tabella !== 'carte') return;
    const idAperta = String(card.id);
    box.dataset.carta = idAperta;
    const mappa = await _fotoCarica(false);
    if (!mappa || box.dataset.carta !== idAperta) return;
    const f = _fotoDi(card.id);
    box.innerHTML = fotoRealiStripHtml([f.fronte, f.retro, ...f.difetti].filter(Boolean));
}
