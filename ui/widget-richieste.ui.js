// Widget Scambi (id interno 'richieste'): richieste di prima da gestire e proposte a due vie (sql/154).

let _widgetRichiesteCache = null;

CATALOGO_WIDGET.richieste = {
    titolo: 'Scambi', icona: 'fa-handshake',
    preview: async () => {
        const userId = await authGetUserId();
        if (!userId) return { righe: ['—'], dati: { totale: 0 } };
        if (!_widgetRichiesteCache || Date.now() - _widgetRichiesteCache.quando > 60000) {
            const [ric, prop] = await Promise.all([
                richiesteScambioRicevuteList(userId),
                (typeof scambiProposteList === 'function') ? scambiProposteList(userId) : Promise.resolve({ data: [] }),
            ]);
            if (ric.error) { console.error('[widget-richieste] preview:', ric.error.message); return { righe: ['—'], dati: null }; }
            // Senza sql/154 la lettura delle proposte fallisce: il widget mostra solo le richieste di prima.
            if (prop.error) console.warn('[widget-richieste] proposte:', prop.error.message);
            _widgetRichiesteCache = { quando: Date.now(), righe: ric.data || [], proposte: (prop.error ? [] : prop.data) || [] };
        }
        const righe = _widgetRichiesteCache.righe;
        const inAttesa = righe.filter(r => r.stato_riga === 'in_attesa');
        const richiesteDaFare = new Set(inAttesa.map(r => r.richiesta_id || r.id)).size;

        // Proposte che aspettano me: da accettare, cambiare o rifiutare, o accettate senza il mio Fatto.
        // Le loro righe vanno in righeInAttesa come quelle di prima, con chi aspetta in richieste_scambio.
        const proposte = _widgetRichiesteCache.proposte;
        const daFare = [], inCorso = [];
        proposte.forEach(p => {
            const mittente = p.richiedente_id === userId;
            const fattoIo = mittente ? p.fatto_richiedente_il : p.fatto_proprietario_il;
            if ((p.stato_proposta === 'in_attesa' && !mittente) || (p.stato_proposta === 'accettata' && !fattoIo)) daFare.push(p);
            else if (p.stato_proposta === 'in_attesa' || p.stato_proposta === 'accettata') inCorso.push(p);
        });
        const righeProposte = [];
        daFare.forEach(p => {
            const altro = p.richiedente_id === userId ? p.proprietario_id : p.richiedente_id;
            (p.richieste_scambio_righe || []).forEach(r => righeProposte.push({
                ...r, _proposta: true, richiesta_id: p.id,
                richieste_scambio: { richiedente_id: altro, tipo: 'proposta', stato_proposta: p.stato_proposta },
            }));
        });

        const tutte = [...inAttesa, ...righeProposte];
        const totale = richiesteDaFare + daFare.length;
        const riservate = righe.filter(r => r.stato_riga === 'accettata').length + inCorso.length;
        const valore = tutte.reduce((t, r) => t + (Number(r.prezzo_congelato) || 0) * (Number(r.quantita_richiesta) || 1), 0);
        const immagini = tutte.map(r => (r.snapshot || {}).immagine).filter(Boolean).slice(0, 4);
        return {
            righe: [totale > 0 ? `${totale} da gestire` : (riservate ? `${riservate} in corso` : 'Niente da fare')],
            azioni: totale,
            dati: { totale, riservate, valore, immagini, oggetti: tutte.length, righeInAttesa: tutte },
        };
    },
};

function _widgetRichiesteSvuotaCache() { _widgetRichiesteCache = null; }
