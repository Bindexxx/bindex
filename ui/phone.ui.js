// ── ui/phone.ui.js ─────────────────────────────────────────────────────
// Home "smartphone simulato": griglia di widget dentro una cornice
// (placeholder oggi in assets/frame/, in futuro immagine scelta
// dall'utente da un bucket Supabase — vedi _applicaCorniceUtente più
// sotto), ognuno apre a schermo intero (con tasto indietro) esattamente
// la stessa view-section che oggi apriva la voce corrispondente nel
// vecchio menu laterale, oppure un'azione diretta (vedi 'azione' nel
// catalogo). Nessuna nuova query Supabase: ogni widget riusa dati/
// funzioni già esistenti in home.ui.js/navigation.ui.js/queue.repository.js
// — vedi commento su ogni preview.
//
// Dipende da: state globale carteReali (state/cards.state.js), switchTab/
// currentMode/openQrModal (ui/navigation.ui.js), _contaCodaErrori/
// _elencoPrezziScaduti/_dispositiviAttiviOra/apriFlipCardHome/
// aggiornaStatCardHome/caricaAvvisiHome (ui/home.ui.js), prefWidgetLayoutGet/
// Set (data/preferences.repository.js), _urlImmagineVisualizzabile/
// escapeHtml (utils condivisi).
//
// DUE WIDGET BLOCCATI (Claudio, sessione 2026-08-24): "Match trovati" ed
// "Estensione: stato rapido" compaiono nel catalogo ma con dati statici —
// il primo richiede il corpo completo di caricaMatch()/queue.ui.js (finora
// letti solo i nomi delle funzioni, mai il contenuto), il secondo richiede
// extension.ui.js (mai aperto in questa sessione). Niente inventato: sono
// segnalati con bloccato:true, vedi resa in renderWidgetHome().

// ── CATALOGO WIDGET DISPONIBILI ──────────────────────────────────────────
// NOTA (Claudio, 2026-08-24): il widget "Home" che c'era qui è stato
// rimosso — non ha più senso aprire la Home come un dettaglio da un
// widget.
// AGGIORNAMENTO 2026-09-03: la home fissa (#phoneHomePage) è stata
// eliminata del tutto. La home ORA È la pagina a widget, con le pagine
// orizzontali stile telefono. Il commento qui sopra parlava di uno swipe
// verticale fra due pagine che non esiste più.
// ── LIBRERIA DEI SET ─────────────────────────────────────────────────────
// Il codice carta è nella forma "SIGLA NUMERO" — es. "ASC 123" = carta 123
// di Ascesa Eroica. La sigla identifica l'espansione; il numero da solo non
// dice quante carte la compongono.
//
// PERCHÉ SERVE QUESTA TABELLA (Claudio): il denominatore che si vede sulle
// carte ("123/167") è il conteggio STAMPATO, non il totale reale — oltre
// quel numero ci sono le secret rare. Calcolare l'avanzamento su 167
// significherebbe mostrare "104%" a chi possiede anche le secret.
// Servono quindi due numeri per ogni set: quante carte nel set base e
// quante in tutto.
//
// STATO: vuota di proposito. Riempirla con dati inventati sarebbe peggio
// che non averla — vedi le domande poste a Claudio a fine sessione su dove
// farla vivere (tabella Supabase o file statico) e da dove prendere i
// totali. Finché è vuota, il widget Set mostra quante carte hai per
// espansione SENZA percentuali: un dato vero e utile, invece di una
// percentuale su un totale sbagliato.
//
// Forma di ogni voce:
//   SIGLA: { nome: 'Nome esteso', base: 167, totale: 190 }
//     base   = carte del set principale (il denominatore stampato)
//     totale = base + secret rare e aggiunte
// La libreria vera vive in data/sets.library.js, generato da
// genera-libreria-set.html e caricato PRIMA di questo file in index.html.
// Qui restano solo le voci scritte a mano: servono da rete di sicurezza se
// quel file manca (non ancora generato, oppure caricamento fallito).
const _ballLIBRERIA_MANUALE = {
    // ASC — Ascesa Eroica (Ascended Heroes), 30/01/2026. Numeri verificati
    // su fonti pubbliche concordi: 217 carte nel set principale, 78 secret
    // rare, 295 in totale. È il caso esatto per cui questa libreria esiste:
    // una carta "ASC 123/217" appartiene a un set che ne ha 295, quindi
    // calcolare l'avanzamento sul 217 stampato darebbe oltre il 100% a chi
    // le possiede tutte.
    ASC: { nome: 'Ascesa Eroica', base: 217, totale: 295 }
};

// Le voci generate hanno la precedenza su quelle manuali: se un domani il
// file automatico correggerà un numero scritto a mano, vince il dato
// aggiornato dalla fonte. Le voci lette dalla tabella Supabase, quando
// arrivano, hanno la precedenza su entrambe (vedi _ballCaricaLibreriaDaDb).
let _ballLIBRERIA_SET = Object.assign(
    {},
    _ballLIBRERIA_MANUALE,
    (typeof CARDSYNC_SET_LIBRARY !== 'undefined' && CARDSYNC_SET_LIBRARY) ? CARDSYNC_SET_LIBRARY : {}
);

// Sovrascrive la libreria con la tabella 'set_espansioni' (migration 28),
// che è la fonte aggiornabile senza toccare il repository del sito.
// Se la tabella non c'è ancora, non risponde o è vuota, NON si tocca
// niente: resta la libreria dal file statico. Una libreria un po' più
// vecchia è sempre meglio di nessuna libreria.
async function _ballCaricaLibreriaDaDb() {
    if (typeof setEspansioniLeggiTutte !== 'function') return;
    try {
        const righe = await setEspansioniLeggiTutte();
        if (!righe || !righe.length) return;

        const daDb = {};
        righe.forEach(r => {
            if (!r.sigla || !r.carte_totali) return;
            daDb[String(r.sigla).toUpperCase()] = {
                nome: r.nome || r.sigla,
                base: r.carte_base ?? null,
                totale: r.carte_totali
            };
        });
        _ballLIBRERIA_SET = Object.assign({}, _ballLIBRERIA_SET, daDb);
        renderWidgetHome();
    } catch (e) {
        console.error('Libreria set da DB:', e);
    }
}


// Ricava sigla e numero dal codice carta.
//
// REGOLA (tarata sui 1143 codici reali della collezione, non su ipotesi):
// l'ULTIMA sequenza numerica è il numero della carta; tutto ciò che la
// precede identifica il set, sottoinsiemi compresi. Copre il 97% delle
// carte (98 sigle su 100), contro l'80% di una regex "sigla + numero".
//
// Esempi reali risolti da questa regola:
//   "ASC 251"       → ASC / 251
//   "PAR164"        → PAR / 164        (senza spazio)
//   "XASC123"       → XASC / 123
//   "BRS TG04"      → BRS-TG / 4       (Trainer Gallery: numerazione a sé)
//   "CRZ GG22"      → CRZ-GG / 22      (Galarian Gallery)
//   "CEL TR 15"     → CEL-TR / 15      (sottoinsieme Team Rocket)
//   "PPS8 SCR 107"  → SCR / 107        (bustina premio, ricondotta al set)
//   "MCD25 5"       → MCD25 / 5        (McDonald's, uno per anno)
//   "SM-P 47"       → SM-P / 47        (promo)
//
// I sottoinsiemi restano set DISTINTI apposta: una Trainer Gallery ha una
// propria numerazione e un proprio totale, sommarla al set principale
// falserebbe entrambi gli avanzamenti.
//
// NON riconosciuti, per ora: "MFB" e "PR" (28+1 carte) — codici senza
// numero, quindi senza posizione in un set. Vanno chiariti con Claudio.
//
// CASO AMBIGUO NOTO: "SV9033" viene letto come SV9 / 33. Potrebbe essere
// il set giapponese SV9 carta 033 (interpretazione scelta) oppure SV carta
// 9033. Sono 9 carte: se la lettura è sbagliata, si corregge qui.
// VARIANTI POKÉ BALL / MASTER BALL (Claudio): le sigle che iniziano per X
// — XASC, XPRE, XBLK, XWHT, XJTG, XMEG, XDRI, XPFL, 255 carte in tutto —
// NON sono set a sé: sono le stesse carte del set base con il pattern
// Poké Ball o Master Ball al posto del reverse normale.
// "XASC 123" è la carta 123 di Ascesa Eroica, non una carta in più.
//
// Per l'avanzamento del set vanno quindi ricondotte al set base, altrimenti
// ASC comparirebbe come due espansioni distinte e nessuna delle due
// risulterebbe mai completa. La variante resta comunque nota (campo
// 'variante'), utile se un giorno vorrai contare il master set — cioè tutte
// le varianti — invece del solo set base.
//
// BUSTINE PREMIO (Claudio): le sigle che iniziano per "PPS<numero>-"
// — es. PPS8-SCR, PPS6-TWM, PPS7-JTG, 48 carte in tutto — sono carte
// normali di un'espansione reale, solo stampate come bustina premio.
// Stesso trattamento delle varianti X: ricondotte al set base (campo
// 'variante' = 'stampata'). Verificato sui 1143+ codici reali il
// 2026-08-28: tutte le 19 teste PPS trovate puntano a un set già in
// libreria, nessuna eccezione.
function _ballSetBase(testa) {
    const mX = testa.match(/^X([A-Z]{2,6})(-.*)?$/);
    if (mX) return { set: mX[1] + (mX[2] || ''), variante: 'ball' };

    // Bustine premio: "PPS8 SCR 107" → testa normalizzata "PPS8-SCR".
    // Carte normali di un'espansione reale, solo stampate diversamente.
    // Verificato sui dati reali (2026-08-28): 19 teste PPS<n>-<SIGLA>,
    // tutte riconducibili a un set già in libreria, nessuna eccezione.
    const mPPS = testa.match(/^PPS\d+-(.+)$/);
    if (mPPS) return { set: mPPS[1], variante: 'stampata' };

    // Trick or Trade: "BOO24 PAR 023" → testa normalizzata "BOO24-PAR".
    // Applicato "PER ORA" (Claudio, 2026-08-28) sulla base di 3 fonti
    // esterne concordi (Bulbapedia, Pokellector, un'inserzione che vende
    // le singole carte catalogandole col set/numero originale) che
    // descrivono le BOO come ristampe timbrate di carte di set esistenti,
    // stesso numero originale — non un set con numerazione propria. Se un
    // riscontro sui dati fisici dicesse diversamente, questa riga va tolta.
    const mBOO = testa.match(/^BOO\d+-(.+)$/);
    if (mBOO) return { set: mBOO[1], variante: 'halloween' };

    return { set: testa, variante: null };
}

// Alias per teste che in collezione non coincidono con la sigla ufficiale
// TCGdex. Una riga per ogni caso: aggiunta SOLO dopo conferma esplicita di
// Claudio sul significato del codice, mai dedotta dal pattern (a differenza
// di X e PPS, qui non c'è una regola regolare da riconoscere).
const _ballALIAS_TESTA = {
    'SM': 'SMP',   // SM Black Star Promos (confermato da Claudio, 2026-08-28)
    'TR': 'RO',    // Team Rocket, sigla storica (confermato da Claudio, 2026-08-28)
    'FL': 'UNB',   // Legami Inossidabili / Unbroken Bonds (confermato da Claudio, 2026-08-28)
    'TM': 'TRI',   // Battaglie Trionfali, HS4 (confermato da Claudio, 2026-08-28)
    'NG': 'N1',    // Neo Genesis (fonte esterna verificata, confermato 2026-08-28)
    'NDI': 'N2',   // Neo Discovery, codice reale confermato "NDI-nn" (fonte esterna, 2026-08-28)
    'NR': 'N3',    // Neo Revelation, codice reale confermato "NR-nn" (fonte esterna, 2026-08-28)
    'NDE': 'N4',   // Neo Destiny, codice reale confermato "NDE-nn" (fonte esterna, 2026-08-28)
    'UD': 'UND',   // Undaunted / Senza Paura (confermato da Claudio, 2026-08-28)
    'CL': 'COL',   // Call of Legends / Richiamo delle Leggende — NON la Pokémon Card
                   // Game Classic (quella userebbe CLK/CLL/CLF, mai "CL" nudo — la
                   // carta reale in collezione è "CL 92", senza suffisso). Confermato
                   // da Claudio 2026-08-28.
    'TK2-M': 'TK2M', // Trainer Kit Minun — stesso bug del separatore delle Trainer
                      // Gallery (spazio "TK2 M3" collassato in trattino dal lettore,
                      // ma la libreria usa "TK2M" senza separatore). Confermato 2026-08-28.
    'TK10-A': 'TK10A', // Trainer Kit Alolan Raichu, stesso bug. Confermato 2026-08-28.
    'M24': 'MCD24', // McDonald's Collection 2024 (confermato da Claudio, 2026-08-28)
};

function _ballSetBaseConAlias(testa) {
    return _ballSetBase(_ballALIAS_TESTA[testa] || testa);
}

function _ballLeggiCodice(codice) {
    if (!codice) return null;
    const t = String(codice).trim().toUpperCase();

    const m = t.match(/^(.*?)[\s\-_]*(\d{1,3})$/);
    if (m) {
        // Spazi e trattini interni diventano un separatore unico, così
        // "CEL TR 15" e "CEL-TR-15" finiscono nello stesso set.
        const testa = m[1].trim().replace(/^[\s\-_]+|[\s\-_]+$/g, '').replace(/[\s\-_]+/g, '-');
        if (testa && /[A-Z]/.test(testa)) {
            const b = _ballSetBaseConAlias(testa);
            return { set: b.set, variante: b.variante, numero: parseInt(m[2], 10) };
        }
    }

    // Set SENZA numerazione, es. "MFB" (My First Battle, 28 carte) e "PR".
    // Claudio: quelle carte un numero non ce l'hanno proprio. Restituiamo
    // comunque il set con numero null: così le carte non spariscono dal
    // conteggio delle espansioni, ma non entrano in nessun avanzamento —
    // senza numerazione non esiste un "quante ne mancano".
    if (/^[A-Z][A-Z\-]{0,7}$/.test(t)) {
        const b = _ballSetBaseConAlias(t);
        return { set: b.set, variante: b.variante, numero: null };
    }
    return null;
}

// ── STORICO "DA FARE" (24h) — Claudio, 2026-08-28 ────────────────────────
// _daFareUltimoStato: SOLO in memoria, non persistito, per-tab. Serve
// unicamente a confrontare "prima" con "ora" a ogni preview() del widget
// 'suggerimento' (~ogni 15s mentre la home è aperta, stesso polling già
// esistente) — zero query in più per il confronto stesso. La scrittura
// vera su preferenze_utente scatta SOLO quando un segnale sparisce
// dall'elenco attivo (transizione), non a ogni tick.
// LIMITE ACCETTATO: se un segnale nasce e si risolve interamente senza
// che la home sia mai aperta nel frattempo, la transizione non viene mai
// osservata — nessuno storico per quel caso. Accettabile per una funzione
// "in più", non richiede un cron server-side.
let _daFareUltimoStato = {};
const FINESTRA_STORICO_DAFARE_MS = 24 * 60 * 60 * 1000; // Claudio: "24 ore va benissimo"

function _rilevaTransizioniDaFare(segnaliOra) {
    const idAttiviOra = new Set(segnaliOra.map(s => s.id));
    Object.keys(_daFareUltimoStato).forEach(id => {
        if (_daFareUltimoStato[id].attivo && !idAttiviOra.has(id)) {
            _segnaDaFareRisolto(id, _daFareUltimoStato[id].testo); // fire-and-forget, non blocca il render
        }
    });
    const nuovoStato = {};
    segnaliOra.forEach(s => { nuovoStato[s.id] = { attivo: true, testo: s.testo }; });
    Object.keys(_daFareUltimoStato).forEach(id => {
        if (!nuovoStato[id]) nuovoStato[id] = { attivo: false, testo: _daFareUltimoStato[id].testo };
    });
    _daFareUltimoStato = nuovoStato;
}

async function _segnaDaFareRisolto(id, testo) {
    try {
        const userId = await authGetUserId();
        if (!userId) return;
        const { data, error } = await userSettingsGet(userId);
        if (error) { console.error('_segnaDaFareRisolto: lettura fallita:', error.message); return; }
        let storico = {};
        try { storico = (data && data.dafare_risolti) ? JSON.parse(data.dafare_risolti) : {}; } catch (_) { storico = {}; }
        storico[id] = { testo, risoltoIl: new Date().toISOString() };
        const { error: errScrittura } = await userSettingsUpsertDaFareRisolti(userId, storico);
        if (errScrittura) console.error('_segnaDaFareRisolto: scrittura fallita:', errScrittura.message);
    } catch (e) { console.error('_segnaDaFareRisolto:', e); }
}

