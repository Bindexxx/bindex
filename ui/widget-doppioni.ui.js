// ═══════════════════════════════════════════════════════════════════════
// WIDGET-DOPPIONI.UI.JS — tessera + pagina "Doppioni" (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP 8 della ristrutturazione file widget home (vedi
// Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md). Estratto da
// ui/phone.ui.js il 2026-09-11. NESSUNA riscrittura: solo spostamento di
// codice, zero cambi di comportamento per l'utente finale.
//
// CATEGORIA A: pagina propria con ricerca + ordinamento (quantità/valore/
// alfabetico), click su una carta apre il flip-viewer con
// opzioni.doppione=true (vedi ui/home.ui.js, esterno, non toccato).
//
// COSA RESTA FUORI (non spostato qui, invariato):
// - apriDettaglioWidget (ui/paginainiziale.ui.js) continua a chiamare
//   renderPaginaDoppioni() per tabId === 'doppioni' — motore home,
//   dispatch generico, non toccato in questo step.
// - _ballCORPI.doppioni / _ballASPETTO.doppioni / _ballTITOLI_BREVI.doppioni
//   (ui/widget-render-condiviso.ui.js) — motore visivo, non toccato.
// - apriFlipCardHome, _urlImmagineVisualizzabile, escapeHtml: esterne,
//   non toccate.
// ───────────────────────────────────────────────────────────────────────

// ── VOCE DI CATALOGO ──────────────────────────────────────────────────
CATALOGO_WIDGET.doppioni = {
        titolo: 'Doppioni', icona: 'fa-clone',
        preview: () => {
            const doppie = carteReali
                .filter(c => c.stato === 'collezione' && (Number(c.qty) || 1) > 1)
                .sort((a, b) => (Number(b.qty) || 1) - (Number(a.qty) || 1));
            const copieExtra = doppie.reduce((t, c) => t + ((Number(c.qty) || 1) - 1), 0);
            const valoreExtra = doppie.reduce((t, c) => t + (Number(c.price) || 0) * ((Number(c.qty) || 1) - 1), 0);
            if (doppie.length === 0) return { righe: ['Nessun doppione'], stato: 'ok', dati: { titoli: 0, copieExtra: 0, valoreExtra: 0, lista: [] } };
            return {
                righe: [`${doppie.length} carte in più copie`],
                dati: {
                    titoli: doppie.length, copieExtra, valoreExtra,
                    lista: doppie.slice(0, 3).map(c => ({ nome: c.name || '—', qty: Number(c.qty) || 1, id: c.id, immagine: c.immagine, rarita: c.rarita }))
                }
            };
        },
        // MODIFICATO (2026-08-30): prima apriva semplicemente
        // Visualizzazione generica (tab:'visualizzazione') — ora ha una
        // pagina propria (#doppioni in index.html,
        // renderPaginaDoppioni() sotto).
        tab: 'doppioni',
};

// ── PAGINA "DOPPIONI" (2026-08-30) ──────────────────────────────────────
// Quarto widget con pagina di dettaglio propria. Riusa la stessa logica di
// filtro di CATALOGO_WIDGET.doppioni.preview() (carte in collezione con
// qty>1) letta direttamente da carteReali, senza il taglio a 3 del
// preview — zero query nuove.
// Click su una carta → flip-viewer con opzioni.doppione=true, che mostra
// il pulsante "Gestisci doppione" (vedi ui/home.ui.js) — le due scelte
// decise per la missione #15 "Fai spazio" (sposta in Scambio / apri
// scheda modifica), costruite qui per la prima volta.
let _doppioniCarteComputate = [];
let _doppioniOrdinamento = 'quantita';
let _doppioniRicercaTesto = '';

function _doppioniCalcola() {
    const doppie = carteReali.filter(c => c.stato === 'collezione' && (Number(c.qty) || 1) > 1);
    const righe = doppie.map(c => {
        const qty = Number(c.qty) || 1;
        const prezzo = Number(c.price) || 0;
        return { id: c.id, nome: c.name || '—', immagine: c.immagine || null, qty, valoreExtra: prezzo * (qty - 1) };
    });
    _doppioniCarteComputate = righe;
    return {
        titoli: righe.length,
        copieExtra: righe.reduce((t, r) => t + (r.qty - 1), 0),
        valoreExtra: righe.reduce((t, r) => t + r.valoreExtra, 0),
    };
}

