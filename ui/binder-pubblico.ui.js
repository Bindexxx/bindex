// ── ui/binder-pubblico.ui.js ─────────────────────────────────────────────
// Logica UI di binder-pubblico.html — la pagina pubblica GENERICA per
// binder di tipo 'location' (diversi da SCAMBIO, che ha già scambio.html)
// ed 'extra' (mai avuto una pagina pubblica prima d'ora). Wishlist e
// Scambio NON passano da qui, hanno le loro pagine dedicate.
//
// A differenza di scambio.ui.js/wishlist.ui.js: nessuna selezione/quantità/
// "copia riepilogo" — qui non c'è un flusso di trattativa, solo una
// vetrina in sola lettura del binder condiviso. La sleeve del retro carta
// è letta qui direttamente (leggi_media_binder_pubblico), NON tramite
// ui/card-back-viewer.ui.js: quel file non è stato verificato in questa
// sessione (probabilmente precede il Multi-Binder), meglio autosufficiente.
//
// Dipende da: data/binder-pubblico.repository.js, state/binder-pubblico.state.js,
// utils/shared-public.js (applicaTemaCondiviso, _urlImmagineVisualizzabile, escapeHtml).

// Stesse posizioni di default dell'editor privato (state/binder.state.js:
// DEFAULT_STATE_CARD_BACK) — copiate qui perché questa pagina non carica
// quel file. Usate solo se la sleeve non ha un metadata salvato.
const DEFAULT_STATE_CARD_BACK = {
    pokemon:    { left: 13.48, top: 9.33,  scale: 1 },
    condition:  { left: 27.19, top: 31.82, scale: 1 },
    variazione: { left: 27.19, top: 55.25, scale: 1 },
    price:      { left: 66.44, top: 78.27, scale: 1 }
};
const CARD_BACK_W = 900;
const CARD_BACK_H = 1260;

async function caricaCatalogo() {
    const params = new URLSearchParams(window.location.search);
    const binderId = params.get('binder');
    _binderId = binderId;
    const container = document.getElementById('listaContainer');

    if (!binderId) {
        container.innerHTML = '<div class="stato-errore"><i class="fa-solid fa-triangle-exclamation"></i> Link non valido — manca il riferimento al binder.</div>';
        return;
    }

    const { data: info, error: errInfo } = await binderPubblicoLeggiInfo(binderId);
    if (errInfo || !info || info.length === 0) {
        container.innerHTML = '<div class="stato-errore"><i class="fa-solid fa-lock"></i> Questo binder non è (più) pubblico, o il link non è valido.</div>';
        document.getElementById('statRiepilogo').textContent = '';
        return;
    }

    const nomeBinder = info[0].nome || 'Binder';
    _ownerUserId = info[0].owner_id;
    _binderInfo = { nome: nomeBinder, tipo: info[0].tipo, location_valore: info[0].location_valore };
    document.title = 'CardSync Pro — ' + nomeBinder;
    document.getElementById('titoloBinder').textContent = nomeBinder;

    _caricaCopertinaBinder(binderId); // non bloccante, si aggiorna da sola quando pronta

    const { data, error } = await binderPubblicoLeggiCarte(binderId);
    if (error) {
        container.innerHTML = `<div class="stato-errore"><i class="fa-solid fa-triangle-exclamation"></i> Errore nel caricamento: ${error.message}</div>`;
        return;
    }

    carte = (data || []).map(r => ({
        id: r.id,
        name: r.nome || '',
        code: r.codice || '',
        lang: r.lingua || 'IT',
        cond: r.condizione || 'NM',
        qty: r.qty || 1,
        price: r.prezzo != null ? Number(r.prezzo) : 0,
        notes: r.note || '',
        immagine: r.immagine || null,
    }));

    if (carte.length === 0) {
        container.innerHTML = '<div class="stato-vuoto"><i class="fa-solid fa-box-open"></i><br>Questo binder è vuoto al momento.</div>';
        document.getElementById('statRiepilogo').textContent = '';
        return;
    }

    document.getElementById('statRiepilogo').textContent =
        `${carte.length} cart${carte.length === 1 ? 'a' : 'e'}`;

    renderLista();
    impostaModalitaBinderPubblico('elenco');
}

