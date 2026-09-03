// ── ui/wishlist.ui.js ────────────────────────────────────────────────────
// Logica UI specifica di wishlist.html: caricamento catalogo, rendering
// lista, flip-card, riepilogo selezione.
//
// Dipende da: data/wishlist.repository.js, data/binder-pubblico.repository.js,
// state/wishlist.state.js, utils/shared-public.js, ui/card-back-viewer.ui.js,
// ui/binder-flipbook.ui.js (motore del libro sfogliabile, condiviso —
// aggiunto 26/08/2026).

// Attiva l'overlay di selezione/quantità anche dentro la modalità Sfoglia
// (libro) — di default false nel modulo condiviso (binder-pubblico.html
// non ha selezione). Assegnazione, non "let": la variabile è già
// dichiarata in ui/binder-flipbook.ui.js, caricato prima di questo file.
_libroSelezionabile = true;

// A16: flip-modal — mostra prima il fronte (immagine reale), poi gira da
// sola dopo una breve pausa rivelando nome/codice/prezzo/obiettivo/note.
// Stesso concetto già esteso a tutto il sito privato in A15, qui
// riadattato per la pagina pubblica: niente "Vai al binder" (non ha senso
// per chi non è il proprietario) e niente location (la wishlist non la
// possiede ancora).
function apriFlipCard(id) {
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
        <div style="font-size:0.78rem; opacity:0.85; margin-bottom:0.6rem;"><code style="background:none; color:inherit; padding:0;">${escapeHtml(card.code)}</code></div>
        <div style="font-size:0.85rem;">Vuole: <strong>${card.qtyDisponibile}</strong></div>
        ${card.notes ? `<div style="font-size:0.78rem; opacity:0.85; margin-top:0.4rem;">✨ ${escapeHtml(card.notes)}</div>` : ''}
    `;
    renderRetroCartaViewer(card);

    document.getElementById('immagineModal').style.display = 'flex';

    if (_flipCardTimeout) clearTimeout(_flipCardTimeout);
    _flipCardTimeout = setTimeout(() => inner.classList.add('flipped'), 500);
}

// Hook per ui/card-back-viewer.ui.js: testo del campo "variazione" sul
// retro carta — qui mostra il prezzo obiettivo (non esiste "variazione"
// come dato per una wishlist).
function _cbdTestoVariazione(card) {
    return (card.prezzoObiettivo !== undefined && card.prezzoObiettivo !== null) ? ('Obiettivo: ' + formattaEuro(card.prezzoObiettivo)) : '';
}

function chiudiImmagineIngrandita() {
    document.getElementById('immagineModal').style.display = 'none';
    document.getElementById('flipCardInner').classList.remove('flipped');
    if (_flipCardTimeout) { clearTimeout(_flipCardTimeout); _flipCardTimeout = null; }
}

async function caricaCatalogo() {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('u');
    _ownerUserId = userId;
    const container = document.getElementById('listaContainer');

    if (!userId) {
        container.innerHTML = '<div class="stato-errore"><i class="fa-solid fa-triangle-exclamation"></i> Link non valido — manca il riferimento alla collezione.</div>';
        return;
    }

    // Fix 26/08/2026 (24_card_back_binder_id.sql): il retro carta con
    // sleeve personalizzata è per-binder, non più per-owner — risolviamo
    // qui il binder_id del binder tipo='wishlist' di questo owner, usato
    // più sotto da renderRetroCartaViewer. In try/catch: un fallimento qui
    // NON deve mai bloccare il caricamento del catalogo sottostante, che è
    // la funzionalità primaria della pagina.
    try {
        _ownerBinderId = await cardBackViewerLeggiBinderIdOwner(userId, 'wishlist');
    } catch (e) {
        console.error('risoluzione binder Wishlist:', e);
        _ownerBinderId = null;
    }
    _binderId = _ownerBinderId; // bridge per ui/binder-flipbook.ui.js

    // Info binder (nome/tipo/location_valore) + copertina — servono al
    // libro sfogliabile. Non bloccante: se fallisce, il libro usa comunque
    // il fallback a icona già previsto dal modulo condiviso.
    if (_ownerBinderId) {
        try {
            const { data: info } = await binderPubblicoLeggiInfo(_ownerBinderId);
            if (info && info.length) {
                _binderInfo = { nome: info[0].nome, tipo: info[0].tipo, location_valore: info[0].location_valore, layout: info[0].layout };
                _caricaCopertinaBinder(_ownerBinderId); // non bloccante
                // Titolo dinamico (26/08/2026): "Vediamo se mi piace" —
                // Claudio non ha ancora confermato definitivamente questo
                // comportamento, tenerlo d'occhio nel test. Fallback al
                // testo statico originale se _binderInfo.nome è vuoto.
                if (_binderInfo.nome) {
                    document.title = 'CardSync Pro — ' + _binderInfo.nome;
                    document.getElementById('titoloBinder').textContent = _binderInfo.nome;
                }
            }
        } catch (e) {
            console.error('info binder Wishlist:', e);
        }
    }

    // Dalla v4.8: non si legge più direttamente la tabella 'wishlist' (in
    // precedenza leggibile per intero da chiunque tramite anon key, non
    // solo filtrata lato client) — si passa da una funzione RPC dedicata
    // che restituisce solo le righe del singolo owner richiesto. Vedi
    // migrazione 2026-08-16_restringi_lettura_pubblica.sql.
    const { data, error } = await wishlistLeggiCondivisa(userId);

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
        qtyDisponibile: r.qty || 1,
        prezzoObiettivo: r.prezzo_obiettivo != null ? Number(r.prezzo_obiettivo) : null,
        price: r.prezzo != null ? Number(r.prezzo) : 0,
        notes: r.note || '',
        immagine: r.immagine || null,
    }));

    if (carte.length === 0) {
        container.innerHTML = '<div class="stato-vuoto"><i class="fa-solid fa-box-open"></i><br>Nessuna carta in wishlist al momento.</div>';
        document.getElementById('statRiepilogo').textContent = '';
        return;
    }

    // A16: statistica in cima — conta sempre TUTTE le carte caricate, non
    // solo quelle visibili dopo un'eventuale ricerca.
    document.getElementById('statRiepilogo').textContent =
        `${carte.length} cart${carte.length === 1 ? 'a desiderata' : 'e desiderate'}`;

    renderLista();
    impostaModalitaBinderPubblico('elenco');
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
        const selezionata = selezioni[c.id] > 0;
        const qtyAttuale = selezioni[c.id] || 0;
        return `
            <div class="card-row ${selezionata ? 'selected' : ''}" id="row-${c.id}">
                <input type="checkbox" class="card-checkbox" ${selezionata ? 'checked' : ''}
                       onchange="toggleSelezione('${c.id}', this.checked)">
                ${(() => { const immagineSrc = _urlImmagineVisualizzabile(c.immagine); return immagineSrc ? `<img src="${immagineSrc}" alt="" class="card-thumb" onclick="event.stopPropagation(); apriFlipCard('${c.id}')" onerror="this.style.display='none';">` : ''; })()}
                <div class="card-info">
                    <div class="card-name">${escapeHtml(c.name)}${c.code ? ` <span style="color:var(--text-muted); font-weight:600;">(${escapeHtml(c.code)})</span>` : ''}</div>
                    <div class="card-meta">
                        <span class="badge">${escapeHtml(c.lang)}</span>
                        <span class="badge">${escapeHtml(c.cond)}</span>
                        <span class="badge">Vuole ${c.qtyDisponibile}</span>
                        ${c.prezzoObiettivo != null ? `<span class="badge">🎯 max ${formattaEuro(c.prezzoObiettivo)}</span>` : ''}
                        ${c.notes ? `<span class="badge">✨ ${escapeHtml(c.notes)}</span>` : ''}
                    </div>
                </div>
                <div class="qty-control">
                    <button class="qty-btn" onclick="modificaQty('${c.id}', -1)" ${qtyAttuale <= 0 ? 'disabled' : ''}>-</button>
                    <span class="qty-value">${qtyAttuale}</span>
                    <button class="qty-btn" onclick="modificaQty('${c.id}', 1)" ${qtyAttuale >= c.qtyDisponibile ? 'disabled' : ''}>+</button>
                </div>
                <div class="card-price">${formattaEuro(c.price)}<small>cad.</small></div>
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

    const intestazione = _nomeProprietarioWishlist
        ? `Carte che potrei procurare a ${_nomeProprietarioWishlist}:`
        : `Carte dalla wishlist che potrei procurargli/le:`;
    const testo = `${intestazione}\n\n${righe.join('\n')}\n\nTotale: ${formattaEuro(totale)}`;

    navigator.clipboard.writeText(testo).then(() => {
        const btn = document.getElementById('btnCopiaRiepilogo');
        const originale = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copiato!';
        setTimeout(() => { btn.innerHTML = originale; }, 1800);
    }).catch(() => {
        alert(testo); // fallback se il clipboard non è disponibile (es. http non sicuro)
    });
}
