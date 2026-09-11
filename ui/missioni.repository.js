// ── data/missioni.repository.js ──────────────────────────────────────────
// Funzioni di LETTURA che alimentano MOTORE_MISSIONI.raccogliDati() (vedi
// ui/missioni.ui.js) — aggregano dati da tabelle già esistenti (carte,
// wishlist, storico_prezzi, location, binders, correzioni_manuali_carte,
// preferenze_utente) e da activity_log (Fase 2).
//
// STEP separato dal piano "riduzione accoppiamento" concordato con Claudio
// il 2026-09-11 (dopo il taglio di ui/paginainiziale.ui.js e
// ui/missioni.ui.js). Le funzioni di SCRITTURA (registrazione eventi
// activity_log, assegnazione missioni/traguardi/ricompense) sono state
// spostate in data/missioni-scrittura.repository.js — NESSUNA riscrittura
// del codice esistente in nessuna delle due parti: solo spostamento, zero
// cambi di comportamento.
//
// Tabelle DB di supporto (migration 32, eseguita su Bindexxx):
//   missioni_completate(owner_id, missione_id, finestra, periodo, origine, completato_il)
//   traguardi_riscossi(owner_id, traguardo_id, riscosso_il)
//   inventario_ricompense(owner_id, tipo, riferimento_id, quantita, ottenuto_il)
//
// ATTENZIONE COLLISIONE NOMI: verificare che CATALOGO_MISSIONI, CATALOGO_TRAGUARDI,
// MOTORE_MISSIONI non collidano con altri script già caricati.
//
// Dipende da: supabaseClient. Per il match automatico riusa trovaMatch()
// già definita in data/prices.repository.js (stessa RPC di
// ui/queue.ui.js:aggiornaBadgeMatch/caricaMatch) — deve essere caricata
// prima di questo file in index.html, come tutti gli altri repository.


// ── Carte / Wishlist ──────────────────────────────────────────────────

// Colonna VERIFICATA (information_schema, 2026-08-31): 'created_at'.
async function missioniCarteAggiuntePeriodo(userId, inizioISO, fineISO) {
    return supabaseClient.from('carte').select('id', { count: 'exact', head: true })
        .eq('owner_id', userId).eq('stato', 'collezione')
        .gte('created_at', inizioISO).lt('created_at', fineISO);
}

async function missioniCarteTotali(userId) {
    return supabaseClient.from('carte').select('id', { count: 'exact', head: true })
        .eq('owner_id', userId).eq('stato', 'collezione');
}

