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
// [SEZIONE SPOSTATA in ui/widget-inserimento.ui.js — STEP 11 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]
// [SEZIONE SPOSTATA in ui/widget-prezzi.ui.js — STEP 16 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]
    // [VOCE 'binder' SPOSTATA in ui/widget-binder.ui.js — STEP 3 ristrutturazione file widget, 2026-09-11]
// [SEZIONE SPOSTATA in ui/widget-sealed.ui.js — STEP 17 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

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
// [SEZIONE SPOSTATA in ui/widget-location.ui.js — STEP 11 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]
// [SEZIONE SPOSTATA in ui/widget-dafare.ui.js — STEP 7 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]
    // RIMOSSO (Claudio, 2026-08-28): "Orologio".
    // RIMOSSO (Claudio, 2026-08-28): "Aggiungi carta".
// [SEZIONE SPOSTATA in ui/widget-condividi.ui.js — STEP 5 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

// [SEZIONE SPOSTATA in ui/widget-match.ui.js — STEP 13 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]
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
// [SEZIONE SPOSTATA in ui/widget-in-primo-piano.ui.js — STEP 10 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]
// [SEZIONE SPOSTATA in ui/widget-ultime-aggiunte.ui.js — STEP 12 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]
// [SEZIONE SPOSTATA in ui/widget-prezzi.ui.js — STEP 16 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]
// [SEZIONE SPOSTATA in ui/widget-contributi.ui.js — STEP 6 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]
// [SEZIONE SPOSTATA in ui/widget-bustina.ui.js — STEP 4 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]
// [SEZIONE SPOSTATA in ui/widget-polvere.ui.js — STEP 15 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]
// [SEZIONE SPOSTATA in ui/widget-missioni.ui.js — STEP 14 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]
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

// [SEZIONE SPOSTATA in ui/widget-prezzi.ui.js — STEP 16 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

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

// [SEZIONE SPOSTATA in ui/widget-missioni.ui.js — STEP 14 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]



// [SEZIONE SPOSTATA in ui/widget-match.ui.js — STEP 13 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

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


// [SEZIONE SPOSTATA in ui/widget-location.ui.js — STEP 11 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]


// [SEZIONE SPOSTATA in ui/widget-doppioni.ui.js — STEP 8 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]


// [SEZIONE SPOSTATA in ui/widget-sealed.ui.js — STEP 17 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]


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
