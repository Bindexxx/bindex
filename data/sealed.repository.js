// Prodotti sealed: chiamate a Supabase (anche la pagina pubblica sealed.html).

async function sealedLeggiCondiviso(ownerUserId) {
    return supabaseClient.rpc('leggi_sealed_condiviso', { p_owner_id: ownerUserId });
}

async function sealedInsertRighe(righe) {
    return supabaseClient.from('prodotti_sealed').insert(righe).select();
}

async function sealedSelectById(id) {
    return supabaseClient.from('prodotti_sealed').select('*').eq('id', id).single();
}

async function sealedListMie(userId) {
    return supabaseClient.from('prodotti_sealed').select('*').eq('owner_id', userId).eq('stato', 'collezione').order('created_at', { ascending: false });
}

async function sealedUpdate(id, aggiornamento) {
    return supabaseClient.from('prodotti_sealed').update(aggiornamento).eq('id', id);
}

async function sealedDelete(id) {
    return supabaseClient.from('prodotti_sealed').delete().eq('id', id);
}
