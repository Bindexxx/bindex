// ── data/cards.repository.js ─────────────────────────────────────────────
// Tabelle 'carte' e 'wishlist' — trattate come un unico dominio, esattamente
// come fa già il codice originale tramite il parametro 'tabella'/'isWishlist'
// (stessa struttura di riga, stesse colonne condivise + poche specifiche
// per tabella come 'location' o 'prezzo_obiettivo').
//
// Le funzioni cardsQuery*/wishlistQuery* ritornano il query builder NON
// risolto (nessun await): _selectTuttePagine() ne ha bisogno "vivo" per
// poter chiamare .range() internamente e paginare. Non aggiungere await
// dentro queste funzioni o la paginazione si rompe.
//
// Dipende da: supabaseClient.

// ── Query di lettura (da usare con _selectTuttePagine) ──────────────────
function cardsQueryCollezione(userId) {
    return supabaseClient.from('carte').select('*').eq('owner_id', userId).eq('stato', 'collezione').order('nome');
}
function cardsQueryTutte(userId) {
    return supabaseClient.from('carte').select('*').eq('owner_id', userId);
}
function wishlistQueryOrdinata(userId) {
    return supabaseClient.from('wishlist').select('*').eq('owner_id', userId).order('nome');
}
function wishlistQueryTutte(userId) {
    return supabaseClient.from('wishlist').select('*').eq('owner_id', userId);
}

// ── Scrittura ─────────────────────────────────────────────────────────
async function cardsUpdateRecord(isWishlist, id, aggiornamento) {
    return supabaseClient.from(isWishlist ? 'wishlist' : 'carte').update(aggiornamento).eq('id', id);
}

async function cardsInsertNellaCollezione(record) {
    return supabaseClient.from('carte').insert(record);
}

async function wishlistDelete(id) {
    return supabaseClient.from('wishlist').delete().eq('id', id);
}

async function cardsDeleteById(isWishlist, id) {
    return supabaseClient.from(isWishlist ? 'wishlist' : 'carte').delete().eq('id', id);
}

// Usata sia dalla modifica inline con tendina (location/lingua/condizione)
// sia da modificaCampoInline (nome/codice/qty/prezzo/note) — stessa identica
// query nel codice originale, richiamata da due punti diversi.
async function cardsUpdateCampo(tabella, id, campo, valore) {
    return supabaseClient.from(tabella).update({ [campo]: valore }).eq('id', id);
}

async function cardsDeleteBatch(tabella, ids) {
    return supabaseClient.from(tabella).delete().in('id', ids);
}

async function cardsUpdateLocationBatch(tabella, ids, valore) {
    return supabaseClient.from(tabella).update({ location: valore || null }).in('id', ids);
}

// Sottoscrizione realtime a modifiche su carte/wishlist dell'utente —
// stesso comportamento originale, solo spostata qui per coerenza (è comunque
// un contatto diretto con Supabase, anche se non passa da .from()/.rpc()).
function cardsRealtimeSubscribe(userId, onChange) {
    return supabaseClient
        .channel('carte-realtime-' + userId)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'carte', filter: `owner_id=eq.${userId}` }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'wishlist', filter: `owner_id=eq.${userId}` }, onChange)
        .subscribe();
}
