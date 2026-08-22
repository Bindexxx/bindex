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