async function _caricaCopertinaBinder(binderId) {
    const url = await _risolviCopertinaBinderPubblico(binderId);
    if (!url) return;

    const banner = document.getElementById('copertinaBinderBanner');
    if (!banner) return;
    banner.onerror = () => { banner.style.display = 'none'; };
    banner.src = url;
    banner.style.display = 'block';
}

// Come sopra ma ritorna solo l'url (o null), con cache — riusata sia dal
// banner in header sia dalla copertina del libro, una sola chiamata RPC.
async function _risolviCopertinaBinderPubblico(binderId) {
    if (_copertinaRisolta !== null) return _copertinaRisolta || null;

    const { data: media, error } = await binderPubblicoLeggiMedia(binderId);
    const copertina = (!error && media) ? media.find(m => m.slot === 'binder_cover') : null;
    if (!copertina) { _copertinaRisolta = false; return null; }

    let url = null;
    if (copertina.source === 'default') {
        const { data: pub } = supabaseClient.storage.from('default-assets').getPublicUrl(copertina.storage_path);
        url = pub?.publicUrl || null;
    } else {
        // Upload personalizzato: bucket pubblico 'immaginivisibili',
        // sincronizzato dall'admin all'approvazione — vedi
        // _sincronizzaCopiaPubblica in ui/admin-requests.ui.js.
        const { data: pub } = supabaseClient.storage.from('immaginivisibili').getPublicUrl(`binder/${_ownerUserId}/${binderId}.png`);
        url = pub?.publicUrl || null;
    }
    _copertinaRisolta = url || false;
    return url;
}

function renderLista() {
    const container = document.getElementById('listaContainer');
    const searchVal = document.getElementById('searchInput').value.toLowerCase();

    const filtrate = carte.filter(c =>
        c.name.toLowerCase().includes(searchVal) || c.code.toLowerCase().includes(searchVal)
    );

    if (filtrate.length === 0) {
        container.innerHTML = '<div class="stato-vuoto"><i class="fa-solid fa-magnifying-glass"></i><br>Nessuna carta corrisponde alla ricerca.</div>';
        return;
    }

    container.innerHTML = filtrate.map(c => {
        const immagineSrc = _urlImmagineVisualizzabile(c.immagine);
        return `
            <div class="card-row">
                ${immagineSrc ? `<img src="${immagineSrc}" alt="" class="card-thumb" onclick="apriFlipCard('${c.id}')" onerror="this.style.display='none';">` : ''}
                <div class="card-info">
                    <div class="card-name">${escapeHtml(c.name)}${c.code ? ` <span style="color:var(--text-muted); font-weight:600;">(${c.code})</span>` : ''}</div>
                    <div class="card-meta">
                        <span class="badge">${c.lang}</span>
                        <span class="badge">${c.cond}</span>
                        ${c.qty > 1 ? `<span class="badge">×${c.qty}</span>` : ''}
                        ${c.notes ? `<span class="badge">✨ ${escapeHtml(c.notes)}</span>` : ''}
                    </div>
                </div>
                <div class="card-price">${formattaEuro(c.price)}</div>
            </div>
        `;
    }).join('');
}

