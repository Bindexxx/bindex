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

// [SEZIONE SPOSTATA in ui/widget-dafare.ui.js — STEP 7 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

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
    // [VOCE 'binder' SPOSTATA in ui/widget-binder.ui.js — STEP 3 ristrutturazione file widget, 2026-09-11]
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
// [SEZIONE SPOSTATA in ui/widget-dafare.ui.js — STEP 7 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]
    // RIMOSSO (Claudio, 2026-08-28): "Orologio".
    // RIMOSSO (Claudio, 2026-08-28): "Aggiungi carta".
// [SEZIONE SPOSTATA in ui/widget-condividi.ui.js — STEP 5 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

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
// [SEZIONE SPOSTATA in ui/widget-estensione.ui.js — STEP 9 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

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

// [SEZIONE SPOSTATA in ui/widget-doppioni.ui.js — STEP 8 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

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
// [SEZIONE SPOSTATA in ui/widget-contributi.ui.js — STEP 6 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]
// [SEZIONE SPOSTATA in ui/widget-bustina.ui.js — STEP 4 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]
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

// [SEZIONE SPOSTATA in ui/widget-contributi.ui.js — STEP 6 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

// [SEZIONE SPOSTATA in ui/paginainiziale.ui.js — STEP 0 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

// [SEZIONE SPOSTATA in ui/widget-render-condiviso.ui.js — STEP 1 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

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

// [SEZIONE SPOSTATA in ui/widget-dafare.ui.js — STEP 7 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

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


// [SEZIONE SPOSTATA in ui/widget-doppioni.ui.js — STEP 8 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]


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


// [SEZIONE SPOSTATA in ui/widget-bustina.ui.js — STEP 4 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

// [SEZIONE SPOSTATA in ui/widget-condividi.ui.js — STEP 5 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

// [SEZIONE SPOSTATA in ui/paginainiziale.ui.js — STEP 0 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]
