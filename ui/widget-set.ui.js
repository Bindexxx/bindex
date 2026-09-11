// ═══════════════════════════════════════════════════════════════════════
// WIDGET-SET.UI.JS — voce di catalogo + pagina "Set" (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP separato dal piano "riduzione accoppiamento" concordato con Claudio
// il 2026-09-11 (secondo giro di taglio). La "LIBRERIA DEI SET"
// (_ballLIBRERIA_MANUALE, _ballLIBRERIA_SET, _ballCaricaLibreriaDaDb,
// _ballSetBase, _ballALIAS_TESTA, _ballSetBaseConAlias, _ballLeggiCodice —
// dato/logica pura di parsing sigle) è stata spostata in
// ui/set-libreria-sigle.ui.js. NESSUNA riscrittura del codice esistente in
// nessuna delle due parti: solo spostamento, zero cambi di comportamento.
//
// CATEGORIA A: pagina propria di sola consultazione (nessun click sulle
// righe, nessuna ricerca — scelta di Claudio), ordinamento fisso per
// percentuale.
//
// Usa cross-file _ballLIBRERIA_SET/_ballLeggiCodice (ui/set-libreria-
// sigle.ui.js).
//
// COSA RESTA FUORI (non spostato qui, invariato):
// - apriDettaglioWidget (ui/paginainiziale-render.ui.js) continua a
//   chiamare renderPaginaSet() per tabId === 'set' — motore home, dispatch
//   generico, non toccato in questo step.
// - _ballCORPI.set_completamento / _ballASPETTO.set_completamento /
//   _ballTITOLI_BREVI.set_completamento (ui/widget-render-corpi.ui.js) —
//   motore visivo, non toccato.
// - escapeHtml, setEspansioniLeggiTutte, renderWidgetHome
//   (ui/paginainiziale*.ui.js): esterne/cross-file, non toccate.
// ───────────────────────────────────────────────────────────────────────

// ── VOCE DI CATALOGO ──────────────────────────────────────────────────
    // ── SET / ESPANSIONI ─────────────────────────────────────────────────
    // Avanzamento verso il set completo, dedotto dal CODICE della carta.
    //
    // ATTENZIONE, LIMITE DICHIARATO: il formato di 'codice' non è definito
    // da nessuna parte nel sito — nessun placeholder d'esempio, nessuna
    // validazione, nessuna regex: arriva grezzo dalla colonna. Quello che
    // segue riconosce i formati più diffusi (vedi _ballLeggiCodice) e, se
    // non riconosce nulla, il widget dice "codici non riconosciuti" invece
    // di mostrare percentuali inventate. Da tarare su codici reali.
CATALOGO_WIDGET.set_completamento = {
        titolo: 'Set', icona: 'fa-layer-group',
        preview: () => {
            const coll = carteReali.filter(c => c.stato === 'collezione' && c.tabella === 'carte');
            const set = {};
            let riconosciute = 0;
            coll.forEach(c => {
                const letto = _ballLeggiCodice(c.code);
                if (!letto) return;
                riconosciute++;
                if (!set[letto.set]) set[letto.set] = { numeri: new Set(), senzaNumero: 0 };
                // Le carte con numero si contano per numeri DISTINTI: la
                // stessa carta posseduta in versione normale e Poké Ball
                // vale uno solo ai fini del set completo.
                if (letto.numero != null) set[letto.set].numeri.add(letto.numero);
                else set[letto.set].senzaNumero++;
            });

            const voci = Object.entries(set).map(([sigla, conteggio]) => {
                const info = _ballLIBRERIA_SET[sigla];
                const hai = conteggio.numeri.size + conteggio.senzaNumero;
                return {
                    sigla,
                    nome: info ? info.nome : sigla,
                    hai,
                    // Un set senza numerazione (MFB) non ha avanzamento
                    // possibile: si mostra solo quante carte hai.
                    senzaNumerazione: conteggio.numeri.size === 0 && conteggio.senzaNumero > 0,
                    // Il totale c'è solo se il set è in libreria: senza,
                    // niente percentuale (mai un avanzamento su un totale
                    // che non conosciamo).
                    totale: info ? info.totale : null,
                    perc: info && info.totale && conteggio.numeri.size > 0
                        ? Math.min(100, (conteggio.numeri.size / info.totale) * 100)
                        : null
                };
            }).sort((a, b) => (b.perc ?? -1) - (a.perc ?? -1) || b.hai - a.hai);

            if (voci.length === 0) {
                return { righe: [riconosciute === 0 ? 'Codici non riconosciuti' : 'Nessun set'], dati: { voci: [], riconosciute, inLibreria: 0 } };
            }
            const inLibreria = voci.filter(v => v.totale).length;
            const prima = voci[0];
            return {
                righe: [prima.totale ? `${prima.nome}: ${prima.hai}/${prima.totale}` : `${voci.length} espansioni`],
                dati: { voci, riconosciute, inLibreria }
            };
        },
        // MODIFICATO (2026-08-30): prima apriva semplicemente
        // Visualizzazione generica (tab:'visualizzazione') — ora ha una
        // pagina propria (#set in index.html, renderPaginaSet() sotto).
        // Nessun click sulle righe (deciso da Claudio): la pagina è solo
        // di consultazione.
        tab: 'set',
};

