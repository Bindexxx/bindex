// ═══════════════════════════════════════════════════════════════════════
// WIDGET-RICHIESTE.UI.JS — tessera "Richieste" (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// Fase 4, Step 3 (2026-09-13). Mirror di widget-scaffali.ui.js: nessuna
// pagina propria qui dentro — apre ui/richieste-scambio.ui.js
// (apriPaginaRichieste()), chiamata da apriDettaglioWidget() in
// ui/paginainiziale-dettaglio.ui.js, ramo "if (tabId === 'richieste')" —
// stesso schema di sealed/wishlist/scaffali, MAI switchTab().
//
// RESTYLE BINDEX FASE 2 (2026-09-30, tavola "Richieste = chi/cosa +
// Gestisci"): oltre al conteggio servono COSA è stato chiesto (miniature e
// valore) e quante sono già riservate (accettate, da concludere). Si legge
// quindi l'elenco delle ricevute (richiesteScambioRicevuteList, la stessa
// della pagina Richieste) invece del solo conteggio, con una cache di 60s:
// il render della home gira ogni 15s e questo preview lo chiama anche il
// Centro operativo. dati.totale resta "da gestire" (in_attesa), come prima:
// il Centro operativo lo legge.
// Il nome di chi chiede NON c'è ancora: la pagina Richieste stessa non lo
// mostra (arriva con la FASE 3, nickname).
let _widgetRichiesteCache = null; // { quando, righe }

CATALOGO_WIDGET.richieste = {
    titolo: 'Richieste', icona: 'fa-handshake',
    preview: async () => {
        const userId = await authGetUserId();
        if (!userId) return { righe: ['—'], dati: { totale: 0 } };
        if (!_widgetRichiesteCache || Date.now() - _widgetRichiesteCache.quando > 60000) {
            const { data, error } = await richiesteScambioRicevuteList(userId);
            if (error) { console.error('[widget-richieste] preview:', error.message); return { righe: ['—'], dati: { totale: 0 } }; }
            _widgetRichiesteCache = { quando: Date.now(), righe: data || [] };
        }
        const righe = _widgetRichiesteCache.righe;
        // Da gestire = righe ricevute in attesa di una MIA decisione (le
        // inviate non richiedono un'azione mia, solo pazienza).
        const inAttesa = righe.filter(r => r.stato_riga === 'in_attesa');
        const riservate = righe.filter(r => r.stato_riga === 'accettata').length;
        const totale = inAttesa.length;
        const valore = inAttesa.reduce((t, r) => t + (Number(r.prezzo_congelato) || 0) * (Number(r.quantita_richiesta) || 1), 0);
        const immagini = inAttesa.map(r => (r.snapshot || {}).immagine).filter(Boolean).slice(0, 4);
        return {
            righe: [totale > 0 ? `${totale} da gestire` : (riservate ? `${riservate} riservat${riservate === 1 ? 'a' : 'e'}` : 'Nessuna in attesa')],
            azioni: totale,
            dati: { totale, riservate, valore, immagini, oggetti: inAttesa.length },
        };
    },
};

// Dopo un'azione sulla pagina Richieste la tessera deve aggiornarsi
// subito, non dopo un minuto: chi modifica le richieste chiama questa.
function _widgetRichiesteSvuotaCache() { _widgetRichiesteCache = null; }
