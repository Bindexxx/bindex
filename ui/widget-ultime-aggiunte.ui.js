// ═══════════════════════════════════════════════════════════════════════
// WIDGET-ULTIME-AGGIUNTE.UI.JS — tessera "Ultime aggiunte" (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP 12 della ristrutturazione file widget home (vedi
// Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md). Estratto da
// ui/phone.ui.js il 2026-09-11. NESSUNA riscrittura: solo spostamento di
// codice, zero cambi di comportamento per l'utente finale.
//
// id catalogo: 'carte_recenti'.
//
// CATEGORIA C: nessuna pagina propria — 'tab': 'visualizzazione' apre la
// tab Visualizzazione già esistente (motore home, non toccato).
//
// COSA RESTA FUORI (non spostato qui, invariato):
// - _ballCORPI.carte_recenti / _ballASPETTO.carte_recenti /
//   _ballTITOLI_BREVI.carte_recenti / _ballMiniCarta / _ballElencoRighe
//   (ui/widget-render-condiviso.ui.js) — motore visivo, non toccato.
//   Verificato: legge d.lista dal 'dati' restituito dal preview() qui
//   sotto — forma confermata coerente, nessuna modifica necessaria.
// ───────────────────────────────────────────────────────────────────────

// ── VOCE DI CATALOGO ──────────────────────────────────────────────────
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
