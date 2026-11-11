// Catalogo delle carte (set_carte): ricerca per il selettore carte (sql/132).

async function catalogoCerca({ nome = null, numero = null, sigle = null, lingue = null, totale = null, limite = 12 } = {}) {
    return supabaseClient.rpc('catalogo_cerca', {
        p_nome: nome, p_numero: numero, p_sigle: sigle, p_lingue: lingue, p_totale: totale, p_limite: limite
    });
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
