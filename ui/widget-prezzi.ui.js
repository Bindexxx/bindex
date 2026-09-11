// ═══════════════════════════════════════════════════════════════════════
// WIDGET-PREZZI.UI.JS — tessere "Prezzi" + "Prezzi aggiornati" (CardSync
// Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP 16 della ristrutturazione file widget home (vedi
// Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md). Estratto da
// ui/phone.ui.js il 2026-09-11. NESSUNA riscrittura del codice esistente:
// solo spostamento, zero cambi di comportamento per l'utente finale.
//
// CATEGORIA C per entrambe le tessere: nessuna pagina propria — 'prezzi'
// apre la tab "Prezzi" già esistente (una delle 5 fisse del sito, l'id
// coincide col nome della tab quindi non serve nemmeno il campo 'tab' nel
// catalogo), 'prezzi_recenti' pure ('tab': 'prezzi', stessa destinazione).
//
// CONSOLIDAMENTO FATTO IN QUESTO STEP (richiesto dalla roadmap, §6):
// l'alert "prezzo obiettivo raggiunto" (_alertPrezzoVisti,
// _segnaAlertPrezzoVisti, _cardeConAllertaPrezzo, _contaAlertPrezzoNonVisti)
// viveva dentro ui/queue.ui.js insieme al match automatico, ma è
// concettualmente del dominio Prezzi/Wishlist-prezzo, non "coda
// correzioni carte". Spostate qui le 4 funzioni (verificato: usate SOLO
// dentro queue.ui.js, nessun altro file le chiama). NON spostata la
// LOGICA che le usa (aggiornaBadgeMatch()/caricaMatch() restano in
// queue.ui.js: calcolano insieme match E alert prezzo per un unico badge
// combinato sulla tab Wishlist — separarle avrebbe richiesto riscrivere
// quella logica, fuori scope per un semplice spostamento file). Le
// chiamate da queue.ui.js a queste 4 funzioni ora sono cross-file: stesso
// meccanismo già usato ovunque in questa ristrutturazione (scope globale
// condiviso, invocate solo a runtime dopo che tutti gli script sono
// caricati — mai a tempo di parsing).
//
// COSA RESTA FUORI (non spostato qui, invariato):
// - aggiornaBadgeMatch(), caricaMatch(), tutto il resto di
//   ui/queue.ui.js — non toccato se non per la rimozione delle 4
//   funzioni spostate sopra.
// - _elencoPrezziScaduti, caricaAvvisiHome(), avviaPollingWidgetHome()
//   (ui/paginainiziale.ui.js) — motore home, non toccato.
// - _ultimiPrezziAggiornati (ui/home.ui.js): esterna, non toccata.
// - _ballCORPI.prezzi / _ballCORPI.prezzi_recenti / _ballASPETTO.* /
//   _ballTITOLI_BREVI.* (ui/widget-render-condiviso.ui.js) — motore
//   visivo, non toccato.
// ───────────────────────────────────────────────────────────────────────

// ── ALERT PREZZO OBIETTIVO — spostate da ui/queue.ui.js (STEP 16) ───────
// ── ALLERTA PREZZO WISHLIST — stesso sistema letto/non letto ──────────────
// Una carta in wishlist "scatta" quando il prezzo attuale scende al
// di sotto (o è uguale) al prezzo obiettivo che hai impostato —
// stesso calcolo già usato per il badge "🎯 obiettivo!" nelle righe.
function _alertPrezzoVisti() {
    return prefAlertPrezzoVistiGet();
}

function _segnaAlertPrezzoVisti(chiavi) {
    const visti = _alertPrezzoVisti();
    chiavi.forEach(c => visti.add(c));
    prefAlertPrezzoVistiSet(visti);
}

function _cardeConAllertaPrezzo() {
    return carteReali.filter(c => c.tabella === 'wishlist' && c.prezzoObiettivo != null && c.price > 0 && c.price <= c.prezzoObiettivo);
}

function _contaAlertPrezzoNonVisti() {
    const visti = _alertPrezzoVisti();
    const conCard = _cardeConAllertaPrezzo();
    const nonVisti = conCard.filter(c => !visti.has(String(c.id)));
    // AGGIUNTO (2026-09-01): nonVistiCarte espone le carte vere, non
    // solo il conteggio — serve alle notifiche di sistema per dire
    // QUALE carta ha raggiunto il prezzo obiettivo. Additivo, non
    // rompe i due punti di chiamata esistenti (che leggono solo
    // count/chiavi).
    return { count: nonVisti.length, chiavi: conCard.map(c => String(c.id)), nonVistiCarte: nonVisti };
}

// ── VOCE DI CATALOGO "PREZZI" ────────────────────────────────────────
CATALOGO_WIDGET.prezzi = {
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
};

// ── VOCE DI CATALOGO "PREZZI AGGIORNATI" ─────────────────────────────
CATALOGO_WIDGET.prezzi_recenti = {
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
};

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
