// Codici da riscattare: il controllo e l'accredito li fa solo il database (riscatta_codice).

async function codiciRiscatta(codice) {
    return supabaseClient.rpc('riscatta_codice', { p_codice: codice });
}

async function codiciUsatiLeggi(limite) {
    return supabaseClient
        .from('codici_riscattati')
        .select('codice, descrizione, ricompense, riscattato_il')
        .order('riscattato_il', { ascending: false })
        .limit(limite || 50);
}
