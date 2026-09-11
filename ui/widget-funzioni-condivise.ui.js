// ═══════════════════════════════════════════════════════════════════════
// WIDGET-FUNZIONI-CONDIVISE.UI.JS — funzioni ad-hoc usate da più widget
// (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP 2 della ristrutturazione file widget home (vedi
// Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md) — creato vuoto
// insieme allo STEP 1, come previsto dalla roadmap stessa (§5, STEP 2).
// Nasce vuoto di proposito: si popola durante l'estrazione dei prossimi
// widget, ogni volta che una funzione risulta chiamata da più di un
// widget a PAGINA INTERA (non tessera — quelle sono già in
// widget-render-condiviso.ui.js). Prima di scrivere una nuova funzione di
// supporto per un widget, controllare PRIMA qui se esiste già qualcosa di
// riusabile.
//
// Candidate già individuate nella sessione di pianificazione (da
// confermare quando si arriva a leggerle per intero nei rispettivi step):
// - _contaCodaErrori (oggi in home.ui.js, letta anche da 'inserimento' e
//   potenzialmente da 'dafare')
// - pattern di cache-a-tempo (_prezziRecentiConCache, _storicoValoreConCache,
//   _contributiConCache — oggi tre implementazioni separate dello stesso
//   pattern "cache con TTL", da valutare se accorpabili in un helper unico)
//
// Caricato SUBITO DOPO ui/widget-render-condiviso.ui.js e PRIMA di tutti i
// widget-*.ui.js in index.html.
// ───────────────────────────────────────────────────────────────────────
