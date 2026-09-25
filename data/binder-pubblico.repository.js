// ── data/binder-pubblico.repository.js ───────────────────────────────────
// Query specifiche di binder-pubblico.html — solo le RPC pubbliche
// necessarie, stesso pattern minimale di scambio.repository.js/
// wishlist.repository.js (un repository piccolo e dedicato per pagina
// pubblica, non il binder.repository.js del sito privato: quello ha
// decine di funzioni autenticate che qui non servono).
//
// Dipende da: supabaseClient.

async function binderPubblicoLeggiInfo(binderId) {
    return supabaseClient.rpc('leggi_binder_pubblico_info', { p_binder_id: binderId });
}

async function binderPubblicoLeggiCarte(binderId) {
    return supabaseClient.rpc('leggi_binder_pubblico', { p_binder_id: binderId });
}

async function binderPubblicoLeggiMedia(binderId) {
    return supabaseClient.rpc('leggi_media_binder_pubblico', { p_binder_id: binderId });
}

// Missioni/Traguardi Fase 2 (2026-08-29): registra che QUESTO binder
// pubblico è stato aperto — evento attribuito al PROPRIETARIO (il
// visitatore resta anonimo, questa pagina non ha sessione — vedi
// migration 33 per il perché serve una RPC SECURITY DEFINER e non un
// insert diretto). Nessun valore di ritorno atteso: fire-and-forget dal
// chiamante, un fallimento qui non deve mai essere visibile al
// visitatore né bloccare il caricamento del binder.
async function binderPubblicoRegistraApertura(binderId) {
    return supabaseClient.rpc('registra_apertura_binder_pubblico', { p_binder_id: binderId });
}

// Spostata qui da ui/binder-flipbook.ui.js e ui/binder-pubblico.ui.js (audit 2026-09-25, B8): regola del progetto,
// nessuna chiamata a supabaseClient fuori da data/*.repository.js.
// URL pubblico di un file in un bucket pubblico (default-assets,
// immaginivisibili). Nessuna richiesta di rete: costruisce solo l'URL.
function binderPubblicoUrlFile(bucket, percorso) {
    const { data } = supabaseClient.storage.from(bucket).getPublicUrl(percorso);
    return data?.publicUrl || null;
}
