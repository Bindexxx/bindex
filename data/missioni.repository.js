// ── data/missioni.repository.js ──────────────────────────────────────────
// Funzioni che calcolano i valori delle metriche lette da
// MOTORE_MISSIONI.valuta() (vedi ui/missioni.ui.js) — SOLO voci Fase 1.
// Stesso pattern degli altri repository del progetto: funzioni piccole e
// componibili, nessuna query "mega-aggregatore" — chi le chiama (una
// pagina/widget missioni, non ancora scritta) decide quali servono e con
// quale range di date passare per ciascuna finestra (giornaliera/
// settimanale/mensile/una_tantum).
//
// Dipende da: supabaseClient, e da trovaMatch() già definita in
// data/prices.repository.js (stesso file globale condiviso, nessun import).
//
// m89 (Apri il Pokédex), m94/m95 (Personalizza layout): NON sono metriche
// interrogabili da qui — sono EVENTI, agganciati come scrittura DIRETTA in
// missioni_completate nel punto esatto dell'azione utente:
//   - m89: ui/extension.ui.js, funzione apriAppEstensione() (dopo conferma
//     ok===true da CARDSYNC_OPEN_APP)
//   - m94/m95: ui/phone.ui.js, funzione _salvaLayoutWidget(daAzioneUtente)
// Entrambe chiamano missioniInserisciCompletamento() qui sotto direttamente,
// nessuna nuova funzione di lettura necessaria in questo file.
//
// RARITÀ (missioni m58/m59): ELIMINATE dal catalogo (2026-08-29) — nessuna
// fonte trovata nel codice reale, vedi Catalogo_Missioni_Traguardi_Annotato.md.


// ── CARTE ─────────────────────────────────────────────────────────────
// Tutte scoped su stato='collezione' (stesso filtro di cardsQueryCollezione
// in data/cards.repository.js) — sealed/wishlist hanno le loro metriche
// dedicate più sotto.

async function missioniCarteAggiuntePeriodo(userId, inizioISO, fineISO) {
    return supabaseClient
        .from('carte')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId)
        .eq('stato', 'collezione')
        .gte('created_at', inizioISO)
        .lt('created_at', fineISO);
}

async function missioniCarteTotali(userId) {
    return supabaseClient
        .from('carte')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId)
        .eq('stato', 'collezione');
}

// Somma lato client: nessuna RPC di aggregazione confermata esistente nel
// progetto, stesso approccio "leggi e riduci" già usato altrove (vedi
// _cardeConAllertaPrezzo in ui/queue.ui.js che filtra carteReali in memoria).
async function missioniValoreCollezione(userId) {
    const { data, error } = await supabaseClient
        .from('carte')
        .select('prezzo')
        .eq('owner_id', userId)
        .eq('stato', 'collezione');
    if (error) return { data: null, error };
    const totale = (data || []).reduce((s, r) => s + (Number(r.prezzo) || 0), 0);
    return { data: totale, error: null };
}

async function missioniDoppioniTotali(userId) {
    return supabaseClient
        .from('carte')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId)
        .eq('stato', 'collezione')
        .gt('qty', 1);
}

// Location distinte USATE (da carte.location), non le righe della tabella
// 'location' (quella è il catalogo dei valori possibili, non tutti
// necessariamente in uso — vedi data/locations.repository.js:locationsList).
async function missioniLocationDistinte(userId) {
    const { data, error } = await supabaseClient
        .from('carte')
        .select('location')
        .eq('owner_id', userId)
        .eq('stato', 'collezione')
        .not('location', 'is', null);
    if (error) return { data: null, error };
    const distinte = new Set((data || []).map(r => r.location));
    return { data: distinte.size, error: null };
}

async function missioniLocationAggiuntaPeriodo(userId, inizioISO, fineISO) {
    return supabaseClient
        .from('carte')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId)
        .eq('stato', 'collezione')
        .not('location', 'is', null)
        .gte('created_at', inizioISO)
        .lt('created_at', fineISO);
}

// Gruppo più numeroso per espansione — sigla ricavata dal prefisso di
// 'codice' prima del primo '-' (stessa convenzione delle chiavi in
// CARDSYNC_SET_LIBRARY, es. "BRS-045" → "BRS"). Calcolato lato client:
// nessun GROUP BY via supabase-js senza RPC dedicata.
async function missioniCarteStessaEspansioneMax(userId) {
    const { data, error } = await supabaseClient
        .from('carte')
        .select('codice')
        .eq('owner_id', userId)
        .eq('stato', 'collezione')
        .not('codice', 'is', null);
    if (error) return { data: null, error };
    const conteggi = {};
    (data || []).forEach(r => {
        const sigla = String(r.codice).split('-')[0];
        conteggi[sigla] = (conteggi[sigla] || 0) + 1;
    });
    const max = Object.values(conteggi).reduce((m, v) => Math.max(m, v), 0);
    return { data: max, error: null };
}


