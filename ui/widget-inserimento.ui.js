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

// Riepilogo della propria coda (restyle FASE 2). "Ultimo invio" = le righe
// create entro 10 minuti dalla più recente (un invio dall'app ne crea
// diverse insieme): quante, quando, quante trovate / in errore / in corso.
let _widgetInserimentoCache = null; // { quando, dati }
async function _widgetInserimentoCoda() {
    if (_widgetInserimentoCache && Date.now() - _widgetInserimentoCache.quando < 30000) return _widgetInserimentoCache.dati;
    const userId = await authGetUserId();
    if (!userId) return null;
    const { data, error } = await codaCarteUltimeRighe(userId, 50);
    if (error) { console.error('[widget-inserimento] coda:', error.message); return null; }
    const righe = data || [];
    const inCoda = righe.filter(r => r.stato === 'pending' || r.stato === 'in_corso').length;
    let ultimoInvio = null;
    if (righe.length) {
        const t0 = new Date(righe[0].creato_il).getTime();
        const invio = righe.filter(r => t0 - new Date(r.creato_il).getTime() <= 10 * 60 * 1000);
        ultimoInvio = {
            quante: invio.length,
            quando: righe[0].creato_il,
            trovate: invio.filter(r => r.stato === 'completato').length,
            errori: invio.filter(r => r.stato === 'errore').length,
            inCorso: invio.filter(r => r.stato === 'pending' || r.stato === 'in_corso').length,
        };
    }
    const dati = { inCoda, ultimoInvio };
    _widgetInserimentoCache = { quando: Date.now(), dati };
    return dati;
}

// ── VOCE DI CATALOGO ──────────────────────────────────────────────────
CATALOGO_WIDGET.inserimento = {
        titolo: 'Inserimento', icona: 'fa-id-card',
        // Riusa _contaCodaErrori() già definita in home.ui.js — stesso
        // conteggio già mostrato nell'avviso Home, nessuna query duplicata.
        // RESTYLE BINDEX FASE 2 (2026-09-30, tavola "Inserimento = in coda +
        // ultimo invio + Aggiungi carta"): oltre alle carte da correggere
        // (azione → badge rosso) si leggono le ultime righe della propria
        // coda: quante sono ancora in coda e com'è andato l'ultimo invio.
        // Cache di 30s: il render della home gira ogni 15s.
        preview: async () => {
            const n = await _contaCodaErrori();
            const coda = await _widgetInserimentoCoda();
            const inCoda = coda ? coda.inCoda : 0;
            let stato = n > 0 ? `${n} da correggere` : (inCoda > 0 ? `${inCoda} in coda` : 'tutto inviato');
            return {
                righe: [stato],
                stato: n > 0 ? 'allerta' : 'ok',
                azioni: n,
                dati: { daCorreggere: n, inCoda, ultimoInvio: coda ? coda.ultimoInvio : null },
            };
        },
};
