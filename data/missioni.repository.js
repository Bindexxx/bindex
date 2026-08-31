// ── data/missioni.repository.js ──────────────────────────────────────────
// Tabelle 'missioni_completate', 'traguardi_riscossi', 'inventario_ricompense'
// (migration 32, eseguita su Bindexxx) + funzioni di sola LETTURA che
// aggregano dati da tabelle già esistenti (carte, wishlist, storico_prezzi,
// location, binders, correzioni_manuali_carte) per alimentare
// MOTORE_MISSIONI.raccogliDati() in ui/missioni.ui.js.
//
// SCOPE DI QUESTA VERSIONE (2026-08-31) — SOLO "Categoria A": funzioni
// calcolabili da tabelle verificate nelle 7 data/*.repository.js caricate
// da Claudio in questa sessione. NESSUNA funzione che dipende da
// 'activity_log' (mai vista in questa sessione, schema non verificato —
// regola d'oro #3): quelle metriche (aperture widget, ricerche, streak
// accessi, dettaglio carta, estensione, ecc.) restano da scrivere in una
// sessione dedicata, con lo schema di activity_log verificato via query
// diretta + lettura di ui/phone.ui.js e ui/prices.ui.js (punti di
// scrittura evento). MOTORE_MISSIONI le valuterà comunque contro
// 'undefined' se richiamate nel frattempo — solo un warning in console,
// la missione semplicemente non risulta mai soddisfatta, nessun crash.
//
// STUB DELIBERATI qui sotto (4 funzioni): la tabella esiste sicuramente,
// ma un dettaglio preciso (nome colonna o struttura di un campo JSON) non
// è verificabile in questa sessione senza accesso diretto al DB o a un
// file non caricato — ritornano un default sicuro invece di indovinare.
// Ognuna spiega esattamente cosa manca e la query pronta da attivare.
//
// Dipende da: supabaseClient. Per il match automatico riusa trovaMatch()
// già definita in data/prices.repository.js (stessa RPC di
// ui/queue.ui.js:aggiornaBadgeMatch/caricaMatch) — deve essere caricata
// prima di questo file in index.html, come tutti gli altri repository.


// ── Carte / Wishlist ──────────────────────────────────────────────────

// STUB — 'carte' ha sicuramente una colonna di data creazione (usata lato
// JS come card.createdAt, vedi ui/home.ui.js m87 "Ritorno al passato"),
// ma il nome REALE della colonna DB non è stato verificato in questa
// sessione. Verificare con:
//   select column_name from information_schema.columns where table_name='carte';
// poi sostituire TODO_COLONNA_DATA nella query commentata sotto e
// attivarla al posto dello stub. Finché non è verificata, le missioni
// m02/m03/m04/m05/m16 (carte aggiunte oggi) non risultano mai soddisfatte
// — nessun errore, solo count sempre 0.
async function missioniCarteAggiuntePeriodo(userId, inizioISO, fineISO) {
    console.warn('[missioni] missioniCarteAggiuntePeriodo: colonna data-creazione di "carte" non verificata, vedi commento nel repository');
    return { count: 0, error: null };
    // Una volta verificata la colonna:
    // return supabaseClient.from('carte').select('id', { count: 'exact', head: true })
    //     .eq('owner_id', userId).eq('stato', 'collezione')
    //     .gte('TODO_COLONNA_DATA', inizioISO).lt('TODO_COLONNA_DATA', fineISO);
}

async function missioniCarteTotali(userId) {
    return supabaseClient.from('carte').select('id', { count: 'exact', head: true })
        .eq('owner_id', userId).eq('stato', 'collezione');
}

// Somma prezzi lato client: Supabase REST non ha una SUM() diretta senza
// una funzione RPC dedicata (non esiste ancora) — fetch della sola
// colonna price, niente altro.
async function missioniValoreCollezione(userId) {
    const { data, error } = await supabaseClient.from('carte').select('price')
        .eq('owner_id', userId).eq('stato', 'collezione');
    if (error) return { data: 0, error };
    const totale = (data || []).reduce((s, r) => s + (Number(r.price) || 0), 0);
    return { data: totale, error: null };
}

async function missioniDoppioniTotali(userId) {
    return supabaseClient.from('carte').select('id', { count: 'exact', head: true })
        .eq('owner_id', userId).eq('stato', 'collezione').gt('qty', 1);
}

// ASSUNZIONE (2026-08-31, da confermare con Claudio): "location distinte"
// letto dalla tabella 'location' (data/locations.repository.js — nome,
// owner_id, entrambi confermati), coerente con locationsList() già usata
// per popolare i binder-location. Se invece si intende DISTINCT su
// carte.location (i valori davvero assegnati a qualche carta, che
// potrebbero non coincidere 1:1 con le location "create" ma vuote),
// cambiare qui.
async function missioniLocationDistinte(userId) {
    const { data, error } = await supabaseClient.from('location').select('nome').eq('owner_id', userId);
    if (error) return { data: 0, error };
    return { data: (data || []).length, error: null };
}

