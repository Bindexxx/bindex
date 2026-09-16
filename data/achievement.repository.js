// ── data/achievement.repository.js ────────────────────────────────────────
// Fase 9 (2026-09-13). Sola LETTURA — la scrittura di achievement_sbloccati
// è esclusivamente lato server (riscatta_traguardo, sql/59), stesso
// principio di sicurezza applicato a bustina_carte_possedute/sql/58: nessuna
// funzione insert/update qui, di proposito.
//
// Dipende da: supabaseClient.

async function achievementCatalogoList() {
    return supabaseClient.from('achievement_catalogo').select('*').eq('attiva', true).order('rarita').order('titolo');
}

async function achievementSbloccatiList(userId) {
    return supabaseClient.from('achievement_sbloccati').select('*').eq('owner_id', userId);
}
