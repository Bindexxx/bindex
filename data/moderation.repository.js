// Richieste da approvare (pending_requests): cambio nome, foto.

async function creaRichiestaPendente(userId, type, payload) {
    return supabaseClient.from('pending_requests').insert({
        user_id: userId,
        type,
        status: 'pending',
        payload
    });
}