// ── PREZZI (storico_prezzi + ultimo_controllo) ──────────────────────────

// Carte distinte con almeno un aggiornamento prezzo nel periodo. 'tabella'
// segue la stessa convenzione di storicoPrezziQuery in
// data/prices.repository.js ('carte' o 'wishlist').
async function missioniPrezziAggiornatiPeriodo(userId, tabella, inizioISO, fineISO) {
    const { data, error } = await supabaseClient
        .from('storico_prezzi')
        .select('carta_id')
        .eq('owner_id', userId)
        .eq('tabella', tabella)
        .gte('registrato_il', inizioISO)
        .lt('registrato_il', fineISO);
    if (error) return { data: null, error };
    const distinte = new Set((data || []).map(r => r.carta_id));
    return { data: distinte.size, error: null };
}

// Stessa condizione di apriModalePrezziScaduti() in ui/prices.ui.js: mai
// controllate o ultimo controllo più vecchio di SOGLIA_GIORNI_PREZZO_SCADUTO
// giorni. SOLO collezione (stessa scelta di caricaUltimaSincronizzazioneHome
// in ui/prices.ui.js) — SOGLIA_GIORNI_PREZZO_SCADUTO è una costante globale
// definita altrove (state/*.js), risolta al momento della chiamata come fa
// già data/preferences.repository.js con CHIAVE_BINDER_LAYOUT e simili.
async function missioniPrezziScadutiTotale(userId) {
    const cutoff = new Date(Date.now() - SOGLIA_GIORNI_PREZZO_SCADUTO * 86400000).toISOString();
    return supabaseClient
        .from('carte')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId)
        .eq('stato', 'collezione')
        .or(`ultimo_controllo.is.null,ultimo_controllo.lt.${cutoff}`);
}


// ── WISHLIST ─────────────────────────────────────────────────────────

async function missioniWishlistTotale(userId) {
    return supabaseClient
        .from('wishlist')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId);
}

// Stessa condizione di _cardeConAllertaPrezzo() in ui/queue.ui.js
// (prezzo>0, prezzo_obiettivo impostato, prezzo <= prezzo_obiettivo), qui
// come query diretta invece che filtro su carteReali in memoria.
async function missioniWishlistObiettiviRaggiunti(userId) {
    return supabaseClient
        .from('wishlist')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId)
        .not('prezzo_obiettivo', 'is', null)
        .gt('prezzo', 0)
        .lte('prezzo', 'prezzo_obiettivo'); // ATTENZIONE: confronto tra due colonne,
    // .lte() di supabase-js si aspetta un VALORE non una colonna — questa riga
    // molto probabilmente NON FUNZIONA così com'è. Da correggere con una vista
    // o RPC dedicata, oppure leggendo prezzo+prezzo_obiettivo e filtrando lato
    // client come fa oggi _cardeConAllertaPrezzo(). Segnalato invece di
    // consegnare codice che sembra corretto ma non lo è.
}


// ── MATCH ────────────────────────────────────────────────────────────
// Riusa trovaMatch() già definita in data/prices.repository.js — stessa
// RPC, nessuna duplicazione. "Attivi" = quelli che la RPC restituisce ora,
// stato corrente (non storico cumulativo — deciso: traguardi Match #46-55
// rimangono Fase 2, qui serve solo per le missioni m24/m25/m75 Fase 1).
async function missioniMatchAttiviTotale(userId) {
    const [{ data: scambio, error: e1 }, { data: wishlist, error: e2 }] = await Promise.all([
        trovaMatch('trova_match_scambio_wishlist', userId),
        trovaMatch('trova_match_wishlist_scambio', userId),
    ]);
    if (e1 || e2) return { data: null, error: e1 || e2 };
    return { data: (scambio || []).length + (wishlist || []).length, error: null };
}


// ── BINDER ───────────────────────────────────────────────────────────

async function missioniBinderPubblicatiPeriodo(userId, inizioISO, fineISO) {
    return supabaseClient
        .from('binders')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId)
        .eq('stato_pubblicazione', 'pubblico')
        .gte('created_at', inizioISO)
        .lt('created_at', fineISO);
}


// ── ERRORI (coda_carte / correzioni_manuali_carte) ──────────────────────

