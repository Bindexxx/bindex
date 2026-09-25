// ── data/visite.repository.js ────────────────────────────────────────────
// "Ultima visita" dell'utente e prezzo degli oggetti alla baseline
// (migration sql/64_ultima_visita_oscillazioni.sql, 2026-09-19). Serve
// all'oscillazione "dall'ultimo accesso" del widget "In primo piano".
// Un file piccolo e isolato: e' l'unico consumatore delle due RPC.
//
// Entrambe le funzioni SQL sono SECURITY INVOKER: lavorano sotto la RLS
// dell'utente loggato, quindi non c'e' nessun parametro "userId" da
// passare (e nessuno da poter falsificare).
//
// Dipende da: supabaseClient, _selectTuttePagine (utils/pagination.utils.js,
// risolta a runtime: qui non gira nessuna istruzione al caricamento).

// Registra l'apertura del sito. Restituisce la baseline: l'ultima apertura
// della visita PRECEDENTE (timestamptz, stringa ISO) oppure null alla
// primissima visita. Chiamare UNA volta per caricamento della pagina.
// pausaOre = quante ore di pausa separano due "visite".
async function visitaRegistra(pausaOre) {
    return supabaseClient.rpc('registra_visita', { p_pausa_ore: pausaOre });
}

// Per ogni oggetto il cui prezzo e' cambiato DOPO daISO, il prezzo che
// aveva a quella data: [{ oggetto_id, tabella, prezzo_base }]. Solo gli
// oggetti cambiati (poche righe), ordinati in modo deterministico e letti
// a pagine da 1000 come il resto del sito.
async function variazioniPrezziDa(daISO) {
    return _selectTuttePagine(supabaseClient.rpc('leggi_variazioni_da', { p_da: daISO }));
}

// Spostata qui da ui/paginainiziale-polling-avvio.ui.js (_avviaPresenzaLive) (audit 2026-09-25, B8): regola del progetto,
// nessuna chiamata a supabaseClient fuori da data/*.repository.js.
// Canale Realtime Presence condiviso "presenza-cardsync" (nessuna
// tabella, niente scritto su Postgres). Ritorna il canale NON ancora
// sottoscritto: .on()/.subscribe()/.track() restano al chiamante.
function presenzaCreaCanale(chiave) {
    return supabaseClient.channel('presenza-cardsync', {
        config: { presence: { key: chiave } },
    });
}
