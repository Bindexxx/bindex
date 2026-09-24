// ═══════════════════════════════════════════════════════════════════════
// PAGINAINIZIALE-POLLING-AVVIO.UI.JS — polling periodico, tasto fisico,
// presenza live, avvio (initPhoneShell) — CardSync Pro
// ═══════════════════════════════════════════════════════════════════════
// STEP 5 del piano di taglio di ui/paginainiziale.ui.js (concordato con
// Claudio il 2026-09-11) — ULTIMO STEP, dopo questo il taglio del motore
// home è completo (resta solo il file paginainiziale-render.ui.js, STEP 6
// nel piano originale, non ancora eseguito). Estratto da
// ui/paginainiziale.ui.js. NESSUNA riscrittura del codice esistente: solo
// spostamento, zero cambi di comportamento per l'utente finale.
//
// Contiene: INTERVALLO_WIDGET_VELOCE_MS/LENTO_MS, avviaPollingWidgetHome,
// _paginaAttivaTelefono, _vaiAllaPaginaHome, _aggiornaMatitaBarraGlobale,
// _aggiornaTastoFisico, _clickTastoFisico, _avviaPresenzaLive,
// initPhoneShell.
//
// NOTA: questo blocco era, nel file originale, la seconda metà del vecchio
// commento "SEZIONE 5" (la prima metà — resize cornice/sfondo/ponte
// statusbar — è finita nello STEP 2, ui/paginainiziale-cornice-
// statusbar.ui.js). Vedi nota identica lì.
//
// initPhoneShell() è il bootstrap chiamato UNA SOLA VOLTA, dall'inline
// <script> in fondo a index.html, dopo che tutti i file
// paginainiziale-*.ui.js (e tutti gli altri script) sono già stati
// caricati — per questo può chiamare liberamente funzioni definite in
// qualsiasi altro file del motore home o dei widget, indipendentemente da
// dove questo file è posizionato tra i <script> tag.
// ───────────────────────────────────────────────────────────────────────

// ── POLLING ────────────────────────────────────────────────────────────
const INTERVALLO_WIDGET_VELOCE_MS = 15000;
const INTERVALLO_WIDGET_LENTO_MS = 60000;

function avviaPollingWidgetHome() {
    if (_pollingWidgetInterval) clearInterval(_pollingWidgetInterval);
    if (_pollingWidgetIntervalLento) clearInterval(_pollingWidgetIntervalLento);

    _pollingWidgetInterval = setInterval(() => {
        if (!document.body.classList.contains('phone-detail-open') && !_editModeWidget) {
            renderWidgetHome();
        }
    }, INTERVALLO_WIDGET_VELOCE_MS);

    _pollingWidgetIntervalLento = setInterval(async () => {
        if (document.body.classList.contains('phone-detail-open') || _editModeWidget) return;
        _impostaSyncAttivo(true);
        try {
            await caricaAvvisiHome();
            // Prima di questa sessione, aggiornaBadgeMatch() (queue.ui.js)
            // girava una sola volta al login (_avviaSitoDopoAccesso in
            // auth.ui.js) e mai più — i pallini restavano fermi per tutta
            // la sessione. Agganciata qui allo stesso ciclo di
            // caricaAvvisiHome() per il widget "Match trovati" (Claudio:
            // "la cosa più semplice e affidabile quando avremo anche più
            // utenti" — niente query extra sul ciclo veloce a 15s).
            await aggiornaBadgeMatch();
            // AGGIUNTA (2026-09-24): stesso ciclo, stesso principio — badge
            // "messaggi non letti" della chat Match (widget-match.ui.js,
            // _aggiornaBadgeChatMatch). Non una query nuova ogni 15s, un
            // giro in più su quello lento già esistente.
            await _aggiornaBadgeChatMatch();
            await _controllaNotifichePush();
        } catch (e) { console.error('Errore polling avvisi (widget prezzi/inserimento/match):', e); }
        _impostaSyncAttivo(false);
        renderWidgetHome();
    }, INTERVALLO_WIDGET_LENTO_MS);
}

