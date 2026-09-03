// ── ui/missioni-watcher.js ───────────────────────────────────────────────
// Notifica missioni/traguardi NON APPENA vengono completati, senza dover
// aprire la pagina Missioni (Claudio, 2026-09-03).
//
// PERCHÉ UN FILE NUOVO E NON UN AGGANCIO A phone.ui.js
// Il candidato naturale sembrava il polling lento di phone.ui.js (60s,
// quello dove gira aggiornaBadgeMatch). Non va bene: quel ciclo comincia
// con "se è aperta una pagina di dettaglio, esci subito" — e le missioni
// si completano quasi sempre DENTRO una pagina (inserimento carta,
// aggiornamento prezzo, wishlist). Agganciandolo lì la notifica sarebbe
// arrivata solo al ritorno in home, cioè quasi come prima.
// Questo watcher ha un timer suo, senza quella guardia.
//
// PERCHÉ NON OGNI 60 SECONDI
// MOTORE_MISSIONI.valutaEAssegna() → raccogliDati() lancia 47 query in
// parallelo, e fa un SECONDO giro completo se il primo ha assegnato
// qualcosa (fino a 94). A 60s sarebbero ~2.800 query/ora per utente, in
// gran parte per sentirsi dire "niente di nuovo". A 3 minuti scendono a
// ~940 e l'attesa peggiore resta accettabile. Se vuoi cambiare, tocca
// solo la costante qui sotto — ma sotto i 60s il costo torna a mordere.
//
// PERCHÉ NON SERVE NESSUN "GIÀ NOTIFICATO"
// A differenza delle notifiche di Match/prezzo-obiettivo (che hanno avuto
// bisogno di _giaNotificati in queue.ui.js), qui la protezione è già nel
// database: nuoveMissioni/nuoviTraguardi contengono SOLO le righe che
// l'insert è riuscito a scrivere davvero, e l'UNIQUE della migration 32
// fa fallire con 23505 ogni tentativo successivo. Una missione entra in
// quell'elenco una volta sola nella storia dell'account — non per
// sessione, non per dispositivo. Nessun localStorage, nessuna nuova
// preferenza in data/preferences.repository.js.
//
// PERCHÉ phone.ui.js NON È STATO TOCCATO
// Le due righe di CSBar.avvisa dentro renderPaginaMissioni restano dove
// sono e NON producono doppioni: se il watcher ha già assegnato, quando
// apri la pagina l'insert fallisce, nuoveMissioni torna vuoto e la
// notifica non parte. È lo stesso vincolo del database a fare da arbitro
// fra i due punti di aggancio.

// ── PARAMETRI ────────────────────────────────────────────────────────────
// Ogni quanto controllare. 180000 = 3 minuti (attesa media ~1,5 min).
const INTERVALLO_WATCHER_MISSIONI_MS = 180000;
// Attesa prima del primo controllo dopo il caricamento pagina. Serve a non
// aggiungere 47 query al momento più affollato dell'avvio (login, estensione,
// initPhoneShell, primo render dei widget) e a dare tempo a CSBar.init() di
// girare dentro initPhoneShell: senza, la prima notifica non avrebbe dove
// comparire.
const RITARDO_PRIMO_GIRO_WATCHER_MS = 20000;

let _watcherMissioniInterval = null;
let _watcherMissioniTimeoutAvvio = null;
// Guardia di rientro: un giro può durare più dell'intervallo su rete lenta.
// Senza questa, due valutazioni si sovrapporrebbero e proverebbero a
// inserire lo stesso completamento — non un danno (ci pensa l'UNIQUE), ma
// 94 query sprecate e due notifiche possibili per la stessa missione.
let _watcherMissioniInCorso = false;
// Quando è girato l'ultimo controllo davvero eseguito (non saltato).
let _watcherMissioniUltimoGiro = 0;

