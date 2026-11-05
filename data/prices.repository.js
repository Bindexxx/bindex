// Ordini di controllo prezzi per l'estensione, storico prezzi e match tra amici.

async function ordiniInsert(payload) {
    return supabaseClient.from('ordini').insert(payload).select().single();
}

async function ordiniCreaControlloPrezzi(locations, aiutaGruppo) {
    return supabaseClient.rpc('crea_ordine_controllo_prezzi', {
        p_locations: Array.isArray(locations) ? locations : [],
        p_aiuta_gruppo: !!aiutaGruppo,
    });
}

async function ordiniLocationPrivateLeggi(ordineId) {
    return supabaseClient.from('ordini_parametri_privati').select('locations').eq('ordine_id', ordineId).maybeSingle();
}

async function ordiniAnnulla(ordineId) {
    return supabaseClient.rpc('annulla_ordine', { p_ordine_id: ordineId });
}

async function ordiniLeggiStato(ordineId) {
    return supabaseClient.from('ordini').select('stato, risultato, errore_msg').eq('id', ordineId).single();
}

async function ordiniControlliRecentiUtente(userId, giorni) {
    const da = new Date(Date.now() - giorni * 86400000).toISOString();
    return supabaseClient
        .from('ordini')
        .select('id, tipo, stato, parametri, creato_il, completato_il, errore_msg')
        .eq('creato_da', userId)
        .in('tipo', ['controlla_prezzi', 'controlla_prezzi_wishlist', 'controlla_prezzi_sealed'])
        .gte('creato_il', da)
        .order('creato_il', { ascending: false })
        .limit(30);
}

async function ordiniUltimoCompletato(userId) {
    return supabaseClient
        .from('ordini')
        .select('completato_il, risultato')
        .eq('tipo', 'controlla_prezzi')
        .eq('stato', 'completato')
        .eq('creato_da', userId)
        .order('completato_il', { ascending: false })
        .limit(1);
}

function storicoPrezziQuery(tabella, ids, { limite } = {}) {
    let q = supabaseClient
        .from('storico_prezzi')
        .select('carta_id, registrato_il')
        .eq('tabella', tabella)
        .in('carta_id', ids)
        .order('registrato_il', { ascending: false });
    if (limite) q = q.limit(limite);
    return q;
}

async function storicoPrezziGrafico(cartaId, tabella) {
    return supabaseClient
        .from('storico_prezzi')
        .select('prezzo, registrato_il')
        .eq('carta_id', cartaId)
        .eq('tabella', tabella)
        .order('registrato_il');
}

async function claimGruppoStato(sogliaMinuti) {
    return supabaseClient.rpc('leggi_stato_claim_gruppo', { p_soglia_minuti: sogliaMinuti });
}

async function trovaMatch(nomeFunzioneRpc, userId) {
    return supabaseClient.rpc(nomeFunzioneRpc, { p_owner_id: userId });
}