// CATALOGO_WIDGET ora dichiarato (registro vuoto) in ui/paginainiziale.ui.js,
// caricato PRIMA di questo file — STEP 0 ristrutturazione file widget,
// 2026-09-11 (vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md).
// Qui sotto si popola solo con le voci NON ANCORA estratte nei rispettivi
// widget-<nome>.ui.js: ogni volta che un widget viene estratto (step 3-22
// della roadmap), la sua voce sparisce da qui e va scritta direttamente
// come CATALOGO_WIDGET.<id> = {...} dentro il file di quel widget.
Object.assign(CATALOGO_WIDGET, {
    visualizzazione: {
        titolo: 'Visualizzazione', icona: 'fa-images',
        preview: () => {
            const collezione = carteReali.filter(c => c.stato === 'collezione');
            const n = collezione.length;
            // 'dati' è AGGIUNTIVO (tessere grandi): 'righe' resta identica,
            // così 1x1, mini, badge e semaforo non cambiano di una virgola.
            // Le ultime quattro entrate, stesso ordinamento di ultima_carta.
            const ultime = collezione.slice()
                .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
                .slice(0, 4)
                .map(c => ({ id: c.id, nome: c.name || '', immagine: c.immagine, rarita: c.rarita }));

            // Andamento VERO degli inserimenti negli ultimi 14 giorni, per
            // la sparkline: quante carte sono entrate ogni giorno. Dato già
            // in memoria (createdAt), nessuna query nuova.
            const GIORNI = 14;
            const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
            const serie = new Array(GIORNI).fill(0);
            collezione.forEach(c => {
                if (!c.createdAt) return;
                const d = new Date(c.createdAt); d.setHours(0, 0, 0, 0);
                const scarto = Math.round((oggi - d) / 86400000);
                if (scarto >= 0 && scarto < GIORNI) serie[GIORNI - 1 - scarto]++;
            });
            const aggiunteRecenti = serie.reduce((a, b) => a + b, 0);

            return { righe: [`${n} carte totali`], dati: { totale: n, ultime, serie, aggiunteRecenti } };
        },
    },
    inserimento: {
        titolo: 'Inserimento', icona: 'fa-id-card',
        // Riusa _contaCodaErrori() già definita in home.ui.js — stesso
        // conteggio già mostrato nell'avviso Home, nessuna query duplicata.
        preview: async () => {
            const n = await _contaCodaErrori();
            return { righe: [n > 0 ? `${n} da correggere` : 'Tutto in ordine'], stato: n > 0 ? 'allerta' : 'ok', dati: { daCorreggere: n } };
        },
    },
    prezzi: {
        titolo: 'Prezzi', icona: 'fa-chart-line',
        // _elencoPrezziScaduti è popolato da caricaAvvisiHome() (già
        // richiamata a intervalli da avviaPollingWidgetHome più sotto) —
        // qui lo leggiamo soltanto. Forma confermata in home.ui.js:
        // {name, code, ultimoTesto} — la prima riga come seconda riga del
        // widget, non un dato nuovo.
        preview: () => {
            const lista = (typeof _elencoPrezziScaduti !== 'undefined' && _elencoPrezziScaduti) ? _elencoPrezziScaduti : [];
            // Totale su cui calcolare la quota di aggiornati: le carte in
            // collezione con un prezzo. Nessuna query nuova, solo carteReali.
            const inCollezione = carteReali.filter(c => c.stato === 'collezione');
            const conPrezzo = inCollezione.filter(c => c.price != null).length;
            // Valore complessivo: prezzo per quantità, dati già in memoria.
            const valore = inCollezione.reduce((tot, c) => tot + (Number(c.price) || 0) * (Number(c.qty) || 1), 0);
            const dati = {
                scaduti: lista.length,
                totale: Math.max(conPrezzo, lista.length),
                valore,
                // 'ultimoTesto' è la forma confermata di _elencoPrezziScaduti
                // (vedi apriModalePrezziScaduti in ui/prices.ui.js r.212).
                lista: lista.slice(0, 3).map(v => ({ nome: v.name || '—', quando: v.ultimoTesto || '' }))
            };
            if (lista.length === 0) return { righe: ['Tutti aggiornati'], stato: 'ok', dati };
            return { righe: [`${lista.length} da aggiornare`, lista[0].name || ''], stato: 'allerta', dati };
        },
    },
    // Multi-Binder (2026-08-25): 'scambio' e 'wishlist' come widget home
    // separati sono stati rimossi — puntavano a switchTab('scambio'/
    // 'wishlist'), view-section che non esistono più in index.html (solo 5
    // restano: visualizzazione/inserimento/prezzi/binder/impostazioni).
    // Erano già inattivi prima di questa sessione. Il loro contenuto vive
    // ora dentro il widget "Binders" sotto, come binder dedicati.
    binder: {
        titolo: 'Binders', icona: 'fa-layer-group',
        // Zero query nuove (stessa filosofia degli altri preview): conta le
        // location distinte già presenti in carteReali + 2 fissi (Wishlist
        // + il binder 'extra', che esistono sempre una volta garantiti) —
        // è una STIMA del numero di binder, non il conteggio esatto letto
        // da bindersQueryTutti() (quello lo fa apriWidgetBinders() appena
        // aperto il widget, qui servirebbe una query in più solo per
        // l'anteprima e non vale il costo).
        preview: () => {
            const perLocation = {};
            carteReali.filter(c => c.tabella === 'carte' && c.stato === 'collezione' && c.location)
                .forEach(c => { perLocation[c.location] = (perLocation[c.location] || 0) + 1; });
            const locationDistinte = Object.keys(perLocation).length;
            const voci = Object.entries(perLocation).sort((a, b) => b[1] - a[1]);
            return { righe: [`${locationDistinte + 2} binder`], dati: { totale: locationDistinte + 2, voci } };
        },
    },
    sealed: {
        titolo: 'Sealed', icona: 'fa-box-archive',
        preview: () => {
            const prodotti = carteReali.filter(c => c.stato === 'collezione' && c.tipo === 'sealed');
            if (prodotti.length === 0) return { righe: ['Nessun prodotto'], dati: { totale: 0, valore: 0, lista: [] } };
            const perValore = prodotti.slice().sort((a, b) => (b.price || 0) - (a.price || 0));
            const inEvidenza = perValore[0];
            const valore = prodotti.reduce((t, p) => t + (Number(p.price) || 0) * (Number(p.qty) || 1), 0);
            return {
                righe: [`${prodotti.length} prodotti`, inEvidenza.name || ''],
                dati: {
                    totale: prodotti.length, valore,
                    lista: perValore.slice(0, 3).map(p => ({ nome: p.name || '—', prezzo: Number(p.price) || 0 }))
                }
            };
        },
        // AGGIUNTO (2026-08-30): prima non aveva 'tab', il tap sul tile non
        // portava da nessuna parte (stesso problema già trovato e risolto
        // per 'location'). Ora ha una pagina propria (#sealed in
        // index.html, renderPaginaSealed() sotto).
        tab: 'sealed',
    },

    ultima_carta: {
        titolo: 'Vetrina', icona: 'fa-star', multiIstanza: true,
        // TRASFORMATO (Claudio, 2026-08-28): da "ultima carta entrata" a
        // vetrina di carte preferite scelte a mano — vedi ricerca carte più
        // sotto (_apriRicercaCartaVetrina). Copie multiple: ogni riga di
        // _layoutWidget con questo id ha il proprio 'cartaId', il widget
        // catalogo resta UNO SOLO — vedi 'multiIstanza' sopra.
        // Riceve la riga di layout (w) come parametro: è l'unico modo per
        // sapere QUALE carta mostrare, dato che più copie condividono lo
        // stesso 'id' di catalogo. Tutti gli altri 18 widget ignorano
        // questo parametro, nessuna modifica per loro.
        preview: (w) => {
            if (!w || w.cartaId == null) return { righe: ['Scegli una carta'], dati: { vuoto: true } };
            const carta = carteReali.find(c => String(c.id) === String(w.cartaId));
            if (!carta) return { righe: ['Carta non più disponibile'], dati: { vuoto: true } };
            return { righe: [carta.name || ''], immagine: carta.immagine, cardId: carta.id, rarita: carta.rarita };
        },
        // Stato vuoto (mai scelta, o cancellata nel frattempo): il tap
        // apre la ricerca invece del flip-modal. 'w' è il terzo parametro
        // che _eseguiAzioneWidget passa ora a TUTTE le azioni (gli altri
        // 18 widget lo ignorano, retrocompatibile).
        azione: (dati, punto, w) => {
            if (dati && dati.vuoto) { if (w) _apriRicercaCartaVetrina(w.instanceId); return; }
            if (dati && dati.cardId != null) apriFlipCardHome(dati.cardId);
        },
    },
    // RIMOSSO (Claudio, 2026-08-28): "Carta del giorno", ritenuto inutile.
    // Voci orfane in _ballTITOLI_BREVI/_ballASPETTO lasciate intatte —
    // per ripristinarlo, riportare qui l'oggetto originale (vedi git/backup).
    // RIMOSSO (Claudio, 2026-08-28): "Gruppo", ritenuto inutile.
    location: {
        titolo: 'Location', icona: 'fa-map-pin',
        preview: () => {
            const collezione = carteReali.filter(c => c.stato === 'collezione');
            const conteggi = {};
            collezione.forEach(c => { const k = c.location || '—'; conteggi[k] = (conteggi[k] || 0) + 1; });
            const ordinate = Object.entries(conteggi).sort((a, b) => b[1] - a[1]);
            const top = ordinate.slice(0, 2);
            if (top.length === 0) return { righe: ['Nessuna carta'] };
            // 'voci' = tutte le posizioni ordinate: le tessere grandi ne
            // disegnano quattro, le righe di testo restano le prime due.
            return { righe: top.map(([k, v]) => `${k}: ${v}`), dati: { voci: ordinate } };
        },
        // AGGIUNTO (2026-08-30): prima non aveva 'tab', quindi
        // _eseguiAzioneWidget cadeva su apriDettaglioWidget(w.id, ...) =
        // apriDettaglioWidget('location', ...) — non essendo 'location' né
        // una whitelist custom né una vera view-section, il tap sul tile
        // non portava da nessuna parte. Ora ha una pagina propria (#location
        // in index.html, renderPaginaLocation() sotto).
        tab: 'location',
    },
    suggerimento: {
        titolo: 'Prossima azione', icona: 'fa-lightbulb',
        // UNIFICATO con "Da fare" (Claudio, 2026-08-28: "saranno la stessa
        // cosa"). Stessa priorità di sempre (coda errori → prezzi scaduti
        // → wishlist sotto obiettivo → gruppo al lavoro) ma ora raccoglie
        // TUTTI i segnali attivi, non solo il primo: il tile mostra solo
        // il più urgente in testo, 'badge' (letto da renderWidgetHome
        // invece del numero estratto da 'righe[0]') conta quanti sono
        // attivi, e 'dati.segnali' è l'elenco completo che legge
        // renderPaginaDaFare(). Il tap apre sempre la pagina dedicata,
        // mai più una tab diversa a seconda del segnale.
        preview: async () => {
            const segnali = [];
            const codaErrori = await _contaCodaErrori();
            if (codaErrori > 0) segnali.push({ id: 'coda_errori', testo: `${codaErrori} carte da correggere`, stato: 'allerta', tab: 'inserimento' });

            const lista = (typeof _elencoPrezziScaduti !== 'undefined' && _elencoPrezziScaduti) ? _elencoPrezziScaduti : [];
            if (lista.length > 0) segnali.push({ id: 'prezzi_scaduti', testo: `${lista.length} prezzi da aggiornare`, stato: 'allerta', tab: 'prezzi' });

            const wishlistSottoTarget = carteReali.filter(c => c.tabella === 'wishlist' && c.prezzoObiettivo != null && c.price > 0 && c.price <= c.prezzoObiettivo);
            if (wishlistSottoTarget.length > 0) segnali.push({ id: 'wishlist_obiettivo', testo: `${wishlistSottoTarget.length} in wishlist sotto obiettivo`, stato: 'ok', tab: 'binder' });

            const alLavoro = await _dispositiviAttiviOra();
            if (alLavoro) segnali.push({ id: 'gruppo_al_lavoro', testo: 'Il gruppo sta lavorando', stato: undefined, tab: 'home' });

            _rilevaTransizioniDaFare(segnali); // storico 24h — vedi sopra la funzione

            if (segnali.length === 0) return { righe: ['Tutto in ordine'], stato: 'ok', dati: { segnali: [] } };
            const primo = segnali[0];
            return { righe: [primo.testo], stato: primo.stato, badge: segnali.length, dati: { segnali } };
        },
        azione: (dati, punto) => { apriDettaglioWidget('dafare', punto); },
    },
    // RIMOSSO (Claudio, 2026-08-28): "Orologio".
    // RIMOSSO (Claudio, 2026-08-28): "Aggiungi carta".
    condividi: {
        titolo: 'Condividi', icona: 'fa-share-nodes',
        // Pagina dedicata costruita 2026-08-28 — prima forzava
        // arbitrariamente currentMode='scambio' (unica scelta possibile
        // dato che openQrModal dipende dallo stato globale di navigazione,
        // non da un binder scelto). Ora elenca tutto il condivisibile
        // reale (tutti i binder pubblici + Sealed), non solo Scambio.
        preview: () => ({ righe: ['Cosa vuoi condividere?'] }),
        azione: (dati, punto) => { apriDettaglioWidget('condividi', punto); },
    },

    // Sbloccato (Claudio, 2026-08-27): queue.ui.js letto per intero in
    // questa sessione. Zero query proprie: legge _numNuoviMatchScambio/
    // _numNuoviMatchWishlist, due variabili di modulo scritte da
    // aggiornaBadgeMatch() (queue.ui.js) — funzione che prima girava una
    // sola volta al login e ora è agganciata anche al polling lento (60s,
    // vedi avviaPollingWidgetHome qui sotto). Scelta esplicita di
    // Claudio: "la cosa più semplice e affidabile quando avremo anche più
    // utenti" — niente interrogazione delle RPC di match ogni 15s per
    // ogni utente col widget attivo.
    match: {
        titolo: 'Match trovati', icona: 'fa-handshake',
        preview: () => {
            const scambio = typeof _numNuoviMatchScambio !== 'undefined' ? _numNuoviMatchScambio : 0;
            const wishlist = typeof _numNuoviMatchWishlist !== 'undefined' ? _numNuoviMatchWishlist : 0;
            const totale = scambio + wishlist;
            const dati = { scambio, wishlist };
            if (totale === 0) return { righe: ['Nessuna novità'], dati };
            return { righe: [`${totale} nuov${totale === 1 ? 'a' : 'e'} corrispondenz${totale === 1 ? 'a' : 'e'}`], stato: 'ok', dati };
        },
        // Pagina dedicata costruita 2026-08-28 (prima apriva Binders in
        // generale, unico punto disponibile all'epoca).
        azione: (dati, evt) => { apriDettaglioWidget('match', evt); },
    },
    // Sbloccato (Claudio, 2026-08-27): extension.ui.js letto per intero in
    // questa sessione. _chiediVersioneEstensione()/_chiediAiutaGruppoEstensione()
    // già esistenti lì, stessa tolleranza timeout (1.2s, mai blocca il
    // render della home) delle altre chiamate verso l'estensione — zero
    // query nuove, stessa filosofia degli altri widget.
    estensione: {
        titolo: 'Estensione', icona: 'fa-link',
        preview: async () => {
            const versione = await _chiediVersioneEstensione();
            if (!versione) return { righe: ['Non rilevata'], rilevata: false, dati: { rilevata: false } };
            const aiutaGruppo = await _chiediAiutaGruppoEstensione();
            return {
                righe: [`v${versione}`, aiutaGruppo ? 'Aiuta il gruppo: attivo' : 'Aiuta il gruppo: no'],
                stato: aiutaGruppo ? 'ok' : undefined,
                rilevata: true,
                dati: { rilevata: true, versione, aiutaGruppo: !!aiutaGruppo },
            };
        },
        // Click: porta l'estensione in primo piano (stessa funzione già
        // usata dal bottone "Apri l'app" in sidebar — vedi
        // _mandaAperturaAppAEstensione in extension.ui.js). Se non
        // rilevata, apre Impostazioni invece: lì ci sono le istruzioni
        // d'installazione, non ha senso provare ad "aprire" qualcosa che
        // non c'è.
        azione: async (dati, evt) => {
            if (dati && dati.rilevata) {
                await _mandaAperturaAppAEstensione();
            } else {
                apriDettaglioWidget('impostazioni', evt);
            }
        },
    },

    // ═══════════════════════════════════════════════════════════════════
    // WIDGET NUOVI (27/08/2026) — ispirati ai tipi del mockup di Opus.
    // ═══════════════════════════════════════════════════════════════════
    // Nascono TUTTI nascosti: _caricaLayoutWidget aggiunge gli id non
    // presenti nel layout salvato con visibile:false, quindi compaiono nel
    // picker "Aggiungi" senza spostare nulla di ciò che hai già in home.
    //
    // Nessuna query nuova: tutto da carteReali, già in memoria.
    //
    // AGGIORNATO 2026-09-07 — il paragrafo sotto era vero il 27/08, non lo
    // è più per intero:
    //   - 'missioni' è diventato un widget reale nel frattempo (vedi sotto
    //     CATALOGO_WIDGET.missioni: RPC vera, pagina dedicata propria).
    //   - 'bustina' è in corso di sblocco (Roadmap_Widget_Bustina_2026-09-07
    //     + compilato di sessione): schema e RPC lato DB già in produzione,
    //     verificati dal vivo con aperture reali.
    //   - 'polvere' resta segnaposto per scelta esplicita di Claudio
    //     (2026-09-07): la RPC che la genera esiste già (doppioni della
    //     bustina), ma dove/come si spende è rimandato a una sessione
    //     dedicata a parte.
    //   - 'fortuna' e i "traguardi-a-punti" restano non implementati,
    //     nessun cambiamento su questi due: il testo originale sotto vale
    //     ancora SOLO per loro.
    //
    // NON portati dal mockup, e perché (testo originale): appartengono a
    // un'economia di gioco (aprire pacchetti, guadagnare valuta) che in
    // CardSync non esisteva ancora al 27/08. "Set completo" richiederebbe
    // di sapere quante carte compone ogni set: dato non presente nello
    // schema, e non lo deduco dal codice.

    valore_collezione: {
        titolo: 'Valore collezione', icona: 'fa-sack-dollar',
        preview: () => {
            const coll = carteReali.filter(c => c.stato === 'collezione');
            const valore = coll.reduce((t, c) => t + (Number(c.price) || 0) * (Number(c.qty) || 1), 0);
            const top = coll.slice()
                .sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0))
                .slice(0, 3)
                .map(c => ({ nome: c.name || '—', valore: Number(c.price) || 0, id: c.id, immagine: c.immagine, rarita: c.rarita }));
            const media = coll.length ? valore / coll.length : 0;
            return {
                righe: [`€ ${valore.toLocaleString('it-IT', { maximumFractionDigits: 0 })}`],
                dati: { valore, media, pezzi: coll.length, top }
            };
        },
        // MODIFICATO (2026-08-30): prima apriva semplicemente la sezione
        // Prezzi (tab:'prezzi') — ora ha una pagina propria dedicata
        // (#valore in index.html, renderPaginaValoreCollezione() sotto).
        // Nessun impatto sul tracciamento missioni m38/m39/m40/m80/m81
        // (registrano l'evento su w.id='valore_collezione', non su
        // 'def.tab' — vedi _eseguiAzioneWidget).
        tab: 'valore',
    },

    doppioni: {
        titolo: 'Doppioni', icona: 'fa-clone',
        preview: () => {
            const doppie = carteReali
                .filter(c => c.stato === 'collezione' && (Number(c.qty) || 1) > 1)
                .sort((a, b) => (Number(b.qty) || 1) - (Number(a.qty) || 1));
            const copieExtra = doppie.reduce((t, c) => t + ((Number(c.qty) || 1) - 1), 0);
            const valoreExtra = doppie.reduce((t, c) => t + (Number(c.price) || 0) * ((Number(c.qty) || 1) - 1), 0);
            if (doppie.length === 0) return { righe: ['Nessun doppione'], stato: 'ok', dati: { titoli: 0, copieExtra: 0, valoreExtra: 0, lista: [] } };
            return {
                righe: [`${doppie.length} carte in più copie`],
                dati: {
                    titoli: doppie.length, copieExtra, valoreExtra,
                    lista: doppie.slice(0, 3).map(c => ({ nome: c.name || '—', qty: Number(c.qty) || 1, id: c.id, immagine: c.immagine, rarita: c.rarita }))
                }
            };
        },
        // MODIFICATO (2026-08-30): prima apriva semplicemente
        // Visualizzazione generica (tab:'visualizzazione') — ora ha una
        // pagina propria (#doppioni in index.html,
        // renderPaginaDoppioni() sotto).
        tab: 'doppioni',
    },

    wishlist_obiettivi: {
        titolo: 'Wishlist', icona: 'fa-heart',
        preview: () => {
            const desiderate = carteReali.filter(c => c.tabella === 'wishlist' || c.stato === 'wishlist');
            const conObiettivo = desiderate.filter(c => c.prezzoObiettivo != null && c.prezzoObiettivo > 0);
            const raggiunte = conObiettivo.filter(c => c.price > 0 && c.price <= c.prezzoObiettivo);
            if (desiderate.length === 0) return { righe: ['Wishlist vuota'], dati: { totale: 0, raggiunte: 0, conObiettivo: 0, lista: [] } };
            return {
                righe: [raggiunte.length > 0 ? `${raggiunte.length} sotto obiettivo` : `${desiderate.length} carte desiderate`],
                stato: raggiunte.length > 0 ? 'ok' : undefined,
                dati: {
                    totale: desiderate.length,
                    conObiettivo: conObiettivo.length,
                    raggiunte: raggiunte.length,
                    lista: (raggiunte.length ? raggiunte : conObiettivo).slice(0, 3).map(c => ({
                        nome: c.name || '—',
                        prezzo: Number(c.price) || 0,
                        obiettivo: Number(c.prezzoObiettivo) || 0,
                        id: c.id
                    }))
                }
            };
        },
        // MODIFICATO (2026-08-30): prima apriva semplicemente Binder
        // (tab:'binder') — ora ha una pagina propria dedicata (#wishlist
        // in index.html, renderPaginaWishlist() sotto). Nessun impatto sul
        // tracciamento missioni (registrano l'evento su w.id=
        // 'wishlist_obiettivi', non su def.tab).
        tab: 'wishlist',
    },

    // RIMOSSO (2026-08-29): "Traguardi" — unificato nel widget "Missioni",
    // che ora apre una pagina dedicata con missioni del giorno + traguardi
    // permanenti Fase 1 (65 voci dal catalogo dichiarativo in
    // ui/missioni.ui.js). Voci grafiche orfane in _ballTITOLI_BREVI/
    // _ballASPETTO/_ballCORPI (righe ~1096/1127/1749) lasciate intatte per
    // rollback a una riga, stesso principio della pulizia widget 24→19
    // (Compilato_2026-08-28). _caricaLayoutWidget filtra da sé i layout
    // salvati che referenziano ancora 'traguardi' (CATALOGO_WIDGET[w.id]
    // fallisce, riga .filter già esistente) — nessun'altra modifica
    // necessaria per chi ha già questa tessera in home.

    // RIMOSSO (Claudio, 2026-08-28): "Lingue".

    // ── SET / ESPANSIONI ─────────────────────────────────────────────────
    // Avanzamento verso il set completo, dedotto dal CODICE della carta.
    //
    // ATTENZIONE, LIMITE DICHIARATO: il formato di 'codice' non è definito
    // da nessuna parte nel sito — nessun placeholder d'esempio, nessuna
    // validazione, nessuna regex: arriva grezzo dalla colonna. Quello che
    // segue riconosce i formati più diffusi (vedi _ballLeggiCodice) e, se
    // non riconosce nulla, il widget dice "codici non riconosciuti" invece
    // di mostrare percentuali inventate. Da tarare su codici reali.
    set_completamento: {
        titolo: 'Set', icona: 'fa-layer-group',
        preview: () => {
            const coll = carteReali.filter(c => c.stato === 'collezione' && c.tabella === 'carte');
            const set = {};
            let riconosciute = 0;
            coll.forEach(c => {
                const letto = _ballLeggiCodice(c.code);
                if (!letto) return;
                riconosciute++;
                if (!set[letto.set]) set[letto.set] = { numeri: new Set(), senzaNumero: 0 };
                // Le carte con numero si contano per numeri DISTINTI: la
                // stessa carta posseduta in versione normale e Poké Ball
                // vale uno solo ai fini del set completo.
                if (letto.numero != null) set[letto.set].numeri.add(letto.numero);
                else set[letto.set].senzaNumero++;
            });

            const voci = Object.entries(set).map(([sigla, conteggio]) => {
                const info = _ballLIBRERIA_SET[sigla];
                const hai = conteggio.numeri.size + conteggio.senzaNumero;
                return {
                    sigla,
                    nome: info ? info.nome : sigla,
                    hai,
                    // Un set senza numerazione (MFB) non ha avanzamento
                    // possibile: si mostra solo quante carte hai.
                    senzaNumerazione: conteggio.numeri.size === 0 && conteggio.senzaNumero > 0,
                    // Il totale c'è solo se il set è in libreria: senza,
                    // niente percentuale (mai un avanzamento su un totale
                    // che non conosciamo).
                    totale: info ? info.totale : null,
                    perc: info && info.totale && conteggio.numeri.size > 0
                        ? Math.min(100, (conteggio.numeri.size / info.totale) * 100)
                        : null
                };
            }).sort((a, b) => (b.perc ?? -1) - (a.perc ?? -1) || b.hai - a.hai);

            if (voci.length === 0) {
                return { righe: [riconosciute === 0 ? 'Codici non riconosciuti' : 'Nessun set'], dati: { voci: [], riconosciute, inLibreria: 0 } };
            }
            const inLibreria = voci.filter(v => v.totale).length;
            const prima = voci[0];
            return {
                righe: [prima.totale ? `${prima.nome}: ${prima.hai}/${prima.totale}` : `${voci.length} espansioni`],
                dati: { voci, riconosciute, inLibreria }
            };
        },
        // MODIFICATO (2026-08-30): prima apriva semplicemente
        // Visualizzazione generica (tab:'visualizzazione') — ora ha una
        // pagina propria (#set in index.html, renderPaginaSet() sotto).
        // Nessun click sulle righe (deciso da Claudio): la pagina è solo
        // di consultazione.
        tab: 'set',
    },

    // ═══════════════════════════════════════════════════════════════════
    // SEGNAPOSTO GACHA (27/08/2026)
    // ═══════════════════════════════════════════════════════════════════
    // Claudio: "verranno collegati in seguito con un aggiornamento
    // riguardante un gacha". Finché quel sistema non esiste, questi tre
    // NON mostrano dati finti spacciati per veri: dichiarano di essere in
    // arrivo. Sono 'bloccato: true', quindi il preview è sincrono e il
    // tocco non apre niente (vedi _eseguiAzioneWidget, che esce subito sui
    // widget bloccati) — nessun vicolo cieco per l'utente.
    //
    // Quando arriverà il gacha: togliere 'bloccato', sostituire il preview
    // con quello vero e riempire il corpo in _ballCORPI, dove ognuno ha già
    // la sua voce pronta.
    // ══════════════════════════════════════════════════════════════════
    // BLOCCHI DELLA HOME FISSA DIVENTATI WIDGET (Claudio, 2026-09-03)
    // ══════════════════════════════════════════════════════════════════
    // I blocchi di #home erano cinque, ma solo TRE meritavano un widget:
    //   - "Cosa richiede la tua attenzione" NON e' qui: il widget
    //     'suggerimento' ("Prossima azione") calcola gia' esattamente le
    //     stesse quattro voci con la stessa priorita' (coda errori ->
    //     prezzi scaduti -> wishlist sotto obiettivo -> gruppo al lavoro).
    //     Duplicarlo avrebbe pagato due volte le stesse 3 query.
    //   - "Carte Totali / Valore Est." NON e' qui: gia' coperto da
    //     'valore_collezione' e 'visualizzazione'.
    //   - "Ultima sincronizzazione" NON e' qui: nessuna funzione in tutto
    //     il progetto riempie #ultimaSincronizzazioneHome. E' un
    //     contenitore morto che mostra "Caricamento..." per sempre. Non si
    //     porta in un widget un dato che non esiste: prima va deciso da
    //     dove viene.
    variazione_valore: {
        titolo: 'Variazione valore', icona: 'fa-arrow-trend-up',
        tagliaDefault: '6x5', // il grafico e la scomposizione hanno bisogno di altezza
        // Sostituisce il segnaposto "arrivera' con lo storico del valore
        // totale" che stava nella home fissa da mesi. Ora lo storico c'e'
        // (tabella storico_valore_collezione, migration 36) e viene
        // riempito da ui/storico-valore.avvio.js a ogni apertura.
        preview: async () => {
            const righe = await _storicoValoreConCache();

            // UN SOLO GIORNO NON E' UNA VARIAZIONE. Va detto, non
            // mostrato come "zero": zero significherebbe "non e'
            // cambiato niente", che e' un'altra cosa e sarebbe una bugia
            // il primo giorno.
            if (!righe.length) return { righe: ['In raccolta', 'nessun dato ancora'], badge: false, dati: null };
            if (righe.length < 2) {
                return {
                    righe: ['In raccolta', 'serve un secondo giorno'],
                    badge: false,
                    dati: { soloUnGiorno: true, valore: Number(righe[0].valore_totale) || 0 },
                };
            }

            const c = storicoValoreConfronta(righe);
            const eur = (v) => (v >= 0 ? '+' : '−') + '€ ' + Math.abs(Number(v) || 0).toFixed(2);
            const testo = [eur(c.variazione)];
            if (c.carteAggiunte > 0) testo.push(`${c.carteAggiunte} cart${c.carteAggiunte === 1 ? 'a aggiunta' : 'e aggiunte'}`);

            return {
                righe: testo,
                badge: false,
                // 'ok' o 'allerta' accendono il semaforo della sfera: qui
                // NON si usano. Un calo di valore non e' un problema da
                // risolvere e non deve far agitare la ball come fa un
                // errore in coda.
                dati: {
                    ...c,
                    serie: righe.map(r => Number(r.valore_totale) || 0),
                    valoreOggi: Number(righe[righe.length - 1].valore_totale) || 0,
                    giorniMisurati: righe.length,
                },
            };
        },
    },
    primo_piano: {
        titolo: 'In primo piano', icona: 'fa-crown',
        // Tre categorie da tre carte: sotto questa taglia le miniature non
        // ci stanno e il widget non mostrerebbe cio' per cui esiste.
        tagliaDefault: '6x8',
        // Stesso identico calcolo di renderBinderInPrimoPianoHome()
        // (ui/home.ui.js): tre categorie da 3 carte, solo collezione,
        // escluse le sealed. Tutto da carteReali, gia' in memoria:
        // ZERO query nuove, si puo' rivalutare a ogni giro di polling
        // senza costo.
        preview: () => {
            const carteSingole = (typeof carteReali !== 'undefined' ? carteReali : [])
                .filter(c => c.stato === 'collezione' && c.tipo !== 'sealed');
            const perValore = carteSingole.slice().sort((a, b) => (b.price || 0) - (a.price || 0)).slice(0, 3);
            const conVariazione = carteSingole.filter(c => c.variazioneNumerica != null);
            const su = conVariazione.filter(c => c.variazioneNumerica > 0).sort((a, b) => b.variazioneNumerica - a.variazioneNumerica).slice(0, 3);
            const giu = conVariazione.filter(c => c.variazioneNumerica < 0).sort((a, b) => a.variazioneNumerica - b.variazioneNumerica).slice(0, 3);
            const top = perValore[0];
            if (!top) return { righe: ['Nessuna carta ancora'], dati: { perValore: [], su: [], giu: [] } };
            const righe = [`${top.name || '—'}`, `€ ${(Number(top.price) || 0).toFixed(2)}`];
            if (su[0]) righe.push(`↑ ${su[0].name || '—'}`);
            return {
                righe,
                // NIENTE 'immagine': con una foto la tessera perde la sfera
                // e mostra icona piatta + miniatura (vedi il ramo BALL_ATTIVA
                // in renderWidgetHome). Il risultato era che questo widget e
                // "Ultime aggiunte" venivano resi in due modi diversi a
                // seconda che la prima carta avesse o meno una foto — un
                // dettaglio che non c'entra niente con il widget. La sfera
                // resta sempre; la foto della carta si vede aprendola.
                badge: false,
                // 'immagine' e 'rarita' servono a _ballMiniCarta per
                // disegnare le miniature nel corpo grande (vedi _ballCORPI).
                // Senza, il widget ricadeva sul corpo generico a tre righe
                // di testo — che e' il motivo per cui non somigliava per
                // niente al blocco della home fissa.
                dati: {
                    perValore: perValore.map(c => ({ id: c.id, nome: c.name, prezzo: Number(c.price) || 0, immagine: c.immagine, rarita: c.rarita })),
                    su: su.map(c => ({ id: c.id, nome: c.name, varia: c.variazioneNumerica, immagine: c.immagine, rarita: c.rarita })),
                    giu: giu.map(c => ({ id: c.id, nome: c.name, varia: c.variazioneNumerica, immagine: c.immagine, rarita: c.rarita })),
                },
            };
        },
        // Stesso gesto della home fissa: la carta si apre nel flip-modal,
        // non cambia tab.
        azione: (dati) => {
            const primo = dati && dati.perValore && dati.perValore[0];
            if (primo && typeof apriFlipCardHome === 'function') apriFlipCardHome(primo.id);
        },
    },
    carte_recenti: {
        titolo: 'Ultime aggiunte', icona: 'fa-clock',
        tagliaDefault: '6x6', // cinque righe di elenco più la fila di miniature
        // Da carteReali per createdAt, come caricaAttivitaRecentiHome().
        // Nessuna query.
        preview: () => {
            const collezione = (typeof carteReali !== 'undefined' ? carteReali : [])
                .filter(c => c.stato === 'collezione');
            const ultime = collezione.slice()
                .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
                .slice(0, 5);
            if (ultime.length === 0) return { righe: ['Nessuna carta ancora'], dati: { lista: [] } };
            const quando = (c) => c.createdAt
                ? new Date(c.createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
                : '—';
            return {
                righe: ultime.slice(0, 3).map(c => `${c.name || '—'} · ${quando(c)}`),
                // Vedi la nota in 'primo_piano': niente immagine, cosi' la
                // sfera c'e' sempre. E niente numerino: sarebbe il giorno.
                badge: false,
                dati: { lista: ultime.map(c => ({ id: c.id, nome: c.name, quando: quando(c), immagine: c.immagine, rarita: c.rarita })) },
            };
        },
        tab: 'visualizzazione',
    },
    prezzi_recenti: {
        titolo: 'Prezzi aggiornati', icona: 'fa-clock-rotate-left',
        tagliaDefault: '6x5', // cinque righe di elenco, senza miniature
        // UNICO dei tre che costa una query (storico_prezzi, via
        // _ultimiPrezziAggiornati in ui/home.ui.js, a blocchi da 500 id).
        // renderWidgetHome gira anche dal polling: senza freno questa
        // query partirebbe a ogni giro. Da qui la cache a tempo qui
        // sotto — stessa lezione delle 47 query di valutaEAssegna.
        preview: async () => {
            const righeCache = await _prezziRecentiConCache();
            if (!righeCache.length) return { righe: ['Nessun controllo ancora'], dati: { lista: [] } };
            return {
                righe: righeCache.slice(0, 3).map(r => `${r.nome} · ${r.quando}`),
                badge: false, // sarebbe il giorno dell'ultimo controllo, non un conteggio
                dati: { lista: righeCache },
            };
        },
        tab: 'prezzi',
    },
    // Sostituisce il segnaposto "I tuoi contributi al gruppo — presto
    // disponibili" della home fissa. Il dato ora esiste (migration 37) e lo
    // scrive l'ESTENSIONE, non il sito: qui si legge soltanto.
    // LIVELLO DI VISIBILITA' INTERMEDIO, deciso da Claudio: il proprio
    // numero e il totale del gruppo, mai chi ha fatto quanto. Non
    // aggiungere qui un elenco per utente: il vincolo vive nella RPC, ma
    // romperlo comincerebbe da questa voce.
    contributi: {
        titolo: 'Contributi al gruppo', icona: 'fa-hands-helping',
        // Due numeri affiancati piu' la barra della quota: sotto questa
        // altezza la barra finisce appiccicata ai numeri.
        tagliaDefault: '6x4',
        preview: async () => {
            const d = await _contributiConCache();
            // DATO ASSENTE != TRE ZERI. Qui la RPC non ha risposto: non si
            // puo' dire "zero", che sarebbe un'affermazione sul lavoro
            // fatto dal gruppo.
            if (!d) return { righe: ['Contributi al gruppo'], badge: false, dati: null };
            return {
                righe: [`${d.miei} cart${d.miei === 1 ? 'a' : 'e'} per il gruppo`],
                // Sarebbe un conteggio di contributi, non di notifiche: un
                // pallino permanente sull'icona. Stessa scelta di
                // carte_recenti e prezzi_recenti.
                badge: false,
                dati: d,
            };
        },
    },
    // SBLOCCATO (2026-09-07): schema/RPC lato DB già in produzione,
    // verificati dal vivo (Roadmap_Widget_Bustina_2026-09-07.md + compilato
    // di sessione). Nessun 'tab' esplicito: la chiave del catalogo
    // ('bustina') coincide già con l'id della view-section e con la
    // condizione in apriDettaglioWidget — stesso trucco già usato da
    // 'missioni', vedi commento lì.
    bustina: {
        titolo: 'Bustina', icona: 'fa-gift',
        preview: async () => {
            try {
                const userId = await authGetUserId();
                if (!userId) return { righe: ['Accedi per aprire le bustine'], dati: { placeholder: true } };
                const { data, error } = await bustinaStatoLeggi();
                if (error) throw error;
                if (data.giornaliera_disponibile) {
                    return { righe: ['Bustina pronta!'], stato: 'ok', dati: data };
                }
                if (data.saldo_guadagnate > 0) {
                    return { righe: [`${data.saldo_guadagnate} bustin${data.saldo_guadagnate === 1 ? 'a' : 'e'} da aprire`], stato: 'ok', dati: data };
                }
                return { righe: ['Torna domani'], dati: data };
            } catch (e) {
                console.error('[bustina widget] preview:', e);
                return { righe: ['Bustina'], dati: { placeholder: true } };
            }
        },
    },
    polvere: {
        titolo: 'Polvere', icona: 'fa-wand-sparkles', bloccato: true,
        preview: () => ({ righe: ['In arrivo'], dati: { placeholder: true, testo: 'La valuta guadagnata coi doppioni' } }),
    },
    missioni: {
        titolo: 'Missioni', icona: 'fa-list-check',
        // Async: chiama il repository per il conteggio di oggi. Se l'utente
        // non è loggato o la query fallisce, ricade su un testo neutro
        // invece di un errore visibile (stesso principio degli altri
        // preview() del catalogo).
        preview: async () => {
            try {
                const userId = await authGetUserId();
                if (!userId) return { righe: ['Accedi per vedere le missioni'], dati: { placeholder: true } };
                const oggi = MOTORE_MISSIONI.periodoCorrente('giornaliera');
                const pool = MOTORE_MISSIONI.missioniDelGiorno(userId, oggi.periodo);
                const { count, error } = await missioniCompletatePeriodo(userId, oggi.periodo);
                if (error) throw error;
                const fatte = count || 0;
                return {
                    righe: [`${fatte}/${pool.length} missioni completate oggi`],
                    dati: { fatte, totali: pool.length },
                };
            } catch (e) {
                console.error('[missioni widget] preview:', e);
                return { righe: ['Missioni del giorno'], dati: { placeholder: true } };
            }
        },
    },
});

// Cache dei "prezzi aggiornati di recente". La lettura di storico_prezzi
// e' l'unica query dei tre widget nuovi, e renderWidgetHome viene
// richiamata anche dal polling: senza freno partirebbe a ogni giro, per un
// dato che cambia raramente. 5 minuti sono abbondantemente sotto la
// frequenza con cui i prezzi si aggiornano davvero.
// Lo storico del valore cambia una volta al giorno: interrogarlo a ogni
// giro di polling sarebbe sprecato. 15 minuti sono generosi e restano
// molto sotto la frequenza con cui il dato si muove davvero.
const TTL_STORICO_VALORE_MS = 15 * 60 * 1000;
let _cacheStoricoValore = { quando: 0, righe: [] };

async function _storicoValoreConCache() {
    if (Date.now() - _cacheStoricoValore.quando < TTL_STORICO_VALORE_MS) return _cacheStoricoValore.righe;
    if (typeof storicoValoreUltimiGiorni !== 'function' || typeof authGetUserId !== 'function') return [];
    try {
        const userId = await authGetUserId();
        if (!userId) return [];
        const { data } = await storicoValoreUltimiGiorni(userId, 30);
        // Come per i prezzi recenti: MAI mettere in cache un risultato
        // vuoto. Il primo giro puo' capitare prima che la tabella abbia
        // righe o mentre la rete e' giu', e memorizzare quel vuoto
        // significherebbe mostrare "in raccolta" per un quarto d'ora a un
        // widget che i dati ce li ha.
        if (data && data.length) _cacheStoricoValore = { quando: Date.now(), righe: data };
        return data || [];
    } catch (e) {
        console.error('[widget variazione_valore]', e);
        return [];
    }
}

const TTL_PREZZI_RECENTI_MS = 5 * 60 * 1000;
let _cachePrezziRecenti = { quando: 0, righe: [] };

async function _prezziRecentiConCache() {
    if (Date.now() - _cachePrezziRecenti.quando < TTL_PREZZI_RECENTI_MS) return _cachePrezziRecenti.righe;
    // Se la funzione non c'e' (ordine di caricamento, file non presente)
    // il widget mostra "nessun controllo" invece di rompere il render.
    if (typeof _ultimiPrezziAggiornati !== 'function' || typeof carteReali === 'undefined') return [];
    try {
        const collezione = carteReali.filter(c => c.stato === 'collezione');
        const eventi = await _ultimiPrezziAggiornati(collezione.map(c => c.id), 5);
        const righe = eventi
            .map(ev => ({ ev, card: collezione.find(c => String(c.id) === String(ev.carta_id)) }))
            .filter(x => x.card) // la carta potrebbe essere stata eliminata nel frattempo
            .map(({ ev, card }) => ({
                id: card.id,
                nome: card.name || '—',
                variante: card.variation || '',
                quando: new Date(ev.registrato_il).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
                immagine: card.immagine,
                rarita: card.rarita,
            }));
        // MAI mettere in cache un risultato vuoto. Il primo giro puo'
        // capitare prima che carteReali sia popolato, o mentre la rete e'
        // ancora giu': memorizzare quel vuoto significava mostrare "nessun
        // controllo ancora" per cinque minuti su un widget che i dati ce li
        // aveva. Difetto visto in uno screenshot di Claudio il 2026-09-03,
        // dopo che lo stesso widget aveva funzionato poco prima.
        if (righe.length) _cachePrezziRecenti = { quando: Date.now(), righe };
        return righe;
    } catch (e) {
        console.error('[widget prezzi_recenti]', e);
        return [];
    }
}

// Contributi al gruppo (migration 37). Una RPC sola, ma renderWidgetHome
// gira anche dal polling: senza freno partirebbe a ogni giro. Il dato si
// muove solo quando qualcuno del gruppo lavora una riga altrui, quindi 5
// minuti sono abbondanti.
const TTL_CONTRIBUTI_MS = 5 * 60 * 1000;
let _cacheContributi = { quando: 0, dati: null };

// DIVERGENZA DELIBERATA DALLE DUE CACHE QUI SOPRA, che scartano il vuoto:
// qui TRE ZERI SONO UN RISULTATO VALIDO e vanno messi in cache. Sono lo
// stato reale finche' nessuno del gruppo ha lavorato una riga altrui —
// stato che durera' giorni. Applicando la regola "mai mettere in cache un
// vuoto" si rifarebbe la query a ogni giro di polling, per settimane, per
// riottenere sempre gli stessi tre zeri.
// Quello che NON si mette in cache e' il dato ASSENTE (errore, RPC caduta,
// utente non ancora autenticato): quello si', va richiesto di nuovo.
async function _contributiConCache() {
    if (_cacheContributi.dati && Date.now() - _cacheContributi.quando < TTL_CONTRIBUTI_MS) return _cacheContributi.dati;
    if (typeof contributiGruppoLeggi !== 'function') return null;
    try {
        const { data, error } = await contributiGruppoLeggi();
        if (error || !data) return null;
        _cacheContributi = { quando: Date.now(), dati: data };
        return data;
    } catch (e) {
        console.error('[widget contributi]', e);
        return null;
    }
}

// [SEZIONE SPOSTATA in ui/paginainiziale.ui.js — STEP 0 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

// ═══════════════════════════════════════════════════════════════════════
// GRAFICA POKÉ BALL DEI WIDGET (sessione 2026-08-27)
// ═══════════════════════════════════════════════════════════════════════
// Sostituisce l'icona FontAwesome delle tessere con una sfera disegnata in
// SVG. Origine: mockup approvato da Claudio (mockup-widget.html), a sua
// volta derivato dal modulo di Opus.
//
// ROLLBACK IN UNA RIGA: mettere BALL_ATTIVA a false qui sotto. Il markup
// vecchio (icona FontAwesome) è ancora tutto in renderWidgetHome(), dentro
// il ramo else — non è stato cancellato niente.
//
// NOMI: tutto ciò che vive qui è prefissato _ball/_pkdx perché gli script
// del sito condividono un unico scope globale (niente moduli): nomi come
// TEMPI, EMBLEMI o miscela() avrebbero potuto collidere con qualunque
// altro dei 29 file e rompere l'intera pagina in fase di parsing.
const BALL_ATTIVA = true;

// Tempi originali dell'animazione di cattura. Alzare/abbassare qui cambia
// tutta la sequenza senza toccare i singoli fotogrammi.
const _ballTEMPI = { lancio: 300, scosse: 1500, click: 720 };
const _ballAMPIEZZA = [19, 14, 10];

// viewBox ritagliato ESATTAMENTE sulla sfera (centro 64,70 raggio 48), così
// il riquadro CSS coincide con la sfera e il diametro è il lato del box.
// Quello originale ('0 0 128 124') lasciava margine per le skin sporgenti
// (orecchie, code): servirà se un giorno arriveranno, oggi renderebbe la
// sfera solo il 75% del riquadro.
const _ballVIEWBOX = '16 22 96 96';

// ── PALETTE: la ball segue il TEMA, non il singolo widget ────────────────
// Claudio: calotta lavanda sul viola, verde sul tema verde; nei temi scuri
// la pancia diventa grigia (mai bianca: su fondo scuro abbaglia) e la
// calotta si incupisce.
// I colori per-widget originali sono conservati in CATALOGO_WIDGET.colore e
// oggi inutilizzati: diventeranno un tema a sé ("ball colorate" sbloccabili)
// riportando _ballPaletteWidget a true.
let _ballPaletteWidget = false;

const _ballPALETTE = {
    viola:       { calotta: '#9b7ce0', pancia: ['#ffffff', '#f0efeb', '#c9c8c2'] },
    verde:       { calotta: '#5aa860', pancia: ['#ffffff', '#f0efeb', '#c9c8c2'] },
    pokemon:     { calotta: '#4f93de', pancia: ['#ffffff', '#f0efeb', '#c9c8c2'] },
    scuro_viola: { calotta: '#5b4a86', pancia: ['#a9a8b0', '#94939c', '#6f6e77'] },
    scuro_verde: { calotta: '#3c6b45', pancia: ['#a9aca8', '#949892', '#6e726d'] },
    scuro_poke:  { calotta: '#2f5687', pancia: ['#a8abb2', '#93969d', '#6d7077'] }
};

function _ballTemaAttivo() {
    const b = document.body.classList;
    const scuro = b.contains('dark-mode');
    const verde = b.contains('theme-verde');
    const poke  = b.contains('theme-pokemon');
    if (scuro) return _ballPALETTE[verde ? 'scuro_verde' : (poke ? 'scuro_poke' : 'scuro_viola')];
    if (verde) return _ballPALETTE.verde;
    if (poke)  return _ballPALETTE.pokemon;
    return _ballPALETTE.viola;
}

