// ── data/auth.repository.js ──────────────────────────────────────────────
// Unico punto di contatto con supabaseClient.auth.* — nessun cambio di
// comportamento rispetto al codice originale, solo consolidamento: il
// pattern "getSession() poi leggi session.user.id" era ripetuto identico
// in 34 punti diversi di index.html.
//
// Dipende da: supabaseClient (creato in index.html, vedi config/supabase.js).
// Va caricato PRIMA del resto della logica applicativa che lo usa.

// Ritorna l'oggetto sessione Supabase corrente, o null se non loggato.
async function authGetSession() {
    const { data } = await supabaseClient.auth.getSession();
    return data.session || null;
}

// Scorciatoia usata ovunque serva solo l'id utente (34 punti nel codice
// originale facevano getSession() + sessionData?.session?.user?.id).
async function authGetUserId() {
    const sessione = await authGetSession();
    return sessione?.user?.id || null;
}

// Utente VERIFICATO col server (getUser fa una richiesta di rete, a
// differenza di authGetSession che legge la sessione salvata). Spostata
// qui da ui/paginainiziale-polling-avvio.ui.js (audit 2026-09-25, B8).
async function authGetUserVerificato() {
    const { data } = await supabaseClient.auth.getUser();
    return data?.user || null;
}

async function authLogin(email, password) {
    return supabaseClient.auth.signInWithPassword({ email, password });
}

// FIX logout (audit 2026-09-25, punto A1 — decisione Claudio: "solo questo
// dispositivo"). signOut() senza opzioni in supabase-js v2 ha scope
// 'global': revocava la sessione su TUTTI i dispositivi dell'utente (uscire
// dal PC faceva uscire anche dal telefono). 'local' chiude solo la sessione
// di questo browser.
async function authLogout() {
    return supabaseClient.auth.signOut({ scope: 'local' });
}

// ── DOVE VIVE LA SESSIONE ("Mantieni accesso", audit 2026-09-25 A1) ─────
// Adattatore di storage passato a supabase.createClient() in index.html
// (opzione auth.storage). Sostituisce il vecchio logout su 'beforeunload'
// in ui/auth.ui.js, che scattava anche al REFRESH e aprendo una pagina
// pubblica nella stessa scheda, e che essendo asincrono durante lo
// scaricamento della pagina poteva completarsi o no a caso.
//   - "Mantieni accesso" = sì (o mai scelto) → localStorage, come sempre:
//     la sessione resta tra un'apertura e l'altra del browser.
//   - "Mantieni accesso" = no → sessionStorage: la sessione sopravvive a
//     refresh e navigazione nella stessa scheda, e sparisce da sola quando
//     si chiude la scheda/il browser. Nessun evento di chiusura necessario.
// Ogni scrittura cancella la stessa chiave dall'ALTRO storage, così non
// resta mai una sessione "orfana" nel posto sbagliato quando la
// preferenza cambia al login successivo. Solo lato client: nessun effetto
// su server, RLS o policy.
// prefMantieniAccessoGet() vive in data/preferences.repository.js (caricato
// dopo questo file): viene letta solo al momento della chiamata, quando
// tutti gli script sono già caricati.
function _authStoragePreferito() {
    return prefMantieniAccessoGet() === 'no' ? window.sessionStorage : window.localStorage;
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

async function authUpdatePassword(nuovaPassword) {
    return supabaseClient.auth.updateUser({ password: nuovaPassword });
}

async function authRequestPasswordReset(username) {
    return supabaseClient.rpc('request_password_reset', { p_username: username });
}

async function authRequestUsernameChange(userId, nuovoUsername) {
    return creaRichiestaPendente(userId, 'username_change', { nuovo_username: nuovoUsername });
}

// Aggiunta 2026-09-07: prima funzione del sito che legge profiles.role.
// Usata per ora solo dal blocco diagnostico "Test Bustina (admin)" in
// index.html (#bustinaTestAdminGroup) — nessun altro punto del sito
// controllava il ruolo lato client prima d'ora (verificato: zero
// occorrenze di 'profiles'/'role' in index.html). Se in futuro serve
// altrove, riusare questa, non duplicarla.
async function authGetRuolo(userId) {
    return supabaseClient.from('profiles').select('role').eq('id', userId).single();
}

// ── COLORE CORNICE (STEP 6 restyle "cornice Pokédex", 2026-09-17) ───────
// Lettura DIRETTA (non RPC): la RLS di profiles permette già a un utente
// di leggere la PROPRIA riga (policy "utente vede il proprio profilo"),
// quindi non serve una funzione server-side solo per questo — a
// differenza della scrittura, dove RLS blocca l'UPDATE diretto (solo
// admin), da lì la RPC imposta_colore_cornice (vedi sql/63).
async function coloreCorniceProprioGet(userId) {
    return supabaseClient.from('profiles').select('colore_principale, colore_secondario').eq('id', userId).single();
}

async function coloreCorniceProprioSet(principale, secondario) {
    return supabaseClient.rpc('imposta_colore_cornice', { p_principale: principale, p_secondario: secondario });
}
