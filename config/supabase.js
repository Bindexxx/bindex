// ── config/supabase.js ───────────────────────────────────────────────────
// Fonte unica di URL e chiave anon Supabase, condivisa da tutte le pagine
// del sito (index, admin, scambio, sealed, wishlist).
//
// Va caricato con <script src="config/supabase.js"></script> DOPO lo script
// del CDN @supabase/supabase-js e PRIMA dello script inline di ciascuna
// pagina, che continua a usare SUPABASE_URL / SUPABASE_ANON_KEY esattamente
// come prima (nessun cambio di comportamento).
//
// NOTA: la creazione del client (supabase.createClient(...)) resta invece
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
// ── PROGETTO DI TEST (Bindexxx / xpfibrzsffurdlypxnrw) ──────────────────
const SUPABASE_URL = 'https://xpfibrzsffurdlypxnrw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwZmlicnpzZmZ1cmRseXB4bnJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczOTU0MzYsImV4cCI6MjEwMjk3MTQzNn0.k5eELxNA3HkWdslxoqIL_IR8qFZ1W0j_IWZugE2GVCg';