// ── LA HOME E' LA PAGINA A WIDGET ────────────────────────────────────────
// HOME FISSA ELIMINATA (Claudio, 2026-09-03). Prima esistevano due pagine
// sovrapposte, collegate da uno scatto verticale: #phoneHomePage (la
// "classica", che conteneva #home e scorreva all'infinito) e la pagina a
// widget. Ora c'e' solo la seconda, e le "pagine" sono quelle orizzontali
// stile telefono.
//
// _paginaAttivaTelefono resta e vale sempre 'widget': era letta da
// _aggiornaTastoFisico e da _aggiornaMatitaBarraGlobale, e toglierla
// avrebbe voluto dire riscrivere anche quelle. Lasciarla come costante
// costa nulla e mantiene leggibile il confronto con la versione
// precedente. Se un giorno non servira' piu' a nessuno, si toglie insieme
// alle sue due lettrici.
const _paginaAttivaTelefono = 'widget';

// _spostaHomeNellaPaginaPrincipale() e _gestisciScrollPagine() sono state
// RIMOSSE con la home fissa: la prima spostava #home dentro la pagina
// classica, la seconda leggeva quale delle due pagine fosse a schermo.
// Nessuna delle due ha piu' un oggetto su cui lavorare.

// "Torna alla home" ora vuol dire "torna alla PRIMA pagina di widget",
// che e' esattamente cio' che fa il tasto casetta su un telefono vero.
function _vaiAllaPaginaHome() {
    _vaiAllaPaginaWidget(0);
}

// Suoni/densita': prima comparivano solo sulla pagina widget e sparivano
// sulla home fissa. Senza piu' la home fissa sei SEMPRE sui widget, quindi
// restano sempre visibili — e la classe che li nascondeva va tolta una
// volta, altrimenti resterebbe appiccicata dall'ultimo giro prima
// dell'aggiornamento.
// btnModificaWidgetHome NON e' piu' in questo elenco (2026-09-10): si e'
// spostato nell'header della home (index.html) e non ha mai avuto la
// classe 'nascosto-in-home' li' — non serve piu' nessuna pulizia per lui.
function _aggiornaMatitaBarraGlobale() {
    ['btnSuoniWidgetHome', 'btnDensitaWidgetHome'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.classList.remove('nascosto-in-home');
    });
}

// Bottone fisico unico — tre stati, vedi commento CSS su
// #btnFisicoTelefono: nascosto (già sulla Home), casetta (sui widget,
// torna alla Home), freccia (dettaglio aperto, torna ai widget).
function _aggiornaTastoFisico() {
    const btn = document.getElementById('btnFisicoTelefono');
    if (!btn) return;
    const icona = btn.querySelector('i');

    if (document.body.classList.contains('phone-detail-open')) {
        btn.classList.remove('nascosto');
        if (icona) icona.className = 'fa-solid fa-arrow-left';
        btn.title = 'Indietro';
    } else if (_paginaWidgetCorrente > 0) {
        // Sei su una pagina diversa dalla prima: la casetta riporta li'.
        // Prima questo stato voleva dire "sei sui widget invece che sulla
        // home fissa"; ora che la home fissa non c'e' piu', il criterio
        // giusto e' la pagina orizzontale.
        btn.classList.remove('nascosto');
        if (icona) icona.className = 'fa-solid fa-house';
        btn.title = 'Prima pagina';
    } else {
        // Prima pagina, nessun dettaglio aperto: non c'e' nessun posto
        // dove tornare.
        btn.classList.add('nascosto');
    }
}

function _clickTastoFisico() {
    if (document.body.classList.contains('phone-detail-open')) {
        chiudiDettaglioWidget(); // "Indietro": torna ai widget, non salta alla Home
        return;
    }
    if (_paginaWidgetCorrente > 0) {
        _vaiAllaPaginaHome();
    }
    // Se sei già sulla prima pagina, non fa nulla.
}

// ── PRESENZA LIVE (2026-09-01, punto 4 status bar) ──────────────────────
// Fase 10, Step 2 (2026-09-13): stato dell'ultima subscribe, letto in
// sola lettura dalla pagina Impostazioni > Connessioni — null finché il
// primo giro non è ancora arrivato.
let _ultimoStatoPresenzaRealtime = null;

