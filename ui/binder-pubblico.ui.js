// Pagina pubblica di un binder (binder-pubblico.html).

function _binderPubblicoESelezionabile() {
    if (!_binderInfo) return false;
    if (_binderInfo.tipo === 'wishlist') return true;
    if (_binderInfo.tipo === 'scambio') return true;
    return _binderInfo.tipo === 'location' && _binderInfo.location_valore === 'SCAMBIO';
}

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
    _binderInfo = { nome: nomeBinder, tipo: info[0].tipo, location_valore: info[0].location_valore, layout: info[0].layout, colore: info[0].colore || null, nickname: info[0].nickname || null };
    document.title = 'Bindex — ' + nomeBinder;
    document.getElementById('titoloBinder').textContent = nomeBinder;
    const elProprietario = document.getElementById('proprietarioBinder');
    if (elProprietario && info[0].nickname) { elProprietario.textContent = 'di ' + info[0].nickname; elProprietario.style.display = ''; }

    binderPubblicoRegistraApertura(binderId).catch(() => {   });

    const selezionabile = _binderPubblicoESelezionabile();
    _libroSelezionabile = selezionabile;
    _libroPrezzoObiettivo = _binderInfo.tipo === 'wishlist';
    document.body.classList.toggle('binder-pubblico-selezionabile', selezionabile);
    const barraTotale = document.getElementById('barraTotale');
    if (barraTotale) barraTotale.style.display = selezionabile ? 'flex' : 'none';
    const sottotitolo = document.getElementById('sottotitoloBinder');
    if (sottotitolo) sottotitolo.textContent = selezionabile
        ? 'Seleziona le carte che ti interessano — il totale si aggiorna da solo.'
        : 'Vetrina pubblica — sola lettura.';

    _tipoOggettoRichiesta = 'carta';
    const btnRichiedi = document.getElementById('btnRichiediScambio');
    if (btnRichiedi) btnRichiedi.style.display = (_binderInfo.tipo === 'scambio') ? '' : 'none';
    if (_binderInfo.tipo === 'scambio' && typeof ospiteMostraControllo === 'function') ospiteMostraControllo();

    _caricaCopertinaBinder(binderId);

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
        qtyDisponibile: Math.max(0, (r.qty || 1) - (r.riservato || 0)),
        riservato: r.riservato || 0,
        prezzoObiettivo: r.prezzo_obiettivo != null ? Number(r.prezzo_obiettivo) : null,
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
    impostaModalitaBinderPubblico('libro');
}

