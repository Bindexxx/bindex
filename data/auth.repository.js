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
