// ── ui/scaffali-pubblico.ui.js ────────────────────────────────────────────
// Logica UI di scaffali-pubblico.html — Fase 1.3, Step 5c (2026-09-12),
// esteso in Fase 3, Step 4 (stesso giorno) con selezione/quantità/riepilogo
// per tipo='scambio' — mirror di ui/binder-pubblico.ui.js (copiaRiepilogo,
// toggleSelezione/modificaQty/aggiornaTotale da utils/shared-public.js).
//
// Vetrina di sola lettura per tipo='libero'/'vetrina' (griglia semplice,
// invariata dallo Step 5c). Per tipo='scambio': righe stile card-row con
// checkbox+stepper quantità, barra totale in fondo, copia riepilogo — MAI
// flip-card/sleeve/libro sfogliabile (Scaffali non li ha, Step 5a).
//
// NOTA SUI NOMI: toggleSelezione/modificaQty/aggiornaTotale (utils/
// shared-public.js) sono scritte per un array globale chiamato
// letteralmente `carte` — qui contiene prodotti sealed, non carte, ma il
// nome resta quello per riuso diretto delle funzioni condivise (stessa
// scelta già fatta da sealed.html, che usa lo stesso file per un dominio
// diverso dalle carte).
//
// Dipende da: data/scaffali-pubblico.repository.js,
// utils/shared-public.js (applicaTemaCondiviso, _urlImmagineVisualizzabile,
// escapeHtml, formattaEuro, toggleSelezione, modificaQty, aggiornaTotale).

let _scaffaleId = null;
let _scaffaleInfo = null; // { nome, tipo }
let carte = []; // vedi nota sui nomi sopra
let selezioni = {};

async function caricaCatalogo() {
    const params = new URLSearchParams(window.location.search);
    const scaffaleId = params.get('scaffale');
    _scaffaleId = scaffaleId;
    const container = document.getElementById('listaContainer');

    if (!scaffaleId) {
        container.innerHTML = '<div class="stato-errore"><i class="fa-solid fa-triangle-exclamation"></i> Link non valido — manca il riferimento allo scaffale.</div>';
        return;
    }

    const { data: info, error: errInfo } = await scaffaliPubblicoLeggiInfo(scaffaleId);
    if (errInfo || !info || info.length === 0) {
        container.innerHTML = '<div class="stato-errore"><i class="fa-solid fa-lock"></i> Questo scaffale non è (più) pubblico, o il link non è valido.</div>';
        document.getElementById('statRiepilogo').textContent = '';
        return;
    }

    _scaffaleInfo = info[0];
    // Fase 4, Step 4 (2026-09-13): dice al bottone "Richiedi" condiviso
    // (utils/shared-public.js) che qui gli oggetti sono prodotti sealed,
    // non carte.
    _tipoOggettoRichiesta = 'sealed';
    const nomeScaffale = _scaffaleInfo.nome || (_scaffaleInfo.tipo === 'scambio' ? 'Scambio' : 'Scaffale');
    document.title = 'CardSync Pro — ' + nomeScaffale;
    document.getElementById('titoloScaffale').textContent = nomeScaffale;

    // Fase 3, Step 4: barra totale/selezione SOLO per tipo='scambio' — le
    // altre viste (libero/vetrina) restano una vetrina di sola lettura,
    // stesso principio di _binderPubblicoESelezionabile() in
    // ui/binder-pubblico.ui.js.
    const eScambio = _scaffaleInfo.tipo === 'scambio';
    document.body.classList.toggle('scaffale-pubblico-selezionabile', eScambio);
    const barraTotale = document.getElementById('barraTotale');
    if (barraTotale) barraTotale.style.display = eScambio ? 'flex' : 'none';

    // Fire-and-forget, non deve mai bloccare il caricamento per il
    // visitatore — la RPC stessa rivalida che lo scaffale sia pubblico.
    scaffaliPubblicoRegistraApertura(scaffaleId).catch(() => { /* silenzioso */ });

    const { data, error } = await scaffaliPubblicoLeggiProdotti(scaffaleId);
    if (error) {
        container.innerHTML = `<div class="stato-errore"><i class="fa-solid fa-triangle-exclamation"></i> Errore nel caricamento: ${error.message}</div>`;
        return;
    }

    // qty qui è quantita_offerta per tipo='scambio' (la RPC sql/51 lo
    // riusa nello stesso slot — corregge sql/46, mai andato live, vedi
    // header del file sql), qty posseduta per gli altri tipi — vedi
    // qtyDisponibile sotto, stesso nome campo di binder-pubblico.ui.js
    // (contratto richiesto da modificaQty in utils/shared-public.js).
    // FASE 5 (2026-09-13): qtyDisponibile è ora il NETTO reale (offerto −
    // già riservato da richieste accettate); riservato tenuto a parte per
    // il badge — stessa logica di ui/binder-pubblico.ui.js.
    carte = (data || []).map(r => ({
        id: r.id,
        name: r.nome || '',
        code: r.codice || '',
        setEspansione: r.set_espansione || '',
        lang: r.lingua || 'IT',
        integrita: r.integrita_packaging || '',
        qtyDisponibile: Math.max(0, (r.qty || 1) - (r.riservato || 0)),
        riservato: r.riservato || 0,
        price: r.prezzo != null ? Number(r.prezzo) : 0,
        notes: r.note || '',
        immagine: r.immagine || null,
    }));
    selezioni = {};

    if (carte.length === 0) {
        container.innerHTML = eScambio
            ? '<div class="stato-vuoto"><i class="fa-solid fa-right-left"></i><br>Nessun prodotto offerto in Scambio al momento.</div>'
            : '<div class="stato-vuoto"><i class="fa-solid fa-box-open"></i><br>Questo scaffale è vuoto al momento.</div>';
        document.getElementById('statRiepilogo').textContent = '';
        return;
    }

    document.getElementById('statRiepilogo').textContent =
        `${carte.length} prodott${carte.length === 1 ? 'o' : 'i'}`;

    renderLista();
    if (eScambio) aggiornaTotale();
}


