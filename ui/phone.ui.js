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
// rimosso — la Home ora è la pagina principale del telefono (swipe per
// arrivare ai widget, non più il contrario), non ha più senso aprirla
// come un dettaglio da un widget. Vedi #phoneHomePage in index.html e
// initPhoneShell qui sotto per lo spostamento del nodo #home.
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

const CATALOGO_WIDGET = {
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
    // NON portati dal mockup, e perché: bustina, polvere, fortuna, missioni
    // e traguardi-a-punti appartengono a un'economia di gioco (aprire
    // pacchetti, guadagnare valuta) che in CardSync non esiste. "Set
    // completo" richiederebbe di sapere quante carte compone ogni set:
    // dato non presente nello schema, e non lo deduco dal codice.

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
    bustina: {
        titolo: 'Bustina', icona: 'fa-gift', bloccato: true,
        preview: () => ({ righe: ['In arrivo'], dati: { placeholder: true, testo: 'Aprirai le bustine da qui' } }),
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
};

const ORDINE_WIDGET_DEFAULT = ['visualizzazione', 'inserimento', 'prezzi', 'binder', 'sealed'];
// TEMPORANEO (Claudio, 2026-08-28): nessun limite, per poter provare tutti
// i widget del catalogo insieme in home. Da RIPRISTINARE a 10 quando finito
// — è l'unica riga da cambiare, usata solo qui sotto e in _mostraWidget().
const MAX_WIDGET_VISIBILI = Infinity;
// TAGLIE_CICLO — SUPERATO dalla griglia a 6 colonne (2026-09-03). Resta
// SOLO come elenco delle 4 taglie del vecchio modello a 2 colonne: serve a
// _migraTagliaWidget() per riconoscere un layout salvato prima del cambio.
// Non usarlo più come whitelist delle taglie ammesse: oggi sono libere.
const TAGLIE_CICLO = ['1x1', '2x1', '1x2', '2x2'];

// ── GRIGLIA WIDGET: 6 COLONNE (Claudio, 2026-09-03) ─────────────────────
// "Massima personalizzazione possibile e immaginabile": icone piccolissime
// E widget che riempiono la pagina. Entrambe erano impossibili non per un
// limite del codice ma perche' la griglia aveva 2 colonne — con 2 colonne
// una cella e' mezzo schermo, quindi un'icona non puo' essere piccola e un
// widget non puo' essere largo 6.
//
// PERCHE' 6 E NON DI PIU': sotto i ~44px un bersaglio non e' piu' toccabile
// con affidabilita'. Su uno schermo telefono 6 colonne danno ~55px (sopra
// soglia); 8 ne darebbero ~40 (sotto). "Il minimo" ha un pavimento fisico
// ed e' piu' o meno qui.
const COLONNE_GRIGLIA_WIDGET = 6;

// Tetto di sicurezza all'altezza. Il limite VERO e' l'altezza della pagina
// ed e' calcolato dal vivo in _onResizeHandlePointerDown (maxRowSpan): un
// widget non puo' crescere oltre lo schermo che lo contiene. Questo qui
// serve solo a impedire che un layout salvato corrotto produca un widget
// alto 400 righe.
const RIGHE_MAX_WIDGET = 24;

// Soglia sotto la quale la tessera diventa ICONA STATICA (niente sfera,
// niente animazione, solo icona + numerino di notifica).
// Claudio: "non saranno piu' widget con animazione ma icone statiche con
// numerino di notifica".
// NOTA: questa soglia risolve un conflitto con una decisione precedente
// dello stesso Claudio, incisa nel CSS: "la ball non deve MAI
// rimpicciolire" (--ball-misura fissa a 90px). In una cella da 55px una
// sfera da 90px non ci sta. Le due regole convivono cosi': sotto la soglia
// la sfera non c'e' proprio, sopra la soglia e' quella di sempre, intatta.
// Non abbassare questa soglia senza rendere la sfera elastica.
const CELLE_MIN_PER_SFERA = 3;

// Versione del formato di _layoutWidget salvato in cardsyncWidgetLayout.
// 1 (implicita, nessun campo 'v') = modello a 2 colonne.
// 2 = modello a 6 colonne. Vedi _migraTagliaWidget().
const VERSIONE_LAYOUT_WIDGET = 2;

// FORMA della tessera, per il CSS interno della sfera. Il vecchio modello
// aveva 4 taglie fisse e il CSS ci aveva scritto sopra ~25 regole
// (dimensioni di font, righe da nascondere, altezza degli sparkline). Con
// le taglie libere quelle regole sarebbero morte: qui le 4 forme
// sopravvivono come SOGLIE, cosi' il CSS e' stato solo rinominato e non
// riscritto — e le taglie intermedie che prima non potevano esistere
// (4x2, 5x3...) ricadono nella forma piu' vicina invece di restare nude.
//   wf-piccolo = ex 1x1   wf-largo  = ex 2x1
//   wf-alto    = ex 1x2   wf-grande = ex 2x2
function _formaWidget(col, row) {
    const largo = col >= 5;
    const alto = row >= 3;
    if (largo && alto) return 'wf-grande';
    if (largo) return 'wf-largo';
    if (alto) return 'wf-alto';
    return 'wf-piccolo';
}

// Spezza 'CxR' nei due numeri, con difesa contro valori corrotti.
function _leggiTaglia(size) {
    const m = /^(\d+)x(\d+)$/.exec(String(size || ''));
    if (!m) return { col: 3, row: 2 }; // = il vecchio 1x1, default sensato
    const col = Math.max(1, Math.min(COLONNE_GRIGLIA_WIDGET, parseInt(m[1], 10)));
    const row = Math.max(1, Math.min(RIGHE_MAX_WIDGET, parseInt(m[2], 10)));
    return { col, row };
}

// MIGRAZIONE DEI LAYOUT SALVATI — la parte delicata del cambio.
// Nel vecchio modello '2x1' voleva dire "tutta la larghezza"; a 6 colonne
// vorrebbe dire "un terzo". Senza questa conversione, alla prima apertura
// la home di tutti e cinque i membri del gruppo risulterebbe scombinata.
//
// I fattori NON sono scelti a caso: sono quelli che rendono la migrazione
// INVISIBILE. Colonne x3 (2 -> 6). Righe x2, perche' la riga passa da
// 108px a 48px + 11.2px di gap = 107.2px ogni due. Tenendo il gap
// identico (0.7rem), la larghezza di 3 nuove colonne e' W/2 - 0.5*gap,
// esattamente la stessa del vecchio 1x1. Ogni widget esistente resta
// quindi della stessa identica dimensione in pixel: cambia solo cio' che
// da oggi in poi si PUO' fare, non cio' che si vede al primo avvio.
//
//   vecchio 1x1 -> 3x2      vecchio 1x2 -> 3x4
//   vecchio 2x1 -> 6x2      vecchio 2x2 -> 6x4
function _migraTagliaWidget(size) {
    const m = /^(\d+)x(\d+)$/.exec(String(size || ''));
    if (!m) return '3x2';
    const col = Math.max(1, Math.min(2, parseInt(m[1], 10))) * 3;
    const row = Math.max(1, Math.min(2, parseInt(m[2], 10))) * 2;
    return col + 'x' + row;
}

// ── PAGINE MULTIPLE DELLA HOME (Claudio, 2026-09-03) ────────────────────
// Ogni riga di _layoutWidget porta un campo 'pagina' (0 = prima pagina).
// Il numero di pagine NON e' uno stato salvato: e' dedotto ogni volta dal
// massimo 'pagina' fra i widget visibili. Cosi' non esiste il caso di una
// pagina "che esiste ma non contiene niente" da dover ripulire: svuoti
// l'ultima pagina e sparisce da se'.
//
// PERCHE' NESSUN GESTORE DI SWIPE SCRITTO A MANO. Sulla stessa superficie
// convivono tre gesti: lo scatto verticale fra home fissa e pagina widget
// (scroll-snap gia' esistente), il trascinamento dei widget, e ora lo
// scorrimento orizzontale fra pagine. Gli ASSI sono pero' diversi:
// scroll-snap-type y sul contenitore esterno, x su quello interno, e il
// browser li tiene separati da solo. Un gestore di pointer scritto a mano
// avrebbe dovuto arbitrare fra i tre — ed e' esattamente il terreno dei
// bug di pointercancel gia' incontrati in questo progetto. L'unico
// intervento necessario e' touch-action:none sulle tessere in modifica
// (in index.html), perche' li' il trascinamento deve vincere sullo
// scorrimento.
let _paginaWidgetCorrente = 0;

// Quante pagine esistono davvero. In modifica se ne mostra SEMPRE una in
// piu', vuota: e' li' che si spinge un widget per creare una pagina nuova,
// senza bisogno di un pulsante "aggiungi pagina" e senza stato da salvare.
function _numeroPagineWidget() {
    const visibili = (_layoutWidget || []).filter(w => w.visibile);
    const maxPagina = visibili.reduce((m, w) => Math.max(m, w.pagina || 0), 0);
    return maxPagina + 1 + (_editModeWidget ? 1 : 0);
}

// Sposta un widget alla pagina precedente/successiva. Unico modo previsto
// per cambiare pagina a un widget: il trascinamento fino al bordo dello
// schermo per "passare di la'" e' molto piu' fragile su touch (va
// arbitrato con lo scorrimento orizzontale, e su dito grosso parte da
// solo), mentre due frecce funzionano al primo colpo. Si potra' aggiungere
// il trascinamento in seguito SOPRA questo, non al suo posto.
function _spostaWidgetInPagina(instanceId, delta) {
    const w = (_layoutWidget || []).find(x => x.instanceId === instanceId);
    if (!w) return;
    const nuova = Math.max(0, (w.pagina || 0) + delta);
    if (nuova === (w.pagina || 0)) return;
    w.pagina = nuova;
    _salvaLayoutWidget();
    _paginaWidgetCorrente = nuova;
    renderWidgetHome();
}

// Riordino DENTRO la pagina: scambia con il widget visibile precedente/
// successivo della STESSA pagina. Il vecchio _spostaWidget lavorava su
// indici dell'intero elenco visibile e, con le pagine, avrebbe fatto
// saltare un widget da una pagina all'altra come effetto collaterale
// invisibile.
function _spostaWidgetNellaPagina(instanceId, direzione) {
    if (!_layoutWidget) return;
    const w = _layoutWidget.find(x => x.instanceId === instanceId);
    if (!w) return;
    const pagina = w.pagina || 0;
    const compagni = _layoutWidget.filter(x => x.visibile && (x.pagina || 0) === pagina);
    const pos = compagni.indexOf(w);
    const altro = compagni[pos + direzione];
    if (!altro) return;
    const iA = _layoutWidget.indexOf(w);
    const iB = _layoutWidget.indexOf(altro);
    _layoutWidget[iA] = altro;
    _layoutWidget[iB] = w;
    _salvaLayoutWidget();
    renderWidgetHome();
}

// Scorre alla pagina indicata (puntini in basso, o ritorno dopo un
// re-render). 'istantaneo' serve durante il ridimensionamento, che
// ridisegna a ogni movimento del dito: li' un'animazione morbida
// produrrebbe uno sfarfallio continuo.
function _vaiAllaPaginaWidget(indice, istantaneo) {
    const cont = document.getElementById('phoneWidgetPagine');
    if (!cont) return;
    const max = _numeroPagineWidget() - 1;
    _paginaWidgetCorrente = Math.max(0, Math.min(max, indice));
    cont.scrollTo({ left: _paginaWidgetCorrente * cont.clientWidth, behavior: istantaneo ? 'auto' : 'smooth' });
    _aggiornaPuntiniPagine();
}

function _gestisciScrollPaginePagineWidget() {
    const cont = document.getElementById('phoneWidgetPagine');
    if (!cont) return;
    const indice = Math.round(cont.scrollLeft / Math.max(cont.clientWidth, 1));
    if (indice === _paginaWidgetCorrente) return;
    _paginaWidgetCorrente = indice;
    _aggiornaPuntiniPagine();
}

function _aggiornaPuntiniPagine() {
    document.querySelectorAll('#phoneWidgetPuntini .widget-puntino').forEach((el, i) => {
        el.classList.toggle('attivo', i === _paginaWidgetCorrente);
    });
}

let _layoutWidget = null; // [{id, visibile, size, pagina}], ordine = ordine di visualizzazione
let _editModeWidget = false;
let _densitaCompatta = false;
let _pollingWidgetInterval = null;
let _pollingWidgetIntervalLento = null;
let _resizeCorniceTimeout = null;
let _cartaDelGiornoId = null;
let _primoRenderWidgetFatto = false; // per la cascata d'ingresso, una sola volta per sessione

// Identificatore univoco di RIGA in _layoutWidget — non l'id di catalogo:
// da quando "Vetrina" può avere più copie con lo stesso id ('ultima_carta'),
// serve una chiave che distingua ciascuna copia. Usato in data-widget-id
// al posto di w.id per drag/resize/nascondi — vedi renderWidgetHome.
function _nuovoInstanceId() {
    return 'w_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// ── LAYOUT: caricamento/salvataggio per-dispositivo ──────────────────────
function _caricaLayoutWidget() {
    let salvato = null;
    try { salvato = JSON.parse(prefWidgetLayoutGet() || 'null'); } catch (_) { salvato = null; }

    if (!Array.isArray(salvato) || salvato.length === 0) {
        // '3x2' = il vecchio '1x1' nella griglia a 6 colonne: mezza
        // larghezza, stessa altezza di prima. Primo avvio identico a com'era.
        _layoutWidget = ORDINE_WIDGET_DEFAULT.map(id => ({ id, instanceId: _nuovoInstanceId(), visibile: true, size: '3x2', mini: false, cartaId: null, pagina: 0, v: VERSIONE_LAYOUT_WIDGET }));
        return;
    }
    let generatoQualcheId = false;
    let migratoQualcosa = false;
    const validi = salvato
        .filter(w => CATALOGO_WIDGET[w.id])
        .map(w => {
            if (!w.instanceId) generatoQualcheId = true; // layout salvato PRIMA di questa sessione: assegna una volta, si salva sotto
            // Riga scritta col modello a 2 colonne (nessun campo 'v'):
            // converti una volta sola. Il campo 'v' scritto qui sotto
            // impedisce che la conversione venga rifatta al prossimo avvio
            // — rifarla moltiplicherebbe di nuovo e sfonderebbe la griglia.
            let size;
            if (w.v === VERSIONE_LAYOUT_WIDGET) {
                const t = _leggiTaglia(w.size);
                size = t.col + 'x' + t.row;
            } else {
                migratoQualcosa = true;
                size = _migraTagliaWidget(w.size);
            }
            return {
                id: w.id,
                instanceId: w.instanceId || _nuovoInstanceId(),
                visibile: !!w.visibile,
                size: size,
                mini: !!w.mini,
                cartaId: w.cartaId != null ? w.cartaId : null,
                // Layout salvato prima delle pagine: tutto sulla prima.
                pagina: Math.max(0, parseInt(w.pagina, 10) || 0),
                v: VERSIONE_LAYOUT_WIDGET,
            };
        });
    // Bootstrap a riga singola SOLO per i widget normali: le copie di un
    // widget multiIstanza (Vetrina) nascono esclusivamente dal picker
    // "Aggiungi", mai automaticamente — un id simile qui creerebbe una
    // copia vuota e invisibile che nessuno ha chiesto.
    Object.entries(CATALOGO_WIDGET).forEach(([id, def]) => {
        if (def.multiIstanza) return;
        if (!validi.find(w => w.id === id)) validi.push({ id, instanceId: _nuovoInstanceId(), visibile: false, size: '3x2', mini: false, cartaId: null, pagina: 0, v: VERSIONE_LAYOUT_WIDGET });
    });
    _layoutWidget = validi;
    // Persiste subito gli instanceId appena generati per un layout vecchio,
    // così al prossimo giro non li rigenera (restano stabili tra i render).
    if (generatoQualcheId || migratoQualcosa) _salvaLayoutWidget(false); // migrazione interna, non un'azione utente — vedi missioni m94/m95
}

// daAzioneUtente=false SOLO per la migrazione di un layout vecchio in
// _caricaLayoutWidget() (generazione instanceId stabili) — non è
// personalizzazione vera, non deve far scattare le missioni m94/m95.
// Tutti gli altri 7 chiamanti (sposta, nascondi, mostra, aggiungi istanza,
// seleziona carta Vetrina, resize, riordino drag) sono azioni reali
// dell'utente, default true.
function _salvaLayoutWidget(daAzioneUtente = true) {
    prefWidgetLayoutSet(JSON.stringify(_layoutWidget));
    if (daAzioneUtente) _missioneAggancioPersonalizzaLayout();
}

// Fire-and-forget: un fallimento qui non deve mai bloccare il salvataggio
// del layout, che è la parte importante di questa funzione. UNIQUE(owner_id,
// periodo, missione_id) in missioni_completate assorbe silenziosamente le
// chiamate ripetute nello stesso giorno (drag/resize possono chiamare
// _salvaLayoutWidget() molte volte) — solo il primo insert del giorno va a
// buon fine, gli altri falliscono con 23505 e va bene così.
async function _missioneAggancioPersonalizzaLayout() {
    try {
        const userId = await authGetUserId();
        if (!userId) return;
        const oggi = new Date().toISOString().slice(0, 10);
        await missioniInserisciCompletamento(userId, 'm94_personalizza', 'giornaliera', oggi);
        await missioniInserisciCompletamento(userId, 'm95_il_tuo_telefono', 'una_tantum', 'sempre');
    } catch (_) { /* silenzioso, vedi commento sopra */ }
}

// ── DENSITÀ (compatta/comoda) ─────────────────────────────────────────
function toggleDensitaWidgetHome() {
    _densitaCompatta = !_densitaCompatta;
    document.getElementById('phoneWidgetHomeWrap').classList.toggle('densita-compatta', _densitaCompatta);
}

// ── VIBRAZIONE (Claudio: drag & peek con feedback aptico) ────────────────
function _vibraSeSupportato(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) { /* niente, non è critico */ }
}

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
const _ballCORPI = {
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

        let blocco =
            '<div class="ball-barra-testo"><span>Aggiornati</span><span>' + aggiornati + '/' + totale + '</span></div>' +
            `<div class="ball-barra-out"><div class="ball-barra-in" style="width:${perc.toFixed(1)}%"></div></div>`;

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

// ── RENDER GRIGLIA HOME ──────────────────────────────────────────────────
async function renderWidgetHome() {
    if (!_layoutWidget) _caricaLayoutWidget();

    const cont = document.getElementById('phoneWidgetPagine');
    if (!cont) return;

    const visibili = _layoutWidget.filter(w => w.visibile);
    const primoRender = !_primoRenderWidgetFatto;

    // Raccolta locale, riversata in _ballAttenzioni a fine render: le
    // tessere si costruiscono in parallelo con Promise.all, scrivere
    // direttamente sulla globale lascerebbe residui dei widget rimossi.
    const attenzioni = {};

    const tessere = await Promise.all(visibili.map(async (w, indice) => {
        const def = CATALOGO_WIDGET[w.id];
        if (!def) return '';
        let anteprima = { righe: ['—'] };
        if (!def.bloccato) {
            try { anteprima = await def.preview(w); } catch (e) { console.error('Errore preview widget ' + w.id + ':', e); }
        } else {
            anteprima = def.preview(w);
        }

        const classeStato = anteprima.stato === 'allerta' ? 'widget-tile-allerta' : (anteprima.stato === 'ok' ? 'widget-tile-ok' : '');
        const classeCascata = primoRender ? 'widget-tile-entrata' : '';
        const stileRitardo = primoRender ? `style="animation-delay:${Math.min(indice * 45, 400)}ms"` : '';

        const controlliEdit = _editModeWidget ? `
            <div class="widget-edit-controls" onclick="event.stopPropagation()">
                <button type="button" onclick="_spostaWidgetNellaPagina('${w.instanceId}', -1)" title="Sposta su"><i class="fa-solid fa-arrow-up"></i></button>
                <button type="button" onclick="_spostaWidgetNellaPagina('${w.instanceId}', 1)" title="Sposta giù"><i class="fa-solid fa-arrow-down"></i></button>
                <button type="button" onclick="_spostaWidgetInPagina('${w.instanceId}', -1)" title="Pagina precedente" ${(w.pagina || 0) === 0 ? 'disabled' : ''}><i class="fa-solid fa-chevron-left"></i></button>
                <button type="button" onclick="_spostaWidgetInPagina('${w.instanceId}', 1)" title="Pagina successiva"><i class="fa-solid fa-chevron-right"></i></button>
                <button type="button" onclick="_nascondiWidget('${w.instanceId}')" title="Rimuovi dalla home" class="widget-edit-remove"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="widget-resize-handle" data-widget-id="${w.instanceId}" title="Trascina per ridimensionare"><i class="fa-solid fa-up-right-and-down-left-from-center"></i></div>` : '';

        // Badge Pokédex sul primo numero trovato in "righe".
        // CORREZIONE 27/08/2026: la regex era /\d+/ e su "1.284 carte
        // totali" si fermava al punto, mostrando "1" invece di "1.284" —
        // succedeva su qualunque conteggio a quattro cifre. Ora tiene
        // separatori di migliaia e decimali.
        // Il badge è anche disattivabile da Impostazioni: su una tessera
        // 1x1 ripete il dato già inciso nella pancia della ball.
        // 'badge' esplicito (oggi solo 'suggerimento': conta i segnali
        // attivi, non un numero già dentro il testo) ha la precedenza;
        // altrimenti resta il comportamento di sempre per tutti gli altri.
        const primoNumero = (anteprima.righe[0] || '').match(/\d[\d.,]*/);
        const valoreBadge = anteprima.badge != null ? anteprima.badge : (primoNumero ? primoNumero[0] : null);
        const badge = (valoreBadge != null && prefBadgeWidgetGet()) ? `<div class="widget-badge">${valoreBadge}</div>` : '';

        // Bordo colorato per rarità SOLO se la carta ha davvero un campo
        // 'rarita' valorizzato (mai confermato nello schema in questa
        // sessione — nessun rischio: se il campo non esiste, la classe
        // semplicemente non si applica e resta il bordo neutro di sempre).
        const classeRarita = anteprima.rarita ? ` widget-tile-thumb-r-${String(anteprima.rarita).toLowerCase().replace(/\s+/g, '_')}` : '';
        const rigaImmagine = anteprima.immagine
            ? `<div class="widget-tile-thumb-row"><img class="widget-tile-thumb${classeRarita}" src="${_urlImmagineVisualizzabile(anteprima.immagine, 96) || ''}" alt="" onerror="this.style.display='none';"></div>`
            : '';

        const azioneClick = _editModeWidget || def.decorativo ? '' : `onclick="_eseguiAzioneWidget('${w.instanceId}', event)"`;

        // ── VISUALE DELLA TESSERA ───────────────────────────────────────
        // Con BALL_ATTIVA la vecchia icona FontAwesome lascia il posto alla
        // sfera. Il ramo else qui sotto è il markup ORIGINALE, intatto:
        // rimettere BALL_ATTIVA a false in cima al file riporta tutto com'era.
        // I widget con immagine (Ultima carta, Carta del giorno) restano
        // senza ball e mostrano la carta, per scelta di Claudio.
        // Taglia e modalita' icona: DEVONO stare prima della visuale.
        // BUG 2026-09-03 (segnalato da Claudio con screenshot): erano
        // calcolate piu' sotto, quindi la sfera veniva costruita anche a
        // taglia minima — 90px dentro una cella da ~50px, con le sfere che
        // si sovrapponevano l'una sull'altra e l'incisione del titolo
        // ancora leggibile. Ora la modalita' icona esclude la sfera in
        // partenza.
        const _t = _leggiTaglia(w.size);
        const _iconaStatica = w.mini || _t.col < CELLE_MIN_PER_SFERA || _t.row < 2;

        let visuale;
        if (BALL_ATTIVA && !anteprima.immagine && !_iconaStatica) {
            const aspetto = _ballASPETTO[w.id] || { emblema: 'piu', colore: null };
            // L'incisione compare solo sulle 1x1: sulle altre taglie il
            // titolo per esteso sta fuori dalla ball, dove c'è spazio.
            let inciso = null;
            // Incisione solo sulla forma piccola (ex 1x1). Con le taglie
            // libere, confrontare w.size con la stringa '1x1' era diventato
            // sbagliato: '1x1' ora e' l'ICONA, dove non c'e' nemmeno la
            // sfera su cui incidere.
            if (_t.col <= 4 && _t.row <= 2 && prefScritteBallGet()) {
                const chiedeAttenzione = !!_ballChiedeAttenzione(w.id, anteprima);
                inciso = chiedeAttenzione
                    ? _ballAccorcia(anteprima.righe[0])
                    : (_ballTITOLI_BREVI[w.id] || def.titolo);
            }
            visuale = `
                <div class="pkdx-icon-wrap"><div class="pkdx-ball">
                    <span class="pkdx-ball-glow"></span>
                    <span class="pkdx-dust"></span>
                    <span class="ball-shadow"></span>
                    <span class="pkdx-avviso"><i class="a1">!</i><i class="a2">!</i><i class="a3">!</i></span>
                    <div class="pkdx-ball-body">${_ballSvgCache(aspetto.emblema, aspetto.colore, inciso)}</div>
                    <div class="ball-glass"><div class="ball-sweep"></div></div>
                    <span class="pkdx-lock-ring"></span>
                    <span class="pkdx-lock-ring ring-2"></span>
                    ${_ballParticelle()}
                </div></div>`;
        } else {
            visuale = `<i class="fa-solid ${def.icona} widget-tile-icon"></i>`;
        }

        // Chi ha bisogno di attenzione: letto qui, usato dal semaforo senza
        // rifare nessuna query (i preview sono già stati calcolati sopra).
        attenzioni[w.instanceId] = _ballChiedeAttenzione(w.id, anteprima);

        // ── CORPO DELLA TESSERA ─────────────────────────────────────────
        // 1x1 e mini: solo la sfera, col titolo inciso nella pancia.
        // Taglie grandi: due slot, uno accanto alla sfera e uno sotto (il
        // secondo solo dove c'è altezza, cioè 1x2 e 2x2 — vedi il CSS).
        // Con BALL_ATTIVA a false si torna al corpo originale del sito.
        // Sotto CELLE_MIN_PER_SFERA la tessera e' un'icona statica: niente
        // sfera, niente corpo ricco. Sopra, tutto come prima.
        const grande = BALL_ATTIVA && !_iconaStatica && !(_t.col === 3 && _t.row === 2);
        let corpo;
        if (grande) {
            const c = _ballCorpoWidget(w.id, anteprima);
            corpo = `
                <div class="ball-testa">
                    ${visuale}
                    <div class="ball-slot-inline">
                        <div class="widget-tile-titolo">${def.titolo}</div>
                        ${c.inline}
                    </div>
                </div>
                ${c.blocco ? `<div class="ball-slot-blocco">${c.blocco}</div>` : ''}
                ${rigaImmagine}`;
        } else {
            corpo = `
                ${visuale}
                <div class="widget-tile-titolo">${def.titolo}</div>
                ${rigaImmagine}
                <div class="widget-tile-righe">${anteprima.righe.map(r => `<span>${r}</span>`).join('')}</div>`;
        }

        return `
            <div class="widget-tile ${classeStato} ${classeCascata} widget-size-${w.size} widget-col-${_t.col} widget-row-${_t.row} ${_formaWidget(_t.col, _t.row)} ${_iconaStatica ? 'widget-tile-mini' : ''}" ${stileRitardo} data-widget-id="${w.instanceId}" data-widget-index="${indice}" ${azioneClick}>
                ${controlliEdit}
                ${badge}
                <div class="tile-tinta"></div><div class="tile-alone"></div>
                ${corpo}
            </div>`;
    }));

    let tileAggiungi = '';
    if (_editModeWidget && visibili.length < MAX_WIDGET_VISIBILI) {
        tileAggiungi = `
            <div class="widget-tile widget-tile-aggiungi widget-col-3 widget-row-2 wf-piccolo" onclick="_apriPickerAggiungiWidget()">
                <i class="fa-solid fa-plus widget-tile-icon"></i>
                <div class="widget-tile-titolo">Aggiungi</div>
            </div>`;
    }

    // ── COMPOSIZIONE DELLE PAGINE ───────────────────────────────────────
    // Le tessere sono gia' state costruite tutte insieme (con Promise.all,
    // che va lasciato in un blocco solo: spezzarlo per pagina moltiplica
    // le query). Qui si distribuiscono soltanto.
    const nPagine = _numeroPagineWidget();
    // Uscendo dalla modifica la pagina vuota di cortesia sparisce: se
    // l'utente era proprio li', va riportato sull'ultima pagina vera,
    // altrimenti resterebbe su uno scorrimento che non esiste piu' e i
    // puntini indicherebbero una pagina sbagliata.
    if (_paginaWidgetCorrente > nPagine - 1) _paginaWidgetCorrente = nPagine - 1;
    const classiGriglia = 'widget-griglia'
        + (BALL_ATTIVA ? ' ball-ui' : '')
        + (_editModeWidget ? ' in-modifica-widget' : '');
    const paginaHtml = [];
    for (let p = 0; p < nPagine; p++) {
        const dentro = visibili
            .map((w, i) => ({ w: w, html: tessere[i] }))
            .filter(x => (x.w.pagina || 0) === p)
            .map(x => x.html)
            .join('');
        // Il tassello "Aggiungi" sta sull'ultima pagina REALE, non su
        // quella vuota di cortesia che compare solo in modifica.
        const ultimaReale = p === nPagine - 1 - (_editModeWidget ? 1 : 0);
        const vuota = !dentro && !(ultimaReale && tileAggiungi);
        paginaHtml.push(`
            <div class="widget-pagina" data-pagina="${p}">
                <div class="${classiGriglia}">${dentro}${ultimaReale ? tileAggiungi : ''}</div>
                ${vuota && _editModeWidget ? '<div class="widget-pagina-vuota">Pagina vuota<br><small>spingi qui un widget con la freccia \u203a</small></div>' : ''}
            </div>`);
    }

    const puntini = nPagine > 1
        ? `<div id="phoneWidgetPuntini">${Array.from({ length: nPagine }, (_, i) =>
            `<button type="button" class="widget-puntino${i === _paginaWidgetCorrente ? ' attivo' : ''}" onclick="_vaiAllaPaginaWidget(${i})" aria-label="Pagina ${i + 1}"></button>`).join('')}</div>`
        : '';

    // Il ridimensionamento ridisegna a ogni movimento del dito: senza
    // questa riga lo scorrimento orizzontale tornerebbe a zero e la pagina
    // "scapperebbe" alla prima sotto le dita.
    const scrollPrima = Math.min(cont.scrollLeft, _paginaWidgetCorrente * cont.clientWidth);
    cont.innerHTML = paginaHtml.join('');
    const vecchiPuntini = document.getElementById('phoneWidgetPuntini');
    if (vecchiPuntini) vecchiPuntini.remove();
    if (puntini) cont.insertAdjacentHTML('afterend', puntini);
    cont.scrollLeft = scrollPrima;

    _primoRenderWidgetFatto = true;
    _ballAttenzioni = attenzioni;

    // Al primo render, dopo la cascata d'ingresso, un giro di semaforo
    // così chi ha qualcosa da fare si fa notare subito invece di aspettare
    // i 5,2 secondi del ciclo.
    if (primoRender && BALL_ATTIVA) setTimeout(_ballGiraSemaforo, 900);

    if (_editModeWidget) _attivaDragEResize();
}

// Esegue l'azione del widget: 'azione' personalizzata nel catalogo se
// presente (riceve gli stessi dati calcolati da preview, per widget come
// carta del giorno/ultima carta che devono sapere QUALE carta aprire),
// altrimenti apre come dettaglio la tab indicata in 'tab' o l'id stesso.
async function _eseguiAzioneWidget(instanceId, evt) {
    const w = _layoutWidget.find(x => x.instanceId === instanceId);
    const def = w && CATALOGO_WIDGET[w.id];
    if (!def || def.bloccato) return;

    // Missioni/Traguardi Fase 2 — apertura sezioni/widget (2026-08-30).
    // Fire-and-forget, stesso pattern di missioniAccessoRegistraOggi in
    // ui/auth.ui.js: un fallimento qui non deve mai bloccare l'apertura
    // del widget. Nessun dedup: ogni apertura conta (stesso approccio di
    // missioniRicercaRegistra). Loggato per TUTTI i widget, anche quelli
    // senza ancora una missione agganciata — le prossime missioni di
    // questa categoria non richiederanno un nuovo punto di scrittura, solo
    // una nuova lettura in ui/missioni.ui.js:raccogliDati().
    (async () => {
        try {
            const userId = await authGetUserId();
            if (userId) await missioniAperturaWidgetRegistra(userId, w.id);
        } catch (e) { console.error('[missioni] registrazione apertura widget:', e); }
    })();

    // Animazione di cattura PRIMA di aprire. Mai in modalità modifica: lì
    // il tocco lungo apre il peek e il trascinamento riordina, e 2,6s di
    // animazione a ogni tentativo di spostare un widget renderebbero il
    // riordino inusabile. (_eseguiAzioneWidget non viene nemmeno agganciata
    // in edit mode — vedi azioneClick nel render — ma il controllo resta
    // come rete se un giorno la si chiamasse da altrove.)
    // L'evento serve dopo per il punto d'origine dell'apertura: va
    // conservato ORA, perché dopo l'await l'oggetto evento è esaurito.
    const punto = evt ? { clientX: evt.clientX, clientY: evt.clientY, currentTarget: evt.currentTarget } : null;
    if (BALL_ATTIVA && !_editModeWidget && evt && evt.currentTarget) {
        try { await _ballGiocaCattura(evt.currentTarget); } catch (_) { /* l'animazione non deve mai bloccare l'apertura */ }
    }

    if (def.azione) {
        let dati = null;
        try { dati = await def.preview(w); } catch (_) { dati = null; }
        def.azione(dati, punto, w);
        return;
    }
    apriDettaglioWidget(def.tab || w.id, punto);
}

// SUPERATA dalle pagine multiple (2026-09-03) e senza piu' chiamanti: con
// le pagine, muovere per indice sull'elenco visibile faceva saltare un
// widget da una pagina all'altra come effetto collaterale invisibile. Le
// frecce su/giu' usano ora _spostaWidgetNellaPagina(instanceId, dir), che
// resta dentro la pagina. Lasciata qui perche' innocua e perche' un
// eventuale onclick residuo in una schermata non ancora aggiornata
// continuerebbe a funzionare invece di lanciare un errore.
function _spostaWidget(indiceVisibile, direzione) {
    const visibili = _layoutWidget.filter(w => w.visibile);
    const target = visibili[indiceVisibile];
    const idxReale = _layoutWidget.indexOf(target);
    const idxScambio = _layoutWidget.indexOf(visibili[indiceVisibile + direzione]);
    if (idxScambio === undefined || idxScambio < 0) return;
    [_layoutWidget[idxReale], _layoutWidget[idxScambio]] = [_layoutWidget[idxScambio], _layoutWidget[idxReale]];
    _salvaLayoutWidget();
    renderWidgetHome();
}

function _nascondiWidget(instanceId) {
    const idx = _layoutWidget.findIndex(x => x.instanceId === instanceId);
    if (idx < 0) return;
    const w = _layoutWidget[idx];
    const def = CATALOGO_WIDGET[w.id];
    if (def && def.multiIstanza) {
        _layoutWidget.splice(idx, 1); // istanza effimera: via del tutto, non solo nascosta
    } else {
        w.visibile = false;
    }
    _salvaLayoutWidget();
    renderWidgetHome();
}

// Picker "Aggiungi": due tipi di voci ora. I widget multiIstanza (Vetrina)
// compaiono SEMPRE, anche se ne hai già una copia — cliccare ne crea una
// nuova. I widget normali compaiono solo se attualmente nascosti, come
// prima (_mostraWidget li riattiva, riga unica già esistente).
function _apriPickerAggiungiWidget() {
    const nascosti = _layoutWidget.filter(w => !w.visibile && !(CATALOGO_WIDGET[w.id] && CATALOGO_WIDGET[w.id].multiIstanza));
    const multi = Object.entries(CATALOGO_WIDGET).filter(([, def]) => def.multiIstanza);

    const container = document.getElementById('widgetPickerLista');
    const vociMulti = multi.map(([id, def]) => `
        <div class="widget-picker-riga" onclick="_aggiungiIstanzaWidget('${id}')">
            <i class="fa-solid ${def.icona}"></i> Aggiungi ${def.titolo}
        </div>`);
    const vociSingole = nascosti.map(w => `
        <div class="widget-picker-riga" onclick="_mostraWidget('${w.id}')">
            <i class="fa-solid ${CATALOGO_WIDGET[w.id].icona}"></i> ${CATALOGO_WIDGET[w.id].titolo}
        </div>`);
    const tutte = [...vociMulti, ...vociSingole].join('');
    container.innerHTML = tutte || '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Nessun altro widget disponibile.</p>';
    document.getElementById('widgetPickerModal').style.display = 'flex';
}

function _chiudiPickerAggiungiWidget() {
    document.getElementById('widgetPickerModal').style.display = 'none';
}

function _mostraWidget(id) {
    const visibiliCount = _layoutWidget.filter(w => w.visibile).length;
    if (visibiliCount >= MAX_WIDGET_VISIBILI) { alert(`Massimo ${MAX_WIDGET_VISIBILI} widget in home.`); return; }
    const w = _layoutWidget.find(x => x.id === id);
    if (w) w.visibile = true;
    _salvaLayoutWidget();
    _chiudiPickerAggiungiWidget();
    renderWidgetHome();
}

// Crea una nuova copia di un widget multiIstanza (oggi solo Vetrina) e
// apre subito la ricerca carte per scegliere cosa mostrarci — niente
// copia vuota abbandonata in giro senza che l'utente sappia cosa farci.
function _aggiungiIstanzaWidget(id) {
    const visibiliCount = _layoutWidget.filter(w => w.visibile).length;
    if (visibiliCount >= MAX_WIDGET_VISIBILI) { alert(`Massimo ${MAX_WIDGET_VISIBILI} widget in home.`); return; }
    // Nasce sulla pagina che stai guardando, non sempre sulla prima.
    const nuovo = { id, instanceId: _nuovoInstanceId(), visibile: true, size: '3x2', mini: false, cartaId: null, pagina: _paginaWidgetCorrente, v: VERSIONE_LAYOUT_WIDGET };
    _layoutWidget.push(nuovo);
    _salvaLayoutWidget();
    _chiudiPickerAggiungiWidget();
    renderWidgetHome();
    _apriRicercaCartaVetrina(nuovo.instanceId);
}

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

function toggleModificaWidgetHome() {
    _editModeWidget = !_editModeWidget;
    document.getElementById('btnModificaWidgetHome').classList.toggle('attivo', _editModeWidget);
    renderWidgetHome();
}

// ── DRAG & DROP (riordino) + RIDIMENSIONAMENTO — Pointer Events ─────────
// Un solo set di listener via Pointer Events (non HTML5 Drag&Drop, che su
// touch è inaffidabile) funziona identico con mouse e dito. Attivati solo
// in modalità modifica, ri-agganciati ad ogni renderWidgetHome() perché il
// markup viene rigenerato da zero ogni volta.
let _dragState = null;
let _resizeState = null;
let _peekTimeout = null;
let _riordinoInCorso = false;

function _attivaDragEResize() {
    document.querySelectorAll('.widget-tile[data-widget-id]').forEach(tile => {
        tile.addEventListener('pointerdown', _onWidgetPointerDown);
    });
    document.querySelectorAll('.widget-resize-handle').forEach(handle => {
        handle.addEventListener('pointerdown', _onResizeHandlePointerDown);
    });
}

// ── RIDIMENSIONAMENTO ─────────────────────────────────────────────────
// FIX (Claudio: "macchinoso e impreciso, non si capisce il senso, si
// finisce per farlo 4x4 senza volerlo"): la versione precedente sommava
// insieme lo spostamento orizzontale e verticale in un unico numero e
// ciclava attraverso 4 taglie fisse ad ogni soglia di 40px superata anche
// nella STESSA gestualità continua — trascinando in una direzione sola,
// avanzava ripetutamente nel ciclo, "scappando" fino a 2×2. Ora larghezza
// e altezza sono due assi INDIPENDENTI, calcolati direttamente dalla
// posizione del dito rispetto all'angolo in alto a sinistra della
// tessera (stessa logica dei quadratini di ridimensionamento su Android:
// il bordo segue il dito 1:1, non "a scatti"), quindi trascinare a
// destra allarga, trascinare in basso allunga, in diagonale fa entrambe
// le cose insieme — mai l'una al posto dell'altra.
function _onResizeHandlePointerDown(e) {
    e.stopPropagation();
    e.preventDefault();
    const id = e.currentTarget.dataset.widgetId;
    const tile = document.querySelector(`.widget-tile[data-widget-id="${id}"]`);
    // Con le pagine multiple le griglie sono N: quella giusta e' quella che
    // contiene QUESTA tessera, non piu' un id unico nel documento.
    const grid = tile ? tile.closest('.widget-griglia') : null;
    const w = _layoutWidget.find(x => x.instanceId === id);
    if (!tile || !grid || !w) return;
    const tileRect = tile.getBoundingClientRect();
    const gridStyle = getComputedStyle(grid);
    const numColonneGriglia = gridStyle.gridTemplateColumns.split(' ').filter(Boolean).length;
    const gap = parseFloat(gridStyle.columnGap) || 0;
    const rowGap = parseFloat(gridStyle.rowGap) || 0;

    // Dimensione di UNA cella dedotta dalla tessera stessa (che oggi
    // occupa 1-2 celle in ciascun asse): più affidabile che ricalcolare a
    // mano le colonne in px.
    const _ta = _leggiTaglia(w.size);
    const colSpanAttuale = _ta.col;
    const rowSpanAttuale = _ta.row;
    const cellW = (tileRect.width - gap * (colSpanAttuale - 1)) / colSpanAttuale;
    const cellH = (tileRect.height - rowGap * (rowSpanAttuale - 1)) / rowSpanAttuale;

    _resizeState = {
        id, originLeft: tileRect.left, originTop: tileRect.top,
        cellW, cellH, gap, rowGap,
        maxColSpan: Math.max(1, numColonneGriglia),
        // Tetto in altezza = quante righe stanno nella PAGINA visibile, non
        // nella griglia (che cresce col contenuto). Cosi' "un widget solo
        // che riempie la pagina" (Claudio) e' esattamente il massimo
        // raggiungibile trascinando, e non si puo' andare oltre lo schermo.
        maxRowSpan: (() => {
            const wrap = grid.closest('.widget-pagina') || document.getElementById('phoneWidgetHomeWrap') || grid.parentElement;
            const hVisibile = wrap ? wrap.clientHeight : 0;
            const cellHTot = cellH + rowGap;
            if (!hVisibile || cellHTot <= 0) return RIGHE_MAX_WIDGET;
            return Math.max(1, Math.min(RIGHE_MAX_WIDGET, Math.floor((hVisibile + rowGap) / cellHTot)));
        })(),
    };
    tile.classList.add('widget-tile-resizing');
    window.addEventListener('pointermove', _onResizeHandlePointerMove);
    // FIX (2026-09-01): serve ANCHE pointercancel, non solo pointerup. Se il
    // gesto viene interrotto dal sistema (gesto di navigazione del telefono,
    // notifica in arrivo, cambio scheda a metà trascinamento) il browser
    // manda pointercancel e non manderà mai pointerup: senza questa riga il
    // listener di pointermove restava agganciato per sempre e _resizeState
    // non veniva mai azzerato, lasciando la tessera bloccata in stato
    // "in ridimensionamento" fino al ricaricamento della pagina. Il libro
    // sfogliabile del Binder (_libroInitGesti, ui/binder.ui.js) gestiva già
    // entrambi gli eventi, qui mancava.
    window.addEventListener('pointerup', _onResizeHandlePointerUp, { once: true });
    window.addEventListener('pointercancel', _onResizeHandlePointerUp, { once: true });
}

function _onResizeHandlePointerMove(e) {
    if (!_resizeState) return;
    const { id, originLeft, originTop, cellW, cellH, gap, rowGap, maxColSpan, maxRowSpan } = _resizeState;

    // Quante celle sono "coperte" dalla posizione del dito, arrotondato
    // alla cella più vicina — segue il movimento in tempo reale, ogni
    // asse per conto suo. Qui NON clampiamo subito a un minimo di 1: il
    // valore "grezzo" (anche 0 o negativo se trascini molto verso
    // l'angolo opposto) ci serve per sapere se l'utente sta chiedendo di
    // rimpicciolire OLTRE il minimo normale (Claudio: "possono essere
    // rimpiccioliti fino a diventare solo icone come su iphone/android").
    const distX = e.clientX - originLeft + gap / 2;
    const distY = e.clientY - originTop + rowGap / 2;
    const colSpanGrezzo = Math.round(distX / (cellW + gap));
    const rowSpanGrezzo = Math.round(distY / (cellH + rowGap));

    const w = _layoutWidget.find(x => x.instanceId === id);
    if (!w) return;

    // Sotto lo zero su entrambi gli assi (l'utente ha trascinato la
    // maniglia oltre l'angolo opposto della cella) → modalità icona:
    // stessa cella 1×1, ma il contenuto si riduce a sola icona (vedi
    // .widget-tile-mini in index.html). Altrimenti dimensione normale,
    // ed uscire da mini se prima lo era.
    // Il flag 'mini' esplicito non serve piu': con 6 colonne la modalita'
    // icona si ottiene semplicemente restringendo a 1-2 celle, ed e' la
    // taglia stessa a deciderla (vedi _iconaStatica in renderWidgetHome).
    // Trascinare oltre l'angolo opposto porta quindi alla taglia minima
    // reale, 1x1, che ORA e' davvero un'icona da ~55px e non piu' una
    // cella larga mezzo schermo.
    const vuoleMini = false;
    const colSpan = Math.max(1, Math.min(maxColSpan, colSpanGrezzo));
    const rowSpan = Math.max(1, Math.min(maxRowSpan, rowSpanGrezzo));
    const nuovaTaglia = `${colSpan}x${rowSpan}`;

    if (w.size !== nuovaTaglia || w.mini !== vuoleMini) {
        w.size = nuovaTaglia;
        w.mini = vuoleMini;
        _salvaLayoutWidget();
        renderWidgetHome();
        const nuovaTile = document.querySelector(`.widget-tile[data-widget-id="${id}"]`);
        if (nuovaTile) nuovaTile.classList.add('widget-tile-resizing');
    }
}

function _onResizeHandlePointerUp() {
    if (_resizeState) {
        const tile = document.querySelector(`.widget-tile[data-widget-id="${_resizeState.id}"]`);
        if (tile) tile.classList.remove('widget-tile-resizing');
    }
    _resizeState = null;
    window.removeEventListener('pointermove', _onResizeHandlePointerMove);
    // Rimossi entrambi a mano: 'once' toglie solo quello che è scattato
    // davvero, l'altro resterebbe agganciato e se ne accumulerebbe uno ad
    // ogni ridimensionamento.
    window.removeEventListener('pointerup', _onResizeHandlePointerUp);
    window.removeEventListener('pointercancel', _onResizeHandlePointerUp);
}

// ── DRAG & DROP (riordino) ────────────────────────────────────────────
// FIX (Claudio: "innaturale, sistema per assomigliare a iPhone/Android"):
// prima la tessera trascinata restava FERMA nella griglia (solo scala +
// ombra) finché il dito non entrava nell'area di un'altra — lo scambio
// avveniva di scatto con un ri-render completo, senza che nulla seguisse
// davvero il dito. Ora: un "fantasma" (clone della tessera, posizione
// fissa) segue il puntatore 1:1 in tempo reale; la tessera originale
// diventa invisibile ma mantiene il suo posto in griglia (per non far
// saltare il layout); quando il fantasma passa sopra un'altra tessera,
// l'ordine cambia e le tessere si RIPOSIZIONANO CON UN'ANIMAZIONE
// (tecnica FLIP: misura le posizioni prima, cambia l'ordine, anima dalla
// vecchia posizione alla nuova) invece di scattare — stesso effetto di
// "far posto" che si vede spostando le icone su iPhone/Android.
function _onWidgetPointerDown(e) {
    if (e.target.closest('.widget-edit-controls') || e.target.closest('.widget-resize-handle')) return;
    const tile = e.currentTarget;
    const id = tile.dataset.widgetId;

    // Tocco lungo (peek) — annullato in _onWidgetPointerMove appena il
    // gesto si trasforma in un vero drag.
    _peekTimeout = setTimeout(() => { _mostraPeek(id, tile); _vibraSeSupportato(8); }, 480);

    const rect = tile.getBoundingClientRect();
    _dragState = {
        id, startX: e.clientX, startY: e.clientY,
        rectLeft: rect.left, rectTop: rect.top, rectWidth: rect.width, rectHeight: rect.height,
        iniziato: false, ghost: null,
    };
    window.addEventListener('pointermove', _onWidgetPointerMove);
    // FIX (2026-09-01): stesso motivo del ridimensionamento qui sopra — senza
    // pointercancel un gesto interrotto dal sistema lasciava il "fantasma"
    // della tessera appiccicato allo schermo e _dragState mai azzerato.
    window.addEventListener('pointerup', _onWidgetPointerUp, { once: true });
    window.addEventListener('pointercancel', _onWidgetPointerUp, { once: true });
}

function _avviaDragVero(tile) {
    clearTimeout(_peekTimeout);
    _nascondiPeek();
    _dragState.iniziato = true;
    _vibraSeSupportato(12);

    const ghost = tile.cloneNode(true);
    ghost.classList.add('widget-tile-ghost');
    ghost.style.position = 'fixed';
    ghost.style.left = _dragState.rectLeft + 'px';
    ghost.style.top = _dragState.rectTop + 'px';
    ghost.style.width = _dragState.rectWidth + 'px';
    ghost.style.height = _dragState.rectHeight + 'px';
    ghost.style.margin = '0';
    ghost.style.pointerEvents = 'none';
    document.body.appendChild(ghost);
    _dragState.ghost = ghost;

    tile.classList.add('widget-tile-nascosta');
}

function _onWidgetPointerMove(e) {
    if (!_dragState) return;
    const dx = e.clientX - _dragState.startX;
    const dy = e.clientY - _dragState.startY;

    if (!_dragState.iniziato) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return; // ancora un tocco fermo, non un drag
        const tileAttuale = document.querySelector(`.widget-tile[data-widget-id="${_dragState.id}"]`);
        if (!tileAttuale) { _dragState = null; return; }
        _avviaDragVero(tileAttuale);
    }

    // Il fantasma segue il dito/mouse esattamente, in tempo reale.
    _dragState.ghost.style.transform = `translate(${dx}px, ${dy}px) scale(1.05)`;

    if (_riordinoInCorso) return; // un riordino con animazione è già in corso, aspetta che finisca
    const sotto = document.elementFromPoint(e.clientX, e.clientY);
    const tileSotto = sotto ? sotto.closest('.widget-tile[data-widget-id]') : null;
    if (tileSotto && tileSotto.dataset.widgetId !== _dragState.id) {
        const idA = _dragState.id;
        const idB = tileSotto.dataset.widgetId;
        const visibili = _layoutWidget.filter(w => w.visibile);
        const idxA = _layoutWidget.indexOf(visibili.find(w => w.instanceId === idA));
        const idxB = _layoutWidget.indexOf(visibili.find(w => w.instanceId === idB));
        if (idxA >= 0 && idxB >= 0) _riordinaConAnimazione(idxA, idxB);
    }
}

// Tecnica FLIP (First-Last-Invert-Play): cattura le posizioni ATTUALI di
// tutte le tessere, scambia l'ordine nell'array, ri-renderizza (async,
// per questo la guardia _riordinoInCorso), poi ogni tessera parte dalla
// SUA vecchia posizione e anima verso quella nuova via transform —
// risultato: le altre tessere scivolano per fare spazio, non scattano.
async function _riordinaConAnimazione(idxA, idxB) {
    _riordinoInCorso = true;

    const primaRect = {};
    document.querySelectorAll('.widget-tile[data-widget-id]').forEach(t => {
        primaRect[t.dataset.widgetId] = t.getBoundingClientRect();
    });

    [_layoutWidget[idxA], _layoutWidget[idxB]] = [_layoutWidget[idxB], _layoutWidget[idxA]];
    _salvaLayoutWidget();
    await renderWidgetHome();

    const idTrascinato = _dragState ? _dragState.id : null;
    document.querySelectorAll('.widget-tile[data-widget-id]').forEach(t => {
        const id = t.dataset.widgetId;
        if (id === idTrascinato) { t.classList.add('widget-tile-nascosta'); return; }
        const prima = primaRect[id];
        if (!prima) return;
        const dopo = t.getBoundingClientRect();
        const spostX = prima.left - dopo.left;
        const spostY = prima.top - dopo.top;
        if (spostX || spostY) {
            t.style.transition = 'none';
            t.style.transform = `translate(${spostX}px, ${spostY}px)`;
            requestAnimationFrame(() => {
                t.style.transition = 'transform 0.22s ease';
                t.style.transform = '';
            });
        }
    });

    _riordinoInCorso = false;
}

function _onWidgetPointerUp() {
    clearTimeout(_peekTimeout);
    _nascondiPeek();
    if (_dragState && _dragState.iniziato) {
        _vibraSeSupportato(6);
        if (_dragState.ghost) _dragState.ghost.remove();
        const tile = document.querySelector(`.widget-tile[data-widget-id="${_dragState.id}"]`);
        if (tile) tile.classList.remove('widget-tile-nascosta');
    }
    _dragState = null;
    window.removeEventListener('pointermove', _onWidgetPointerMove);
    window.removeEventListener('pointerup', _onWidgetPointerUp);
    window.removeEventListener('pointercancel', _onWidgetPointerUp);
}

// ── PEEK — anteprima al tocco lungo, senza aprire il popup fullscreen ────
function _mostraPeek(instanceId, tileEl) {
    const w = _layoutWidget.find(x => x.instanceId === instanceId);
    const def = w && CATALOGO_WIDGET[w.id];
    if (!def) return;
    const overlay = document.getElementById('widgetPeekOverlay');
    const rect = tileEl.getBoundingClientRect();
    overlay.innerHTML = `<div class="widget-tile-titolo"><i class="fa-solid ${def.icona}"></i> ${def.titolo}</div><div class="widget-tile-righe" id="widgetPeekRighe">Caricamento…</div>`;
    overlay.style.left = Math.max(8, Math.min(window.innerWidth - 228, rect.left)) + 'px';
    overlay.style.top = Math.max(8, rect.top - 10) + 'px';
    overlay.style.display = 'block';

    Promise.resolve(def.preview(w)).then(anteprima => {
        const el = document.getElementById('widgetPeekRighe');
        if (el) el.innerHTML = (anteprima.righe || []).map(r => `<span>${r}</span>`).join('<br>');
    }).catch(() => {});
}

function _nascondiPeek() {
    const overlay = document.getElementById('widgetPeekOverlay');
    if (overlay) overlay.style.display = 'none';
}

// ── APERTURA/CHIUSURA DETTAGLIO FULLSCREEN DENTRO IL FRAME ───────────────
function _posizionaContainerNelloSchermo() {
    const container = document.querySelector('.container');
    if (!container) return;
    // MODIFICATO (2026-08-30, Claudio: "il cerchio ma a schermo intero"):
    // prima il container era confinato al rettangolo di #phoneScreen (la
    // cornice del telefono simulato) — ora copre l'intera finestra del
    // browser. Il punto di origine del cerchio (--pokeball-x/-y, impostato
    // da _impostaOrigineAnimazione) resta relativo al click reale
    // dell'utente, quindi funziona invariato. Nessun bordo arrotondato:
    // a schermo intero non c'è una cornice da rispettare.
    container.style.top = '0px';
    container.style.left = '0px';
    container.style.width = window.innerWidth + 'px';
    container.style.height = window.innerHeight + 'px';
    container.style.borderRadius = '0px';
}

// ── APERTURA/CHIUSURA — animazione "a Pokéball" ──────────────────────────
// Claudio ha approvato l'idea di un'apertura che richiami il tema
// Pokéball: un cerchio che si espande dal punto esatto in cui hai
// toccato/cliccato il widget (CSS clip-path, nessun asset nuovo). La
// transizione è dichiarata SEMPRE in CSS (.container.container-visibile,
// vedi index.html) — qui ci limitiamo a impostare l'origine del cerchio
// (variabili CSS --pokeball-x/-y) e a spostare le classi, MAI a
// toccare transition/clip-path a mano: è quello il pattern fragile che
// causava il blocco a metà (vedi commento CSS per i dettagli).
const DURATA_ANIMAZIONE_DETTAGLIO_MS = 300;
let _chiusuraDettaglioTimeout = null;

function _impostaOrigineAnimazione(container, evt) {
    const schermo = document.getElementById('phoneScreen');
    const rect = schermo ? schermo.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    const x = evt && evt.clientX ? evt.clientX : rect.left + rect.width / 2;
    const y = evt && evt.clientY ? evt.clientY : rect.top + rect.height / 2;
    container.style.setProperty('--pokeball-x', x + 'px');
    container.style.setProperty('--pokeball-y', y + 'px');
}

async function apriDettaglioWidget(tabId, evt) {
    clearTimeout(_chiusuraDettaglioTimeout); // annulla un'eventuale chiusura ancora in corso (riapertura rapida)

    const container = document.querySelector('.container');
    if (tabId === 'dafare' || tabId === 'match' || tabId === 'condividi' || tabId === 'missioni' || tabId === 'valore' || tabId === 'wishlist' || tabId === 'location' || tabId === 'doppioni' || tabId === 'sealed' || tabId === 'set') {
        // MAI switchTab() qui: quella funzione ha una whitelist fissa di 5
        // tab (navigation.ui.js r.199) ed è segnata nella memoria di
        // progetto come "deve restare stabile e intoccata" — un bug reale
        // c'è già stato lì in passato. Repliochiamo solo il minimo che
        // switchTab farebbe per una tab in whitelist (nascondi tutte le
        // view-section, mostra la mia), concordato con Claudio 2026-08-28
        // (dafare) e riusato identico per 'match', 'condividi', 'missioni'
        // e ora 'valore' (2026-08-30, pagina dedicata Valore collezione).
        document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
        document.getElementById(tabId)?.classList.add('active');
        if (tabId === 'dafare') renderPaginaDaFare();
        if (tabId === 'match') renderPaginaMatch();
        if (tabId === 'condividi') renderPaginaCondividi();
        if (tabId === 'missioni') renderPaginaMissioni();
        if (tabId === 'valore') renderPaginaValoreCollezione();
        if (tabId === 'wishlist') renderPaginaWishlist();
        if (tabId === 'location') renderPaginaLocation();
        if (tabId === 'doppioni') renderPaginaDoppioni();
        if (tabId === 'sealed') renderPaginaSealed();
        if (tabId === 'set') renderPaginaSet();
    } else {
        switchTab(tabId, null);
    }
    document.body.classList.add('phone-detail-open');

    // FIX (2026-08-30, "non c'è modo di tornare indietro"): #btnFisicoTelefono
    // vive dentro #phoneFrameBox → #phoneShell, e #phoneShell è un
    // CONTESTO DI STACKING a sé (position:fixed + z-index:10). Per una
    // regola del CSS, lo z-index di un discendente non può MAI farlo
    // emergere sopra un fratello di un ANTENATO che ha stacking context
    // proprio — l'intero sotto-albero di #phoneShell (bottone incluso)
    // resta sempre sotto .container (z-index:11), qualunque z-index dia
    // al bottone stesso. L'unico modo reale: spostarlo temporaneamente
    // fuori da quel sotto-albero, direttamente dentro <body>, mentre il
    // dettaglio è aperto — riportato al suo posto in chiudiDettaglioWidget
    // qui sotto, a fine animazione di chiusura.
    const _btnFisico = document.getElementById('btnFisicoTelefono');
    if (_btnFisico && _btnFisico.parentElement !== document.body) {
        document.body.appendChild(_btnFisico);
        _btnFisico.classList.add('a-schermo-intero');
    }

    if (container) {
        _impostaOrigineAnimazione(container, evt);
        container.classList.add('container-visibile'); // display: normale, cerchio a 0% (stato di partenza dichiarato in CSS)
        _posizionaContainerNelloSchermo();
        // Un frame di distacco tra "cerchio a 0%" e "aggiungi la classe che
        // lo porta a 150%": necessario perché il browser faccia partire
        // davvero la transizione invece di saltare subito allo stato finale.
        requestAnimationFrame(() => container.classList.add('container-aperto'));
    }
    _beep(880, 70);
    _aggiornaTastoFisico();

    // Multi-Binder (2026-08-25): il caricamento dati va SEMPRE dopo
    // l'apertura visiva, mai prima — un bug introdotto in un fix precedente
    // metteva questo await PRIMA del blocco container sopra: un qualunque
    // errore in apriWidgetBinders() interrompeva la funzione lì, il
    // container non si apriva mai e da fuori sembrava che il click non
    // facesse nulla (bug segnalato da Claudio). Ora è dopo, e in try/catch:
    // un errore nel caricamento non deve mai impedire l'apertura della
    // sezione, al massimo la mostra vuota.
    if (tabId === 'binder') {
        try {
            await apriWidgetBinders();
        } catch (e) {
            console.error('apriDettaglioWidget: errore caricando i binder:', e);
        }
    }
}

function chiudiDettaglioWidget() {
    const container = document.querySelector('.container');
    if (container) container.classList.remove('container-aperto'); // la transizione CSS dichiarata fa il resto (150%→0%)
    _beep(440, 70);
    document.body.classList.remove('phone-detail-open'); // subito: il bottone deve reagire al tap, non aspettare l'animazione
    _aggiornaTastoFisico();

    clearTimeout(_chiusuraDettaglioTimeout);
    _chiusuraDettaglioTimeout = setTimeout(() => {
        if (container) container.classList.remove('container-visibile'); // SOLO ora, a transizione finita, torna display:none
        // Simmetrico al reparent fatto in apriDettaglioWidget: il bottone
        // torna dentro #phoneFrameBox, ripristinando la posizione
        // percentuale calibrata sull'immagine cornice.
        const btnFisico = document.getElementById('btnFisicoTelefono');
        const frameBox = document.getElementById('phoneFrameBox');
        if (btnFisico && frameBox && btnFisico.parentElement !== frameBox) {
            frameBox.appendChild(btnFisico);
            btnFisico.classList.remove('a-schermo-intero');
        }
        renderWidgetHome();
    }, DURATA_ANIMAZIONE_DETTAGLIO_MS);
}

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
        if (typeof CSBar !== 'undefined') {
            (async () => {
                try {
                    const { data: saldo, error } = await ricompenseSaldo(userId, 'polvere');
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

function _gestisciResizeCornice() {
    if (document.body.classList.contains('phone-detail-open')) {
        requestAnimationFrame(_posizionaContainerNelloSchermo);
    }
}
function _gestisciResizeCorniceDebounced() {
    clearTimeout(_resizeCorniceTimeout);
    _resizeCorniceTimeout = setTimeout(_gestisciResizeCornice, 100);
}

// ── CORNICE PERSONALIZZABILE (placeholder oggi, bucket Supabase domani) ──
function _applicaCorniceUtente(urlVerticale, urlOrizzontale) {
    if (urlVerticale) document.getElementById('phoneFrameV').style.backgroundImage = `url('${urlVerticale}')`;
    if (urlOrizzontale) document.getElementById('phoneFrameO').style.backgroundImage = `url('${urlOrizzontale}')`;
}

// ── SFONDO (WALLPAPER) PERSONALIZZABILE — stesso pattern della cornice ──
// Oggi solo il placeholder (gradiente tenue via CSS, vedi #phoneWidgetHomeWrap
// in index.html). Punto di innesto per quando esisterà la scelta da bucket.
function _applicaSfondoUtente(url) {
    const wrap = document.getElementById('phoneWidgetHomeWrap');
    if (wrap && url) wrap.style.backgroundImage = `url('${url}')`;
}

// ── BARRA DI STATO (orario + indicatore di sync) ─────────────────────────
function _aggiornaOrologioStatusBar() {
    const el = document.getElementById('phoneStatusOra');
    if (el) el.textContent = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

// Pulsa mentre è in corso una VERA chiamata a Supabase (non ad ogni
// ricalcolo locale gratuito da carteReali) — usata attorno al polling
// "lento" e a caricaAvvisiHome.
// AGGIORNATA (2026-09-01, integrazione status bar): il vecchio puntino
// #phoneSyncDot è nascosto via CSS (vedi statusbar.css, blocco di
// integrazione) — questa funzione ora pilota lo stato "connessione" della
// nuova barra invece del puntino. Firma invariata, tutti i punti di
// chiamata esistenti nel file continuano a funzionare senza modifiche.
// Non è un mapping perfetto (CSBar distingue online/connecting/offline,
// qui abbiamo solo "sta sincronizzando ora / non sta sincronizzando"), ma
// è la stessa semplificazione già implicita nel vecchio puntino
// acceso/spento — nessuna informazione persa.
function _impostaSyncAttivo(attivo) {
    const dot = document.getElementById('phoneSyncDot'); // lasciato per rollback, nascosto via CSS
    if (dot) dot.classList.toggle('attivo', attivo);
    if (typeof CSBar !== 'undefined' && CSBar.getConnection) {
        CSBar.setConnection(attivo ? 'connecting' : 'online');
    }
}

// ── SUONI RETRO (Web Audio, nessun file esterno) ─────────────────────────
let _phoneAudioCtx = null;
function _beep(frequenza, durataMs) {
    if (!prefSuoniWidgetGet()) return;
    try {
        _phoneAudioCtx = _phoneAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
        const osc = _phoneAudioCtx.createOscillator();
        const gain = _phoneAudioCtx.createGain();
        osc.type = 'square';
        osc.frequency.value = frequenza;
        gain.gain.value = 0.025; // molto discreto, non invadente
        osc.connect(gain);
        gain.connect(_phoneAudioCtx.destination);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.0001, _phoneAudioCtx.currentTime + durataMs / 1000);
        osc.stop(_phoneAudioCtx.currentTime + durataMs / 1000 + 0.02);
    } catch (_) { /* Web Audio non disponibile o bloccato: niente suono, nessun errore visibile */ }
}

function toggleSuoniWidgetHome() {
    const nuovoStato = !prefSuoniWidgetGet();
    prefSuoniWidgetSet(nuovoStato);
    const icona = document.getElementById('iconaSuoniWidgetHome');
    if (icona) icona.className = nuovoStato ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';
    if (nuovoStato) _beep(660, 60);
}

// ── NOTIFICHE PUSH (diff sui dati già scaricati, nessuna query nuova) ────
// Confronta i contatori di rischio col giro di polling precedente — se
// sono aumentati, mostra un banner + bagliore + vibrazione + suono.
// Nessun nuovo endpoint: riusa dati già ottenuti dal polling "lento".
let _contatoriNotifichePrecedenti = null;

async function _controllaNotifichePush() {
    const codaErrori = await _contaCodaErrori();
    const prezziScaduti = (typeof _elencoPrezziScaduti !== 'undefined' && _elencoPrezziScaduti) ? _elencoPrezziScaduti.length : 0;
    const attuali = { codaErrori, prezziScaduti };

    if (_contatoriNotifichePrecedenti) {
        if (attuali.codaErrori > _contatoriNotifichePrecedenti.codaErrori) {
            _mostraNotificaPush('Nuova carta da correggere in Inserimento');
        } else if (attuali.prezziScaduti > _contatoriNotifichePrecedenti.prezziScaduti) {
            _mostraNotificaPush('Nuovi prezzi da aggiornare');
        }
    }
    _contatoriNotifichePrecedenti = attuali;
}

function _mostraNotificaPush(testo) {
    const banner = document.getElementById('phonePushBanner');
    const testoEl = document.getElementById('phonePushBannerTesto');
    const schermo = document.getElementById('phoneScreen');
    if (!banner || !testoEl) return;
    testoEl.textContent = testo;
    banner.classList.add('mostrata');
    if (schermo) schermo.classList.add('glow-notifica');
    _vibraSeSupportato(15);
    _beep(660, 90);
    setTimeout(() => {
        banner.classList.remove('mostrata');
        if (schermo) schermo.classList.remove('glow-notifica');
    }, 4000);
}

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
            await _controllaNotifichePush();
        } catch (e) { console.error('Errore polling avvisi (widget prezzi/inserimento/match):', e); }
        _impostaSyncAttivo(false);
        renderWidgetHome();
    }, INTERVALLO_WIDGET_LENTO_MS);
}

// ── HOME COME PAGINA PRINCIPALE — swipe verso i widget ───────────────────
// #home viene spostato (appendChild — stesso nodo, stesso contenuto,
// nessuna riscrittura) dentro #phoneHomePage una sola volta, all'avvio.
// Le due pagine vivono dentro #phonePagineWrap con scroll-snap: swipe/
// scroll in giù = widget, il bottone fisico (icona casetta) torna su.
let _paginaAttivaTelefono = 'home';

function _spostaHomeNellaPaginaPrincipale() {
    const home = document.getElementById('home');
    const paginaHome = document.getElementById('phoneHomePage');
    if (home && paginaHome && home.parentElement !== paginaHome) {
        paginaHome.appendChild(home);
    }
}

function _vaiAllaPaginaHome() {
    const wrap = document.getElementById('phonePagineWrap');
    if (wrap) wrap.scrollTo({ top: 0, behavior: 'smooth' });
}

function _gestisciScrollPagine() {
    const wrap = document.getElementById('phonePagineWrap');
    if (!wrap) return;
    const indice = Math.round(wrap.scrollTop / Math.max(wrap.clientHeight, 1));
    _paginaAttivaTelefono = indice === 0 ? 'home' : 'widget';
    _aggiornaTastoFisico();
    _aggiornaMatitaBarraGlobale();
}

// Suoni/densità/matita nella barra di stato globale — visibili SOLO sulla
// pagina widget (Claudio: "quando sei in visuale widget"); se stai
// modificando e torni sulla Home, esce anche dalla modalità modifica
// (non avrebbe senso restare in modifica senza vedere i widget).
function _aggiornaMatitaBarraGlobale() {
    const idBottoniCondizionali = ['btnSuoniWidgetHome', 'btnDensitaWidgetHome', 'btnModificaWidgetHome'];
    idBottoniCondizionali.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.classList.toggle('nascosto-in-home', _paginaAttivaTelefono !== 'widget');
    });
    if (_paginaAttivaTelefono !== 'widget' && _editModeWidget) {
        _editModeWidget = false;
        const btnModifica = document.getElementById('btnModificaWidgetHome');
        if (btnModifica) btnModifica.classList.remove('attivo');
        renderWidgetHome();
    }
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
    } else if (_paginaAttivaTelefono === 'widget') {
        btn.classList.remove('nascosto');
        if (icona) icona.className = 'fa-solid fa-house';
        btn.title = 'Home';
    } else {
        btn.classList.add('nascosto');
    }
}

