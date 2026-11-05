// Funzioni pubbliche usate da binder-pubblico.html.

async function binderPubblicoLeggiInfo(binderId) {
    return supabaseClient.rpc('leggi_binder_pubblico_info', { p_binder_id: binderId });
}

async function binderPubblicoLeggiCarte(binderId) {
    return supabaseClient.rpc('leggi_binder_pubblico', { p_binder_id: binderId });
}

async function binderPubblicoLeggiMedia(binderId) {
    return supabaseClient.rpc('leggi_media_binder_pubblico', { p_binder_id: binderId });
}

async function binderPubblicoRegistraApertura(binderId) {
    return supabaseClient.rpc('registra_apertura_binder_pubblico', { p_binder_id: binderId });
}

function binderPubblicoUrlFile(bucket, percorso) {
    const { data } = supabaseClient.storage.from(bucket).getPublicUrl(percorso);
    return data?.publicUrl || null;
}

async function binderPubblicoFotoCarte(cartaIds) {
    return supabaseClient.rpc('leggi_foto_carte', { p_carta_ids: cartaIds });
}
