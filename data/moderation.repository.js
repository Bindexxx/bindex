// ── data/moderation.repository.js ────────────────────────────────────────
// Tabella pending_requests: richieste in attesa di approvazione admin
// (cambio username, upload foto copertina binder/retro carta). Nel codice
// originale l'insert era duplicato identico in 3 punti diversi di
// index.html — stessa query, stessa forma, consolidata qui.
//
// Dipende da: supabaseClient.

async function creaRichiestaPendente(userId, type, payload) {
    return supabaseClient.from('pending_requests').insert({
        user_id: userId,
        type,
        status: 'pending',
        payload
    });
}
