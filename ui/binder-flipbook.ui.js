// Libro sfogliabile dei binder (cerniera 3D, trascinamento, pagine), condiviso con le pagine
// pubbliche.

let _libroSelezionabile = false;
let _libroPrezzoObiettivo = false;
let _copertinaRisolta = null;

async function _caricaCopertinaBinder(binderId) {
    const url = await _risolviCopertinaBinderPubblico(binderId);
    if (!url) return;

    const banner = document.getElementById('copertinaBinderBanner');
    if (!banner) return;
    banner.onerror = () => { banner.style.display = 'none'; };
    banner.src = url;
    banner.style.display = 'block';
}

async function _risolviCopertinaBinderPubblico(binderId) {
    if (_copertinaRisolta !== null) return _copertinaRisolta || null;

    const { data: media, error } = await binderPubblicoLeggiMedia(binderId);
    const copertina = (!error && media) ? media.find(m => m.slot === 'binder_cover') : null;
    if (!copertina) { _copertinaRisolta = false; return null; }

    let url = null;
    if (copertina.source === 'default') {
        url = binderPubblicoUrlFile('default-assets', copertina.storage_path);
    } else {
        url = binderPubblicoUrlFile('immaginivisibili', `binder/${_ownerUserId}/${binderId}.png`);
    }
    _copertinaRisolta = url || false;
    return url;
}
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
        if (paginazione) paginazione.style.display = '';
        renderBinderLibro();
    }
}

const LIBRO_SOGLIA_DOPPIA_PX = 620;
const LIBRO_DURATA_GIRO_MS = 620;
const LIBRO_SOGLIA_DRAG_PX = 8;
const LIBRO_PAD_PAGINA = 10;
const LIBRO_GAP_TASCHE = 6;
const LIBRO_ALTEZZA_NUMERO = 16;
const BINDER_LAYOUTS = {
    '2x2': { cols: 2, rows: 2 },
    '3x3': { cols: 3, rows: 3 },
    '3x4': { cols: 4, rows: 3 },
    '4x4': { cols: 4, rows: 4 },
};

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

    const layout = BINDER_LAYOUTS[_binderInfo && _binderInfo.layout] || BINDER_LAYOUTS['3x3'];
    const carteOrdinate = carte;

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
    _libro.k = _libroKDaPagina(_binderPagina);
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
    const col = (_binderInfo && typeof _binderInfo.colore === 'string' && /^#[0-9a-fA-F]{6}$/.test(_binderInfo.colore)) ? _binderInfo.colore : null;
    return `<div class="libro-copertina"${col ? ` style="background:${col}"` : ''}>${immagine}<div class="libro-copertina-etichetta">${nome}</div></div>`;
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
        const nomeAttr = escapeHtml(card.name || '').replace(/"/g, '&quot;');
        const immagineSrc = _urlImmagineVisualizzabile(card.immagine, 300);
        const qtyMax = (card.qty !== undefined ? card.qty : card.qtyDisponibile) || 1;
        const bloccata = _libroSelezionabile && qtyMax <= 0;
        const selezionata = _libroSelezionabile && !bloccata && (selezioni[card.id] || 0) > 0;
        tasche += `
            <div class="binder-slot binder-slot-filled${selezionata ? ' binder-slot-selected' : ''}${bloccata ? ' binder-slot-riservato' : ''}" onclick="_libroClickCarta('${idAttr}')" title="${nomeAttr}">
                <div class="binder-slot-fallback"><i class="fa-solid fa-image"></i><span>${nomeAttr}</span></div>
                ${immagineSrc ? `<img src="${immagineSrc}" alt="${nomeAttr}" loading="lazy" draggable="false" onerror="this.remove();">` : ''}
                ${qtyMax > 1 && !_libroSelezionabile ? `<span class="binder-slot-qty-badge">×${qtyMax}</span>` : ''}
                ${bloccata ? `<span class="binder-slot-qty-badge binder-slot-riservato-badge">🔒</span>` : ''}
                ${_libroSelezionabile ? _libroHtmlSelezione(card, qtyMax, bloccata) : ''}
            </div>`;
    }

    return `
        <div class="libro-pagina-griglia" style="grid-template-columns: repeat(${_libro.cols}, 1fr);">${tasche}</div>
        <div class="libro-pagina-numero">${indicePagina + 1}</div>`;
}

function _libroHtmlSelezione(card, qtyMax, bloccata) {
    const idAttr = String(card.id).replace(/'/g, "\\'");
    const qtyAttuale = bloccata ? 0 : (selezioni[card.id] || 0);
    let prezzo = '';
    if (_libroPrezzoObiettivo) {
        if (card.prezzoObiettivo != null) prezzo = `<span class="bx-slot-prezzo">max ${formattaEuro(card.prezzoObiettivo)}</span>`;
    } else if (card.price != null && Number(card.price) > 0) {
        prezzo = `<span class="bx-slot-prezzo">${formattaEuro(card.price)}</span>`;
    }
    if (bloccata) return `${prezzo}<span class="bx-slot-lucchetto"><i class="fa-solid fa-lock"></i></span>`;
    const piu = `<button type="button" class="bx-slot-btn" aria-label="Aggiungi" onclick="event.stopPropagation(); modificaQty('${idAttr}', 1)" ${qtyAttuale >= qtyMax ? 'disabled' : ''}>+</button>`;
    if (qtyAttuale <= 0) return `${prezzo}<div class="bx-slot-azione" onclick="event.stopPropagation();">${piu}</div>`;
    return `${prezzo}<div class="bx-slot-azione bx-slot-azione-attiva" onclick="event.stopPropagation();">
        <button type="button" class="bx-slot-btn" aria-label="Togli" onclick="event.stopPropagation(); modificaQty('${idAttr}', -1)">−</button>
        <span class="bx-slot-n">${qtyAttuale}</span>${piu}
    </div>`;
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
        try { foglioNuovo.setPointerCapture(e.pointerId); } catch (_) {   }
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
