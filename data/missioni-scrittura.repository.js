// ═══════════════════════════════════════════════════════════════════════
// MISSIONI-SCRITTURA.REPOSITORY.JS — scrittura eventi/assegnazioni per il
// motore missioni (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP separato dal piano "riduzione accoppiamento" concordato con Claudio
// il 2026-09-11. Estratto da data/missioni.repository.js. NESSUNA
// riscrittura del codice esistente: solo spostamento, zero cambi di
// comportamento per l'utente finale.
//
// Contiene: registrazione eventi in activity_log (fire-and-forget, già
// chiamate da ui/*.js con try/catch) + assegnazione missioni/traguardi/
// ricompense (missioni_completate, traguardi_riscossi,
// inventario_ricompense — migration 32).
//
// Le funzioni di LETTURA restano in data/missioni.repository.js (incluse
// ricompenseSaldo e missioniBinderVisitatiDistintiTotale, che pur essendo
// tematicamente vicine a funzioni di scrittura di qui sotto sono pure
// letture — vedi nota in quel file).
//
// Dipende da: supabaseClient. ricompensaConsumaSkip qui sotto chiama
// ricompenseSaldo() cross-file (data/missioni.repository.js) — nessuna
// istruzione in nessuno dei due file gira a tempo di caricamento script
// (solo dichiarazioni di funzione), quindi l'ordine tra questo file e
// data/missioni.repository.js nei <script> tag di index.html è
// indifferente, purché entrambi carichino prima che qualcuno chiami
// ricompensaConsumaSkip().
// ───────────────────────────────────────────────────────────────────────

// ── Match cumulativi (traguardi #46-55, Fase 2 sbloccata 2026-09-01) ────
// 'action' nuovo: 'match_trovato'. La 'chiave' arriva già pronta dal
// chiamante (ui/queue.ui.js:aggiornaBadgeMatch()) — stessa identica
// formula di _chiaveMatch() (mia_carta_id+altra_wishlist_id / mia_wishlist_id
// +altra_carta_id), NON ricalcolata qui, per non rischiare che le due
// versioni si scollino nel tempo (stesso principio già dichiarato nel
// commento originale di _chiaveMatch in quel file).
//
// DEDUP IN SCRITTURA: un match è "trovato" una volta sola nella vita del
// dato, non ha senso riloggarlo ogni volta che il badge si aggiorna —
// verificato che NESSUNA missione esistente in CATALOGO_MISSIONI dipende
// da un conteggio di occorrenze ripetute su questo evento. La lettura
// corrispondente (missioniMatchTrovatiTotale) resta in
// data/missioni.repository.js.

// ── Match cumulativi (traguardi #46-55, Fase 2 sbloccata 2026-09-01) ────
// 'action' nuovo: 'match_trovato'. La 'chiave' arriva già pronta dal
// chiamante (ui/queue.ui.js:aggiornaBadgeMatch()) — stessa identica
// formula di _chiaveMatch() (mia_carta_id+altra_wishlist_id / mia_wishlist_id
// +altra_carta_id), NON ricalcolata qui, per non rischiare che le due
// versioni si scollino nel tempo (stesso principio già dichiarato nel
// commento originale di _chiaveMatch in quel file).
//
// DEDUP IN SCRITTURA (a differenza di missioniBinderPubblicoVisitatoRegistra
// sotto): un match è "trovato" una volta sola nella vita del dato, non ha
// senso riloggarlo ogni volta che il badge si aggiorna — verificato che
// NESSUNA missione esistente in CATALOGO_MISSIONI dipende da un conteggio
// di occorrenze ripetute su questo evento (a differenza della visita a un
// binder, dove invece una missione giornaliera esistente lo richiede — vedi
// nota su missioniBinderPubblicoVisitatoRegistra). Quindi qui deduplicare
// subito in scrittura è sicuro e tiene 'activity_log' più pulita.
async function missioniMatchTrovatiRegistraNuovi(userId, chiavi) {
    if (!chiavi || chiavi.length === 0) return { error: null };
    const { data, error: errLettura } = await supabaseClient.from('activity_log')
        .select('details').eq('user_id', userId).eq('action', 'match_trovato');
    if (errLettura) return { error: errLettura };
    const gia = new Set((data || []).map(r => r.details && r.details.chiave).filter(Boolean));
    const nuove = [...new Set(chiavi)].filter(c => !gia.has(c));
    if (nuove.length === 0) return { error: null };
    return supabaseClient.from('activity_log').insert(
        nuove.map(chiave => ({ user_id: userId, source: 'sito', action: 'match_trovato', details: { chiave } }))
    );
}


// ── activity_log (Fase 2, sbloccata 2026-08-31) — SOLO SCRITTURA ────────
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
// Le funzioni di LETTURA su activity_log (incluso
// missioniBinderVisitatiDistintiTotale, che leggeva proprio l'evento
// scritto da missioniBinderPubblicoVisitatoRegistra qui sotto) restano in
// data/missioni.repository.js.
//
// Tutte fire-and-forget, già chiamate da ui/*.js con try/catch.

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

