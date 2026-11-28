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

// ── Contenitori (sql/162): dove sta fisicamente la carta, facoltativo. Sulla carta: location_secondaria.
async function contenitoriList(userId) {
    return supabaseClient.from('contenitori').select('nome').eq('owner_id', userId).order('nome');
}

async function contenitoreInsert(userId, nome) {
    return supabaseClient.from('contenitori').insert({ owner_id: userId, nome });
}

async function contenitoreRinomina(nomeDa, nomeA) {
    return supabaseClient.rpc('rinomina_contenitore', { p_da: nomeDa, p_a: nomeA });
}

// Toglie il contenitore da tutte le carte che ce l'hanno (il contenitore resta nell'elenco).
async function contenitoreSvuota(userId, nome) {
    return supabaseClient.from('carte').update({ location_secondaria: null }, { count: 'exact' })
        .eq('owner_id', userId).eq('location_secondaria', nome);
}

async function contenitoreElimina(userId, nome) {
    return supabaseClient.from('contenitori').delete().eq('owner_id', userId).eq('nome', nome);
}

async function locationsScambioAutomatico(userId) {
    return supabaseClient.from('location').select('nome, scambio_automatico').eq('owner_id', userId).eq('tipo', 'carta');
}

async function locationImpostaScambioAutomatico(nome, attivo) {
    return supabaseClient.rpc('imposta_location_scambio_automatico', { p_nome: nome, p_attivo: !!attivo });
}
