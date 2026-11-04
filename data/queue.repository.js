// Coda per l'estensione (coda_carte) e carte da correggere (correzioni_manuali_carte).

async function queueInsertRighe(righeDb) {
    return supabaseClient.from('coda_carte').insert(righeDb);
}

async function codaCarteUltimeRighe(userId, quante = 50) {
    return supabaseClient
        .from('coda_carte')
        .select('stato, creato_il, completato_il')
        .eq('owner_id', userId)
        .order('creato_il', { ascending: false })
        .limit(quante);
}

async function codaCarteUltimoInvio(userId, quante = 60) {
    return supabaseClient
        .from('coda_carte')
        .select('nome, location, destinazione, stato, creato_il, completato_il')
        .eq('owner_id', userId)
        .order('creato_il', { ascending: false })
        .limit(quante);
}

async function codaCarteConta(userId, { da = null, stati = null } = {}) {
    let q = supabaseClient.from('coda_carte').select('id', { count: 'exact', head: true }).eq('owner_id', userId);
    if (da) q = q.gte('creato_il', da);
    if (stati) q = q.in('stato', stati);
    const { count, error } = await q;
    return { count: count || 0, error };
}

async function correzioniManualiConta(userId) {
    return supabaseClient
        .from('correzioni_manuali_carte')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId);
}

async function correzioniManualiLista(userId) {
    return supabaseClient
        .from('correzioni_manuali_carte')
        .select('*')
        .eq('owner_id', userId)
        .order('creato_il', { ascending: false });
}

async function correzioniManualiLeggiRiga(id) {
    return supabaseClient.from('correzioni_manuali_carte').select('*').eq('id', id).single();
}

async function correzioniManualiElimina(id) {
    return supabaseClient.from('correzioni_manuali_carte').delete().eq('id', id);
}
