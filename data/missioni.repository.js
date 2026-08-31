// ── data/missioni.repository.js ──────────────────────────────────────────
// Tabelle 'missioni_completate', 'traguardi_riscossi', 'inventario_ricompense'
// (migration 32, eseguita su Bindexxx) + 'activity_log' (Fase 2, schema
// verificato 2026-08-31) + funzioni di lettura che aggregano dati da
// tabelle già esistenti (carte, wishlist, storico_prezzi, location,
// binders, correzioni_manuali_carte, preferenze_utente) per alimentare
// MOTORE_MISSIONI.raccogliDati() in ui/missioni.ui.js.
//
// STATO (2026-08-31): copertura COMPLETA di tutte le funzioni chiamate da
// MOTORE_MISSIONI.raccogliDati() — verificato con un confronto incrociato
// automatico tra le chiamate reali nel motore E in tutti i file ui/*.js
// disponibili in questa sessione (phone/prices/navigation/home/auth),
// zero mancanti, zero orfane. Include sia Fase 1 (dati/stato già
// esistenti) sia Fase 2 (eventi via activity_log, schema confermato via
// information_schema — non dedotto). L'aggancio per lo streak accessi
// (ui/auth.ui.js:_avviaSitoDopoAccesso(), chiamata ad ogni reload) esiste
// già nel codice reale — richiedeva che missioniAccessoRegistraOggi()
// dedupllicasse da sola (1 riga/giorno anche con reload multipli), non
// solo un semplice insert: implementato di conseguenza.
//
// 3 ASSUNZIONI SEGNALATE, non stub ma da tenere d'occhio (implementate,
// funzionanti, ma non verificate al 100% contro il codice reale):
//   - missioniLocationDistinte: legge da 'location', non da
//     DISTINCT carte.location — da confermare con Claudio.
//   - missioniCarteStessaEspansioneMax: formato del codice carta (sigla =
//     prefisso prima dello spazio) — non verificata contro il vero parser
//     sigle di ui/phone.ui.js (_ballLeggiCodice/_ballSetBase, non letto
//     in questa sessione).
//   - missioniWishlistObiettiviRaggiunti: assume che 'wishlist' condivida
//     i nomi colonna di 'carte' (prezzo, prezzo_obiettivo) — non
//     verificata direttamente (la query information_schema copriva solo
//     activity_log/carte/binders).
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
async function missioniLocationDistinte(userId) {
    const { data, error } = await supabaseClient.from('location').select('nome').eq('owner_id', userId);
    if (error) return { data: 0, error };
    return { data: (data || []).length, error: null };
}

async function missioniLocationAggiuntaPeriodo(userId, inizioISO, fineISO) {
    return supabaseClient.from('carte').select('id', { count: 'exact', head: true })
        .eq('owner_id', userId).eq('stato', 'collezione').not('location', 'is', null)
        .gte('created_at', inizioISO).lt('created_at', fineISO);
}

