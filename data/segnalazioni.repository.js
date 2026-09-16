// ── data/segnalazioni.repository.js ───────────────────────────────────────
// Fase 10, Step 3 (2026-09-13). Solo INSERT dal client (RLS: ognuno scrive
// la propria, nessuno la rilegge da qui — "invia e dimentica", vedi
// sql/61). La lettura per l'admin vive in admin.html/ui/admin-*.js, non
// qui.
//
// Dipende da: supabaseClient.

async function segnalazioniBugInvia({ ownerId, descrizione, logDiagnostico, pagina, browser, schermo }) {
    return supabaseClient.from('segnalazioni_bug').insert({
        owner_id: ownerId,
        descrizione,
        log_diagnostico: logDiagnostico || null,
        pagina: pagina || null,
        browser: browser || null,
        schermo: schermo || null,
    });
}