function _clickTastoFisico() {
    if (document.body.classList.contains('phone-detail-open')) {
        chiudiDettaglioWidget(); // "Indietro": torna ai widget, non salta alla Home
        return;
    }
    if (_paginaAttivaTelefono === 'widget') {
        _vaiAllaPaginaHome();
    }
    // Se sei già sulla Home, non fa nulla.
}

// ── PRESENZA LIVE (2026-09-01, punto 4 status bar) ──────────────────────
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
                    await canale.track({ online: true }); // nessun dato identificativo, vedi nota sopra
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.warn('[presenza] canale realtime non disponibile (status: ' + status + ') — controllare che Realtime sia attivo sul progetto Supabase.');
                }
            });
    } catch (e) { console.error('[presenza] errore avvio:', e); }
}

// ── AVVIO ─────────────────────────────────────────────────────────────
async function initPhoneShell() {
    _spostaHomeNellaPaginaPrincipale();

    _caricaLayoutWidget();
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

            // Suoni/densità/matita (2026-09-01): spostati dalla vecchia
            // barra (sempre nascosta ora) ai "quickActions" della tendina
            // — Claudio ha confermato l'approccio. Cambia la scopribilità
            // (prima visibili solo sulla pagina widget, ora sempre
            // raggiungibili dalla tendina): nota, non un difetto silenzioso.
            // 'active' letto dallo stato REALE del progetto al momento
            // dell'avvio, cosi CSBar parte sincronizzato — poi le due
            // funzioni restano allineate perché ogni tap passa sempre da
            // qui (onToggle chiama SEMPRE la funzione reale del progetto).
            quickActions: [
                { id: 'suoni', label: 'Suoni', glyph: '\u266a', active: prefSuoniWidgetGet(), onToggle: () => toggleSuoniWidgetHome() },
                { id: 'densita', label: 'Densità comoda', glyph: '\u25a6', active: _densitaCompatta, onToggle: () => toggleDensitaWidgetHome() },
                { id: 'modifica', label: 'Personalizza widget', glyph: '\u270e', type: 'action', onToggle: () => toggleModificaWidgetHome() },
            ],

            onSettings: () => apriDettaglioWidget('impostazioni'),
            // Riusa il vero menu profilo (#profiloContainer, spostato qui
            // sotto), non ricostruito — chiama la stessa funzione che
            // apriva/chiudeva il menu dalla vecchia barra.
            onProfile: () => { if (typeof toggleMenuProfilo === 'function') toggleMenuProfilo(); },
        });

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
        // inventario_ricompense tramite ricompenseSaldo() già esistente
        // (data/missioni.repository.js) — 'polvere' è il tipo ricompensa
        // reale usato in tutto il catalogo missioni/traguardi, non
        // inventato. Aggiornata di nuovo dopo ogni valutazione missioni
        // (vedi renderPaginaMissioni), dove vengono davvero accreditate
        // nuove ricompense.
        (async () => {
            try {
                const userId = await authGetUserId();
                if (!userId) return;
                const { data: saldo, error } = await ricompenseSaldo(userId, 'polvere');
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

    const paginaWrap = document.getElementById('phonePagineWrap');
    if (paginaWrap) paginaWrap.addEventListener('scroll', _gestisciScrollPagine, { passive: true });
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
