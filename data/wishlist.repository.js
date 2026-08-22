// ── data/wishlist.repository.js ──────────────────────────────────────────
// Unica query specifica di wishlist.html.
//
// Dipende da: supabaseClient.

async function wishlistLeggiCondivisa(ownerUserId) {
    return supabaseClient.rpc('leggi_wishlist_condivisa', { p_owner_id: ownerUserId });
}