// ── Flip-card con sleeve del binder (autosufficiente, vedi banner in cima) ─
async function apriFlipCard(id) {
    const card = carte.find(c => String(c.id) === String(id));
    if (!card) return;

    const inner = document.getElementById('flipCardInner');
    inner.classList.remove('flipped');

    const frontImg = document.getElementById('flipCardFrontImg');
    const immagineSrc = _urlImmagineVisualizzabile(card.immagine);
    frontImg.style.display = '';
    frontImg.src = immagineSrc || '';
    if (!immagineSrc) frontImg.style.display = 'none';

    document.getElementById('flipCardStats').innerHTML = `
        <div style="font-weight:800; font-size:0.95rem; margin-bottom:0.2rem;">${escapeHtml(card.name)}</div>
        <div style="font-size:0.78rem; opacity:0.85; margin-bottom:0.6rem;"><code style="background:none; color:inherit; padding:0;">${card.code}</code></div>
        ${card.notes ? `<div style="font-size:0.78rem; opacity:0.85; margin-top:0.4rem;">✨ ${escapeHtml(card.notes)}</div>` : ''}
    `;
    await _renderSleeve(card);

    document.getElementById('immagineModal').style.display = 'flex';

    if (_flipCardTimeout) clearTimeout(_flipCardTimeout);
    _flipCardTimeout = setTimeout(() => inner.classList.add('flipped'), 500);
}

function toggleFlipCard() {
    document.getElementById('flipCardInner').classList.toggle('flipped');
}

// Risolta una sola volta per pagina (il binder non cambia durante la
// navigazione) e tenuta in _sleeveRisolta — evita di richiamare la RPC ad
// ogni singola carta aperta.
async function _renderSleeve(card) {
    const wrap = document.getElementById('cbdWrap');
    wrap.style.display = 'none';

    if (_sleeveRisolta === null) {
        const { data: media, error } = await binderPubblicoLeggiMedia(_binderId);
        const riga = (!error && media) ? media.find(m => m.slot === 'card_back') : null;
        if (!riga) {
            _sleeveRisolta = false; // niente sleeve, non ritentare ad ogni carta
        } else if (riga.source === 'default') {
            const { data: pub } = supabaseClient.storage.from('default-assets').getPublicUrl(riga.storage_path);
            _sleeveRisolta = pub?.publicUrl ? { url: pub.publicUrl, metadata: riga.metadata } : false;
        } else {
            // Upload personalizzato: bucket pubblico 'immaginivisibili',
            // cartella 'carta' (stessa convenzione di _sincronizzaCopiaPubblica
            // in ui/admin-requests.ui.js). Se non è mai stata sincronizzata
            // (mai approvata prima di questa modifica), il file semplicemente
            // non esiste nel bucket — l'onerror sull'<img> del retro carta
            // (già gestito dal fallback var(--primary) di sempre) copre quel
            // caso senza bisogno di verificarlo qui.
            const { data: pub } = supabaseClient.storage.from('immaginivisibili').getPublicUrl(`carta/${_ownerUserId}/${_binderId}.png`);
            _sleeveRisolta = pub?.publicUrl ? { url: pub.publicUrl, metadata: riga.metadata } : false;
        }
    }

    if (!_sleeveRisolta) return; // resta il semplice sfondo var(--primary), nessuna regressione

    const cbdBgImg = document.getElementById('cbdBgImg');
    cbdBgImg.onerror = () => { wrap.style.display = 'none'; };
    cbdBgImg.src = _sleeveRisolta.url;
    const posizioni = (_sleeveRisolta.metadata && typeof _sleeveRisolta.metadata === 'object') ? _sleeveRisolta.metadata : DEFAULT_STATE_CARD_BACK;

    _cbdScrivi('pokemon', card.name || '');
    _cbdScrivi('condition', card.cond || '');
    _cbdScrivi('variazione', card.notes || '');
    _cbdScrivi('price', formattaEuro(card.price));

    Object.keys(DEFAULT_STATE_CARD_BACK).forEach(chiave => {
        const campo = document.getElementById('cbdField-' + chiave);
        if (!campo) return;
        const s = posizioni[chiave] || DEFAULT_STATE_CARD_BACK[chiave];
        campo.style.left = s.left + '%';
        campo.style.top = s.top + '%';
        const contenuto = campo.querySelector('.cbd-field-content');
        if (contenuto) contenuto.style.transform = `scale(${s.scale != null ? s.scale : 1})`;
    });

    wrap.style.display = 'block';
    const stage = document.getElementById('cbdStage');
    const scala = wrap.clientWidth / CARD_BACK_W;
    stage.style.transform = `scale(${scala})`;
    requestAnimationFrame(() => { stage.style.transform = `scale(${wrap.clientWidth / CARD_BACK_W})`; });
}

