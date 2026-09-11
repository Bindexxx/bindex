// ═══════════════════════════════════════════════════════════════════════
// WIDGET-SEALED.UI.JS — tessera + pagina "Sealed" (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP 17 della ristrutturazione file widget home (vedi
// Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md). Estratto da
// ui/phone.ui.js il 2026-09-11. NESSUNA riscrittura: solo spostamento di
// codice, zero cambi di comportamento per l'utente finale.
//
// CATEGORIA A: pagina propria con ricerca + ordinamento (valore/quantità/
// alfabetico). A differenza di Doppioni (stessa identica struttura),
// click su una riga NON apre il flip-viewer — apre apriModificaCarta(id):
// scelta di Claudio, ha meno senso per un prodotto sigillato.
//
// COSA RESTA FUORI (non spostato qui, invariato):
// - apriDettaglioWidget (ui/paginainiziale.ui.js) continua a chiamare
//   renderPaginaSealed() per tabId === 'sealed' — motore home, dispatch
//   generico, non toccato in questo step.
// - _ballCORPI.sealed / _ballASPETTO.sealed / _ballTITOLI_BREVI.sealed
//   (ui/widget-render-condiviso.ui.js) — motore visivo, non toccato.
//   Verificato: legge d.totale/d.valore/d.lista dal 'dati' restituito dal
//   preview() qui sotto — forma confermata coerente.
// - apriModificaCarta, _urlImmagineVisualizzabile, escapeHtml: esterne,
//   non toccate.
// ───────────────────────────────────────────────────────────────────────

// ── VOCE DI CATALOGO ──────────────────────────────────────────────────
CATALOGO_WIDGET.sealed = {
        titolo: 'Sealed', icona: 'fa-box-archive',
        preview: () => {
            const prodotti = carteReali.filter(c => c.stato === 'collezione' && c.tipo === 'sealed');
            if (prodotti.length === 0) return { righe: ['Nessun prodotto'], dati: { totale: 0, valore: 0, lista: [] } };
            const perValore = prodotti.slice().sort((a, b) => (b.price || 0) - (a.price || 0));
            const inEvidenza = perValore[0];
            const valore = prodotti.reduce((t, p) => t + (Number(p.price) || 0) * (Number(p.qty) || 1), 0);
            return {
                righe: [`${prodotti.length} prodotti`, inEvidenza.name || ''],
                dati: {
                    totale: prodotti.length, valore,
                    lista: perValore.slice(0, 3).map(p => ({ nome: p.name || '—', prezzo: Number(p.price) || 0 }))
                }
            };
        },
        // AGGIUNTO (2026-08-30): prima non aveva 'tab', il tap sul tile non
        // portava da nessuna parte (stesso problema già trovato e risolto
        // per 'location'). Ora ha una pagina propria (#sealed in
        // index.html, renderPaginaSealed() sotto).
        tab: 'sealed',
};

// ── PAGINA "SEALED" (2026-08-30) ────────────────────────────────────────
// Quinto widget con pagina di dettaglio propria. Stessa filosofia di
// Doppioni: filtro replicato da CATALOGO_WIDGET.sealed.preview() ma su
// carteReali per intero (senza il .slice(0,3) del preview) — zero query
// nuove. A differenza delle altre pagine, click su una riga NON apre il
// flip-viewer (deciso da Claudio: ha meno senso per un prodotto sigillato
// che per una singola carta) — apre invece apriModificaCarta(id), lo
// stesso modale di modifica già riusato per "Modifica carta" nella pagina
// Doppioni.
let _sealedProdottiComputati = [];
let _sealedOrdinamento = 'valore';
let _sealedRicercaTesto = '';

function _sealedCalcola() {
    const prodotti = carteReali.filter(c => c.stato === 'collezione' && c.tipo === 'sealed');
    const righe = prodotti.map(p => {
        const qty = Number(p.qty) || 1;
        const prezzoUnitario = Number(p.price) || 0;
        return { id: p.id, nome: p.name || '—', immagine: p.immagine || null, qty, prezzoUnitario, valoreTotale: prezzoUnitario * qty };
    });
    _sealedProdottiComputati = righe;
    return {
        totale: righe.length,
        valore: righe.reduce((t, r) => t + r.valoreTotale, 0),
    };
}

