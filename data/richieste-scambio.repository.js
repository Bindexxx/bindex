// Richieste di scambio: RPC transazionali e letture (le scritture passano solo dalle RPC).

async function richiesteScambioRicevuteList(userId) {
    const leggi = (campi) => supabaseClient
        .from('richieste_scambio_righe')
        .select(`*, richieste_scambio(${campi})`)
        .eq('proprietario_id', userId)
        .order('creato_il', { ascending: false });
    const esito = await leggi('richiedente_id, creato_il, codice_rq, ospite_nome, ospite_contatto_tipo, ospite_contatto, ospite_messaggio');
    if (esito.error && /codice_rq|ospite_|42703|column/i.test((esito.error.message || '') + ' ' + (esito.error.code || ''))) {
        return leggi('richiedente_id, creato_il');
    }
    return esito;
}

async function richiesteScambioInviateList(userId) {
    return supabaseClient
        .from('richieste_scambio_righe')
        .select('*, richieste_scambio(proprietario_id, creato_il)')
        .eq('richiedente_id', userId)
        .order('creato_il', { ascending: false });
}

async function inviaRichiestaScambio(proprietarioId, righe) {
    return supabaseClient.rpc('invia_richiesta_scambio', { p_proprietario_id: proprietarioId, p_righe: righe });
}

async function accettaRigaRichiesta(rigaId) {
    return supabaseClient.rpc('accetta_riga_richiesta', { p_riga_id: rigaId });
}

async function rifiutaRigaRichiesta(rigaId) {
    return supabaseClient.rpc('rifiuta_riga_richiesta', { p_riga_id: rigaId });
}

async function annullaRigaRichiesta(rigaId, motivo) {
    return supabaseClient.rpc('annulla_riga_richiesta', { p_riga_id: rigaId, p_motivo: motivo });
}

async function sbloccaRigaRichiesta(rigaId, motivo) {
    return supabaseClient.rpc('sblocca_riga_richiesta', { p_riga_id: rigaId, p_motivo: motivo || 'intervento_amministrativo' });
}

async function concludiRigaRichiesta(rigaId, locationScelta) {
    return supabaseClient.rpc('concludi_riga_richiesta', { p_riga_id: rigaId, p_location_scelta: locationScelta || '?' });
}

async function richiesteScambioContaDaGestire(userId) {
    return supabaseClient
        .from('richieste_scambio_righe')
        .select('id', { count: 'exact', head: true })
        .eq('proprietario_id', userId)
        .eq('stato_riga', 'in_attesa');
}

async function scadiRichiesteOspite() {
    return supabaseClient.rpc('scadi_richieste_ospite');
}

async function bloccaOspite(richiestaId) {
    return supabaseClient.rpc('blocca_ospite', { p_richiesta_id: richiestaId });
}
