// Catalogo automatico (sql/140), pagina admin: set nuovi da confermare, set in ricontrollo, ultimi giri.
// Lettura: RLS solo admin. Conferma e scarto: funzioni del DB che controllano is_admin().

async function catalogoAdminSetDaConfermare() {
    return supabaseClient.from('catalogo_tcgdex').select('*').eq('stato', 'da_confermare').order('data_uscita', { ascending: false, nullsFirst: false });
}

async function catalogoAdminAggiornamenti() {
    return supabaseClient.from('catalogo_aggiornamenti').select('*').order('aggiornato_il', { ascending: false }).limit(20);
}

async function catalogoAdminGiri() {
    return supabaseClient.from('catalogo_giri').select('*').order('il', { ascending: false }).limit(15);
}

async function catalogoAdminConferma(tcgdexId, sigla, nome) {
    return supabaseClient.rpc('catalogo_set_conferma', { p_tcgdex_id: tcgdexId, p_sigla: sigla, p_nome: nome });
}

async function catalogoAdminIgnora(tcgdexId) {
    return supabaseClient.rpc('catalogo_set_ignora', { p_tcgdex_id: tcgdexId });
}
