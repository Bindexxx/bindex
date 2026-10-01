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
// RESTYLE BINDEX FASE 2 (2026-09-30, file 02 § 1: "conteggio vero dei
// binder, oggi stima dalle location"). La stima di prima (location distinte
// in carteReali + 2) sbagliava in entrambi i sensi: ignorava il binder
// Scambio e le location senza carte, contava come binder le location che
// il sito non ha ancora materializzato. Ora si conta ESATTAMENTE ciò che
// mostra la pagina Binders dopo _garantisciTuttiIBinder (ui/binder.ui.js):
// le righe di 'binders' + ciò che quella funzione creerebbe all'apertura
// (una location senza binder, o wishlist/extra/scambio non ancora creati).
// Qui si LEGGE soltanto, non si crea niente (la creazione resta alla
// pagina Binders, come oggi).
// Costo: due select leggere, al massimo una volta al minuto (cache sotto):
// il render della home gira ogni 15s e rifare le query ogni volta sarebbe
// traffico inutile.
let _widgetBinderCache = null; // { quando, binders, nomiLocation }
const _WIDGET_BINDER_CACHE_MS = 60000;

async function _widgetBinderLeggi() {
    if (_widgetBinderCache && Date.now() - _widgetBinderCache.quando < _WIDGET_BINDER_CACHE_MS) return _widgetBinderCache;
    const userId = await authGetUserId();
    if (!userId) return null;
    const [rb, rl] = await Promise.all([bindersQueryTutti(userId), locationsList(userId)]);
    if (rb.error) { console.error('[widget-binder] binders:', rb.error.message); return null; }
    if (rl.error) console.error('[widget-binder] location:', rl.error.message);
    _widgetBinderCache = {
        quando: Date.now(),
        binders: rb.data || [],
        nomiLocation: (rl.data || []).map(l => l.nome).filter(Boolean),
    };
    return _widgetBinderCache;
}

// Ordine delle copertine in tessera: prima quelli speciali, poi le location
// (stesso ordine logico della pagina: Scambio, Wishlist, il mio binder).
const _WIDGET_BINDER_ORDINE = { scambio: 0, wishlist: 1, extra: 2, location: 3 };

CATALOGO_WIDGET.binder = {
    titolo: 'Binders', icona: 'fa-layer-group',
    preview: async () => {
        const d = await _widgetBinderLeggi();
        if (!d) return { righe: ['—'], dati: null };
        const tipi = new Set(d.binders.map(b => b.tipo));
        const materializzate = new Set(d.binders.filter(b => b.tipo === 'location').map(b => b.location_valore));
        const mancanti = d.nomiLocation.filter(n => !materializzate.has(n)).length
            + ['wishlist', 'extra', 'scambio'].filter(t => !tipi.has(t)).length;
        const totale = d.binders.length + mancanti;
        const pubblici = d.binders.filter(b => b.stato_pubblicazione === 'pubblico').length;
        const copertine = d.binders.slice()
            .sort((a, b) => (_WIDGET_BINDER_ORDINE[a.tipo] ?? 9) - (_WIDGET_BINDER_ORDINE[b.tipo] ?? 9) || String(a.nome || '').localeCompare(String(b.nome || '')))
            .map(b => ({ nome: b.nome || '', tipo: b.tipo, colore: b.colore || null, pubblico: b.stato_pubblicazione === 'pubblico' }));
        return {
            righe: [`${totale} binder${pubblici ? ` · ${pubblici} pubblic${pubblici === 1 ? 'o' : 'i'}` : ''}`],
            dati: { totale, pubblici, copertine },
        };
    },
};
