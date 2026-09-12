// ── data/sealed.repository.js ────────────────────────────────────────────
// sealedLeggiCondiviso: unica query specifica di sealed.html (pagina
// pubblica). NOTA (Fase 1, 2026-09-12): legge ancora leggi_sealed_condiviso,
// che filtra carte.tipo='sealed' — meccanismo ritirato lato inserimento,
// questa RPC resta quindi orfana (restituisce sempre 0 righe, come faceva
// già prima della Fase 1). La riscrittura per leggere da prodotti_sealed è
// esplicitamente compito della Fase 5 della roadmap ("RPC pubbliche"),
// non toccata qui di proposito — evita di anticipare lavoro che quella
// fase farà con la logica Binder Scambio corretta.
//
// sealedInsertRighe/sealedList/ecc.: CRUD privato su prodotti_sealed, per
// il form Inserimento (ui/entry.ui.js) e il widget Sealed (in-app).
//
// Dipende da: supabaseClient.

async function sealedLeggiCondiviso(ownerUserId) {
    return supabaseClient.rpc('leggi_sealed_condiviso', { p_owner_id: ownerUserId });
}

async function sealedInsertRighe(righe) {
    return supabaseClient.from('prodotti_sealed').insert(righe).select();
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
