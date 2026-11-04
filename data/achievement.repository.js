// Achievement: sola lettura (gli sblocchi li scrive il database).

async function achievementCatalogoList() {
    return supabaseClient.from('achievement_catalogo').select('*').eq('attiva', true);
}