async function renderPaginaSealed() {
    const container = document.getElementById('sealedContenuto');
    if (!container) return;

    _sealedOrdinamento = 'valore';
    _sealedRicercaTesto = '';
    const { totale, valore } = _sealedCalcola();
    const eur = (v) => '€ ' + Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 });

    if (totale === 0) {
        container.innerHTML = `
            <div class="page-header">
                <span class="page-title">Sealed</span>
            </div>
            <p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:2rem 0;">Nessun prodotto sealed al momento.</p>
        `;
        return;
    }

    container.innerHTML = `
        <div class="page-header">
            <span class="page-title">Sealed</span>
        </div>
        <div class="pg-pagina">
            <div class="pg-intro">
                <div class="pg-grande">${totale}</div>
                <div class="pg-sotto">valore totale ${eur(valore)}</div>
            </div>
            <div class="pg-stat">
                <div><b>${totale}</b><span>Prodotti</span></div>
                <div><b>${eur(valore)}</b><span>Valore totale</span></div>
            </div>
            <input type="text" class="pg-cerca" placeholder="Cerca tra i prodotti sealed..." oninput="_sealedCercaInput(this.value)">
            <div class="pg-filtri">
                <span class="pg-filtro attivo" data-ord="valore" onclick="_sealedImpostaOrdinamento('valore')">Valore</span>
                <span class="pg-filtro" data-ord="quantita" onclick="_sealedImpostaOrdinamento('quantita')">Quantità</span>
                <span class="pg-filtro" data-ord="alfabetico" onclick="_sealedImpostaOrdinamento('alfabetico')">Alfabetico</span>
            </div>
            <div class="pg-elenco" id="sealedElenco"></div>
        </div>
    `;
    _sealedRenderElenco();
}

function _sealedImpostaOrdinamento(ordine) {
    _sealedOrdinamento = ordine;
    document.querySelectorAll('.pg-filtri .pg-filtro').forEach(el => {
        el.classList.toggle('attivo', el.dataset.ord === ordine);
    });
    _sealedRenderElenco();
}

function _sealedCercaInput(valore) {
    _sealedRicercaTesto = (valore || '').toLowerCase();
    _sealedRenderElenco();
}

function _sealedRenderElenco() {
    const elenco = document.getElementById('sealedElenco');
    if (!elenco) return;

    const eur = (v) => '€ ' + Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 });

    let righe = [..._sealedProdottiComputati];
    if (_sealedRicercaTesto) righe = righe.filter(r => r.nome.toLowerCase().includes(_sealedRicercaTesto));

    if (_sealedOrdinamento === 'valore') righe.sort((a, b) => b.valoreTotale - a.valoreTotale);
    else if (_sealedOrdinamento === 'quantita') righe.sort((a, b) => b.qty - a.qty);
    else righe.sort((a, b) => a.nome.localeCompare(b.nome));

    if (righe.length === 0) {
        elenco.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.82rem; padding:1.2rem 0;">Nessun prodotto corrisponde alla ricerca.</p>';
        return;
    }

    elenco.innerHTML = righe.map(r => {
        const immagineSrc = r.immagine ? (_urlImmagineVisualizzabile(r.immagine, 96) || '') : '';
        const fig = immagineSrc
            ? `<img class="pg-fig" src="${immagineSrc}" alt="" onerror="this.style.display='none';">`
            : '<div class="pg-fig"></div>';
        return `
            <div class="pg-riga" data-tocca onclick="if (typeof apriModificaCarta === 'function') apriModificaCarta('${r.id}');">
                ${fig}
                <div class="pg-testo"><b>${escapeHtml(r.nome)}</b><span>×${r.qty} · ${eur(r.prezzoUnitario)} cad.</span></div>
                <div class="pg-destra"><b>${eur(r.valoreTotale)}</b>totale</div>
            </div>`;
    }).join('');
}
