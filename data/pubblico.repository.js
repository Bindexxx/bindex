// Chiamate a Supabase di utils/shared-public.js (pagine pubbliche).

async function pubblicoSessioneUtente() {
    const { data } = await supabaseClient.auth.getSession();
    return data?.session?.user || null;
}

async function pubblicoLogin(email, password) {
    return supabaseClient.auth.signInWithPassword({ email, password });
}

async function pubblicoInviaRichiestaScambio(proprietarioId, righe) {
    return supabaseClient.rpc('invia_richiesta_scambio', { p_proprietario_id: proprietarioId, p_righe: righe });
}

async function pubblicoScaffaleScambioDaOwner(ownerId) {
    return supabaseClient.rpc('leggi_scaffale_scambio_pubblico', { p_owner_id: ownerId });
}

async function pubblicoInviaRichiestaOspite(proprietarioId, righe, nome, contattoTipo, contatto, messaggio, dispositivo) {
    return supabaseClient.rpc('invia_richiesta_ospite', {
        p_proprietario_id: proprietarioId, p_righe: righe, p_nome: nome, p_contatto_tipo: contattoTipo,
        p_contatto: contatto, p_messaggio: messaggio, p_dispositivo: dispositivo,
    });
}

async function pubblicoLeggiRichiestaOspite(codice) {
    return supabaseClient.rpc('leggi_richiesta_ospite', { p_codice: codice });
}
