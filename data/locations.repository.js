// Tabella location (la stessa che usa l'estensione).

async function locationsList(userId, tipo = 'carta') {
    return supabaseClient.from('location').select('nome').eq('owner_id', userId).eq('tipo', tipo).order('nome');
}

async function locationExists(userId, nome, tipo = 'carta') {
    return supabaseClient.from('location').select('nome').eq('owner_id', userId).eq('nome', nome).eq('tipo', tipo);
}

async function locationInsert(userId, nome, tipo = 'carta') {
    return supabaseClient.from('location').insert({ owner_id: userId, nome, tipo });
}

async function locationDelete(userId, nome, tipo = 'carta') {
    return supabaseClient.from('location').delete().eq('owner_id', userId).eq('nome', nome).eq('tipo', tipo);
}

async function locationRinomina(nomeDa, nomeA) {
    return supabaseClient.rpc('rinomina_location', { p_da: nomeDa, p_a: nomeA });
}

async function locationDeleteBatch(userId, nomi, tipo = 'carta') {
    return supabaseClient.from('location').delete().eq('owner_id', userId).eq('tipo', tipo).in('nome', nomi);
}

async function locationSpostaCarte(userId, nomiDa, nomeA) {
    return supabaseClient.from('carte')
        .update({ location: nomeA }, { count: 'exact' })
        .eq('owner_id', userId)
        .eq('stato', 'collezione')
        .in('location', nomiDa);
}
