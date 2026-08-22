// ── data/scambio.repository.js ───────────────────────────────────────────
// Unica query specifica di scambio.html.
//
// Dipende da: supabaseClient.

async function scambioLeggiCondiviso(ownerUserId) {
    return supabaseClient.rpc('leggi_scambio_condiviso', { p_owner_id: ownerUserId });
}
