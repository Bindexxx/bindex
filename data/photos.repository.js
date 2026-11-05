// Foto personali delle carte (tabella foto_carte e bucket foto-carte).

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

async function fotoCarteMie(userId) {
    return supabaseClient.from('foto_carte')
        .select('id, carta_id, tipo, etichetta, storage_path, creato_il')
        .eq('owner_id', userId).eq('tabella', 'carte')
        .order('creato_il');
}

async function fotoCarteLeggi(cartaIds) {
    return supabaseClient.rpc('leggi_foto_carte', { p_carta_ids: cartaIds });
}

async function fotoDaPulireList() {
    return supabaseClient.from('foto_carte_da_pulire').select('storage_path').limit(100);
}
async function fotoDaPulireTogli(paths) {
    return supabaseClient.from('foto_carte_da_pulire').delete().in('storage_path', paths);
}
async function storageFotoCarteRemoveMolti(paths) {
    return supabaseClient.storage.from('foto-carte').remove(paths);
}
async function storageFotoCarteUploadJpeg(path, blob) {
    return supabaseClient.storage.from('foto-carte').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
}
