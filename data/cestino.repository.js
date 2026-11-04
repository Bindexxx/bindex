// Cestino (sql/98): elenco, ripristino ed eliminazione definitiva; le righe le scrive solo il
// trigger del database.

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

async function cestinoSvuota(userId) {
    return supabaseClient.from('cestino').delete().eq('owner_id', userId);
}

async function cestinoVociPerOggetti(tabella, oggettoIds) {
    return supabaseClient
        .from('cestino')
        .select('id, oggetto_id, eliminato_il')
        .eq('tabella', tabella)
        .in('oggetto_id', oggettoIds)
        .order('eliminato_il', { ascending: false });
}

async function cestinoPresente() {
    return supabaseClient.from('cestino').select('id').limit(1);
}
