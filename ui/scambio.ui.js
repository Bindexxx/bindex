// ── ui/scambio.ui.js ─────────────────────────────────────────────────────
// Logica UI specifica di scambio.html: caricamento catalogo, rendering
// lista, flip-card, riepilogo selezione.
//
// Dipende da: data/scambio.repository.js, state/scambio.state.js,
// utils/shared-public.js, ui/card-back-viewer.ui.js.

// A16: flip-modal — mostra prima il fronte (immagine reale), poi gira da
// sola dopo una breve pausa rivelando nome/codice/prezzo/note. Stesso
// concetto già esteso a tutto il sito privato in A15 e a Wishlist in A16,
// qui riadattato: niente "Vai al binder" (non ha senso per chi non è il
// proprietario) e niente location.
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
        <div style="font-size:0.78rem; opacity:0.85; margin-bottom:0.6rem;"><code style="background:none; color:inherit; padding:0;">${card.code}</code></div>
        ${card.notes ? `<div style="font-size:0.78rem; opacity:0.85; margin-top:0.4rem;">✨ ${escapeHtml(card.notes)}</div>` : ''}
    `;
    renderRetroCartaViewer(card);

    document.getElementById('immagineModal').style.display = 'flex';

    if (_flipCardTimeout) clearTimeout(_flipCardTimeout);
    _flipCardTimeout = setTimeout(() => inner.classList.add('flipped'), 500);
}

// Hook per ui/card-back-viewer.ui.js: testo del campo "variazione" sul
// retro carta — qui mostra la quantità disponibile.
function _cbdTestoVariazione(card) {
    return (card.qtyDisponibile !== undefined && card.qtyDisponibile !== null) ? ('Disponibili: ' + card.qtyDisponibile) : '';
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
    // qui il binder_id del binder location='SCAMBIO' di questo owner,
    // usato più sotto da renderRetroCartaViewer. Se la risoluzione fallisce
    // (RPC assente/errore), _ownerBinderId resta null: il viewer cade sul
    // default di sistema, nessuna eccezione bloccante per il resto della
    // pagina.
    _ownerBinderId = await cardBackViewerLeggiBinderIdOwner(userId, 'location', 'SCAMBIO');

    // Dalla v4.8: non si legge più direttamente la tabella 'carte' (in
    // precedenza le carte in scambio di TUTTI gli utenti erano leggibili
    // tramite anon key, non solo filtrate lato client) — si passa da una
    // funzione RPC dedicata che restituisce solo le carte in scambio del
    // singolo owner richiesto. Vedi migrazione
    // 2026-08-16_restringi_lettura_pubblica.sql.
    const { data, error } = await scambioLeggiCondiviso(userId);

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
        price: r.prezzo != null ? Number(r.prezzo) : 0,
        notes: r.note || '',
        immagine: r.immagine || null,
    }));

    if (carte.length === 0) {
        container.innerHTML = '<div class="stato-vuoto"><i class="fa-solid fa-box-open"></i><br>Nessuna carta disponibile per lo scambio al momento.</div>';
        document.getElementById('statRiepilogo').textContent = '';
        return;
    }

    // A16: statistica in cima — conta sempre TUTTE le carte caricate, non
    // solo quelle visibili dopo un'eventuale ricerca.
    document.getElementById('statRiepilogo').textContent =
        `${carte.length} cart${carte.length === 1 ? 'a disponibile' : 'e disponibili'}`;

    renderLista();
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
                    <div class="card-name">${escapeHtml(c.name)}${c.code ? ` <span style="color:var(--text-muted); font-weight:600;">(${c.code})</span>` : ''}</div>
                    <div class="card-meta">
                        <span class="badge">${c.lang}</span>
                        <span class="badge">${c.cond}</span>
                        <span class="badge">Disp. ${c.qtyDisponibile}</span>
                        ${c.notes ? `<span class="badge">✨ ${escapeHtml(c.notes)}</span>` : ''}
                        <!-- A16: placeholder badge "cercata da X persone nel gruppo" —
                             SEMPRE nascosto finché non esiste la RPC conta_desiderata_gruppo
                             (Fase A0). Specifica completa: DECISIONI_SESSIONE_BINDER.txt,
                             sez. 3undecies, punto 4. Da riempire e mostrare (mai se 0) solo
                             quando la funzione sarà pronta e verificata. -->
                        <span class="badge badge-match" id="badgeMatch-${c.id}" style="display:none;"></span>
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

    const testo = `Carte che mi interessano per lo scambio:\n\n${righe.join('\n')}\n\nTotale: ${formattaEuro(totale)}`;

    navigator.clipboard.writeText(testo).then(() => {
        const btn = document.getElementById('btnCopiaRiepilogo');
        const originale = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copiato!';
        setTimeout(() => { btn.innerHTML = originale; }, 1800);
    }).catch(() => {
        alert(testo); // fallback se il clipboard non è disponibile (es. http non sicuro)
    });
}
