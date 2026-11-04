// Chat del widget Match: RPC e letture (nessuna scrittura diretta sulle tabelle).

async function chatMessaggiList(conversazioneId) {
    return supabaseClient
        .from('messaggi')
        .select('*')
        .eq('conversazione_id', conversazioneId)
        .order('creato_il', { ascending: true });
}

async function chatConversazioniList(userId) {
    return supabaseClient
        .from('conversazioni')
        .select('*')
        .or(`owner_a.eq.${userId},owner_b.eq.${userId}`)
        .order('creato_il', { ascending: false });
}

async function chatBlocchiSet(userId) {
    return supabaseClient
        .from('blocchi_chat')
        .select('bloccato_id')
        .eq('blocca_id', userId);
}

async function chatMessaggiNonLettiList(conversazioneIds, userId) {
    return supabaseClient
        .from('messaggi')
        .select('id, conversazione_id, mittente_id, creato_il')
        .in('conversazione_id', conversazioneIds)
        .neq('mittente_id', userId)
        .is('letto_il', null);
}

async function chatUltimiMessaggiPerConversazioni(conversazioneIds) {
    return supabaseClient
        .from('messaggi')
        .select('id, conversazione_id, mittente_id, testo, creato_il')
        .in('conversazione_id', conversazioneIds)
        .order('creato_il', { ascending: false });
}

async function chatOttieniOCreaConversazione(altroId) {
    return supabaseClient.rpc('ottieni_o_crea_conversazione', { p_altro_id: altroId });
}

async function chatInviaMessaggio(conversazioneId, testo, richiestaId = null) {
    const args = { p_conversazione_id: conversazioneId, p_testo: testo };
    if (richiestaId) args.p_richiesta_id = richiestaId;
    return supabaseClient.rpc('invia_messaggio', args);
}

async function chatSegnaLetti(conversazioneId) {
    return supabaseClient.rpc('segna_letti_conversazione', { p_conversazione_id: conversazioneId });
}

async function chatBloccaUtente(bloccatoId) {
    return supabaseClient.rpc('blocca_utente', { p_bloccato_id: bloccatoId });
}

async function chatSbloccaUtente(bloccatoId) {
    return supabaseClient.rpc('sblocca_utente', { p_bloccato_id: bloccatoId });
}

async function chatSegnalaConversazione(conversazioneId, motivo) {
    return supabaseClient.rpc('segnala_conversazione', { p_conversazione_id: conversazioneId, p_motivo: motivo });
}

async function chatImpostaNickname(nickname) {
    return supabaseClient.rpc('imposta_nickname', { p_nickname: nickname });
}

async function chatOttieniNicknames(ownerIds) {
    return supabaseClient.rpc('ottieni_nicknames', { p_owner_ids: ownerIds });
}

async function chatRestrizioneUtente(userId) {
    return supabaseClient.from('chat_restrizioni_utente').select('minorenne').eq('owner_id', userId).maybeSingle();
}
