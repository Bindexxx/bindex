// ── data/binder.repository.js ────────────────────────────────────────────
// 'binder_carte' (appartenenza carte al Binder) + 'user_media' (copertina
// Binder e retro carta personalizzato — stessa tabella, due slot diversi:
// 'binder_cover' e 'card_back') + bucket pubblico 'default-assets' (sfondi
// predefiniti curati) + bucket privato 'user-media' (foto caricate
// dall'utente, servite via signed URL).
//
// Molte di queste query erano duplicate identiche tra copertina Binder e
// retro carta (stesso pattern, slot diverso) — consolidate qui, stesso
// identico comportamento.
//
// NOTA: storageDefaultAssetPublicUrl() non è async — getPublicUrl() di
// Supabase è sincrona (costruisce solo l'URL, nessuna chiamata di rete),
// il codice originale infatti non la faceva mai preceduta da await.
//
// Dipende da: supabaseClient.

// ── binder_carte ──────────────────────────────────────────────────────
function binderCarteQuery(userId) {
    return supabaseClient.from('binder_carte').select('carta_id').eq('owner_id', userId);
}

async function binderCarteInsert(righe) {
    return supabaseClient.from('binder_carte').insert(righe);
}

async function binderCarteDeleteOne(userId, cartaId) {
    return supabaseClient.from('binder_carte').delete().eq('owner_id', userId).eq('carta_id', cartaId);
}

async function binderCarteDeleteBatch(userId, cartaIds) {
    return supabaseClient.from('binder_carte').delete().eq('owner_id', userId).in('carta_id', cartaIds);
}

// ── user_media (copertina Binder + retro carta) ──────────────────────────
async function userMediaGet(userId, slot) {
    return supabaseClient.from('user_media').select('*').eq('user_id', userId).eq('slot', slot).maybeSingle();
}

// Usata dagli upload (legge la riga appena scritta, serve l'id per
// collegare la richiesta di moderazione).
async function userMediaUpsertELeggi(payload) {
    return supabaseClient.from('user_media').upsert(payload, { onConflict: 'user_id,slot' }).select().single();
}

// Usata dalla selezione di un default dalla galleria: il codice originale
// non leggeva la riga risultante qui, quindi niente .select().single().
async function userMediaUpsert(payload) {
    return supabaseClient.from('user_media').upsert(payload, { onConflict: 'user_id,slot' });
}

async function userMediaUpdateMetadata(userId, slot, metadata) {
    return supabaseClient.from('user_media').update({ metadata }).eq('user_id', userId).eq('slot', slot);
}

// ── Storage: bucket privato 'user-media' ──────────────────────────────
async function storageUploadUserMedia(path, blob) {
    return supabaseClient.storage.from('user-media').upload(path, blob, { upsert: true, contentType: 'image/png' });
}

async function storageSignedUrlUserMedia(path) {
    return supabaseClient.storage.from('user-media').createSignedUrl(path, 3600);
}

// ── Storage: bucket pubblico 'default-assets' ────────────────────────
function storageDefaultAssetPublicUrl(path) {
    return supabaseClient.storage.from('default-assets').getPublicUrl(path);
}

async function storageListDefaultAssets(prefix) {
    return supabaseClient.storage.from('default-assets').list(prefix);
}