// ── PAGINA "SET" (2026-08-30) ───────────────────────────────────────────
// Sesto widget con pagina di dettaglio propria. Riusa
// CATALOGO_WIDGET.set_completamento.preview() per intero (dati.voci: già
// TUTTE le espansioni, non solo le prime 4 del ball — nessun taglio da
// togliere qui, a differenza delle altre pagine). Sola consultazione:
// nessun click sulle righe, nessuna ricerca, ordinamento fisso per
// percentuale (deciso da Claudio) — stesso ordine già dato dal preview.
async function renderPaginaSet() {
    const container = document.getElementById('setContenuto');
    if (!container) return;

    const def = CATALOGO_WIDGET.set_completamento;
    let dati;
    try {
        dati = def.preview().dati;
    } catch (e) {
        console.error('renderPaginaSet:', e);
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Errore nel caricamento.</p>';
        return;
    }

    const voci = (dati && dati.voci) || [];
    if (voci.length === 0) {
        container.innerHTML = `
            <div class="page-header">
                <span class="page-title">Set</span>
            </div>
            <p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:2rem 0;">Nessuna espansione trovata.</p>
        `;
        return;
    }

    const totale = voci.length;
    const inLibreria = dati.inLibreria || 0;
    const riconosciute = dati.riconosciute || 0;
    const prima = voci[0];

    const righe = voci.map(v => {
        const haBarra = v.totale && v.perc != null;
        const testa = haBarra
            ? `<b>${escapeHtml(v.nome)}</b><span>${v.hai}/${v.totale} · ${Math.round(v.perc)}%</span>`
            : `<b>${escapeHtml(v.nome)}</b><span>${v.hai} cart${v.hai === 1 ? 'a' : 'e'}</span>`;
        const barra = haBarra
            ? `<div class="pg-barra-track"><div class="pg-barra-fill" style="width:${v.perc}%"></div></div>`
            : '<span style="font-size:0.7rem; color:var(--text-muted);">Avanzamento non disponibile — libreria set da compilare</span>';
        return `<div class="pg-riga-set"><div class="pg-riga-set-testa">${testa}</div>${barra}</div>`;
    }).join('');

    container.innerHTML = `
        <div class="page-header">
            <span class="page-title">Set</span>
        </div>
        <div class="pg-pagina">
            <div class="pg-intro">
                <div class="pg-grande">${totale}</div>
                <div class="pg-sotto">${prima.totale && prima.perc != null ? `${prima.nome}: ${Math.round(prima.perc)}% completo` : `${prima.nome} in testa`}</div>
            </div>
            <div class="pg-stat">
                <div><b>${totale}</b><span>Espansioni</span></div>
                <div><b>${inLibreria}</b><span>In libreria</span></div>
                <div><b>${riconosciute}</b><span>Carte riconosciute</span></div>
            </div>
            <div class="pg-elenco">${righe}</div>
        </div>
    `;
}
