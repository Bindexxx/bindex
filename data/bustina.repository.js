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

// ── Saldo polvere (2026-09-07) ──────────────────────────────────────────
// Vive qui e NON in data/missioni.repository.js perché quel file non è
// stato letto in questa sessione (regola d'oro: mai toccare un file mai
// esaminato senza prima leggerlo per intero) — anche se logicamente il
// saldo polvere è di dominio più ampio (missioni/traguardi accreditano
// polvere anche loro, non solo la bustina). Se in futuro si legge davvero
// missioni.repository.js, valutare se spostarla lì; per ora resta
// riusabile da qualunque punto del sito la importi.
//
// Sostituisce ricompenseSaldo(userId,'polvere') nei due punti in
// ui/phone.ui.js che leggevano il saldo per la status bar — stesso motivo
// di bustine_stato(): quella funzione somma le righe lato client e
// PostgREST tronca oltre ~1000 righe senza segnalarlo. Con la bustina che
// accredita polvere ad ogni doppione il rischio smette di essere teorico.
async function polvereSaldoLeggi() {
    return supabaseClient.rpc('polvere_saldo');
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

// ── Storage: bucket pubblico 'bustina-assets' — cutscene (2026-09-09) ──
// Struttura decisa da Claudio in sessione (2026-09-09), tutta dentro una
// sottocartella dedicata 'cutscene-data/' per isolare "tutto ciò che serve
// alla cutscene" dal resto del bucket:
//   cutscene-data/cutscene/mese{M}/giorno{N}.json   (M/N costruiti qui sotto)
//   cutscene-data/background/...   (libera, il path completo sta SEMPRE
//   cutscene-data/music/...         dentro il campo del json, es.
//   cutscene-data/sprite/...        "background/trama1/1.png" — il codice
//                                    NON deve mai sapere come sono
//                                    organizzate: si limita a concatenare
//                                    alla radice 'cutscene-data/'. Vedi
//                                    bustinaAssetUrl sotto.)
//   cutscene-data/sfx/strappare.mp3, cutscene-data/sfx/swush.mp3
//   cutscene-data/quotes/loading_quotes.json
//
// Confermato dal json di esempio caricato da Claudio in sessione: i campi
// background/music/actor.asset dentro i giorno{N}.json contengono GIÀ il
// path relativo completo (sottocartelle incluse) — bustinaAssetUrl() si
// limita a concatenarlo, non aggiunge/deduce nessun prefisso.

// URL pubblico del file cutscene per un dato mese/giorno. mese e giorno
// sono numeri interi (1-based), passati già calcolati/clampati dalla UI
// (vedi _bustinaMeseCorrente in ui/phone.ui.js — il clamp all'ultimo mese
// disponibile richiede bustinaCutsceneMesiDisponibili() sotto, PRIMA di
// chiamare questa).
function bustinaCutsceneUrl(mese, giorno) {
    return supabaseClient.storage.from('bustina-assets').getPublicUrl(`cutscene-data/cutscene/mese${mese}/giorno${giorno}.json`);
}

// Elenca le sottocartelle dentro cutscene-data/cutscene/ per scoprire
// quanti 'meseN' esistono DAVVERO nel bucket (decisione di Claudio: se
// mesi_completati+1 supera i mesi disponibili, restare sull'ultimo
// esistente — serve sapere qual è, non si può indovinare/hardcodare).
function bustinaCutsceneMesiDisponibili() {
    return supabaseClient.storage.from('bustina-assets').list('cutscene-data/cutscene', { limit: 1000 });
}

// URL pubblico di un asset citato DENTRO un giorno{N}.json (background,
// music, actor.asset) — pathRelativo è il valore letto dal json così
// com'è (es. "background/trama1/1.png"), concatenato alla radice
// cutscene-data/ senza alcuna deduzione di cartella.
function bustinaAssetUrl(pathRelativo) {
    return supabaseClient.storage.from('bustina-assets').getPublicUrl(`cutscene-data/${pathRelativo}`);
}

// URL pubblico dei due effetti sonori fissi (taglio busta / swipe carta),
// hardcoded nel prototipo originale, non citati da nessun json — cartella
// dedicata 'sfx/' (decisione di Claudio in sessione).
function bustinaSfxUrl(nomeFile) {
    return supabaseClient.storage.from('bustina-assets').getPublicUrl(`cutscene-data/sfx/${nomeFile}`);
}

// URL pubblico delle frasi di caricamento — BUG CORRETTO 2026-09-10: qui
// c'era 'bustina-assets', ma loading_quotes.json vive in un bucket
// SEPARATO, 'bustina-quotes' (struttura decisa da Claudio il 09/09, punto
// 4 del compilato di quella sessione — mai verificata dal vivo finché
// Claudio non ha mostrato gli screenshot di Supabase Storage oggi).
// Confermato: 'bustina-assets' contiene solo cutscene-data/{cutscene,
// background,music,sprite,sfx,quotes/countdown_quotes.json} — NON
// loading_quotes.json. Effetto del bug: due "Failed to load resource...
// 400" in console ad ogni apertura (fetch nel bucket sbagliato), silenzioso
// perché _bustinaFrase() ha già un fallback locale — mai bloccante, ma
// mai andato a segno neanche una volta.
function bustinaQuotesUrl() {
    return supabaseClient.storage.from('bustina-quotes').getPublicUrl('cutscene-data/quotes/loading_quotes.json');
}

// URL pubblico delle frasi per la schermata "nessuna bustina disponibile"
// (countdown pre-rinnovo, 2026-09-10). File separato da loading_quotes.json
// (stessa cartella 'quotes/'): sono frasi diverse per tono/contesto (non
// "sto aprendo", ma "aspetta") — tenerle divise evita che le due schermate
// peschino a caso l'una dalle frasi dell'altra. Formato atteso: array JSON
// di sole stringhe, SENZA alcun segnaposto tipo [tempo] — il countdown vero
// e proprio (HH:MM:SS) è renderizzato a parte dal codice, la frase è solo
// atmosfera (decisione di Claudio: "più comodo se nel json scrivo solo
// frasi e niente codice [tempo]").
function bustinaCountdownQuotesUrl() {
    return supabaseClient.storage.from('bustina-assets').getPublicUrl('cutscene-data/quotes/countdown_quotes.json');
}
