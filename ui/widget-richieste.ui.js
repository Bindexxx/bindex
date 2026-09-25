// ═══════════════════════════════════════════════════════════════════════
// WIDGET-RICHIESTE.UI.JS — tessera "Richieste" (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// Fase 4, Step 3 (2026-09-13). Mirror di widget-scaffali.ui.js: nessuna
// pagina propria qui dentro — apre ui/richieste-scambio.ui.js
// (apriPaginaRichieste()), chiamata da apriDettaglioWidget() in
// ui/paginainiziale-dettaglio.ui.js, ramo "if (tabId === 'richieste')" —
// stesso schema di sealed/wishlist/scaffali, MAI switchTab().
CATALOGO_WIDGET.richieste = {
    titolo: 'Richieste', icona: 'fa-handshake',
    preview: async () => {
        const userId = await authGetUserId();
        if (!userId) return { righe: ['—'], dati: { totale: 0 } };
        // Conta solo le righe che richiedono un'azione dell'utente: da
        // proprietario (in_attesa da accettare/rifiutare) — le "inviate"
        // in attesa non richiedono un'azione MIA, solo pazienza.
        // Query spostata in data/richieste-scambio.repository.js (audit 2026-09-25, B8).
        const { count, error } = await richiesteScambioContaDaGestire(userId);
        if (error) { console.error('[widget-richieste] preview:', error.message); return { righe: ['—'], dati: { totale: 0 } }; }
        const totale = count || 0;
        return { righe: [totale > 0 ? `${totale} da gestire` : 'Nessuna in attesa'], dati: { totale } };
    },
};
