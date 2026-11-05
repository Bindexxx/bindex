// Query della pagina pubblica wishlist.html.

async function wishlistLeggiCondivisa(ownerUserId) {
    return supabaseClient.rpc('leggi_wishlist_condivisa', { p_owner_id: ownerUserId });
}

async function wishlistSealedLeggiCondivisa(ownerUserId) {
    return supabaseClient.rpc('leggi_wishlist_sealed_condivisa', { p_owner_id: ownerUserId });
}