// ── COLORI DERIVATI ──────────────────────────────────────────────────────
function _ballMiscela(hex, target, q) {
    let h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    let r = parseInt(h.substring(0,2),16), g = parseInt(h.substring(2,4),16), b = parseInt(h.substring(4,6),16);
    r = Math.round(r + (target-r)*q); g = Math.round(g + (target-g)*q); b = Math.round(b + (target-b)*q);
    return `rgb(${r},${g},${b})`;
}
const _ballSchiarisci = (h, q) => _ballMiscela(h, 255, q);
const _ballScurisci   = (h, q) => _ballMiscela(h, 0, q);

// ── EMBLEMI (sagome bianche piene, riquadro 24x24) ───────────────────────
// I primi dieci vengono dal modulo di Opus; gli ultimi quattro (persone,
// pin, lampadina, orologio) sono stati disegnati per i widget che non
// avevano corrispondenza.
const _ballEMBLEMI = {
    carte: (c) => {
        const st = ` stroke="${_ballScurisci(c, 0.5)}" stroke-width="1.6" stroke-linejoin="round"`;
        return `<rect x="1.8" y="6.5" width="8.5" height="13" rx="1.6" transform="rotate(-26 6.05 13)"${st}/>` +
               `<rect x="13.7" y="6.5" width="8.5" height="13" rx="1.6" transform="rotate(26 17.95 13)"${st}/>` +
               `<rect x="7.75" y="4.5" width="8.5" height="15" rx="1.6"${st}/>`;
    },
    piu: () => '<rect x="9.8" y="2.6" width="4.4" height="18.8" rx="2.2"/>' +
               '<rect x="2.6" y="9.8" width="18.8" height="4.4" rx="2.2"/>',
    scambio: () => '<path d="M2.5 6.4h11.2V2.4l7.8 5.6-7.8 5.6V9.6H2.5z"/>' +
                   '<path d="M21.5 17.6H10.3v4l-7.8-5.6 7.8-5.6v4h11.2z"/>',
    monete: (c) => '<ellipse cx="12" cy="5.6" rx="9" ry="3.4"/>' +
        '<path d="M3 8.4v3.1c0 1.9 4 3.4 9 3.4s9-1.5 9-3.4V8.4c0 1.9-4 3.4-9 3.4S3 10.3 3 8.4z"/>' +
        '<path d="M3 14.4v3.1c0 1.9 4 3.4 9 3.4s9-1.5 9-3.4v-3.1c0 1.9-4 3.4-9 3.4s-9-1.5-9-3.4z"/>' +
        `<ellipse cx="12" cy="5.6" rx="3.4" ry="1.3" fill="${c}"/>`,
    cuore: () => '<path d="M12 21.2l-1.7-1.6C4.3 14.1 1 11.1 1 7.6 1 4.5 3.4 2 6.5 2c1.8 0 3.5.9 4.5 2.2C12 2.9 13.7 2 15.5 2 18.6 2 21 4.5 21 7.6c0 3.5-3.3 6.5-9.3 12z"/>',
    album: (c) => '<path d="M2 4.6C4.6 3 8.4 3 11 4.6v15.2C8.4 18.2 4.6 18.2 2 19.8z"/>' +
        '<path d="M13 4.6C15.6 3 19.4 3 22 4.6v15.2c-2.6-1.6-6.4-1.6-9 0z"/>' +
        `<rect x="11.2" y="3.4" width="1.6" height="17" rx=".8" fill="${c}"/>`,
    bustina: (c) => '<path d="M5.5 7L7.1 4.9 8.8 7l1.6-2.1L12 7l1.6-2.1L15.3 7l1.6-2.1L18.5 7v13.6a1.4 1.4 0 01-1.4 1.4H6.9a1.4 1.4 0 01-1.4-1.4z"/>' +
        `<rect x="5.5" y="11.9" width="13" height="2.4" fill="${c}"/>`,
    polvere: () => '<path d="M12 0.8l2.6 6.6 6.6 2.6-6.6 2.6L12 19.2 9.4 12.6 2.8 10l6.6-2.6z"/>' +
        '<path d="M19.4 14.6l1.1 2.8 2.8 1.1-2.8 1.1-1.1 2.8-1.1-2.8-2.8-1.1 2.8-1.1z"/>' +
        '<circle cx="4.4" cy="18.4" r="2.1"/>',
    regalo: (c) => '<rect x="3" y="9.5" width="18" height="11.8" rx="1.8"/>' +
        '<rect x="1.8" y="5.6" width="20.4" height="4.6" rx="1.6"/>' +
        `<rect x="10.4" y="4.5" width="3.2" height="17" fill="${c}"/>` +
        '<path d="M12 6.2C10.2 2.2 5.6 2.6 6.1 5.6c.4 2.1 3.5 1.7 5.9.6z"/>' +
        '<path d="M12 6.2c1.8-4 6.4-3.6 5.9-.6-.4 2.1-3.5 1.7-5.9.6z"/>',
    ingranaggio: (c) => '<path d="M12 1.8l1.7 2.7 3.2-.7.5 3.2 3 1.3-1.6 2.8 1.6 2.8-3 1.3-.5 3.2-3.2-.7L12 22.2l-1.7-2.7-3.2.7-.5-3.2-3-1.3L5.2 13 3.6 10.2l3-1.3.5-3.2 3.2.7z"/>' +
        `<circle cx="12" cy="12" r="3.7" fill="${c}"/>`,

    persone: (c) => '<circle cx="8.6" cy="7.4" r="4.3"/>' +
        '<path d="M1.6 20.6c0-3.9 3.1-6.6 7-6.6s7 2.7 7 6.6z"/>' +
        '<circle cx="17.2" cy="8.6" r="3.4" opacity=".92"/>' +
        '<path d="M13.4 20.6c0-3.2 1.9-5.4 4.6-5.4 2.6 0 4.4 2 4.4 5.4z" opacity=".92"/>' +
        `<path d="M13.9 15.6c.9-.3 2-.4 3.3-.4" stroke="${c}" stroke-width="1.2" fill="none"/>`,
    pin: (c) => '<path d="M12 1.6c-4.2 0-7.4 3.2-7.4 7.3 0 5.3 6.4 12.6 6.7 12.9a1 1 0 001.4 0c.3-.3 6.7-7.6 6.7-12.9 0-4.1-3.2-7.3-7.4-7.3z"/>' +
        `<circle cx="12" cy="8.8" r="3.1" fill="${c}"/>`,
    lampadina: (c) => '<path d="M12 1.8a7 7 0 00-4.1 12.7c.7.5 1.1 1.2 1.1 2v.4h6v-.4c0-.8.4-1.5 1.1-2A7 7 0 0012 1.8z"/>' +
        '<rect x="8.8" y="18" width="6.4" height="2.2" rx="1.1"/>' +
        '<rect x="9.6" y="21" width="4.8" height="1.8" rx=".9"/>' +
        `<path d="M10.4 14.6h3.2" stroke="${c}" stroke-width="1.1" fill="none"/>`,
    orologio: (c) => '<circle cx="12" cy="12.4" r="9.6"/>' +
        `<circle cx="12" cy="12.4" r="7.4" fill="${c}"/>` +
        '<rect x="11.2" y="6.6" width="1.7" height="6.6" rx=".85"/>' +
        '<rect x="11.2" y="11.6" width="5.6" height="1.7" rx=".85"/>' +
        '<circle cx="12" cy="12.4" r="1.4"/>'
};

// ── DISEGNO DELLA SFERA ──────────────────────────────────────────────────
let _ballContatore = 0;

// CACHE — indispensabile, non un'ottimizzazione facoltativa:
// renderWidgetHome() rigenera tutto l'innerHTML ogni 15s (polling veloce).
// Senza cache ricostruirebbe 10 SVG completi (5 gradienti + clipPath +
// testo su arco ciascuno) quattro volte al minuto, per sempre, e
// _ballContatore crescerebbe senza limite. L'SVG dipende solo da emblema,
// tema e testo inciso: si rigenera solo quando uno dei tre cambia.
const _ballCache = new Map();

function _ballSvgCache(emblema, coloreWidget, etichetta) {
    const pal = _ballTemaAttivo();
    const chiave = [emblema, _ballPaletteWidget ? coloreWidget : pal.calotta, pal.pancia[0], etichetta || ''].join('|');
    if (!_ballCache.has(chiave)) _ballCache.set(chiave, _ballSvg(emblema, coloreWidget, etichetta));
    return _ballCache.get(chiave);
}
function _ballSvutaCache() { _ballCache.clear(); }

function _ballSvg(emblema, coloreWidget, etichetta) {
    const u = 'b' + (++_ballContatore);
    const emblemaFn = _ballEMBLEMI[emblema] || _ballEMBLEMI.piu;
    const pal = _ballTemaAttivo();
    const colore = _ballPaletteWidget ? (coloreWidget || pal.calotta) : pal.calotta;
    const p = pal.pancia;

    // ── ETICHETTA INCISA ────────────────────────────────────────────────
    // Non è un <div> sovrapposto (piatto su una superficie curva: sembrava
    // un adesivo) ma un <textPath> lungo un arco concentrico alla sfera,
    // raggio 34 su centro (64,70): parte a ore 9, passa sotto il pulsante
    // centrale, risale a ore 3. Sweep-flag 0 = passa SOTTO (con 1 sopra).
    // Finitura incisa: copia chiara spostata di 0.9 in basso = luce nel
    // solco, copia scura sopra = il solco. Nessun rilievo, nessuna ombra.
    // Font Space Grotesk maiuscolo: già caricato dal sito, proporzionale
    // (~40% più stretto di Press Start 2P, quindi entra molto più grande
    // nello stesso arco) e senza discendenti, la forma più leggibile su
    // testo piccolo e curvo. textLength impedisce qualunque sbordo.
    let inciso = '';
    if (etichetta) {
        const testo = String(etichetta).toUpperCase()
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const n = testo.length || 1;
        const arcoUtile = 84;
        const corpoBase = n <= 6 ? 15 : (n <= 9 ? 14 : 13);
        const fs = Math.max(6.5, Math.min(corpoBase, arcoUtile / (n * 0.64)));
        const lung = Math.min(n * fs * 0.64, arcoUtile);
        const comune = `font-family="Space Grotesk, sans-serif" font-weight="700" font-size="${fs.toFixed(2)}" letter-spacing="0.35" text-anchor="middle"`;
        const pathAttr = `href="#arc-${u}" startOffset="50%" textLength="${lung.toFixed(1)}" lengthAdjust="spacingAndGlyphs"`;
        inciso =
            `<defs><path id="arc-${u}" d="M 30 70 A 34 34 0 0 0 98 70" fill="none"/></defs>` +
            '<g class="ball-inciso">' +
                `<text ${comune} fill="${p[0]}" opacity="0.8" transform="translate(0 0.9)"><textPath ${pathAttr}>${testo}</textPath></text>` +
                `<text ${comune} fill="#2b2b33" opacity="0.95"><textPath ${pathAttr}>${testo}</textPath></text>` +
            '</g>';
    }

    return `<svg class="ball-svg" viewBox="${_ballVIEWBOX}">` +
      '<defs>' +
        `<linearGradient id="t-${u}" x1="0.2" y1="0" x2="0.8" y2="1">` +
          `<stop offset="0" stop-color="${_ballSchiarisci(colore, .34)}"/>` +
          `<stop offset="0.55" stop-color="${colore}"/>` +
          `<stop offset="1" stop-color="${_ballScurisci(colore, .3)}"/></linearGradient>` +
        `<linearGradient id="f-${u}" x1="0.3" y1="0" x2="0.7" y2="1">` +
          `<stop offset="0" stop-color="${p[0]}"/><stop offset="0.6" stop-color="${p[1]}"/>` +
          `<stop offset="1" stop-color="${p[2]}"/></linearGradient>` +
        `<radialGradient id="s-${u}" cx="0.33" cy="0.27" r="0.78">` +
          '<stop offset="0" stop-color="#fff" stop-opacity="0.34"/>' +
          '<stop offset="0.45" stop-color="#fff" stop-opacity="0"/>' +
          '<stop offset="0.82" stop-color="#000" stop-opacity="0.1"/>' +
          '<stop offset="1" stop-color="#000" stop-opacity="0.42"/></radialGradient>' +
        `<linearGradient id="r-${u}" x1="0.15" y1="0.1" x2="0.85" y2="0.95">` +
          '<stop offset="0.45" stop-color="#fff" stop-opacity="0"/>' +
          '<stop offset="1" stop-color="#fff" stop-opacity="0.55"/></linearGradient>' +
        `<radialGradient id="p-${u}" cx="0.36" cy="0.32" r="0.75">` +
          `<stop offset="0" stop-color="${p[0]}"/><stop offset="0.7" stop-color="${p[1]}"/>` +
          `<stop offset="1" stop-color="${p[2]}"/></radialGradient>` +
        `<clipPath id="c-${u}"><circle cx="64" cy="70" r="48"/></clipPath>` +
      '</defs>' +
      `<g clip-path="url(#c-${u})">` +
        `<rect x="0" y="0" width="128" height="70" fill="url(#t-${u})"/>` +
        `<rect x="0" y="70" width="128" height="54" fill="url(#f-${u})"/>` +
        '<rect x="0" y="64.7" width="128" height="10.6" fill="#17171a"/>' +
        '<rect x="0" y="65.7" width="128" height="2" fill="#fff" opacity="0.13"/>' +
        '<g transform="translate(64 43.5) scale(1.42) translate(-12 -12)" fill="#ffffff" opacity="0.97">' +
          emblemaFn(colore) +
        '</g>' +
        `<circle cx="64" cy="70" r="48" fill="url(#s-${u})"/>` +
        '<ellipse cx="42" cy="41" rx="13.5" ry="7.5" transform="rotate(-34 42 41)" fill="#fff" opacity="0.26"/>' +
        '<circle cx="33" cy="53" r="3.2" fill="#fff" opacity="0.22"/>' +
        `<circle cx="64" cy="70" r="44" fill="none" stroke="url(#r-${u})" stroke-width="5"/>` +
      '</g>' +
      '<circle cx="64" cy="70" r="48" fill="none" stroke="#141416" stroke-width="3.6"/>' +
      inciso +
      '<circle cx="64" cy="70" r="13.5" fill="#17171a"/>' +
      `<circle cx="64" cy="70" r="10" fill="url(#p-${u})"/>` +
      '<circle class="btn-flash" cx="64" cy="70" r="10" fill="#ff2d20" opacity="0"/>' +
      '<circle cx="60.7" cy="66.7" r="2.9" fill="#fff" opacity="0.85"/>' +
      '<circle class="ball-flash" cx="64" cy="70" r="48" fill="#fff" opacity="0"/>' +
    '</svg>';
}

// ── PARTICELLE DELLA CATTURA ─────────────────────────────────────────────
const _ballSTELLE = [
    { top: 10, left: 5,  size: 11, color: '#F2C230', dx: -22, dy: -20, ritardo: 0 },
    { top: 6,  left: 77, size: 9,  color: '#ffffff', dx:  22, dy: -18, ritardo: 70 },
    { top: 70, left: 2,  size: 9,  color: '#ffffff', dx: -20, dy:  20, ritardo: 45 },
    { top: 74, left: 79, size: 12, color: '#F2C230', dx:  21, dy:  21, ritardo: 100 }
];
const _ballCORIANDOLI = [
    { size: 4, color: '#D4342C', dx: -26, dy: -22, ritardo: 0 },
    { size: 3, color: '#3B7DD8', dx:  24, dy: -26, ritardo: 40 },
    { size: 5, color: '#F2C230', dx:  30, dy:   6, ritardo: 20 },
    { size: 3, color: '#639922', dx: -30, dy:   8, ritardo: 60 },
    { size: 4, color: '#D6538F', dx:  12, dy:  28, ritardo: 80 },
    { size: 3, color: '#ffffff', dx: -14, dy:  30, ritardo: 30 }
];

function _ballParticelle() {
    let out = '';
    _ballSTELLE.forEach(s => {
        out += `<span class="pkdx-star" style="top:${s.top}%; left:${s.left}%; width:${s.size}px; height:${s.size}px; background:${s.color};"></span>`;
    });
    _ballCORIANDOLI.forEach(s => {
        out += `<span class="pkdx-conf" style="top:56.25%; left:50%; margin:${-s.size/2}px 0 0 ${-s.size/2}px; width:${s.size}px; height:${s.size}px; background:${s.color};"></span>`;
    });
    return out;
}

// ── TITOLI BREVI PER L'INCISIONE ─────────────────────────────────────────
// L'arco della pancia regge ~84 unità: "Visualizzazione" (15 caratteri) ci
// starebbe solo a un corpo illeggibile. Il titolo per esteso resta quello
// vero del catalogo e ricompare su 2x1/1x2/2x2, dove il testo sta fuori.
const _ballTITOLI_BREVI = {
    variazione_valore: 'Variazione',
    primo_piano: 'In vetrina',
    carte_recenti: 'Recenti',
    prezzi_recenti: 'Controlli',
    visualizzazione: 'Visualizza',
    inserimento: 'Inserisci',
    prezzi: 'Prezzi',
    binder: 'Binders',
    sealed: 'Sealed',
    ultima_carta: 'Preferita',
    carta_del_giorno: 'Del giorno',
    gruppo_attivo: 'Gruppo',
    location: 'Location',
    suggerimento: 'Da fare',
    orologio: 'Orologio',
    aggiungi_carta: 'Aggiungi',
    condividi: 'Condividi',
    match: 'Match',
    estensione: 'Estensione',
    valore_collezione: 'Valore',
    doppioni: 'Doppioni',
    wishlist_obiettivi: 'Wishlist',
    traguardi: 'Traguardi',
    lingue: 'Lingue',
    set_completamento: 'Set',
    bustina: 'Bustina',
    polvere: 'Polvere',
    missioni: 'Missioni'
};

// ── EMBLEMA + COLORE PER OGNI WIDGET ─────────────────────────────────────
// Il colore serve solo al tema futuro "ball colorate": oggi la calotta la
// decide _ballTemaAttivo().
const _ballASPETTO = {
    // Blocchi della home fissa diventati widget (2026-09-03). Emblemi
    // scelti fra quelli gia' disegnati, nessun disegno nuovo:
    // 'album' per la vetrina delle carte in primo piano, 'piu' per le
    // ultime aggiunte, 'orologio' per i prezzi controllati di recente.
    variazione_valore:{ emblema: 'monete',      colore: '#3FA45B' },
    primo_piano:      { emblema: 'album',       colore: '#D4A017' },
    carte_recenti:    { emblema: 'piu',         colore: '#3B7DD8' },
    prezzi_recenti:   { emblema: 'orologio',    colore: '#F2C230' },
    visualizzazione:  { emblema: 'carte',       colore: '#3B7DD8' },
    inserimento:      { emblema: 'piu',         colore: '#D4342C' },
    prezzi:           { emblema: 'monete',      colore: '#F2C230' },
    binder:           { emblema: 'album',       colore: '#7F77DD' },
    sealed:           { emblema: 'regalo',      colore: '#D6538F' },
    ultima_carta:     { emblema: 'carte',       colore: '#4EA9A4' },
    carta_del_giorno: { emblema: 'polvere',     colore: '#E8763C' },
    gruppo_attivo:    { emblema: 'persone',     colore: '#5AA8D8' },
    location:         { emblema: 'pin',         colore: '#639922' },
    suggerimento:     { emblema: 'lampadina',   colore: '#F2C230' },
    orologio:         { emblema: 'orologio',    colore: '#8A8A93' },
    aggiungi_carta:   { emblema: 'piu',         colore: '#639922' },
    condividi:        { emblema: 'scambio',     colore: '#4B9AA6' },
    match:            { emblema: 'cuore',       colore: '#D6538F' },
    estensione:       { emblema: 'ingranaggio', colore: '#7A7F8A' },
    // Widget nuovi
    valore_collezione:{ emblema: 'monete',      colore: '#C8892B' },
    doppioni:         { emblema: 'carte',       colore: '#8A6FD0' },
    wishlist_obiettivi:{ emblema: 'cuore',      colore: '#D6538F' },
    traguardi:        { emblema: 'polvere',     colore: '#F2C230' },
    lingue:           { emblema: 'album',       colore: '#4B9AA6' },
    set_completamento:{ emblema: 'carte',       colore: '#3B7DD8' },
    // Segnaposto gacha: emblemi già scelti, si accenderanno con il sistema
    bustina:          { emblema: 'bustina',     colore: '#D6538F' },
    polvere:          { emblema: 'polvere',     colore: '#7F77DD' },
    missioni:         { emblema: 'regalo',      colore: '#639922' }
};

// Il testo inciso è stretto: teniamo le prime parole, il resto lo dice la
// pagina che si apre toccando.
function _ballAccorcia(testo) {
    if (!testo) return '';
    if (testo.length <= 12) return testo;
    const parole = String(testo).split(' ');
    let out = '';
    for (const parola of parole) {
        if ((out + ' ' + parola).trim().length > 12) break;
        out = (out + ' ' + parola).trim();
    }
    return out || String(testo).slice(0, 12);
}

// ── ANIMAZIONE DI CATTURA ────────────────────────────────────────────────
function _ballFotogrammiScosse() {
    const a = _ballAMPIEZZA;
    const r = (g) => `rotate(${g}deg)`;
    return [
        { transform: r(0), offset: 0 }, { transform: r(0), offset: 0.06 },
        { transform: r(-a[0]), offset: 0.12 }, { transform: r(0), offset: 0.18 },
        { transform: r(a[0]), offset: 0.24 }, { transform: r(0), offset: 0.30 },
        { transform: r(0), offset: 0.38 },
        { transform: r(a[1]), offset: 0.44 }, { transform: r(0), offset: 0.50 },
        { transform: r(-a[1]), offset: 0.56 }, { transform: r(0), offset: 0.62 },
        { transform: r(0), offset: 0.70 },
        { transform: r(-a[2]), offset: 0.76 }, { transform: r(0), offset: 0.82 },
        { transform: r(a[2]), offset: 0.88 }, { transform: r(0), offset: 0.94 },
        { transform: r(0), offset: 1 }
    ];
}

const _ballLAMPEGGI = [
    { opacity: 0, offset: 0 }, { opacity: 0, offset: 0.27 }, { opacity: 1, offset: 0.31 },
    { opacity: 0, offset: 0.37 }, { opacity: 0, offset: 0.59 }, { opacity: 1, offset: 0.63 },
    { opacity: 0, offset: 0.69 }, { opacity: 0, offset: 0.91 }, { opacity: 1, offset: 0.95 },
    { opacity: 0, offset: 1 }
];

function _ballAttendi(ms) { return new Promise(r => setTimeout(r, ms)); }
function _ballAnimaFinito(el, f, o) {
    const a = el.animate(f, o);
    return a.finished || new Promise(r => { a.onfinish = r; });
}

// Vera o falsa a seconda delle due preferenze: "spegni tutto" vince su
// "spegni solo la cattura".
function _ballAnimazioniAttive() { return prefAnimWidgetGet(); }
function _ballCatturaAttiva() { return prefAnimWidgetGet() && prefAnimCatturaGet(); }

async function _ballGiocaCattura(tile) {
    if (!_ballCatturaAttiva()) return;

    const ball = tile.querySelector('.pkdx-ball');

    // Widget con miniatura carta al posto della ball (Ultima carta, Carta
    // del giorno): non c'è sfera da scuotere, ma il tocco non deve sembrare
    // morto — un piccolo scatto sulla carta e via.
    if (!ball) {
        const thumb = tile.querySelector('.widget-tile-thumb');
        if (!thumb) return;
        await _ballAnimaFinito(thumb, [
            { transform: 'scale(1) rotate(0deg)' },
            { transform: 'scale(1.12) rotate(-4deg)', offset: 0.35 },
            { transform: 'scale(1.06) rotate(3deg)', offset: 0.65 },
            { transform: 'scale(1) rotate(0deg)' }
        ], { duration: 420, easing: 'cubic-bezier(.3,.8,.35,1)' });
        return;
    }

    const body   = ball.querySelector('.pkdx-ball-body');
    const glow   = ball.querySelector('.pkdx-ball-glow');
    const dust   = ball.querySelector('.pkdx-dust');
    const shadow = ball.querySelector('.ball-shadow');
    const sweep  = ball.querySelector('.ball-sweep');
    const flash  = ball.querySelector('.ball-flash');
    const btn    = ball.querySelector('.btn-flash');
    const rings  = ball.querySelectorAll('.pkdx-lock-ring');
    const stars  = ball.querySelectorAll('.pkdx-star');
    const confs  = ball.querySelectorAll('.pkdx-conf');
    if (!body || !shadow) return;

    const lato = ball.offsetWidth || 90;
    const k = lato / 112;
    const spazioSopra = ball.getBoundingClientRect().top - tile.getBoundingClientRect().top;
    const salto = Math.max(4, Math.min(lato * 0.23, spazioSopra - 2));

    shadow.animate([
        { transform: 'scale(.5, .6)', opacity: 0.1 },
        { transform: 'scale(1.3, 1)', opacity: 0.34, offset: 0.55 },
        { transform: 'scale(1, 1)', opacity: 0.26 }
    ], { duration: _ballTEMPI.lancio, easing: 'cubic-bezier(.3,.7,.4,1)' });

    if (dust) dust.animate([
        { opacity: 0, transform: 'scale(.4)', offset: 0 },
        { opacity: 0, transform: 'scale(.4)', offset: 0.5 },
        { opacity: 0.8, transform: 'scale(.7)', offset: 0.62 },
        { opacity: 0, transform: 'scale(1.5)' }
    ], { duration: _ballTEMPI.lancio + 160, easing: 'ease-out' });

    await _ballAnimaFinito(body, [
        { transform: `translateY(${-salto}px) scale(.94, 1.06)` },
        { transform: 'translateY(0) scale(1.1, .9)', offset: 0.5 },
        { transform: `translateY(${-salto*0.2}px) scale(.97, 1.03)`, offset: 0.74 },
        { transform: 'translateY(0) scale(1, 1)' }
    ], { duration: _ballTEMPI.lancio, easing: 'cubic-bezier(.35,.65,.35,1)' });

    _vibraSeSupportato([18, 320, 18, 320, 18]);
    if (glow) glow.animate(_ballLAMPEGGI, { duration: _ballTEMPI.scosse, easing: 'linear' });
    if (btn) btn.animate(_ballLAMPEGGI, { duration: _ballTEMPI.scosse, easing: 'linear' });

    shadow.animate([
        { transform: 'translateX(0) scaleX(1)' },
        { transform: `translateX(${2.5*k}px) scaleX(.86)`, offset: .12 },
        { transform: 'translateX(0) scaleX(1)', offset: .18 },
        { transform: `translateX(${-2.5*k}px) scaleX(.86)`, offset: .24 },
        { transform: 'translateX(0) scaleX(1)', offset: .30 },
        { transform: `translateX(${-2*k}px) scaleX(.9)`, offset: .44 },
        { transform: 'translateX(0) scaleX(1)', offset: .50 },
        { transform: `translateX(${2*k}px) scaleX(.9)`, offset: .56 },
        { transform: 'translateX(0) scaleX(1)', offset: .62 },
        { transform: `translateX(${1.4*k}px) scaleX(.94)`, offset: .76 },
        { transform: `translateX(${-1.4*k}px) scaleX(.94)`, offset: .88 },
        { transform: 'translateX(0) scaleX(1)' }
    ], { duration: _ballTEMPI.scosse, easing: 'ease-in-out' });

    await _ballAnimaFinito(body, _ballFotogrammiScosse(), { duration: _ballTEMPI.scosse, easing: 'ease-in-out' });

    _vibraSeSupportato(20);
    if (flash) flash.animate([{ opacity: 0 }, { opacity: 0.9, offset: 0.12 }, { opacity: 0 }],
        { duration: _ballTEMPI.click, easing: 'ease-out' });

    if (sweep) sweep.animate([
        { opacity: 0, transform: 'rotate(18deg) translateX(0px)' },
        { opacity: 1, transform: `rotate(18deg) translateX(${50*k}px)`, offset: 0.4 },
        { opacity: 0, transform: `rotate(18deg) translateX(${130*k}px)` }
    ], { duration: _ballTEMPI.click, delay: 60, easing: 'cubic-bezier(.2,.7,.3,1)' });

    rings.forEach((anello, r) => {
        anello.animate([
            { opacity: 0.95, transform: 'scale(.7)' },
            { opacity: 0, transform: `scale(${1.7 + r*0.35})` }
        ], { duration: _ballTEMPI.click, delay: r*90, easing: 'ease-out' });
    });

    stars.forEach((stella, i) => {
        const s = _ballSTELLE[i]; if (!s) return;
        const sx = s.dx * k * 2.4, sy = s.dy * k * 2.4;
        stella.animate([
            { opacity: 0, transform: 'scale(.2) rotate(0deg) translate(0px,0px)' },
            { opacity: 1, transform: `scale(1.1) rotate(45deg) translate(${sx*0.35}px,${sy*0.35}px)`, offset: 0.3 },
            { opacity: 0, transform: `scale(.4) rotate(120deg) translate(${sx}px,${sy}px)` }
        ], { duration: _ballTEMPI.click, delay: s.ritardo, easing: 'ease-out' });
    });

    confs.forEach((conf, j) => {
        const c = _ballCORIANDOLI[j]; if (!c) return;
        const cx = c.dx * k * 2.4, cy = c.dy * k * 2.4;
        conf.animate([
            { opacity: 0, transform: 'scale(.4) translate(0px,0px)' },
            { opacity: 1, transform: `scale(1) translate(${cx*0.4}px,${cy*0.4}px)`, offset: 0.25 },
            { opacity: 0, transform: `scale(.7) translate(${cx}px,${cy+12*k}px)` }
        ], { duration: _ballTEMPI.click + 120, delay: c.ritardo, easing: 'cubic-bezier(.2,.6,.4,1)' });
    });

    await _ballAnimaFinito(ball, [
        { transform: 'scale(1)' }, { transform: 'scale(1.16)', offset: 0.2 },
        { transform: 'scale(.97)', offset: 0.55 }, { transform: 'scale(1)' }
    ], { duration: _ballTEMPI.click, easing: 'cubic-bezier(.2,.8,.3,1)' });

    await _ballAttendi(70);
}

// ── SEMAFORO ─────────────────────────────────────────────────────────────
// Una ball si scuote e mostra i punti esclamativi solo se quel widget ha
// davvero qualcosa da fare. Il movimento È la notifica.
// Quali widget: quelli il cui preview() restituisce stato 'allerta', più
// Match (novità) ed Estensione (non rilevata) — vedi _ballChiedeAttenzione.
function _ballMostraAvviso(ball, forte, durata) {
    if (!ball) return;
    const segni = ball.querySelectorAll('.pkdx-avviso i');
    if (!segni.length) return;
    const quali = forte ? [0, 1, 2] : [1];
    const ritardi = forte ? [90, 0, 150] : [0];
    quali.forEach((idx, k) => {
        segni[idx].animate([
            { opacity: 0, transform: 'translateY(35%) scale(.3)' },
            { opacity: 1, transform: 'translateY(-12%) scale(1.18)', offset: .2 },
            { opacity: 1, transform: 'translateY(0) scale(1)', offset: .34 },
            { opacity: 1, transform: 'translateY(0) scale(1)', offset: .68 },
            { opacity: 0, transform: 'translateY(-30%) scale(.8)' }
        ], { duration: durata + 320, delay: ritardi[k], easing: 'cubic-bezier(.25,.9,.35,1)' });
    });
}

function _ballScuoti(body, forte) {
    if (!body) return;
    const a = forte ? 9 : 5;
    _ballMostraAvviso(body.parentNode, forte, forte ? 900 : 750);

    const ombra = body.parentNode && body.parentNode.querySelector('.ball-shadow');
    if (ombra) ombra.animate([
        { transform: 'translateX(0) scaleX(1)' },
        { transform: `translateX(${a*0.22}px) scaleX(.9)`, offset: .25 },
        { transform: `translateX(${-a*0.2}px) scaleX(.92)`, offset: .55 },
        { transform: 'translateX(0) scaleX(1)' }
    ], { duration: forte ? 900 : 750, easing: 'ease-in-out' });

    body.animate([
        { transform: 'rotate(0deg)' },
        { transform: `rotate(${-a}deg)`, offset: .25 },
        { transform: `rotate(${a * .9}deg)`, offset: .55 },
        { transform: `rotate(${-a * .4}deg)`, offset: .8 },
        { transform: 'rotate(0deg)' }
    ], { duration: forte ? 900 : 750, easing: 'ease-in-out' });
}

