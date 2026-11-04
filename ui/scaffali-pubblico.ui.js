// Pagina pubblica degli scaffali (scaffali-pubblico.html).

let _scaffaleId = null;
let _scaffaleInfo = null;
let carte = [];
let selezioni = {};
let _vistaScaffale = 'scaffale';
let _prodottoIdAperto = null;

function _testoConteggioSelezione(distinte, pezzi) {
    return `${distinte} prodott${distinte === 1 ? 'o' : 'i'} · ${pezzi} pz.`;
}

function impostaVistaScaffale(vista) {
    if (vista !== 'scaffale' && vista !== 'elenco') return;
    _vistaScaffale = vista;
    document.querySelectorAll('.bx-vista-btn').forEach(b => b.classList.toggle('active', b.dataset.vista === vista));
    renderLista();
}

function _prodottoOverlayHtml(p) {
    const idAttr = String(p.id).replace(/'/g, "\\'");
    const prezzo = p.price > 0 ? `<span class="bx-slot-prezzo">${formattaEuro(p.price)}</span>` : '';
    if (p.qtyDisponibile <= 0) return `${prezzo}<span class="bx-slot-lucchetto"><i class="fa-solid fa-lock"></i></span>`;
    const q = selezioni[p.id] || 0;
    const piu = `<button type="button" class="bx-slot-btn" aria-label="Aggiungi" onclick="event.stopPropagation(); modificaQty('${idAttr}', 1)" ${q >= p.qtyDisponibile ? 'disabled' : ''}>+</button>`;
    if (q <= 0) return `${prezzo}<div class="bx-slot-azione" onclick="event.stopPropagation();">${piu}</div>`;
    return `${prezzo}<div class="bx-slot-azione bx-slot-azione-attiva" onclick="event.stopPropagation();">
        <button type="button" class="bx-slot-btn" aria-label="Togli" onclick="event.stopPropagation(); modificaQty('${idAttr}', -1)">−</button>
        <span class="bx-slot-n">${q}</span>${piu}
    </div>`;
}

function _prodottoAggiornaAggiungi() {
    const btn = document.getElementById('prodottoAggiungi');
    if (!btn) return;
    const p = carte.find(x => String(x.id) === String(_prodottoIdAperto));
    const eScambio = _scaffaleInfo && _scaffaleInfo.tipo === 'scambio';
    if (!p || !eScambio || p.qtyDisponibile <= 0) { btn.style.display = 'none'; return; }
    const q = selezioni[p.id] || 0;
    btn.style.display = 'flex';
    btn.disabled = q >= p.qtyDisponibile;
    btn.innerHTML = q > 0
        ? `<i class="fa-solid fa-check"></i> Nella scelta (${q}) — aggiungi un'altra`
        : `<i class="fa-solid fa-plus"></i> Aggiungi alla scelta`;
}
function prodottoAggiungiAllaScelta() {
    if (_prodottoIdAperto == null) return;
    modificaQty(_prodottoIdAperto, 1);
    _prodottoAggiornaAggiungi();
}

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
    _tipoOggettoRichiesta = 'sealed';
    const nomeScaffale = _scaffaleInfo.nome || (_scaffaleInfo.tipo === 'scambio' ? 'Scambio' : 'Scaffale');
    document.title = 'Bindex — ' + nomeScaffale;
    document.getElementById('titoloScaffale').textContent = nomeScaffale;
    const elProprietario = document.getElementById('proprietarioScaffale');
    if (elProprietario && _scaffaleInfo.nickname) { elProprietario.textContent = 'di ' + _scaffaleInfo.nickname; elProprietario.style.display = ''; }

    const eScambio = _scaffaleInfo.tipo === 'scambio';
    document.body.classList.toggle('scaffale-pubblico-selezionabile', eScambio);
    if (eScambio && typeof ospiteMostraControllo === 'function') ospiteMostraControllo();
    const barraTotale = document.getElementById('barraTotale');
    if (barraTotale) barraTotale.style.display = eScambio ? 'flex' : 'none';
    const sottotitolo = document.getElementById('sottotitoloScaffale');
    if (sottotitolo && eScambio) sottotitolo.textContent = 'Seleziona i prodotti che ti interessano — il totale si aggiorna da solo.';
    const toggleVista = document.getElementById('vistaScaffaleToggle');
    if (toggleVista) toggleVista.style.display = eScambio ? 'flex' : 'none';

    scaffaliPubblicoRegistraApertura(scaffaleId).catch(() => {   });

    const { data, error } = await scaffaliPubblicoLeggiProdotti(scaffaleId);
    if (error) {
        container.innerHTML = `<div class="stato-errore"><i class="fa-solid fa-triangle-exclamation"></i> Errore nel caricamento: ${error.message}</div>`;
        return;
    }

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

    if (eScambio && _vistaScaffale === 'scaffale') {
        container.innerHTML = `<div class="prodotti-grid prodotti-grid-scambio">${filtrati.map(p => {
            const immagineSrc = _urlImmagineVisualizzabile(p.immagine);
            const bloccata = p.qtyDisponibile <= 0;
            const selezionata = !bloccata && (selezioni[p.id] || 0) > 0;
            return `
                <div class="prodotto-tile bx-prodotto${selezionata ? ' bx-selezionato' : ''}${bloccata ? ' bx-riservato' : ''}" onclick="apriImmagineIngrandita('${String(p.id).replace(/'/g, "\\'")}')">
                    <div class="prodotto-cover">
                        ${immagineSrc ? `<img src="${immagineSrc}" alt="${escapeHtml(p.name)}" loading="lazy">` : '<i class="fa-solid fa-box"></i>'}
                        ${_prodottoOverlayHtml(p)}
                    </div>
                    <div class="prodotto-nome">${escapeHtml(p.name || p.code || '(senza nome)')}</div>
                    <div class="prodotto-qty">Offerte: ${p.qtyDisponibile}${p.riservato > 0 ? ` · 🔒 ${p.riservato}` : ''}</div>
                </div>`;
        }).join('')}</div>`;
        return;
    }

    if (eScambio) {
        container.innerHTML = filtrati.map(p => {
            const immagineSrc = _urlImmagineVisualizzabile(p.immagine);
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
        alert(testo);
    });
}

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
    _prodottoIdAperto = p.id;
    _prodottoAggiornaAggiungi();
}

function chiudiImmagineIngrandita() {
    _prodottoIdAperto = null;
    document.getElementById('immagineModal').style.display = 'none';
}
