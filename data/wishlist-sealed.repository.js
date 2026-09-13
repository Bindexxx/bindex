// ── data/wishlist-sealed.repository.js ────────────────────────────────────
// Fase 6, Step 2 (2026-09-13). CRUD privato su wishlist_sealed (sql/52) —
// mirror ESATTO di data/sealed.repository.js, stessa filosofia (Regola
// d'Oro #1: duplicazione preferita a un'astrazione condivisa rischiosa fra
// due domini che restano concettualmente distinti: una è collezione
// posseduta, l'altra una lista desideri).
//
// Dipende da: supabaseClient.

async function wishlistSealedListMie(userId) {
    return supabaseClient.from('wishlist_sealed').select('*').eq('owner_id', userId).order('created_at', { ascending: false });
}

async function wishlistSealedInsertRighe(righe) {
    return supabaseClient.from('wishlist_sealed').insert(righe).select();
}

async function wishlistSealedUpdate(id, aggiornamento) {
    return supabaseClient.from('wishlist_sealed').update(aggiornamento).eq('id', id);
}

async function wishlistSealedDelete(id) {
    return supabaseClient.from('wishlist_sealed').delete().eq('id', id);
}