function _cbdScrivi(chiave, testo) {
    const el = document.getElementById('cbdText-' + chiave);
    if (el) el.textContent = testo;
}

function chiudiImmagineIngrandita() {
    document.getElementById('immagineModal').style.display = 'none';
    document.getElementById('flipCardInner').classList.remove('flipped');
    if (_flipCardTimeout) { clearTimeout(_flipCardTimeout); _flipCardTimeout = null; }
}


// ── Toggle Elenco / Sfoglia ───────────────────────────────────────────────
function impostaModalitaBinderPubblico(modalita) {
    if (modalita !== 'elenco' && modalita !== 'libro') return;
    _modalita = modalita;

    document.querySelectorAll('.binder-modalita-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.modalita === modalita);
    });

    const searchBox = document.getElementById('searchBoxWrap');
    const lista = document.getElementById('listaContainer');
    const paginazione = document.getElementById('binderPagination');

    if (modalita === 'elenco') {
        _libroSmonta();
        if (searchBox) searchBox.style.display = '';
        if (lista) lista.style.display = '';
        if (paginazione) paginazione.style.display = 'none';
    } else {
        if (searchBox) searchBox.style.display = 'none';
        if (lista) lista.style.display = 'none';
        renderBinderLibro();
    }
}


// ═══════════════════════════════════════════════════════════════════════
// LIBRO SFOGLIABILE — porta pubblica di ui/binder.ui.js (sessione Opus,
// 2026-08-25). Stesso identico motore di animazione/gesti, adattato per un
// contesto senza autenticazione:
// - niente _bindersElenco/_binderAttivo/BINDER_LAYOUTS/_binderLayout: un
//   solo binder per pagina (_binderId/_binderInfo), layout fisso 3×3 (la
//   pagina pubblica non ha selettore layout — vetrina, non gestione).
// - copertina risolta da _risolviCopertinaBinderPubblico() (bucket
//   pubblico), non da signed URL privata.
// - click carta → apriFlipCard() di questa pagina, non apriFlipCardHome.
// - nessuna rimozione: permettiRimozione sempre false, nessun bottone ✕.
// ═══════════════════════════════════════════════════════════════════════

const LIBRO_SOGLIA_DOPPIA_PX = 620;
const LIBRO_DURATA_GIRO_MS = 620;
const LIBRO_SOGLIA_DRAG_PX = 8;
const LIBRO_PAD_PAGINA = 10;
const LIBRO_GAP_TASCHE = 6;
const LIBRO_ALTEZZA_NUMERO = 16;
const LIBRO_LAYOUT = { cols: 3, rows: 3 }; // fisso — pagina pubblica, nessun selettore

let _libro = null;
let _libroObserver = null;

function _iconaFallbackBinder(tipo) {
    if (tipo === 'wishlist') return 'fa-heart';
    if (tipo === 'extra') return 'fa-star';
    return 'fa-box-open';
}

function renderBinderLibro() {
    const wrap = document.getElementById('binderLibroWrap');
    if (!wrap) { console.error('renderBinderLibro: manca #binderLibroWrap'); return; }
    wrap.style.display = 'block';

    const layout = LIBRO_LAYOUT;
    const carteOrdinate = carte; // già ordinate per nome dalla RPC pubblica

    _libro = {
        carte: carteOrdinate,
        cols: layout.cols,
        rows: layout.rows,
        perPagina: layout.cols * layout.rows,
        totalePagine: Math.max(1, Math.ceil(carteOrdinate.length / (layout.cols * layout.rows))),
        copertinaUrl: (_copertinaRisolta && _copertinaRisolta !== false) ? _copertinaRisolta : null,
        modo: 'singola',
        facce: [],
        k: 0,
        pw: 0,
        ph: 0,
        animando: false,
        drag: null,
        dragMosso: false,
    };

    _libroMisura();
    _libro.facce = _libroCostruisciFacce();
    _libro.k = _libroKDaPagina(_binderPagina); // conserva la pagina se si torna qui
    _libroDisegnaStatico();
    _libroInitGesti();
    _libroOsservaResize();

    if (!_libro.copertinaUrl) {
        _risolviCopertinaBinderPubblico(_binderId).then(url => {
            if (!url || !_libro) return;
            _libro.copertinaUrl = url;
            if (!_libro.animando) _libroDisegnaStatico();
        });
    }
}