// STUB — stesso blocco di missioniCarteAggiuntePeriodo sopra (colonna
// data-creazione di 'carte' non verificata), più filtro location non nulla.
async function missioniLocationAggiuntaPeriodo(userId, inizioISO, fineISO) {
    console.warn('[missioni] missioniLocationAggiuntaPeriodo: colonna data-creazione di "carte" non verificata, vedi commento nel repository');
    return { count: 0, error: null };
    // return supabaseClient.from('carte').select('id', { count: 'exact', head: true })
    //     .eq('owner_id', userId).eq('stato', 'collezione').not('location', 'is', null)
    //     .gte('TODO_COLONNA_DATA', inizioISO).lt('TODO_COLONNA_DATA', fineISO);
}

// Raggruppa per sigla-espansione (prefisso del codice carta, prima dello
// spazio — es. "ASC 123/217" -> "ASC") e ritorna la dimensione del gruppo
// più numeroso. ASSUNZIONE sul formato del codice: non verificata contro
// il vero parser sigle di ui/phone.ui.js (_ballLeggiCodice/_ballSetBase,
// non letto in questa sessione) — se quel parser usa una convenzione
// diversa (es. separatore diverso, sigle X-prefix da deduplicare — vedi
// nota "X-prefix sigle" nei learnings), allineare qui.
async function missioniCarteStessaEspansioneMax(userId) {
    const { data, error } = await supabaseClient.from('carte').select('code')
        .eq('owner_id', userId).eq('stato', 'collezione');
    if (error) return { data: 0, error };
    const conteggi = {};
    (data || []).forEach(r => {
        const sigla = (r.code || '').trim().split(/\s+/)[0];
        if (!sigla) return;
        conteggi[sigla] = (conteggi[sigla] || 0) + 1;
    });
    const max = Object.values(conteggi).reduce((m, n) => Math.max(m, n), 0);
    return { data: max, error: null };
}

async function missioniWishlistTotale(userId) {
    return supabaseClient.from('wishlist').select('id', { count: 'exact', head: true }).eq('owner_id', userId);
}

async function missioniWishlistObiettiviRaggiunti(userId) {
    const { data, error } = await supabaseClient.from('wishlist').select('price, prezzo_obiettivo')
        .eq('owner_id', userId).not('prezzo_obiettivo', 'is', null);
    if (error) return { count: 0, error };
    const conteggio = (data || []).filter(r => Number(r.price) > 0 && Number(r.price) <= Number(r.prezzo_obiettivo)).length;
    return { count: conteggio, error: null };
}


// ── Prezzi ────────────────────────────────────────────────────────────
// storico_prezzi non ha una colonna owner_id propria (verificato in
// data/prices.repository.js: storicoPrezziQuery filtra solo per
// carta_id IN [...] e tabella) — serve prima l'elenco degli id carta
// dell'utente, poi il conteggio di carta_id distinti aggiornati nel
// periodo. Due query invece di una, inevitabile con questo schema.
async function missioniPrezziAggiornatiPeriodo(userId, tabella, inizioISO, fineISO) {
    const { data: carte, error: errCarte } = await supabaseClient.from('carte').select('id')
        .eq('owner_id', userId).eq('stato', 'collezione');
    if (errCarte) return { data: 0, error: errCarte };
    const ids = (carte || []).map(c => c.id);
    if (ids.length === 0) return { data: 0, error: null };

    const { data, error } = await supabaseClient.from('storico_prezzi').select('carta_id')
        .eq('tabella', tabella).in('carta_id', ids)
        .gte('registrato_il', inizioISO).lt('registrato_il', fineISO);
    if (error) return { data: 0, error };
    return { data: new Set((data || []).map(r => r.carta_id)).size, error: null };
}

// STUB — la logica di "prezzo scaduto" (colonna, soglia giorni) vive in
// ui/prices.ui.js:apriModalePrezziScaduti() (menzionata nel commento
// originale del motore) — file non caricato in questa sessione, non
// improvviso né il nome colonna né il valore soglia.
async function missioniPrezziScadutiTotale(userId) {
    console.warn('[missioni] missioniPrezziScadutiTotale: serve ui/prices.ui.js per colonna/soglia reali, vedi commento nel repository');
    return { count: 0, error: null };
}


// ── Match / Binder ────────────────────────────────────────────────────
// Riusa trovaMatch() già esistente in data/prices.repository.js — somma
// entrambe le direzioni invece di reinventare la query RPC.
async function missioniMatchAttiviTotale(userId) {
    const [{ data: scambio, error: e1 }, { data: wishlist, error: e2 }] = await Promise.all([
        trovaMatch('trova_match_scambio_wishlist', userId),
        trovaMatch('trova_match_wishlist_scambio', userId),
    ]);
    if (e1 || e2) return { data: 0, error: e1 || e2 };
    return { data: (scambio || []).length + (wishlist || []).length, error: null };
}

