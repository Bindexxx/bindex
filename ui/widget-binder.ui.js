// Widget Binders.

let _widgetBinderCache = null;
const _WIDGET_BINDER_CACHE_MS = 60000;

async function _widgetBinderLeggi() {
    if (_widgetBinderCache && Date.now() - _widgetBinderCache.quando < _WIDGET_BINDER_CACHE_MS) return _widgetBinderCache;
    const userId = await authGetUserId();
    if (!userId) return null;
    const [rb, rl] = await Promise.all([bindersQueryTutti(userId), locationsList(userId)]);
    if (rb.error) { console.error('[widget-binder] binders:', rb.error.message); return null; }
    if (rl.error) console.error('[widget-binder] location:', rl.error.message);
    _widgetBinderCache = {
        quando: Date.now(),
        binders: rb.data || [],
        nomiLocation: (rl.data || []).map(l => l.nome).filter(Boolean),
    };
    return _widgetBinderCache;
}

const _WIDGET_BINDER_ORDINE = { scambio: 0, wishlist: 1, extra: 2, location: 3 };

const _WIDGET_BINDER_ICONE = { scambio: 'fa-right-left', wishlist: 'fa-heart', extra: 'fa-star' };

CATALOGO_WIDGET.binder = {
    titolo: 'Binders', icona: 'fa-layer-group',
    preview: async () => {
        const d = await _widgetBinderLeggi();
        if (!d) return { righe: ['—'], dati: null };
        const tipi = new Set(d.binders.map(b => b.tipo));
        const materializzate = new Set(d.binders.filter(b => b.tipo === 'location').map(b => b.location_valore));
        const mancanti = d.nomiLocation.filter(n => !materializzate.has(n)).length
            + ['wishlist', 'extra', 'scambio'].filter(t => !tipi.has(t)).length;
        const totale = d.binders.length + mancanti;
        const pubblici = d.binders.filter(b => b.stato_pubblicazione === 'pubblico').length;
        const nomiSpeciali = { scambio: 'Scambio', wishlist: 'Wishlist', extra: 'Il mio binder' };
        const daMostrare = d.binders.map(b => ({ nome: b.nome, tipo: b.tipo, colore: b.colore, stato_pubblicazione: b.stato_pubblicazione }));
        ['scambio', 'wishlist', 'extra'].filter(t => !tipi.has(t)).forEach(t => {
            daMostrare.push({ nome: nomiSpeciali[t], tipo: t, colore: null, stato_pubblicazione: t === 'extra' ? 'privato' : 'pubblico' });
        });
        d.nomiLocation.filter(n => !materializzate.has(n)).forEach(n => {
            daMostrare.push({ nome: n, tipo: 'location', colore: null, stato_pubblicazione: 'privato' });
        });
        const copertine = daMostrare
            .sort((a, b) => (_WIDGET_BINDER_ORDINE[a.tipo] ?? 9) - (_WIDGET_BINDER_ORDINE[b.tipo] ?? 9) || String(a.nome || '').localeCompare(String(b.nome || '')))
            .map(b => ({ nome: b.nome || '', tipo: b.tipo, colore: b.colore || null, pubblico: b.stato_pubblicazione === 'pubblico', icona: _WIDGET_BINDER_ICONE[b.tipo] || '' }));
        return {
            righe: [`${totale} binder${pubblici ? ` · ${pubblici} pubblic${pubblici === 1 ? 'o' : 'i'}` : ''}`],
            dati: { totale, pubblici, copertine },
        };
    },
};