function _libroSmonta() {
    if (_libroObserver) { _libroObserver.disconnect(); _libroObserver = null; }
    _libro = null;
    const wrap = document.getElementById('binderLibroWrap');
    if (wrap) wrap.style.display = 'none';
}

function _libroOsservaResize() {
    if (_libroObserver || typeof ResizeObserver === 'undefined') return;
    const wrap = document.getElementById('binderLibroWrap');
    if (!wrap) return;
    _libroObserver = new ResizeObserver(() => {
        if (!_libro || _libro.animando) return;
        const modoPrima = _libro.modo;
        const paginaCorrente = _libroPaginaCorrente();
        _libroMisura();
        if (_libro.modo !== modoPrima) {
            _libro.facce = _libroCostruisciFacce();
            _libro.k = _libroKDaPagina(paginaCorrente);
        }
        _libroDisegnaStatico();
    });
    _libroObserver.observe(wrap);
}

function _libroMisura() {
    const wrap = document.getElementById('binderLibroWrap');
    const disponibile = (wrap && wrap.clientWidth) ? wrap.clientWidth : 320;
    _libro.modo = disponibile >= LIBRO_SOGLIA_DOPPIA_PX ? 'doppia' : 'singola';

    const cols = _libro.cols, rows = _libro.rows;
    let pw = _libro.modo === 'doppia' ? Math.floor(disponibile / 2) : disponibile;

    const altezzaDaLarghezza = (larghezza) => {
        const slotW = (larghezza - 2 * LIBRO_PAD_PAGINA - (cols - 1) * LIBRO_GAP_TASCHE) / cols;
        const slotH = slotW * 88 / 63;
        return Math.round(rows * slotH + (rows - 1) * LIBRO_GAP_TASCHE + 2 * LIBRO_PAD_PAGINA + LIBRO_ALTEZZA_NUMERO);
    };

    let ph = altezzaDaLarghezza(pw);

    const altezzaUtile = window.innerHeight;
    const maxH = Math.max(240, Math.round(altezzaUtile * 0.62));

    if (ph > maxH) {
        const slotH = (maxH - 2 * LIBRO_PAD_PAGINA - LIBRO_ALTEZZA_NUMERO - (rows - 1) * LIBRO_GAP_TASCHE) / rows;
        const slotW = Math.max(18, slotH * 63 / 88);
        pw = Math.round(cols * slotW + (cols - 1) * LIBRO_GAP_TASCHE + 2 * LIBRO_PAD_PAGINA);
        ph = maxH;
    }

    _libro.pw = Math.max(120, Math.round(pw));
    _libro.ph = Math.max(160, Math.round(ph));
}

function _libroCostruisciFacce() {
    const facce = [{ t: 'copertina' }];
    if (_libro.modo === 'doppia') facce.push({ t: 'risguardo' });
    for (let i = 0; i < _libro.totalePagine; i++) facce.push({ t: 'pagina', i });
    if (_libro.modo === 'doppia' && facce.length % 2 !== 0) facce.push({ t: 'risguardo' });
    return facce;
}

