// ── data/prices.repository.js ────────────────────────────────────────────
// 'ordini' (richieste di controllo prezzi eseguite dall'estensione su un
// dispositivo del gruppo), 'storico_prezzi' (storico quotazioni), e le due
// RPC di match automatico tra amici (trova_match_scambio_wishlist /
// trova_match_wishlist_scambio) + claim di gruppo.
//
// Dipende da: supabaseClient.

async function ordiniInsert(payload) {
    return supabaseClient.from('ordini').insert(payload).select().single();
}

async function ordiniLeggiStato(ordineId) {
    return supabaseClient.from('ordini').select('stato, risultato, errore_msg').eq('id', ordineId).single();
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

// Ritorna il query builder NON risolto (va bene sia per Promise.all diretto
// che per un await esplicito, esattamente come faceva il codice originale).
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

// Usata sia con nome funzione fisso sia dinamico (tabId === 'scambio' ?
// 'trova_match_scambio_wishlist' : 'trova_match_wishlist_scambio') — stessa
// firma RPC in entrambi i casi, un solo wrapper.
async function trovaMatch(nomeFunzioneRpc, userId) {
    return supabaseClient.rpc(nomeFunzioneRpc, { p_owner_id: userId });
}
