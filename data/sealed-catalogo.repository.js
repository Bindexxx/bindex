// Catalogo sealed (sql/151): ricerca dei prodotti di Cardmarket per il selettore sealed.
// Lo riempie l'estensione (account di Bill); qui si legge soltanto (RLS: SELECT per gli utenti entrati).

const _SEALED_CAT_COLONNE = 'url, id_prodotto, categoria, id_espansione, nome, slug, foto, foto_cm';

// Tutte le espansioni sealed di Cardmarket (poche centinaia di righe).
async function sealedCatalogoEspansioni() {
    return supabaseClient.from('sealed_espansioni_cm').select('id_espansione, nome').order('nome').limit(5000);
}

// gruppi = [{ testi: ['prismatic', 'elite*trainer*box'], categorie: ['Boosters'], espansioni: [123] }]
// (da sealedLeggiTesto): il prodotto deve soddisfare tutti i gruppi, un gruppo vale se il nome o lo
// slug contiene uno dei testi, o la categoria o l'espansione è tra quelle. I testi arrivano già
// normalizzati (solo a-z, 0-9 e *), le categorie sono quelle fisse di SEALED_CATEGORIE.
async function sealedCatalogoCerca(gruppi, filtri = {}, limite = 120) {
    let q = supabaseClient.from('sealed_catalogo').select(_SEALED_CAT_COLONNE, { count: 'exact' });
    const pulito = (t) => String(t).replace(/[^a-z0-9*]/g, '');
    const condizioni = (gruppi || []).map(g => {
        const parti = [];
        (g.testi || []).map(pulito).filter(Boolean).forEach(t => { parti.push(`nome.ilike.*${t}*`, `slug.ilike.*${t}*`); });
        const cat = (g.categorie || []).filter(c => /^[A-Za-z-]+$/.test(c));
        if (cat.length) parti.push(`categoria.in.(${cat.join(',')})`);
        const esp = (g.espansioni || []).filter(n => Number.isInteger(n));
        if (esp.length) parti.push(`id_espansione.in.(${esp.join(',')})`);
        return parti.length ? `or(${parti.join(',')})` : null;
    }).filter(Boolean);
    if (condizioni.length === 1) q = q.or(condizioni[0].slice(3, -1));
    else if (condizioni.length > 1) q = q.or(`and(${condizioni.join(',')})`);
    if (filtri.categoria) q = q.eq('categoria', filtri.categoria);
    if (filtri.espansione != null && filtri.espansione !== '') q = q.eq('id_espansione', Number(filtri.espansione));
    return q.order('nome').limit(limite);
}

// I prodotti di questi link (miniature delle opzioni in "Carte con problemi").
async function sealedCatalogoPerUrl(urls) {
    const elenco = [...new Set((urls || []).filter(Boolean))].slice(0, 200);
    if (!elenco.length) return { data: [], error: null };
    return supabaseClient.from('sealed_catalogo').select(_SEALED_CAT_COLONNE).in('url', elenco);
}

// Import CSV: i prodotti che si chiamano proprio così (nome italiano esatto, o slug uguale senza
// badare alle maiuscole). slugs = già nel formato di sealedSlugDaNome (solo a-z, 0-9 e -).
async function sealedCatalogoPerNomi(nomi, slugs) {
    const n = [...new Set((nomi || []).filter(Boolean))].slice(0, 100);
    const s = [...new Set((slugs || []).filter(x => /^[a-z0-9-]+$/.test(x || '')))].slice(0, 100);
    const [a, b] = await Promise.all([
        n.length ? supabaseClient.from('sealed_catalogo').select(_SEALED_CAT_COLONNE).in('nome', n) : { data: [], error: null },
        s.length ? supabaseClient.from('sealed_catalogo').select(_SEALED_CAT_COLONNE).or(s.map(x => `slug.ilike.${x}`).join(',')) : { data: [], error: null },
    ]);
    if (a.error || b.error) return { data: null, error: a.error || b.error };
    return { data: [...(a.data || []), ...(b.data || [])], error: null };
}

// La foto del prodotto nel bucket pubblico sealed-foto (nome del file: "<id_prodotto>.webp").
function sealedCatalogoFotoUrl(nomeFile) {
    if (!nomeFile) return null;
    const { data } = supabaseClient.storage.from('sealed-foto').getPublicUrl(nomeFile);
    return data && data.publicUrl ? data.publicUrl : null;
}
