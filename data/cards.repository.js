// Tabelle carte e wishlist (stessa struttura di riga): chiamate a Supabase.

function cardsQueryCollezione(userId) {
    return supabaseClient.from('carte').select('*').eq('owner_id', userId).eq('stato', 'collezione').order('nome');
}
function cardsQueryTutte(userId) {
    return supabaseClient.from('carte').select('*').eq('owner_id', userId);
}

async function cardsSelectById(id) {
    return supabaseClient.from('carte').select('*').eq('id', id).single();
}
function wishlistQueryOrdinata(userId) {
    return supabaseClient.from('wishlist').select('*').eq('owner_id', userId).order('nome');
}
function wishlistQueryTutte(userId) {
    return supabaseClient.from('wishlist').select('*').eq('owner_id', userId);
}

async function cardsUpdateRecord(isWishlist, id, aggiornamento) {
    return supabaseClient.from(isWishlist ? 'wishlist' : 'carte').update(aggiornamento).eq('id', id);
}

async function cardsInsertNellaCollezione(record) {
    return supabaseClient.from('carte').insert(record).select();
}

async function wishlistDelete(id) {
    return supabaseClient.from('wishlist').delete().eq('id', id);
}

async function cardsDeleteById(isWishlist, id) {
    return supabaseClient.from(isWishlist ? 'wishlist' : 'carte').delete().eq('id', id);
}

async function cardsUpdateCampo(tabella, id, campo, valore) {
    return supabaseClient.from(tabella).update({ [campo]: valore }).eq('id', id);
}

async function cardsAzzeraEsitoControllo(id) {
    return supabaseClient.from('carte').update({ esito_controllo: null, esito_controllo_il: null }).eq('id', id);
}

async function cardsDeleteBatch(tabella, ids) {
    return supabaseClient.from(tabella).delete().in('id', ids);
}

async function cardsUpdateLocationBatch(tabella, ids, valore) {
    return supabaseClient.from(tabella).update({ location: valore || null }).in('id', ids);
}

function cardsRealtimeSubscribe(userId, onChange) {
    return supabaseClient
        .channel('carte-realtime-' + userId)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'carte', filter: `owner_id=eq.${userId}` }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'wishlist', filter: `owner_id=eq.${userId}` }, onChange)
        .subscribe();
}
