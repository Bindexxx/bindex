// Chiamate a Supabase della pagina admin: utenti, richieste, media, registro, moderazione.

async function adminAuthLogin(email, password) {
    return supabaseClient.auth.signInWithPassword({ email, password });
}
async function adminAuthLogout() {
    return supabaseClient.auth.signOut({ scope: 'local' });
}
async function adminAuthGetSession() {
    const { data } = await supabaseClient.auth.getSession();
    return data.session || null;
}

async function adminMfaLivello() {
    return supabaseClient.auth.mfa.getAuthenticatorAssuranceLevel();
}
async function adminMfaFattori() {
    return supabaseClient.auth.mfa.listFactors();
}
async function adminMfaIscrivi(nome) {
    return supabaseClient.auth.mfa.enroll({ factorType: 'totp', friendlyName: nome });
}
async function adminMfaVerifica(factorId, codice) {
    return supabaseClient.auth.mfa.challengeAndVerify({ factorId, code: codice });
}
async function adminMfaTogli(factorId) {
    return supabaseClient.auth.mfa.unenroll({ factorId });
}

async function adminProfiloRuolo(userId) {
    return supabaseClient.from('profiles').select('role, username, banned_until, deleted_at').eq('id', userId).single();
}

async function adminListaUtentiPerFiltro() {
    return supabaseClient.from('profiles').select('id, username').order('username');
}

async function adminContaRichiestePendenti() {
    return supabaseClient.from('pending_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending').is('deleted_at', null);
}

function adminQueryRichieste() {
    return supabaseClient.from('pending_requests').select('*').is('deleted_at', null).order('created_at', { ascending: false });
}

async function adminProfiliPerIds(ids) {
    return supabaseClient.from('profiles').select('id, username').in('id', ids);
}

async function adminContestoRichiesta(requestId) {
    return supabaseClient.rpc('admin_contesto_richiesta', { p_request_id: requestId });
}

async function adminUserMediaPerIds(ids) {
    return supabaseClient.from('user_media').select('id, storage_path, slot').in('id', ids);
}

async function adminProcessaRichiesta(requestId, decisione, payload) {
    return supabaseClient.rpc('admin_process_pending_request', {
        p_request_id: requestId,
        p_decisione: decisione,
        p_payload: payload,
    });
}

async function adminArchiviaRichieste(ids) {
    return supabaseClient.from('pending_requests').update({ deleted_at: new Date().toISOString() }).in('id', ids);
}

function adminQueryLogAdminEsportazione() {
    return supabaseClient.from('admin_audit_log').select('*').order('created_at', { ascending: false });
}

async function adminMediaStoragePath(mediaId) {
    return supabaseClient.from('user_media').select('storage_path, binder_id').eq('id', mediaId).single();
}
async function adminSignedUrlUserMedia(storagePath, scadenzaSecondi) {
    return supabaseClient.storage.from('user-media').createSignedUrl(storagePath, scadenzaSecondi);
}
async function adminUploadImmaginiVisibili(path, blob) {
    return supabaseClient.storage.from('immaginivisibili').upload(path, blob, { upsert: true, contentType: 'image/png' });
}
async function adminMediaApprovatiDaSincronizzare() {
    return supabaseClient
        .from('user_media')
        .select('id, user_id, slot, binder_id')
        .eq('status', 'approved')
        .eq('source', 'upload')
        .in('slot', ['card_back', 'binder_cover']);
}

async function adminListaUtenti() {
    return supabaseClient.from('profiles').select('*').order('created_at', { ascending: true });
}
async function adminCambiaRuolo(userId, nuovoRuolo) {
    return supabaseClient.from('profiles').update({ role: nuovoRuolo }).eq('id', userId);
}
async function adminAggiornaAnagrafica(userId, payload) {
    return supabaseClient.from('profiles').update(payload).eq('id', userId);
}

async function adminLogAudit(limite) {
    return supabaseClient.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(limite);
}
async function adminRegistraAzione(action, target, details) {
    return supabaseClient.rpc('log_admin_action', { p_action: action, p_target: target, p_details: details });
}

async function adminActivityLog(userId, limite) {
    return supabaseClient.from('activity_log').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limite);
}

async function adminBanUtente(userId, until, reason) {
    return supabaseClient.rpc('admin_ban_user', { p_target: userId, p_until: until, p_reason: reason });
}
async function adminSbannaUtente(userId) {
    return supabaseClient.rpc('admin_unban_user', { p_target: userId });
}
async function adminRevocaSessioni(userId) {
    return supabaseClient.rpc('admin_revoke_sessions', { p_target: userId });
}
async function adminSoftDeleteUtente(userId) {
    return supabaseClient.rpc('admin_soft_delete_user', { p_target: userId });
}
async function adminRipristinaUtente(userId) {
    return supabaseClient.rpc('admin_restore_user', { p_target: userId });
}
async function adminResetPassword(userId, nuovaPassword) {
    return supabaseClient.rpc('admin_reset_password', { p_target: userId, p_new_password: nuovaPassword });
}
async function adminHardDeleteUtente(userId) {
    return supabaseClient.rpc('admin_hard_delete_user', { p_target: userId });
}

async function adminChatRestrizioneGet(userId) {
    return supabaseClient.from('chat_restrizioni_utente').select('minorenne').eq('owner_id', userId).maybeSingle();
}
async function adminChatImpostaMinorenne(userId, minorenne) {
    return supabaseClient.from('chat_restrizioni_utente').upsert({ owner_id: userId, minorenne }, { onConflict: 'owner_id' });
}
