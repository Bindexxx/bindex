// ── data/queue.repository.js ─────────────────────────────────────────────
// 'coda_carte' (righe in attesa di elaborazione dal worker dell'estensione)
// e 'correzioni_manuali_carte' (righe fallite dopo 3 tentativi, spostate lì
// dalla RPC sposta_riga_in_correzione_manuale — vedi 11_schema_correzioni_
// manuali_carte.sql). Stesso comportamento del codice originale, solo
// consolidato: il delete-by-id su correzioni_manuali_carte era duplicato
// in due punti diversi.
//
// Dipende da: supabaseClient.

async function queueInsertRighe(righeDb) {
    return supabaseClient.from('coda_carte').insert(righeDb);
}

async function correzioniManualiConta(userId) {
    return supabaseClient
        .from('correzioni_manuali_carte')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId);
}

async function correzioniManualiLista(userId) {
    return supabaseClient
        .from('correzioni_manuali_carte')
        .select('*')
        .eq('owner_id', userId)
        .order('creato_il', { ascending: false });
}

async function correzioniManualiLeggiRiga(id) {
    return supabaseClient.from('correzioni_manuali_carte').select('*').eq('id', id).single();
}

async function correzioniManualiElimina(id) {
    return supabaseClient.from('correzioni_manuali_carte').delete().eq('id', id);
}