// Somma prezzi lato client: Supabase REST non ha una SUM() diretta senza
// una funzione RPC dedicata (non esiste ancora) — fetch della sola
// colonna prezzo, niente altro. Nome colonna VERIFICATO (information_schema,
// 2026-08-31): 'prezzo', non 'price' (correzione rispetto al primo giro).
async function missioniValoreCollezione(userId) {
    const { data, error } = await supabaseClient.from('carte').select('prezzo')
        .eq('owner_id', userId).eq('stato', 'collezione');
    if (error) return { data: 0, error };
    const totale = (data || []).reduce((s, r) => s + (Number(r.prezzo) || 0), 0);
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
// DECISIONE (2026-08-31, confermata con dati reali su richiesta di
// Claudio): conta DISTINCT carte.location, non le righe della tabella
// 'location'. Verificato con una query di confronto sui due utenti reali:
// i numeri NON coincidono in nessuno dei due casi — un utente aveva 11
// location create ma 12 usate (almeno un valore orfano su qualche carta,
// mai presente/non più presente nella tabella location), l'altro 1
// location creata ma 0 usate (slot creato, mai assegnato a una carta).
// Contare la tabella 'location' premierebbe la creazione di slot vuoti
// invece dell'organizzazione reale della collezione — DISTINCT su
// carte.location misura l'azione vera ("quante location usi davvero") ed
// è immune sia agli slot vuoti sia cattura comunque i valori orfani.
async function missioniLocationDistinte(userId) {
    const { data, error } = await supabaseClient.from('carte').select('location')
        .eq('owner_id', userId).eq('stato', 'collezione').not('location', 'is', null);
    if (error) return { data: 0, error };
    return { data: new Set((data || []).map(r => r.location)).size, error: null };
}

async function missioniLocationAggiuntaPeriodo(userId, inizioISO, fineISO) {
    return supabaseClient.from('carte').select('id', { count: 'exact', head: true })
        .eq('owner_id', userId).eq('stato', 'collezione').not('location', 'is', null)
        .gte('created_at', inizioISO).lt('created_at', fineISO);
}

// Raggruppa per set base (dopo aver ricondotto varianti X-prefix/PPS/BOO e
// alias) e ritorna la dimensione del gruppo più numeroso. Riusa il vero
// parser sigle di ui/phone.ui.js — _ballLeggiCodice()/_ballSetBase() —
// letto per intero in questa sessione (2026-08-31), non più
// un'approssimazione "prefisso prima dello spazio": quel parser gestisce
// varianti X (XASC -> ASC, stesso set), bustine premio PPS<n>-<SIGLA>,
// Trick or Trade BOO<n>-<SIGLA>, e una tabella di alias per sigle non
// standard (SM->SMP, TR->RO, ecc.) — duplicare una versione semplificata
// qui avrebbe prodotto conteggi sbagliati (es. XASC contato come set
// diverso da ASC). _ballLeggiCodice è una funzione pura (nessuna
// dipendenza da DOM/supabaseClient), risolta al momento della chiamata
// come le altre costanti globali già referenziate in questo file — deve
// solo essere caricata da qualche parte nella pagina (ui/phone.ui.js),
// l'ordine esatto rispetto a questo file non è vincolante.
async function missioniCarteStessaEspansioneMax(userId) {
    const { data, error } = await supabaseClient.from('carte').select('codice')
        .eq('owner_id', userId).eq('stato', 'collezione');
    if (error) return { data: 0, error };
    const conteggi = {};
    (data || []).forEach(r => {
        const letto = typeof _ballLeggiCodice === 'function' ? _ballLeggiCodice(r.codice) : null;
        const set = letto ? letto.set : null;
        if (!set) return;
        conteggi[set] = (conteggi[set] || 0) + 1;
    });
    const max = Object.values(conteggi).reduce((m, n) => Math.max(m, n), 0);
    return { data: max, error: null };
}

async function missioniWishlistTotale(userId) {
    return supabaseClient.from('wishlist').select('id', { count: 'exact', head: true }).eq('owner_id', userId);
}

// Nome colonna VERIFICATO su 'carte' (information_schema): 'prezzo',
// 'prezzo_obiettivo'. ASSUNZIONE: 'wishlist' condivide gli stessi nomi
// colonna di 'carte' (coerente con l'intestazione di data/cards.
// repository.js: "stessa struttura di riga, stesse colonne condivise") —
// non verificato direttamente su 'wishlist' in questa sessione (la query
// information_schema girata da Claudio copriva solo activity_log/carte/
// binders).
async function missioniWishlistObiettiviRaggiunti(userId) {
    const { data, error } = await supabaseClient.from('wishlist').select('prezzo, prezzo_obiettivo')
        .eq('owner_id', userId).not('prezzo_obiettivo', 'is', null);
    if (error) return { count: 0, error };
    const conteggio = (data || []).filter(r => Number(r.prezzo) > 0 && Number(r.prezzo) <= Number(r.prezzo_obiettivo)).length;
    return { count: conteggio, error: null };
}


// ── Prezzi ────────────────────────────────────────────────────────────
// storico_prezzi non ha una colonna owner_id propria (verificato in
// data/prices.repository.js: storicoPrezziQuery filtra solo per
// carta_id IN [...] e tabella) — serve prima l'elenco degli id carta
// dell'utente, poi il conteggio di carta_id distinti aggiornati nel
// periodo. Due query invece di una, inevitabile con questo schema.
//
// BUG REALE (Claudio, screenshot DevTools 2026-09-10: due GET 400 Bad
// Request su storico_prezzi): mancava qui il blocco a 500 id che invece
// missioniPrezziScadutiTotale (poco sotto) già fa, con lo stesso commento
// che lo spiega — "evita URL troppo lunghe con collezioni grandi". Con
// tutta la collezione passata in un solo .in('carta_id', ids), su una
// collezione abbastanza grande l'URL della richiesta supera il limite e
// Supabase risponde 400. registrato_il è timestamp with time zone
// (verificato via information_schema — non era quindi un problema di tipo
// colonna, come inizialmente ipotizzato): il filtro .gte()/.lt() con
// stringhe ISO era già corretto, il problema era solo la lunghezza
// dell'URL. Stesso identico pattern di blocco riusato qui sotto, in
// parallelo con Promise.all come nella funzione gemella.
async function missioniPrezziAggiornatiPeriodo(userId, tabella, inizioISO, fineISO) {
    const { data: carte, error: errCarte } = await supabaseClient.from('carte').select('id')
        .eq('owner_id', userId).eq('stato', 'collezione');
    if (errCarte) return { data: 0, error: errCarte };
    const ids = (carte || []).map(c => c.id);
    if (ids.length === 0) return { data: 0, error: null };

    const DIMENSIONE_BLOCCO = 500;
    const blocchi = [];
    for (let i = 0; i < ids.length; i += DIMENSIONE_BLOCCO) blocchi.push(ids.slice(i, i + DIMENSIONE_BLOCCO));

    const risultati = await Promise.all(blocchi.map(blocco =>
        supabaseClient.from('storico_prezzi').select('carta_id')
            .eq('tabella', tabella).in('carta_id', blocco)
            .gte('registrato_il', inizioISO).lt('registrato_il', fineISO)
    ));
    const distinti = new Set();
    for (const { data, error } of risultati) {
        if (error) return { data: 0, error };
        (data || []).forEach(r => distinti.add(r.carta_id));
    }
    return { data: distinti.size, error: null };
}

// Riusa lo stesso identico pattern di ui/home.ui.js:_ultimoControlloPerCarta()
// (verificato in questa sessione, non dedotto): "ultimo controllo" non è
// una colonna su 'carte' — si calcola dal MAX(registrato_il) per carta_id
// in storico_prezzi (tabella 'carte'). SOGLIA_GIORNI_PREZZO_SCADUTO è una
// costante globale definita in uno state/*.js non caricato in questa
// sessione — referenziata per nome (stessa convenzione già usata altrove
// nel progetto, es. data/preferences.repository.js con CHIAVE_BINDER_
// LAYOUT): risolta al momento della chiamata, non della definizione,
// quindi l'ordine di caricamento tra questo file e lo state/*.js non è
// vincolante.
async function missioniPrezziScadutiTotale(userId) {
    const { data: carte, error: errCarte } = await supabaseClient.from('carte').select('id')
        .eq('owner_id', userId).eq('stato', 'collezione');
    if (errCarte) return { count: 0, error: errCarte };
    const ids = (carte || []).map(c => c.id);
    if (ids.length === 0) return { count: 0, error: null };

    // Blocchi da 500 id, stesso identico pattern di _ultimoControlloPerCarta
    // — evita URL troppo lunghe con collezioni grandi.
    const DIMENSIONE_BLOCCO = 500;
    const blocchi = [];
    for (let i = 0; i < ids.length; i += DIMENSIONE_BLOCCO) blocchi.push(ids.slice(i, i + DIMENSIONE_BLOCCO));

    const risultati = await Promise.all(blocchi.map(blocco => storicoPrezziQuery('carte', blocco)));
    const ultimoPerCarta = {};
    for (const { data, error } of risultati) {
        if (error) return { count: 0, error };
        (data || []).forEach(r => {
            if (!ultimoPerCarta[r.carta_id] || r.registrato_il > ultimoPerCarta[r.carta_id]) {
                ultimoPerCarta[r.carta_id] = r.registrato_il;
            }
        });
    }

    const sogliaMs = SOGLIA_GIORNI_PREZZO_SCADUTO * 24 * 60 * 60 * 1000;
    const adesso = Date.now();
    const scadute = ids.filter(id => {
        const ultimo = ultimoPerCarta[id];
        if (!ultimo) return true; // mai controllata
        return (adesso - new Date(ultimo).getTime()) > sogliaMs;
    }).length;

    return { count: scadute, error: null };
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

// ── Match cumulativi (traguardi #46-55, Fase 2 sbloccata 2026-09-01) ────
// La scrittura di 'match_trovato' (con dedup, vedi commento originale) è
// stata spostata in data/missioni-scrittura.repository.js
// (missioniMatchTrovatiRegistraNuovi) — qui restano solo le letture.

// Dedup già garantito in scrittura sopra: un count semplice basta, nessun
// bisogno di Set lato client qui (a differenza di
// missioniBinderVisitatiDistintiTotale sotto).
async function missioniMatchTrovatiTotale(userId) {
    return supabaseClient.from('activity_log').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('action', 'match_trovato');
}

// Colonna VERIFICATA (information_schema, 2026-08-31): 'created_at' anche
// su 'binders'.
async function missioniBinderPubblicatiPeriodo(userId, inizioISO, fineISO) {
    return supabaseClient.from('binders').select('id', { count: 'exact', head: true })
        .eq('owner_id', userId).eq('stato_pubblicazione', 'pubblico')
        .gte('created_at', inizioISO).lt('created_at', fineISO);
}


// ── Coda errori ───────────────────────────────────────────────────────
async function missioniErroriCodaVuota(userId) {
    const { count, error } = await correzioniManualiConta(userId);
    if (error) return { data: false, error };
    return { data: (count || 0) === 0, error: null };
}

// Struttura di dafare_risolti VERIFICATA in questa sessione (ui/phone.ui.js
// _segnaDaFareRisolto/renderPaginaDaFare): mappa { [id]: { testo,
// risoltoIl: ISOString } }. L'id del segnale "coda errori" è
// letteralmente 'coda_errori' (ui/phone.ui.js riga 456,
// segnali.push({ id: 'coda_errori', ... })) — non dedotto, letto nel file
// reale. "Oggi" = stesso giorno di calendario (confronto Year/Month/Date),
// stessa convenzione già usata per il flag "vecchia" in
// ui/home.ui.js:apriFlipCardHome(), non una finestra di 24h continue.
async function missioniCodaErroriAzzerataOggi(userId) {
    const { data, error } = await userSettingsGet(userId);
    if (error) return { data: false, error };

    let storico = {};
    try { storico = (data && data.dafare_risolti) ? JSON.parse(data.dafare_risolti) : {}; } catch (_) { storico = {}; }

    const voce = storico['coda_errori'];
    if (!voce || !voce.risoltoIl) return { data: false, error: null };

    const oggi = new Date();
    const d = new Date(voce.risoltoIl);
    const risoltoOggi = d.getFullYear() === oggi.getFullYear() && d.getMonth() === oggi.getMonth() && d.getDate() === oggi.getDate();
    return { data: risoltoOggi, error: null };
}


// ── activity_log (Fase 2, sbloccata 2026-08-31) — SOLO LETTURA ──────────
// Schema VERIFICATO via information_schema (2026-08-31): id, user_id
// (uuid — NOT owner_id, unica tabella del progetto a chiamarla così),
// source (text), action (text), details (jsonb), created_at.
//
// La scrittura (registrazione eventi, fire-and-forget) è stata spostata in
// data/missioni-scrittura.repository.js — qui restano solo le funzioni che
// leggono/aggregano da activity_log.
//
// Query su campi jsonb: sintassi PostgREST '.eq("details->>chiave", val)'
// per estrarre come testo — confermata supportata da supabase-js.

// missioniBinderVisitatiDistintiTotale: nel file originale viveva subito
// dopo missioniBinderPubblicoVisitatoRegistra (ora in
// missioni-scrittura.repository.js) perché tematicamente collegata — ma è
// una LETTURA (SELECT + dedup lato client), quindi resta qui.

// Conteggio binder DISTINTI visitati nel tempo (traguardi #56-65) — dedup
// lato client via Set, stesso pattern già usato in
// missioniDettaglioCarteDistintePeriodo/missioniWidgetDistintiPeriodo (la
// scrittura corrispondente, missioniBinderPubblicoVisitatoRegistra in
// data/missioni-scrittura.repository.js, non dedupliza — per il motivo
// spiegato nel commento di quella funzione).
async function missioniBinderVisitatiDistintiTotale(userId) {
    const { data, error } = await supabaseClient.from('activity_log').select('details')
        .eq('user_id', userId).eq('action', 'binder_pubblico_visitato');
    if (error) return { data: 0, error };
    const distinti = new Set((data || []).map(r => r.details && r.details.binderId).filter(Boolean));
    return { data: distinti.size, error: null };
}

// ─ Lettura ──────────────────────────────────────────────────────────

async function missioniAccessoOggi(userId) {
    const oggiInizio = new Date(); oggiInizio.setHours(0, 0, 0, 0);
    const { count, error } = await supabaseClient.from('activity_log')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('action', 'accesso').gte('created_at', oggiInizio.toISOString());
    if (error) return { data: false, error };
    return { data: (count || 0) > 0, error: null };
}

async function missioniAccessiTotali(userId) {
    return supabaseClient.from('activity_log').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('action', 'accesso');
}

// Streak di giorni consecutivi CON accesso, fino a includere oggi (se non
// c'è ancora accesso oggi, lo streak riparte da ieri — comportamento
// standard di questo tipo di calcolo, coerente con "Torna domani"/
// "Costanza" che parlano di giorni consecutivi passati/in corso, non
// necessariamente concluso oggi).
async function missioniGiorniConsecutivi(userId) {
    const { data, error } = await supabaseClient.from('activity_log')
        .select('created_at').eq('user_id', userId).eq('action', 'accesso')
        .order('created_at', { ascending: false });
    if (error) return { data: 0, error };

    const giorniUnici = new Set((data || []).map(r => new Date(r.created_at).toISOString().slice(0, 10)));
    let cursore = new Date(); cursore.setHours(0, 0, 0, 0);
    // Se manca oggi, prova a partire da ieri (streak "in corso" fino a ieri).
    if (!giorniUnici.has(cursore.toISOString().slice(0, 10))) {
        cursore.setDate(cursore.getDate() - 1);
    }
    let streak = 0;
    while (giorniUnici.has(cursore.toISOString().slice(0, 10))) {
        streak++;
        cursore.setDate(cursore.getDate() - 1);
    }
    return { data: streak, error: null };
}

async function missioniRicercheEseguitePeriodo(userId, inizioISO, fineISO) {
    return supabaseClient.from('activity_log').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('action', 'ricerca_eseguita')
        .gte('created_at', inizioISO).lt('created_at', fineISO);
}

// Riusa missioniAperturaWidgetPeriodo sotto con widgetId='binder' — stesso
// evento generico, filtrato sul widget specifico.
async function missioniBinderAperturePeriodo(userId, inizioISO, fineISO) {
    return missioniAperturaWidgetPeriodo(userId, 'binder', inizioISO, fineISO);
}
async function missioniBinderApertureTotale(userId) {
    return supabaseClient.from('activity_log').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('action', 'apertura_widget').eq('details->>widget', 'binder');
}

// Generica: usata dal motore per ~10 widget diversi (visualizzazione,
// wishlist_obiettivi, prezzi, doppioni, match, location, valore_collezione,
// binder, estensione, ultima_carta) — un solo evento 'apertura_widget',
// filtrato sul campo jsonb 'widget'.
async function missioniAperturaWidgetPeriodo(userId, widgetId, inizioISO, fineISO) {
    return supabaseClient.from('activity_log').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('action', 'apertura_widget').eq('details->>widget', widgetId)
        .gte('created_at', inizioISO).lt('created_at', fineISO);
}

async function missioniDettaglioCartaAperturePeriodo(userId, inizioISO, fineISO) {
    return supabaseClient.from('activity_log').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('action', 'apertura_dettaglio_carta')
        .gte('created_at', inizioISO).lt('created_at', fineISO);
}

async function missioniQrGeneratoPeriodo(userId, inizioISO, fineISO) {
    return supabaseClient.from('activity_log').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('action', 'qr_generato')
        .gte('created_at', inizioISO).lt('created_at', fineISO);
}

async function missioniBinderPubblicoVisitatoPeriodo(userId, inizioISO, fineISO) {
    return supabaseClient.from('activity_log').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('action', 'binder_pubblico_visitato')
        .gte('created_at', inizioISO).lt('created_at', fineISO);
}

// 'origine' = 'top_valore' (vedi ui/phone.ui.js riga ~3123, stesso
// meccanismo già usato per le missioni citato in quel commento).
async function missioniDettaglioCartaTopValorePeriodo(userId, inizioISO, fineISO) {
    return supabaseClient.from('activity_log').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('action', 'apertura_dettaglio_carta').eq('details->>origine', 'top_valore')
        .gte('created_at', inizioISO).lt('created_at', fineISO);
}

// Conteggio di cartaId DISTINTI (non di aperture) — serve fetchare le
// righe e deduplicare lato client, PostgREST non ha un COUNT(DISTINCT ...)
// diretto via query builder senza una RPC dedicata.
async function missioniDettaglioCarteDistintePeriodo(userId, inizioISO, fineISO) {
    const { data, error } = await supabaseClient.from('activity_log').select('details')
        .eq('user_id', userId).eq('action', 'apertura_dettaglio_carta')
        .gte('created_at', inizioISO).lt('created_at', fineISO);
    if (error) return { data: 0, error };
    const distinte = new Set((data || []).map(r => r.details && r.details.cartaId).filter(Boolean));
    return { data: distinte.size, error: null };
}

async function missioniDettaglioCartaVecchiaPeriodo(userId, inizioISO, fineISO) {
    return supabaseClient.from('activity_log').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('action', 'apertura_dettaglio_carta').eq('details->>vecchia', 'true')
        .gte('created_at', inizioISO).lt('created_at', fineISO);
}

async function missioniEstensioneFunzioneUsataPeriodo(userId, inizioISO, fineISO) {
    return supabaseClient.from('activity_log').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('action', 'estensione_funzione_usata')
        .gte('created_at', inizioISO).lt('created_at', fineISO);
}

// Conteggio di widget DISTINTI aperti (non di aperture totali) — stesso
// motivo/tecnica di missioniDettaglioCarteDistintePeriodo sopra.
async function missioniWidgetDistintiPeriodo(userId, inizioISO, fineISO) {
    const { data, error } = await supabaseClient.from('activity_log').select('details')
        .eq('user_id', userId).eq('action', 'apertura_widget')
        .gte('created_at', inizioISO).lt('created_at', fineISO);
    if (error) return { data: 0, error };
    const distinti = new Set((data || []).map(r => r.details && r.details.widget).filter(Boolean));
    return { data: distinti.size, error: null };
}


// ── missioni_completate / traguardi_riscossi (migration 32) ─────────────
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

// Righe (missione_id, periodo) per un elenco di periodo specifici — usata
// da MOTORE_MISSIONI._valutaEAssegnaUnGiro (ui/missioni.ui.js) per sapere
// QUALI missioni tra quelle appena soddisfatte sono già state assegnate
// per il loro periodo corrente, prima di ritentare l'insert (stesso
// motivo/fix del 2026-09-10 già fatto per traguardi_riscossi, ma qui
// serve una query in più perché questo dato non era già raccolto altrove
// in raccogliDati()). Un solo IN(...) su periodo, non su missione_id: i
// periodo davvero in gioco in un dato momento sono sempre al massimo 4
// (oggi, questa settimana, questo mese, 'sempre' per le una_tantum).
async function missioniCompletateIdPerPeriodi(userId, periodi) {
    return supabaseClient.from('missioni_completate').select('missione_id, periodo')
        .eq('owner_id', userId).in('periodo', periodi);
}

async function missioniTraguardiRiscossiIdTotale(userId) {
    return supabaseClient.from('traguardi_riscossi').select('traguardo_id').eq('owner_id', userId);
}


// ── Saldo ricompense (LETTURA) ───────────────────────────────────────────
// ricompenseSaldo vive qui (non in missioni-scrittura.repository.js)
// perché è una lettura pura — nel file originale stava vicino alle
// funzioni di scrittura di 'inventario_ricompense' perché tematicamente
// collegata. ricompensaConsumaSkip (in missioni-scrittura.repository.js)
// la chiama cross-file per controllare il saldo prima di consumare uno
// skip — stesso meccanismo già in uso ovunque nel progetto (scope globale
// condiviso, funzioni risolte a tempo di chiamata).

// Saldo disponibile di un tipo di ricompensa. 'inventario_ricompense' è un
// REGISTRO AD ACCUMULO (verificato via information_schema, 2026-08-31:
// id/owner_id/tipo/riferimento_id/quantita/ottenuto_il — nessuna colonna
// "consumato"/flag, nessun saldo aggiornabile con UPDATE) — il saldo è
// sempre SOMMA(quantita) per tipo, righe negative = consumo (vedi
// ricompensaConsumaSkip in data/missioni-scrittura.repository.js — SPOSTATA
// lì durante lo split lettura/scrittura del 2026-09-11, riferimento
// aggiornato di conseguenza, nessun cambio di comportamento).
async function ricompenseSaldo(userId, tipo) {
    const { data, error } = await supabaseClient.from('inventario_ricompense')
        .select('quantita').eq('owner_id', userId).eq('tipo', tipo);
    if (error) return { data: 0, error };
    const saldo = (data || []).reduce((s, r) => s + (Number(r.quantita) || 0), 0);
    return { data: saldo, error: null };
}