async function renderPaginaDoppioni() {
    const container = document.getElementById('doppioniContenuto');
    if (!container) return;

    _doppioniOrdinamento = 'quantita';
    _doppioniRicercaTesto = '';
    const { titoli, copieExtra, valoreExtra } = _doppioniCalcola();
    const eur = (v) => '€ ' + Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 });

    if (titoli === 0) {
        container.innerHTML = `
            <div class="page-header">
                <span class="page-title">Doppioni</span>
            </div>
            <p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:2rem 0;">Nessun doppione al momento.</p>
        `;
        return;
    }

    container.innerHTML = `
        <div class="page-header">
            <span class="page-title">Doppioni</span>
        </div>
        <div class="pg-pagina">
            <div class="pg-intro">
                <div class="pg-grande">${titoli}</div>
                <div class="pg-sotto">${copieExtra} copie extra · valore ${eur(valoreExtra)}</div>
            </div>
            <div class="pg-stat">
                <div><b>${titoli}</b><span>Carte doppie</span></div>
                <div><b>${copieExtra}</b><span>Copie extra</span></div>
                <div><b>${eur(valoreExtra)}</b><span>Valore extra</span></div>
            </div>
            <input type="text" class="pg-cerca" placeholder="Cerca tra i doppioni..." oninput="_doppioniCercaInput(this.value)">
            <div class="pg-filtri">
                <span class="pg-filtro attivo" data-ord="quantita" onclick="_doppioniImpostaOrdinamento('quantita')">Quantità</span>
                <span class="pg-filtro" data-ord="valore" onclick="_doppioniImpostaOrdinamento('valore')">Valore</span>
                <span class="pg-filtro" data-ord="alfabetico" onclick="_doppioniImpostaOrdinamento('alfabetico')">Alfabetico</span>
            </div>
            <div class="pg-elenco" id="doppioniElenco"></div>
        </div>
    `;
    _doppioniRenderElenco();
}

function _doppioniImpostaOrdinamento(ordine) {
    _doppioniOrdinamento = ordine;
    document.querySelectorAll('.pg-filtri .pg-filtro').forEach(el => {
        el.classList.toggle('attivo', el.dataset.ord === ordine);
    });
    _doppioniRenderElenco();
}

function _doppioniCercaInput(valore) {
    _doppioniRicercaTesto = (valore || '').toLowerCase();
    _doppioniRenderElenco();
}

function _doppioniRenderElenco() {
    const elenco = document.getElementById('doppioniElenco');
    if (!elenco) return;

    const eur = (v) => '€ ' + Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 });

    let righe = [..._doppioniCarteComputate];
    if (_doppioniRicercaTesto) righe = righe.filter(r => r.nome.toLowerCase().includes(_doppioniRicercaTesto));

    if (_doppioniOrdinamento === 'quantita') righe.sort((a, b) => b.qty - a.qty);
    else if (_doppioniOrdinamento === 'valore') righe.sort((a, b) => b.valoreExtra - a.valoreExtra);
    else righe.sort((a, b) => a.nome.localeCompare(b.nome));

    if (righe.length === 0) {
        elenco.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.82rem; padding:1.2rem 0;">Nessuna carta corrisponde alla ricerca.</p>';
        return;
    }

    elenco.innerHTML = righe.map(r => {
        const immagineSrc = r.immagine ? (_urlImmagineVisualizzabile(r.immagine, 96) || '') : '';
        const fig = immagineSrc
            ? `<img class="pg-fig" src="${immagineSrc}" alt="" onerror="this.style.display='none';">`
            : '<div class="pg-fig"></div>';
        return `
            <div class="pg-riga" data-tocca onclick="apriFlipCardHome('${r.id}', { origine: 'doppioni_pagina', doppione: true })">
                ${fig}
                <div class="pg-testo"><b>${escapeHtml(r.nome)}</b><span>×${r.qty}</span></div>
                <div class="pg-destra"><b>${eur(r.valoreExtra)}</b>copie extra</div>
            </div>`;
    }).join('');
}
