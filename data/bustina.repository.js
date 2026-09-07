// ── data/bustina.repository.js ───────────────────────────────────────────
// Widget "Bustina" (apertura buste) — vedi Roadmap_Widget_Bustina_2026-09-07
// e il compilato di sessione per lo schema/RPC completi.
//
// VERSIONE MINIMA (2026-09-07): solo le due funzioni che wrappano le RPC già
// scritte, approvate e verificate dal vivo sul DB (bustina_05_rpc.sql,
// REVISIONE 2). Servono al blocco diagnostico "Test Bustina (admin)" in
// index.html per verificare che il sito riesca a chiamarle davvero.
// NON è ancora il file definitivo del passo 8 della roadmap: mancano
// lettura album (bustina_carte_possedute), URL immagini/testi dai bucket
// bustina-immagini/bustina-testi, e tutta la logica che li useranno
// state/bustina.state.js e ui/bustina.ui.js. Le due funzioni qui sotto
// restano valide e riusabili quando quel file verrà scritto.
//
// ⚠ NON esiste (e non deve esistere) alcuna funzione tipo
// ricompenseSaldo(userId,'bustina') qui dentro — vedi ⚠ nel compilato di
// sessione (LAVORO 4): PostgREST tronca oltre ~1000 righe senza segnalarlo,
// e con lo storico delle aperture il saldo sarebbe diventato silenziosamente
// sbagliato. bustine_stato() somma lato Postgres, senza limite di righe.
//
// Dipende da: supabaseClient.

// Saldo/stato bustina (giornaliera disponibile, saldo guadagnate, totali
// aperte) — SEMPRE questa, mai sommare a mano le righe di
// inventario_ricompense per tipo='bustina'.
async function bustinaStatoLeggi() {
    return supabaseClient.rpc('bustine_stato');
}

// Apre una bustina: consuma la giornaliera se disponibile, altrimenti una
// guadagnata (ordine di consumo fisso, deciso da Claudio). Nessun parametro
// accettato di proposito (vedi DEVIAZIONE #10 nel compilato — il bottone
// "Forza Leggendaria" del prototipo non può funzionare finché non si decide
// se aggiungere rarita_forzata con controllo is_admin() dentro la RPC).
async function bustinaApri() {
    return supabaseClient.rpc('apri_bustina');
}
