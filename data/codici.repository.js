// ── data/codici.repository.js ────────────────────────────────────────────
// Codici da riscattare (Impostazioni → Codici, 2026-10-14; tabelle e funzione
// in sql/102). Il codice si controlla e si accredita SOLO nel database
// (riscatta_codice, SECURITY DEFINER): da qui si chiama la funzione e si legge
// l'elenco dei propri codici usati (RLS: ognuno vede solo i suoi).
// Finché sql/102 non è eseguito funzione e tabella non esistono: la UI lo
// riconosce dall'errore e risponde "non ancora attivi".
//
// Dipende da: supabaseClient.

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
