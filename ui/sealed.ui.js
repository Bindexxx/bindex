// ── ui/sealed.ui.js ──────────────────────────────────────────────────────
// Logica UI specifica di sealed.html: caricamento catalogo, filtri
// (lingua + range prezzo), rendering lista, riepilogo selezione. Unica
// delle 3 pagine pubbliche senza flip-card/retro carta (i prodotti sealed
// non hanno un "retro" da mostrare) — usa il modale immagine semplice.
//
// Dipende da: data/sealed.repository.js, state/sealed.state.js,
// utils/shared-public.js.

function apriImmagineIngrandita(src) {
    document.getElementById('immagineIngranditaImg').src = src;
    document.getElementById('immagineModal').style.display = 'flex';
}

function chiudiImmagineIngrandita() {
    document.getElementById('immagineModal').style.display = 'none';
}

async function caricaCatalogo() {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('u');
    const container = document.getElementById('listaContainer');

    if (!userId) {
        container.innerHTML = '<div class="stato-errore"><i class="fa-solid fa-triangle-exclamation"></i> Link non valido — manca il riferimento alla collezione.</div>';
        return;
    }

    // RISOLTO 18/08/2026 (Problema #2, STATO_PROGETTO.txt sez.7): non si
    // legge più direttamente la tabella 'carte' filtrata solo lato client —
    // si passa dalla RPC dedicata leggi_sealed_condiviso (SECURITY
    // DEFINER, stesso pattern già in uso da mesi in scambio.html/
    // wishlist.html con leggi_scambio_condiviso / leggi_wishlist_condivisa),
    // che applica il filtro tipo='sealed' AND stato='collezione' AND
    // location='SCAMBIO' direttamente nel database, non più solo nel
    // browser di chi guarda la pagina.
    const { data, error } = await sealedLeggiCondiviso(userId);

    if (error) {
        container.innerHTML = `<div class="stato-errore"><i class="fa-solid fa-triangle-exclamation"></i> Errore nel caricamento: ${error.message}</div>`;
        return;
    }

    carte = (data || [])
        .map(r => ({
            id: r.id,
            name: r.nome || '',
            code: r.codice || '',
            lang: r.lingua || 'IT',
            cond: r.condizione || 'NM',
            qtyDisponibile: r.qty || 1,
            price: r.prezzo != null ? Number(r.prezzo) : 0,
            notes: r.note || '',
            immagine: r.immagine || null,
        }))
        // A16: quantità a 0 nascoste ALLA FONTE — non devono comparire mai,
        // nemmeno cercandole per nome nella barra di ricerca (decisione
        // esplicita di Claudio).
        .filter(c => c.qtyDisponibile > 0);

    if (carte.length === 0) {
        container.innerHTML = '<div class="stato-vuoto"><i class="fa-solid fa-box-open"></i><br>Nessun prodotto sealed condiviso per lo scambio al momento.</div>';
        return;
    }

    inizializzaFiltri();
    renderLista();
}

// A16: costruisce le pillole Lingua in base a quelle REALMENTE presenti
// nei dati caricati (non un elenco fisso — se un giorno arriva una lingua
// nuova, compare da sola), e calcola il range di prezzo dinamico dai
// prodotti disponibili in quel momento.
function inizializzaFiltri() {
    const lingue = [...new Set(carte.map(c => c.lang))].sort();
    document.getElementById('filtriLinguaPills').innerHTML = lingue.map(l =>
        `<button type="button" class="filtro-pill" id="pillLingua-${l}" onclick="toggleFiltroLingua('${l}')">${l}</button>`
    ).join('');

    const prezzi = carte.map(c => c.price);
    prezzoDatiMin = Math.floor(Math.min(...prezzi));
    prezzoDatiMax = Math.ceil(Math.max(...prezzi));
    if (prezzoDatiMin === prezzoDatiMax) prezzoDatiMax += 1; // evita uno slider "piatto" con un solo prodotto

    const sliderMin = document.getElementById('sliderPrezzoMin');
    const sliderMax = document.getElementById('sliderPrezzoMax');
    [sliderMin, sliderMax].forEach(s => { s.min = prezzoDatiMin; s.max = prezzoDatiMax; });
    sliderMin.value = prezzoDatiMin;
    sliderMax.value = prezzoDatiMax;
    filtriStato.prezzoMin = prezzoDatiMin;
    filtriStato.prezzoMax = prezzoDatiMax;

    aggiornaVisualeSliderPrezzo();
}

function toggleFiltroLingua(lingua) {
    if (filtriStato.lingue.has(lingua)) {
        filtriStato.lingue.delete(lingua);
    } else {
        filtriStato.lingue.add(lingua);
    }
    document.getElementById('pillLingua-' + lingua).classList.toggle('attivo');
    aggiornaContatoreFiltriAttivi();
    renderLista();
}

function onSliderPrezzoInput(quale) {
    const sliderMin = document.getElementById('sliderPrezzoMin');
    const sliderMax = document.getElementById('sliderPrezzoMax');
    let min = parseInt(sliderMin.value, 10);
    let max = parseInt(sliderMax.value, 10);

    // Impedisce ai due cursori di "scavalcarsi" — il minimo non può
    // superare il massimo e viceversa.
    if (quale === 'min' && min > max) { min = max; sliderMin.value = min; }
    if (quale === 'max' && max < min) { max = min; sliderMax.value = max; }

    filtriStato.prezzoMin = min;
    filtriStato.prezzoMax = max;
    aggiornaVisualeSliderPrezzo();
    aggiornaContatoreFiltriAttivi();
    renderLista();
}

