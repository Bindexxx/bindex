// ── data/bustina.repository.js ───────────────────────────────────────────
// Widget "Bustina" (apertura buste) — vedi Roadmap_Widget_Bustina_2026-09-07
// e il compilato di sessione per lo schema/RPC completi.
//
// Aggiornato 2026-09-07: alle 3 funzioni RPC (diagnostica + forzatura admin,
// già verificate dal vivo) si aggiungono lettura album e URL immagini/testi
// — quanto serve per iniziare state/bustina.state.js e ui/bustina.ui.js.
// Ancora NON verificato che gli URL costruiti sotto rispondano davvero dai
// bucket (punto 2 della lista DA FARE) — è la prima cosa da controllare
// scrivendo la UI, prima di qualunque altra logica.
//
// ⚠ NESSUNA FOREIGN KEY tra bustina_carte_possedute.carta_id e
// bustina_catalogo.carta_id (verificato su pg_constraint in sessione: solo
// UNIQUE(owner_id,carta_id), FK su owner_id, PK, CHECK quantita>0 — niente
// FK su carta_id). Quindi NESSUN embed PostgREST possibile
// (.select('*, bustina_catalogo(*)') non funzionerebbe): bustinaAlbumQuery
// e bustinaCatalogoQuery restano due query separate, il join si fa lato
// client in ui/bustina.ui.js — non provare a unirle qui.
//
// Il fallback (fallback.webp/fallback.txt per rarità) NON è gestito qui: il
// repository ritorna sempre l'URL "vero" costruito dal nome file; il
// fallback via onerror sull'<img> è responsabilità della UI.
//
// ⚠ NON esiste (e non deve esistere) alcuna funzione tipo
// ricompenseSaldo(userId,'bustina') qui dentro — vedi ⚠ nel compilato di
// sessione (LAVORO 4): PostgREST tronca oltre ~1000 righe senza segnalarlo,
// e con lo storico delle aperture il saldo sarebbe diventato silenziosamente
// sbagliato. bustine_stato() somma lato Postgres, senza limite di righe.
//
// Dipende da: supabaseClient.

// ── RPC ───────────────────────────────────────────────────────────────

// Saldo/stato bustina (giornaliera disponibile, saldo guadagnate, totali
// aperte) — SEMPRE questa, mai sommare a mano le righe di
// inventario_ricompense per tipo='bustina'.
async function bustinaStatoLeggi() {
    return supabaseClient.rpc('bustine_stato');
}

// Apre una bustina: consuma la giornaliera se disponibile, altrimenti una
// guadagnata (ordine di consumo fisso, deciso da Claudio). Nessun parametro
// qui: la forzatura rarita' (ex DEVIAZIONE #10, ora risolta) e' una firma
// diversa della STESSA funzione DB — vedi bustinaApriForzata sotto.
async function bustinaApri() {
    return supabaseClient.rpc('apri_bustina');
}

// Forza lo slot 4 alla rarita' passata — SOLO admin, verificato DENTRO la
// RPC (is_admin(), mai lato client: vedi bustina_07_forza_rarita.sql). Chi
// non e' admin riceve un'eccezione invece di un fallback silenzioso, per
// scelta di Claudio. Il bottone "Forza Leggendaria" passa sempre
// 'leggendarie', ma la funzione resta generica per qualunque rarita'
// valida in bustina_probabilita.
async function bustinaApriForzata(raritaForzata) {
    return supabaseClient.rpc('apri_bustina', { p_rarita_forzata: raritaForzata });
}

// ── Album e catalogo (tabelle, sola lettura — RLS le copre già) ────────

// Le carte possedute dall'utente. owner_id esplicito nel filtro anche se
// la RLS lo garantirebbe comunque (stesso stile di binder.repository.js) —
// solo carta_id/quantita/ottenuto_il: il nome/rarita/immagine si prendono
// da bustinaCatalogoQuery e si uniscono lato client, vedi nota in testa.
function bustinaAlbumQuery(userId) {
    return supabaseClient.from('bustina_carte_possedute').select('*').eq('owner_id', userId);
}

// Tutto il catalogo attivo (attiva=true) — nomi, rarita', nome_file. Usato
// per il join lato client con l'album, e anche da solo (es. un futuro
// "elenco completo delle carte ottenibili").
function bustinaCatalogoQuery() {
    return supabaseClient.from('bustina_catalogo').select('*').eq('attiva', true);
}

// ── Storage: bucket pubblici 'bustina-immagini' / 'bustina-testi' ──────
// Percorso: {rarita}/{nome_file}.estensione — la rarita' come cartella
// include lo spazio letterale per "non comuni"/"ultra rare" (verificato
// nel compilato: la struttura delle cartelle nei bucket usa gli stessi
// valori del CHECK su bustina_catalogo.rarita, spazi inclusi).
function bustinaImmagineUrl(rarita, nomeFile) {
    return supabaseClient.storage.from('bustina-immagini').getPublicUrl(`${rarita}/${nomeFile}.webp`);
}

function bustinaTestoUrl(rarita, nomeFile) {
    return supabaseClient.storage.from('bustina-testi').getPublicUrl(`${rarita}/${nomeFile}.txt`);
}
