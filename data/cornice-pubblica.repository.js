// ── data/cornice-pubblica.repository.js ──────────────────────────────────
// STEP 6 restyle "cornice Pokédex" (2026-09-17). Unico punto di contatto
// con la RPC pubblica leggi_colore_cornice_pubblico (vedi sql/63) — usata
// da wishlist.html/binder-pubblico.html/scaffali-pubblico.html, tutte e 3
// già caricano il proprio data/*.repository.js: questo è il quarto,
// condiviso, perché la query è identica sulle 3 pagine.
//
// Dipende da: supabaseClient (creato inline in ciascuna delle 3 pagine).

async function coloreCorniceProprietarioGet(ownerId) {
    return supabaseClient.rpc('leggi_colore_cornice_pubblico', { p_owner_id: ownerId }).single();
}
