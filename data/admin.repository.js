// ── data/admin.repository.js ─────────────────────────────────────────────
// Tutte le chiamate a Supabase usate da admin.html: auth, profiles,
// pending_requests, user_media, storage (user-media/immaginivisibili),
// admin_audit_log, activity_log, e le RPC SECURITY DEFINER di
// moderazione/gestione utenti. Un solo file (a differenza di index.html,
// diviso in più repository) perché il volume qui è molto più contenuto.
//
// Dipende da: supabaseClient (creato in admin.html, vedi config/supabase.js).

// ── Auth ──────────────────────────────────────────────────────────────
async function adminAuthLogin(email, password) {
    return supabaseClient.auth.signInWithPassword({ email, password });
}
async function adminAuthLogout() {
    return supabaseClient.auth.signOut();
}
async function adminAuthGetSession() {
    const { data } = await supabaseClient.auth.getSession();
    return data.session || null;
}

// ── Profilo/ruolo ─────────────────────────────────────────────────────
async function adminProfiloRuolo(userId) {
    return supabaseClient.from('profiles').select('role, username, banned_until, deleted_at').eq('id', userId).single();
}

// ── Richieste pendenti (pending_requests) ────────────────────────────
async function adminListaUtentiPerFiltro() {
    return supabaseClient.from('profiles').select('id, username').order('username');
}

async function adminContaRichiestePendenti() {
    return supabaseClient.from('pending_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending').is('deleted_at', null);
}

// Ritorna il query builder NON risolto: il chiamante applica i filtri
// facoltativi (tipo/utente/stato/data) prima di risolvere con await,
// esattamente come faceva il codice originale.
function adminQueryRichieste() {
    return supabaseClient.from('pending_requests').select('*').is('deleted_at', null).order('created_at', { ascending: false });
}

async function adminProfiliPerIds(ids) {
    return supabaseClient.from('profiles').select('id, username').in('id', ids);
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

// ── Copia pubblica foto approvate (bucket immaginivisibili) ──────────
// Multi-Binder (2026-08-25): aggiunto binder_id alla select — prima del
// Multi-Binder c'era un solo binder per utente, quindi il path pubblico
// era per-utente; ora serve sapere DI QUALE binder è la copertina/sleeve,
// altrimenti la copia pubblica del secondo binder approvato sovrascrive
// quella del primo. Vedi _sincronizzaCopiaPubblica in
// ui/admin-requests.ui.js, unico punto che usa questo dato.
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

// ── Utenti / ruoli ────────────────────────────────────────────────────
async function adminListaUtenti() {
    return supabaseClient.from('profiles').select('*').order('created_at', { ascending: true });
}
async function adminCambiaRuolo(userId, nuovoRuolo) {
    return supabaseClient.from('profiles').update({ role: nuovoRuolo }).eq('id', userId);
}
async function adminAggiornaAnagrafica(userId, payload) {
    return supabaseClient.from('profiles').update(payload).eq('id', userId);
}

// ── Log admin ─────────────────────────────────────────────────────────
async function adminLogAudit(limite) {
    return supabaseClient.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(limite);
}
async function adminRegistraAzione(action, target, details) {
    return supabaseClient.rpc('log_admin_action', { p_action: action, p_target: target, p_details: details });
}

// ── Attività utente (log nella modale dettaglio) ─────────────────────
async function adminActivityLog(userId, limite) {
    return supabaseClient.from('activity_log').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limite);
}

// ── Azioni SECURITY DEFINER sull'utente (ban/sblocco/reset/eliminazione) ──
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
