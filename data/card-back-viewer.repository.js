// ── data/card-back-viewer.repository.js ──────────────────────────────────
// Chiamate Supabase usate da ui/card-back-viewer.ui.js — condiviso tra
// scambio.html e wishlist.html.
//
// Dipende da: supabaseClient.

// Fix 26/08/2026 (24_card_back_binder_id.sql): con Multi-Binder ogni binder
// ha la propria sleeve — serve sempre anche binderId, non solo ownerUserId,
// altrimenti la RPC non saprebbe quale sleeve tra le tante dell'owner
// restituire.
async function cardBackViewerLeggiApprovata(ownerUserId, binderId) {
    const { data: righe } = await supabaseClient.rpc('leggi_card_back_approvata', { p_owner_id: ownerUserId, p_binder_id: binderId });
    return righe && righe.length ? righe[0] : null;
}

// Fix 26/08/2026 (24_card_back_binder_id.sql): risolve owner+tipo binder
// (+ location_valore per i binder 'location') al binder_id corrispondente.
// Usata da scambio.ui.js/wishlist.ui.js per sapere di quale binder
// chiedere la sleeve, dato che sono pagine pubbliche senza sessione.
async function cardBackViewerLeggiBinderIdOwner(ownerUserId, tipo, locationValore) {
    try {
        const { data, error } = await supabaseClient.rpc('leggi_binder_id_owner', {
            p_owner_id: ownerUserId,
            p_tipo: tipo,
            p_location_valore: locationValore || null
        });
        if (error) { console.error('cardBackViewerLeggiBinderIdOwner:', error); return null; }
        return data || null;
    } catch (e) {
        console.error('cardBackViewerLeggiBinderIdOwner:', e);
        return null;
    }
}

function cardBackViewerDefaultPublicUrl(path) {
    const { data: pub } = supabaseClient.storage.from('default-assets').getPublicUrl(path);
    return pub?.publicUrl || null;
}

function cardBackViewerImmaginiVisibiliPublicUrl(path) {
    const { data: pub } = supabaseClient.storage.from('immaginivisibili').getPublicUrl(path);
    return pub?.publicUrl || null;
}
