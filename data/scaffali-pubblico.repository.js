// Funzioni pubbliche usate da scaffali-pubblico.html.

async function scaffaliPubblicoLeggiInfo(scaffaleId) {
    return supabaseClient.rpc('leggi_scaffale_pubblico_info', { p_scaffale_id: scaffaleId });
}

async function scaffaliPubblicoLeggiProdotti(scaffaleId) {
    return supabaseClient.rpc('leggi_scaffale_pubblico', { p_scaffale_id: scaffaleId });
}

async function scaffaliPubblicoRegistraApertura(scaffaleId) {
    return supabaseClient.rpc('registra_apertura_scaffale_pubblico', { p_scaffale_id: scaffaleId });
}
