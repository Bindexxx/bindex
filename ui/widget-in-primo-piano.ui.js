// ═══════════════════════════════════════════════════════════════════════
// WIDGET-IN-PRIMO-PIANO.UI.JS — tessera "In primo piano" (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP 10 della ristrutturazione file widget home (vedi
// Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md). Estratto da
// ui/phone.ui.js il 2026-09-11. NESSUNA riscrittura: solo spostamento di
// codice, zero cambi di comportamento per l'utente finale.
//
// id catalogo: 'primo_piano' (il titolo mostrato in home è "In primo
// piano", il file prende il nome da lì per coerenza con gli altri step).
//
// CATEGORIA C: nessuna pagina propria — il click apre direttamente il
// flip-modal della carta di valore più alto (apriFlipCardHome, esterna,
// ui/home.ui.js, non toccata). Stesso calcolo di
// renderBinderInPrimoPianoHome() (altrove, non toccato).
//
// COSA RESTA FUORI (non spostato qui, invariato):
// - _ballCORPI.primo_piano / _ballASPETTO.primo_piano / _ballTITOLI_BREVI
//   .primo_piano / _ballFilaCarte (ui/widget-render-condiviso.ui.js) —
//   motore visivo, non toccato. Verificato: legge d.perValore/d.su/d.giu
//   dal 'dati' restituito dal preview() qui sotto — forma confermata
//   coerente, nessuna modifica necessaria.
// ───────────────────────────────────────────────────────────────────────

// ── VOCE DI CATALOGO ──────────────────────────────────────────────────
CATALOGO_WIDGET.primo_piano = {
        titolo: 'In primo piano', icona: 'fa-crown',
        // Tre categorie da tre carte: sotto questa taglia le miniature non
        // ci stanno e il widget non mostrerebbe cio' per cui esiste.
        tagliaDefault: '6x8',
        // Stesso identico calcolo di renderBinderInPrimoPianoHome()
        // (ui/home.ui.js): tre categorie da 3 carte, solo collezione,
        // escluse le sealed. Tutto da carteReali, gia' in memoria:
        // ZERO query nuove, si puo' rivalutare a ogni giro di polling
        // senza costo.
        preview: () => {
            const carteSingole = (typeof carteReali !== 'undefined' ? carteReali : [])
                .filter(c => c.stato === 'collezione' && c.tipo !== 'sealed');
            const perValore = carteSingole.slice().sort((a, b) => (b.price || 0) - (a.price || 0)).slice(0, 3);
            const conVariazione = carteSingole.filter(c => c.variazioneNumerica != null);
            const su = conVariazione.filter(c => c.variazioneNumerica > 0).sort((a, b) => b.variazioneNumerica - a.variazioneNumerica).slice(0, 3);
            const giu = conVariazione.filter(c => c.variazioneNumerica < 0).sort((a, b) => a.variazioneNumerica - b.variazioneNumerica).slice(0, 3);
            const top = perValore[0];
            if (!top) return { righe: ['Nessuna carta ancora'], dati: { perValore: [], su: [], giu: [] } };
            const righe = [`${top.name || '—'}`, `€ ${(Number(top.price) || 0).toFixed(2)}`];
            if (su[0]) righe.push(`↑ ${su[0].name || '—'}`);
            return {
                righe,
                // NIENTE 'immagine': con una foto la tessera perde la sfera
                // e mostra icona piatta + miniatura (vedi il ramo BALL_ATTIVA
                // in renderWidgetHome). Il risultato era che questo widget e
                // "Ultime aggiunte" venivano resi in due modi diversi a
                // seconda che la prima carta avesse o meno una foto — un
                // dettaglio che non c'entra niente con il widget. La sfera
                // resta sempre; la foto della carta si vede aprendola.
                badge: false,
                // 'immagine' e 'rarita' servono a _ballMiniCarta per
                // disegnare le miniature nel corpo grande (vedi _ballCORPI).
                // Senza, il widget ricadeva sul corpo generico a tre righe
                // di testo — che e' il motivo per cui non somigliava per
                // niente al blocco della home fissa.
                dati: {
                    perValore: perValore.map(c => ({ id: c.id, nome: c.name, prezzo: Number(c.price) || 0, immagine: c.immagine, rarita: c.rarita })),
                    su: su.map(c => ({ id: c.id, nome: c.name, varia: c.variazioneNumerica, immagine: c.immagine, rarita: c.rarita })),
                    giu: giu.map(c => ({ id: c.id, nome: c.name, varia: c.variazioneNumerica, immagine: c.immagine, rarita: c.rarita })),
                },
            };
        },
        // Stesso gesto della home fissa: la carta si apre nel flip-modal,
        // non cambia tab.
        azione: (dati) => {
            const primo = dati && dati.perValore && dati.perValore[0];
            if (primo && typeof apriFlipCardHome === 'function') apriFlipCardHome(primo.id);
        },
};
