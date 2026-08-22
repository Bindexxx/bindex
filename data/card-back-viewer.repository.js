// ── data/card-back-viewer.repository.js ──────────────────────────────────
// Chiamate Supabase usate da ui/card-back-viewer.ui.js — condiviso tra
// scambio.html e wishlist.html.
//
// Dipende da: supabaseClient.

async function cardBackViewerLeggiApprovata(ownerUserId) {
    const { data: righe } = await supabaseClient.rpc('leggi_card_back_approvata', { p_owner_id: ownerUserId });
    return righe && righe.length ? righe[0] : null;
}

function cardBackViewerDefaultPublicUrl(path) {
    const { data: pub } = supabaseClient.storage.from('default-assets').getPublicUrl(path);
    return pub?.publicUrl || null;
}

function cardBackViewerImmaginiVisibiliPublicUrl(path) {
    const { data: pub } = supabaseClient.storage.from('immaginivisibili').getPublicUrl(path);
    return pub?.publicUrl || null;
}