function _libroNumFogli() { return _libro.modo === 'doppia' ? _libro.facce.length / 2 : _libro.facce.length - 1; }
function _libroFronteFoglio(j) { return _libro.modo === 'doppia' ? _libro.facce[2 * j] : _libro.facce[j]; }
function _libroRetroFoglio(j) { return _libro.modo === 'doppia' ? _libro.facce[2 * j + 1] : _libro.facce[j + 1]; }
function _libroFacciaSinistraPer(k) {
    if (_libro.modo !== 'doppia') return null;
    return k > 0 ? _libro.facce[2 * k - 1] : null;
}
function _libroFacciaDestraPer(k) {
    if (_libro.modo === 'doppia') return k < _libroNumFogli() ? _libro.facce[2 * k] : null;
    return _libro.facce[k] || null;
}
function _libroPuoAvanti() { return _libro.k < _libroNumFogli(); }
function _libroPuoIndietro() { return _libro.k > 0; }

function _libroPaginaCorrente() {
    const destra = _libroFacciaDestraPer(_libro.k);
    if (destra && destra.t === 'pagina') return destra.i;
    const sinistra = _libroFacciaSinistraPer(_libro.k);
    if (sinistra && sinistra.t === 'pagina') return sinistra.i;
    return 0;
}

function _libroKDaPagina(pagina) {
    const p = Math.max(0, Math.min(Number(pagina) || 0, _libro.totalePagine - 1));
    const k = _libro.modo === 'doppia' ? Math.ceil((p + 2) / 2) : p + 1;
    return Math.max(0, Math.min(k, _libroNumFogli()));
}

function _libroDisegnaStatico() {
    const scena = document.getElementById('binderLibroScena');
    const sx = document.getElementById('binderLibroSx');
    const dx = document.getElementById('binderLibroDx');
    const foglio = document.getElementById('binderLibroFoglio');
    if (!scena || !sx || !dx || !foglio) return;

    const pw = _libro.pw, ph = _libro.ph;
    scena.classList.toggle('libro-modo-doppia', _libro.modo === 'doppia');
    scena.classList.toggle('libro-modo-singola', _libro.modo === 'singola');
    scena.style.width = (_libro.modo === 'doppia' ? pw * 2 : pw) + 'px';
    scena.style.height = ph + 'px';

    [sx, dx, foglio].forEach(el => { el.style.width = pw + 'px'; el.style.height = ph + 'px'; });
    sx.style.display = _libro.modo === 'doppia' ? 'block' : 'none';
    dx.style.left = (_libro.modo === 'doppia' ? pw : 0) + 'px';
    foglio.style.left = (_libro.modo === 'doppia' ? pw : 0) + 'px';
    foglio.style.display = 'none';

    const facciaSx = _libroFacciaSinistraPer(_libro.k);
    const facciaDx = _libroFacciaDestraPer(_libro.k);
    sx.innerHTML = _libroHtmlFaccia(facciaSx);
    dx.innerHTML = _libroHtmlFaccia(facciaDx);
    sx.classList.toggle('libro-lato-spento', !facciaSx);
    dx.classList.toggle('libro-lato-spento', !facciaDx);

    _binderPagina = _libroPaginaCorrente();
    _libroSincronizzaEtichette();
}

function _libroSincronizzaEtichette() {
    const label = document.getElementById('binderPaginaLabel');
    const prev = document.getElementById('binderPrevBtn');
    const next = document.getElementById('binderNextBtn');

    if (label) {
        const facciaDx = _libroFacciaDestraPer(_libro.k);
        const facciaSx = _libroFacciaSinistraPer(_libro.k);
        if (_libro.carte.length === 0) {
            label.textContent = 'Binder vuoto';
        } else if (facciaDx && facciaDx.t === 'copertina') {
            label.textContent = 'Copertina';
        } else {
            const numeri = [facciaSx, facciaDx].filter(f => f && f.t === 'pagina').map(f => f.i + 1);
            label.textContent = numeri.length
                ? `Pagin${numeri.length > 1 ? 'e' : 'a'} ${numeri.join('-')} di ${_libro.totalePagine}`
                : `— di ${_libro.totalePagine}`;
        }
    }
    if (prev) prev.disabled = !_libroPuoIndietro();
    if (next) next.disabled = !_libroPuoAvanti();
}

