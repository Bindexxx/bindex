// Login, logout e sessione (supabaseClient.auth): unico punto del sito.

async function authGetSession() {
    const { data } = await supabaseClient.auth.getSession();
    return data.session || null;
}

async function authGetUserId() {
    const sessione = await authGetSession();
    return sessione?.user?.id || null;
}

async function authGetUserVerificato() {
    const { data } = await supabaseClient.auth.getUser();
    return data?.user || null;
}

async function authLogin(email, password) {
    return supabaseClient.auth.signInWithPassword({ email, password });
}

async function authLogout() {
    return supabaseClient.auth.signOut({ scope: 'local' });
}

// Un solo accesso con l'estensione (estensione 5.83, funzione biglietto-accesso): biglietto monouso per
// far entrare l'estensione con una sessione sua; ingresso del sito con il biglietto dell'estensione.
async function authBigliettoPerEstensione() {
    return supabaseClient.functions.invoke('biglietto-accesso', { body: {} });
}

async function authAccediConBiglietto(biglietto, tipo) {
    return supabaseClient.auth.verifyOtp({ token_hash: biglietto, type: tipo === 'email' ? 'email' : 'magiclink' });
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

async function authGetRuolo(userId) {
    return supabaseClient.from('profiles').select('role').eq('id', userId).single();
}

async function coloreCorniceProprioGet(userId) {
    return supabaseClient.from('profiles').select('colore_principale, colore_secondario').eq('id', userId).single();
}

async function coloreCorniceProprioSet(principale, secondario) {
    return supabaseClient.rpc('imposta_colore_cornice', { p_principale: principale, p_secondario: secondario });
}