// Supabase Realtime, prima volta usato nel progetto — solo Presence pura
// (channel().track()), effimera: nessuna tabella, nessuna RLS, nessuna
// migration, niente scritto su Postgres. Un canale unico condiviso da
// tutti e 5: chi ha il canale sottoscritto in questo momento risulta
// "collegato". DIFENSIVO: se il canale non si sottoscrive per qualunque
// motivo (Realtime disattivato sul progetto, rete, ecc.) non succede
// nulla di visibile all'utente — solo un avviso in console.
//
// SICUREZZA (corretto 2026-09-01, segnalato da Claudio): un canale
// Realtime come questo NON è protetto da RLS a meno che il progetto non
// abbia i "private channels" di Supabase configurati esplicitamente (non
// verificato in questa sessione, nessun accesso diretto al DB). Chiunque
// conosca il nome del canale — visibile a chiunque legga il codice
// sorgente del sito — potrebbe collegarsi e leggere cosa viene
// trasmesso, senza bisogno di essere autenticato come uno degli utenti
// reali. Per questo qui si traccia SOLO una chiave anonima (l'id utente,
// già necessario come chiave di presenza) e NESSUN dato identificativo
// (niente email, niente nome) — la barra mostra solo un conteggio, non
// ha mai bisogno di sapere CHI è online. Se in futuro servisse mostrare
// i nomi, va prima verificato/configurato un canale privato con
// autorizzazione RLS lato Supabase, non aggiunto qui alla leggera.
async function _avviaPresenzaLive() {
    if (typeof CSBar === 'undefined' || typeof supabaseClient === 'undefined') return;
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;
        const canale = supabaseClient.channel('presenza-cardsync', {
            config: { presence: { key: user.id } },
        });
        canale
            .on('presence', { event: 'sync' }, () => {
                const stato = canale.presenceState();
                CSBar.setPresence({ count: Object.keys(stato).length, label: 'persone stanno usando CardSync' });
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    // Fase 10, Step 2 (2026-09-13): stato salvato per la
                    // pagina Impostazioni > Connessioni — sola lettura da
                    // lì, mai una seconda subscribe a parte.
                    _ultimoStatoPresenzaRealtime = 'ok';
                    await canale.track({ online: true }); // nessun dato identificativo, vedi nota sopra
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    _ultimoStatoPresenzaRealtime = 'errore';
                    console.warn('[presenza] canale realtime non disponibile (status: ' + status + ') — controllare che Realtime sia attivo sul progetto Supabase.');
                }
            });
    } catch (e) { _ultimoStatoPresenzaRealtime = 'errore'; console.error('[presenza] errore avvio:', e); }
}

