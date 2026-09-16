// ── data/movimenti.repository.js ───────────────────────────────────────────
// Fase 8, Step 2 (2026-09-13). Scrittura diretta su movimenti_collezione
// (sql/54) — RLS lo protegge (INSERT solo su owner_id = auth.uid()), niente
// RPC necessaria per un semplice log di eventi. Chi chiama è responsabile
// di trattare un eventuale errore come NON bloccante (fire-and-forget): un
// log fallito non deve mai impedire l'operazione vera (aggiunta/modifica/
// eliminazione) che lo ha generato.
//
// Dipende da: supabaseClient.

async function movimentiCollezioneInsertRighe(righe) {
    return supabaseClient.from('movimenti_collezione').insert(righe);
}

// Fase 8, Step 3 (2026-09-13): lettura per la pagina "Variazione valore" —
// gli ultimi N eventi dell'utente, più recenti prima (stesso ordine
// garantito dall'indice idx_movimenti_collezione_owner_data, sql/54).
async function movimentiCollezioneListMie(userId, limite = 200) {
    return supabaseClient.from('movimenti_collezione')
        .select('*')
        .eq('owner_id', userId)
        .order('avvenuto_il', { ascending: false })
        .limit(limite);
}
