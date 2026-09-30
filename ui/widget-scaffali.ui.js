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
//
// RESTYLE BINDEX FASE 2 (2026-09-30, file 02 § 1: "oggi 0 scaffali pur
// esistendo Vetrina/Scambio"). Vetrina e Scambio sono scaffali fissi che la
// pagina Scaffali crea solo alla prima apertura (scaffaleGarantisciVetrina/
// scaffaleScambioGarantisci): prima di allora il conteggio diceva 0. Ora si
// contano come presenti anche se la riga non esiste ancora — è ciò che
// l'utente vedrà aprendo la pagina. Si legge anche quanti prodotti ci sono
// (per il ripiano della tessera). Stessa cache di un minuto del widget
// Binders: il render della home gira ogni 15s.
let _widgetScaffaliCache = null; // { quando, scaffali, prodotti }

async function _widgetScaffaliLeggi() {
    if (_widgetScaffaliCache && Date.now() - _widgetScaffaliCache.quando < 60000) return _widgetScaffaliCache;
    const userId = await authGetUserId();
    if (!userId) return null;
    const [rs, rp] = await Promise.all([scaffaliList(userId), scaffaleProdottiTuttiUtente(userId)]);
    if (rs.error) { console.error('[widget-scaffali] preview:', rs.error.message); return null; }
    if (rp.error) console.error('[widget-scaffali] prodotti:', rp.error.message);
    _widgetScaffaliCache = { quando: Date.now(), scaffali: rs.data || [], prodotti: rp.data || [] };
    return _widgetScaffaliCache;
}

CATALOGO_WIDGET.scaffali = {
    titolo: 'Scaffali', icona: 'fa-box-archive',
    preview: async () => {
        const d = await _widgetScaffaliLeggi();
        if (!d) return { righe: ['—'], dati: null };
        const tipi = new Set(d.scaffali.map(s => s.tipo));
        const totale = d.scaffali.length + ['vetrina', 'scambio'].filter(t => !tipi.has(t)).length;
        // Un prodotto può stare su più scaffali (es. Vetrina e Scambio):
        // si contano i prodotti distinti.
        const prodottiDistinti = [...new Set(d.prodotti.map(p => p.prodotto_id))];
        const nProdotti = prodottiDistinti.length;
        return {
            righe: [`${totale} scaffal${totale === 1 ? 'e' : 'i'}${nProdotti ? ` · ${nProdotti} prodott${nProdotti === 1 ? 'o' : 'i'}` : ''}`],
            dati: { totale, prodotti: nProdotti, chiavi: prodottiDistinti },
        };
    },
};
