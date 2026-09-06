// ── data/contributi.repository.js ────────────────────────────────────────
// Contributi al gruppo (migration 37). File nuovo e piccolo, stessa scelta
// di storico-valore.repository.js: e' l'unico consumatore di queste due RPC
// e non ha niente a che vedere con gli altri repository.
//
// LA SCRITTURA NON STA QUI. registra_aiuto_gruppo() viene chiamata
// dall'ESTENSIONE (shared.js -> registraAiutoGruppo, agganciata in
// background.js dentro _risolviRigaCodaCarteAutonoma), perche' e' il worker
// autonomo a fare il lavoro che viene contato. Il sito legge e basta: se un
// giorno comparisse qui una funzione di scrittura, quasi certamente e' un
// errore di percorso.
//
// PERCHE' UNA RPC E NON UNA QUERY DIRETTA (dalla migration 37): il totale
// del gruppo richiede di contare righe di ALTRI, e farlo dal client
// vorrebbe dire poterle anche leggere. La RPC e' SECURITY DEFINER, conta
// per conto suo e restituisce solo le somme.
//
// VINCOLO DA NON AGGIRARE: il livello di visibilita' scelto e' INTERMEDIO —
// il proprio numero e il totale del gruppo, MAI chi ha fatto quanto. Se
// servira' una classifica si scrivera' una TERZA funzione lato database,
// non si allarghera' leggi_contributi_gruppo().

// Restituisce { data: { miei, personeAiutate, gruppo }, error }.
//
// TRE ZERI SONO UN RISULTATO VALIDO, NON UN VUOTO. E' lo stato del primo
// giorno, prima che chiunque del gruppo abbia lavorato una riga altrui.
// Chi consuma questa funzione deve distinguere "tre zeri" (dato vero) da
// "error != null" (dato assente): sono due cose diverse e vanno mostrate in
// modo diverso.
async function contributiGruppoLeggi() {
    const { data, error } = await supabaseClient.rpc('leggi_contributi_gruppo');

    if (error) {
        console.error('[contributi gruppo] lettura:', error.message);
        return { data: null, error };
    }

    // La RPC e' RETURNS TABLE: arriva un array con una riga sola. Se
    // l'utente non e' autenticato la funzione restituisce comunque una riga
    // di zeri (vedi migration 37), quindi l'array vuoto non dovrebbe mai
    // capitare — ma se capita si tratta come dato assente, non come zero.
    const riga = Array.isArray(data) ? data[0] : data;
    if (!riga) return { data: null, error: null };

    return {
        data: {
            miei: Number(riga.miei) || 0,
            personeAiutate: Number(riga.persone_aiutate) || 0,
            gruppo: Number(riga.gruppo) || 0,
        },
        error: null,
    };
}
