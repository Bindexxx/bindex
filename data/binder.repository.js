// ── data/binder.repository.js ────────────────────────────────────────────
// Multi-Binder (sessione 2026-08-24/25, vedi 17_binders_multipli.sql per lo
// schema). TUTTE le chiamate Supabase relative a Binder vivono qui, zero
// eccezioni — pattern del progetto.
//
// Rispetto alla versione precedente (un Binder singolo per utente):
// - binderCarteInsert/DeleteOne/DeleteBatch ora si aspettano righe che
//   includono binder_id (usate SOLO dal binder tipo 'extra' — i
//   binder-location non passano mai da binder_carte, si leggono in tempo
//   reale da carte.location, vedi binderLocationLeggiCarte sotto).
// - userMediaGet/Upsert* ora richiedono SEMPRE binder_id esplicito (prima
//   erano un unico slot per utente, ora un slot per utente+binder — stesso
//   vincolo (user_id, binder_id, slot) creato in 17_binders_multipli.sql).
//   binder_id può essere null SOLO per compatibilità con vecchie righe
//   orfane pre-migrazione: nessun codice nuovo deve mai chiamarle con null.
//
// Dipende da: supabaseClient.

// ── binders (nuova tabella) ──────────────────────────────────────────────

// Tutti i binder dell'utente, di qualunque tipo — usata per popolare il
// widget "Binders" (griglia dei contenitori).
function bindersQueryTutti(userId) {
    return supabaseClient.from('binders').select('*').eq('owner_id', userId).order('tipo').order('nome');
}

// Materializza (o ritorna se già esiste) il binder-location per un valore
// di carte.location — chiamata on-demand, es. subito dopo aver letto i
// valori distinti di location dell'utente. Upsert idempotente: il vincolo
// unico binders_owner_tipo_location_uniq regge qui perché location_valore
// non è mai null per tipo='location' (vedi commento in
// 17_binders_multipli.sql sul perché NON regge per wishlist/extra).
// nome di default = lo stesso valore della location; personalizzabile in
// futuro, non ancora esposto in UI.
async function binderLocationMaterializza(userId, locationValore) {
    // Upsert "normale" (DO UPDATE, non ignoreDuplicates/DO NOTHING): su
    // conflitto riscrive lo stesso nome, innocuo, ma soprattutto la riga
    // torna SEMPRE nella RETURNING — con DO NOTHING invece il caso più
    // comune (binder già esistente) non restituirebbe nulla e .single()
    // fallirebbe.
    return supabaseClient
        .from('binders')
        .upsert(
            { owner_id: userId, tipo: 'location', location_valore: locationValore, nome: locationValore },
            { onConflict: 'owner_id,tipo,location_valore' }
        )
        .select()
        .single();
}

// Come binderLocationMaterializza ma per TUTTE le location in un colpo
// solo — usata all'apertura del widget Binders per evitare N round-trip
// (una per ogni valore di data/locations.repository.js:locationsList).
async function binderLocationMaterializzaBatch(userId, nomiLocation) {
    if (!nomiLocation || nomiLocation.length === 0) return { data: [], error: null };
    const righe = nomiLocation.map(nome => ({ owner_id: userId, tipo: 'location', location_valore: nome, nome }));
    return supabaseClient
        .from('binders')
        .upsert(righe, { onConflict: 'owner_id,tipo,location_valore' })
        .select();
}

// Il binder wishlist è unico per utente ma il vincolo DB NON lo garantisce
// (location_valore è null per questo tipo, NULL <> NULL in un vincolo
// unique standard — vedi nota nel file SQL). Deduplica quindi qui, lato
// applicazione: SELECT prima di INSERT, mai upsert diretto.
async function binderWishlistGarantisci(userId) {
    const { data: esistente, error: errSelect } = await supabaseClient
        .from('binders').select('*').eq('owner_id', userId).eq('tipo', 'wishlist').maybeSingle();
    if (errSelect) return { data: null, error: errSelect };
    if (esistente) return { data: esistente, error: null };

    return supabaseClient
        .from('binders')
        .insert({ owner_id: userId, tipo: 'wishlist', nome: 'Wishlist' })
        .select()
        .single();
}