// ── AVVIO ─────────────────────────────────────────────────────────────
async function initPhoneShell() {
    // _spostaHomeNellaPaginaPrincipale() rimossa con la home fissa.

    await _caricaLayoutWidget();
    // Fase 11 (2026-09-13): cache WIP caricata PRIMA del render, così le
    // eventuali aperture immediate (deep link, riapertura automatica)
    // trovano già la mappa pronta. Fire-and-forget rispetto al render
    // stesso: un ritardo/fallimento qui non deve mai bloccare la Home
    // (nessun WIP attivo è il caso normale — meglio degradare a "nessun
    // blocco" che a "Home che non si apre").
    if (typeof _wipCaricaCache === 'function') _wipCaricaCache();
    await renderWidgetHome();
    // _aggiornaOrologioStatusBar()/relativo setInterval RIMOSSI da qui
    // (2026-09-01): la nuova status bar (CSBar) ha un proprio orologio
    // interno. Funzione lasciata definita più sopra (dead code, per
    // rollback) — il vecchio elemento #phoneStatusOra è nascosto via CSS.

    const iconaSuoni = document.getElementById('iconaSuoniWidgetHome');
    if (iconaSuoni) iconaSuoni.className = prefSuoniWidgetGet() ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';

    // ── STATUS BAR (2026-09-01) ─────────────────────────────────────────
    // Prima integrazione: solo estetica/interazione base (orologio, stato
    // connessione, tendina, valuta) — niente notifiche automatiche,
    // presenza live, coda offline o PWA (rimandati, "fase 2" per esplicita
    // decisione di Claudio). Montata dentro #phoneScreen (non sul body:
    // resta nel mockup del telefono, non copre tutto il browser — vedi
    // opts.container in statusbar.js).
    if (typeof CSBar !== 'undefined') {
        CSBar.init({
            container: '#phoneScreen',
            persist: true,
            installPrompt: false,       // fuori scope in questa integrazione
            systemNotifications: false, // fuori scope in questa integrazione
            watchNetwork: true,

            // Notifiche di sistema (2026-09-01, 4 eventi confermati da
            // Claudio — "scambio da confermare" rimandato: non esiste
            // ancora come funzione nel progetto, richiede una feature a
            // sé, non solo un aggancio). 'text' di default sotto viene
            // sempre sovrascritto con quello reale al momento della
            // chiamata (vedi avvisa() nei punti di aggancio) — qui sono
            // solo fallback se mai chiamati senza 'extra'.
            // FIX (2026-09-01) sui 'target': erano '#traguardi' e '#scambio',
            // che NON esistono come id in index.html (le sezioni reali sono
            // 'missioni' e 'match'; "scambio" è un currentMode della tab
            // Visualizzazione, non una sezione). E anche '#wishlist', che
            // come id esiste, non sarebbe bastato: statusbar.js su un target
            // che inizia per '#' imposta location.hash, ma questa app non usa
            // il routing via hash (nessun listener hashchange) e le
            // view-section sono in display:none finché non attive — il clic
            // sulla notifica non apriva nulla. Ora i target puntano alle
            // sezioni vere e ci pensa onNotificationClick qui sotto ad
            // aprirle davvero.
            notificationTypes: {
                'missione-completata': {
                    icon: '\u2726', title: 'Missione completata', text: '',
                    target: '#missioni', group: 'missioni-oggi', groupLabel: 'missioni completate',
                },
                'traguardo-sbloccato': {
                    icon: '\u2b50', title: 'Traguardo sbloccato', text: '',
                    // I traguardi vivono nella stessa pagina delle missioni
                    // (#missioniListaTraguardi dentro la sezione 'missioni').
                    target: '#missioni', group: 'traguardi-oggi', groupLabel: 'traguardi sbloccati',
                    priority: 'high',
                },
                'match-trovato': {
                    icon: '\u21c4', title: 'Nuovo Match', text: '',
                    target: '#match', group: 'match-nuovi', groupLabel: 'nuovi Match',
                },
                'prezzo-obiettivo': {
                    icon: '\u2713', title: 'Prezzo obiettivo raggiunto', text: '',
                    target: '#wishlist', group: 'prezzo-obiettivo', groupLabel: 'obiettivi di prezzo raggiunti',
                    priority: 'high',
                },
                // AGGIUNTO (2026-09-24): chat in-app del widget Match
                // (sql/70). Stesso target '#match' di 'match-trovato' —
                // apriDettaglioWidget('match', null) gestisce già questa
                // sezione, nessun caso nuovo da aggiungere lì (stesso
                // motivo documentato sopra per gli altri tre tipi).
                'chat-messaggio': {
                    icon: '\u{1F4AC}', title: 'Nuovo messaggio', text: '',
                    target: '#match', group: 'chat-match-messaggio', groupLabel: 'messaggi chat',
                },
            },

            // Apertura reale della sezione al clic sulla notifica. Se questo
            // gestore c'è, statusbar.js lo usa AL POSTO di location.hash
            // (vedi openNotification) — quindi il target torna ad essere solo
            // un'etichetta della destinazione, letta qui. apriDettaglioWidget
            // gestisce già 'missioni', 'match' e 'wishlist': sono tutte e tre
            // nell'elenco delle sezioni con pagina propria, nessun caso nuovo
            // da aggiungere lì.
            onNotificationClick: (n) => {
                if (!n || !n.target) return;
                const sezione = n.target.charAt(0) === '#' ? n.target.slice(1) : n.target;
                apriDettaglioWidget(sezione, null);
            },

            // Suoni/densità (2026-09-01): spostati dalla vecchia barra
            // (sempre nascosta ora) ai "quickActions" della tendina —
            // Claudio ha confermato l'approccio. Cambia la scopribilità
            // (prima visibili solo sulla pagina widget, ora sempre
            // raggiungibili dalla tendina): nota, non un difetto silenzioso.
            // 'active' letto dallo stato REALE del progetto al momento
            // dell'avvio, cosi CSBar parte sincronizzato — poi le due
            // funzioni restano allineate perché ogni tap passa sempre da
            // qui (onToggle chiama SEMPRE la funzione reale del progetto).
            // La voce 'modifica' (Personalizza widget) e' stata TOLTA da
            // qui il 2026-09-10: ridondante col bottone #btnModificaWidgetHome
            // ora fisso e visibile nell'header della home (index.html) —
            // due strade per la stessa azione avrebbero richiesto tenerle
            // sincronizzate (stato 'attivo'/testo) senza un vantaggio reale.
            // FASE 10 (2026-09-13): rimossi gli shortcut diagnostici
            // 'densita'/'test2x2' dalla tendina — richiesto esplicitamente
            // dalla roadmap ("rimuovere shortcut debug Home Densità comoda
            // e 2×2 widget; non rimuovere i layout Binder reali", che
            // restano intatti, questi erano solo scorciatoie di debug).
            // Le funzioni toggleDensitaWidgetHome()/_testForzaTaglia2x2()
            // restano nel codice (non più richiamate da qui) — nessun
            // altro punto le chiama, rimozione a costo zero se in futuro
            // si vuole ripulire anche quelle.
            quickActions: [
                { id: 'suoni', label: 'Suoni', glyph: '\u266a', active: prefSuoniWidgetGet(), onToggle: () => toggleSuoniWidgetHome() },
            ],

            onSettings: () => apriDettaglioWidget('impostazioni'),
            // Riusa il vero menu profilo (#profiloContainer, spostato qui
            // sotto), non ricostruito — chiama la stessa funzione che
            // apriva/chiudeva il menu dalla vecchia barra.
            onProfile: () => { if (typeof toggleMenuProfilo === 'function') toggleMenuProfilo(); },
        });

        // STEP 13 fix restyle "cornice Pokédex" (2026-09-17), seconda
        // versione — corregge lo Step 11: la pallina NON è più figlia di
        // .csb-shade (i suoi angoli arrotondati la tagliavano/nascondevano
        // del tutto da chiusa, vedi commento CSS su .pokedex-ball-tendina
        // per la spiegazione geometrica completa). È inserita come sorella
        // di .csb-bar, dentro #phoneScreen — mai tagliata dalla tendina,
        // solo (fisiologicamente) dal bordo vero dello schermo.
        // Pallina "tendina" — segue la posizione VERA di .csb-shade ad ogni
        // fotogramma (letta dal DOM, mai calcolata a mano: gira anche
        // durante l'animazione elastica di apertura/chiusura di CSBar,
        // che non è un semplice trascinamento lineare). Un
        // getBoundingClientRect() + una scrittura di stile per frame è un
        // costo trascurabile, gira per tutta la sessione senza pesare.
        function _avviaSincronizzaPallinaTendina() {
            const pallina = document.getElementById('pallinaTendinaVisibile');
            const shade = document.querySelector('.csb-shade');
            const schermo = document.getElementById('phoneScreen');
            if (!pallina || !shade || !schermo) return;

            function fotogramma() {
                const rectShade = shade.getBoundingClientRect();
                const rectSchermo = schermo.getBoundingClientRect();
                // CORRETTO (STEP 14 fix, 2026-09-17): la versione precedente
                // centrava la pallina ESATTAMENTE sul fondo della tendina —
                // da chiusa il fondo coincide col bordo vero dello schermo,
                // quindi metà pallina restava sopra (tagliata da
                // #phoneScreen overflow:hidden). Le altre 3 palline sono
                // tutte intere (Claudio: "le altre 3 vanno benissimo") — non
                // deve stare A CAVALLO di un bordo, deve restare INTERA e
                // appesa appena sotto il fondo della tendina, in ogni
                // momento (chiusa, aperta, durante il trascinamento).
                const fondoTendina = rectShade.bottom - rectSchermo.top;
                const piccoloStacco = 4; // solo estetico, la tiene "attaccata" senza sovrapporsi al bordo della tendina
                const offsetY = fondoTendina + piccoloStacco;
                pallina.style.transform = `translate(-50%, ${offsetY}px)`;
                requestAnimationFrame(fotogramma);
            }
            requestAnimationFrame(fotogramma);
        }

        const _schermoPerPallina = document.getElementById('phoneScreen');
        if (_schermoPerPallina && document.querySelector('.csb-bar')) {
            const pallinaTendina = document.createElement('div');
            pallinaTendina.id = 'pallinaTendinaVisibile';
            pallinaTendina.className = 'pokedex-ball pokedex-ball-tendina';
            // Appesa direttamente a #phoneScreen (non al genitore della
            // barra: CSBar crea un <div> di supporto attorno a barra+
            // tendina — appendere lì renderebbe il posizionamento assoluto
            // relativo a un contenitore incerto invece che allo schermo
            // vero, che è il riferimento usato da _avviaSincronizzaPallinaTendina).
            _schermoPerPallina.appendChild(pallinaTendina);
            _avviaSincronizzaPallinaTendina();

            // FIX (STEP 15, 2026-09-17): la pallina inoltra il proprio
            // pointerdown a .csb-handle (nascosta via CSS, ma il suo
            // gestore di trascinamento — identico a quello della barra,
            // vedi statusbar.js — resta pienamente funzionante:
            // dispatchEvent() invoca sempre i listener registrati, a
            // prescindere da display:none, che blocca solo l'hit-test di
            // un click VERO dell'utente, non un evento inoltrato via
            // codice). Da qui in poi la libreria gestisce tutto da sola
            // (i suoi listener di trascinamento sono globali su
            // window/document, non legati all'elemento toccato — il resto
            // del gesto, muovi/rilascia, segue il puntatore vero ovunque
            // vada, non serve inoltrare altro). Funziona identico da
            // chiusa (apre) e da aperta (chiude), risolvendo entrambe le
            // direzioni con lo stesso meccanismo.
            pallinaTendina.addEventListener('pointerdown', (ev) => {
                const maniglia = document.querySelector('.csb-handle');
                if (!maniglia) return;
                const inoltrato = new PointerEvent('pointerdown', {
                    bubbles: true,
                    cancelable: true,
                    pointerId: ev.pointerId,
                    pointerType: ev.pointerType,
                    isPrimary: ev.isPrimary,
                    button: 0,
                    buttons: ev.buttons,
                    clientX: ev.clientX,
                    clientY: ev.clientY,
                });
                maniglia.dispatchEvent(inoltrato);
            });
        }

        // #profiloContainer (menu profilo completo: nome, email, cambio
        // username, logout) esiste già nell'HTML dentro la vecchia barra
        // (ora nascosta) — spostato qui via appendChild, stesso nodo DOM,
        // stessa logica interna intatta (il menu si posiziona da solo
        // rispetto al proprio contenitore, non rispetto alla pagina).
        // Il pulsante profilo "finto" di CSBar resta nascosto via CSS
        // (.csb-profile { display:none }) al suo posto.
        const profiloContainer = document.getElementById('profiloContainer');
        const csbRight = document.querySelector('#phoneScreen .csb-right');
        if (profiloContainer && csbRight) csbRight.appendChild(profiloContainer);

        _avviaPresenzaLive(); // fire-and-forget, vedi commento sulla funzione sopra

        // Valuta (2026-09-01): collegata al saldo reale di
        // inventario_ricompense. AGGIORNATO 2026-09-07: usa polvere_saldo()
        // (RPC, somma lato Postgres) invece di ricompenseSaldo(userId,
        // 'polvere') (data/missioni.repository.js, somma lato client —
        // tronca oltre ~1000 righe senza segnalarlo, vedi
        // data/bustina.repository.js per il dettaglio). 'polvere' resta il
        // tipo ricompensa reale usato in tutto il catalogo missioni/
        // traguardi, non inventato. Aggiornata di nuovo dopo ogni
        // valutazione missioni (vedi renderPaginaMissioni), dove vengono
        // davvero accreditate nuove ricompense.
        (async () => {
            try {
                const userId = await authGetUserId();
                if (!userId) return;
                const { data: saldo, error } = await polvereSaldoLeggi();
                if (!error) CSBar.setCurrency({ value: saldo || 0, glyph: '\u2727', label: 'Polvere' });
            } catch (e) { console.error('[statusbar] saldo polvere iniziale:', e); }
        })();
    }

    avviaPollingWidgetHome();

    // ── Grafica Poké Ball ───────────────────────────────────────────────
    // Il semaforo ha un ciclo suo (5,2s), separato dal polling dei dati:
    // muovere le ball non richiede di rileggere niente, usa le attenzioni
    // già calcolate dall'ultimo render.
    if (BALL_ATTIVA) {
        _ballApplicaClasseAnimazioni();
        // Non bloccante: la home si disegna subito con la libreria dal file
        // statico, e si aggiorna da sola se la tabella risponde.
        _ballCaricaLibreriaDaDb();
        _ballAvviaSemaforo();
        _ballOsservaTema();
        _ballSincronizzaToggleImpostazioni();
    }

    window.addEventListener('resize', _gestisciResizeCorniceDebounced);
    window.addEventListener('orientationchange', _gestisciResizeCornice);

    // Il listener di scroll verticale su #phonePagineWrap e' stato tolto
    // con la home fissa: quel contenitore non scorre piu'.
    const contPagineWidget = document.getElementById('phoneWidgetPagine');
    if (contPagineWidget) contPagineWidget.addEventListener('scroll', _gestisciScrollPaginePagineWidget, { passive: true });
    _aggiornaTastoFisico();
    _aggiornaMatitaBarraGlobale();

    // Animazione di "accensione" — una sola volta, al caricamento.
    const frameBox = document.getElementById('phoneFrameBox');
    if (frameBox) {
        frameBox.classList.add('phone-accensione');
        setTimeout(() => frameBox.classList.remove('phone-accensione'), 700);
    }
}
