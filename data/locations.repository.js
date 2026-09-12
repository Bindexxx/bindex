// ── data/locations.repository.js ─────────────────────────────────────────
// Tabella 'location' — stessa tabella che l'estensione usa per la tendina
// Location (azione 'elencaLocationTab' in supabase_adapter.js), qui letta
// direttamente dal sito. La query select('nome')...order('nome') era
// ripetuta identica in 3 punti diversi di index.html.
//
// FASE 1 (2026-09-12): aggiunta colonna location.tipo ('carta'|'sealed'),
// per impedire che carte e prodotti sealed finiscano nella stessa location.
// Parametro 'tipo' con default 'carta' per non rompere le chiamate esistenti
// dell'estensione (elencaLocationTab in supabase_adapter.js NON è stata
// ancora aggiornata — resta sulle location carte finché non si arriva a
// quella parte, coerente col comportamento di sempre).
//
// Dipende da: supabaseClient.

async function locationsList(userId, tipo = 'carta') {
    return supabaseClient.from('location').select('nome').eq('owner_id', userId).eq('tipo', tipo).order('nome');
}

async function locationExists(userId, nome, tipo = 'carta') {
    return supabaseClient.from('location').select('nome').eq('owner_id', userId).eq('nome', nome).eq('tipo', tipo);
}

async function locationInsert(userId, nome, tipo = 'carta') {
    return supabaseClient.from('location').insert({ owner_id: userId, nome, tipo });
}

// Aggiunta 2026-08-30 (Claudio: serve un modo per eliminare una location).
// Verificato sul DB reale prima di scriverla: policy RLS 'ALL' con
// owner_id=auth.uid() copre già DELETE, nessuna migrazione necessaria.
// Elimina per (owner_id, nome) invece che per id: sfrutta il vincolo
// UNIQUE(owner_id, nome) già esistente, senza dover portare in giro l'id
// della location nei dati lato client (che oggi arrivano uniti da due
// fonti diverse, non sempre con l'id disponibile — vedi
// ui/phone.ui.js:renderPaginaLocation()).
async function locationDelete(userId, nome, tipo = 'carta') {
    return supabaseClient.from('location').delete().eq('owner_id', userId).eq('nome', nome).eq('tipo', tipo);
}
