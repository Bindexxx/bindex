// Widget Richieste.

let _widgetRichiesteCache = null;

CATALOGO_WIDGET.richieste = {
    titolo: 'Richieste', icona: 'fa-handshake',
    preview: async () => {
        const userId = await authGetUserId();
        if (!userId) return { righe: ['—'], dati: { totale: 0 } };
        if (!_widgetRichiesteCache || Date.now() - _widgetRichiesteCache.quando > 60000) {
            const { data, error } = await richiesteScambioRicevuteList(userId);
            if (error) { console.error('[widget-richieste] preview:', error.message); return { righe: ['—'], dati: null }; }
            _widgetRichiesteCache = { quando: Date.now(), righe: data || [] };
        }
        const righe = _widgetRichiesteCache.righe;
        const inAttesa = righe.filter(r => r.stato_riga === 'in_attesa');
        const riservate = righe.filter(r => r.stato_riga === 'accettata').length;
        const totale = inAttesa.length;
        const valore = inAttesa.reduce((t, r) => t + (Number(r.prezzo_congelato) || 0) * (Number(r.quantita_richiesta) || 1), 0);
        const immagini = inAttesa.map(r => (r.snapshot || {}).immagine).filter(Boolean).slice(0, 4);
        return {
            righe: [totale > 0 ? `${totale} da gestire` : (riservate ? `${riservate} riservat${riservate === 1 ? 'a' : 'e'}` : 'Nessuna in attesa')],
            azioni: totale,
            dati: { totale, riservate, valore, immagini, oggetti: inAttesa.length, righeInAttesa: inAttesa },
        };
    },
};

function _widgetRichiesteSvuotaCache() { _widgetRichiesteCache = null; }