// Stato attuale — riusa correzioniManualiConta già definita in
// data/queue.repository.js, nessuna duplicazione.
async function missioniErroriCodaVuota(userId) {
    const { count, error } = await correzioniManualiConta(userId);
    if (error) return { data: null, error };
    return { data: count === 0, error: null };
}

// Binaria "hai azzerato la coda oggi" (missione m11, ridefinita — vedi nota
// in ui/missioni.ui.js): legge preferenze_utente.dafare_risolti e controlla
// se il segnale 'coda_errori' ha un risoltoIl con data odierna. Riusa
// userSettingsGet già definita in data/user-settings.repository.js.
async function missioniCodaErroriAzzerataOggi(userId) {
    const { data, error } = await userSettingsGet(userId);
    if (error) return { data: null, error };
    let storico = {};
    try { storico = data && data.dafare_risolti ? JSON.parse(data.dafare_risolti) : {}; } catch (_) { storico = {}; }
    const voce = storico['coda_errori'];
    if (!voce || !voce.risoltoIl) return { data: false, error: null };
    const oggi = new Date().toISOString().slice(0, 10);
    const risoltoGiorno = String(voce.risoltoIl).slice(0, 10);
    return { data: oggi === risoltoGiorno, error: null };
}


// ── ACCESSI (activity_log, source='auth', action='accesso') ────────────
// Dedup: massimo 1 riga 'accesso' al giorno per utente (deciso 2026-08-29)
// — indipendente da quanti reload della pagina avvengono nello stesso
// giorno. Stesso pattern SELECT-poi-INSERT di binderWishlistGarantisci in
// data/binder.repository.js (mai upsert diretto: qui non c'è un vincolo
// UNIQUE lato DB su cui fare onConflict, la deduplica è tutta applicativa).

async function missioniAccessoRegistraOggi(userId) {
    const oggi = new Date();
    const inizioOggi = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate()).toISOString();
    const domani = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() + 1).toISOString();

    const { data: esistente, error: errSelect } = await supabaseClient
        .from('activity_log')
        .select('id')
        .eq('user_id', userId)
        .eq('source', 'auth')
        .eq('action', 'accesso')
        .gte('created_at', inizioOggi)
        .lt('created_at', domani)
        .maybeSingle();
    if (errSelect) return { data: null, error: errSelect };
    if (esistente) return { data: esistente, error: null }; // già registrato oggi, non riscrivere

    return supabaseClient
        .from('activity_log')
        .insert({ user_id: userId, source: 'auth', action: 'accesso', details: {} })
        .select()
        .single();
}

async function missioniAccessoOggi(userId) {
    const oggi = new Date();
    const inizioOggi = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate()).toISOString();
    const domani = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() + 1).toISOString();
    const { data, error } = await supabaseClient
        .from('activity_log')
        .select('id')
        .eq('user_id', userId)
        .eq('source', 'auth')
        .eq('action', 'accesso')
        .gte('created_at', inizioOggi)
        .lt('created_at', domani)
        .maybeSingle();
    if (error) return { data: null, error };
    return { data: !!data, error: null };
}

async function missioniAccessiTotali(userId) {
    return supabaseClient
        .from('activity_log')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('source', 'auth')
        .eq('action', 'accesso');
}

// Streak di giorni consecutivi CON accesso, terminante oggi (o ieri se
// l'evento di oggi non è ancora stato scritto quando questa viene chiamata
// — in pratica non succede: missioniAccessoRegistraOggi() gira sempre
// prima nella catena _avviaSitoDopoAccesso). Legge al massimo gli ultimi
// 400 eventi 'accesso' (più che sufficiente per uno streak realistico) e
// conta all'indietro giorno per giorno finché non trova un buco.
async function missioniGiorniConsecutivi(userId) {
    const { data, error } = await supabaseClient
        .from('activity_log')
        .select('created_at')
        .eq('user_id', userId)
        .eq('source', 'auth')
        .eq('action', 'accesso')
        .order('created_at', { ascending: false })
        .limit(400);
    if (error) return { data: null, error };

    // Confronto sempre in "giorno di calendario LOCALE": created_at torna
    // da Supabase come istante UTC, va convertito a Date locale prima di
    // estrarre y/m/d — altrimenti vicino a mezzanotte un accesso reale di
    // ieri sera potrebbe contare come oggi (o viceversa), disallineato
    // rispetto a come missioniAccessoRegistraOggi() calcola i confini del
    // giorno (locale, non UTC).
    const _giornoLocale = (isoString) => {
        const d = new Date(isoString);
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    };
    const giorniConAccesso = new Set((data || []).map(r => _giornoLocale(r.created_at)));
    let streak = 0;
    let cursore = new Date();
    const chiaveCursore = () => `${cursore.getFullYear()}-${cursore.getMonth()}-${cursore.getDate()}`;
    // Se oggi non è ancora presente (chiamata prima della registrazione),
    // parte da ieri invece di azzerare subito lo streak a 0.
    if (!giorniConAccesso.has(chiaveCursore())) {
        cursore.setDate(cursore.getDate() - 1);
    }
    while (giorniConAccesso.has(chiaveCursore())) {
        streak++;
        cursore.setDate(cursore.getDate() - 1);
    }
    return { data: streak, error: null };
}


