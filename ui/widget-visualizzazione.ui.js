// Widget Visualizzazione e Ultime aggiunte.

CATALOGO_WIDGET.visualizzazione = {
        titolo: 'Collezione', icona: 'fa-images',
        preview: () => {
            const collezione = carteReali.filter(c => c.stato === 'collezione');
            const n = collezione.length;
            const ultime = collezione.slice()
                .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
                .slice(0, 40)
                .map(c => ({ id: c.id, nome: c.name || '', immagine: c.immagine, rarita: c.rarita }));

            const GIORNI = 14;
            const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
            const serie = new Array(GIORNI).fill(0);
            collezione.forEach(c => {
                if (!c.createdAt) return;
                const d = new Date(c.createdAt); d.setHours(0, 0, 0, 0);
                const scarto = Math.round((oggi - d) / 86400000);
                if (scarto >= 0 && scarto < GIORNI) serie[GIORNI - 1 - scarto]++;
            });
            const aggiunteRecenti = serie.reduce((a, b) => a + b, 0);

            const valore = collezione.filter(c => !c.esclusoValore).reduce((t, c) => t + (Number(c.price) || 0) * (Number(c.qty) || 1), 0);
            const nSealed = (typeof prodottiSealedReali !== 'undefined' && Array.isArray(prodottiSealedReali)) ? prodottiSealedReali.length : 0;
            const nWishlist = carteReali.filter(c => c.tabella === 'wishlist').length;

            return {
                righe: [`${n} carte · ${formattaEuro(valore)}`],
                dati: { totale: n, valore, nSealed, nWishlist, ultime, serie, aggiunteRecenti },
            };
        },
};

CATALOGO_WIDGET.carte_recenti = {
    titolo: 'Ultime aggiunte', icona: 'fa-clock',
    tagliaDefault: '6x6',
    preview: () => {
        const collezione = (typeof carteReali !== 'undefined' ? carteReali : [])
            .filter(c => c.stato === 'collezione');
        const ultime = collezione.slice()
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
            .slice(0, 5);
        if (ultime.length === 0) return { righe: ['Nessuna carta ancora'], dati: { lista: [] } };
        const quando = (c) => c.createdAt
            ? new Date(c.createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
            : '—';
        const setteGiorniFa = Date.now() - 7 * 86400000;
        const in7 = collezione.filter(c => c.createdAt && new Date(c.createdAt).getTime() >= setteGiorniFa).length;
        return {
            righe: [in7 ? `${in7} negli ultimi 7 giorni` : `ultima: ${ultime[0].name || '—'}`],
            dati: {
                in7,
                lista: ultime.map(c => ({ id: c.id, nome: c.name, quando: quando(c), creataIl: c.createdAt, prezzo: Number(c.price) || 0, immagine: c.immagine, rarita: c.rarita })),
            },
        };
    },
    tab: 'visualizzazione',
};
