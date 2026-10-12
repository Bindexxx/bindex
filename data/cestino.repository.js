// ── data/cestino.repository.js ───────────────────────────────────────────
// Cestino (S8, 2026-10-12; tabella e funzioni in sql/98): carte e prodotti
// sealed eliminati negli ultimi 30 giorni. Le righe entrano SOLO dal trigger
// del database (nessuna scrittura da qui) ed escono col ripristino (RPC),
// con l'eliminazione definitiva o dopo 30 giorni. RLS: ognuno legge e svuota
// solo il proprio cestino.
//
// Dipende da: supabaseClient.

// Solo i campi che servono all'elenco, letti dentro la riga salvata (jsonb):
// la riga intera può contenere un'immagine vecchio formato (base64) pesante.
async function cestinoLista(limite) {
    return supabaseClient
        .from('cestino')
        .select('id, tabella, oggetto_id, eliminato_il, nome:riga->>nome, codice:riga->>codice, qty:riga->>qty, set_espansione:riga->>set_espansione, immagine:riga->>immagine')
        .order('eliminato_il', { ascending: false })
        .limit(limite || 100);
}

async function cestinoRipristina(id) {
    return supabaseClient.rpc('ripristina_dal_cestino', { p_id: id });
}

async function cestinoEliminaDefinitivo(id) {
    return supabaseClient.from('cestino').delete().eq('id', id);
}

// Il filtro sul proprietario serve: Supabase rifiuta DELETE senza filtro.
async function cestinoSvuota(userId) {
    return supabaseClient.from('cestino').delete().eq('owner_id', userId);
}
