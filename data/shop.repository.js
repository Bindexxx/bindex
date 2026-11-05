// Shop della Polvere (sql/91): chiamate a Supabase.

async function shopArticoliLeggi() {
    return supabaseClient.from('shop_articoli')
        .select('id, chiave, nome, categoria, descrizione, prezzo, limite_utente, regalabile, stato, in_vendita_dal, fino_al, immagine_path, stile, ordine, creato_il')
        .order('ordine').order('creato_il');
}

async function shopPossessiLeggi(userId) {
    return supabaseClient.from('shop_possessi')
        .select('articolo_id, attivo, ottenuto_il')
        .eq('owner_id', userId);
}

async function shopAcquistiMieiLeggi() {
    return supabaseClient.from('shop_acquisti')
        .select('id, articolo_id, compratore_id, destinatario_id, prezzo, rimborsato_il, creato_il')
        .order('creato_il', { ascending: false }).limit(500);
}

async function shopCompra(articoloId, destinatarioId) {
    return supabaseClient.rpc('shop_compra', { p_articolo: articoloId, p_destinatario: destinatarioId || null });
}

async function shopAttiva(articoloId, attivo) {
    return supabaseClient.rpc('shop_attiva', { p_articolo: articoloId, p_attivo: !!attivo });
}

async function shopDestinatariRegalo() {
    return supabaseClient.rpc('shop_destinatari_regalo');
}

function shopImmagineUrl(path) {
    if (!path) return '';
    return supabaseClient.storage.from('shop-articoli').getPublicUrl(path).data.publicUrl;
}

async function polvereMovimentiLeggi() {
    return supabaseClient.from('inventario_ricompense')
        .select('id, tipo, riferimento_id, quantita, ottenuto_il')
        .eq('tipo', 'polvere')
        .order('ottenuto_il', { ascending: false }).limit(400);
}

async function ricompenseAltreLeggi() {
    return supabaseClient.from('inventario_ricompense')
        .select('tipo, riferimento_id, quantita')
        .in('tipo', ['bustina', 'stampino', 'skip_missione'])
        .limit(2000);
}

async function shopAdminAcquistiLeggi() {
    return supabaseClient.from('shop_acquisti')
        .select('articolo_id, prezzo, rimborsato_il')
        .limit(10000);
}

async function shopAdminSalva(articolo) {
    return supabaseClient.rpc('shop_admin_salva', { p: articolo });
}

async function shopAdminRitira(articoloId) {
    return supabaseClient.rpc('shop_admin_ritira', { p_articolo: articoloId });
}

async function shopAdminCaricaImmagine(path, file) {
    return supabaseClient.storage.from('shop-articoli').upload(path, file, { upsert: true, contentType: file.type || 'image/png' });
}
