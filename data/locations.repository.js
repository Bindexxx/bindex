// ── data/locations.repository.js ─────────────────────────────────────────
// Tabella 'location' — stessa tabella che l'estensione usa per la tendina
// Location (azione 'elencaLocationTab' in supabase_adapter.js), qui letta
// direttamente dal sito. La query select('nome')...order('nome') era
// ripetuta identica in 3 punti diversi di index.html.
//
// Dipende da: supabaseClient.

async function locationsList(userId) {
    return supabaseClient.from('location').select('nome').eq('owner_id', userId).order('nome');
}

async function locationExists(userId, nome) {
    return supabaseClient.from('location').select('nome').eq('owner_id', userId).eq('nome', nome);
}

async function locationInsert(userId, nome) {
    return supabaseClient.from('location').insert({ owner_id: userId, nome });
}

// Aggiunta 2026-08-30 (Claudio: serve un modo per eliminare una location).
// Verificato sul DB reale prima di scriverla: policy RLS 'ALL' con
// owner_id=auth.uid() copre già DELETE, nessuna migrazione necessaria.
// Elimina per (owner_id, nome) invece che per id: sfrutta il vincolo
// UNIQUE(owner_id, nome) già esistente, senza dover portare in giro l'id
// della location nei dati lato client (che oggi arrivano uniti da due
// fonti diverse, non sempre con l'id disponibile — vedi
// ui/phone.ui.js:renderPaginaLocation()).
async function locationDelete(userId, nome) {
    return supabaseClient.from('location').delete().eq('owner_id', userId).eq('nome', nome);
}
