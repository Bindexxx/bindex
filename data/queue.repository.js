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

// Restyle Bindex FASE 2 (2026-09-30), tessera Inserimento: le ultime righe
// della PROPRIA coda (stato e date), per "in coda" e "ultimo invio". Solo
// lettura, filtrata per owner_id. NB: coda_carte è una vista sopra
// coda_lavoro (stati CHECK: pending/in_corso/completato/errore — verificato
// sul DB il 2026-09-30).
async function codaCarteUltimeRighe(userId, quante = 50) {
    return supabaseClient
        .from('coda_carte')
        .select('stato, creato_il, completato_il')
        .eq('owner_id', userId)
        .order('creato_il', { ascending: false })
        .limit(quante);
}

// RESTYLE (Inserimento, "Ultimo invio"): le ultime righe inviate con nome,
// location, destinazione e stato. Solo lettura, propria coda.
async function codaCarteUltimoInvio(userId, quante = 60) {
    return supabaseClient
        .from('coda_carte')
        .select('nome, location, destinazione, stato, creato_il, completato_il')
        .eq('owner_id', userId)
        .order('creato_il', { ascending: false })
        .limit(quante);
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
