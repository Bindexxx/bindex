// ═══════════════════════════════════════════════════════════════════════
// WIDGET-ESTENSIONE.UI.JS — tessera "Estensione" (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP 9 della ristrutturazione file widget home (vedi
// Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md). Estratto da
// ui/phone.ui.js il 2026-09-11. NESSUNA riscrittura: solo spostamento di
// codice, zero cambi di comportamento per l'utente finale.
//
// CATEGORIA C: nessuna pagina propria — il click porta l'estensione in
// primo piano (se rilevata) o apre il pannello Impostazioni già esistente
// (se non rilevata, per mostrare le istruzioni d'installazione). Per
// questo il file contiene SOLO la voce di catalogo, nessun'altra funzione:
// _chiediVersioneEstensione(), _chiediAiutaGruppoEstensione() e
// _mandaAperturaAppAEstensione() sono esterne (ui/extension.ui.js, non
// toccato).
//
// COSA RESTA FUORI (non spostato qui, invariato):
// - apriDettaglioWidget('impostazioni', evt) (ui/paginainiziale.ui.js) —
//   motore home, dispatch generico, non toccato in questo step.
// - _ballCORPI.estensione / _ballASPETTO.estensione / _ballTITOLI_BREVI
//   .estensione (ui/widget-render-condiviso.ui.js) — motore visivo, non
//   toccato. Verificato anche il caso speciale in quel file (riga ~593,
//   modalità icona forzata quando anteprima.rilevata === false): legge lo
//   stesso campo 'rilevata' restituito dal preview() qui sotto, forma
//   confermata coerente.
// ───────────────────────────────────────────────────────────────────────

// ── VOCE DI CATALOGO ──────────────────────────────────────────────────
    // Sbloccato (Claudio, 2026-08-27): extension.ui.js letto per intero in
    // questa sessione. _chiediVersioneEstensione()/_chiediAiutaGruppoEstensione()
    // già esistenti lì, stessa tolleranza timeout (1.2s, mai blocca il
    // render della home) delle altre chiamate verso l'estensione — zero
    // query nuove, stessa filosofia degli altri widget.
CATALOGO_WIDGET.estensione = {
        titolo: 'Estensione', icona: 'fa-link',
        preview: async () => {
            const versione = await _chiediVersioneEstensione();
            if (!versione) return { righe: ['Non rilevata'], rilevata: false, dati: { rilevata: false } };
            const aiutaGruppo = await _chiediAiutaGruppoEstensione();
            return {
                righe: [`v${versione}`, aiutaGruppo ? 'Aiuta il gruppo: attivo' : 'Aiuta il gruppo: no'],
                stato: aiutaGruppo ? 'ok' : undefined,
                rilevata: true,
                dati: { rilevata: true, versione, aiutaGruppo: !!aiutaGruppo },
            };
        },
        // Click: porta l'estensione in primo piano (stessa funzione già
        // usata dal bottone "Apri l'app" in sidebar — vedi
        // _mandaAperturaAppAEstensione in extension.ui.js). Se non
        // rilevata, apre Impostazioni invece: lì ci sono le istruzioni
        // d'installazione, non ha senso provare ad "aprire" qualcosa che
        // non c'è.
        azione: async (dati, evt) => {
            if (dati && dati.rilevata) {
                await _mandaAperturaAppAEstensione();
            } else {
                apriDettaglioWidget('impostazioni', evt);
            }
        },
};