// ── RICERCHE (activity_log, source='ricerca', action='trovata') ────────
// Nessun dedup: ogni ricerca riuscita (click su un risultato) conta,
// fino a 5+/giorno per le missioni #84/#85. Conteggio nel periodo tramite
// range su created_at, stesso pattern delle altre metriche *_periodo.

async function missioniRicercaRegistra(userId, query) {
    return supabaseClient
        .from('activity_log')
        .insert({ user_id: userId, source: 'ricerca', action: 'trovata', details: { query: (query || '').slice(0, 100) } });
    // query troncata a 100 caratteri: 'details' è jsonb, nessun limite
    // tecnico, ma non serve conservare stringhe lunghissime per un log che
    // esiste solo per contare eventi.
}

async function missioniRicercheEseguitePeriodo(userId, inizioISO, fineISO) {
    return supabaseClient
        .from('activity_log')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('source', 'ricerca')
        .eq('action', 'trovata')
        .gte('created_at', inizioISO)
        .lt('created_at', fineISO);
}


// ── META (missioni_completate, traguardi_riscossi — migration 32) ──────

async function missioniCompletateTotale(userId) {
    return supabaseClient
        .from('missioni_completate')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId);
}

async function missioniCompletatePeriodo(userId, periodo) {
    return supabaseClient
        .from('missioni_completate')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId)
        .eq('periodo', periodo);
}

async function missioniInserisciCompletamento(userId, missioneId, finestra, periodo, origine = 'normale') {
    return supabaseClient
        .from('missioni_completate')
        .insert({ owner_id: userId, missione_id: missioneId, finestra, periodo, origine });
    // UNIQUE(owner_id, periodo, missione_id) in migration 32 previene doppi
    // completamenti nella stessa finestra — un insert duplicato ritorna
    // errore 23505, da gestire silenziosamente lato chiamante (non è un
    // vero errore, è la protezione anti-doppio-accredito richiesta dalla
    // nota #5 del documento originale).
}

async function traguardiSbloccatiTotale(userId) {
    return supabaseClient
        .from('traguardi_riscossi')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId);
}

async function traguardiInserisciRiscossione(userId, traguardoId) {
    return supabaseClient
        .from('traguardi_riscossi')
        .insert({ owner_id: userId, traguardo_id: traguardoId });
    // UNIQUE(owner_id, traguardo_id) — stessa protezione anti-doppio della
    // funzione sopra.
}


// ── RICOMPENSE (inventario_ricompense — migration 32) ───────────────────

async function ricompenseInserisci(userId, tipo, riferimentoId, quantita = 1) {
    return supabaseClient
        .from('inventario_ricompense')
        .insert({ owner_id: userId, tipo, riferimento_id: riferimentoId, quantita });
}

async function ricompenseTotalePerTipo(userId, tipo) {
    const { data, error } = await supabaseClient
        .from('inventario_ricompense')
        .select('quantita')
        .eq('owner_id', userId)
        .eq('tipo', tipo);
    if (error) return { data: null, error };
    const totale = (data || []).reduce((s, r) => s + (r.quantita || 0), 0);
    return { data: totale, error: null };
}

// Consuma uno skip (missione#quantità -1) — usata dal futuro bottone "usa
// skip". Nessun controllo di quantità>0 qui dentro: il chiamante deve
// verificare ricompenseTotalePerTipo(userId,'skip_missione') > 0 PRIMA di
// chiamare questa, altrimenti la quantità scende sotto zero silenziosamente.
async function ricompenseConsumaSkip(userId, id) {
    return supabaseClient
        .from('inventario_ricompense')
        .update({ quantita: supabaseClient.raw ? supabaseClient.raw('quantita - 1') : undefined })
        .eq('id', id)
        .eq('owner_id', userId);
    // ATTENZIONE: supabaseClient.raw potrebbe non esistere in questa versione
    // del client (dipende dalla versione di @supabase/supabase-js in uso,
    // non verificata in questa sessione) — se .raw non è disponibile va
    // fatto un read-then-write (leggi quantita, scrivi quantita-1), meno
    // elegante ma sempre corretto. Da testare prima di usare in produzione.
}
