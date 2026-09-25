// ── config/supabase.js ───────────────────────────────────────────────────
// Fonte unica di URL e chiave anon Supabase, condivisa da tutte le pagine
// del sito (index, admin, binder-pubblico, scaffali-pubblico, sealed,
// wishlist).
//
// Va caricato con <script src="config/supabase.js"></script> DOPO lo script
// del CDN @supabase/supabase-js e PRIMA dello script inline di ciascuna
// pagina, che continua a usare SUPABASE_URL / SUPABASE_ANON_KEY esattamente
// come prima (nessun cambio di comportamento).
//
// AGGIORNATO 2026-09-25 (refactoring approvato da Claudio): il client
// (supabaseClient) ora nasce QUI, in fondo a questo file, invece che
// nell'ultimo <script> di ogni pagina. Motivo: prima tutto il codice che
// girava durante il caricamento degli script non lo trovava ancora (bug
// "supabaseClient is not defined" della Chat). Le opzioni restano diverse
// per tipo di pagina, scelte dall'attributo data-client del tag <script>
// di questo file (vedi fondo file). Testo storico qui sotto:
// NOTA: la creazione del client (supabase.createClient(...)) restava
// dentro ciascuna pagina, perché le opzioni non sono identiche ovunque —
// index.html e admin.html usano il client di default (sessione persistente,
// serve per il login vero), mentre scambio.html / sealed.html /
// wishlist.html sono pagine pubbliche anonime e usano un client "leggero"
// con { auth: { persistSession: false, autoRefreshToken: false } }.
//
// Usa SEMPRE la chiave "anon public" (mai la service_role) — vedi le Row
// Level Security policy sul progetto, sono loro l'unico scudo dato che
// questo codice gira nel browser di chiunque visiti il sito.
//
// ── PROGETTO SUPABASE (xpfibrzsffurdlypxnrw) ─────────────────────────────
// È l'UNICO progetto (nessun altro Supabase/repo/sito). Oggi è in fase di
// test; quando diventerà ufficiale si cancellano account e dati, la
// struttura del database resta questa (Claudio, 2026-09-25).
const SUPABASE_URL = 'https://xpfibrzsffurdlypxnrw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwZmlicnpzZmZ1cmRseXB4bnJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczOTU0MzYsImV4cCI6MjEwMjk3MTQzNn0.k5eELxNA3HkWdslxoqIL_IR8qFZ1W0j_IWZugE2GVCg';

// ═══════════════════════════════════════════════════════════════════════
// CREAZIONE DEL CLIENT (2026-09-25) — unico punto per tutte le pagine
// ═══════════════════════════════════════════════════════════════════════
// Il tipo di pagina arriva dall'attributo del tag che carica QUESTO file:
//   <script src="config/supabase.js" data-client="app"></script>
//   - "app"      → index.html: sessione persistente, salvata in
//                  localStorage o sessionStorage secondo "Mantieni accesso"
//                  (vedi AUTH_STORAGE_SESSIONE qui sotto).
//   - "admin"    → admin.html: sessione persistente standard (come prima).
//   - "pubblico" → pagine pubbliche anonime (binder-pubblico, scaffali-
//                  pubblico, wishlist, sealed): client "leggero", nessuna
//                  sessione salvata (il login per "Richiedi" vale solo per
//                  la pagina aperta).
// Serve che il CDN di @supabase/supabase-js sia caricato PRIMA di questo
// file (lo è in tutte le pagine).

// ── DOVE VIVE LA SESSIONE ("Mantieni accesso", audit 2026-09-25 A1) ─────
// Spostato qui da data/auth.repository.js perché deve esistere PRIMA che il
// client venga creato. Volutamente AUTONOMO: legge la chiave di
// localStorage 'cardsyncMantieniAccesso' direttamente (la stessa di
// prefMantieniAccessoGet in data/preferences.repository.js, che qui non è
// ancora caricato — Supabase legge la sessione subito dopo la creazione).
//   - "Mantieni accesso" = sì (o mai scelto) → localStorage: la sessione
//     resta tra un'apertura e l'altra del browser.
//   - "Mantieni accesso" = no → sessionStorage: sopravvive a refresh e
//     navigazione nella stessa scheda, sparisce alla chiusura della scheda.
// Ogni scrittura cancella la stessa chiave dall'ALTRO storage, così non
// resta mai una sessione "orfana" quando la preferenza cambia.
function _authStoragePreferito() {
    let scelta = null;
    try { scelta = window.localStorage.getItem('cardsyncMantieniAccesso'); } catch (_) { /* storage non disponibile */ }
    return scelta === 'no' ? window.sessionStorage : window.localStorage;
}
const AUTH_STORAGE_SESSIONE = {
    getItem(chiave) {
        return _authStoragePreferito().getItem(chiave);
    },
    setItem(chiave, valore) {
        const scelto = _authStoragePreferito();
        scelto.setItem(chiave, valore);
        const altro = scelto === window.localStorage ? window.sessionStorage : window.localStorage;
        altro.removeItem(chiave);
    },
    removeItem(chiave) {
        window.localStorage.removeItem(chiave);
        window.sessionStorage.removeItem(chiave);
    },
};

const SUPABASE_TIPO_CLIENT = (document.currentScript && document.currentScript.dataset.client) || '';
const _SUPABASE_OPZIONI_PER_TIPO = {
    app: { auth: { storage: AUTH_STORAGE_SESSIONE } },
    admin: {},
    pubblico: { auth: { persistSession: false, autoRefreshToken: false } },
};
if (!_SUPABASE_OPZIONI_PER_TIPO[SUPABASE_TIPO_CLIENT]) {
    // Errore rumoroso ma non bloccante: si usa il client standard.
    console.error('[config/supabase.js] attributo data-client mancante o sconosciuto ("' + SUPABASE_TIPO_CLIENT + '"): uso le opzioni standard. Valori ammessi: app, admin, pubblico.');
}
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, _SUPABASE_OPZIONI_PER_TIPO[SUPABASE_TIPO_CLIENT] || {});
