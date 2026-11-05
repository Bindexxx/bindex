// Movimenti della collezione (variazione valore): scrittura diretta, protetta da RLS.

async function movimentiCollezioneInsertRighe(righe) {
    return supabaseClient.from('movimenti_collezione').insert(righe);
}

async function movimentiCollezioneListMie(userId, limite = 200) {
    return supabaseClient.from('movimenti_collezione')
        .select('*')
        .eq('owner_id', userId)
        .order('avvenuto_il', { ascending: false })
        .limit(limite);
}