function _testoConteggioSelezione(distinte, pezzi) {
    return `${distinte} cart${distinte === 1 ? 'a' : 'e'} · ${pezzi} pz.`;
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

    const selezionabile = _binderPubblicoESelezionabile();
    const eWishlist = _binderInfo && _binderInfo.tipo === 'wishlist';

    container.innerHTML = filtrate.map(c => {
        const immagineSrc = _urlImmagineVisualizzabile(c.immagine);
        if (selezionabile) {
            const bloccata = c.qtyDisponibile <= 0;
            const selezionata = !bloccata && selezioni[c.id] > 0;
            const qtyAttuale = bloccata ? 0 : (selezioni[c.id] || 0);
            return `
                <div class="card-row ${selezionata ? 'selected' : ''} ${bloccata ? 'riservato' : ''}" id="row-${c.id}">
                    <input type="checkbox" class="card-checkbox" ${selezionata ? 'checked' : ''} ${bloccata ? 'disabled' : ''}
                           onchange="toggleSelezione('${c.id}', this.checked)">
                    ${immagineSrc ? `<img src="${immagineSrc}" alt="" class="card-thumb" onclick="event.stopPropagation(); apriFlipCard('${c.id}')" onerror="this.style.display='none';">` : ''}
                    <div class="card-info">
                        <div class="card-name">${escapeHtml(c.name)}${c.code ? ` <span style="color:var(--text-muted); font-weight:600;">(${escapeHtml(c.code)})</span>` : ''}</div>
                        <div class="card-meta">
                            <span class="badge">${escapeHtml(c.lang)}</span>
                            <span class="badge">${escapeHtml(c.cond)}</span>
                            ${bloccata
                                ? `<span class="badge badge-riservato">🔒 Riservato</span>`
                                : `<span class="badge">${eWishlist ? 'Vuole' : 'Disp.'} ${c.qtyDisponibile}</span>`}
                            ${!eWishlist && !bloccata && c.riservato > 0 ? `<span class="badge badge-riservato">🔒 ${c.riservato} riservat${c.riservato === 1 ? 'a' : 'e'}</span>` : ''}
                            ${eWishlist && c.prezzoObiettivo != null ? `<span class="badge">🎯 max ${formattaEuro(c.prezzoObiettivo)}</span>` : ''}
                            ${c.notes ? `<span class="badge">✨ ${escapeHtml(c.notes)}</span>` : ''}
                        </div>
                    </div>
                    <div class="qty-control">
                        <button class="qty-btn" onclick="modificaQty('${c.id}', -1)" ${qtyAttuale <= 0 || bloccata ? 'disabled' : ''}>-</button>
                        <span class="qty-value">${qtyAttuale}</span>
                        <button class="qty-btn" onclick="modificaQty('${c.id}', 1)" ${qtyAttuale >= c.qtyDisponibile || bloccata ? 'disabled' : ''}>+</button>
                    </div>
                    <div class="card-price">${formattaEuro(c.price)}<small>cad.</small></div>
                </div>
            `;
        }
        return `
            <div class="card-row">
                ${immagineSrc ? `<img src="${immagineSrc}" alt="" class="card-thumb" onclick="apriFlipCard('${c.id}')" onerror="this.style.display='none';">` : ''}
                <div class="card-info">
                    <div class="card-name">${escapeHtml(c.name)}${c.code ? ` <span style="color:var(--text-muted); font-weight:600;">(${escapeHtml(c.code)})</span>` : ''}</div>
                    <div class="card-meta">
                        <span class="badge">${escapeHtml(c.lang)}</span>
                        <span class="badge">${escapeHtml(c.cond)}</span>
                        ${c.qtyDisponibile > 1 ? `<span class="badge">×${c.qtyDisponibile}</span>` : ''}
                        ${c.notes ? `<span class="badge">✨ ${escapeHtml(c.notes)}</span>` : ''}
                    </div>
                </div>
                <div class="card-price">${formattaEuro(c.price)}</div>
            </div>
        `;
    }).join('');
}

function copiaRiepilogo() {
    const righe = [];
    let totale = 0;
    carte.forEach(c => {
        const q = selezioni[c.id] || 0;
        if (q > 0) {
            righe.push(`${q}x ${c.name}${c.code ? ' (' + c.code + ')' : ''} — ${formattaEuro(c.price * q)}`);
            totale += q * c.price;
        }
    });
    if (righe.length === 0) return;

    const eWishlist = _binderInfo && _binderInfo.tipo === 'wishlist';
    let intestazione;
    if (eWishlist) {
        intestazione = _nomeProprietarioWishlist
            ? `Carte che potrei procurare a ${_nomeProprietarioWishlist}:`
            : `Carte dalla wishlist che potrei procurargli/le:`;
    } else {
        intestazione = `Carte che mi interessano per lo scambio:`;
    }
    const testo = `${intestazione}\n\n${righe.join('\n')}\n\nTotale: ${formattaEuro(totale)}`;

    navigator.clipboard.writeText(testo).then(() => {
        const btn = document.getElementById('btnCopiaRiepilogo');
        const originale = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copiato!';
        setTimeout(() => { btn.innerHTML = originale; }, 1800);
    }).catch(() => {
        alert(testo);
    });
}

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

    const eWishlist = _binderInfo && _binderInfo.tipo === 'wishlist';
    document.getElementById('flipCardStats').innerHTML = `
        <div style="font-weight:800; font-size:0.95rem; margin-bottom:0.2rem;">${escapeHtml(card.name)}</div>
        <div style="font-size:0.78rem; opacity:0.85; margin-bottom:0.6rem;"><code style="background:none; color:inherit; padding:0;">${escapeHtml(card.code)}</code></div>
        ${eWishlist ? `<div style="font-size:0.85rem;">Vuole: <strong>${card.qtyDisponibile}</strong></div>` : ''}
        ${card.notes ? `<div style="font-size:0.78rem; opacity:0.85; margin-top:0.4rem;">✨ ${escapeHtml(card.notes)}</div>` : ''}
    `;
    await _renderSleeve(card);

    document.getElementById('immagineModal').style.display = 'flex';
    _flipCardIdAperta = card.id;
    _flipCardAggiornaAggiungi();
    _bxFotoReali(card.id);

    if (_flipCardTimeout) clearTimeout(_flipCardTimeout);
    _flipCardTimeout = setTimeout(() => inner.classList.add('flipped'), 500);
}