function _ballAccendiAlone(tile, forte) {
    const alone = tile.querySelector('.tile-alone');
    if (!alone) return;
    alone.animate([
        { opacity: 0 }, { opacity: forte ? .5 : .3, offset: .3 }, { opacity: 0 }
    ], { duration: forte ? 1100 : 900, easing: 'ease-in-out' });
}

// null = ferma, 'forte' = tre punti esclamativi, 'normale' = uno.
// Legge SOLO l'anteprima già calcolata dal render (nessuna query nuova).
function _ballChiedeAttenzione(id, anteprima) {
    if (!anteprima) return null;
    if (id === 'match') return (anteprima.stato === 'ok' && /[1-9]/.test(anteprima.righe[0] || '')) ? 'forte' : null;
    if (id === 'estensione') return anteprima.rilevata === false ? 'normale' : null;
    if (anteprima.stato !== 'allerta') return null;
    return (id === 'inserimento' || id === 'prezzi') ? 'forte' : 'normale';
}

// Stato di attenzione dell'ultimo render, riempito da renderWidgetHome().
let _ballAttenzioni = {};
const _BALL_INTERVALLO_SEMAFORO_MS = 5200;
let _ballSemaforoInterval = null;

function _ballGiraSemaforo() {
    if (!BALL_ATTIVA || !_ballAnimazioniAttive()) return;
    if (_editModeWidget || document.body.classList.contains('phone-detail-open')) return;

    let ritardo = 0;
    Object.keys(_ballAttenzioni).forEach(id => {
        const livello = _ballAttenzioni[id];
        if (!livello) return;
        const tile = document.querySelector(`.widget-tile[data-widget-id="${id}"]`);
        if (!tile) return;
        const forte = livello === 'forte';
        setTimeout(() => {
            _ballScuoti(tile.querySelector('.pkdx-ball-body'), forte);
            _ballAccendiAlone(tile, forte);
        }, ritardo);
        ritardo += 260;
    });
}

function _ballAvviaSemaforo() {
    if (_ballSemaforoInterval) clearInterval(_ballSemaforoInterval);
    _ballSemaforoInterval = setInterval(_ballGiraSemaforo, _BALL_INTERVALLO_SEMAFORO_MS);
}

// Il tema si cambia da Impostazioni con funzioni che vivono in altri file
// (setSiteTheme/toggleDarkMode, mai lette in questa sessione): invece di
// modificarle, guardiamo le classi del <body>. Se cambiano, le ball vanno
// ridisegnate — i gradienti sono scritti dentro l'SVG, una variabile CSS
// non basterebbe.
function _ballOsservaTema() {
    if (!window.MutationObserver) return;
    // Solo queste tre classi cambiano l'aspetto delle sfere. Guardare
    // l'intera className farebbe ridisegnare tutto anche per classi che non
    // c'entrano nulla — per esempio 'senza-anim-widget', che aggiungiamo noi
    // stessi e provocherebbe un secondo render inutile.
    const rilevanti = ['dark-mode', 'theme-verde', 'theme-pokemon'];
    const leggi = () => rilevanti.filter(c => document.body.classList.contains(c)).join(',');
    let ultimo = leggi();
    new MutationObserver(() => {
        const ora = leggi();
        if (ora === ultimo) return;
        ultimo = ora;
        _ballSvutaCache();
        renderWidgetHome();
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
}

// ── TOGGLE DELLE IMPOSTAZIONI ────────────────────────────────────────────
// Chiamate dai quattro interruttori in index.html (sezione Impostazioni).
function toggleAnimWidget(attive) {
    prefAnimWidgetSet(attive);
    const riga = document.getElementById('rigaAnimCattura');
    if (riga) riga.style.opacity = attive ? '1' : '0.45';
    _ballApplicaClasseAnimazioni();
    renderWidgetHome();
}

// Con le animazioni spente non deve restare NIENTE che si muova da solo:
// cattura e semaforo li fermano già le due funzioni _ballAnimazioni*, ma il
// riflesso olografico delle miniature è puro CSS e va fermato da qui.
function _ballApplicaClasseAnimazioni() {
    document.body.classList.toggle('senza-anim-widget', !prefAnimWidgetGet());
}
function toggleAnimCattura(attiva) { prefAnimCatturaSet(attiva); }
function toggleScritteBall(attive) { prefScritteBallSet(attive); _ballSvutaCache(); renderWidgetHome(); }
function toggleBadgeWidget(attivo) { prefBadgeWidgetSet(attivo); renderWidgetHome(); }

function _ballSincronizzaToggleImpostazioni() {
    const coppie = [
        ['chkAnimWidget', prefAnimWidgetGet()],
        ['chkAnimCattura', prefAnimCatturaGet()],
        ['chkScritteBall', prefScritteBallGet()],
        ['chkBadgeWidget', prefBadgeWidgetGet()]
    ];
    coppie.forEach(([id, valore]) => {
        const el = document.getElementById(id);
        if (el) el.checked = valore;
    });
    const riga = document.getElementById('rigaAnimCattura');
    if (riga) riga.style.opacity = prefAnimWidgetGet() ? '1' : '0.45';
}


// ═══════════════════════════════════════════════════════════════════════
// CONTENUTI DELLE TESSERE GRANDI (sessione 2026-08-27, seconda parte)
// ═══════════════════════════════════════════════════════════════════════
// Su 1x1 la tessera è la sola sfera col titolo inciso. Sulle taglie grandi
// (2x1, 1x2, 2x2) c'era finora lo stesso identico contenuto della 1x1 —
// titolo e una riga di testo — quindi il quadruplo dello spazio non diceva
// niente di più. Qui ogni widget disegna il proprio contenuto.
//
// DUE SLOT, come nella demo di Opus:
//   inline → accanto alla sfera, riga superiore. C'è su tutte le taglie
//            grandi, deve stare stretto (su 2x1 è l'unico spazio).
//   blocco → sotto, per intero. Solo dove c'è altezza: 1x2 e 2x2.
//
// Scelta (Claudio: "come secondo te è meglio"): sulle taglie grandi la
// grafica SOSTITUISCE le righe di testo. Ripetere "7 da aggiornare" sotto
// una barra che dice già quello è la stessa informazione due volte, e ruba
// lo spazio che serve alla grafica. Il titolo resta.
//
// PER ORA solo quattro widget (Claudio: "facciamone 4 per volta"): Prezzi,
// Visualizzazione, Location, Match. Tutti gli altri ricadono su _ballCorpoGenerico,
// che mostra le righe di testo di sempre: nessuna regressione.
//
// ZERO QUERY NUOVE: tutto ciò che serve è già in memoria (carteReali,
// _elencoPrezziScaduti, _numNuoviMatch*). I preview() sono stati estesi con
// un campo 'dati' AGGIUNTIVO — le 'righe' restano identiche, così le
// tessere piccole e il semaforo continuano a funzionare come prima.

// Righe cliccabili dentro la tessera (Claudio: "lo voglio").
// Attenzione a tre cose, tutte gestite qui:
//   - stopPropagation, o il tocco farebbe partire ANCHE la cattura da 2,6s
//     e l'apertura del widget;
//   - in modalità modifica non deve fare nulla: lì si trascina e si ridimensiona;
//   - le azioni chiamano solo funzioni VERIFICATE nei file reali:
//       apriFlipCardHome(id)          → ui/home.ui.js
//       apriModalePrezziScaduti()     → ui/prices.ui.js r.212
//       filterTable() + #filterLocation → ui/cards.ui.js r.803-833
//     ognuna protetta da un typeof: se un domani sparisse, la riga smette
//     di funzionare ma non butta giù la home.
function _ballAzioneRiga(evt, tipo, valore, origine) {
    if (evt) evt.stopPropagation();
    if (_editModeWidget) return;
    _vibraSeSupportato(8);
    switch (tipo) {
        case 'carta':
            // Missioni #39/#83 (2026-08-30): origine propagata per distinguere
            // "apertura da lista top-valore" (valore_collezione) da qualunque
            // altra apertura — vedi ui/home.ui.js:apriFlipCardHome().
            if (typeof apriFlipCardHome === 'function') apriFlipCardHome(valore, origine ? { origine } : {});
            break;

        case 'tab':
            apriDettaglioWidget(valore, evt);
            break;

        // Elenco completo delle carte con prezzo da aggiornare: esiste già
        // come modale nel sito, con nomi, codici e data dell'ultimo
        // controllo. Non apriamo la sezione Prezzi: la modale dice di più
        // ed è esattamente ciò che serve dopo aver toccato quella riga.
        case 'prezzi-scaduti':
            if (typeof apriModalePrezziScaduti === 'function') apriModalePrezziScaduti();
            else apriDettaglioWidget('prezzi', evt);
            break;

        // Location: apre Visualizzazione GIÀ FILTRATA su quella posizione.
        // filterTable() legge il valore dalla tendina #filterLocation
        // (popolata da caricaCarteReali con le location realmente presenti),
        // quindi il filtro si imposta scrivendo lì e richiamandola.
        // Il filtro va applicato DOPO l'apertura: switchTab ridisegna la
        // sezione, e farlo prima verrebbe sovrascritto.
        case 'location':
            apriDettaglioWidget('visualizzazione', evt);
            setTimeout(() => {
                const select = document.getElementById('filterLocation');
                if (!select || typeof filterTable !== 'function') return;
                // Se quella location non è tra le opzioni (dato cambiato nel
                // frattempo), meglio non filtrare che filtrare a vuoto
                // lasciando una tabella misteriosamente deserta.
                const esiste = Array.from(select.options).some(o => o.value === valore);
                if (!esiste) return;
                select.value = valore;
                filterTable();
            }, 60);
            break;
    }
}

// ── MINIATURA DI UNA CARTA ───────────────────────────────────────────────
// Ricalcata su miniCarta() del mockup (cardsync.js r.516): rettangolo con
// gradiente, una barra chiara in alto al posto dell'illustrazione e una
// sottile in basso al posto del testo, angoli morbidi e ombra leggera.
//
// DIFFERENZA VOLUTA dal mockup: lì le carte erano finte, qui esistono
// davvero. Quando c'è l'immagine la mostriamo — vale più di un rettangolo
// colorato — e il disegno di Opus resta come RIPIEGO per le carte senza
// immagine, dove finora c'era un'icona grigia.
//
// Il colore del ripiego non è casuale ad ogni render: è derivato dal nome
// della carta, così la stessa carta ha sempre la sua tinta e la striscia
// non "sfarfalla" ad ogni giro di polling.
function _ballTintaDaNome(nome) {
    let h = 0;
    const t = String(nome || '');
    for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 360;
    return `hsl(${h}, 52%, 58%)`;
}

function _ballMiniCarta(c, badge, origine) {
    const titolo = String(c.nome || '').replace(/"/g, '&quot;');
    const clic = `onclick="_ballAzioneRiga(event,'carta','${c.id}','${origine || ''}')"`;
    const badgeHtml = badge ? `<b class="ball-mini-badge">${badge}</b>` : '';

    // Holo scorrevole: nel mockup segnala le carte speciali. Qui dipende dal
    // campo 'rarita', che al 27/08/2026 NON esiste nello schema (verificato
    // in sessione precedente su information_schema.columns) — quindi oggi
    // non si accende su nulla e non costa niente. Se un giorno il campo
    // arriverà, si accenderà da solo sulle carte rare.
    const speciale = c.rarita && /rara|ultra|secret|holo/i.test(String(c.rarita));
    const classi = 'ball-mini' + (speciale ? ' holo' : '');

    if (c.immagine) {
        const url = _urlImmagineVisualizzabile(c.immagine, 96) || '';
        // Se l'immagine non carica, resta visibile il ripiego disegnato che
        // sta sotto: nessun buco grigio.
        return `<span class="${classi}" style="background:linear-gradient(150deg, ${_ballTintaDaNome(c.nome)}, rgba(0,0,0,.35))" title="${titolo}" ${clic}>
                    <i></i><u></u>
                    <img src="${url}" alt="" onerror="this.remove();">
                    ${badgeHtml}
                </span>`;
    }
    return `<span class="${classi}" style="background:linear-gradient(150deg, ${_ballTintaDaNome(c.nome)}, rgba(0,0,0,.35))" title="${titolo}" ${clic}><i></i><u></u>${badgeHtml}</span>`;
}

// ── COMPONENTI VISIVI, ricalcati dal mockup ──────────────────────────────
// Tipografia e componenti vengono da cardsync.css: k-tit (titolo), k-big
// (dato principale, 25px), k-mid, k-lab (etichetta piccola), pill, barra,
// riga, sparkline, stat-griglia, pulsante azione.
//
// NOMI PREFISSATI: nel mockup si chiamano .riga, .nome, .dato, .pill,
// .stat, .azione — nomi generici che nel CSS globale del sito sono GIÀ
// usati 17 volte. Prefissati con ball- mantenendo proprietà identiche.

// Sparkline SVG, identica a sparkline() del mockup (cardsync.js r.522):
// area sfumata sotto e linea sopra, tracciato normalizzato su min/max.
function _ballSparkline(serie, colore) {
    if (!serie || serie.length < 2) return '';
    const min = Math.min(...serie), max = Math.max(...serie);
    const span = (max - min) || 1;
    const punti = serie.map((v, i) => {
        const x = (i / (serie.length - 1)) * 100;
        const y = 30 - ((v - min) / span) * 26;
        return x.toFixed(1) + ',' + y.toFixed(1);
    });
    return `<svg class="ball-spark" viewBox="0 0 100 34" preserveAspectRatio="none">
        <polygon points="0,34 ${punti.join(' ')} 100,34" fill="${colore}" opacity=".16"/>
        <polyline points="${punti.join(' ')}" fill="none" stroke="${colore}" stroke-width="2.4"
                  stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    </svg>`;
}

// Riga con barra di avanzamento (come il corpo 'set' del mockup).
function _ballRigaBarra(nome, dato, percento, azione) {
    const p = Math.max(0, Math.min(100, percento));
    const clic = azione ? ` onclick="${azione}" class="ball-riga-set ball-clic"` : ' class="ball-riga-set"';
    return `<div${clic}>
        <div class="ball-riga"><span class="ball-nome">${nome}</span><span class="ball-dato">${dato}</span></div>
        <div class="ball-barra-out"><div class="ball-barra-in" style="width:${p}%"></div></div>
    </div>`;
}

// Riga semplice nome + valore/i.
function _ballRiga(nome, ...dati) {
    return `<div class="ball-riga">
        <span class="ball-nome">${nome}</span>
        ${dati.map(d => `<span class="ball-dato">${d}</span>`).join('')}
    </div>`;
}

// Corpo dei widget non ancora collegati (gacha): niente numeri finti, solo
// una riga che dice cosa arriverà. Ricalcato sullo stato "vuoto" del
// mockup, che trattava il primo giorno come un momento importante invece
// che come un errore.
function _ballCorpoSegnaposto(titolo, d) {
    return {
        inline:
            `<p class="ball-k-tit">${titolo}</p>` +
            '<div class="ball-k-mid ball-attesa">In arrivo</div>' +
            `<span class="ball-k-lab">${(d && d.testo) || ''}</span>`,
        blocco: ''
    };
}

function _ballPill(testo, acceso) {
    return `<span class="ball-pill${acceso ? ' acceso' : ''}">${testo}</span>`;
}

function _ballPulsante(testo, azione) {
    return `<button type="button" class="ball-azione" onclick="${azione}">${testo}</button>`;
}

// ── I QUATTRO CORPI ──────────────────────────────────────────────────────
// ── CORPI DEI TRE WIDGET NATI DALLA HOME FISSA (2026-09-03) ─────────────
// Claudio, vedendo la prima versione: "non assomigliano per niente a cio'
// che ho in home e quindi non mi servono a sostituirla". Aveva ragione: i
// widget non definivano un corpo, quindi _ballCorpoWidget ripiegava su
// _ballCorpoGenerico (tre righe di testo accanto alla sfera). Qui i corpi
// ricostruiscono davvero i blocchi della home fissa, con gli stessi
// mattoni gia' usati dagli altri widget: _ballMiniCarta per le miniature,
// .ball-strip per le file di carte, .ball-riga per gli elenchi.
//
// COME SI COMPORTANO ALLE VARIE TAGLIE: 'inline' sta accanto alla sfera e
// si vede sempre; 'blocco' sta sotto e il CSS ne mostra sempre meno man
// mano che la tessera si abbassa (vedi .wf-largo .ball-slot-blocco). Quindi
// le tre categorie complete si vedono sulle taglie alte, mentre su una
// tessera bassa resta la prima. Nessun controllo di taglia da scrivere qui.
function _ballFilaCarte(titolo, carte, origine) {
    if (!carte || !carte.length) return '';
    // Titolo e fila avvolti insieme: dentro .ball-gruppi ogni figlio e'
    // una colonna, quindi senza questo involucro il titolo finirebbe in
    // una colonna e le sue carte in quella accanto.
    return '<div class="ball-gruppo">' +
        `<span class="ball-k-lab">${titolo}</span>` +
        '<div class="ball-strip">' + carte.map(c => _ballMiniCarta(c, undefined, origine)).join('') + '</div>' +
        '</div>';
}

function _ballElencoRighe(voci) {
    if (!voci || !voci.length) return '';
    return voci.map(v => `
        <div class="ball-riga ball-clic" onclick="_ballAzioneRiga(event,'carta','${String(v.id).replace(/'/g, "\\'")}','${v.origine || ''}')">
            <span class="ball-nome">${v.nome}</span><span class="ball-dato">${v.dato}</span>
        </div>`).join('');
}

const _ballCORPI = {
    // La frase che Claudio voleva leggere: "valore salito di 45 euro,
    // aggiunte tre carte ieri dal valore complessivo di 43 euro". La
    // scomposizione arriva gia' pronta da storicoValoreConfronta().
    variazione_valore: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const eur = (v) => '€ ' + Math.abs(Number(v) || 0).toFixed(2);
        const segno = (v) => (Number(v) >= 0 ? '+' : '−');

        if (d.soloUnGiorno) {
            return {
                inline: `<div class="ball-k-big ball-k-mono">${eur(d.valore)}</div>` +
                        '<span class="ball-k-lab">primo giorno misurato</span>',
                blocco: '<span class="ball-k-lab ball-attesa">La variazione compare domani, quando ci sara' + "'" + ' un secondo giorno da confrontare.</span>',
            };
        }

        const colore = d.variazione >= 0 ? 'var(--success)' : 'var(--danger)';
        const inline =
            `<div class="ball-k-big ball-k-mono" style="color:${colore}">${segno(d.variazione)}${eur(d.variazione)}</div>` +
            `<span class="ball-k-lab">${eur(d.valoreOggi)} in totale</span>`;

        // Le due voci della scomposizione. Compaiono solo se hanno
        // qualcosa da dire: una riga "acquisti: 0,00" e' rumore.
        const voci = [];
        if (d.carteAggiunte > 0) {
            voci.push(`<div class="ball-riga">
                <span class="ball-nome">${d.carteAggiunte} cart${d.carteAggiunte === 1 ? 'a aggiunta' : 'e aggiunte'}</span>
                <span class="ball-dato">${segno(d.daAggiunte)}${eur(d.daAggiunte)}</span>
            </div>`);
        }
        if (d.rimozioniSospette) {
            // Limite noto, spiegato nella migration 36: una carta uscita
            // dalla collezione non lascia traccia, quindi finirebbe nel
            // residuo e verrebbe letta come "i prezzi sono scesi". Quando
            // i pezzi calano si dice cosa e' successo invece di attribuire
            // il calo ai prezzi.
            voci.push(`<div class="ball-riga">
                <span class="ball-nome">${d.pezziInMeno} pezz${d.pezziInMeno === 1 ? 'o uscito' : 'i usciti'} dalla collezione</span>
                <span class="ball-dato">—</span>
            </div>`);
            voci.push('<span class="ball-k-lab ball-attesa">Con dei pezzi in uscita non si puo' + "'" + ' distinguere quanto sia movimento dei prezzi.</span>');
        } else if (d.daPrezzi != null && Math.abs(d.daPrezzi) >= 0.01) {
            voci.push(`<div class="ball-riga">
                <span class="ball-nome">movimento dei prezzi</span>
                <span class="ball-dato">${segno(d.daPrezzi)}${eur(d.daPrezzi)}</span>
            </div>`);
        }

        const grafico = (d.serie && d.serie.length > 1) ? _ballSparkline(d.serie, colore) : '';
        const nota = `<span class="ball-k-lab">${d.giorniMisurati} giorn${d.giorniMisurati === 1 ? 'o' : 'i'} misurat${d.giorniMisurati === 1 ? 'o' : 'i'}</span>`;

        return { inline, blocco: grafico + voci.join('') + nota };
    },

    // Disposizione scelta da Claudio: due numeri affiancati in alto, barra
    // della quota in basso. La barra usa .ball-barra-out/.ball-barra-in,
    // gli stessi mattoni del corpo 'prezzi' — niente CSS nuovo.
    contributi: (d) => {
        // La RPC non ha risposto. Non si scrive "0": sarebbe
        // un'affermazione falsa sul lavoro del gruppo.
        if (!d) {
            return {
                inline: '<div class="ball-k-mid">\u2014</div><span class="ball-k-lab">dati non disponibili</span>',
                blocco: '',
            };
        }

        // I due numeri hanno lo stesso peso visivo ma NON la stessa scala:
        // 'miei' cresce senza tetto, 'personeAiutate' ha come massimo 4
        // (cinque membri, te esclusa) e una volta arrivato li' resta fermo
        // per sempre. Non e' un difetto: e' il dato vero, ed e' l'aspetto
        // che il widget avra' fra qualche settimana.
        const inline =
            '<div class="ball-k-duo">' +
                `<div><div class="ball-k-big ball-k-mono">${d.miei}</div><span class="ball-k-lab">carte</span></div>` +
                `<div><div class="ball-k-big ball-k-mono">${d.personeAiutate}</div><span class="ball-k-lab">person${d.personeAiutate === 1 ? 'a' : 'e'}</span></div>` +
            '</div>';

        // GUARDIA SUL DENOMINATORE. Al primo giorno sono tre zeri
        // legittimi: niente divisione, e nessun "0% del lavoro del gruppo",
        // che e' vero ma si legge come un rimprovero quando il gruppo non
        // ha ancora fatto niente.
        if (!d.gruppo) {
            return {
                inline,
                // .ball-quota: contenitore che rende la coppia
                // barra+didascalia un blocco ATOMICO per
                // _potaContenutoFuoriTessera(). Senza, in una tessera
                // stretta la didascalia veniva tagliata a meta' dal bordo:
                // la potatura conosce solo .ball-riga/.ball-gruppo/
                // .ball-spark/.ball-strip e ignorava questi due elementi.
                blocco: '<div class="ball-quota">' +
                        '<div class="ball-barra-out"><div class="ball-barra-in" style="width:0%"></div></div>' +
                        '<span class="ball-k-lab ball-attesa">Primi contributi in arrivo.</span>' +
                        '</div>',
            };
        }

        // Intero, non decimale: con numeri piccoli (1 su 3) i decimali
        // darebbero una precisione che il dato non ha.
        // 'gruppo' conta TUTTE le righe, comprese le proprie, quindi la
        // quota non puo' superare il 100%.
        const perc = Math.round((d.miei / d.gruppo) * 100);
        // Stesso contenitore atomico del ramo qui sopra: o la quota si
        // vede tutta, o sparisce tutta. Mezza didascalia e' peggio di
        // nessuna didascalia.
        const blocco =
            '<div class="ball-quota">' +
            `<div class="ball-barra-out"><div class="ball-barra-in" style="width:${perc}%"></div></div>` +
            `<span class="ball-k-lab">${perc}% del lavoro del gruppo</span>` +
            '</div>';

        return { inline, blocco };
    },

    // Le tre categorie della home fissa: valore piu' alto, oscillazione in
    // su, oscillazione in giu'. Stesse tre carte per categoria.
    primo_piano: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const top = (d.perValore && d.perValore[0]) || null;
        const eur = (v) => '€ ' + Number(v || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        // NIENTE ball-k-tit qui: renderWidgetHome stampa gia' il titolo del
        // widget accanto alla sfera, quindi si leggeva due volte ("In primo
        // piano" e subito sotto "In vetrina"). Difetto visto in uno
        // screenshot di Claudio il 2026-09-03.
        const inline = top
            ? `<div class="ball-k-big ball-k-mono">${eur(top.prezzo)}</div><span class="ball-k-lab">${top.nome}</span>`
            : '<div class="ball-k-mid">—</div><span class="ball-k-lab">nessuna carta ancora</span>';
        // Le tre categorie AFFIANCATE quando c'e' larghezza, impilate
        // quando non ce n'e' (Claudio: "dovrebbe estendersi in orizzontale
        // come nella home"). Il contenitore usa auto-fit nel CSS, quindi
        // non serve sapere qui quanto e' largo il widget: si dispone da
        // solo e si comporta bene sia a 3 colonne di griglia sia a tutta
        // riga in orizzontale.
        const blocco = '<div class="ball-gruppi">' +
            _ballFilaCarte('Valore più alto', d.perValore, 'top_valore') +
            _ballFilaCarte('Oscillazione +', d.su, 'oscillazione_su') +
            _ballFilaCarte('Oscillazione −', d.giu, 'oscillazione_giu') +
            '</div>';
        return { inline, blocco };
    },

    // Elenco delle ultime aggiunte, nome + data, come il pannello
    // "Attività recenti" della home fissa.
    carte_recenti: (d) => {
        if (!d || !d.lista || !d.lista.length) {
            return { inline: '<div class="ball-k-mid">—</div><span class="ball-k-lab">nessuna carta ancora</span>', blocco: '' };
        }
        const inline =
            `<div class="ball-k-mid">${d.lista[0].nome}</div>` +
            `<span class="ball-k-lab">aggiunta il ${d.lista[0].quando}</span>`;
        const blocco =
            '<div class="ball-strip">' + d.lista.map(c => _ballMiniCarta(c, undefined, 'ultime_aggiunte')).join('') + '</div>' +
            _ballElencoRighe(d.lista.map(c => ({ id: c.id, nome: c.nome, dato: c.quando, origine: 'ultime_aggiunte' })));
        return { inline, blocco };
    },

    // Stesso elenco per i controlli prezzo recenti. La variante e' mostrata
    // accanto al nome come fa la home fissa.
    prezzi_recenti: (d) => {
        if (!d || !d.lista || !d.lista.length) {
            return { inline: '<div class="ball-k-mid">—</div><span class="ball-k-lab">nessun controllo ancora</span>', blocco: '' };
        }
        const inline =
            `<div class="ball-k-mid">${d.lista[0].nome}</div>` +
            `<span class="ball-k-lab">controllata il ${d.lista[0].quando}</span>`;
        const blocco = _ballElencoRighe(d.lista.map(c => ({
            id: c.id,
            nome: c.nome + (c.variante ? ` <span class="ball-k-lab">${c.variante}</span>` : ''),
            dato: c.quando,
            origine: 'prezzi_recenti',
        })));
        return { inline, blocco };
    },

    set_completamento: (d) => {
        if (!d) return { inline: '', blocco: '' };
        if (!d.voci || !d.voci.length) {
            return {
                inline: '<p class="ball-k-tit">Set</p><div class="ball-k-mid">—</div>' +
                        `<span class="ball-k-lab">${d.riconosciute ? 'nessuna espansione' : 'codici non riconosciuti'}</span>`,
                blocco: ''
            };
        }
        const prima = d.voci[0];

        // Con il set in libreria si mostra l'avanzamento; senza, si mostra
        // quante carte hai — mai una percentuale su un totale ignoto.
        const inline =
            '<p class="ball-k-tit">Set</p>' +
            ((prima.totale && prima.perc != null)
                ? `<div class="ball-k-big ball-k-mono">${Math.round(prima.perc)}%</div>` +
                  `<span class="ball-k-lab">${prima.nome} · ${prima.totale - prima.hai} alla fine</span>`
                : `<div class="ball-k-big ball-k-mono">${d.voci.length}</div>` +
                  `<span class="ball-k-lab">espansioni · ${prima.nome} in testa</span>`);

        const blocco = d.voci.slice(0, 4).map(v => (v.totale && v.perc != null)
            ? _ballRigaBarra(v.nome, `${v.hai}/${v.totale}`, v.perc, `_ballAzioneRiga(event,'tab','visualizzazione')`)
            : `<div class="ball-riga ball-clic" onclick="_ballAzioneRiga(event,'tab','visualizzazione')">
                   <span class="ball-nome">${v.nome}</span><span class="ball-dato">${v.hai} carte</span>
               </div>`
        ).join('') +
        // Se nessun set è in libreria è giusto dirlo, invece di lasciare
        // pensare che l'avanzamento non esista.
        (d.inLibreria === 0 ? '<span class="ball-k-lab ball-attesa">Avanzamento non disponibile: libreria set da compilare</span>' : '');

        return { inline, blocco };
    },

    // ── SEGNAPOSTO GACHA ─────────────────────────────────────────────────
    // Stessa forma dello "stato vuoto" del mockup: dice cosa arriverà,
    // senza numeri finti e senza pulsanti che non portano da nessuna parte.
    bustina: (d) => _ballCorpoSegnaposto('Bustina', d),
    polvere: (d) => _ballCorpoSegnaposto('Polvere', d),
    missioni: (d) => _ballCorpoSegnaposto('Missioni', d),

    // ── I CINQUE WIDGET NUOVI ────────────────────────────────────────────
    valore_collezione: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const eur = (v) => '€ ' + Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 });
        const inline =
            '<p class="ball-k-tit">Valore</p>' +
            `<div class="ball-k-big ball-k-mono">${eur(d.valore)}</div>` +
            `<span class="ball-k-lab">${d.pezzi} pezzi · media ${eur(d.media)}</span>`;
        let blocco = '';
        if (d.top && d.top.length) {
            // Missioni #39/#83: origine 'top_valore', SOLO qui — non nel
            // blocco 'lista' di doppioni sotto né in quello di
            // 'visualizzazione' più in basso, che riusano la stessa
            // _ballMiniCarta ma non sono "le carte di maggior valore".
            blocco = '<div class="ball-strip">' + d.top.map(c => _ballMiniCarta(c, undefined, 'top_valore')).join('') + '</div>' +
                '<span class="ball-k-lab">Le più preziose</span>';
        }
        return { inline, blocco };
    },

    doppioni: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const inline =
            '<p class="ball-k-tit">Doppioni</p>' +
            `<div class="ball-k-big ball-k-mono">${d.copieExtra || 0}</div>` +
            `<span class="ball-k-lab">copie in più su ${d.titoli || 0} carte</span>` +
            (d.valoreExtra > 0 ? `<span class="ball-k-lab su">€ ${Math.round(d.valoreExtra).toLocaleString('it-IT')} scambiabili</span>` : '');
        let blocco = '';
        if (d.lista && d.lista.length) {
            blocco = '<div class="ball-strip">' + d.lista.map(c => _ballMiniCarta(c, '×' + c.qty)).join('') + '</div>' +
                '<span class="ball-k-lab">Le carte doppie</span>';
        }
        return { inline, blocco };
    },

    wishlist_obiettivi: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const inline =
            '<p class="ball-k-tit">Wishlist</p>' +
            `<div class="ball-k-big ball-k-mono${d.raggiunte > 0 ? ' su' : ''}">${d.raggiunte > 0 ? d.raggiunte : (d.totale || 0)}</div>` +
            `<span class="ball-k-lab">${d.raggiunte > 0 ? 'sotto il prezzo obiettivo' : 'carte desiderate'}</span>` +
            (d.raggiunte > 0 ? _ballPill('da comprare', true) : '');
        let blocco = '';
        if (d.lista && d.lista.length) {
            // Barra: quanto è vicino il prezzo attuale all'obiettivo. Piena
            // quando il prezzo è sceso fino al bersaglio.
            blocco = d.lista.map(c => {
                const perc = c.prezzo > 0 ? Math.min(100, (c.obiettivo / c.prezzo) * 100) : 0;
                return _ballRigaBarra(c.nome, `€ ${c.prezzo.toFixed(0)} / ${c.obiettivo.toFixed(0)}`, perc,
                    `_ballAzioneRiga(event,'carta','${c.id}')`);
            }).join('');
        }
        return { inline, blocco };
    },

    traguardi: (d) => {
        if (!d || !d.carte) return { inline: '', blocco: '' };
        const manca = d.carte.soglia - d.carte.valore;
        const inline =
            '<p class="ball-k-tit">Traguardi</p>' +
            `<div class="ball-k-big ball-k-mono">${manca > 0 ? manca : 0}</div>` +
            `<span class="ball-k-lab">carte al traguardo di ${d.carte.soglia}</span>`;
        const blocco =
            _ballRigaBarra('Carte', `${d.carte.valore}/${d.carte.soglia}`, d.carte.perc) +
            _ballRigaBarra('Valore', `€ ${d.euro.valore.toLocaleString('it-IT')}/${d.euro.soglia.toLocaleString('it-IT')}`, d.euro.perc) +
            _ballRigaBarra('Location', `${d.luoghi.valore}/${d.luoghi.soglia}`, d.luoghi.perc);
        return { inline, blocco };
    },

    lingue: (d) => {
        if (!d || !d.voci || !d.voci.length) return { inline: '', blocco: '' };
        const prima = d.voci[0];
        const quota = d.totale ? Math.round((prima[1] / d.totale) * 100) : 0;
        const inline =
            '<p class="ball-k-tit">Lingue</p>' +
            `<div class="ball-k-big ball-k-mono">${prima[0]}</div>` +
            `<span class="ball-k-lab">${quota}% della collezione</span>`;
        const blocco = '<div class="ball-stat-griglia">' + d.voci.slice(0, 3).map(([lang, n]) =>
            `<div class="ball-stat"><b>${n}</b><span>${lang}</span></div>`).join('') + '</div>';
        return { inline, blocco };
    },

    // ── CORPI PER I WIDGET GIÀ ESISTENTI ─────────────────────────────────
    inserimento: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const n = d.daCorreggere || 0;
        const inline =
            '<p class="ball-k-tit">Inserimento</p>' +
            `<div class="ball-k-big ball-k-mono${n > 0 ? ' giu' : ' su'}">${n}</div>` +
            `<span class="ball-k-lab">${n > 0 ? 'in coda da correggere' : 'coda pulita'}</span>`;
        const blocco = n > 0
            ? _ballPulsante('Vai alla coda', `_ballAzioneRiga(event,'tab','inserimento')`)
            : _ballPulsante('Aggiungi carta', `_ballAzioneRiga(event,'tab','inserimento')`);
        return { inline, blocco };
    },

    binder: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const inline =
            '<p class="ball-k-tit">Binders</p>' +
            `<div class="ball-k-big ball-k-mono">${d.totale || 0}</div>` +
            '<span class="ball-k-lab">raccoglitori</span>';
        let blocco = '';
        if (d.voci && d.voci.length) {
            const massimo = d.voci[0][1] || 1;
            blocco = d.voci.slice(0, 3).map(([nome, n]) =>
                _ballRigaBarra(nome, n, (n / massimo) * 100,
                    `_ballAzioneRiga(event,'location','${String(nome).replace(/'/g, "\\'")}')`)).join('');
        }
        return { inline, blocco };
    },

    sealed: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const eur = (v) => '€ ' + Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 });
        const inline =
            '<p class="ball-k-tit">Sealed</p>' +
            `<div class="ball-k-big ball-k-mono">${d.totale || 0}</div>` +
            `<span class="ball-k-lab">prodotti${d.valore ? ' · ' + eur(d.valore) : ''}</span>`;
        let blocco = '';
        if (d.lista && d.lista.length) {
            blocco = '<div class="ball-riga-set">' + d.lista.map(p =>
                `<div class="ball-riga"><span class="ball-nome">${p.nome}</span><span class="ball-dato">${eur(p.prezzo)}</span></div>`
            ).join('') + '</div>';
        }
        return { inline, blocco };
    },

    gruppo_attivo: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const inline =
            '<p class="ball-k-tit">Gruppo</p>' +
            `<div class="ball-k-mid">${d.attivo ? 'Al lavoro' : 'In pausa'}</div>` +
            '<span class="ball-k-lab">stato del gruppo adesso</span>' +
            _ballPill(d.attivo ? 'qualcuno online' : 'nessuno online', !!d.attivo);
        return { inline, blocco: '' };
    },

    suggerimento: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const inline =
            '<p class="ball-k-tit">Prossima azione</p>' +
            `<div class="ball-k-mid">${d.testo || ''}</div>` +
            '<span class="ball-k-lab">la cosa più utile ora</span>';
        const blocco = d.tab && d.tab !== 'home'
            ? _ballPulsante('Fallo adesso', `_ballAzioneRiga(event,'tab','${d.tab}')`)
            : '';
        return { inline, blocco };
    },

    estensione: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const inline =
            '<p class="ball-k-tit">Estensione</p>' +
            `<div class="ball-k-mid">${d.rilevata ? 'v' + d.versione : 'Non rilevata'}</div>` +
            `<span class="ball-k-lab">${d.rilevata ? 'collegata a questo dispositivo' : 'installala per sincronizzare'}</span>` +
            (d.rilevata ? _ballPill(d.aiutaGruppo ? 'aiuta il gruppo' : 'aiuto disattivo', !!d.aiutaGruppo) : '');
        return { inline, blocco: '' };
    },

    // Prezzi: quanti chiedono attenzione, quanto vale la collezione, la
    // quota di aggiornati come barra e le carte scadute come righe.
    prezzi: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const scaduti = d.scaduti || 0;
        const totale = d.totale || 0;
        const aggiornati = Math.max(0, totale - scaduti);
        const perc = totale > 0 ? (aggiornati / totale) * 100 : 100;

        const inline =
            '<p class="ball-k-tit">Prezzi</p>' +
            `<div class="ball-k-big ball-k-mono${scaduti > 0 ? ' giu' : ' su'}">${scaduti > 0 ? scaduti : totale}</div>` +
            `<span class="ball-k-lab">${scaduti > 0 ? 'da aggiornare' : 'tutti aggiornati'}</span>` +
            (d.valore ? `<span class="ball-k-lab">€ ${d.valore.toLocaleString('it-IT', { maximumFractionDigits: 0 })} in collezione</span>` : '');

        // .ball-quota (2026-09-06): didascalia e barra sono un blocco
        // ATOMICO per _potaContenutoFuoriTessera(). Prima erano due figli
        // diretti sciolti, che la potatura non conosce: in tessera stretta
        // la riga "Aggiornati N/M" veniva tagliata a meta' dal bordo.
        // Difetto preesistente, stesso identico caso gia' corretto sul
        // widget 'contributi'.
        let blocco =
            '<div class="ball-quota">' +
            '<div class="ball-barra-testo"><span>Aggiornati</span><span>' + aggiornati + '/' + totale + '</span></div>' +
            `<div class="ball-barra-out"><div class="ball-barra-in" style="width:${perc.toFixed(1)}%"></div></div>` +
            '</div>';

        if (d.lista && d.lista.length) {
            blocco += '<div class="ball-riga-set">' + d.lista.slice(0, 3).map(v =>
                `<div class="ball-riga ball-clic" onclick="_ballAzioneRiga(event,'prezzi-scaduti')">
                    <span class="ball-nome">${v.nome}</span><span class="ball-dato">${v.quando}</span>
                 </div>`).join('') + '</div>';
            blocco += _ballPulsante('Vedi tutte', `_ballAzioneRiga(event,'prezzi-scaduti')`);
        }
        return { inline, blocco };
    },

    // Visualizzazione: il totale, l'andamento vero degli inserimenti degli
    // ultimi 14 giorni come sparkline, e le ultime carte entrate.
    visualizzazione: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const inline =
            '<p class="ball-k-tit">Collezione</p>' +
            `<div class="ball-k-big ball-k-mono">${(d.totale || 0).toLocaleString('it-IT')}</div>` +
            '<span class="ball-k-lab">carte in collezione</span>' +
            (d.aggiunteRecenti ? `<span class="ball-k-lab su">+${d.aggiunteRecenti} negli ultimi 14 giorni</span>` : '');

        let blocco = '';
        if (d.serie && d.serie.length > 1) blocco += _ballSparkline(d.serie, 'var(--accent)');
        if (d.ultime && d.ultime.length) {
            blocco += '<div class="ball-strip">' + d.ultime.map(c => _ballMiniCarta(c)).join('') + '</div>' +
                      '<span class="ball-k-lab">Ultime aggiunte</span>';
        }
        return { inline, blocco };
    },

    // Location: quante posizioni, e una barra per ciascuna delle più piene,
    // in scala sulla maggiore. Ogni riga apre la collezione già filtrata.
    location: (d) => {
        if (!d || !d.voci || !d.voci.length) return { inline: '', blocco: '' };
        const massimo = d.voci[0][1] || 1;
        const prima = d.voci[0];
        const inline =
            '<p class="ball-k-tit">Location</p>' +
            `<div class="ball-k-big ball-k-mono">${d.voci.length}</div>` +
            `<span class="ball-k-lab">${d.voci.length === 1 ? 'posizione' : 'posizioni'} · più piena ${prima[0]}</span>`;

        const blocco = d.voci.slice(0, 4).map(([nome, n]) =>
            _ballRigaBarra(nome, n, (n / massimo) * 100,
                `_ballAzioneRiga(event,'location','${String(nome).replace(/'/g, "\\'")}')`)
        ).join('');
        return { inline, blocco };
    },

    // Match: il totale, e i due tipi come riquadri di statistica separati —
    // scambio e wishlist sono due cose diverse.
    match: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const scambio = d.scambio || 0, wishlist = d.wishlist || 0;
        const totale = scambio + wishlist;
        const inline =
            '<p class="ball-k-tit">Match trovati</p>' +
            `<div class="ball-k-big ball-k-mono${totale > 0 ? ' su' : ''}">${totale}</div>` +
            `<span class="ball-k-lab">${totale === 0 ? 'nessuna novità' : (totale === 1 ? 'corrispondenza' : 'corrispondenze')}</span>` +
            (totale > 0 ? _ballPill('da vedere', true) : '');

        const blocco =
            '<div class="ball-stat-griglia">' +
                `<div class="ball-stat ball-clic" onclick="_ballAzioneRiga(event,'tab','binder')"><b>${scambio}</b><span>Scambio</span></div>` +
                `<div class="ball-stat ball-clic" onclick="_ballAzioneRiga(event,'tab','binder')"><b>${wishlist}</b><span>Wishlist</span></div>` +
            '</div>' +
            (totale > 0 ? _ballPulsante('Apri Binders', `_ballAzioneRiga(event,'tab','binder')`) : '');
        return { inline, blocco };
    }
};