// STUB — stesso blocco delle funzioni "colonna data-creazione" sopra,
// questa volta sulla tabella 'binders' (mai vista con colonne esplicite:
// binder.repository.js usa sempre select('*'), nessuna query mostra il
// nome della colonna data-creazione).
async function missioniBinderPubblicatiPeriodo(userId, inizioISO, fineISO) {
    console.warn('[missioni] missioniBinderPubblicatiPeriodo: colonna data-creazione di "binders" non verificata, vedi commento nel repository');
    return { count: 0, error: null };
    // return supabaseClient.from('binders').select('id', { count: 'exact', head: true })
    //     .eq('owner_id', userId).eq('stato_pubblicazione', 'pubblico')
    //     .gte('TODO_COLONNA_DATA', inizioISO).lt('TODO_COLONNA_DATA', fineISO);
}


// ── Coda errori ───────────────────────────────────────────────────────
async function missioniErroriCodaVuota(userId) {
    const { count, error } = await correzioniManualiConta(userId);
    if (error) return { data: false, error };
    return { data: (count || 0) === 0, error: null };
}

// STUB — la forma esatta di preferenze_utente.dafare_risolti (mappa JSON
// scritta da userSettingsUpsertDaFareRisolti in data/user-settings.
// repository.js) non è stata vista popolata da nessun file letto in
// questa sessione (probabile ui/dafare.ui.js, non caricato) — non
// indovino le chiavi della mappa. Ritorna sempre false finché non viene
// chiarita la struttura reale (serve capire come/dove la chiave
// "coda_errori" — vedi nota su m11 in missioni.ui.js — viene scritta nella
// mappa con un timestamp di risoluzione).
async function missioniCodaErroriAzzerataOggi(userId) {
    console.warn('[missioni] missioniCodaErroriAzzerataOggi: struttura di preferenze_utente.dafare_risolti non verificata, vedi commento nel repository');
    return { data: false, error: null };
}


// ── missioni_completate / traguardi_riscossi (migration 32) ─────────────
// Schema confermato dal compilato di sessione: missioni_completate
// (owner_id, missione_id, finestra, periodo, origine, completato_il),
// traguardi_riscossi (owner_id, traguardo_id, riscosso_il).

async function missioniCompletateTotale(userId) {
    return supabaseClient.from('missioni_completate').select('missione_id', { count: 'exact', head: true })
        .eq('owner_id', userId);
}

async function missioniCompletatePeriodo(userId, periodo) {
    return supabaseClient.from('missioni_completate').select('missione_id', { count: 'exact', head: true })
        .eq('owner_id', userId).eq('periodo', periodo);
}

async function missioniCompletateIdRangeTemporale(userId, inizioISO, fineISO) {
    return supabaseClient.from('missioni_completate').select('missione_id')
        .eq('owner_id', userId).gte('completato_il', inizioISO).lt('completato_il', fineISO);
}

async function missioniTraguardiRiscossiIdTotale(userId) {
    return supabaseClient.from('traguardi_riscossi').select('traguardo_id').eq('owner_id', userId);
}


// ── Scrittura: assegnazione missioni/traguardi/ricompense ───────────────
// Insert "nudo" (MAI upsert): su conflitto con l'UNIQUE di migration 32,
// Postgres ritorna error.code === '23505' — è il segnale esatto che
// MOTORE_MISSIONI._valutaEAssegnaUnGiro() usa per capire "già assegnata"
// senza duplicare la ricompensa (vedi ui/missioni.ui.js). Un upsert qui
// romperebbe silenziosamente questo meccanismo anti-doppio-accredito.
// Timestamp impostato esplicitamente dal client (new Date().toISOString()),
// stesso pattern già usato in data/user-settings.repository.js
// (aggiornato_il) invece di affidarsi a un eventuale DEFAULT lato DB non
// verificato.

async function missioniInserisciCompletamento(userId, missioneId, finestra, periodo) {
    return supabaseClient.from('missioni_completate').insert({
        owner_id: userId,
        missione_id: missioneId,
        finestra,
        periodo,
        origine: 'automatico',
        completato_il: new Date().toISOString(),
    });
}

async function traguardiInserisciRiscossione(userId, traguardoId) {
    return supabaseClient.from('traguardi_riscossi').insert({
        owner_id: userId,
        traguardo_id: traguardoId,
        riscosso_il: new Date().toISOString(),
    });
}

async function ricompenseInserisci(userId, tipo, riferimentoId, quantita) {
    return supabaseClient.from('inventario_ricompense').insert({
        owner_id: userId,
        tipo,
        riferimento_id: riferimentoId,
        quantita: quantita || 1,
        ottenuto_il: new Date().toISOString(),
    });
}