let _flipCardIdAperta = null;
function _flipCardAggiornaAggiungi() {
    const btn = document.getElementById('flipCardAggiungi');
    if (!btn) return;
    const card = carte.find(c => String(c.id) === String(_flipCardIdAperta));
    if (!card || !_binderPubblicoESelezionabile() || card.qtyDisponibile <= 0) { btn.style.display = 'none'; return; }
    const q = selezioni[card.id] || 0;
    btn.style.display = '';
    btn.disabled = q >= card.qtyDisponibile;
    btn.innerHTML = q > 0
        ? `<i class="fa-solid fa-check"></i> Nella scelta (${q}) — aggiungi un'altra`
        : `<i class="fa-solid fa-plus"></i> ${_binderInfo && _binderInfo.tipo === 'wishlist' ? "Ce l'ho" : 'Aggiungi alla scelta'}`;
}
function flipCardAggiungiAllaScelta() {
    if (_flipCardIdAperta == null) return;
    modificaQty(_flipCardIdAperta, 1);
    _flipCardAggiornaAggiungi();
}

function toggleFlipCard() {
    document.getElementById('flipCardInner').classList.toggle('flipped');
}

async function _renderSleeve(card) {
    const wrap = document.getElementById('cbdWrap');
    wrap.style.display = 'none';

    if (_sleeveRisolta === null) {
        const { data: media, error } = await binderPubblicoLeggiMedia(_binderId);
        const riga = (!error && media) ? media.find(m => m.slot === 'card_back') : null;
        if (!riga) {
            _sleeveRisolta = false;
        } else if (riga.source === 'default') {
            const urlPub = binderPubblicoUrlFile('default-assets', riga.storage_path);
            _sleeveRisolta = urlPub ? { url: urlPub, metadata: riga.metadata } : false;
        } else {
            const urlPub = binderPubblicoUrlFile('immaginivisibili', `carta/${_ownerUserId}/${_binderId}.png`);
            _sleeveRisolta = urlPub ? { url: urlPub, metadata: riga.metadata } : false;
        }
    }

    if (!_sleeveRisolta) return;

    const cbdBgImg = document.getElementById('cbdBgImg');
    cbdBgImg.onerror = () => { wrap.style.display = 'none'; };
    cbdBgImg.src = _sleeveRisolta.url;
    const posizioni = (_sleeveRisolta.metadata && typeof _sleeveRisolta.metadata === 'object') ? _sleeveRisolta.metadata : DEFAULT_STATE_CARD_BACK;

    _cbdScrivi('pokemon', card.name || '');
    _cbdScrivi('condition', card.cond || '');
    let testoVariazione;
    if (_binderInfo && _binderInfo.tipo === 'wishlist') {
        testoVariazione = card.prezzoObiettivo != null ? ('Obiettivo: ' + formattaEuro(card.prezzoObiettivo)) : '';
    } else if (_binderPubblicoESelezionabile()) {
        testoVariazione = 'Disponibili: ' + (card.qtyDisponibile != null ? card.qtyDisponibile : '');
    } else {
        testoVariazione = card.notes || '';
    }
    _cbdScrivi('variazione', testoVariazione);
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
    _flipCardIdAperta = null;
    if (_flipCardTimeout) { clearTimeout(_flipCardTimeout); _flipCardTimeout = null; }
}

async function _bxFotoReali(cartaId) {
    const box = document.getElementById('flipCardFotoReali');
    if (!box) return;
    box.innerHTML = '';
    if (!_binderInfo || _binderInfo.tipo === 'wishlist' || typeof binderPubblicoFotoCarte !== 'function') return;
    box.dataset.carta = String(cartaId);
    try {
        const { data, error } = await binderPubblicoFotoCarte([cartaId]);
        if (error || box.dataset.carta !== String(cartaId)) return;
        box.innerHTML = fotoRealiStripHtml(data || []);
    } catch (e) { console.warn('[foto] binder pubblico:', e); }
}