function renderLista() {
    const container = document.getElementById('listaContainer');
    const searchVal = document.getElementById('searchInput').value.toLowerCase();
    const eScambio = _scaffaleInfo && _scaffaleInfo.tipo === 'scambio';

    const filtrati = carte.filter(p =>
        p.name.toLowerCase().includes(searchVal) || p.code.toLowerCase().includes(searchVal)
    );

    if (filtrati.length === 0) {
        container.innerHTML = '<div class="stato-vuoto"><i class="fa-solid fa-magnifying-glass"></i><br>Nessun prodotto corrisponde alla ricerca.</div>';
        return;
    }

    if (eScambio) {
        // Righe stile card-row (checkbox + stepper quantità), mirror di
        // ui/binder-pubblico.ui.js quando _binderPubblicoESelezionabile().
        container.innerHTML = filtrati.map(p => {
            const immagineSrc = _urlImmagineVisualizzabile(p.immagine);
            // FASE 5 (2026-09-13): stessa logica "riservato ma visibile,
            // non selezionabile" di ui/binder-pubblico.ui.js — vedi i
            // commenti lì per il dettaglio.
            const bloccata = p.qtyDisponibile <= 0;
            const selezionata = !bloccata && selezioni[p.id] > 0;
            const qtyAttuale = bloccata ? 0 : (selezioni[p.id] || 0);
            return `
                <div class="card-row ${selezionata ? 'selected' : ''} ${bloccata ? 'riservato' : ''}" id="row-${p.id}">
                    <input type="checkbox" class="card-checkbox" ${selezionata ? 'checked' : ''} ${bloccata ? 'disabled' : ''}
                           onchange="toggleSelezione('${p.id}', this.checked)">
                    ${immagineSrc ? `<img src="${immagineSrc}" alt="" class="card-thumb" onclick="event.stopPropagation(); apriImmagineIngrandita('${p.id}')" onerror="this.style.display='none';">` : ''}
                    <div class="card-info">
                        <div class="card-name">${escapeHtml(p.name)}${p.code ? ` <span style="color:var(--text-muted); font-weight:600;">(${escapeHtml(p.code)})</span>` : ''}</div>
                        <div class="card-meta">
                            <span class="badge">${escapeHtml(p.lang)}</span>
                            ${bloccata
                                ? `<span class="badge badge-riservato">🔒 Riservato</span>`
                                : `<span class="badge">Offerte: ${p.qtyDisponibile}</span>`}
                            ${!bloccata && p.riservato > 0 ? `<span class="badge badge-riservato">🔒 ${p.riservato} riservat${p.riservato === 1 ? 'a' : 'e'}</span>` : ''}
                            ${p.notes ? `<span class="badge">✨ ${escapeHtml(p.notes)}</span>` : ''}
                        </div>
                    </div>
                    <div class="qty-control">
                        <button class="qty-btn" onclick="modificaQty('${p.id}', -1)" ${qtyAttuale <= 0 || bloccata ? 'disabled' : ''}>-</button>
                        <span class="qty-value">${qtyAttuale}</span>
                        <button class="qty-btn" onclick="modificaQty('${p.id}', 1)" ${qtyAttuale >= p.qtyDisponibile || bloccata ? 'disabled' : ''}>+</button>
                    </div>
                    <div class="card-price">${formattaEuro(p.price)}<small>cad.</small></div>
                </div>
            `;
        }).join('');
        return;
    }

    // Vetrina di sola lettura (libero/vetrina) — griglia invariata dallo
    // Step 5c.
    container.innerHTML = `<div class="prodotti-grid">${filtrati.map(p => {
        const immagineSrc = _urlImmagineVisualizzabile(p.immagine);
        return `
            <div class="prodotto-tile" onclick="apriImmagineIngrandita('${String(p.id).replace(/'/g, "\\'")}')">
                <div class="prodotto-cover">
                    ${immagineSrc ? `<img src="${immagineSrc}" alt="${escapeHtml(p.name)}" loading="lazy">` : '<i class="fa-solid fa-box"></i>'}
                </div>
                <div class="prodotto-nome">${escapeHtml(p.name || p.code || '(senza nome)')}</div>
                ${p.qtyDisponibile > 1 ? `<div class="prodotto-qty">×${p.qtyDisponibile}</div>` : ''}
            </div>`;
    }).join('')}</div>`;
}


