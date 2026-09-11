// ═══════════════════════════════════════════════════════════════════════
// WIDGET-BINDER.UI.JS — tessera "Binders" (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP 3 della ristrutturazione file widget home (vedi
// Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md). Estratto da
// ui/phone.ui.js il 2026-09-11.
//
// CATEGORIA B (come da roadmap §2, decisione confermata da Claudio): il
// widget "Binders" NON ha una pagina propria scritta dentro i widget —
// apre la pagina Binder già esistente altrove nel sito (ui/binder.ui.js,
// render tramite switchTab('binder', null), lo stesso meccanismo delle 5
// tab fisse del sito). Questo file contiene SOLO ciò che viveva in
// phone.ui.js: l'anteprima nella tessera (preview) e la voce di
// CATALOGO_WIDGET. Il click continua a funzionare come prima — NESSUNA
// pagina spostata qui, sarebbe un cambio di comportamento fuori scope.
//
// Il caricamento dei dati veri del binder all'apertura (apriWidgetBinders())
// resta nel motore home (ui/paginainiziale.ui.js, dentro apriDettaglioWidget,
// ramo "if (tabId === 'binder')") — non toccato in questo step, comportamento
// identico a prima.
//
// _ballCORPI.binder (il corpo grande della tessera) resta in
// ui/widget-render-condiviso.ui.js — verificato che la forma dei 'dati'
// letti lì (d.totale, d.voci) combacia esattamente con quella restituita
// dal preview() qui sotto: nessuna modifica necessaria.
//
// Caricato in ordine alfabetico sul titolo mostrato in home, dopo i tre
// file motore/condivisi (paginainiziale, widget-render-condiviso,
// widget-funzioni-condivise) — vedi index.html.
// ───────────────────────────────────────────────────────────────────────

// Multi-Binder (2026-08-25): 'scambio' e 'wishlist' come widget home
// separati sono stati rimossi — puntavano a switchTab('scambio'/
// 'wishlist'), view-section che non esistono più in index.html (solo 5
// restano: visualizzazione/inserimento/prezzi/binder/impostazioni).
// Erano già inattivi prima di questa sessione. Il loro contenuto vive
// ora dentro il widget "Binders" sotto, come binder dedicati.
CATALOGO_WIDGET.binder = {
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
};