// Ripiego per gli undici widget non ancora convertiti: le righe di testo di
// sempre, così nessuno perde niente mentre procediamo quattro alla volta.
function _ballCorpoGenerico(anteprima) {
    return {
        inline: `<div class="ball-righe-testo">${(anteprima.righe || []).map(r => `<span>${r}</span>`).join('')}</div>`,
        blocco: ''
    };
}

function _ballCorpoWidget(id, anteprima) {
    const f = _ballCORPI[id];
    if (!f || !anteprima || !anteprima.dati) return _ballCorpoGenerico(anteprima);
    try {
        const c = f(anteprima.dati);
        // Un corpo vuoto (dati insufficienti) non deve lasciare la tessera
        // muta: si torna al testo.
        if (!c || (!c.inline && !c.blocco)) return _ballCorpoGenerico(anteprima);
        return c;
    } catch (e) {
        console.error('Corpo widget ' + id + ':', e);
        return _ballCorpoGenerico(anteprima);
    }
}

// [SEZIONE SPOSTATA in ui/paginainiziale.ui.js — STEP 0 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

// ── RICERCA CARTE — per scegliere la carta di una Vetrina ────────────────
// Stessa identica logica di ricerca già in filterTable() (cards.ui.js):
// nome o codice, minuscolo, includes — non esiste un modale di selezione
// carta riutilizzabile nel sito (verificato leggendo cards.ui.js e
// home.ui.js per intero), quindi questo è un contenitore nuovo ma la
// LOGICA di ricerca è la stessa a cui sei abituato, non inventata.
//
// Ambito: TUTTA carteReali (collezione + wishlist), non solo la
// collezione — "una carta da tenere d'occhio" può ragionevolmente essere
// anche una che non possiedi ancora. Dimmi se preferisci restringerlo
// alla sola collezione.
let _vetrinaRicercaInstanceId = null;

function _apriRicercaCartaVetrina(instanceId) {
    _vetrinaRicercaInstanceId = instanceId;
    const input = document.getElementById('vetrinaRicercaInput');
    if (input) input.value = '';
    _renderRicercaCartaVetrina('');
    document.getElementById('vetrinaRicercaModal').style.display = 'flex';
    if (input) setTimeout(() => input.focus(), 50);
}

function _chiudiRicercaCartaVetrina() {
    document.getElementById('vetrinaRicercaModal').style.display = 'none';
    _vetrinaRicercaInstanceId = null;
}

function _filtraRicercaCartaVetrina(valore) {
    _renderRicercaCartaVetrina(valore);
}

function _renderRicercaCartaVetrina(valore) {
    const container = document.getElementById('vetrinaRicercaLista');
    if (!container) return;
    const cerca = String(valore || '').toLowerCase().trim();

    // Come filterTable(): senza testo digitato, nessun risultato — evita
    // di rendere subito una lista con centinaia di righe non richiesta.
    if (!cerca) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Scrivi per cercare per nome o codice.</p>';
        return;
    }

    const risultati = carteReali
        .filter(c => (c.name || '').toLowerCase().includes(cerca) || (c.code || '').toLowerCase().includes(cerca))
        .slice(0, 30); // stessa cautela di _apriPickerAggiungiWidget: lista corta, mai una scrollata infinita

    if (risultati.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Nessuna carta trovata.</p>';
        return;
    }

    container.innerHTML = risultati.map(c => {
        const idAttr = String(c.id).replace(/'/g, "\\'");
        const nomeAttr = (c.name || '').replace(/"/g, '&quot;');
        const url = c.immagine ? (_urlImmagineVisualizzabile(c.immagine, 64) || '') : '';
        const thumb = url
            ? `<img src="${url}" alt="" style="width:32px; height:44px; object-fit:cover; border-radius:4px; flex-shrink:0;" onerror="this.style.display='none';">`
            : `<i class="fa-solid fa-image" style="width:32px; text-align:center; color:var(--text-muted); flex-shrink:0;"></i>`;
        return `
            <div class="widget-picker-riga" onclick="_selezionaCartaVetrina('${idAttr}')" title="${nomeAttr}">
                ${thumb}
                <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${c.name || ''}
                    <span style="color:var(--text-muted); font-weight:400; font-size:0.78rem;">${c.code ? ' · ' + c.code : ''}</span>
                </span>
            </div>`;
    }).join('');
}

function _selezionaCartaVetrina(cardId) {
    if (!_vetrinaRicercaInstanceId) return;
    const w = _layoutWidget.find(x => x.instanceId === _vetrinaRicercaInstanceId);
    if (w) w.cartaId = cardId;
    _salvaLayoutWidget();
    _chiudiRicercaCartaVetrina();
    renderWidgetHome();
}

// [SEZIONE SPOSTATA in ui/paginainiziale.ui.js — STEP 0 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

// [SEZIONE SPOSTATA in ui/paginainiziale.ui.js — STEP 0 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

// ── PAGINA "DA FARE" ──────────────────────────────────────────────────
// Nessuna logica propria sui segnali: riusa CATALOGO_WIDGET.suggerimento
// .preview(), la stessa fonte già mostrata (in parte) dal tile "Prossima
// azione" — zero duplicazione, un solo posto dove i 4 segnali sono
// calcolati (Claudio, 2026-08-28: "da fare e prossima azione saranno la
// stessa cosa").
//
// APERTO: la persistenza "resta barrata 24 ore dopo la risoluzione"
// (Claudio, risposta 10) non è ancora implementata — richiede
// data/preferences.repository.js (mai letto in questa sessione) per
// salvare per-dispositivo quando un segnale si è risolto. Oggi la lista
// mostra solo i segnali ATTIVI in questo momento; quelli appena risolti
// spariscono subito invece di restare barrati.
async function renderPaginaDaFare() {
    const container = document.getElementById('daFareLista');
    if (!container) return;
    container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Caricamento…</p>';

    let anteprima;
    try { anteprima = await CATALOGO_WIDGET.suggerimento.preview(); } catch (e) { console.error('renderPaginaDaFare:', e); anteprima = { dati: { segnali: [] } }; }
    const segnali = (anteprima.dati && anteprima.dati.segnali) || [];

    // Storico: segnali risolti negli ultimi FINESTRA_STORICO_DAFARE_MS,
    // persistente per-utente (migration 31) — non compaiono più tra gli
    // attivi ma restano visibili barrati per un po' (Claudio, confermato).
    let risolti = [];
    try {
        const userId = await authGetUserId();
        if (userId) {
            const { data, error } = await userSettingsGet(userId);
            if (!error && data && data.dafare_risolti) {
                const storico = JSON.parse(data.dafare_risolti) || {};
                const ora = Date.now();
                const idAttivi = new Set(segnali.map(s => s.id));
                risolti = Object.entries(storico)
                    .filter(([id, v]) => !idAttivi.has(id) && (ora - new Date(v.risoltoIl).getTime()) < FINESTRA_STORICO_DAFARE_MS)
                    .map(([, v]) => v.testo);
            }
        }
    } catch (e) { console.error('renderPaginaDaFare: storico:', e); }

    if (segnali.length === 0 && risolti.length === 0) {
        container.innerHTML = `
            <p style="text-align:center; color:var(--text-muted); font-size:0.9rem; padding:2rem 0;">
                <i class="fa-solid fa-circle-check" style="font-size:1.6rem; display:block; margin-bottom:0.6rem; color:var(--success);"></i>
                Niente da fare — tutto in ordine.
            </p>`;
        return;
    }

    // Ordine = priorità: preview() li restituisce già in quest'ordine
    // (coda errori → prezzi scaduti → wishlist sotto obiettivo → gruppo
    // al lavoro), nessun riordino aggiuntivo qui (Claudio, risposta 12:
    // "solo per priorità"). I risolti vanno sempre in coda, dopo gli attivi.
    const righeAttive = segnali.map(s => {
        const alta = s.stato === 'allerta';
        return `
            <div class="widget-picker-riga" onclick="_apriVoceDaFare('${s.tab}', event)" style="align-items:flex-start;">
                <i class="fa-regular fa-square" style="color:${alta ? 'var(--danger)' : 'var(--text-muted)'}; margin-top:0.15rem;"></i>
                <span style="flex:1;">
                    ${s.testo}
                    ${alta ? '<span class="badge" style="background-color:var(--danger); color:#fff; margin-left:0.4rem; font-size:0.65rem; vertical-align:middle;">priorità alta</span>' : ''}
                </span>
            </div>`;
    }).join('');

    const righeRisolte = risolti.map(testo => `
        <div class="widget-picker-riga" style="align-items:flex-start; opacity:0.55;">
            <i class="fa-solid fa-square-check" style="color:var(--success); margin-top:0.15rem;"></i>
            <span style="flex:1; text-decoration:line-through;">${testo}</span>
        </div>`).join('');

    container.innerHTML = righeAttive + righeRisolte;
}

// Riusa apriDettaglioWidget per tutte le destinazioni tranne 'home' (già
// collaudato, incluso il caricamento dati di Binders quando serve) — la
// pagina "Da fare" stessa resta aperta nello stesso container, cambia
// solo la view-section mostrata dentro.
function _apriVoceDaFare(tab, evt) {
    if (tab === 'home') {
        chiudiDettaglioWidget();
        setTimeout(_vaiAllaPaginaHome, DURATA_ANIMAZIONE_DETTAGLIO_MS);
        return;
    }
    apriDettaglioWidget(tab, evt);
}

// ── PAGINA "MISSIONI" (missioni giornaliere/settimanali/mensili/una_tantum
// + traguardi permanenti, unificati — Claudio 2026-08-29) ────────────────
// Chiama MOTORE_MISSIONI.valutaEAssegna() (ui/missioni.ui.js), che raccoglie
// i dati via data/missioni.repository.js, valuta il catalogo Fase 1 e
// assegna automaticamente le ricompense delle voci appena soddisfatte
// (Claudio: "automatico, si sblocca da solo" — nessun bottone Riscuoti).
async function renderPaginaMissioni() {
    const containerMissioni = document.getElementById('missioniListaOggi');
    const containerTraguardi = document.getElementById('missioniListaTraguardi');
    if (!containerMissioni || !containerTraguardi) return;
    containerMissioni.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Caricamento…</p>';
    containerTraguardi.innerHTML = '';

    const userId = await authGetUserId();
    if (!userId) {
        containerMissioni.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Accedi per vedere le tue missioni.</p>';
        return;
    }

    let risultato;
    try {
        risultato = await MOTORE_MISSIONI.valutaEAssegna(userId);
    } catch (e) {
        console.error('renderPaginaMissioni:', e);
        containerMissioni.innerHTML = '<p style="text-align:center; color:var(--danger); font-size:0.85rem; padding:1rem 0;">Errore nel caricamento delle missioni.</p>';
        return;
    }
    const { dati, missioniOggiPool, missioniSettimanaPool, missioniMesePool, nuoveMissioni, nuoviTraguardi } = risultato;

    // Aggiorna il badge del widget in home, se aperto in background —
    // stesso principio di aggiornaBadgeMatch(), nessun refresh di pagina.
    if (typeof _aggiornaPallinoMenu === 'function') { /* nessun pallino per missioni al momento, placeholder per coerenza futura */ }

    const idNuove = new Set(nuoveMissioni.map(m => m.id));

    // Notifiche di sistema (2026-09-01): un avviso per elemento, con i
    // titoli reali del catalogo (m.titolo/t.titolo, già in CATALOGO_MISSIONI/
    // CATALOGO_TRAGUARDI — non inventati). Raggruppate per tipo (group) così
    // completare più missioni di fila accorpa in un'unica notifica invece
    // di spammarne una per ciascuna.
    if (typeof CSBar !== 'undefined') {
        nuoveMissioni.forEach(m => CSBar.avvisa('missione-completata', { text: m.titolo }));
        nuoviTraguardi.forEach(t => CSBar.avvisa('traguardo-sbloccato', { text: t.titolo }));
    }

    const righeMissioni = missioniOggiPool.map(m => _righeMissioneHtml(m, dati, idNuove.has(m.id))).join('');
    // Settimanali/mensili (2026-08-30, generalizzato): ora estratte a
    // sorte come le giornaliere, NON più "tutte visibili sempre" — mostro
    // solo il pool estratto per questa settimana/mese. Le una_tantum
    // restano invece tutte visibili sempre (obiettivi permanenti).
    const missioniRicorrentiNonGiornaliere = [...missioniSettimanaPool, ...missioniMesePool];
    const missioniUnaTantum = CATALOGO_MISSIONI.filter(m => m.finestra === 'una_tantum');
    const altreMissioni = [...missioniRicorrentiNonGiornaliere, ...missioniUnaTantum];
    const righeAltre = altreMissioni.map(m => _righeMissioneHtml(m, dati, idNuove.has(m.id))).join('');

    containerMissioni.innerHTML = `
        <div class="pg-titoletto">Oggi</div>
        <div class="pg-elenco">${righeMissioni}</div>
        ${altreMissioni.length ? `<div class="pg-titoletto" style="margin-top:0.8rem;">Settimanali, mensili &amp; permanenti</div><div class="pg-elenco">${righeAltre}</div>` : ''}
    `;

    // Traguardi: vista compatta per non riversare 65+ righe su mobile — per
    // ogni scala mostra il prossimo scalino non ancora raggiunto (o "tutti
    // sbloccati" se completa), più il conteggio totale sbloccati in alto.
    //
    // BUG TROVATO E CORRETTO (2026-09-01, segnalato da Claudio: "la pagina
    // Traguardi non mostra Maestro CardSync/Leggenda CardSync"): la causa
    // reale non erano le due voci nuove in sé, ma un problema preesistente
    // più ampio, mai notato prima perché nessuno aveva ancora controllato
    // a fondo. Questo array 'scale' elencava SOLO 6 scale (carte, valore,
    // location, wishlist, doppioni, missioni) — le altre 4 già esistenti
    // (t_accessi_, t_binder_aperture_, aggiunte in sessione 2026-08-30) non
    // sono MAI comparse in questa pagina, così come i 4 TRAGUARDI_SINGOLI
    // (t_giorno_impeccabile, t_collezionista_completo, aggiunti in sessioni
    // precedenti, e t_maestro_cardsync/t_leggenda_cardsync di oggi): non
    // esisteva alcun blocco di rendering per loro, non solo mancavano dalla
    // lista. idTraguardiSbloccati sotto era già calcolato ma MAI usato in
    // questo render (codice morto, lasciato con lo stesso nome per non
    // introdurre confusione se in futuro serve davvero evidenziare i
    // "nuovi" — vedi nota su righeSingoli sotto).
    const idTraguardiSbloccati = new Set(nuoviTraguardi.map(t => t.id));
    const scale = [
        { prefisso: 't_carte_', titolo: 'Carte', metrica: 'carte_totali' },
        { prefisso: 't_valore_', titolo: 'Valore collezione', metrica: 'valore_collezione' },
        { prefisso: 't_location_', titolo: 'Location', metrica: 'location_distinte' },
        { prefisso: 't_wishlist_', titolo: 'Wishlist', metrica: 'wishlist_totale' },
        { prefisso: 't_doppioni_', titolo: 'Doppioni', metrica: 'doppioni_totali' },
        { prefisso: 't_missioni_', titolo: 'Missioni completate', metrica: 'missioni_completate_totale' },
        { prefisso: 't_accessi_', titolo: 'Accessi', metrica: 'accessi_totali' },
        { prefisso: 't_binder_aperture_', titolo: 'Binder aperti dal gruppo', metrica: 'binder_aperture_totale' },
        { prefisso: 't_match_', titolo: 'Match trovati', metrica: 'match_trovati_totale' },
        { prefisso: 't_binder_visitati_', titolo: 'Binder visitati', metrica: 'binder_visitati_distinti_totale' },
    ];
    const righeScale = scale.map((s, i) => {
        const voci = CATALOGO_TRAGUARDI.filter(t => t.id.startsWith(s.prefisso)).sort((a, b) => a.valore - b.valore);
        const valoreAttuale = dati[s.metrica] || 0;
        const prossima = voci.find(t => valoreAttuale < t.valore);
        if (!prossima) {
            return `<div class="pg-riga"><i class="fa-solid fa-trophy" style="color:var(--success);"></i><span style="flex:1;">${s.titolo}: tutti i traguardi sbloccati! 🎉</span></div>`;
        }
        const perc = Math.min(100, Math.round((valoreAttuale / prossima.valore) * 100));
        // Stessa struttura/classi già usate per le barre di avanzamento
        // della pagina Set (.pg-riga-set/.pg-barra-track/.pg-barra-fill,
        // vedi renderPaginaSet()) — coerenza visiva, zero CSS nuovo.
        // Espansione al tap (2026-08-31, stessa richiesta/stesso pattern
        // già fatto per le missioni): mostra descrizione + ricompensa del
        // PROSSIMO scalino non ancora raggiunto. Solo qui in questo
        // render, non tocca la pagina Set che riusa la stessa classe
        // .pg-riga-set senza onclick (verificato, nessun conflitto).
        const idBase = 'traguardoScalaDettaglio-' + i;
        return `
            <div>
                <div class="pg-riga-set" style="cursor:pointer;" onclick="_toggleDettaglioMissione('scala-${i}')">
                    <div class="pg-riga-set-testa"><b>${s.titolo}</b><span>prossimo: ${escapeHtml(prossima.titolo)} (${valoreAttuale}/${prossima.valore}) <i class="fa-solid fa-chevron-down" id="missioneDettaglio-scala-${i}-chevron" style="font-size:0.65rem; transition:transform 0.2s;"></i></span></div>
                    <div class="pg-barra-track"><div class="pg-barra-fill" style="width:${perc}%"></div></div>
                </div>
                <div id="missioneDettaglio-scala-${i}" style="display:none; padding:0.3rem 0.2rem 0.6rem; font-size:0.78rem; color:var(--text-muted); line-height:1.4;">
                    <div>${escapeHtml(prossima.descrizione || prossima.titolo)}</div>
                    <div style="margin-top:0.25rem; color:var(--primary); font-weight:600;">${_testoRicompensa(prossima.ricompensa)}</div>
                </div>
            </div>`;
    }).join('');

    // Traguardi "singoli" (non in scala, soglia unica) — MAI renderizzati
    // prima in questa pagina (vedi nota sopra). Testo di stato diverso a
    // seconda del tipo di metrica: booleano ('==' → sbloccato/non ancora),
    // altrimenti valore/soglia (percentuale o conteggio). Sbloccato = la
    // metrica soddisfa GIA' la condizione ora, stessa semplificazione già
    // usata sopra per "tutti sbloccati" nelle scale (non interroga
    // traguardi_riscossi direttamente, ricalcola dal valore corrente —
    // coerente, non un'invenzione nuova).
    const _statoSingoloTesto = (t, dati) => {
        const valore = dati[t.metrica];
        if (t.operatore === '==') return valore ? 'Sbloccato' : 'Non ancora';
        const unita = t.metrica === 'percentuale_traguardi_sbloccati' ? '%' : '';
        return `${valore || 0}${unita} / ${t.valore}${unita}`;
    };
    const righeSingoli = TRAGUARDI_SINGOLI.map((t, i) => {
        const sbloccato = MOTORE_MISSIONI.valuta(t, dati);
        const idBase = 'singolo-' + i;
        return `
            <div>
                <div class="pg-riga-set" style="cursor:pointer;" onclick="_toggleDettaglioMissione('${idBase}')">
                    <div class="pg-riga-set-testa">
                        <b>${escapeHtml(t.titolo)}</b>
                        <span>${sbloccato ? '<i class="fa-solid fa-trophy" style="color:var(--success);"></i> ' : ''}${_statoSingoloTesto(t, dati)} <i class="fa-solid fa-chevron-down" id="missioneDettaglio-${idBase}-chevron" style="font-size:0.65rem; transition:transform 0.2s;"></i></span>
                    </div>
                </div>
                <div id="missioneDettaglio-${idBase}" style="display:none; padding:0.3rem 0.2rem 0.6rem; font-size:0.78rem; color:var(--text-muted); line-height:1.4;">
                    <div>${escapeHtml(t.descrizione || t.titolo)}</div>
                    <div style="margin-top:0.25rem; color:var(--primary); font-weight:600;">${_testoRicompensa(t.ricompensa)}</div>
                </div>
            </div>`;
    }).join('');

    containerTraguardi.innerHTML = `<div class="pg-elenco">${righeScale}${righeSingoli}</div>`;

    if (nuoveMissioni.length || nuoviTraguardi.length) {
        _beep(1200, 90); // stesso beep di conferma usato altrove (apertura dettaglio: 880Hz, qui più acuto per distinguere "vinto")
        // Status bar (2026-09-01): rileggo il saldo vero solo se è successo
        // qualcosa (evita una query in più ad ogni apertura della pagina
        // Missioni quando non cambia nulla).
        // AGGIORNATO 2026-09-07: usa polvere_saldo() (RPC, somma lato
        // Postgres) invece di ricompenseSaldo(userId,'polvere') (somma
        // lato client, tronca oltre ~1000 righe senza segnalarlo — vedi
        // data/bustina.repository.js per il dettaglio).
        if (typeof CSBar !== 'undefined') {
            (async () => {
                try {
                    const { data: saldo, error } = await polvereSaldoLeggi();
                    if (!error) CSBar.setCurrency({ value: saldo || 0 });
                } catch (e) { console.error('[statusbar] aggiornamento saldo polvere:', e); }
            })();
        }
    }
}

// Riga singola per una missione (completata o no), usata sia nel blocco
// "oggi" che in quello "settimanali & mensili". Tap sulla riga (2026-08-31,
// richiesta di Claudio: "cliccando su una missione appaia la descrizione,
// sennò l'utente non sa cosa fare, e anche la ricompensa collegata") →
// espande un blocco sotto con descrizione + ricompensa. pg-riga resta
// esattamente com'era (nessun rischio di rompere il layout condiviso con
// le altre pagine pg-*) — il dettaglio è un div FRATELLO nascosto di
// default, non dentro pg-riga stesso.
function _righeMissioneHtml(m, dati, appenaCompletata) {
    const soddisfatta = MOTORE_MISSIONI.valuta(m, dati);
    const icona = soddisfatta ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle';
    const colore = soddisfatta ? 'var(--success)' : 'var(--text-muted)';
    const badgeNuova = appenaCompletata ? `<span class="badge" style="background-color:var(--success); color:#fff; margin-left:0.4rem; font-size:0.65rem;">+${m.ricompensa.quantita || 1} ${m.ricompensa.tipo}</span>` : '';
    const idBase = 'missioneDettaglio-' + m.id;
    return `
        <div>
            <div class="pg-riga" style="cursor:pointer;" onclick="_toggleDettaglioMissione('${m.id}')">
                <i class="${icona}" style="color:${colore};"></i>
                <span style="flex:1; ${soddisfatta ? 'opacity:0.7;' : ''}">${escapeHtml(m.titolo)}${badgeNuova}</span>
                <i class="fa-solid fa-chevron-down" id="${idBase}-chevron" style="font-size:0.7rem; color:var(--text-muted); transition:transform 0.2s; flex-shrink:0;"></i>
            </div>
            <div id="${idBase}" style="display:none; padding:0 0.2rem 0.6rem 1.6rem; font-size:0.78rem; color:var(--text-muted); line-height:1.4;">
                <div>${escapeHtml(m.descrizione || m.titolo)}</div>
                <div style="margin-top:0.25rem; color:var(--primary); font-weight:600;">${_testoRicompensa(m.ricompensa)}</div>
            </div>
        </div>`;
}

function _toggleDettaglioMissione(id) {
    const dettaglio = document.getElementById('missioneDettaglio-' + id);
    const chevron = document.getElementById('missioneDettaglio-' + id + '-chevron');
    if (!dettaglio) return;
    const aperto = dettaglio.style.display !== 'none';
    dettaglio.style.display = aperto ? 'none' : 'block';
    if (chevron) chevron.style.transform = aperto ? 'rotate(0deg)' : 'rotate(180deg)';
}

// Testo leggibile della ricompensa — stessi 4 tipi già usati nel catalogo
// (polvere/stampino/bustina/skip_missione), più il campo opzionale 'bonus'
// (es. m53/m99/m100 "possibilita_bustina/stampino") mostrato come nota a
// parte, senza promettere una certezza che non c'è.
function _testoRicompensa(ricompensa) {
    const q = ricompensa.quantita || 1;
    let base;
    if (ricompensa.tipo === 'polvere') base = `${q} polvere`;
    else if (ricompensa.tipo === 'bustina') base = `${q} bustina${q === 1 ? '' : 'e'}`;
    else if (ricompensa.tipo === 'stampino') base = `uno stampino${ricompensa.riferimento ? ` (${ricompensa.riferimento.replace(/_/g, ' ')})` : ''}`;
    else if (ricompensa.tipo === 'skip_missione') base = `salta una missione`;
    else base = `${q} ${ricompensa.tipo}`;
    const bonus = ricompensa.bonus ? ` — più una possibilità di ${ricompensa.bonus.replace('possibilita_', '').replace('_', ' ')} extra` : '';
    return `Ricompensa: ${base}${bonus}`;
}



// Riusa trovaMatch() e la stessa chiave stabile di _chiaveMatch (entrambe
// già in queue.ui.js) — zero duplicazione della logica di interrogazione,
// solo una resa diversa: entrambe le direzioni insieme, raggruppate per
// persona, righe separate anche per la stessa carta (Claudio, 2026-08-28,
// risposte 1/3/6).
async function renderPaginaMatch() {
    const container = document.getElementById('matchLista');
    if (!container) return;
    container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;"><i class="fa-solid fa-spinner fa-spin"></i> Cerco corrispondenze…</p>';

    const userId = await authGetUserId();
    if (!userId) { container.innerHTML = ''; return; }

    const [{ data: dataScambio, error: errS }, { data: dataWishlist, error: errW }] = await Promise.all([
        trovaMatch('trova_match_scambio_wishlist', userId),
        trovaMatch('trova_match_wishlist_scambio', userId),
    ]);
    if (errS || errW) {
        container.innerHTML = `<p style="text-align:center; color:var(--danger); font-size:0.85rem; padding:1rem 0;">Errore nella ricerca match: ${((errS || errW).message)}</p>`;
        return;
    }

    // Stessa chiave di _chiaveMatch (queue.ui.js) — non duplicata qui come
    // funzione a sé per non rischiare che le due si scollino nel tempo,
    // semplicemente la stessa formula copiata: se cambia una, deve
    // cambiare anche l'altra (commento su entrambe).
    const righeScambio = (dataScambio || []).map(m => ({
        chiave: `${m.mia_carta_id}_${m.altra_wishlist_id}`,
        persona: (m.altra_email || '').split('@')[0] || 'Utente',
        ownerAltro: m.altro_owner_id,
        binderAltro: m.altro_binder_id || null, // presente solo dopo la migration 29
        testo: `<strong>${escapeHtml(m.mio_nome)}</strong> (tuo, in Scambio, ${Number(m.mio_prezzo || 0).toFixed(2)} €) — lo cerca${m.altro_prezzo_obiettivo != null ? ` fino a ${Number(m.altro_prezzo_obiettivo).toFixed(2)} €` : ''}`,
    }));
    const righeWishlist = (dataWishlist || []).map(m => ({
        chiave: `${m.mia_wishlist_id}_${m.altra_carta_id}`,
        persona: (m.altra_email || '').split('@')[0] || 'Utente',
        ownerAltro: m.altro_owner_id,
        binderAltro: m.altro_binder_id || null,
        testo: `<strong>${escapeHtml(m.mio_nome)}</strong> (tua, in Wishlist${m.mio_prezzo_obiettivo != null ? `, fino a ${Number(m.mio_prezzo_obiettivo).toFixed(2)} €` : ''}) — ce l'ha in Scambio a ${Number(m.altro_prezzo || 0).toFixed(2)} €`,
    }));

    // Collegato a preferenze_utente.match_nascosti (migration 30,
    // eseguita) — persistente per-utente, non per-dispositivo (Claudio,
    // 2026-08-28, risposta 2: non riusa prefMatchVistiGet, che è
    // localStorage e quindi per-dispositivo).
    const nascosti = await _matchNascostiSet(userId);
    const tutte = [...righeScambio, ...righeWishlist].filter(r => !nascosti.has(r.chiave));

    if (tutte.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.9rem; padding:2rem 0;">Nessuna corrispondenza al momento.</p>';
        return;
    }

    const perPersona = {};
    tutte.forEach(r => { (perPersona[r.persona] ||= []).push(r); });

    container.innerHTML = Object.entries(perPersona).map(([persona, righe]) => `
        <div>
            <div class="pg-titoletto"><i class="fa-solid fa-user"></i> ${escapeHtml(persona)}</div>
            <div class="pg-elenco">
                ${righe.map(r => `
                    <div class="pg-riga" style="flex-wrap:wrap; gap:0.5rem;">
                        <span style="flex:1; min-width:200px; font-size:0.82rem;">${r.testo}</span>
                        <div style="display:flex; gap:0.4rem; flex-shrink:0;">
                            <button type="button" class="btn-secondary" style="font-size:0.72rem; padding:0.35rem 0.55rem;" onclick="event.stopPropagation(); _apriBinderAltruiMatch('${r.ownerAltro}', '${r.binderAltro || ''}')" title="Vai al binder"><i class="fa-solid fa-layer-group"></i></button>
                            <button type="button" class="btn-secondary" style="font-size:0.72rem; padding:0.35rem 0.55rem;" onclick="event.stopPropagation(); _contattaPersonaMatch('${r.ownerAltro}')" title="Contatta"><i class="fa-solid fa-comment"></i></button>
                            <button type="button" class="btn-secondary" style="font-size:0.72rem; padding:0.35rem 0.55rem;" onclick="event.stopPropagation(); _nascondiMatch('${r.chiave}', event)" title="Nascondi"><i class="fa-solid fa-eye-slash"></i></button>
                        </div>
                    </div>`).join('')}
            </div>
        </div>`).join('');
}

// Legge preferenze_utente.match_nascosti (migration 30) e lo trasforma
// in un Set di chiavi — stesso pattern di lettura di userSettingsGet già
// usato altrove nel sito, nessuna query nuova inventata.
async function _matchNascostiSet(userId) {
    if (!userId) return new Set();
    try {
        const { data, error } = await userSettingsGet(userId);
        if (error || !data || !data.match_nascosti) return new Set();
        return new Set(JSON.parse(data.match_nascosti));
    } catch (e) {
        console.error('_matchNascostiSet: errore lettura/parsing:', e);
        return new Set();
    }
}

// Nasconde subito la riga (feedback immediato, prima ancora che il
// salvataggio finisca) e scrive per davvero su preferenze_utente —
// persistente per-utente, sopravvive a refresh e cambio dispositivo.
async function _nascondiMatch(chiave, evt) {
    const tile = evt?.currentTarget?.closest('.widget-picker-riga');
    if (tile) tile.style.display = 'none';

    const userId = await authGetUserId();
    if (!userId) return;
    const attuali = await _matchNascostiSet(userId);
    attuali.add(chiave);
    const { error } = await userSettingsUpsertMatchNascosti(userId, [...attuali]);
    if (error) console.error('_nascondiMatch: errore salvataggio:', error.message);
}

// Stesso schema URL di _linkPubblicoCondivisione (navigation.ui.js):
// binder-pubblico.html?u=<owner>&binder=<id>, aperto in nuova scheda come
// già fa apriAnteprimaLinkCondiviso — nessun meccanismo nuovo inventato.
// Se binderAltro è vuoto (migration 29 non ancora applicata sul DB, o
// l'altra persona non ha ancora quel binder materializzato) mostra il
// segnaposto invece di costruire un link rotto.
function _apriBinderAltruiMatch(ownerAltro, binderAltro) {
    if (!ownerAltro || !binderAltro) {
        alert('Collegamento diretto al binder non ancora disponibile.');
        return;
    }
    // Missione #70 "Binder pubblico" (2026-08-30): visita del binder
    // pubblico di un altro utente TRAMITE MATCH — utente loggato, quindi
    // scrivibile direttamente (a differenza della "popolarità" m18-20, che
    // conta le aperture anonime da binder-pubblico.html e passa per la RPC
    // SECURITY DEFINER di migration 33). Fire-and-forget, come gli altri.
    // AGGIORNATO (2026-09-01): passo anche binderAltro — serve al traguardo
    // cumulativo #56-65 "binder visitati" per contare binder DISTINTI (non
    // solo le visite totali, già usate dalla missione #70 sopra).
    (async () => {
        try {
            const userId = await authGetUserId();
            if (userId) await missioniBinderPubblicoVisitatoRegistra(userId, binderAltro);
        } catch (e) { console.error('[missioni] registrazione visita binder pubblico:', e); }
    })();
    const url = new URL('binder-pubblico.html?u=' + encodeURIComponent(ownerAltro), window.location.href);
    url.searchParams.set('binder', binderAltro);
    window.open(url.href, '_blank');
}

// Confermato segnaposto da Claudio (2026-08-28, risposta 2): il
// meccanismo di contatto vero arriverà più avanti.
function _contattaPersonaMatch(ownerAltro) {
    alert('Funzione di contatto in arrivo.');
}

// ── PAGINA "VALORE COLLEZIONE" (2026-08-30) ─────────────────────────────
// Prima widget con pagina di dettaglio propria (struttura adottata da
// cardsync-tutto.html, vedi CSS pg-*/page-header in index.html) invece di
// aprire semplicemente la sezione Prezzi. Zero query nuove: riusa
// CATALOGO_WIDGET.valore_collezione.preview(), la stessa funzione già
// usata per l'anteprima del widget in Home.
// Le carte nella lista "Le più preziose" aprono il flip-viewer con
// origine:'top_valore' — STESSO meccanismo già usato per le missioni
// #39/#83 dal ball-peek in Home (vedi _ballMiniCarta/_ballAzioneRiga):
// cliccarle da qui deve contare allo stesso modo, è concettualmente la
// stessa lista.
async function renderPaginaValoreCollezione() {
    const container = document.getElementById('valoreContenuto');
    if (!container) return;

    const def = CATALOGO_WIDGET.valore_collezione;
    let dati;
    try {
        const anteprima = await def.preview();
        dati = anteprima.dati;
    } catch (e) {
        console.error('renderPaginaValoreCollezione:', e);
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Errore nel caricamento.</p>';
        return;
    }

    const eur = (v) => '€ ' + Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 });

    const righeCarte = (dati.top && dati.top.length)
        ? dati.top.map(c => {
            const immagineSrc = c.immagine ? (_urlImmagineVisualizzabile(c.immagine, 96) || '') : '';
            const fig = immagineSrc
                ? `<img class="pg-fig" src="${immagineSrc}" alt="" onerror="this.style.display='none';">`
                : '<div class="pg-fig"></div>';
            return `
                <div class="pg-riga" data-tocca onclick="apriFlipCardHome('${c.id}', { origine: 'top_valore' })">
                    ${fig}
                    <div class="pg-testo"><b>${escapeHtml(c.nome || '—')}</b></div>
                    <div class="pg-destra"><b>${eur(c.valore)}</b></div>
                </div>`;
        }).join('')
        : '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Ancora nessuna carta in collezione.</p>';

    container.innerHTML = `
        <div class="page-header">
            <span class="page-title">Valore collezione</span>
            <span class="page-azione attiva" onclick="apriDettaglioWidget('prezzi', event)">Vai a Prezzi</span>
        </div>
        <div class="pg-pagina">
            <div class="pg-intro">
                <div class="pg-grande">${eur(dati.valore)}</div>
                <div class="pg-sotto">${dati.pezzi} pezz${dati.pezzi === 1 ? 'o' : 'i'} · media ${eur(dati.media)}</div>
            </div>
            <div class="pg-stat">
                <div><b>${dati.pezzi}</b><span>Carte totali</span></div>
                <div><b>${eur(dati.media)}</b><span>Valore medio</span></div>
            </div>
            ${dati.top && dati.top.length ? '<div class="pg-titoletto">Le più preziose</div>' : ''}
            <div class="pg-elenco">${righeCarte}</div>
        </div>
    `;
}


