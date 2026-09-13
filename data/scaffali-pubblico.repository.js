// ── data/scaffali-pubblico.repository.js ─────────────────────────────────
// Query specifiche di scaffali-pubblico.html — mirror di
// data/binder-pubblico.repository.js, Fase 1.3 Step 5c (2026-09-12).
// Nessun equivalente di binderPubblicoLeggiMedia: Scaffali non ha
// copertina/sleeve personalizzate (Step 5b ridotto a solo tema CSS).
//
// Dipende da: supabaseClient.

async function scaffaliPubblicoLeggiInfo(scaffaleId) {
    return supabaseClient.rpc('leggi_scaffale_pubblico_info', { p_scaffale_id: scaffaleId });
}

async function scaffaliPubblicoLeggiProdotti(scaffaleId) {
    return supabaseClient.rpc('leggi_scaffale_pubblico', { p_scaffale_id: scaffaleId });
}

// Missioni/Traguardi — evento attribuito al PROPRIETARIO, fire-and-forget
// dal chiamante (stesso motivo di binderPubblicoRegistraApertura).
async function scaffaliPubblicoRegistraApertura(scaffaleId) {
    return supabaseClient.rpc('registra_apertura_scaffale_pubblico', { p_scaffale_id: scaffaleId });
}
