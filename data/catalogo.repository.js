// Catalogo delle carte (set_carte): ricerca per il selettore carte (sql/132).

// "serie" è il set d'origine dentro un masterset promo ("PAL" in "boo pal 050", sql/135). Si manda
// solo quando serve; se la funzione sul DB è ancora quella senza p_serie si cerca senza.
let _catalogoSenzaSerie = false;

async function catalogoCerca({ nome = null, numero = null, sigle = null, lingue = null, totale = null, limite = 12, serie = null } = {}) {
    const parametri = { p_nome: nome, p_numero: numero, p_sigle: sigle, p_lingue: lingue, p_totale: totale, p_limite: limite };
    if (serie && !_catalogoSenzaSerie) {
        const r = await supabaseClient.rpc('catalogo_cerca', { ...parametri, p_serie: serie });
        if (!r.error || r.error.code !== 'PGRST202') return r;
        _catalogoSenzaSerie = true;
    }
    return supabaseClient.rpc('catalogo_cerca', parametri);
}

// Miniature già salvate nel catalogo per un elenco di pagine Cardmarket (link senza parametri).
async function catalogoMiniaturePerLink(links) {
    const unici = [...new Set((links || []).filter(Boolean))].slice(0, 40);
    if (!unici.length) return { data: [], error: null };
    return supabaseClient.from('set_carte')
        .select('cardmarket_url, immagine')
        .in('cardmarket_url', unici)
        .not('immagine', 'is', null);
}
