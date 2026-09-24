// ── data/chat.repository.js ────────────────────────────────────────────
// Chat in-app per il widget Match (sql/70_chat_match.sql). Wrapper delle
// RPC transazionali + query di lettura dirette (stesso schema di
// data/richieste-scambio.repository.js). Nessuna scrittura diretta sulle
// tabelle qui — conversazioni/messaggi/blocchi/segnalazioni si scrivono
// SOLO via RPC (RLS le blocca comunque lato client, vedi sql/70).

// ── Lettura ─────────────────────────────────────────────────────────────

// Messaggi di una conversazione, in ordine cronologico. RLS: solo i due
// partecipanti (o un admin, solo se la conversazione è stata segnalata).
async function chatMessaggiList(conversazioneId) {
    return supabaseClient
        .from('messaggi')
        .select('*')
        .eq('conversazione_id', conversazioneId)
        .order('creato_il', { ascending: true });
}

// Conversazioni dell'utente (per un'eventuale inbox/badge non-letti).
// RLS: solo le proprie (auth.uid() in owner_a/owner_b).
async function chatConversazioniList(userId) {
    return supabaseClient
        .from('conversazioni')
        .select('*')
        .or(`owner_a.eq.${userId},owner_b.eq.${userId}`)
        .order('creato_il', { ascending: false });
}

// Chi l'utente ha bloccato (mai chi lo ha bloccato — RLS lo impedisce già,
// vedi blocchi_select: auth.uid() = blocca_id).
async function chatBlocchiSet(userId) {
    return supabaseClient
        .from('blocchi_chat')
        .select('bloccato_id')
        .eq('blocca_id', userId);
}

// Messaggi non letti, in TUTTE le conversazioni dell'utente — due query
// (conversazioni proprie, poi messaggi non letti in quelle), niente RPC:
// la RLS di 'messaggi' già permette ai due partecipanti di vedersi i
// propri non letti, la seconda query passa da sola. Usata per il badge
// (widget-match.ui.js, _aggiornaBadgeChatMatch).
async function chatMessaggiNonLettiList(conversazioneIds, userId) {
    return supabaseClient
        .from('messaggi')
        .select('id, conversazione_id, mittente_id')
        .in('conversazione_id', conversazioneIds)
        .neq('mittente_id', userId)
        .is('letto_il', null);
}

// ── Scrittura (via RPC — mai tabelle dirette, RLS le blocca comunque) ────

async function chatOttieniOCreaConversazione(altroId) {
    return supabaseClient.rpc('ottieni_o_crea_conversazione', { p_altro_id: altroId });
}

async function chatInviaMessaggio(conversazioneId, testo) {
    return supabaseClient.rpc('invia_messaggio', { p_conversazione_id: conversazioneId, p_testo: testo });
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

// ── Nickname (sql/71) ─────────────────────────────────────────────────
// Non in RPC "chat" in senso stretto, ma vive qui perché è nato per
// rimpiazzare l'email-prefix nella lista Match — stesso motivo per cui
// non l'ho messo in un file impostazioni/utenti che non ho mai letto in
// questa sessione (segnalato a Claudio, da valutare se spostarlo).

async function chatImpostaNickname(nickname) {
    return supabaseClient.rpc('imposta_nickname', { p_nickname: nickname });
}

async function chatOttieniNicknames(ownerIds) {
    return supabaseClient.rpc('ottieni_nicknames', { p_owner_ids: ownerIds });
}