// ── PAGINA "WISHLIST" (2026-08-30) ──────────────────────────────────────
// Secondo widget con pagina di dettaglio propria, stesso pattern di
// renderPaginaValoreCollezione() sopra. A differenza di quella, qui la
// pagina mostra TUTTA la wishlist (non solo il preview a 3 carte del
// widget) — letta direttamente da carteReali (stessa fonte del preview,
// senza il .slice(0,3)), zero query nuove.
//
// Ordinamento: raggiunte prima (le carte con prezzo attuale <= obiettivo,
// ordinate per sconto più grande), poi le altre con obiettivo impostato
// (ordinate per vicinanza — prezzo più vicino all'obiettivo prima), infine
// quelle senza obiettivo impostato in fondo (alfabetico) — deciso da
// Claudio.
let _wishlistCarteComputate = [];
let _wishlistFiltroAttivo = 'tutte';
let _wishlistRicercaTesto = '';

function _wishlistClassificaEOrdina() {
    const desiderate = carteReali.filter(c => c.tabella === 'wishlist' || c.stato === 'wishlist');
    const conPrezzo = (c) => Number(c.price) || 0;
    const conObiettivoVal = (c) => (c.prezzoObiettivo != null && Number(c.prezzoObiettivo) > 0) ? Number(c.prezzoObiettivo) : null;

    const righe = desiderate.map(c => {
        const obiettivo = conObiettivoVal(c);
        const prezzo = conPrezzo(c);
        const raggiunta = obiettivo != null && prezzo > 0 && prezzo <= obiettivo;
        return { id: c.id, nome: c.name || '—', immagine: c.immagine || null, prezzo, obiettivo, raggiunta };
    });

    const raggiunte = righe.filter(r => r.raggiunta)
        .sort((a, b) => (b.obiettivo - b.prezzo) - (a.obiettivo - a.prezzo)); // sconto più grande prima
    const inCorso = righe.filter(r => !r.raggiunta && r.obiettivo != null)
        .sort((a, b) => (a.prezzo - a.obiettivo) - (b.prezzo - b.obiettivo)); // più vicine prima
    const senzaObiettivo = righe.filter(r => r.obiettivo == null)
        .sort((a, b) => a.nome.localeCompare(b.nome));

    _wishlistCarteComputate = [...raggiunte, ...inCorso, ...senzaObiettivo];
    return { totale: righe.length, conObiettivo: raggiunte.length + inCorso.length, raggiunte: raggiunte.length };
}

async function renderPaginaWishlist() {
    const container = document.getElementById('wishlistContenuto');
    if (!container) return;

    _wishlistFiltroAttivo = 'tutte';
    _wishlistRicercaTesto = '';
    const { totale, conObiettivo, raggiunte } = _wishlistClassificaEOrdina();

    if (totale === 0) {
        container.innerHTML = `
            <div class="page-header">
                <span class="page-title">Wishlist</span>
            </div>
            <p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:2rem 0;">La tua wishlist è vuota.</p>
        `;
        return;
    }

    container.innerHTML = `
        <div class="page-header">
            <span class="page-title">Wishlist</span>
            <span class="page-azione attiva" onclick="_vaiAlBinderWishlist(event)">Vai alla Wishlist</span>
        </div>
        <div class="pg-pagina">
            <div class="pg-intro">
                <div class="pg-grande">${totale}</div>
                <div class="pg-sotto">${conObiettivo} con obiettivo di prezzo · ${raggiunte} già raggiunte</div>
            </div>
            <div class="pg-stat">
                <div><b>${totale}</b><span>Desiderate</span></div>
                <div><b>${conObiettivo}</b><span>Con obiettivo</span></div>
                <div><b>${raggiunte}</b><span>Raggiunte</span></div>
            </div>
            <input type="text" class="pg-cerca" placeholder="Cerca nella wishlist..." oninput="_wishlistCercaInput(this.value)">
            <div class="pg-filtri">
                <span class="pg-filtro attivo" data-filtro="tutte" onclick="_wishlistImpostaFiltro('tutte')">Tutte</span>
                <span class="pg-filtro" data-filtro="raggiunte" onclick="_wishlistImpostaFiltro('raggiunte')">Raggiunte</span>
                <span class="pg-filtro" data-filtro="in_corso" onclick="_wishlistImpostaFiltro('in_corso')">In corso</span>
                <span class="pg-filtro" data-filtro="senza_obiettivo" onclick="_wishlistImpostaFiltro('senza_obiettivo')">Senza obiettivo</span>
            </div>
            <div class="pg-elenco" id="wishlistElenco"></div>
        </div>
    `;
    _wishlistRenderElenco();
}

function _wishlistImpostaFiltro(filtro) {
    _wishlistFiltroAttivo = filtro;
    document.querySelectorAll('.pg-filtri .pg-filtro').forEach(el => {
        el.classList.toggle('attivo', el.dataset.filtro === filtro);
    });
    _wishlistRenderElenco();
}

function _wishlistCercaInput(valore) {
    _wishlistRicercaTesto = (valore || '').toLowerCase();
    _wishlistRenderElenco();
}

function _wishlistRenderElenco() {
    const elenco = document.getElementById('wishlistElenco');
    if (!elenco) return;

    const eur = (v) => '€ ' + Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 });

    let righe = _wishlistCarteComputate;
    if (_wishlistFiltroAttivo === 'raggiunte') righe = righe.filter(r => r.raggiunta);
    else if (_wishlistFiltroAttivo === 'in_corso') righe = righe.filter(r => !r.raggiunta && r.obiettivo != null);
    else if (_wishlistFiltroAttivo === 'senza_obiettivo') righe = righe.filter(r => r.obiettivo == null);
    if (_wishlistRicercaTesto) righe = righe.filter(r => r.nome.toLowerCase().includes(_wishlistRicercaTesto));

    if (righe.length === 0) {
        // Messaggio diverso da quello a pagina intera (wishlist vuota):
        // qui la wishlist ha carte, solo il filtro/ricerca corrente non
        // trova corrispondenze.
        elenco.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.82rem; padding:1.2rem 0;">Nessuna carta corrisponde alla ricerca o al filtro.</p>';
        return;
    }

    elenco.innerHTML = righe.map(r => {
        const immagineSrc = r.immagine ? (_urlImmagineVisualizzabile(r.immagine, 96) || '') : '';
        const fig = immagineSrc
            ? `<img class="pg-fig" src="${immagineSrc}" alt="" onerror="this.style.display='none';">`
            : '<div class="pg-fig"></div>';
        const badge = r.raggiunta ? '<span class="pg-badge-raggiunta">Raggiunto</span>' : '';
        const destra = r.obiettivo != null
            ? `<b>${eur(r.prezzo)}</b>obiettivo ${eur(r.obiettivo)}`
            : `<b>${eur(r.prezzo)}</b>nessun obiettivo`;
        return `
            <div class="pg-riga ${r.raggiunta ? 'pg-riga-raggiunta' : ''}" data-tocca onclick="apriFlipCardHome('${r.id}', { origine: 'wishlist_pagina' })">
                ${fig}
                <div class="pg-testo"><b>${escapeHtml(r.nome)}${badge}</b></div>
                <div class="pg-destra">${destra}</div>
            </div>`;
    }).join('');
}

// Salta direttamente al binder di tipo 'wishlist', invece di lasciare
// l'utente sulla griglia dei contenitori di Binder (2026-08-30). Usa SOLO
// funzioni reali già esistenti in ui/binder.ui.js, nessuna query nuova
// inventata:
//   1) apriDettaglioWidget('binder', evt) — mostra la view-section Binder
//      (switchTab interno, MAI toccato direttamente qui) E chiama già da
//      sola apriWidgetBinders() al suo interno, awaited (vedi
//      apriDettaglioWidget riga ~2733) — _bindersElenco è già garantita
//      popolata quando questa await finisce, nessuna seconda chiamata
//      necessaria.
//   2) apriBinderDettaglio(id) — cerca dentro _bindersElenco.
async function _vaiAlBinderWishlist(evt) {
    await apriDettaglioWidget('binder', evt);
    const binderWishlist = _bindersElenco.find(b => b.tipo === 'wishlist');
    if (binderWishlist) {
        await apriBinderDettaglio(binderWishlist.id);
    }
    // Se non trovato (caso limite — binderWishlistGarantisci() dovrebbe
    // impedirlo sempre, vedi _garantisciTuttiIBinder in ui/binder.ui.js):
    // resta sulla griglia dei contenitori invece di rompere la pagina.
}


// ── PAGINA "LOCATION" (2026-08-30) ──────────────────────────────────────
// Terzo widget con pagina di dettaglio propria. Due fonti unite:
//   1) CATALOGO_WIDGET.location.preview() → dati.voci: location USATE da
//      almeno una carta, con conteggio (da carteReali, stesso calcolo del
//      tile — nessuna query nuova per questa parte).
//   2) locationsList(userId) (data/locations.repository.js) → TUTTE le
//      location esistenti nella tabella 'location', comprese quelle senza
//      ancora nessuna carta. Necessaria: senza unire le due fonti, una
//      location appena creata (0 carte) non comparirebbe mai qui, e
//      sembrerebbe che "+ Aggiungi" non abbia fatto nulla.
// Click su una riga → RIUSA _ballAzioneRiga(evt,'location',nome), lo
// stesso meccanismo già esistente che apre Visualizzazione filtrata su
// quella location — nessuna logica di filtro duplicata qui.
//
// "+ Aggiungi" ora reale (locationInsert, con locationExists prima per
// evitare doppioni — nessun vincolo UNIQUE noto sulla tabella).
// "✕ Rimuovi" resta placeholder: data/locations.repository.js non ha
// nessuna funzione di eliminazione — non inventata.
// Opzione A confermata da Claudio: blocca l'eliminazione se la location ha
// ancora almeno una carta assegnata — le carte salvano la location come
// testo libero (c.location), non un riferimento alla tabella, quindi
// cancellarla senza controllo lascerebbe carte con un nome "orfano" (non
// più presente in 'location' ma ancora scritto sulla carta).
async function _locationRimuovi(nome) {
    const carteConQuestaLocation = carteReali.filter(c => c.stato === 'collezione' && (c.location || '—') === nome).length;
    if (carteConQuestaLocation > 0) {
        alert(`"${nome}" ha ancora ${carteConQuestaLocation} cart${carteConQuestaLocation === 1 ? 'a assegnata' : 'e assegnate'}. Sposta prima quelle carte su un'altra location, poi riprova.`);
        return;
    }
    if (!confirm(`Eliminare la location "${nome}"? Non ha nessuna carta assegnata.`)) return;

    const userId = await authGetUserId();
    if (!userId) return;
    const { error } = await locationDelete(userId, nome);
    if (error) { alert('Errore nella cancellazione: ' + error.message); return; }

    renderPaginaLocation();
}

async function _locationAggiungi() {
    const nome = (prompt('Nome della nuova location:') || '').trim();
    if (!nome) return;
    const userId = await authGetUserId();
    if (!userId) return;

    const { data: esistenti, error: errCheck } = await locationExists(userId, nome);
    if (errCheck) { alert('Errore nel controllo: ' + errCheck.message); return; }
    if (esistenti && esistenti.length > 0) { alert(`"${nome}" esiste già.`); return; }

    const { error: errIns } = await locationInsert(userId, nome);
    if (errIns) { alert('Errore nella creazione: ' + errIns.message); return; }

    renderPaginaLocation(); // ricarica la pagina, la nuova location comparirà con 0 carte
}

async function renderPaginaLocation() {
    const container = document.getElementById('locationContenuto');
    if (!container) return;

    const def = CATALOGO_WIDGET.location;
    let voci;
    try {
        const anteprima = def.preview();
        voci = (anteprima.dati && anteprima.dati.voci) || [];
    } catch (e) {
        console.error('renderPaginaLocation:', e);
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Errore nel caricamento.</p>';
        return;
    }

    // Unione con le location senza ancora nessuna carta (vedi commento
    // sopra). Fallimento qui non deve mai nascondere le location che
    // hanno già delle carte (quelle sopra sono già pronte) — solo le
    // location vuote in più non compariranno.
    const userId = await authGetUserId();
    if (userId) {
        try {
            const { data: tutte, error } = await locationsList(userId);
            if (error) throw error;
            const nomiConCarte = new Set(voci.map(([nome]) => nome));
            (tutte || []).forEach(r => {
                if (r.nome && !nomiConCarte.has(r.nome)) voci.push([r.nome, 0]);
            });
        } catch (e) {
            console.error('renderPaginaLocation (locationsList):', e);
        }
    }
    // Riordina dopo l'unione: conteggio discendente, a parità alfabetico —
    // così le location vuote (0) finiscono in fondo, non sparse a caso.
    voci.sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));

    if (voci.length === 0) {
        container.innerHTML = `
            <div class="page-header">
                <span class="page-title">Location</span>
            </div>
            <p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1.5rem 0 0.5rem;">Nessuna carta ha ancora una location.</p>
            <div class="pg-bottoni" style="justify-content:center;">
                <button class="primario" onclick="_locationAggiungi()">+ Crea la prima location</button>
            </div>
        `;
        return;
    }

    const totale = voci.length;
    const [nomePiuPiena, conteggioPiuPieno] = voci[0];

    const righe = voci.map(([nome, n]) => `
        <div class="pg-riga" data-tocca>
            <div class="pg-testo" style="cursor:pointer;" onclick="_ballAzioneRiga(event, 'location', '${String(nome).replace(/'/g, "\\'")}')">
                <b>${escapeHtml(nome)}</b>
            </div>
            <div class="pg-destra" style="cursor:pointer;" onclick="_ballAzioneRiga(event, 'location', '${String(nome).replace(/'/g, "\\'")}')">
                <b>${n}</b>${n === 1 ? 'carta' : 'carte'}
            </div>
            <span class="pg-filtro" style="margin-left:8px;" onclick="event.stopPropagation(); _locationRimuovi('${String(nome).replace(/'/g, "\\'")}')" title="Rimuovi location">✕</span>
        </div>`).join('');

    container.innerHTML = `
        <div class="page-header">
            <span class="page-title">Location</span>
            <span class="page-azione attiva" onclick="_locationAggiungi()">+ Aggiungi</span>
        </div>
        <div class="pg-pagina">
            <div class="pg-intro">
                <div class="pg-grande">${totale}</div>
                <div class="pg-sotto">più piena: ${escapeHtml(nomePiuPiena)} (${conteggioPiuPieno} carte)</div>
            </div>
            <div class="pg-stat">
                <div><b>${totale}</b><span>Location totali</span></div>
                <div><b>${escapeHtml(nomePiuPiena)}</b><span>Più piena (${conteggioPiuPieno})</span></div>
            </div>
            <div class="pg-elenco">${righe}</div>
        </div>
    `;
}


// ── PAGINA "DOPPIONI" (2026-08-30) ──────────────────────────────────────
// Quarto widget con pagina di dettaglio propria. Riusa la stessa logica di
// filtro di CATALOGO_WIDGET.doppioni.preview() (carte in collezione con
// qty>1) letta direttamente da carteReali, senza il taglio a 3 del
// preview — zero query nuove.
// Click su una carta → flip-viewer con opzioni.doppione=true, che mostra
// il pulsante "Gestisci doppione" (vedi ui/home.ui.js) — le due scelte
// decise per la missione #15 "Fai spazio" (sposta in Scambio / apri
// scheda modifica), costruite qui per la prima volta.
let _doppioniCarteComputate = [];
let _doppioniOrdinamento = 'quantita';
let _doppioniRicercaTesto = '';

function _doppioniCalcola() {
    const doppie = carteReali.filter(c => c.stato === 'collezione' && (Number(c.qty) || 1) > 1);
    const righe = doppie.map(c => {
        const qty = Number(c.qty) || 1;
        const prezzo = Number(c.price) || 0;
        return { id: c.id, nome: c.name || '—', immagine: c.immagine || null, qty, valoreExtra: prezzo * (qty - 1) };
    });
    _doppioniCarteComputate = righe;
    return {
        titoli: righe.length,
        copieExtra: righe.reduce((t, r) => t + (r.qty - 1), 0),
        valoreExtra: righe.reduce((t, r) => t + r.valoreExtra, 0),
    };
}

async function renderPaginaDoppioni() {
    const container = document.getElementById('doppioniContenuto');
    if (!container) return;

    _doppioniOrdinamento = 'quantita';
    _doppioniRicercaTesto = '';
    const { titoli, copieExtra, valoreExtra } = _doppioniCalcola();
    const eur = (v) => '€ ' + Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 });

    if (titoli === 0) {
        container.innerHTML = `
            <div class="page-header">
                <span class="page-title">Doppioni</span>
            </div>
            <p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:2rem 0;">Nessun doppione al momento.</p>
        `;
        return;
    }

    container.innerHTML = `
        <div class="page-header">
            <span class="page-title">Doppioni</span>
        </div>
        <div class="pg-pagina">
            <div class="pg-intro">
                <div class="pg-grande">${titoli}</div>
                <div class="pg-sotto">${copieExtra} copie extra · valore ${eur(valoreExtra)}</div>
            </div>
            <div class="pg-stat">
                <div><b>${titoli}</b><span>Carte doppie</span></div>
                <div><b>${copieExtra}</b><span>Copie extra</span></div>
                <div><b>${eur(valoreExtra)}</b><span>Valore extra</span></div>
            </div>
            <input type="text" class="pg-cerca" placeholder="Cerca tra i doppioni..." oninput="_doppioniCercaInput(this.value)">
            <div class="pg-filtri">
                <span class="pg-filtro attivo" data-ord="quantita" onclick="_doppioniImpostaOrdinamento('quantita')">Quantità</span>
                <span class="pg-filtro" data-ord="valore" onclick="_doppioniImpostaOrdinamento('valore')">Valore</span>
                <span class="pg-filtro" data-ord="alfabetico" onclick="_doppioniImpostaOrdinamento('alfabetico')">Alfabetico</span>
            </div>
            <div class="pg-elenco" id="doppioniElenco"></div>
        </div>
    `;
    _doppioniRenderElenco();
}

function _doppioniImpostaOrdinamento(ordine) {
    _doppioniOrdinamento = ordine;
    document.querySelectorAll('.pg-filtri .pg-filtro').forEach(el => {
        el.classList.toggle('attivo', el.dataset.ord === ordine);
    });
    _doppioniRenderElenco();
}

function _doppioniCercaInput(valore) {
    _doppioniRicercaTesto = (valore || '').toLowerCase();
    _doppioniRenderElenco();
}

