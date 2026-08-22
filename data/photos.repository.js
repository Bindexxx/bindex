// ── data/photos.repository.js ────────────────────────────────────────────
// Tabella 'foto_carte' + bucket storage 'foto-carte' — foto personali
// caricate su singole carte (galleria nel modale "Foto Dettaglio").
//
// Dipende da: supabaseClient.

async function fotoCarteList(cartaId, tabella) {
    return supabaseClient.from('foto_carte').select('*').eq('carta_id', cartaId).eq('tabella', tabella).order('creato_il');
}

async function fotoCarteInsert(record) {
    return supabaseClient.from('foto_carte').insert(record);
}

async function fotoCarteDelete(id) {
    return supabaseClient.from('foto_carte').delete().eq('id', id);
}

function storageFotoCartePublicUrl(storagePath) {
    return supabaseClient.storage.from('foto-carte').getPublicUrl(storagePath);
}

async function storageFotoCarteUpload(path, file) {
    return supabaseClient.storage.from('foto-carte').upload(path, file);
}

async function storageFotoCarteRemove(storagePath) {
    return supabaseClient.storage.from('foto-carte').remove([storagePath]);
}
