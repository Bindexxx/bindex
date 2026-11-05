// Widget Scaffali.

let _widgetScaffaliCache = null;

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
        const prodottiDistinti = [...new Set(d.prodotti.map(p => p.prodotto_id))];
        const nProdotti = prodottiDistinti.length;
        return {
            righe: [`${totale} scaffal${totale === 1 ? 'e' : 'i'}${nProdotti ? ` · ${nProdotti} prodott${nProdotti === 1 ? 'o' : 'i'}` : ''}`],
            dati: { totale, prodotti: nProdotti, chiavi: prodottiDistinti },
        };
    },
};
