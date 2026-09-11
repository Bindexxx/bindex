// ═══════════════════════════════════════════════════════════════════════
// WIDGET-INSERIMENTO.UI.JS — tessera "Inserimento" (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP 11 della ristrutturazione file widget home (vedi
// Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md). Estratto da
// ui/phone.ui.js il 2026-09-11. NESSUNA riscrittura: solo spostamento di
// codice, zero cambi di comportamento per l'utente finale.
//
// NOTA DI PROCESSO: questo step è stato eseguito FUORI SEQUENZA — saltato
// per errore tra lo STEP 10 e lo STEP 12, poi eseguito qui a correzione
// dell'errore. Nessun impatto sul risultato: file autonomo, nessuna
// dipendenza dagli step nel mezzo.
//
// CATEGORIA C: nessuna pagina propria — nessun 'azione'/'tab' nel
// catalogo, quindi il click ricade sul dispatch generico
// (apriDettaglioWidget → switchTab('inserimento', null),
// ui/paginainiziale.ui.js, non toccato) che apre correttamente la tab
// "Inserimento" già esistente: è una delle 5 tab fisse del sito, quindi
// qui — a differenza di 'contributi'/'variazione_valore' — non c'è nessun
// comportamento anomalo da segnalare.
//
// COSA RESTA FUORI (non spostato qui, invariato):
// - _contaCodaErrori(): esterna, ui/home.ui.js, non toccata.
// - _ballASPETTO.inserimento / _ballTITOLI_BREVI.inserimento / soglie di
//   badge forte in _ballChiedeAttenzione / _ballCORPI.inserimento
//   (ui/widget-render-condiviso.ui.js) — motore visivo, non toccato.
//   _ballCORPI.inserimento esiste (avevo scritto per errore il contrario
//   in una prima stesura di questo commento — corretto qui prima di
//   consegnare): legge d.daCorreggere dal 'dati' restituito dal preview()
//   qui sotto, forma confermata coerente.
// ───────────────────────────────────────────────────────────────────────

// ── VOCE DI CATALOGO ──────────────────────────────────────────────────
CATALOGO_WIDGET.inserimento = {
        titolo: 'Inserimento', icona: 'fa-id-card',
        // Riusa _contaCodaErrori() già definita in home.ui.js — stesso
        // conteggio già mostrato nell'avviso Home, nessuna query duplicata.
        preview: async () => {
            const n = await _contaCodaErrori();
            return { righe: [n > 0 ? `${n} da correggere` : 'Tutto in ordine'], stato: n > 0 ? 'allerta' : 'ok', dati: { daCorreggere: n } };
        },
};
