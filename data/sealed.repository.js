// ── data/sealed.repository.js ────────────────────────────────────────────
// Unica query specifica di sealed.html.
//
// Dipende da: supabaseClient.

async function sealedLeggiCondiviso(ownerUserId) {
    return supabaseClient.rpc('leggi_sealed_condiviso', { p_owner_id: ownerUserId });
}