// Raggruppa per sigla-espansione (prefisso del codice carta, prima dello
// spazio — es. "ASC 123/217" -> "ASC") e ritorna la dimensione del gruppo
// più numeroso. Nome colonna VERIFICATO: 'codice', non 'code'. ASSUNZIONE
// sul formato del valore: non verificata contro il vero parser sigle di
// ui/phone.ui.js (_ballLeggiCodice/_ballSetBase, non letto in questa
// sessione) — se quel parser usa una convenzione diversa (es. separatore
// diverso, sigle X-prefix da deduplicare — vedi nota "X-prefix sigle" nei
// learnings), allineare qui.
async function missioniCarteStessaEspansioneMax(userId) {
    const { data, error } = await supabaseClient.from('carte').select('codice')
        .eq('owner_id', userId).eq('stato', 'collezione');
    if (error) return { data: 0, error };
    const conteggi = {};
    (data || []).forEach(r => {
        const sigla = (r.codice || '').trim().split(/\s+/)[0];
        if (!sigla) return;
        conteggi[sigla] = (conteggi[sigla] || 0) + 1;
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


// ── activity_log (Fase 2, sbloccata 2026-08-31) ──────────────────────────
// Schema VERIFICATO via information_schema (2026-08-31): id, user_id
// (uuid — NOT owner_id, unica tabella del progetto a chiamarla così),
// source (text), action (text), details (jsonb), created_at.
//
// Convenzione adottata qui (nessun vincolo DB a riguardo, solo coerenza
// applicativa):
//   source: sempre 'sito' per tutte le funzioni sotto (tutte scritte da
//           file ui/*.js del sito — l'estensione, se in futuro scriverà
//           anche lei eventi, userà un source diverso, es. 'estensione').
//   action: identificatore stabile dell'evento — vedi ogni funzione sotto.
//   details: payload jsonb specifico per action (widget id, carta id,
//            origine apertura, flag booleani).
//
// Query su campi jsonb: sintassi PostgREST '.eq("details->>chiave", val)'
// per estrarre come testo — confermata supportata da supabase-js.

// ─ Scrittura (fire-and-forget, già chiamate da ui/*.js con try/catch) ─

// Aggancio: ui/phone.ui.js:_eseguiAzioneWidget() — loggato per TUTTI i
// widget aperti, anche quelli senza ancora una missione agganciata (vedi
// commento originale in quel file).
async function missioniAperturaWidgetRegistra(userId, widgetId) {
    return supabaseClient.from('activity_log').insert({
        user_id: userId, source: 'sito', action: 'apertura_widget', details: { widget: widgetId },
    });
}

// Aggancio: ui/home.ui.js:apriFlipCardHome() — 'origine' distingue da
// quale punto del sito si è aperta la carta (es. 'top_valore' per i
// widget classifica valore, vedi ui/phone.ui.js riga ~3123); 'vecchia' è
// il flag calcolato lì (card.createdAt non è di oggi).
async function missioniDettaglioCartaRegistra(userId, cartaId, origine, vecchia) {
    return supabaseClient.from('activity_log').insert({
        user_id: userId, source: 'sito', action: 'apertura_dettaglio_carta',
        details: { cartaId, origine: origine || null, vecchia: !!vecchia },
    });
}

// Aggancio: ui/navigation.ui.js:vaiARisultatoRicerca() — solo click su un
// risultato trovato (ricerca "riuscita"), non ogni tasto premuto.
async function missioniRicercaRegistra(userId, nomeCarta) {
    return supabaseClient.from('activity_log').insert({
        user_id: userId, source: 'sito', action: 'ricerca_eseguita', details: { nome: nomeCarta || null },
    });
}

// Aggancio: ui/prices.ui.js (2 punti — controllo prezzi collezione/wishlist).
async function missioniEstensioneFunzioneUsataRegistra(userId) {
    return supabaseClient.from('activity_log').insert({
        user_id: userId, source: 'sito', action: 'estensione_funzione_usata', details: {},
    });
}

// Aggancio: ui/phone.ui.js — visita di un binder pubblico altrui via Match.
async function missioniBinderPubblicoVisitatoRegistra(userId) {
    return supabaseClient.from('activity_log').insert({
        user_id: userId, source: 'sito', action: 'binder_pubblico_visitato', details: {},
    });
}

// Aggancio: ui/phone.ui.js — generazione di un QR di condivisione.
async function missioniQrGeneratoRegistra(userId) {
    return supabaseClient.from('activity_log').insert({
        user_id: userId, source: 'sito', action: 'qr_generato', details: {},
    });
}

// Aggancio REALE trovato in questa sessione: ui/auth.ui.js:
// _avviaSitoDopoAccesso() — chiamata ad OGNI avvio/reload del sito, non
// solo al login, col commento esplicito "dedup a 1/giorno gestito dentro
// la funzione stessa ... sicuro chiamarla ad ogni reload, anche più volte
// nello stesso giorno". SELECT-poi-INSERT (stesso pattern già usato in
// data/binder.repository.js:binderWishlistGarantisci/binderExtraGarantisci
// per la stessa ragione: nessun vincolo UNIQUE noto su activity_log per
// farlo in un solo passaggio) — senza questo controllo, ogni reload della
// pagina aggiungerebbe una riga 'accesso', gonfiando accessi_totali ben
// oltre "una volta al giorno".
async function missioniAccessoRegistraOggi(userId) {
    const oggiInizio = new Date(); oggiInizio.setHours(0, 0, 0, 0);
    const { count, error: errCheck } = await supabaseClient.from('activity_log')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('action', 'accesso').gte('created_at', oggiInizio.toISOString());
    if (errCheck) return { error: errCheck };
    if ((count || 0) > 0) return { error: null }; // già registrato oggi, nulla da fare

    return supabaseClient.from('activity_log').insert({
        user_id: userId, source: 'sito', action: 'accesso', details: {},
    });
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
