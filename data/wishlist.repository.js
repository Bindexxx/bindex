// ── data/wishlist.repository.js ──────────────────────────────────────────
// Unica query specifica di wishlist.html.
//
// Dipende da: supabaseClient.

async function wishlistLeggiCondivisa(ownerUserId) {
    return supabaseClient.rpc('leggi_wishlist_condivisa', { p_owner_id: ownerUserId });
}

// Fase 6, Step 4 (2026-09-13): sql/53.
async function wishlistSealedLeggiCondivisa(ownerUserId) {
    return supabaseClient.rpc('leggi_wishlist_sealed_condivisa', { p_owner_id: ownerUserId });
}
