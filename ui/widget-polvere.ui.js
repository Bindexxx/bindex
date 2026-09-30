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
// RESTYLE BINDEX FASE 2 (2026-09-30, tavola "Polvere col saldo"): la
// tessera mostra il saldo vero (polvere_saldo, la stessa RPC della barra in
// alto). Resta 'bloccato' (nessuna pagina da aprire: la pagina Polvere =
// Shop arriva con la FASE 9). Con 'bloccato' il motore chiama preview() in
// modo SINCRONO, quindi il saldo si legge in background e si mostra al giro
// di render successivo (ogni 15s), al massimo una lettura al minuto.
// "+N ✧ questa settimana" delle tavole richiede lo storico dei movimenti
// di polvere (file 03 § 4.3, FASE 8e): per ora solo il saldo.
let _widgetPolvereSaldo = { quando: 0, valore: null, inCorso: false };
function _widgetPolvereAggiorna() {
    if (_widgetPolvereSaldo.inCorso || Date.now() - _widgetPolvereSaldo.quando < 60000) return;
    if (typeof polvereSaldoLeggi !== 'function') return;
    _widgetPolvereSaldo.inCorso = true;
    polvereSaldoLeggi()
        .then(({ data, error }) => {
            if (!error) _widgetPolvereSaldo.valore = Number(data) || 0;
            _widgetPolvereSaldo.quando = Date.now();
        })
        .catch(e => console.error('[widget-polvere] saldo:', e))
        .finally(() => { _widgetPolvereSaldo.inCorso = false; });
}

CATALOGO_WIDGET.polvere = {
        titolo: 'Polvere', icona: 'fa-wand-sparkles', bloccato: true,
        preview: () => {
            _widgetPolvereAggiorna();
            const s = _widgetPolvereSaldo.valore;
            if (s == null) return { righe: ['saldo in arrivo'], dati: null };
            return { righe: [`${s.toLocaleString('it-IT')} ✧`], dati: { saldo: s } };
        },
};
