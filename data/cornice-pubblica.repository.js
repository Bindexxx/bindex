// Colore della cornice nelle pagine pubbliche (leggi_colore_cornice_pubblico).

async function coloreCorniceProprietarioGet(ownerId) {
    return supabaseClient.rpc('leggi_colore_cornice_pubblico', { p_owner_id: ownerId }).single();
}