function _libroHtmlFaccia(faccia) {
    if (!faccia) return '';
    if (faccia.t === 'copertina') return _libroHtmlCopertina();
    if (faccia.t === 'pagina') return _libroHtmlPagina(faccia.i);
    return '<div class="libro-risguardo"></div>';
}

function _libroHtmlCopertina() {
    const nome = escapeHtml(_binderInfo ? (_binderInfo.nome || '') : '');
    const icona = _iconaFallbackBinder(_binderInfo ? _binderInfo.tipo : 'location');
    const immagine = _libro.copertinaUrl
        ? `<img src="${_libro.copertinaUrl}" alt="${nome}" onerror="this.remove();">`
        : `<i class="fa-solid ${icona}"></i>`;
    return `<div class="libro-copertina">${immagine}<div class="libro-copertina-etichetta">${nome}</div></div>`;
}

function _libroHtmlPagina(indicePagina) {
    const inizio = indicePagina * _libro.perPagina;
    const carteQuestaPagina = _libro.carte.slice(inizio, inizio + _libro.perPagina);

    let tasche = '';
    for (let i = 0; i < _libro.perPagina; i++) {
        const card = carteQuestaPagina[i];
        if (!card) {
            tasche += '<div class="binder-slot binder-slot-empty"><i class="fa-solid fa-layer-group"></i></div>';
            continue;
        }
        const idAttr = String(card.id).replace(/'/g, "\\'");
        const nomeAttr = (card.name || '').replace(/"/g, '&quot;');
        const immagineSrc = _urlImmagineVisualizzabile(card.immagine, 300);
        tasche += `
            <div class="binder-slot binder-slot-filled" onclick="_libroClickCarta('${idAttr}')" title="${nomeAttr}">
                <div class="binder-slot-fallback"><i class="fa-solid fa-image"></i><span>${nomeAttr}</span></div>
                ${immagineSrc ? `<img src="${immagineSrc}" alt="${nomeAttr}" loading="lazy" draggable="false" onerror="this.remove();">` : ''}
                ${card.qty > 1 ? `<span class="binder-slot-qty-badge">×${card.qty}</span>` : ''}
            </div>`;
    }

    return `
        <div class="libro-pagina-griglia" style="grid-template-columns: repeat(${_libro.cols}, 1fr);">${tasche}</div>
        <div class="libro-pagina-numero">${indicePagina + 1}</div>`;
}

function _libroClickCarta(id) {
    if (_libro && _libro.dragMosso) { _libro.dragMosso = false; return; }
    apriFlipCard(id);
}

function _libroPreparaFoglio(j, direzione) {
    const foglio = document.getElementById('binderLibroFoglio');
    const fronte = document.getElementById('binderLibroFronte');
    const retro = document.getElementById('binderLibroRetro');
    const sx = document.getElementById('binderLibroSx');
    const dx = document.getElementById('binderLibroDx');
    if (!foglio || !fronte || !retro || !sx || !dx) return;

    fronte.innerHTML = _libroHtmlFaccia(_libroFronteFoglio(j));
    retro.innerHTML = _libroHtmlFaccia(_libroRetroFoglio(j));

    if (direzione > 0) {
        const nuovaDestra = _libroFacciaDestraPer(_libro.k + 1);
        dx.innerHTML = _libroHtmlFaccia(nuovaDestra);
        dx.classList.toggle('libro-lato-spento', !nuovaDestra);
    } else {
        const nuovaSinistra = _libroFacciaSinistraPer(_libro.k - 1);
        sx.innerHTML = _libroHtmlFaccia(nuovaSinistra);
        sx.classList.toggle('libro-lato-spento', !nuovaSinistra);
    }

    foglio.style.display = 'block';
    foglio.style.transition = 'none';
    foglio.style.transform = `rotateY(${direzione > 0 ? 0 : -180}deg)`;
    foglio.style.setProperty('--libro-ombra', '0');
    void foglio.offsetWidth;
    foglio.style.transition = '';
}

function _libroGira(direzione) {
    if (!_libro || _libro.animando) return;
    if (direzione > 0 && !_libroPuoAvanti()) return;
    if (direzione < 0 && !_libroPuoIndietro()) return;

    const j = direzione > 0 ? _libro.k : _libro.k - 1;
    _libro.animando = true;
    _libroPreparaFoglio(j, direzione);

    const foglio = document.getElementById('binderLibroFoglio');
    requestAnimationFrame(() => {
        foglio.classList.add('girando');
        foglio.style.transform = `rotateY(${direzione > 0 ? -180 : 0}deg)`;
    });

    setTimeout(() => {
        foglio.classList.remove('girando');
        _libro.k += direzione;
        _libro.animando = false;
        _libroDisegnaStatico();
    }, LIBRO_DURATA_GIRO_MS + 40);
}

function _libroInitGesti() {
    const scena = document.getElementById('binderLibroScena');
    if (!scena || scena.dataset.gestiPronti === '1') return;
    scena.dataset.gestiPronti = '1';
    scena.addEventListener('pointerdown', _libroPointerDown);
    scena.addEventListener('pointermove', _libroPointerMove);
    scena.addEventListener('pointerup', _libroPointerUp);
    scena.addEventListener('pointercancel', _libroPointerUp);
}

function _libroPointerDown(e) {
    if (!_libro || _libro.animando) return;
    _libro.dragMosso = false;
    _libro.drag = { x0: e.clientX, y0: e.clientY, deciso: false, direzione: 0, progresso: 0 };
}

function _libroPointerMove(e) {
    if (!_libro || !_libro.drag || _libro.animando) return;
    const d = _libro.drag;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;

    if (!d.deciso) {
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > LIBRO_SOGLIA_DRAG_PX) { _libro.drag = null; return; }
        if (Math.abs(dx) < LIBRO_SOGLIA_DRAG_PX) return;

        const direzione = dx < 0 ? 1 : -1;
        if (direzione > 0 && !_libroPuoAvanti()) { _libro.drag = null; return; }
        if (direzione < 0 && !_libroPuoIndietro()) { _libro.drag = null; return; }

        d.deciso = true;
        d.direzione = direzione;
        _libro.dragMosso = true;
        _libroPreparaFoglio(direzione > 0 ? _libro.k : _libro.k - 1, direzione);
        const foglioNuovo = document.getElementById('binderLibroFoglio');
        foglioNuovo.classList.add('in-trascinamento');
        try { foglioNuovo.setPointerCapture(e.pointerId); } catch (_) { /* ignorato di proposito */ }
    }

    const progresso = Math.max(0, Math.min(1, Math.abs(dx) / _libro.pw));
    d.progresso = progresso;
    const angolo = d.direzione > 0 ? -180 * progresso : -180 * (1 - progresso);
    const foglio = document.getElementById('binderLibroFoglio');
    foglio.style.transform = `rotateY(${angolo}deg)`;
    foglio.style.setProperty('--libro-ombra', String(Math.sin(progresso * Math.PI) * 0.55));
    e.preventDefault();
}

function _libroPointerUp() {
    if (!_libro || !_libro.drag) return;
    const d = _libro.drag;
    _libro.drag = null;
    if (!d.deciso) return;

    const foglio = document.getElementById('binderLibroFoglio');
    foglio.classList.remove('in-trascinamento');
    const completa = d.progresso > 0.35;

    _libro.animando = true;
    foglio.classList.add('girando');
    foglio.style.transform = `rotateY(${(d.direzione > 0) === completa ? -180 : 0}deg)`;
    foglio.style.removeProperty('--libro-ombra');

    setTimeout(() => {
        foglio.classList.remove('girando');
        if (completa) _libro.k += d.direzione;
        _libro.animando = false;
        _libroDisegnaStatico();
    }, LIBRO_DURATA_GIRO_MS + 40);
}

function binderPaginaAvanti() {
    if (_libro) { _libroGira(1); return; }
}
function binderPaginaIndietro() {
    if (_libro) { _libroGira(-1); return; }
}
