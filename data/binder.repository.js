// Binder: tutte le chiamate a Supabase.

function bindersQueryTutti(userId) {
    return supabaseClient.from('binders').select('*').eq('owner_id', userId).order('tipo').order('nome');
}

async function binderLocationMaterializza(userId, locationValore) {
    return supabaseClient
        .from('binders')
        .upsert(
            { owner_id: userId, tipo: 'location', location_valore: locationValore, nome: locationValore },
            { onConflict: 'owner_id,tipo,location_valore' }
        )
        .select()
        .single();
}

async function binderLocationMaterializzaBatch(userId, nomiLocation) {
    if (!nomiLocation || nomiLocation.length === 0) return { data: [], error: null };
    const righe = nomiLocation.map(nome => ({ owner_id: userId, tipo: 'location', location_valore: nome, nome }));
    return supabaseClient
        .from('binders')
        .upsert(righe, { onConflict: 'owner_id,tipo,location_valore', ignoreDuplicates: true })
        .select();
}

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

async function binderScambioGarantisci(userId) {
    const { data: esistente, error: errSelect } = await supabaseClient
        .from('binders').select('*').eq('owner_id', userId).eq('tipo', 'scambio').maybeSingle();
    if (errSelect) return { data: null, error: errSelect };
    if (esistente) return { data: esistente, error: null };

    return supabaseClient
        .from('binders')
        .insert({ owner_id: userId, tipo: 'scambio', nome: 'Scambio' })
        .select()
        .single();
}

async function binderCarteImpostaQuantitaScambio(userId, binderId, cartaId, quantita) {
    return supabaseClient.from('binder_carte')
        .upsert({ owner_id: userId, binder_id: binderId, carta_id: cartaId, quantita_offerta: quantita }, { onConflict: 'owner_id,binder_id,carta_id' });
}

async function binderExtraRinomina(userId, binderId, nuovoNome) {
    return supabaseClient
        .from('binders')
        .update({ nome: nuovoNome })
        .eq('id', binderId)
        .eq('owner_id', userId)
        .eq('tipo', 'extra');
}

async function binderImpostaPubblicazione(userId, binderId, pubblico) {
    return supabaseClient
        .from('binders')
        .update({ stato_pubblicazione: pubblico ? 'pubblico' : 'privato', condivisibile: pubblico })
        .eq('id', binderId)
        .eq('owner_id', userId);
}

async function binderProponiNome(userId, binderId, nomeProposto) {
    return supabaseClient
        .from('binders')
        .update({ nome_proposto: nomeProposto, nome_stato: 'pending', nome_admin_note: null })
        .eq('id', binderId)
        .eq('owner_id', userId);
}

async function binderCarteImpostaQuantitaScambioBatch(userId, binderId, righe) {
    return supabaseClient.from('binder_carte')
        .upsert(righe.map(r => ({ owner_id: userId, binder_id: binderId, carta_id: r.cartaId, quantita_offerta: r.quantita })), { onConflict: 'owner_id,binder_id,carta_id' });
}

function binderLocationQueryCarte(userId, locationValore) {
    return supabaseClient.from('carte').select('*').eq('owner_id', userId).eq('location', locationValore).eq('stato', 'collezione').order('nome');
}

async function binderAggiornaLayout(userId, binderId, layout) {
    return supabaseClient
        .from('binders')
        .update({ layout })
        .eq('id', binderId)
        .eq('owner_id', userId);
}

async function binderImpostaColore(userId, binderId, colore) {
    return supabaseClient
        .from('binders')
        .update({ colore: colore || null })
        .eq('id', binderId)
        .eq('owner_id', userId);
}

async function binderImpostaEscludiValore(userId, binderId, escludi) {
    return supabaseClient
        .from('binders')
        .update({ escludi_valore_collezione: !!escludi })
        .eq('id', binderId)
        .eq('owner_id', userId);
}

function binderCarteQueryTutteAppartenenze(userId) {
    return supabaseClient.from('binder_carte').select('binder_id, carta_id').eq('owner_id', userId);
}

function binderCarteQuery(userId, binderId) {
    return supabaseClient.from('binder_carte').select('carta_id').eq('owner_id', userId).eq('binder_id', binderId);
}

function binderCarteQueryConQuantita(userId, binderId) {
    return supabaseClient.from('binder_carte').select('carta_id, quantita_offerta').eq('owner_id', userId).eq('binder_id', binderId);
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

async function userMediaGet(userId, binderId, slot) {
    return supabaseClient.from('user_media').select('*').eq('user_id', userId).eq('binder_id', binderId).eq('slot', slot).maybeSingle();
}

async function userMediaUpsertELeggi(payload) {
    return supabaseClient.from('user_media').upsert(payload, { onConflict: 'user_id,binder_id,slot' }).select().single();
}

async function userMediaUpsert(payload) {
    return supabaseClient.from('user_media').upsert(payload, { onConflict: 'user_id,binder_id,slot' });
}

async function userMediaUpdateMetadata(userId, binderId, slot, metadata) {
    return supabaseClient.from('user_media').update({ metadata }).eq('user_id', userId).eq('binder_id', binderId).eq('slot', slot);
}

async function storageUploadUserMedia(path, blob) {
    return supabaseClient.storage.from('user-media').upload(path, blob, { upsert: true, contentType: 'image/png' });
}

async function storageSignedUrlUserMedia(path) {
    return supabaseClient.storage.from('user-media').createSignedUrl(path, 3600);
}

function storageDefaultAssetPublicUrl(path) {
    return supabaseClient.storage.from('default-assets').getPublicUrl(path);
}

async function storageListDefaultAssets(prefix) {
    return supabaseClient.storage.from('default-assets').list(prefix);
}

async function fotoProfiloMia(userId) {
    return supabaseClient.from('user_media').select('*')
        .eq('user_id', userId).eq('slot', 'profilo').is('binder_id', null).is('scaffale_id', null).maybeSingle();
}
async function fotoProfiloInserisci(payload) {
    return supabaseClient.from('user_media').insert(payload).select().single();
}
async function fotoProfiloAggiorna(id, payload) {
    return supabaseClient.from('user_media').update(payload).eq('id', id).select().single();
}
async function fotoProfiloUpload(path, blob) {
    return supabaseClient.storage.from('user-media').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
}
async function fotoProfiloRimuoviFile(path) {
    return supabaseClient.storage.from('user-media').remove([path]);
}
async function fotoProfiloLeggiAltri(userIds) {
    return supabaseClient.rpc('leggi_foto_profilo', { p_user_ids: userIds });
}
async function fotoProfiloUrlFirmati(paths) {
    return supabaseClient.storage.from('user-media').createSignedUrls(paths, 3600);
}
