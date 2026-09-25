// ── data/pubblico.repository.js ──────────────────────────────────────────
// Chiamate Supabase di utils/shared-public.js (login minimo + invio
// richiesta di scambio dalle pagine pubbliche). Creato il 2026-09-25
// (audit, B8): prima vivevano direttamente in utils/shared-public.js,
// contro la regola del progetto "nessuna chiamata a supabaseClient fuori
// da data/*.repository.js". Stesso identico comportamento.
//
// Caricato da TUTTE le pagine che caricano utils/shared-public.js
// (binder-pubblico, scaffali-pubblico, wishlist, sealed), subito prima di
// quel file. Queste pagine usano un client "leggero" senza sessione
// persistente (persistSession: false): il login vale solo per la pagina
// aperta.
//
// Dipende da: supabaseClient.

async function pubblicoSessioneUtente() {
    const { data } = await supabaseClient.auth.getSession();
    return data?.session?.user || null;
}

async function pubblicoLogin(email, password) {
    return supabaseClient.auth.signInWithPassword({ email, password });
}

async function pubblicoInviaRichiestaScambio(proprietarioId, righe) {
    return supabaseClient.rpc('invia_richiesta_scambio', { p_proprietario_id: proprietarioId, p_righe: righe });
}
