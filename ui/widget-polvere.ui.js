// ═══════════════════════════════════════════════════════════════════════
// WIDGET-POLVERE.UI.JS — tessera "Polvere" (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP 15 della ristrutturazione file widget home (vedi
// Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md). Estratto da
// ui/phone.ui.js il 2026-09-11. NESSUNA riscrittura: solo spostamento di
// codice, zero cambi di comportamento per l'utente finale.
//
// SEGNAPOSTO (bloccato: true), scelta esplicita di Claudio (vedi compilati
// precedenti): la RPC che genera la valuta esiste già (doppioni della
// bustina la accreditano — vedi widget-bustina.ui.js/polvere_saldo, STEP
// 14), ma questa tessera resta "In arrivo" finché non si decide una vera
// UI. 'bloccato' è un flag generico letto dal motore home
// (ui/paginainiziale.ui.js, non toccato) — impedisce il click, nessuna
// logica specifica di questo widget coinvolta.
//
// COSA RESTA FUORI (non spostato qui, invariato):
// - _ballCORPI.polvere (usa _ballCorpoSegnaposto, generico) /
//   _ballASPETTO.polvere / _ballTITOLI_BREVI.polvere
//   (ui/widget-render-condiviso.ui.js) — motore visivo, non toccato.
// ───────────────────────────────────────────────────────────────────────

// ── VOCE DI CATALOGO ──────────────────────────────────────────────────
CATALOGO_WIDGET.polvere = {
        titolo: 'Polvere', icona: 'fa-wand-sparkles', bloccato: true,
        preview: () => ({ righe: ['In arrivo'], dati: { placeholder: true, testo: 'La valuta guadagnata coi doppioni' } }),
};