function _doppioniRenderElenco() {
    const elenco = document.getElementById('doppioniElenco');
    if (!elenco) return;

    const eur = (v) => '€ ' + Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 });

    let righe = [..._doppioniCarteComputate];
    if (_doppioniRicercaTesto) righe = righe.filter(r => r.nome.toLowerCase().includes(_doppioniRicercaTesto));

    if (_doppioniOrdinamento === 'quantita') righe.sort((a, b) => b.qty - a.qty);
    else if (_doppioniOrdinamento === 'valore') righe.sort((a, b) => b.valoreExtra - a.valoreExtra);
    else righe.sort((a, b) => a.nome.localeCompare(b.nome));

    if (righe.length === 0) {
        elenco.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.82rem; padding:1.2rem 0;">Nessuna carta corrisponde alla ricerca.</p>';
        return;
    }

    elenco.innerHTML = righe.map(r => {
        const immagineSrc = r.immagine ? (_urlImmagineVisualizzabile(r.immagine, 96) || '') : '';
        const fig = immagineSrc
            ? `<img class="pg-fig" src="${immagineSrc}" alt="" onerror="this.style.display='none';">`
            : '<div class="pg-fig"></div>';
        return `
            <div class="pg-riga" data-tocca onclick="apriFlipCardHome('${r.id}', { origine: 'doppioni_pagina', doppione: true })">
                ${fig}
                <div class="pg-testo"><b>${escapeHtml(r.nome)}</b><span>×${r.qty}</span></div>
                <div class="pg-destra"><b>${eur(r.valoreExtra)}</b>copie extra</div>
            </div>`;
    }).join('');
}


// ── PAGINA "SEALED" (2026-08-30) ────────────────────────────────────────
// Quinto widget con pagina di dettaglio propria. Stessa filosofia di
// Doppioni: filtro replicato da CATALOGO_WIDGET.sealed.preview() ma su
// carteReali per intero (senza il .slice(0,3) del preview) — zero query
// nuove. A differenza delle altre pagine, click su una riga NON apre il
// flip-viewer (deciso da Claudio: ha meno senso per un prodotto sigillato
// che per una singola carta) — apre invece apriModificaCarta(id), lo
// stesso modale di modifica già riusato per "Modifica carta" nella pagina
// Doppioni.
let _sealedProdottiComputati = [];
let _sealedOrdinamento = 'valore';
let _sealedRicercaTesto = '';

function _sealedCalcola() {
    const prodotti = carteReali.filter(c => c.stato === 'collezione' && c.tipo === 'sealed');
    const righe = prodotti.map(p => {
        const qty = Number(p.qty) || 1;
        const prezzoUnitario = Number(p.price) || 0;
        return { id: p.id, nome: p.name || '—', immagine: p.immagine || null, qty, prezzoUnitario, valoreTotale: prezzoUnitario * qty };
    });
    _sealedProdottiComputati = righe;
    return {
        totale: righe.length,
        valore: righe.reduce((t, r) => t + r.valoreTotale, 0),
    };
}

async function renderPaginaSealed() {
    const container = document.getElementById('sealedContenuto');
    if (!container) return;

    _sealedOrdinamento = 'valore';
    _sealedRicercaTesto = '';
    const { totale, valore } = _sealedCalcola();
    const eur = (v) => '€ ' + Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 });

    if (totale === 0) {
        container.innerHTML = `
            <div class="page-header">
                <span class="page-title">Sealed</span>
            </div>
            <p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:2rem 0;">Nessun prodotto sealed al momento.</p>
        `;
        return;
    }

    container.innerHTML = `
        <div class="page-header">
            <span class="page-title">Sealed</span>
        </div>
        <div class="pg-pagina">
            <div class="pg-intro">
                <div class="pg-grande">${totale}</div>
                <div class="pg-sotto">valore totale ${eur(valore)}</div>
            </div>
            <div class="pg-stat">
                <div><b>${totale}</b><span>Prodotti</span></div>
                <div><b>${eur(valore)}</b><span>Valore totale</span></div>
            </div>
            <input type="text" class="pg-cerca" placeholder="Cerca tra i prodotti sealed..." oninput="_sealedCercaInput(this.value)">
            <div class="pg-filtri">
                <span class="pg-filtro attivo" data-ord="valore" onclick="_sealedImpostaOrdinamento('valore')">Valore</span>
                <span class="pg-filtro" data-ord="quantita" onclick="_sealedImpostaOrdinamento('quantita')">Quantità</span>
                <span class="pg-filtro" data-ord="alfabetico" onclick="_sealedImpostaOrdinamento('alfabetico')">Alfabetico</span>
            </div>
            <div class="pg-elenco" id="sealedElenco"></div>
        </div>
    `;
    _sealedRenderElenco();
}

function _sealedImpostaOrdinamento(ordine) {
    _sealedOrdinamento = ordine;
    document.querySelectorAll('.pg-filtri .pg-filtro').forEach(el => {
        el.classList.toggle('attivo', el.dataset.ord === ordine);
    });
    _sealedRenderElenco();
}

function _sealedCercaInput(valore) {
    _sealedRicercaTesto = (valore || '').toLowerCase();
    _sealedRenderElenco();
}

function _sealedRenderElenco() {
    const elenco = document.getElementById('sealedElenco');
    if (!elenco) return;

    const eur = (v) => '€ ' + Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 });

    let righe = [..._sealedProdottiComputati];
    if (_sealedRicercaTesto) righe = righe.filter(r => r.nome.toLowerCase().includes(_sealedRicercaTesto));

    if (_sealedOrdinamento === 'valore') righe.sort((a, b) => b.valoreTotale - a.valoreTotale);
    else if (_sealedOrdinamento === 'quantita') righe.sort((a, b) => b.qty - a.qty);
    else righe.sort((a, b) => a.nome.localeCompare(b.nome));

    if (righe.length === 0) {
        elenco.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.82rem; padding:1.2rem 0;">Nessun prodotto corrisponde alla ricerca.</p>';
        return;
    }

    elenco.innerHTML = righe.map(r => {
        const immagineSrc = r.immagine ? (_urlImmagineVisualizzabile(r.immagine, 96) || '') : '';
        const fig = immagineSrc
            ? `<img class="pg-fig" src="${immagineSrc}" alt="" onerror="this.style.display='none';">`
            : '<div class="pg-fig"></div>';
        return `
            <div class="pg-riga" data-tocca onclick="if (typeof apriModificaCarta === 'function') apriModificaCarta('${r.id}');">
                ${fig}
                <div class="pg-testo"><b>${escapeHtml(r.nome)}</b><span>×${r.qty} · ${eur(r.prezzoUnitario)} cad.</span></div>
                <div class="pg-destra"><b>${eur(r.valoreTotale)}</b>totale</div>
            </div>`;
    }).join('');
}


// ── PAGINA "SET" (2026-08-30) ───────────────────────────────────────────
// Sesto widget con pagina di dettaglio propria. Riusa
// CATALOGO_WIDGET.set_completamento.preview() per intero (dati.voci: già
// TUTTE le espansioni, non solo le prime 4 del ball — nessun taglio da
// togliere qui, a differenza delle altre pagine). Sola consultazione:
// nessun click sulle righe, nessuna ricerca, ordinamento fisso per
// percentuale (deciso da Claudio) — stesso ordine già dato dal preview.
async function renderPaginaSet() {
    const container = document.getElementById('setContenuto');
    if (!container) return;

    const def = CATALOGO_WIDGET.set_completamento;
    let dati;
    try {
        dati = def.preview().dati;
    } catch (e) {
        console.error('renderPaginaSet:', e);
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Errore nel caricamento.</p>';
        return;
    }

    const voci = (dati && dati.voci) || [];
    if (voci.length === 0) {
        container.innerHTML = `
            <div class="page-header">
                <span class="page-title">Set</span>
            </div>
            <p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:2rem 0;">Nessuna espansione trovata.</p>
        `;
        return;
    }

    const totale = voci.length;
    const inLibreria = dati.inLibreria || 0;
    const riconosciute = dati.riconosciute || 0;
    const prima = voci[0];

    const righe = voci.map(v => {
        const haBarra = v.totale && v.perc != null;
        const testa = haBarra
            ? `<b>${escapeHtml(v.nome)}</b><span>${v.hai}/${v.totale} · ${Math.round(v.perc)}%</span>`
            : `<b>${escapeHtml(v.nome)}</b><span>${v.hai} cart${v.hai === 1 ? 'a' : 'e'}</span>`;
        const barra = haBarra
            ? `<div class="pg-barra-track"><div class="pg-barra-fill" style="width:${v.perc}%"></div></div>`
            : '<span style="font-size:0.7rem; color:var(--text-muted);">Avanzamento non disponibile — libreria set da compilare</span>';
        return `<div class="pg-riga-set"><div class="pg-riga-set-testa">${testa}</div>${barra}</div>`;
    }).join('');

    container.innerHTML = `
        <div class="page-header">
            <span class="page-title">Set</span>
        </div>
        <div class="pg-pagina">
            <div class="pg-intro">
                <div class="pg-grande">${totale}</div>
                <div class="pg-sotto">${prima.totale && prima.perc != null ? `${prima.nome}: ${Math.round(prima.perc)}% completo` : `${prima.nome} in testa`}</div>
            </div>
            <div class="pg-stat">
                <div><b>${totale}</b><span>Espansioni</span></div>
                <div><b>${inLibreria}</b><span>In libreria</span></div>
                <div><b>${riconosciute}</b><span>Carte riconosciute</span></div>
            </div>
            <div class="pg-elenco">${righe}</div>
        </div>
    `;
}


// RISTRUTTURATO 2026-09-10 (Claudio: "quella schermata nera non la voglio
// vedere MAI, in nessun momento — click sul widget e basta, direttamente
// alla pagina giusta"). Il tentativo precedente apriva l'overlay SUBITO
// con una pokéball "di caricamento": quella pokéball non si vedeva (causa
// non ancora trovata: niente errori JS con la console filtrata su
// "bustina", l'overlay ha dimensioni reali — il problema era probabilmente
// solo nella schermata di caricamento stessa) — ma indipendentemente dalla
// causa, Claudio non vuole PROPRIO quello step, nemmeno se lo sistemassi.
// Nuovo flusso: nessun overlay costruito né aperto finché i dati veri
// (login + bustine_stato()) non sono pronti. Il click sul widget avvia
// comunque SUBITO l'animazione del container (gestita da
// apriDettaglioWidget, non toccata qui) — è quel tempo morto (Claudio:
// "poco più di un secondo") a coprire la rete, non uno schermo dedicato.
// Se la rete fosse più lenta dell'animazione, per un istante si vede
// semplicemente lo sfondo neutro del sito (mai nero apposta) prima che
// l'overlay appaia già con la schermata corretta — un solo salto, non due.
async function renderPaginaBustina() {
    const container = document.getElementById('bustinaContenuto');
    if (container) container.innerHTML = '';

    const userId = await authGetUserId();
    if (!userId) {
        if (container) container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Accedi per aprire le bustine.</p>';
        return;
    }

    try {
        const { data, error } = await bustinaStatoLeggi();
        if (error) throw error;
        _bustinaCostruisciOverlay();
        _bustinaCountdownFerma();
        _bustinaRisultatoCorrente = null;
        const overlay = document.getElementById('bustinaCutsceneOverlay');
        overlay.classList.add('aperto');
        _bustinaRicalcolaScale();
        _bustinaMostraStatoOverlay(data); // decide countdown vs pokéball pronta, MAI uno stato intermedio
    } catch (e) {
        console.error('renderPaginaBustina:', e);
        if (container) container.innerHTML = '<p style="text-align:center; color:var(--danger); font-size:0.85rem; padding:1rem 0;">Errore nel caricamento dello stato.</p>';
    }
}

// Aggiorna l'overlay GIÀ APERTO con lo stato reale (countdown o pokéball
// pronta) — MAI dedotto/tenuto in cache da prima: l'utente può aver
// aperto bustine da un altro dispositivo. Riusata anche dal countdown
// quando scatta il rinnovo (_bustinaCountdownTick), invece di duplicare
// la logica in due punti.
function _bustinaMostraStatoOverlay(stato) {
    _bustinaCountdownFerma(); // eventuale countdown di una lettura precedente

    const puoAprire = stato.giornaliera_disponibile || stato.saldo_guadagnate > 0;
    if (puoAprire) {
        _bustinaMostraSchermata('bustinaLoaderScreen');
        const wrapEl = document.getElementById('bustinaPokeballWrap');
        wrapEl.classList.remove('scuote');
        wrapEl.classList.add('pronto');
        _bustinaOverlayPronto = true;
        document.getElementById('bustinaPreloadText').innerText = '';
        _bustinaFrase().then(f => {
            // Solo se l'utente non ha già tappato la pokéball nel
            // frattempo (in tal caso il testo appartiene già alla fase di
            // caricamento vera, non va sovrascritto).
            if (_bustinaOverlayPronto) document.getElementById('bustinaPreloadText').innerText = f;
        });
    } else {
        _bustinaMostraSchermata('bustinaCountdownScreen');
        _bustinaOverlayPronto = false;
        document.getElementById('bustinaCdTotali').innerText = stato.aperte_totali;
        document.getElementById('bustinaCdGiorn').innerText = stato.aperte_giornaliere;
        document.getElementById('bustinaCdGuad').innerText = stato.aperte_guadagnate;
        document.getElementById('bustinaCdSaldo').innerText = stato.saldo_guadagnate;
        document.getElementById('bustinaCountdownFrase').innerText = '';
        _bustinaFraseCountdown().then(f => { document.getElementById('bustinaCountdownFrase').innerText = f; });
        _bustinaCountdownAvvia();
    }
}

// ═══════════════════════════════════════════════════════════════════════
// ESPERIENZA APERTURA BUSTINA — cutscene + taglio busta laser + swipe
// (2026-09-09). Porta FEDELE del prototipo sbusto-main.zip (decisione
// esplicita di Claudio: "tieni tutto ciò che c'è nel prototipo, è una
// bozza fedele e precisa"), con questi adattamenti obbligati:
//   - sorteggio carte NON portato: già lato server da settimane (RPC
//     apri_bustina) — qui si usa SEMPRE risultato.carte, mai Math.random()
//   - RPC prima di tutto (vedi nota sopra in _bustinaPaginaApri)
//   - CSS/markup scopati sotto #bustinaCutsceneOverlay (mai selettori
//     nudi, vedi Roadmap_Widget_Bustina_2026-09-07.md)
//   - tutte le funzioni/variabili con prefisso _bustina* per non collidere
//     con altri script a livello di file (script classici, no moduli)
//   - i 6 listener globali del prototipo (mousedown/move/up, touchstart/
//     move/end) sono scopati sull'elemento overlay stesso (mai document):
//     equivalente perché l'overlay è fixed+inset:0+z-index altissimo,
//     copre l'intero schermo quando aperto, nulla fuori da esso è
//     raggiungibile comunque
//   - suoni condizionati a prefSuoniWidgetGet() (il toggle globale
//     dell'home, non esisteva nel prototipo — richiesto dalla roadmap)
//   - riepilogo finale SENZA colonna "Qtà totale posseduta": richiederebbe
//     l'album (bustinaAlbumQuery), esplicitamente rimandato da Claudio e
//     da non toccare finché non lo richiede lui — mostra solo Nome/
//     Rarità/Esito, non un conteggio
//   - nessuna scrittura DB dal client: la RPC ha già salvato tutto PRIMA
//     che l'overlay si aprisse — qui si legge/mostra soltanto
//   - "personaggioprincipale" (hero) sempre come scritto nel json
//     dall'admin (asset 'fallback'): la sostituzione con la skin scelta
//     dall'utente è rimandata (profiles.skin_personaggio non esiste
//     ancora, decisione di Claudio 2026-09-09)
// ═══════════════════════════════════════════════════════════════════════

// ── stato del motore (a livello di file, prefissato) ────────────────────
let _bustinaAudioCtx = null;
let _bustinaOverlayCostruito = false;
let _bustinaOverlayPronto = false;      // true quando loader+cutscene sono pronti (pokeball cliccabile)
let _bustinaRisultatoCorrente = null;   // risultato RPC tenuto in memoria per tutta l'esperienza
let _bustinaCutsceneData = null;
let _bustinaCutsceneTimer = null;
let _bustinaCutsceneTime = 0;
let _bustinaDialogoAttivo = false;
let _bustinaEventiScattati = new Set();
let _bustinaLaserDisegno = false;
let _bustinaLaserPunti = [];
let _bustinaBustaTagliata = false;
let _bustinaDragCarta = null;
let _bustinaDragStartY = 0;
let _bustinaCarteSwipate = 0;
let _bustinaLaserStartPoint = { x: 0, y: 0 };
let _bustinaNomeUtenteCorrente = 'Allenatore'; // sovrascritto in _bustinaClickPokeball, vedi sotto
const RARITA_CSS_BUSTINA = { 'comuni': 'comune', 'non comuni': 'non-comune', 'rare': 'rara', 'ultra rare': 'ultra-rara', 'leggendarie': 'leggendaria' };
// Fattore di scala UNICO applicato a #bustinaScreenWrapper intero (non più
// solo a #bustinaCutsceneViewport) — vedi _bustinaRicalcolaScale. Serve
// anche a laser/drag per tradurre le coordinate "sullo schermo reale" in
// coordinate del canvas 480×270 non scalato (vedi _bustinaLaserStart/Move).
let _bustinaScale = 1;
// Countdown "nessuna bustina disponibile" — timer separato da quello della
// cutscene, ripulito da _bustinaCountdownFerma() ad ogni apertura/chiusura
// dell'overlay per non lasciarne mai due attivi insieme.
let _bustinaCountdownTimer = null;

// ── audio (porta fedele: file veri per laser/swipe, sintesi Web Audio
//    come fallback — IDENTICI al prototipo, solo col toggle in testa) ───
function _bustinaInitAudio() {
    if (!_bustinaAudioCtx) _bustinaAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_bustinaAudioCtx.state === 'suspended') _bustinaAudioCtx.resume();
}

function _bustinaSuono(tipo) {
    if (!prefSuoniWidgetGet()) return; // toggle globale suoni home — non esisteva nel prototipo, richiesto dalla roadmap
    _bustinaInitAudio();

    if (tipo === 'laser' || tipo === 'swipe') {
        const nomeFile = tipo === 'laser' ? 'strappare.mp3' : 'swush.mp3';
        const { data } = bustinaSfxUrl(nomeFile);
        const url = data?.publicUrl;
        if (url) {
            const audio = new Audio(url);
            audio.crossOrigin = 'anonymous';
            try {
                const source = _bustinaAudioCtx.createMediaElementSource(audio);
                const gainNode = _bustinaAudioCtx.createGain();
                gainNode.gain.value = 2.5;
                source.connect(gainNode);
                gainNode.connect(_bustinaAudioCtx.destination);
                audio.play().catch(() => { _bustinaSuonoFallback(tipo); });
                return;
            } catch (e) {
                audio.volume = 1.0;
                audio.play().catch(() => { _bustinaSuonoFallback(tipo); });
                return;
            }
        }
    }
    _bustinaSuonoFallback(tipo);
}