// ── UN GIRO DI CONTROLLO ─────────────────────────────────────────────────
// Ritorna sempre senza lanciare: un errore qui non deve mai rompere il
// resto della pagina, che di questo watcher non sa niente.
async function _watcherMissioniGiro() {
    if (_watcherMissioniInCorso) return;

    // Scheda in secondo piano: niente query. Il telefono in tasca con la
    // scheda aperta non deve consumare batteria e dati per notifiche che
    // nessuno sta guardando. Al ritorno in primo piano ci pensa il
    // listener di visibilitychange più sotto a recuperare subito.
    if (document.hidden) return;

    // Se l'utente è GIÀ sulla pagina Missioni, salto: renderPaginaMissioni()
    // fa esattamente la stessa valutazione e le sue notifiche bastano.
    // Farla girare anche qui significherebbe raddoppiare le query e lasciare
    // la pagina a schermo con dati vecchi di un istante.
    const sezioneMissioni = document.getElementById('missioni');
    if (sezioneMissioni && sezioneMissioni.classList.contains('active')) return;

    // Dipendenze: tutte globali, caricate da index.html. Se una manca
    // (ordine degli script cambiato, file non caricato) esco in silenzio
    // invece di riempire la console ogni 3 minuti.
    if (typeof MOTORE_MISSIONI === 'undefined' || typeof authGetUserId !== 'function') return;
    if (typeof CSBar === 'undefined') return;

    _watcherMissioniInCorso = true;
    try {
        const userId = await authGetUserId();
        if (!userId) return; // non loggato: niente da valutare

        _watcherMissioniUltimoGiro = Date.now();

        const risultato = await MOTORE_MISSIONI.valutaEAssegna(userId);
        const nuoveMissioni = (risultato && risultato.nuoveMissioni) || [];
        const nuoviTraguardi = (risultato && risultato.nuoviTraguardi) || [];

        if (!nuoveMissioni.length && !nuoviTraguardi.length) return;

        // Stessa identica forma di chiamata usata da renderPaginaMissioni:
        // tipi già registrati in CSBar.init (notificationTypes), titoli
        // reali dal catalogo, raggruppamento per tipo già gestito dalla
        // barra. Nessun tipo nuovo da dichiarare.
        nuoveMissioni.forEach(m => CSBar.avvisa('missione-completata', { text: m.titolo }));
        nuoviTraguardi.forEach(t => CSBar.avvisa('traguardo-sbloccato', { text: t.titolo }));

        // Beep "vinto" — 1200Hz, lo stesso di renderPaginaMissioni. Rispetta
        // già da sé la preferenza suoni (prefSuoniWidgetGet dentro _beep).
        if (typeof _beep === 'function') _beep(1200, 90);

        // Saldo polvere nella status bar: riletto SOLO se è successo
        // qualcosa, come fa renderPaginaMissioni. Le ricompense sono già
        // state accreditate dentro valutaEAssegna, qui si aggiorna il
        // numero mostrato.
        if (typeof ricompenseSaldo === 'function' && typeof CSBar.setCurrency === 'function') {
            try {
                const { data: saldo, error } = await ricompenseSaldo(userId, 'polvere');
                if (!error) CSBar.setCurrency({ value: saldo || 0 });
            } catch (e) { console.error('[missioni-watcher] aggiornamento saldo polvere:', e); }
        }
    } catch (e) {
        console.error('[missioni-watcher] giro di controllo fallito:', e);
    } finally {
        _watcherMissioniInCorso = false;
    }
}

// ── AVVIO / ARRESTO ──────────────────────────────────────────────────────
// Idempotente: chiamarla due volte non lascia due timer appesi (stesso
// idioma di avviaPollingWidgetHome in phone.ui.js).
function avviaWatcherMissioni() {
    fermaWatcherMissioni();

    _watcherMissioniTimeoutAvvio = setTimeout(() => {
        _watcherMissioniGiro();
        _watcherMissioniInterval = setInterval(_watcherMissioniGiro, INTERVALLO_WATCHER_MISSIONI_MS);
    }, RITARDO_PRIMO_GIRO_WATCHER_MS);
}

function fermaWatcherMissioni() {
    if (_watcherMissioniTimeoutAvvio) { clearTimeout(_watcherMissioniTimeoutAvvio); _watcherMissioniTimeoutAvvio = null; }
    if (_watcherMissioniInterval) { clearInterval(_watcherMissioniInterval); _watcherMissioniInterval = null; }
}

// Ritorno in primo piano: se il timer ha macinato a vuoto mentre la scheda
// era nascosta (i giri saltavano su document.hidden), recupero subito
// invece di far aspettare fino al prossimo scatto. Il controllo sul tempo
// trascorso evita di rifarlo per un cambio scheda di due secondi.
document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (!_watcherMissioniInterval) return; // watcher non ancora avviato
    if (Date.now() - _watcherMissioniUltimoGiro < INTERVALLO_WATCHER_MISSIONI_MS) return;
    _watcherMissioniGiro();
});

// Avvio automatico. addEventListener e NON window.onload = ...: index.html
// assegna già window.onload con la sua funzione di avvio, e un'assegnazione
// diretta qui la cancellerebbe (o verrebbe cancellata) a seconda
// dell'ordine di caricamento. I due gestori convivono senza toccarsi.
window.addEventListener('load', avviaWatcherMissioni);
