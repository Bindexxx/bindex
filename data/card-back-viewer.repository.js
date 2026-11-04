// Retro carta personalizzato nelle pagine pubbliche: chiamate a Supabase.

async function cardBackViewerLeggiApprovata(ownerUserId, binderId) {
    const { data: righe } = await supabaseClient.rpc('leggi_card_back_approvata', { p_owner_id: ownerUserId, p_binder_id: binderId });
    return righe && righe.length ? righe[0] : null;
}

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
