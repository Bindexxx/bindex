// ── data/achievement.repository.js ────────────────────────────────────────
// Fase 9 (2026-09-13). Sola LETTURA — nessuna funzione insert/update qui,
// di proposito (stesso principio di sicurezza già applicato a
// bustina_carte_possedute/sql/58).
//
// RISCRITTO (2026-09-25, Milestones = Achievement, "Tutti" i traguardi —
// Opzione 3 concordata con Claudio in sessione): achievement_sbloccati non
// viene più letta dal client — lo sblocco ora viene letto da
// traguardi_riscossi (missioniTraguardiRiscossiIdTotale,
// data/missioni.repository.js), stesso dato reale scritto dalla stessa RPC
// (riscatta_traguardo), una tabella in meno da tenere sincronizzata. La
// RPC non scrive più in achievement_sbloccati da questa sessione in poi
// (sql/73_rimuovi_scrittura_achievement_orfana.sql) — achievementSbloccatiList()
// è stata rimossa da questo file, non ha più alcun chiamante.
//
// achievement_catalogo RESTA in lettura, invariata nella forma: è la fonte
// dei 37 titoli/rarità curati a mano che il widget usa come override sopra
// il catalogo calcolato da CATALOGO_TRAGUARDI — vedi
// _achievementCostruisciCatalogo (ui/widget-funzioni-condivise.ui.js) e
// ui/widget-achievement.ui.js. Tolto l'.order() precedente (rarita/titolo):
// non serve più, il widget ora raggruppa e ordina per rarità sull'intero
// catalogo unito (curati + calcolati), non sulla sola lista curata.
//
// Dipende da: supabaseClient.

async function achievementCatalogoList() {
    return supabaseClient.from('achievement_catalogo').select('*').eq('attiva', true);
}
