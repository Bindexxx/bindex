// Widget Bustina (apertura buste): chiamate a Supabase.

async function bustinaStatoLeggi() {
    return supabaseClient.rpc('bustine_stato');
}

async function bustinaApri() {
    return supabaseClient.rpc('apri_bustina');
}

async function bustinaApriForzata(raritaForzata) {
    return supabaseClient.rpc('apri_bustina', { p_rarita_forzata: raritaForzata });
}

async function polvereSaldoLeggi() {
    return supabaseClient.rpc('polvere_saldo');
}

async function polvereGuadagnataDa(isoDa) {
    return supabaseClient.from('inventario_ricompense')
        .select('quantita')
        .eq('tipo', 'polvere')
        .gt('quantita', 0)
        .not('riferimento_id', 'like', 'rimborso:%')
        .gte('ottenuto_il', isoDa);
}

function bustinaAlbumQuery(userId) {
    return supabaseClient.from('bustina_carte_possedute').select('*').eq('owner_id', userId);
}

function bustinaCatalogoQuery() {
    return supabaseClient.from('bustina_catalogo').select('*').eq('attiva', true);
}

function bustinaImmagineUrl(rarita, nomeFile) {
    return supabaseClient.storage.from('bustina-immagini').getPublicUrl(`${rarita}/${nomeFile}.webp`);
}

function bustinaTestoUrl(rarita, nomeFile) {
    return supabaseClient.storage.from('bustina-testi').getPublicUrl(`${rarita}/${nomeFile}.txt`);
}

function bustinaCutsceneUrl(mese, giorno) {
    return supabaseClient.storage.from('bustina-assets').getPublicUrl(`cutscene-data/cutscene/mese${mese}/giorno${giorno}.json`);
}

function bustinaCutsceneMesiDisponibili() {
    return supabaseClient.storage.from('bustina-assets').list('cutscene-data/cutscene', { limit: 1000 });
}

function bustinaAssetUrl(pathRelativo) {
    return supabaseClient.storage.from('bustina-assets').getPublicUrl(`cutscene-data/${pathRelativo}`);
}

function bustinaSfxUrl(nomeFile) {
    return supabaseClient.storage.from('bustina-assets').getPublicUrl(`cutscene-data/sfx/${nomeFile}`);
}

function bustinaQuotesUrl() {
    return supabaseClient.storage.from('bustina-quotes').getPublicUrl('cutscene-data/quotes/loading_quotes.json');
}

function bustinaCountdownQuotesUrl() {
    return supabaseClient.storage.from('bustina-assets').getPublicUrl('cutscene-data/quotes/countdown_quotes.json');
}
