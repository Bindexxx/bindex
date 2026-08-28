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
                .map(c => ({ id: c.id, nome: c.name || '', immagine: c.immagine }));
            return { righe: [`${n} carte totali`], dati: { totale: n, ultime } };
        },
    },
    inserimento: {
        titolo: 'Inserimento', icona: 'fa-id-card',
        // Riusa _contaCodaErrori() già definita in home.ui.js — stesso
        // conteggio già mostrato nell'avviso Home, nessuna query duplicata.
        preview: async () => {
            const n = await _contaCodaErrori();
            return { righe: [n > 0 ? `${n} da correggere` : 'Tutto in ordine'], stato: n > 0 ? 'allerta' : 'ok' };
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
            const conPrezzo = carteReali.filter(c => c.stato === 'collezione' && c.price != null).length;
            const dati = {
                scaduti: lista.length,
                totale: Math.max(conPrezzo, lista.length),
                lista: lista.slice(0, 3).map(v => v.name || '—')
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
            const locationDistinte = new Set(
                carteReali.filter(c => c.tabella === 'carte' && c.stato === 'collezione' && c.location).map(c => c.location)
            ).size;
            return { righe: [`${locationDistinte + 2} binder`] };
        },
    },
    sealed: {
        titolo: 'Sealed', icona: 'fa-box-archive',
        preview: () => {
            const prodotti = carteReali.filter(c => c.stato === 'collezione' && c.tipo === 'sealed');
            if (prodotti.length === 0) return { righe: ['Nessun prodotto'] };
            const inEvidenza = prodotti.slice().sort((a, b) => (b.price || 0) - (a.price || 0))[0];
            return { righe: [`${prodotti.length} prodotti`, inEvidenza.name || ''] };
        },
    },

    ultima_carta: {
        titolo: 'Ultima carta', icona: 'fa-clock-rotate-left',
        // Stesso ordinamento di caricaAttivitaRecentiHome in home.ui.js
        // (createdAt decrescente), qui solo la prima — dati già in
        // carteReali. Click apre il flip-modal esistente (apriFlipCardHome
        // in home.ui.js), non un popup nuovo.
        preview: () => {
            const collezione = carteReali.filter(c => c.stato === 'collezione');
            if (collezione.length === 0) return { righe: ['Nessuna carta'] };
            const ultima = collezione.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0];
            return { righe: [ultima.name || ''], immagine: ultima.immagine, cardId: ultima.id, rarita: ultima.rarita };
        },
        azione: (dati) => { if (dati && dati.cardId != null) apriFlipCardHome(dati.cardId); },
    },
    carta_del_giorno: {
        titolo: 'Carta del giorno', icona: 'fa-wand-magic-sparkles',
        // Pescata a caso una volta per sessione (non ad ogni polling, o
        // "salterebbe" ogni 15s) — vedi _cartaDelGiornoId più sotto. Click
        // apre lo stesso flip-modal riusato da tutto il sito.
        preview: () => {
            const collezione = carteReali.filter(c => c.stato === 'collezione');
            if (collezione.length === 0) return { righe: ['Nessuna carta'] };
            if (_cartaDelGiornoId == null || !collezione.find(c => String(c.id) === String(_cartaDelGiornoId))) {
                _cartaDelGiornoId = collezione[Math.floor(Math.random() * collezione.length)].id;
            }
            const carta = collezione.find(c => String(c.id) === String(_cartaDelGiornoId));
            return { righe: [carta.name || ''], immagine: carta.immagine, cardId: carta.id, rarita: carta.rarita };
        },
        azione: (dati) => { if (dati && dati.cardId != null) apriFlipCardHome(dati.cardId); },
    },
    gruppo_attivo: {
        titolo: 'Gruppo', icona: 'fa-users',
        // Riusa _dispositiviAttiviOra() (home.ui.js) — solo sì/no per
        // scelta esplicita di Claudio (privacy), non un elenco nominale.
        preview: async () => {
            const attivo = await _dispositiviAttiviOra();
            return { righe: [attivo ? 'Qualcuno al lavoro ora' : 'Nessuno al momento'], stato: attivo ? 'ok' : undefined };
        },
    },
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
    },
    suggerimento: {
        titolo: 'Prossima azione', icona: 'fa-lightbulb',
        // Stessa priorità/stessi segnali di _renderAvvisiHome in
        // home.ui.js (coda errori → wishlist sotto obiettivo → prezzi
        // scaduti → gruppo al lavoro), qui presa solo la prima voce attiva
        // invece di mostrarle tutte.
        preview: async () => {
            const codaErrori = await _contaCodaErrori();
            if (codaErrori > 0) return { righe: [`${codaErrori} carte da correggere`], stato: 'allerta', tabSuggerito: 'inserimento' };

            const wishlistSottoTarget = carteReali.filter(c => c.tabella === 'wishlist' && c.prezzoObiettivo != null && c.price > 0 && c.price <= c.prezzoObiettivo);
            if (wishlistSottoTarget.length > 0) return { righe: [`${wishlistSottoTarget.length} in wishlist sotto obiettivo`], stato: 'ok', tabSuggerito: 'binder' };

            const lista = (typeof _elencoPrezziScaduti !== 'undefined' && _elencoPrezziScaduti) ? _elencoPrezziScaduti : [];
            if (lista.length > 0) return { righe: [`${lista.length} prezzi da aggiornare`], stato: 'allerta', tabSuggerito: 'prezzi' };

            const alLavoro = await _dispositiviAttiviOra();
            if (alLavoro) return { righe: ['Il gruppo sta lavorando'], tabSuggerito: 'home' };

            return { righe: ['Tutto in ordine'], stato: 'ok', tabSuggerito: 'home' };
        },
        azione: (dati, evt) => {
            const tab = (dati && dati.tabSuggerito) || 'home';
            if (tab === 'home') { _vaiAllaPaginaHome(); return; }
            apriDettaglioWidget(tab, evt);
        },
    },
    orologio: {
        titolo: 'Orologio', icona: 'fa-clock', decorativo: true,
        preview: () => {
            const ora = new Date();
            return { righe: [ora.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })] };
        },
    },
    aggiungi_carta: {
        titolo: 'Aggiungi carta', icona: 'fa-circle-plus',
        preview: () => ({ righe: ['Scorciatoia rapida'] }),
        tab: 'inserimento',
    },
    condividi: {
        titolo: 'Condividi', icona: 'fa-share-nodes',
        // Riusa openQrModal() (navigation.ui.js) — dipende dal
        // currentMode globale già esistente per decidere quale pagina
        // pubblica condividere (scambio/wishlist/sealed). Da un widget
        // home, senza una tab attiva di riferimento, la scelta di default
        // è 'scambio' — arbitraria, dimmi se preferisci un'altra pagina o
        // un selettore.
        preview: () => ({ righe: ['Link scambio (QR)'] }),
        azione: () => { currentMode = 'scambio'; openQrModal(); },
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
        // Le vecchie tab Scambio/Wishlist non esistono più come
        // view-section dedicate dopo il Multi-Binder — il contenuto vive
        // ora dentro Binders (binder tipizzati Scambio/Wishlist).
        azione: (dati, evt) => { apriDettaglioWidget('binder', evt); },
    },
    // Sbloccato (Claudio, 2026-08-27): extension.ui.js letto per intero in
    // questa sessione. _chiediVersioneEstensione()/_chiediAiutaGruppoEstensione()
    // già esistenti lì, stessa tolleranza timeout (1.2s, mai blocca il
    // render della home) delle altre chiamate verso l'estensione — zero
    // query nuove, stessa filosofia degli altri widget.
    estensione: {
        titolo: 'Estensione', icona: 'fa-plug',
        preview: async () => {
            const versione = await _chiediVersioneEstensione();
            if (!versione) return { righe: ['Non rilevata'], rilevata: false };
            const aiutaGruppo = await _chiediAiutaGruppoEstensione();
            return {
                righe: [`v${versione}`, aiutaGruppo ? 'Aiuta il gruppo: attivo' : 'Aiuta il gruppo: no'],
                stato: aiutaGruppo ? 'ok' : undefined,
                rilevata: true,
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
};

const ORDINE_WIDGET_DEFAULT = ['visualizzazione', 'inserimento', 'prezzi', 'binder', 'sealed'];
const MAX_WIDGET_VISIBILI = 10;
const TAGLIE_CICLO = ['1x1', '2x1', '1x2', '2x2']; // ordine di ciclo del ridimensionamento

let _layoutWidget = null; // [{id, visibile, size}], ordine = ordine di visualizzazione
let _editModeWidget = false;
let _densitaCompatta = false;
let _pollingWidgetInterval = null;
let _pollingWidgetIntervalLento = null;
let _resizeCorniceTimeout = null;
let _cartaDelGiornoId = null;
let _primoRenderWidgetFatto = false; // per la cascata d'ingresso, una sola volta per sessione

// ── LAYOUT: caricamento/salvataggio per-dispositivo ──────────────────────
function _caricaLayoutWidget() {
    let salvato = null;
    try { salvato = JSON.parse(prefWidgetLayoutGet() || 'null'); } catch (_) { salvato = null; }

    if (!Array.isArray(salvato) || salvato.length === 0) {
        _layoutWidget = ORDINE_WIDGET_DEFAULT.map(id => ({ id, visibile: true, size: '1x1', mini: false }));
        return;
    }
    const validi = salvato
        .filter(w => CATALOGO_WIDGET[w.id])
        .map(w => ({ id: w.id, visibile: !!w.visibile, size: TAGLIE_CICLO.includes(w.size) ? w.size : '1x1', mini: !!w.mini }));
    Object.keys(CATALOGO_WIDGET).forEach(id => {
        if (!validi.find(w => w.id === id)) validi.push({ id, visibile: false, size: '1x1', mini: false });
    });
    _layoutWidget = validi;
}

function _salvaLayoutWidget() {
    prefWidgetLayoutSet(JSON.stringify(_layoutWidget));
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
    ultima_carta: 'Ultima',
    carta_del_giorno: 'Del giorno',
    gruppo_attivo: 'Gruppo',
    location: 'Location',
    suggerimento: 'Da fare',
    orologio: 'Orologio',
    aggiungi_carta: 'Aggiungi',
    condividi: 'Condividi',
    match: 'Match',
    estensione: 'Estensione'
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
    estensione:       { emblema: 'ingranaggio', colore: '#7A7F8A' }
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
    let ultimo = document.body.className;
    new MutationObserver(() => {
        if (document.body.className === ultimo) return;
        ultimo = document.body.className;
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
    renderWidgetHome();
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
//   - le azioni sono solo quelle verificate esistenti (apriFlipCardHome,
//     apriDettaglioWidget). Un filtro pre-applicato ("mostrami solo questa
//     location") richiederebbe funzioni di cards.ui.js/prices.ui.js, file
//     MAI letti: il gancio è pronto in _ballAzioneRiga, ma non invento nomi.
function _ballAzioneRiga(evt, tipo, valore) {
    if (evt) evt.stopPropagation();
    if (_editModeWidget) return;
    _vibraSeSupportato(8);
    switch (tipo) {
        case 'carta':
            if (typeof apriFlipCardHome === 'function') apriFlipCardHome(valore);
            break;
        case 'tab':
            apriDettaglioWidget(valore, evt);
            break;
        // GANCIO per quando avremo letto cards.ui.js / prices.ui.js: qui
        // andrà l'apertura CON filtro già applicato (per location, per
        // prezzo scaduto...). Finché non è verificato, apre la sezione.
        case 'location':
            apriDettaglioWidget('visualizzazione', evt);
            break;
    }
}

function _ballBarra(percento, etichetta, valore, azione) {
    const p = Math.max(0, Math.min(100, percento));
    const clic = azione ? ` onclick="${azione}" class="ball-riga ball-riga-clic"` : ' class="ball-riga"';
    return `<div${clic}>
        <div class="ball-riga-testa"><span>${etichetta}</span><b>${valore}</b></div>
        <div class="ball-barra"><i style="width:${p}%"></i></div>
    </div>`;
}

function _ballChip(testo, azione, forte) {
    const clic = azione ? ` onclick="${azione}"` : '';
    return `<span class="ball-chip${forte ? ' forte' : ''}"${clic}>${testo}</span>`;
}

// ── I QUATTRO CORPI ──────────────────────────────────────────────────────
const _ballCORPI = {
    // Prezzi: quanti sono aggiornati sul totale, e quali chiedono attenzione.
    // Ogni carta scaduta è una riga a sé, toccabile.
    prezzi: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const scaduti = d.scaduti || 0;
        const totale = d.totale || 0;
        const aggiornati = Math.max(0, totale - scaduti);
        const perc = totale > 0 ? (aggiornati / totale) * 100 : 100;

        const inline = scaduti === 0
            ? `<div class="ball-cifra ok">${totale}</div><div class="ball-sotto">tutti aggiornati</div>`
            : `<div class="ball-cifra allerta">${scaduti}</div><div class="ball-sotto">da aggiornare</div>`;

        let blocco = _ballBarra(perc, 'Aggiornati', `${aggiornati}/${totale}`, `_ballAzioneRiga(event,'tab','prezzi')`);
        if (d.lista && d.lista.length) {
            blocco += '<div class="ball-elenco">' + d.lista.slice(0, 3).map(v =>
                `<div class="ball-riga ball-riga-clic" onclick="_ballAzioneRiga(event,'tab','prezzi')">
                    <span class="ball-punto"></span><span class="ball-nome">${v}</span>
                 </div>`).join('') + '</div>';
        }
        return { inline, blocco };
    },

    // Visualizzazione: il totale, e le ultime carte entrate in collezione
    // come miniature — ognuna apre la sua scheda.
    visualizzazione: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const inline = `<div class="ball-cifra">${(d.totale || 0).toLocaleString('it-IT')}</div><div class="ball-sotto">carte in collezione</div>`;
        let blocco = '';
        if (d.ultime && d.ultime.length) {
            blocco = '<div class="ball-miniature">' + d.ultime.map(c =>
                `<div class="ball-mini ball-riga-clic" onclick="_ballAzioneRiga(event,'carta','${c.id}')" title="${(c.nome || '').replace(/"/g, '&quot;')}">
                    ${c.immagine ? `<img src="${_urlImmagineVisualizzabile(c.immagine, 96) || ''}" alt="" onerror="this.style.display='none';">` : '<i class="fa-solid fa-image"></i>'}
                 </div>`).join('') + '</div>';
        }
        return { inline, blocco };
    },

    // Location: dove stanno davvero le carte. Una barra per posto, in scala
    // sulla location più piena.
    location: (d) => {
        if (!d || !d.voci || !d.voci.length) return { inline: '', blocco: '' };
        const massimo = d.voci[0][1] || 1;
        const inline = `<div class="ball-cifra">${d.voci.length}</div><div class="ball-sotto">${d.voci.length === 1 ? 'posizione' : 'posizioni'}</div>`;
        const blocco = d.voci.slice(0, 4).map(([nome, n]) =>
            _ballBarra((n / massimo) * 100, nome, n, `_ballAzioneRiga(event,'location','${String(nome).replace(/'/g, "\\'")}')`)
        ).join('');
        return { inline, blocco };
    },

    // Match: scambio e wishlist separati, perché sono due cose diverse e
    // portano a due letture diverse della stessa pagina.
    match: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const totale = (d.scambio || 0) + (d.wishlist || 0);
        const inline = totale === 0
            ? '<div class="ball-cifra">0</div><div class="ball-sotto">nessuna novità</div>'
            : `<div class="ball-cifra ok">${totale}</div><div class="ball-sotto">${totale === 1 ? 'corrispondenza' : 'corrispondenze'}</div>`;
        const blocco = '<div class="ball-chips">' +
            _ballChip(`Scambio ${d.scambio || 0}`, `_ballAzioneRiga(event,'tab','binder')`, (d.scambio || 0) > 0) +
            _ballChip(`Wishlist ${d.wishlist || 0}`, `_ballAzioneRiga(event,'tab','binder')`, (d.wishlist || 0) > 0) +
            '</div>';
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

    const grid = document.getElementById('phoneWidgetGrid');
    if (!grid) return;

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
            try { anteprima = await def.preview(); } catch (e) { console.error('Errore preview widget ' + w.id + ':', e); }
        } else {
            anteprima = def.preview();
        }

        const classeStato = anteprima.stato === 'allerta' ? 'widget-tile-allerta' : (anteprima.stato === 'ok' ? 'widget-tile-ok' : '');
        const classeCascata = primoRender ? 'widget-tile-entrata' : '';
        const stileRitardo = primoRender ? `style="animation-delay:${Math.min(indice * 45, 400)}ms"` : '';

        const controlliEdit = _editModeWidget ? `
            <div class="widget-edit-controls" onclick="event.stopPropagation()">
                <button type="button" onclick="_spostaWidget(${indice}, -1)" title="Sposta su" ${indice === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
                <button type="button" onclick="_spostaWidget(${indice}, 1)" title="Sposta giù" ${indice === visibili.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
                <button type="button" onclick="_nascondiWidget('${w.id}')" title="Rimuovi dalla home" class="widget-edit-remove"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="widget-resize-handle" data-widget-id="${w.id}" title="Trascina per ridimensionare"><i class="fa-solid fa-up-right-and-down-left-from-center"></i></div>` : '';

        // Badge Pokédex sul primo numero trovato in "righe".
        // CORREZIONE 27/08/2026: la regex era /\d+/ e su "1.284 carte
        // totali" si fermava al punto, mostrando "1" invece di "1.284" —
        // succedeva su qualunque conteggio a quattro cifre. Ora tiene
        // separatori di migliaia e decimali.
        // Il badge è anche disattivabile da Impostazioni: su una tessera
        // 1x1 ripete il dato già inciso nella pancia della ball.
        const primoNumero = (anteprima.righe[0] || '').match(/\d[\d.,]*/);
        const badge = (primoNumero && prefBadgeWidgetGet()) ? `<div class="widget-badge">${primoNumero[0]}</div>` : '';

        // Bordo colorato per rarità SOLO se la carta ha davvero un campo
        // 'rarita' valorizzato (mai confermato nello schema in questa
        // sessione — nessun rischio: se il campo non esiste, la classe
        // semplicemente non si applica e resta il bordo neutro di sempre).
        const classeRarita = anteprima.rarita ? ` widget-tile-thumb-r-${String(anteprima.rarita).toLowerCase().replace(/\s+/g, '_')}` : '';
        const rigaImmagine = anteprima.immagine
            ? `<div class="widget-tile-thumb-row"><img class="widget-tile-thumb${classeRarita}" src="${_urlImmagineVisualizzabile(anteprima.immagine, 96) || ''}" alt="" onerror="this.style.display='none';"></div>`
            : '';

        const azioneClick = _editModeWidget || def.decorativo ? '' : `onclick="_eseguiAzioneWidget('${w.id}', event)"`;

        // ── VISUALE DELLA TESSERA ───────────────────────────────────────
        // Con BALL_ATTIVA la vecchia icona FontAwesome lascia il posto alla
        // sfera. Il ramo else qui sotto è il markup ORIGINALE, intatto:
        // rimettere BALL_ATTIVA a false in cima al file riporta tutto com'era.
        // I widget con immagine (Ultima carta, Carta del giorno) restano
        // senza ball e mostrano la carta, per scelta di Claudio.
        let visuale;
        if (BALL_ATTIVA && !anteprima.immagine) {
            const aspetto = _ballASPETTO[w.id] || { emblema: 'piu', colore: null };
            // L'incisione compare solo sulle 1x1: sulle altre taglie il
            // titolo per esteso sta fuori dalla ball, dove c'è spazio.
            let inciso = null;
            if (w.size === '1x1' && !w.mini && prefScritteBallGet()) {
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
        attenzioni[w.id] = _ballChiedeAttenzione(w.id, anteprima);

        // ── CORPO DELLA TESSERA ─────────────────────────────────────────
        // 1x1 e mini: solo la sfera, col titolo inciso nella pancia.
        // Taglie grandi: due slot, uno accanto alla sfera e uno sotto (il
        // secondo solo dove c'è altezza, cioè 1x2 e 2x2 — vedi il CSS).
        // Con BALL_ATTIVA a false si torna al corpo originale del sito.
        const grande = BALL_ATTIVA && w.size !== '1x1' && !w.mini;
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
            <div class="widget-tile ${classeStato} ${classeCascata} widget-size-${w.size} ${w.mini ? 'widget-tile-mini' : ''}" ${stileRitardo} data-widget-id="${w.id}" data-widget-index="${indice}" ${azioneClick}>
                ${controlliEdit}
                ${badge}
                <div class="tile-tinta"></div><div class="tile-alone"></div>
                ${corpo}
            </div>`;
    }));

    let tileAggiungi = '';
    if (_editModeWidget && visibili.length < MAX_WIDGET_VISIBILI) {
        tileAggiungi = `
            <div class="widget-tile widget-tile-aggiungi" onclick="_apriPickerAggiungiWidget()">
                <i class="fa-solid fa-plus widget-tile-icon"></i>
                <div class="widget-tile-titolo">Aggiungi</div>
            </div>`;
    }

    grid.innerHTML = tessere.join('') + tileAggiungi;
    _primoRenderWidgetFatto = true;
    _ballAttenzioni = attenzioni;

    // Aggancio del CSS della grafica ball: tutte le regole nuove in
    // index.html vivono sotto ".ball-ui", quindi spegnendo BALL_ATTIVA la
    // classe sparisce e torna in vigore da sola la resa originale.
    grid.classList.toggle('ball-ui', BALL_ATTIVA);
    // In modifica i riquadri tornano visibili (vedi .ball-ui.in-modifica-widget
    // in index.html): senza, non si capirebbe dove afferrare un widget.
    grid.classList.toggle('in-modifica-widget', _editModeWidget);

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
async function _eseguiAzioneWidget(id, evt) {
    const def = CATALOGO_WIDGET[id];
    if (!def || def.bloccato) return;

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
        try { dati = await def.preview(); } catch (_) { dati = null; }
        def.azione(dati, punto);
        return;
    }
    apriDettaglioWidget(def.tab || id, punto);
}

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

function _nascondiWidget(id) {
    const w = _layoutWidget.find(x => x.id === id);
    if (w) w.visibile = false;
    _salvaLayoutWidget();
    renderWidgetHome();
}

function _apriPickerAggiungiWidget() {
    const nascosti = _layoutWidget.filter(w => !w.visibile);
    const container = document.getElementById('widgetPickerLista');
    if (nascosti.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Nessun altro widget disponibile.</p>';
    } else {
        container.innerHTML = nascosti.map(w => `
            <div class="widget-picker-riga" onclick="_mostraWidget('${w.id}')">
                <i class="fa-solid ${CATALOGO_WIDGET[w.id].icona}"></i> ${CATALOGO_WIDGET[w.id].titolo}
            </div>`).join('');
    }
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
    const grid = document.getElementById('phoneWidgetGrid');
    const w = _layoutWidget.find(x => x.id === id);
    if (!tile || !grid || !w) return;

    const tileRect = tile.getBoundingClientRect();
    const gridStyle = getComputedStyle(grid);
    const numColonneGriglia = gridStyle.gridTemplateColumns.split(' ').filter(Boolean).length;
    const gap = parseFloat(gridStyle.columnGap) || 0;
    const rowGap = parseFloat(gridStyle.rowGap) || 0;

    // Dimensione di UNA cella dedotta dalla tessera stessa (che oggi
    // occupa 1-2 celle in ciascun asse): più affidabile che ricalcolare a
    // mano le colonne in px.
    const colSpanAttuale = (w.size === '2x1' || w.size === '2x2') ? 2 : 1;
    const rowSpanAttuale = (w.size === '1x2' || w.size === '2x2') ? 2 : 1;
    const cellW = (tileRect.width - gap * (colSpanAttuale - 1)) / colSpanAttuale;
    const cellH = (tileRect.height - rowGap * (rowSpanAttuale - 1)) / rowSpanAttuale;

    _resizeState = {
        id, originLeft: tileRect.left, originTop: tileRect.top,
        cellW, cellH, gap, rowGap,
        maxColSpan: numColonneGriglia >= 2 ? 2 : 1,
    };
    tile.classList.add('widget-tile-resizing');
    window.addEventListener('pointermove', _onResizeHandlePointerMove);
    window.addEventListener('pointerup', _onResizeHandlePointerUp, { once: true });
}

function _onResizeHandlePointerMove(e) {
    if (!_resizeState) return;
    const { id, originLeft, originTop, cellW, cellH, gap, rowGap, maxColSpan } = _resizeState;

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

    const w = _layoutWidget.find(x => x.id === id);
    if (!w) return;

    // Sotto lo zero su entrambi gli assi (l'utente ha trascinato la
    // maniglia oltre l'angolo opposto della cella) → modalità icona:
    // stessa cella 1×1, ma il contenuto si riduce a sola icona (vedi
    // .widget-tile-mini in index.html). Altrimenti dimensione normale,
    // ed uscire da mini se prima lo era.
    const vuoleMini = colSpanGrezzo <= 0 && rowSpanGrezzo <= 0;
    const colSpan = Math.max(1, Math.min(maxColSpan, colSpanGrezzo));
    const rowSpan = Math.max(1, Math.min(2, rowSpanGrezzo));
    const nuovaTaglia = vuoleMini ? '1x1' : `${colSpan}x${rowSpan}`;

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
    window.addEventListener('pointerup', _onWidgetPointerUp, { once: true });
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
        const idxA = _layoutWidget.indexOf(visibili.find(w => w.id === idA));
        const idxB = _layoutWidget.indexOf(visibili.find(w => w.id === idB));
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
}

// ── PEEK — anteprima al tocco lungo, senza aprire il popup fullscreen ────
function _mostraPeek(id, tileEl) {
    const def = CATALOGO_WIDGET[id];
    if (!def) return;
    const overlay = document.getElementById('widgetPeekOverlay');
    const rect = tileEl.getBoundingClientRect();
    overlay.innerHTML = `<div class="widget-tile-titolo"><i class="fa-solid ${def.icona}"></i> ${def.titolo}</div><div class="widget-tile-righe" id="widgetPeekRighe">Caricamento…</div>`;
    overlay.style.left = Math.max(8, Math.min(window.innerWidth - 228, rect.left)) + 'px';
    overlay.style.top = Math.max(8, rect.top - 10) + 'px';
    overlay.style.display = 'block';

    Promise.resolve(def.preview()).then(anteprima => {
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
    const schermo = document.getElementById('phoneScreen');
    const container = document.querySelector('.container');
    if (!schermo || !container) return;
    const rect = schermo.getBoundingClientRect();
    container.style.top = rect.top + 'px';
    container.style.left = rect.left + 'px';
    container.style.width = rect.width + 'px';
    container.style.height = rect.height + 'px';
    container.style.borderRadius = getComputedStyle(schermo).borderRadius;
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
    switchTab(tabId, null);
    document.body.classList.add('phone-detail-open');

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
        renderWidgetHome();
    }, DURATA_ANIMAZIONE_DETTAGLIO_MS);
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
function _impostaSyncAttivo(attivo) {
    const dot = document.getElementById('phoneSyncDot');
    if (dot) dot.classList.toggle('attivo', attivo);
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

// ── AVVIO ─────────────────────────────────────────────────────────────
async function initPhoneShell() {
    _spostaHomeNellaPaginaPrincipale();

    _caricaLayoutWidget();
    await renderWidgetHome();
    _aggiornaOrologioStatusBar();
    setInterval(_aggiornaOrologioStatusBar, 30000);

    const iconaSuoni = document.getElementById('iconaSuoniWidgetHome');
    if (iconaSuoni) iconaSuoni.className = prefSuoniWidgetGet() ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';

    avviaPollingWidgetHome();

    // ── Grafica Poké Ball ───────────────────────────────────────────────
    // Il semaforo ha un ciclo suo (5,2s), separato dal polling dei dati:
    // muovere le ball non richiede di rileggere niente, usa le attenzioni
    // già calcolate dall'ultimo render.
    if (BALL_ATTIVA) {
        _ballAvviaSemaforo();
        _ballOsservaTema();
        _ballSincronizzaToggleImpostazioni();
    }

    window.addEventListener('resize', _gestisciResizeCorniceDebounced);
    window.addEventListener('orientationchange', _gestisciResizeCornice);

    const paginaWrap = document.getElementById('phonePagineWrap');
    if (paginaWrap) paginaWrap.addEventListener('scroll', _gestisciScrollPagine, { passive: true });
    _aggiornaTastoFisico();
    _aggiornaMatitaBarraGlobale();

    // Animazione di "accensione" — una sola volta, al caricamento.
    const frameBox = document.getElementById('phoneFrameBox');
    if (frameBox) {
        frameBox.classList.add('phone-accensione');
        setTimeout(() => frameBox.classList.remove('phone-accensione'), 700);
    }
}