// Stesso discorso del binder extra: oggi ne creiamo uno solo per utente,
// ma è una scelta applicativa (vedi Da fare per multi-binder extra futuri),
// non un vincolo DB — stessa deduplica SELECT-poi-INSERT del wishlist.
async function binderExtraGarantisci(userId, nomeDefault) {
    const { data: esistente, error: errSelect } = await supabaseClient
        .from('binders').select('*').eq('owner_id', userId).eq('tipo', 'extra').limit(1).maybeSingle();
    if (errSelect) return { data: null, error: errSelect };
    if (esistente) return { data: esistente, error: null };

    return supabaseClient
        .from('binders')
        .insert({ owner_id: userId, tipo: 'extra', nome: nomeDefault || 'Il mio binder' })
        .select()
        .single();
}

// Rinomina — solo i binder tipo 'extra' sono rinominabili (per gli altri
// tipi il trigger DB non blocca il nome, ma la UI non deve mai offrire
// questa azione su location/wishlist: sarebbe fuorviante, il nome di un
// binder-location deve restare agganciato al valore reale di location).
async function binderExtraRinomina(userId, binderId, nuovoNome) {
    return supabaseClient
        .from('binders')
        .update({ nome: nuovoNome })
        .eq('id', binderId)
        .eq('owner_id', userId)
        .eq('tipo', 'extra');
}

// Carte di un binder-location: lettura diretta da 'carte', NON da
// binder_carte — i binder-location non hanno righe di appartenenza, sono
// sempre lo specchio in tempo reale di carte.location. Stessa colonna
// 'stato' già filtrata altrove nel sito (solo 'collezione').
function binderLocationQueryCarte(userId, locationValore) {
    return supabaseClient.from('carte').select('*').eq('owner_id', userId).eq('location', locationValore).eq('stato', 'collezione').order('nome');
}

// ── binder_carte (solo per binder tipo 'extra') ──────────────────────────
// Le righe qui sotto devono sempre includere binder_id quando riferite al
// nuovo sistema — { owner_id, carta_id, binder_id }.
function binderCarteQuery(userId, binderId) {
    return supabaseClient.from('binder_carte').select('carta_id').eq('owner_id', userId).eq('binder_id', binderId);
}

async function binderCarteInsert(righe) {
    return supabaseClient.from('binder_carte').insert(righe);
}

async function binderCarteDeleteOne(userId, binderId, cartaId) {
    return supabaseClient.from('binder_carte').delete().eq('owner_id', userId).eq('binder_id', binderId).eq('carta_id', cartaId);
}

async function binderCarteDeleteBatch(userId, binderId, cartaIds) {
    return supabaseClient.from('binder_carte').delete().eq('owner_id', userId).eq('binder_id', binderId).in('carta_id', cartaIds);
}

// ── user_media (copertina Binder + retro carta, ora per-binder) ─────────
async function userMediaGet(userId, binderId, slot) {
    return supabaseClient.from('user_media').select('*').eq('user_id', userId).eq('binder_id', binderId).eq('slot', slot).maybeSingle();
}

// Usata dagli upload (legge la riga appena scritta, serve l'id per
// collegare la richiesta di moderazione).
async function userMediaUpsertELeggi(payload) {
    return supabaseClient.from('user_media').upsert(payload, { onConflict: 'user_id,binder_id,slot' }).select().single();
}

// Usata dalla selezione di un default dalla galleria: il codice originale
// non leggeva la riga risultante qui, quindi niente .select().single().
async function userMediaUpsert(payload) {
    return supabaseClient.from('user_media').upsert(payload, { onConflict: 'user_id,binder_id,slot' });
}

async function userMediaUpdateMetadata(userId, binderId, slot, metadata) {
    return supabaseClient.from('user_media').update({ metadata }).eq('user_id', userId).eq('binder_id', binderId).eq('slot', slot);
}

// ── Storage: bucket privato 'user-media' ──────────────────────────────
// invariate, il path (che ora deve includere binderId per restare univoco
// per binder, es. `${userId}/${binderId}/binder_cover`) si costruisce nella
// UI come già faceva prima — nessuna logica di path qui.
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

// ── RPC pubbliche (nuove, vedi 17_binders_multipli.sql) ──────────────────
// Lettura carte di un binder-location pubblico (oggi in pratica solo
// 'SCAMBIO', vedi trigger DB) da parte di un visitatore anonimo.
async function bindersLeggiPubblico(ownerUserId, locationValore) {
    return supabaseClient.rpc('leggi_binder_pubblico', { p_owner_id: ownerUserId, p_location_valore: locationValore });
}

// Copertina/sleeve approvate di un binder pubblico — unico varco pubblico
// verso user_media, mai una lettura diretta della tabella da anonimo.
async function bindersLeggiMediaPubblico(binderId) {
    return supabaseClient.rpc('leggi_media_binder_pubblico', { p_binder_id: binderId });
}