function aggiornaVisualeSliderPrezzo() {
    const range = prezzoDatiMax - prezzoDatiMin || 1;
    const percMin = ((filtriStato.prezzoMin - prezzoDatiMin) / range) * 100;
    const percMax = ((filtriStato.prezzoMax - prezzoDatiMin) / range) * 100;
    const barraColorata = document.getElementById('priceSliderRange');
    barraColorata.style.left = percMin + '%';
    barraColorata.style.right = (100 - percMax) + '%';
    document.getElementById('labelPrezzoMin').textContent = formattaEuro(filtriStato.prezzoMin);
    document.getElementById('labelPrezzoMax').textContent = formattaEuro(filtriStato.prezzoMax);
}

function aggiornaContatoreFiltriAttivi() {
    const prezzoModificato = filtriStato.prezzoMin !== prezzoDatiMin || filtriStato.prezzoMax !== prezzoDatiMax;
    const numeroFiltriAttivi = filtriStato.lingue.size + (prezzoModificato ? 1 : 0);
    const badge = document.getElementById('filtriAttiviCount');
    if (numeroFiltriAttivi > 0) {
        badge.textContent = numeroFiltriAttivi;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

function resetFiltri() {
    filtriStato.lingue.clear();
    document.querySelectorAll('.filtro-pill.attivo').forEach(p => p.classList.remove('attivo'));

    filtriStato.prezzoMin = prezzoDatiMin;
    filtriStato.prezzoMax = prezzoDatiMax;
    document.getElementById('sliderPrezzoMin').value = prezzoDatiMin;
    document.getElementById('sliderPrezzoMax').value = prezzoDatiMax;
    aggiornaVisualeSliderPrezzo();

    aggiornaContatoreFiltriAttivi();
    renderLista();
}

function toggleFiltri() {
    document.getElementById('pannelloFiltri').classList.toggle('aperto');
    document.getElementById('btnFiltri').classList.toggle('aperto');
}

function renderLista() {
    const container = document.getElementById('listaContainer');
    const searchVal = document.getElementById('searchInput').value.toLowerCase();

    // A16: ricerca testuale + filtro Lingua (multi-selezione) + filtro
    // Prezzo (range) — tutti combinati insieme (AND), come richiesto da
    // Claudio.
    const filtrate = carte.filter(c => {
        const corrispondeRicerca = c.name.toLowerCase().includes(searchVal) || c.code.toLowerCase().includes(searchVal);
        const corrispondeLingua = filtriStato.lingue.size === 0 || filtriStato.lingue.has(c.lang);
        const corrispondePrezzo = c.price >= filtriStato.prezzoMin && c.price <= filtriStato.prezzoMax;
        return corrispondeRicerca && corrispondeLingua && corrispondePrezzo;
    });

    if (filtrate.length === 0) {
        container.innerHTML = '<div class="stato-vuoto"><i class="fa-solid fa-magnifying-glass"></i><br>Nessun prodotto corrisponde alla ricerca/ai filtri.</div>';
        return;
    }

    container.innerHTML = filtrate.map(c => {
        const selezionata = selezioni[c.id] > 0;
        const qtyAttuale = selezioni[c.id] || 0;
        return `
            <div class="card-row ${selezionata ? 'selected' : ''}" id="row-${c.id}">
                <input type="checkbox" class="card-checkbox" ${selezionata ? 'checked' : ''}
                       onchange="toggleSelezione('${c.id}', this.checked)">
                ${(() => { const immagineSrc = _urlImmagineVisualizzabile(c.immagine); return immagineSrc ? `<img src="${immagineSrc}" alt="" class="card-thumb" onclick="event.stopPropagation(); apriImmagineIngrandita('${immagineSrc}')" onerror="this.style.display='none';">` : ''; })()}
                <div class="card-info">
                    <div class="card-name">${escapeHtml(c.name)}${c.code ? ` <span style="color:var(--text-muted); font-weight:600;">(${c.code})</span>` : ''}</div>
                    <div class="card-meta">
                        <span class="badge">${c.lang}</span>
                        <span class="badge">${c.cond}</span>
                        <span class="badge">Disp. ${c.qtyDisponibile}</span>
                        <!-- A16 (18/08/2026): badge location rimosso — con il filtro
                             location='SCAMBIO' applicato in caricaCatalogo(), ogni riga
                             mostrata ha sempre lo stesso valore, quindi il badge sarebbe
                             ridondante su ogni singola carta. -->
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

    const testo = `Prodotti sealed che mi interessano:\n\n${righe.join('\n')}\n\nTotale: ${formattaEuro(totale)}`;

    navigator.clipboard.writeText(testo).then(() => {
        const btn = document.getElementById('btnCopiaRiepilogo');
        const originale = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copiato!';
        setTimeout(() => { btn.innerHTML = originale; }, 1800);
    }).catch(() => {
        alert(testo); // fallback se il clipboard non è disponibile (es. http non sicuro)
    });
}