function _bustinaSuonoFallback(tipo) {
    try {
        const now = _bustinaAudioCtx.currentTime;
        const masterGain = _bustinaAudioCtx.createGain();
        masterGain.gain.setValueAtTime(1.5, now);
        masterGain.connect(_bustinaAudioCtx.destination);

        if (tipo === 'laser') {
            const bufferSize = _bustinaAudioCtx.sampleRate * 0.3;
            const buffer = _bustinaAudioCtx.createBuffer(1, bufferSize, _bustinaAudioCtx.sampleRate);
            const dati = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) dati[i] = Math.random() * 2 - 1;
            const noise = _bustinaAudioCtx.createBufferSource();
            noise.buffer = buffer;
            const filtro = _bustinaAudioCtx.createBiquadFilter();
            filtro.type = 'bandpass';
            filtro.frequency.setValueAtTime(1000, now);
            filtro.frequency.exponentialRampToValueAtTime(300, now + 0.3);
            const gain = _bustinaAudioCtx.createGain();
            gain.gain.setValueAtTime(0.8, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            noise.connect(filtro); filtro.connect(gain); gain.connect(masterGain);
            noise.start(now);
        } else if (tipo === 'swipe') {
            const osc = _bustinaAudioCtx.createOscillator();
            const gain = _bustinaAudioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(120, now + 0.2);
            gain.gain.setValueAtTime(0.7, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.connect(gain); gain.connect(masterGain);
            osc.start(now); osc.stop(now + 0.2);
        } else if (tipo === 'gb_boot') {
            const osc = _bustinaAudioCtx.createOscillator();
            const gain = _bustinaAudioCtx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(587.33, now);
            osc.frequency.setValueAtTime(880.00, now + 0.08);
            gain.gain.setValueAtTime(0.6, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
            osc.connect(gain); gain.connect(masterGain);
            osc.start(now); osc.stop(now + 0.6);
        }
    } catch (e) { /* niente suono, nessun errore visibile — stesso comportamento del prototipo */ }
}

// ── frase di caricamento (stessa logica: seed sulla data, stesso array
//    di fallback del prototipo, invariato su richiesta di Claudio) ──────
async function _bustinaFrase() {
    const fallback = [
        'Catturando Snorlax...', 'Cercando il Pokéflauto...', 'Gettando via la Pietrastante...',
        'Consultando il Pokédex...', 'Svegliando uno Snorlax assonnato...', 'Lucidando le Medaglie...',
        'Ricaricando il Repellente...'
    ];
    try {
        const { data } = bustinaQuotesUrl();
        const res = await fetch(`${data.publicUrl}?t=${Date.now()}`);
        if (res.ok) {
            const frasi = await res.json();
            if (Array.isArray(frasi) && frasi.length > 0) {
                const oggi = new Date().toISOString().slice(0, 10);
                let seed = 0;
                for (let i = 0; i < oggi.length; i++) seed = (seed * 31 + oggi.charCodeAt(i)) % 10000000;
                return frasi[seed % frasi.length];
            }
        }
    } catch (e) { /* fallback sotto */ }
    return fallback[Math.floor(Math.random() * fallback.length)];
}

// Seed numerico sulla data odierna (stesso algoritmo di _bustinaFrase,
// estratto qui per non duplicarlo nella variante countdown sotto).
function _bustinaSeedOggi() {
    const oggi = new Date().toISOString().slice(0, 10);
    let seed = 0;
    for (let i = 0; i < oggi.length; i++) seed = (seed * 31 + oggi.charCodeAt(i)) % 10000000;
    return seed;
}

// ── frase per la schermata "nessuna bustina disponibile" (2026-09-10) ──
// Stessa logica di stabilità di _bustinaFrase (seed sulla data → stessa
// frase per tutto il giorno, decisione di Claudio "fisse come
// bustinaFrase"), ma file/array separati: sono frasi di ATTESA, non di
// caricamento. NIENTE segnaposto tipo [tempo] nel json — il countdown vero
// (HH:MM:SS) è un elemento a parte già in pagina, la frase è solo
// atmosfera (decisione esplicita di Claudio, 2026-09-10).
async function _bustinaFraseCountdown() {
    const fallback = [
        'Snorlax sta ancora dormendo di traverso sul sentiero.',
        'Il Professor Oak è uscito a catturare qualche Pikachu.',
        'Le Pokéball sono in carica al Centro Pokémon.',
        'La Joy locale sta ancora controllando lo scorsoio.',
        'Team Rocket ha smarrito di nuovo la chiave del magazzino.',
        'Bill sta sistemando il suo PC di archiviazione.',
        'Un Voltorb dorme sopra il distributore di bustine.',
    ];
    try {
        const { data } = bustinaCountdownQuotesUrl();
        const res = await fetch(`${data.publicUrl}?t=${Date.now()}`);
        if (res.ok) {
            const frasi = await res.json();
            if (Array.isArray(frasi) && frasi.length > 0) return frasi[_bustinaSeedOggi() % frasi.length];
        }
    } catch (e) { /* fallback sotto */ }
    return fallback[_bustinaSeedOggi() % fallback.length];
}

// ── countdown dal vivo fino al prossimo rinnovo (mezzanotte Europe/Rome,
//    confermato dal corpo reale di bustine_stato() in produzione — la
//    funzione ragiona in quel fuso, non in UTC, non in quello del
//    browser). Un tick al secondo, robusto ai cambi ora legale perché
//    ricalcola la lettura wall-clock ad ogni tick invece di sommare
//    millisecondi a un timestamp fisso. ─────────────────────────────────
function _bustinaMsAlRinnovo() {
    const ora = new Date();
    const parti = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).formatToParts(ora).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
    const secondiOggi = (parseInt(parti.hour, 10) % 24) * 3600 + parseInt(parti.minute, 10) * 60 + parseInt(parti.second, 10);
    return (86400 - secondiOggi) * 1000 - ora.getMilliseconds();
}

function _bustinaFormattaCountdown(ms) {
    const totSec = Math.max(0, Math.floor(ms / 1000));
    const h = String(Math.floor(totSec / 3600)).padStart(2, '0');
    const m = String(Math.floor((totSec % 3600) / 60)).padStart(2, '0');
    const s = String(totSec % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
}

function _bustinaCountdownTick() {
    const el = document.getElementById('bustinaCountdownTimer');
    if (!el) return;
    const ms = _bustinaMsAlRinnovo();
    el.innerText = _bustinaFormattaCountdown(ms);
    // Rinnovo scattato mentre l'utente guarda la schermata: non
    // indoviniamo un nuovo stato, si rilegge bustine_stato() per davvero
    // (il countdown potrebbe anche azzerarsi qualche secondo prima/dopo
    // per via di piccoli scarti di clock lato client, meglio verificare).
    if (ms <= 500) {
        _bustinaCountdownFerma();
        bustinaStatoLeggi().then(({ data, error }) => { if (!error) _bustinaMostraStatoOverlay(data); });
    }
}

function _bustinaCountdownAvvia() {
    _bustinaCountdownFerma();
    _bustinaCountdownTick();
    _bustinaCountdownTimer = setInterval(_bustinaCountdownTick, 1000);
}

function _bustinaCountdownFerma() {
    if (_bustinaCountdownTimer) { clearInterval(_bustinaCountdownTimer); _bustinaCountdownTimer = null; }
}

// ── costruzione overlay (idempotente: markup creato una sola volta,
//    listener scopati attaccati una sola volta) ─────────────────────────
function _bustinaCostruisciOverlay() {
    if (_bustinaOverlayCostruito) return;
    const root = document.getElementById('bustinaCutsceneOverlay');
    if (!root) return;

    root.innerHTML = `
        <div id="bustinaGbFrame">
            <div id="bustinaCloseBtn" onclick="_bustinaChiudiOverlay()"><i class="fa-solid fa-xmark"></i></div>
            <div id="bustinaScreenWrapper">

                <!-- Bustina/e disponibili: pokéball pronta al tap. Niente
                     RPC ancora — parte solo al click (vedi
                     _bustinaClickPokeball più sotto: ordine deciso da
                     Claudio 2026-09-10, opzione B). _bustinaMostraStatoOverlay
                     la mostra già in stato 'pronto' quando c'è qualcosa da
                     aprire; la classe 'scuote' torna utile solo DOPO il
                     tap, mentre RPC+cutscene caricano davvero. -->
                <div id="bustinaLoaderScreen" class="bs-screen attiva">
                    <div class="bs-pokeball-wrap scuote" id="bustinaPokeballWrap">
                        <div class="bs-pokeball" id="bustinaPokeball">
                            <div class="bs-pokeball-centro"><div class="bs-pokeball-centro-inner"></div></div>
                        </div>
                        <div id="bustinaPreloadText"></div>
                    </div>
                </div>

                <!-- Nessuna bustina disponibile: countdown al prossimo
                     rinnovo (mezzanotte Europe/Rome — confermato dal corpo
                     REALE di bustine_stato() in produzione, 2026-09-10:
                     v_oggi := (now() AT TIME ZONE 'Europe/Rome')::date,
                     non UTC) + le 4 statistiche che prima stavano nella
                     vecchia pagina pg-* (ora rimossa). -->
                <div id="bustinaCountdownScreen" class="bs-screen">
                    <div class="bs-countdown-icona"><i class="fa-solid fa-clock"></i></div>
                    <div class="bs-countdown-frase" id="bustinaCountdownFrase"></div>
                    <div class="bs-countdown-timer" id="bustinaCountdownTimer">--:--:--</div>
                    <div class="bs-countdown-sotto">alla prossima bustina giornaliera</div>
                    <div class="bs-countdown-stats">
                        <div><b id="bustinaCdTotali">0</b><span>Totali</span></div>
                        <div><b id="bustinaCdGiorn">0</b><span>Giorn.</span></div>
                        <div><b id="bustinaCdGuad">0</b><span>Guad.</span></div>
                        <div><b id="bustinaCdSaldo">0</b><span>Saldo</span></div>
                    </div>
                </div>

                <div id="bustinaCutsceneScreen" class="bs-screen">
                    <div id="bustinaCutsceneViewport">
                        <div id="bustinaCutsceneBg" style="position:absolute; width:480px; height:270px; background-size:cover; background-position:center; z-index:1;"></div>
                        <div id="bustinaSpritesLayer" style="position:absolute; width:480px; height:270px; z-index:2; pointer-events:none;"></div>
                        <div class="bs-stat-box">
                            <div>GIORNO: <span id="bustinaValGiorno">1</span>/30 | MESI: <span id="bustinaValMesi">0</span></div>
                            <div>POLVERE: <span id="bustinaValPolvere">0</span></div>
                        </div>
                        <div class="bs-dialogue-box" id="bustinaDialogueBox">
                            <div class="bs-speaker-name" id="bustinaSpeakerName"></div>
                            <div class="bs-dialogue-text" id="bustinaDialogueText"></div>
                            <div class="bs-dialogue-hint">[TOCCA PER AVANZARE]</div>
                        </div>
                    </div>
                    <audio id="bustinaGbMusic" loop></audio>
                </div>

                <div id="bustinaPackScreen" class="bs-screen">
                    <div class="bs-sparkles" id="bustinaSparkles"></div>
                    <div id="bustinaBoosterContainer">
                        <div style="font-size:0.4rem; margin-bottom:8px; color:#ffd700;">TRACCIA IL FULMINE SULLA BUSTA (90%)!</div>
                        <div style="position:relative;">
                            <canvas id="bustinaLaserCanvas"></canvas>
                            <div class="bs-booster-pack" id="bustinaBoosterPack">
                                <div class="bs-booster-shine"></div>
                                <div class="bs-booster-top">CARDSYNC</div>
                                <div class="bs-booster-bottom">
                                    <img src="favicon.ico" class="bs-booster-logo" alt="Logo">
                                </div>
                            </div>
                        </div>
                    </div>
                    <div id="bustinaCardsArea" style="display:none; flex-direction:column; align-items:center; width:100%; z-index:4;">
                        <div style="font-size:0.4rem; margin-bottom:4px; color:#ffd700;">SOLLEVA VERSO L'ALTO (SWIPE UP)</div>
                        <div class="bs-card-container" id="bustinaCardsStack"></div>
                    </div>
                    <div id="bustinaSummaryScreen" style="display:none;">
                        <div class="bs-summary-titolo">HAI APERTO LA BUSTINA</div>
                        <table class="bs-summary-table">
                            <thead><tr><th>Nome</th><th>Rarità</th><th>Esito</th></tr></thead>
                            <tbody id="bustinaSummaryBody"></tbody>
                        </table>
                        <button onclick="_bustinaChiudiOverlay()" style="width:100%;">CONTINUA</button>
                    </div>
                </div>

            </div>
        </div>
    `;

    // Listener scopati SULL'OVERLAY (mai su document — vedi nota di testa):
    // equivalenti ai 6 globali del prototipo perché l'overlay copre tutto
    // lo schermo quando aperto (fixed, inset:0, z-index altissimo).
    root.addEventListener('mousedown', _bustinaLaserStart);
    root.addEventListener('mousemove', _bustinaLaserMove);
    root.addEventListener('mouseup', _bustinaLaserEnd);
    root.addEventListener('touchstart', _bustinaLaserStart, { passive: false });
    root.addEventListener('touchmove', _bustinaLaserMove, { passive: false });
    root.addEventListener('touchend', _bustinaLaserEnd);

    document.getElementById('bustinaPokeballWrap').addEventListener('click', _bustinaClickPokeball);
    document.getElementById('bustinaCutsceneScreen').addEventListener('click', _bustinaClickCutscene);
    window.addEventListener('resize', _bustinaRicalcolaScale);
    window.addEventListener('orientationchange', _bustinaRicalcolaScale);

    _bustinaOverlayCostruito = true;
}

function _bustinaMostraSchermata(id) {
    document.querySelectorAll('#bustinaCutsceneOverlay .bs-screen').forEach(s => s.classList.remove('attiva'));
    const target = document.getElementById(id);
    if (target) target.classList.add('attiva');
}

// Un solo fattore di scala per TUTTA l'esperienza (countdown, pokéball,
// cutscene, laser, swipe, riepilogo): #bustinaScreenWrapper è un canvas
// fisso 480×270 (vedi index.html), qui lo si riduce/ingrandisce in blocco
// per riempire lo spazio disponibile dentro #bustinaGbFrame.
// RIVISTO 2026-09-10 (Claudio: "cornice pokedex" — tutto ciò che il sito
// mostra deve starci dentro, non a tutta la finestra del browser):
// l'overlay stesso viene ora agganciato al rettangolo REALE di
// #phoneScreen tramite _rettangoloSchermoCornice() (stessa funzione usata
// da _posizionaContainerNelloSchermo per .container, unica fonte di
// verità) invece di riempire l'intero viewport con "inset:0". Resta
// position:fixed (non absolute) apposta: .container ha un padding
// (calc(2.6rem + safe-area) 1rem 1rem) che sposterebbe verso l'interno
// un discendente position:absolute — da fixed l'overlay è un fratello di
// .container nello stesso contesto di stacking di radice, ignora quel
// padding e combacia esattamente col rettangolo schermo, bordo a bordo.
// _bustinaScale resta calcolato sullo spazio DISPONIBILE dentro quel
// rettangolo (non più tutta la finestra) — richiesta esplicita e non
// negoziabile di Claudio: la pagina resta "calcolata" a 480×270 e viene
// solo zoomata, mai ricalcolata per la dimensione reale. _bustinaScale è
// riusato anche da laser/drag per tradurre le coordinate del tocco in
// coordinate del canvas 480×270 non scalato — vedi _bustinaLaserStart/Move.
function _bustinaRicalcolaScale() {
    const overlay = document.getElementById('bustinaCutsceneOverlay');
    if (!overlay || !overlay.classList.contains('aperto')) return;

    const r = _rettangoloSchermoCornice();
    if (r) {
        overlay.style.top = r.top + 'px';
        overlay.style.left = r.left + 'px';
        overlay.style.width = r.width + 'px';
        overlay.style.height = r.height + 'px';
        overlay.style.borderRadius = r.borderRadius;
    }

    const frame = document.getElementById('bustinaGbFrame');
    const wrapper = document.getElementById('bustinaScreenWrapper');
    if (!frame || !wrapper) return;
    _bustinaScale = Math.max(0.01, Math.min(frame.clientWidth / 480, frame.clientHeight / 270));
    wrapper.style.transform = `scale(${_bustinaScale})`;
}

// ── tap sulla pokéball: la RPC parte SOLO ORA ───────────────────────────
// Ordine deciso da Claudio 2026-09-10 (opzione B — cambia la decisione
// del 09/09 che faceva partire apri_bustina() subito al tap sul widget):
// finché la pokéball non viene toccata, NESSUNA bustina è consumata. Da
// qui in poi il comportamento è identico a prima: RPC → cutscene/mese →
// nome utente, tutto in parallelo con un tempo minimo di "carica", poi
// l'animazione di apertura della pokéball e la cutscene vera.
async function _bustinaClickPokeball() {
    if (!_bustinaOverlayPronto) return;
    _bustinaOverlayPronto = false;
    _bustinaSuono('laser');

    const wrapEl = document.getElementById('bustinaPokeballWrap');
    const textEl = document.getElementById('bustinaPreloadText');
    wrapEl.classList.remove('pronto');
    wrapEl.classList.add('scuote');
    textEl.innerText = await _bustinaFrase();

    const timerMinimo = new Promise(resolve => setTimeout(resolve, 1500));

    // RPC vera — la bustina è consumata da qui in poi. Se fallisce (es.
    // rinnovo appena scattato/consumata da un altro dispositivo nel
    // frattempo) si mostra il messaggio della RPC as-is e si torna alla
    // schermata corretta rileggendo lo stato reale, MAI si prosegue con
    // dati inventati.
    let risultato = null;
    let erroreApertura = null;
    const apertura = (async () => {
        try {
            const { data, error } = await bustinaApri();
            if (error) throw error;
            risultato = data;
        } catch (e) {
            erroreApertura = e;
        }
    })();

    // Nome utente reale (stessa fonte di #profiloMenuNome): sessione →
    // email → _nomeDaEmail() (ui/auth.ui.js). Se per qualunque motivo la
    // sessione non risponde, resta il fallback 'Allenatore' già impostato.
    const nomeUtente = (async () => {
        try {
            const sessione = await authGetSession();
            if (sessione?.user?.email) _bustinaNomeUtenteCorrente = _nomeDaEmail(sessione.user.email);
        } catch (e) { /* resta 'Allenatore' */ }
    })();

    // Attende PRIMA il risultato della RPC (il calcolo del mese dipende
    // da risultato.mesi_completati: non si può partire prima).
    await apertura;

    if (erroreApertura) {
        await timerMinimo;
        wrapEl.classList.remove('scuote');
        // .innerText, non .innerHTML: nessun escaping manuale necessario.
        textEl.innerText = erroreApertura.message || 'Errore durante l\'apertura.';
        // Ririlegge lo stato vero (niente saldo "inventato") e ridisegna
        // la schermata giusta dopo una breve pausa, per lasciare leggere
        // il messaggio.
        setTimeout(async () => {
            const { data, error } = await bustinaStatoLeggi();
            if (!error) _bustinaMostraStatoOverlay(data);
        }, 1800);
        return;
    }

    _bustinaRisultatoCorrente = risultato;

    const caricamento = (async () => {
        // Mese da usare: mesi_completati+1, clampato all'ultimo mese
        // REALMENTE presente nel bucket (decisione di Claudio: se manca
        // la cartella del mese "in corso", restare sull'ultimo esistente).
        let mese = (risultato.mesi_completati || 0) + 1;
        try {
            const { data: cartelle, error } = await bustinaCutsceneMesiDisponibili();
            if (!error && Array.isArray(cartelle) && cartelle.length > 0) {
                const numeri = cartelle
                    .map(c => { const m = /^mese(\d+)$/.exec(c.name); return m ? parseInt(m[1], 10) : null; })
                    .filter(n => n !== null);
                if (numeri.length > 0) {
                    const meseMassimo = Math.max(...numeri);
                    if (mese > meseMassimo) mese = meseMassimo;
                }
            }
        } catch (e) { /* mese resta quello calcolato, nessun clamp possibile */ }

        const giorno = risultato.cutscene_giorno;
        try {
            const { data } = bustinaCutsceneUrl(mese, giorno);
            const res = await fetch(`${data.publicUrl}?t=${Date.now()}`);
            _bustinaCutsceneData = res.ok ? await res.json() : null;
        } catch (e) { _bustinaCutsceneData = null; }

        if (!_bustinaCutsceneData) {
            // Fallback identico nello spirito al prototipo: nessun asset,
            // un solo dialogo di benvenuto.
            _bustinaCutsceneData = {
                background: '', music: '',
                actors: [],
                events: [{ id: 1, type: 'dialogue', speaker: 'CARDSYNC', text: 'Hai aperto una nuova bustina!', start: 0, duration: 3 }]
            };
        }
    })();

    await Promise.all([caricamento, timerMinimo, nomeUtente]);

    // Ora sì: l'animazione "a scoppio" della pokéball, poi la cutscene.
    const pokeballEl = document.getElementById('bustinaPokeball');
    wrapEl.classList.remove('scuote');
    textEl.innerText = '';
    pokeballEl.classList.add('apertura');

    setTimeout(() => {
        pokeballEl.classList.remove('apertura');
        _bustinaMostraSchermata('bustinaCutsceneScreen');
        const r = _bustinaRisultatoCorrente;
        document.getElementById('bustinaValGiorno').innerText = r.cutscene_giorno;
        document.getElementById('bustinaValMesi').innerText = r.mesi_completati;
        document.getElementById('bustinaValPolvere').innerText = r.polvere_totale || 0;
        _bustinaAvviaCutscenePlayback();
    }, 600);
}

// ── motore cutscene (porta fedele di startCutscenePlayback) ─────────────
function _bustinaAvviaCutscenePlayback() {
    const bgEl = document.getElementById('bustinaCutsceneBg');
    const audioEl = document.getElementById('bustinaGbMusic');
    const spritesLayer = document.getElementById('bustinaSpritesLayer');
    const cd = _bustinaCutsceneData;

    spritesLayer.innerHTML = '';
    _bustinaEventiScattati.clear();
    _bustinaCutsceneTime = 0;
    _bustinaDialogoAttivo = false;

    if (cd.background) {
        const { data } = bustinaAssetUrl(cd.background);
        bgEl.style.backgroundImage = `url('${data.publicUrl}')`;
    } else {
        bgEl.style.backgroundImage = '';
    }

    if (cd.music && prefSuoniWidgetGet()) {
        const { data } = bustinaAssetUrl(cd.music);
        audioEl.src = data.publicUrl;
        audioEl.play().catch(() => {});
    } else {
        audioEl.pause();
        audioEl.removeAttribute('src');
    }

    const meta = cd.meta || {};
    const baseWidth = meta.stageBaseWidth || 480;
    const baseHeight = meta.stageBaseHeight || 270;
    const spriteSize = meta.spriteBaseSize || 48;
    const scalaGlobale = (cd.spriteScalePercentage !== undefined) ? (cd.spriteScalePercentage / 100) : 1.0;

    const elementiAttori = {};
    const posizioniCorrenti = {};

    (cd.actors || []).forEach(actor => {
        const img = document.createElement('img');
        img.className = 'bs-actor-sprite';
        // asset vuoto (2026-09-09, deciso con Claudio):
        //   1) se actor.type è presente → sprite/{type}/fallback/standing.png
        //      (campo 'type' = nome cartella 1:1, es. "personaggioprincipale",
        //      "companion", "png" — l'admin scrive già il valore corretto
        //      nel tool di creazione cutscene, nessuna traduzione qui)
        //   2) direzione: SEMPRE 'standing' — lo sprite non cambia con la
        //      direzione di movimento (rimandato, Claudio ha rinunciato nel
        //      prototipo; un eventuale campo "direzione" nel json, se mai
        //      comparirà, va ignorato per ora)
        //   3) se manca anche actor.type → favicon.ico del sito (nessuna
        //      categoria nota, non si può indovinare la cartella)
        let assetUrl;
        if (actor.asset) {
            assetUrl = actor.asset.startsWith('http') ? actor.asset : bustinaAssetUrl(actor.asset).data.publicUrl;
        } else if (actor.type) {
            assetUrl = bustinaAssetUrl(`sprite/${actor.type}/fallback/standing.png`).data.publicUrl;
        } else {
            assetUrl = 'favicon.ico';
        }
        img.src = assetUrl;

        let startX = 100, startY = 100;
        if (actor.pos && Array.isArray(actor.pos)) {
            startX = actor.pos[0]; startY = actor.pos[1];
        } else if (actor.posPercentage && Array.isArray(actor.posPercentage)) {
            startX = (actor.posPercentage[0] / 100) * baseWidth;
            startY = (actor.posPercentage[1] / 100) * baseHeight;
        }
        posizioniCorrenti[actor.id] = { x: startX, y: startY };

        img.style.left = `${startX}px`;
        img.style.top = `${startY}px`;
        img.style.width = `${spriteSize * scalaGlobale}px`;
        img.style.height = `${spriteSize * scalaGlobale}px`;

        spritesLayer.appendChild(img);
        elementiAttori[actor.id] = img;
    });

    let maxEventEnd = 10.0;
    if (typeof cd.duration === 'number' && !isNaN(cd.duration)) {
        maxEventEnd = cd.duration;
    } else if (Array.isArray(cd.events) && cd.events.length > 0) {
        cd.events.forEach(ev => { const fine = (ev.start || 0) + (ev.duration || 0); if (fine > maxEventEnd) maxEventEnd = fine; });
    }

    if (_bustinaCutsceneTimer) clearInterval(_bustinaCutsceneTimer);

    _bustinaCutsceneTimer = setInterval(() => {
        if (_bustinaDialogoAttivo) return;

        (cd.events || []).forEach(ev => {
            if (ev.type === 'move') {
                const elapsed = _bustinaCutsceneTime - ev.start;
                if (elapsed >= 0 && elapsed <= ev.duration) {
                    const progress = Math.min(elapsed / ev.duration, 1.0);
                    const chiaveAttore = Object.keys(elementiAttori).find(k =>
                        k.toLowerCase() === String(ev.actor).toLowerCase() ||
                        (cd.actors && cd.actors.find(a => a.id === k && a.name && a.name.toLowerCase() === String(ev.actor).toLowerCase()))
                    );
                    if (chiaveAttore) {
                        const posDefault = posizioniCorrenti[chiaveAttore] || { x: 100, y: 100 };
                        let daCoord = [posDefault.x, posDefault.y];
                        if (ev.from && Array.isArray(ev.from)) daCoord = ev.from;
                        else if (ev.fromPercentage && Array.isArray(ev.fromPercentage)) daCoord = [(ev.fromPercentage[0] / 100) * baseWidth, (ev.fromPercentage[1] / 100) * baseHeight];

                        let aCoord = [posDefault.x + 50, posDefault.y];
                        if (ev.to && Array.isArray(ev.to)) aCoord = ev.to;
                        else if (ev.toPercentage && Array.isArray(ev.toPercentage)) aCoord = [(ev.toPercentage[0] / 100) * baseWidth, (ev.toPercentage[1] / 100) * baseHeight];

                        const currentX = daCoord[0] + (aCoord[0] - daCoord[0]) * progress;
                        const currentY = daCoord[1] + (aCoord[1] - daCoord[1]) * progress;
                        posizioniCorrenti[chiaveAttore] = { x: currentX, y: currentY };
                        const el = elementiAttori[chiaveAttore];
                        if (el) { el.style.left = `${currentX}px`; el.style.top = `${currentY}px`; }
                    }
                }
            }

            if (!_bustinaEventiScattati.has(ev.id) && _bustinaCutsceneTime >= ev.start) {
                if (ev.type === 'dialogue') {
                    _bustinaEventiScattati.add(ev.id);
                    _bustinaDialogoAttivo = true;
                    const speakerEl = document.getElementById('bustinaSpeakerName');
                    const boxEl = document.getElementById('bustinaDialogueBox');
                    const textEl = document.getElementById('bustinaDialogueText');

                    if (ev.speaker && ev.speaker.toLowerCase() === 'narratore') {
                        speakerEl.style.display = 'none';
                        textEl.style.fontStyle = 'italic';
                        textEl.style.textAlign = 'center';
                    } else {
                        speakerEl.style.display = 'block';
                        speakerEl.innerText = ev.speaker;
                        textEl.style.fontStyle = 'normal';
                        textEl.style.textAlign = 'left';
                    }
                    // Placeholder [nome] → nome utente reale, stessa fonte
                    // già usata dal sito per #profiloMenuNome: sessione →
                    // email → _nomeDaEmail() (funzione già esistente in
                    // ui/auth.ui.js, es. "irene@cardsyncpro.local" →
                    // "Irene") — nessuna colonna profiles inventata.
                    // Risolto una volta in _bustinaClickPokeball, prima
                    // che la cutscene parta, e tenuto in
                    // _bustinaNomeUtenteCorrente per tutta l'esperienza.
                    textEl.innerText = ev.text.replace(/\[nome\]/g, _bustinaNomeUtenteCorrente);
                    boxEl.style.display = 'block';
                }
            }
        });

        _bustinaCutsceneTime += 0.05;
        if (_bustinaCutsceneTime >= maxEventEnd) {
            clearInterval(_bustinaCutsceneTimer);
            document.getElementById('bustinaGbMusic').pause();
            _bustinaVaiAPack();
        }
    }, 50);
}

function _bustinaClickCutscene() {
    if (_bustinaDialogoAttivo) {
        document.getElementById('bustinaDialogueBox').style.display = 'none';
        _bustinaDialogoAttivo = false;
    }
}

// ── taglio busta (laser) + rivelazione carte REALI (mai sorteggiate qui) ─
function _bustinaVaiAPack() {
    _bustinaMostraSchermata('bustinaPackScreen');
    document.getElementById('bustinaBoosterContainer').style.display = 'flex';
    document.getElementById('bustinaCardsArea').style.display = 'none';
    document.getElementById('bustinaSummaryScreen').style.display = 'none';

    const pack = document.getElementById('bustinaBoosterPack');
    pack.classList.remove('sliced-open');
    _bustinaBustaTagliata = false;
    setTimeout(_bustinaSetupLaserCanvas, 50);

    const container = document.getElementById('bustinaCardsStack');
    container.innerHTML = '';
    _bustinaCarteSwipate = 0;

    const carte = _bustinaRisultatoCorrente.carte;
    carte.forEach((carta, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'bs-card-wrapper';
        wrapper.style.zIndex = 4 - index;

        const dupHTML = carta.doppione ? `<div class="bs-duplicate-tag">DOPPIONE</div>` : '';
        const rarityCss = RARITA_CSS_BUSTINA[carta.rarita] || 'comune';

        const { data: img } = bustinaImmagineUrl(carta.rarita, carta.nome_file);
        const { data: imgFallback } = bustinaImmagineUrl(carta.rarita, 'fallback');
        const urlImg = img?.publicUrl || '';
        const urlFallback = imgFallback?.publicUrl || '';

        wrapper.innerHTML = `
            <div class="bs-pokemon-card ${rarityCss} bs-card-glow-reveal">
                <div class="bs-card-inner-frame">
                    <div class="bs-title-container">
                        <span style="font-size:0.4rem; color:#ffd700;">${escapeHtml(carta.nome)}</span>
                    </div>
                    <div class="bs-card-image-box">
                        <img src="${urlImg}" alt="${escapeHtml(carta.nome)}" onerror="this.onerror=null; this.src='${urlFallback}';">
                    </div>
                    <div class="bs-card-description-box">
                        <span id="bustinaCardDesc${index}" class="bs-card-description-text">"${escapeHtml(carta.rarita)}"</span>
                    </div>
                </div>
                ${dupHTML}
            </div>
        `;
        container.appendChild(wrapper);

        // Testo carta reale se il bucket bustina-testi risponde — stesso
        // fallback "silenzioso" già usato dal vecchio _bustinaMostraRisultato.
        (async () => {
            try {
                const { data: txt } = bustinaTestoUrl(carta.rarita, carta.nome_file);
                const res = await fetch(txt.publicUrl);
                if (res.ok) {
                    const testo = (await res.text()).trim();
                    const descEl = document.getElementById(`bustinaCardDesc${index}`);
                    if (descEl && testo) descEl.innerText = `"${testo}"`;
                }
            } catch (e) { /* resta il testo di fallback già mostrato */ }
        })();
    });
}

function _bustinaSetupLaserCanvas() {
    const canvas = document.getElementById('bustinaLaserCanvas');
    const pack = document.getElementById('bustinaBoosterPack');
    if (canvas && pack) { canvas.width = pack.offsetWidth; canvas.height = pack.offsetHeight; }
}

function _bustinaLaserStart(e) {
    if (!document.getElementById('bustinaCutsceneOverlay').classList.contains('aperto')) return;
    _bustinaInitAudio();
    const pack = document.getElementById('bustinaBoosterPack');
    const cardTarget = e.target.closest && e.target.closest('.bs-card-wrapper');

    if (cardTarget && !cardTarget.classList.contains('bs-card-swipata')) {
        _bustinaDragCarta = cardTarget;
        _bustinaDragCarta.classList.add('trascinamento');
        _bustinaDragCarta.classList.remove('ritorno');
        _bustinaDragStartY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
        return;
    }

    if (!pack) return;
    const rect = pack.getBoundingClientRect();
    const clientX = e.clientX || (e.touches ? e.touches[0].clientX : null);
    const clientY = e.clientY || (e.touches ? e.touches[0].clientY : null);

    if (clientX !== null && clientY !== null && clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom && !_bustinaBustaTagliata) {
        _bustinaLaserDisegno = true;
        // rect (getBoundingClientRect) è in pixel REALI a schermo, già
        // scalati dal transform su #bustinaScreenWrapper. Il canvas invece
        // ha risoluzione = offsetWidth/offsetHeight di .bs-booster-pack,
        // cioè le dimensioni AUTORATE in CSS (non scalate). Per disegnare
        // nel posto giusto va quindi convertito: coordinate-schermo /
        // _bustinaScale = coordinate-canvas. La soglia di taglio (sotto)
        // resta invece in coordinate-schermo, non va convertita: misura
        // quanto ha viaggiato il dito sul vetro, indipendente dallo zoom.
        const startX = clientX - rect.left, startY = clientY - rect.top;
        _bustinaLaserPunti = [{ x: startX / _bustinaScale, y: startY / _bustinaScale }];
        _bustinaLaserStartPoint = { x: startX, y: startY };
        _bustinaSuono('laser');
    }
}

function _bustinaLaserMove(e) {
    if (e.cancelable && (_bustinaLaserDisegno || _bustinaDragCarta)) e.preventDefault();

    if (_bustinaLaserDisegno && !_bustinaBustaTagliata) {
        const pack = document.getElementById('bustinaBoosterPack');
        if (!pack) return;
        const rect = pack.getBoundingClientRect();
        const clientX = e.clientX || (e.touches ? e.touches[0].clientX : null);
        const clientY = e.clientY || (e.touches ? e.touches[0].clientY : null);
        if (clientX === null || clientY === null) return;

        const localX = clientX - rect.left, localY = clientY - rect.top;
        _bustinaLaserPunti.push({ x: localX / _bustinaScale, y: localY / _bustinaScale });
        _bustinaDisegnaLaser();

        const distX = Math.abs(localX - _bustinaLaserStartPoint.x);
        const distY = Math.abs(localY - _bustinaLaserStartPoint.y);
        if (distX >= rect.width * 0.9 || distY >= rect.height * 0.9) {
            _bustinaBustaTagliata = true;
            _bustinaLaserDisegno = false;
            pack.classList.add('sliced-open');
            _bustinaSuono('laser');
            setTimeout(() => {
                document.getElementById('bustinaBoosterContainer').style.display = 'none';
                document.getElementById('bustinaCardsArea').style.display = 'flex';
                _bustinaPuliscCanvas();
            }, 700);
        }
    } else if (_bustinaDragCarta) {
        const clientY = e.clientY || (e.touches ? e.touches[0].clientY : null);
        if (clientY !== null) {
            let dy = clientY - _bustinaDragStartY;
            if (dy > 0) dy = 0;
            // dy è un delta in pixel REALI (quanto si è mosso il dito):
            // la traslazione va invece espressa in coordinate-canvas
            // (dominio 480×270, poi scalato dall'ancestor) perché la
            // carta segua il dito 1:1 a qualunque livello di zoom —
            // altrimenti a schermo piccolo la carta si muoverebbe meno
            // del dito. La rotazione resta su dy "reale": è un effetto
            // visivo, non deve seguire pixel per pixel.
            _bustinaDragCarta.style.transform = `translateY(${dy / _bustinaScale}px) rotate(${dy / 40}deg)`;
        }
    }
}

function _bustinaLaserEnd(e) {
    if (_bustinaLaserDisegno) { _bustinaLaserDisegno = false; _bustinaPuliscCanvas(); }
    if (_bustinaDragCarta) {
        _bustinaDragCarta.classList.remove('trascinamento');
        const clientY = (e.changedTouches ? e.changedTouches[0].clientY : e.clientY) || 0;
        const dy = clientY - _bustinaDragStartY;
        if (dy < -80) {
            _bustinaDragCarta.style.transform = '';
            _bustinaSwipeCarta(_bustinaDragCarta);
        } else {
            _bustinaDragCarta.classList.add('ritorno');
            _bustinaDragCarta.style.transform = 'translateY(0px) rotate(0deg)';
        }
        _bustinaDragCarta = null;
    }
}

function _bustinaDisegnaLaser() {
    const canvas = document.getElementById('bustinaLaserCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (_bustinaLaserPunti.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(_bustinaLaserPunti[0].x, _bustinaLaserPunti[0].y);
    for (let i = 1; i < _bustinaLaserPunti.length; i++) {
        const p = _bustinaLaserPunti[i];
        ctx.lineTo(p.x + (Math.random() * 8 - 4), p.y + (Math.random() * 8 - 4));
    }
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.shadowColor = '#00ffff'; ctx.shadowBlur = 20;
    ctx.stroke();
    ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 2;
    ctx.stroke();
}

function _bustinaPuliscCanvas() {
    const canvas = document.getElementById('bustinaLaserCanvas');
    if (!canvas) return;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    _bustinaLaserPunti = [];
}

function _bustinaSwipeCarta(wrapper) {
    if (wrapper.classList.contains('bs-card-swipata')) return;
    _bustinaSuono('swipe');
    wrapper.classList.add('bs-card-swipata');
    _bustinaCarteSwipate++;
    if (_bustinaCarteSwipate === 4) {
        setTimeout(() => {
            document.getElementById('bustinaCardsArea').style.display = 'none';
            _bustinaMostraRiepilogo();
        }, 600);
    }
}

// ── riepilogo finale (dati reali, senza colonna Qtà — vedi nota di testa) ─
function _bustinaMostraRiepilogo() {
    const tbody = document.getElementById('bustinaSummaryBody');
    tbody.innerHTML = '';
    _bustinaRisultatoCorrente.carte.forEach(carta => {
        const nota = carta.doppione ? `+${carta.polvere} Polvere` : 'Nuova!';
        const colore = carta.doppione ? '#8b0000' : '#2e8b57';
        tbody.innerHTML += `
            <tr>
                <td>${escapeHtml(carta.nome)}</td>
                <td>${escapeHtml(carta.rarita)}</td>
                <td style="color:${colore}; font-weight:bold;">${nota}</td>
            </tr>`;
    });
    document.getElementById('bustinaSummaryScreen').style.display = 'block';
}

// ── chiusura: pulizia stato, torna alla home come qualunque altro widget ─
// RISTRUTTURATO 2026-09-10: non esiste più una "pagina bustina" dietro
// l'overlay da ridisegnare (era _bustinaAggiornaStato, rimossa insieme
// alla vecchia pagina pg-*) — l'overlay ORA È l'intera esperienza del
// widget. Chiudere l'overlay deve quindi chiudere il widget stesso: si
// riusa chiudiDettaglioWidget() (navigation.ui.js/phone.ui.js, la stessa
// funzione del tasto fisico/freccia indietro per tutti gli altri widget),
// così l'animazione di chiusura, il ripristino di #btnFisicoTelefono e il
// ridisegno della home restano IDENTICI al resto del sito — zero
// duplicazione, zero rischio di whitelist/stato disallineati.
function _bustinaChiudiOverlay() {
    const overlay = document.getElementById('bustinaCutsceneOverlay');
    if (overlay) overlay.classList.remove('aperto');
    if (_bustinaCutsceneTimer) { clearInterval(_bustinaCutsceneTimer); _bustinaCutsceneTimer = null; }
    _bustinaCountdownFerma();
    const musica = document.getElementById('bustinaGbMusic');
    if (musica) { musica.pause(); musica.removeAttribute('src'); }
    _bustinaDialogoAttivo = false;
    _bustinaLaserDisegno = false;
    _bustinaDragCarta = null;
    _bustinaOverlayPronto = false;
    chiudiDettaglioWidget();
}

// ── PAGINA "CONDIVIDI" ────────────────────────────────────────────────
// Elenca tutto il condivisibile reale: ogni binder pubblico (Scambio,
// Wishlist, altre location, extra) più Sealed, che non è un binder — vive
// nel suo currentMode a parte in navigation.ui.js. Click su una riga →
// pannello con link/QR/condivisione nativa per QUELLA cosa, sostituendo
// la vecchia scelta arbitraria "solo Scambio".
async function renderPaginaCondividi() {
    const container = document.getElementById('condividiLista');
    if (!container) return;
    container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Caricamento…</p>';
    document.getElementById('condividiPannelloShare').style.display = 'none';

    // apriWidgetBinders() è la stessa funzione già riusata altrove (vedi
    // home.ui.js) per garantire _bindersElenco senza dover navigare via —
    // qui restiamo sulla pagina Condividi, non su Binders.
    if (!Array.isArray(_bindersElenco) || _bindersElenco.length === 0) {
        try { await apriWidgetBinders(); } catch (e) { console.error('renderPaginaCondividi: caricamento binder:', e); }
    }

    const pubblici = (Array.isArray(_bindersElenco) ? _bindersElenco : [])
        .filter(b => b.stato_pubblicazione === 'pubblico');

    const iconaPerTipo = { wishlist: 'fa-heart', location: 'fa-layer-group', extra: 'fa-box-archive' };
    const righeBinder = pubblici.map(b => `
        <div class="pg-riga" data-tocca onclick="_condividiElementoWidget('binder-pubblico.html', '${b.id}', '${b.tipo}', event)">
            <div class="pg-fig" style="display:flex; align-items:center; justify-content:center;"><i class="fa-solid ${iconaPerTipo[b.tipo] || 'fa-layer-group'}"></i></div>
            <div class="pg-testo"><b>${escapeHtml(b.nome || b.location_valore || b.tipo)}</b></div>
            <i class="fa-solid fa-share-nodes" style="color:var(--text-muted);"></i>
        </div>`).join('');

    // Sealed non è un binder (verificato: nessuna riga con tipo='sealed'
    // nello schema — vive in un currentMode a parte), quindi riga fissa,
    // nessun binderId da passare.
    const rigaSealed = `
        <div class="pg-riga" data-tocca onclick="_condividiElementoWidget('sealed.html', null, null, event)">
            <div class="pg-fig" style="display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-box"></i></div>
            <div class="pg-testo"><b>Sealed</b></div>
            <i class="fa-solid fa-share-nodes" style="color:var(--text-muted);"></i>
        </div>`;

    container.innerHTML = `<div class="pg-elenco">${righeBinder + rigaSealed}</div>`;
}

// Stessa identica logica di costruzione URL di _linkPubblicoCondivisione
// (navigation.ui.js) — duplicata qui apposta invece di refactorizzare
// quella funzione: lei legge lo stato globale di navigazione (currentMode/
// _binderAttivo, "il binder che hai aperto ORA"), qui invece serve il
// link per un binder scelto da una lista, senza navigarci dentro. File
// diverso, stesso comportamento — Regola d'Oro #1 (duplicazione locale
// invece di refactoring cross-file).
async function _linkCondivisioneWidget(pagina, binderId, tipoBinder) {
    const sessione = await authGetSession();
    const userId = sessione?.user?.id;
    if (!userId) return null;
    const url = new URL(pagina + '?u=' + encodeURIComponent(userId), window.location.href);
    if (binderId) url.searchParams.set('binder', binderId);
    const temaSalvato = prefSiteThemeGet();
    if (temaSalvato) url.searchParams.set('tema', temaSalvato);
    if (prefDarkModeGet()) url.searchParams.set('scuro', '1');
    if (tipoBinder === 'wishlist' && sessione?.user?.email) {
        url.searchParams.set('nome', _nomeDaEmail(sessione.user.email));
    }
    return url.href;
}

let _condividiLinkCorrente = null;

async function _condividiElementoWidget(pagina, binderId, tipoBinder, evt) {
    if (evt) evt.stopPropagation();
    const link = await _linkCondivisioneWidget(pagina, binderId, tipoBinder);
    if (!link) { alert('Devi essere loggato per condividere.'); return; }
    _condividiLinkCorrente = link;

    document.getElementById('condividiLinkInput').value = link;
    const qrContainer = document.getElementById('condividiQrContainer');
    qrContainer.innerHTML = '';
    new QRCode(qrContainer, { text: link, width: 160, height: 160, colorDark: '#2a2438', colorLight: '#ffffff' });

    // Missione #29 "QR Hunter" (2026-08-30). Fire-and-forget, stesso
    // pattern degli altri hook missioni — un fallimento qui non deve mai
    // bloccare la generazione del QR, già avvenuta sopra.
    (async () => {
        try {
            const userId = await authGetUserId();
            if (userId) await missioniQrGeneratoRegistra(userId);
        } catch (e) { console.error('[missioni] registrazione QR generato:', e); }
    })();

    // Stesso criterio di navigation.ui.js: il pulsante nativo compare solo
    // dove il browser lo supporta davvero, niente pulsante rotto altrove.
    document.getElementById('condividiBtnNativo').style.display = navigator.share ? 'block' : 'none';
    document.getElementById('condividiPannelloShare').style.display = 'block';
}

async function _copiaLinkCondividiWidget() {
    if (!_condividiLinkCorrente) return;
    try {
        await navigator.clipboard.writeText(_condividiLinkCorrente);
        alert('Link copiato negli appunti!');
    } catch (e) {
        prompt('Copia questo link:', _condividiLinkCorrente);
    }
}

async function _condividiNativoWidget() {
    if (!_condividiLinkCorrente) return;
    try { await navigator.share({ title: 'CardSync Pro', url: _condividiLinkCorrente }); }
    catch (e) { /* utente ha annullato, o browser l'ha bloccata — normale, nessun errore da mostrare */ }
}

// [SEZIONE SPOSTATA in ui/paginainiziale.ui.js — STEP 0 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]
