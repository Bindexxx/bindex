// URL e chiave anon di Supabase per tutte le pagine del sito; crea supabaseClient.

const SUPABASE_URL = 'https://xpfibrzsffurdlypxnrw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwZmlicnpzZmZ1cmRseXB4bnJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczOTU0MzYsImV4cCI6MjEwMjk3MTQzNn0.k5eELxNA3HkWdslxoqIL_IR8qFZ1W0j_IWZugE2GVCg';

function _authStoragePreferito() {
    let scelta = null;
    try { scelta = window.localStorage.getItem('cardsyncMantieniAccesso'); } catch (_) {   }
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
    console.error('[config/supabase.js] attributo data-client mancante o sconosciuto ("' + SUPABASE_TIPO_CLIENT + '"): uso le opzioni standard. Valori ammessi: app, admin, pubblico.');
}
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, _SUPABASE_OPZIONI_PER_TIPO[SUPABASE_TIPO_CLIENT] || {});