// Mirror di copiaRiepilogo() in ui/binder-pubblico.ui.js — stesso
// comportamento (clipboard + fallback alert), testo adattato ai prodotti
// sealed invece delle carte.
function copiaRiepilogo() {
    const righe = [];
    let totale = 0;
    carte.forEach(p => {
        const q = selezioni[p.id] || 0;
        if (q > 0) {
            righe.push(`${q}x ${p.name}${p.code ? ' (' + p.code + ')' : ''} — ${formattaEuro(p.price * q)}`);
            totale += q * p.price;
        }
    });
    if (righe.length === 0) return;

    const testo = `Prodotti sealed che mi interessano per lo scambio:\n\n${righe.join('\n')}\n\nTotale: ${formattaEuro(totale)}`;

    navigator.clipboard.writeText(testo).then(() => {
        const btn = document.getElementById('btnCopiaRiepilogo');
        const originale = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copiato!';
        setTimeout(() => { btn.innerHTML = originale; }, 1800);
    }).catch(() => {
        alert(testo); // fallback se il clipboard non è disponibile (es. http non sicuro)
    });
}


// Vetrina di sola lettura: nessuna selezione/prenotazione qui dentro (la
// selezione vera è nella riga, non nell'immagine ingrandita) — solo
// un'immagine ingrandita con i dettagli testuali sotto.
function apriImmagineIngrandita(id) {
    const p = carte.find(x => String(x.id) === String(id));
    if (!p) return;

    const immagineSrc = _urlImmagineVisualizzabile(p.immagine);
    const img = document.getElementById('immagineIngranditaImg');
    img.style.display = immagineSrc ? '' : 'none';
    img.src = immagineSrc || '';

    const eScambio = _scaffaleInfo && _scaffaleInfo.tipo === 'scambio';
    document.getElementById('immagineIngranditaDettagli').innerHTML = `
        <div style="font-weight:800; font-size:1rem; margin-bottom:0.2rem;">${escapeHtml(p.name || '(senza nome)')}</div>
        ${p.code ? `<div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:0.4rem;"><code>${escapeHtml(p.code)}</code></div>` : ''}
        ${p.setEspansione ? `<div style="font-size:0.82rem; margin-bottom:0.2rem;">${escapeHtml(p.setEspansione)}</div>` : ''}
        <div style="font-size:0.82rem; margin-bottom:0.2rem;">Lingua: ${escapeHtml(p.lang)} · ${eScambio ? 'Offerte' : 'Quantità'}: ${p.qtyDisponibile}</div>
        ${p.integrita ? `<div style="font-size:0.82rem; margin-bottom:0.2rem;">Confezione: ${escapeHtml(p.integrita)}</div>` : ''}
        <div style="font-weight:700; font-size:1rem; margin-top:0.5rem; color:var(--primary);">${formattaEuro(p.price)}</div>
        ${p.notes ? `<div style="font-size:0.78rem; color:var(--text-muted); margin-top:0.4rem;">✨ ${escapeHtml(p.notes)}</div>` : ''}
    `;

    document.getElementById('immagineModal').style.display = 'flex';
}

function chiudiImmagineIngrandita() {
    document.getElementById('immagineModal').style.display = 'none';
}