// Aggancio: ui/phone.ui.js:_apriBinderAltruiMatch() — visita di un binder
// pubblico altrui via Match.
//
// MODIFICATA (2026-09-01): aggiunto binderId nel payload — serve per
// contare binder DISTINTI (traguardi #56-65, vedi
// missioniBinderVisitatiDistintiTotale in data/missioni.repository.js —
// SPOSTATA lì nello split lettura/scrittura del 2026-09-11, è una
// lettura), oltre alle visite totali già usate dalla missione giornaliera
// esistente (metrica binder_pubblico_visitato_periodo, >=1 al giorno).
//
// NIENTE DEDUP QUI IN SCRITTURA (a differenza di
// missioniMatchTrovatiRegistraNuovi sopra): quella missione giornaliera
// richiede di contare OGNI visita nel giorno, anche a un binder già
// visitato in passato — se deduplicassi qui in scrittura, una volta
// visitati tutti i binder distinti del gruppo quella missione diventerebbe
// impossibile da completare per sempre. Il dedup per il traguardo "binder
// distinti" avviene solo in lettura, vedi missioniBinderVisitatiDistintiTotale
// in data/missioni.repository.js.
async function missioniBinderPubblicoVisitatoRegistra(userId, binderId) {
    return supabaseClient.from('activity_log').insert({
        user_id: userId, source: 'sito', action: 'binder_pubblico_visitato',
        details: { binderId: binderId || null },
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


// ── missioni_completate / traguardi_riscossi / inventario_ricompense
// (migration 32) — Scrittura: assegnazione missioni/traguardi/ricompense ──
// Schema confermato dal compilato di sessione: missioni_completate
// (owner_id, missione_id, finestra, periodo, origine, completato_il),
// traguardi_riscossi (owner_id, traguardo_id, riscosso_il).
//
// Insert "nudo" (MAI upsert): su conflitto con l'UNIQUE di migration 32,
// Postgres ritorna error.code === '23505' — è il segnale esatto che
// MOTORE_MISSIONI._valutaEAssegnaUnGiro() usa per capire "già assegnata"
// senza duplicare la ricompensa (vedi ui/missioni.ui.js). Un upsert qui
// romperebbe silenziosamente questo meccanismo anti-doppio-accredito.
// Timestamp impostato esplicitamente dal client (new Date().toISOString()),
// stesso pattern già usato in data/user-settings.repository.js
// (aggiornato_il) invece di affidarsi a un eventuale DEFAULT lato DB non
// verificato.
//
// Le letture correlate (missioniCompletateTotale/Periodo/Id*,
// missioniTraguardiRiscossiIdTotale, ricompenseSaldo) restano in
// data/missioni.repository.js.

async function missioniInserisciCompletamento(userId, missioneId, finestra, periodo) {
    return supabaseClient.from('missioni_completate').insert({
        owner_id: userId,
        missione_id: missioneId,
        finestra,
        periodo,
        // CORRETTO 2026-08-31: vincolo CHECK verificato via pg_constraint
        // (missioni_completate_origine_check) ammette SOLO 'normale' o
        // 'skip' — 'automatico' (valore originale di questa funzione,
        // mai verificato) avrebbe fatto fallire OGNI insert con una
        // violazione CHECK, rompendo silenziosamente l'intera
        // funzionalità missioni. Trovato solo perché la verifica per
        // ricompensaConsumaSkip() sotto ha controllato lo stesso vincolo.
        origine: 'normale',
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

// "Consuma uno skip" (2026-08-31, comportamento deciso da Claudio: marca
// automaticamente la missione scelta come completata, invece di doverla
// soddisfare per davvero). Nessuna UI la consuma ancora — funzione pronta
// per quando ci sarà.
//
// Il consumo si registra come una riga con quantita NEGATIVA dello stesso
// tipo ('skip_missione'), non un UPDATE — coerente col fatto che
// 'inventario_ricompense' è un registro ad accumulo, mai una riga di
// saldo da aggiornare (stesso principio già seguito ovunque in questo
// file: mai distruggere lo storico).
//
// origine: 'skip' — valore VERIFICATO via pg_constraint
// (missioni_completate_origine_check ammette solo 'normale'/'skip'), non
// inventato. La verifica ha anche scoperto che missioniInserisciCompletamento()
// sopra usava 'automatico', un valore che avrebbe violato questo stesso
// vincolo su OGNI completamento — corretto in questo stesso giro (vedi
// commento su quella funzione).
//
// NON atomico: controllo saldo + consumo + completamento missione sono 3
// chiamate sequenziali separate, nessuna RPC/transazione dedicata — fuori
// scope per una funzione "minore, nessuna UI la usa ancora". Rischio
// teorico: due tap quasi simultanei potrebbero consumare più skip di
// quanti disponibili. Se/quando questa funzione avrà una UI reale,
// valutare una RPC SECURITY DEFINER dedicata per renderla atomica (stesso
// motivo per cui altre operazioni critiche del progetto — es.
// registra_apertura_binder_pubblico — sono RPC e non chiamate dirette).
async function ricompensaConsumaSkip(userId, missioneId, finestra, periodo) {
    const { data: saldo, error: errSaldo } = await ricompenseSaldo(userId, 'skip_missione');
    if (errSaldo) return { error: errSaldo };
    if (saldo < 1) return { error: { message: 'Nessuno skip disponibile' } };

    const { error: errConsumo } = await supabaseClient.from('inventario_ricompense').insert({
        owner_id: userId, tipo: 'skip_missione', riferimento_id: missioneId, quantita: -1,
        ottenuto_il: new Date().toISOString(),
    });
    if (errConsumo) return { error: errConsumo };

    // Stesso meccanismo anti-doppio-accredito di missioniInserisciCompletamento
    // (insert nudo, mai upsert — error.code '23505' se questa missione
    // risultasse già completata: a quel punto lo skip è già stato
    // consumato sopra ma il completamento fallisce per conflitto, non per
    // colonna sbagliata — un caso limite noto, non gestito automaticamente
    // qui: da decidere quando questa funzione avrà una UI reale se
    // rimborsare lo skip in quel caso specifico).
    return supabaseClient.from('missioni_completate').insert({
        owner_id: userId, missione_id: missioneId, finestra, periodo, origine: 'skip',
        completato_il: new Date().toISOString(),
    });
}
