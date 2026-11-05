// Wishlist dei prodotti sealed: chiamate a Supabase.

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
