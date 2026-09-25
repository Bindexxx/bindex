// ═══════════════════════════════════════════════════════════════════════
// WIDGET-SCAFFALI.UI.JS — tessera "Scaffali" (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// Fase 1.3, Step 5a (2026-09-12). Mirror di ui/widget-binder.ui.js: il
// widget "Scaffali" non ha una pagina propria scritta qui dentro — apre
// ui/scaffali.ui.js (apriPaginaScaffali()), chiamata da
// apriDettaglioWidget() in ui/paginainiziale-dettaglio.ui.js, ramo
// "if (tabId === 'scaffali')" — stesso schema di sealed/wishlist/location/
// doppioni/set/bustina, MAI switchTab() (whitelist fissa di 5 tab,
// intoccabile per memoria di progetto — vedi commento in
// paginainiziale-dettaglio.ui.js).
//
// Preview: conta gli scaffali dell'utente. Zero query nuove non è
// possibile qui (a differenza del widget Binders, che stima dalle location
// già in cache) — non esiste un cache locale di "quanti scaffali" prima
// di aprire la pagina, quindi il preview stesso fa una query leggera
// (select count). Accettato: gli scaffali sono un numero piccolo per
// utente, costo trascurabile.
CATALOGO_WIDGET.scaffali = {
    titolo: 'Scaffali', icona: 'fa-box-archive',
    preview: async () => {
        const userId = await authGetUserId();
        if (!userId) return { righe: ['—'], dati: { totale: 0 } };
        const { count, error } = await scaffaliConta(userId); // data/scaffali.repository.js (audit 2026-09-25, B8)
        if (error) { console.error('[widget-scaffali] preview:', error.message); return { righe: ['—'], dati: { totale: 0 } }; }
        const totale = count || 0;
        return { righe: [`${totale} scaffal${totale === 1 ? 'e' : 'i'}`], dati: { totale } };
    },
};
