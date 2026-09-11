// ═══════════════════════════════════════════════════════════════════════
// WIDGET-VISUALIZZAZIONE.UI.JS — tessere "Visualizzazione" + "Ultime
// aggiunte" (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP 21 della ristrutturazione file widget home (vedi
// Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md). Estratto da
// ui/phone.ui.js il 2026-09-11. NESSUNA riscrittura: solo spostamento di
// codice, zero cambi di comportamento per l'utente finale.
//
// "Visualizzazione" — CATEGORIA C: nessuna pagina propria — id catalogo
// coincide col nome della tab (una delle 5 fisse del sito), quindi non
// serve nemmeno il campo 'tab': il dispatch generico
// (apriDettaglioWidget → w.id quando manca 'tab', ui/paginainiziale.ui.js)
// arriva già al posto giusto.
//
// "Ultime aggiunte" (id catalogo 'carte_recenti') — ACCORPATA QUI in
// questo step: era stata estratta per errore come file a sé
// (widget-ultime-aggiunte.ui.js) allo STEP 12, fuori dall'ordine della
// roadmap originale che la bundlava con "Visualizzazione". Claudio ha
// confermato l'opzione B: accorpare qui e cancellare il file a sé — vedi
// istruzioni sotto per il file da eliminare da GitHub. Stessa categoria C:
// 'tab': 'visualizzazione' apre la stessa tab di cui sopra.
//
// COSA RESTA FUORI (non spostato qui, invariato):
// - _ballCORPI.visualizzazione / _ballCORPI.carte_recenti (e ASPETTO/
//   TITOLI_BREVI corrispondenti, ui/widget-render-condiviso.ui.js) —
//   motore visivo, non toccato. Verificato: leggono rispettivamente
//   d.totale/d.aggiunteRecenti/d.serie/d.ultime e d.lista dal 'dati'
//   restituito dai due preview() qui sotto — forme confermate coerenti.
// ───────────────────────────────────────────────────────────────────────

// ── VOCE DI CATALOGO "VISUALIZZAZIONE" ───────────────────────────────
CATALOGO_WIDGET.visualizzazione = {
        titolo: 'Visualizzazione', icona: 'fa-images',
        preview: () => {
            const collezione = carteReali.filter(c => c.stato === 'collezione');
            const n = collezione.length;
            // 'dati' è AGGIUNTIVO (tessere grandi): 'righe' resta identica,
            // così 1x1, mini, badge e semaforo non cambiano di una virgola.
            // Le ultime quattro entrate, stesso ordinamento di ultima_carta.
            const ultime = collezione.slice()
                .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
                .slice(0, 4)
                .map(c => ({ id: c.id, nome: c.name || '', immagine: c.immagine, rarita: c.rarita }));

            // Andamento VERO degli inserimenti negli ultimi 14 giorni, per
            // la sparkline: quante carte sono entrate ogni giorno. Dato già
            // in memoria (createdAt), nessuna query nuova.
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

            return { righe: [`${n} carte totali`], dati: { totale: n, ultime, serie, aggiunteRecenti } };
        },
};

// ── VOCE DI CATALOGO "ULTIME AGGIUNTE" (accorpata, vedi header) ──────
CATALOGO_WIDGET.carte_recenti = {
    titolo: 'Ultime aggiunte', icona: 'fa-clock',
    tagliaDefault: '6x6', // cinque righe di elenco più la fila di miniature
    // Da carteReali per createdAt, come caricaAttivitaRecentiHome().
    // Nessuna query.
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
        return {
            righe: ultime.slice(0, 3).map(c => `${c.name || '—'} · ${quando(c)}`),
            // Vedi la nota in 'primo_piano': niente immagine, cosi' la
            // sfera c'e' sempre. E niente numerino: sarebbe il giorno.
            badge: false,
            dati: { lista: ultime.map(c => ({ id: c.id, nome: c.name, quando: quando(c), immagine: c.immagine, rarita: c.rarita })) },
        };
    },
    tab: 'visualizzazione',
};
