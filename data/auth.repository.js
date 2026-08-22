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

async function authLogin(email, password) {
    return supabaseClient.auth.signInWithPassword({ email, password });
}

async function authLogout() {
    return supabaseClient.auth.signOut();
}

async function authUpdatePassword(nuovaPassword) {
    return supabaseClient.auth.updateUser({ password: nuovaPassword });
}

async function authRequestPasswordReset(username) {
    return supabaseClient.rpc('request_password_reset', { p_username: username });
}

async function authRequestUsernameChange(userId, nuovoUsername) {
    return creaRichiestaPendente(userId, 'username_change', { nuovo_username: nuovoUsername });
}
