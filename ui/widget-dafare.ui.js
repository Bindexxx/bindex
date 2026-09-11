// ═══════════════════════════════════════════════════════════════════════
// WIDGET-DAFARE.UI.JS — tessera "Prossima azione" + pagina "Da Fare"
// (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP 7 della ristrutturazione file widget home (vedi
// Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md). Estratto da
// ui/phone.ui.js il 2026-09-11. NESSUNA riscrittura: solo spostamento di
// codice, zero cambi di comportamento per l'utente finale.
//
// CATEGORIA A: id catalogo 'suggerimento' (titolo tessera "Prossima
// azione"), apre la pagina "Da Fare" (#dafare). Unificati dal 2026-08-28
// (Claudio: "saranno la stessa cosa") — renderPaginaDaFare() riusa
// CATALOGO_WIDGET.suggerimento.preview() come unica fonte dei segnali,
// zero duplicazione. Per questo la voce di catalogo e la pagina vivono
// nello stesso file, a differenza di altri widget dove sono più separate.
//
// Include anche lo STORICO "DA FARE" (24h): _daFareUltimoStato,
// FINESTRA_STORICO_DAFARE_MS, _rilevaTransizioniDaFare,
// _segnaDaFareRisolto — usati solo da questo widget (verificato).
//
// COSA RESTA FUORI (non spostato qui, invariato):
// - apriDettaglioWidget (ui/paginainiziale.ui.js) continua a chiamare
//   renderPaginaDaFare() per tabId === 'dafare' — motore home, dispatch
//   generico, non toccato in questo step.
// - _ballCORPI.suggerimento / _ballASPETTO.suggerimento / _ballTITOLI_BREVI
//   .suggerimento (ui/widget-render-condiviso.ui.js) — motore visivo, non
//   toccato.
// - _contaCodaErrori, _elencoPrezziScaduti, _dispositiviAttiviOra: esterne,
//   vivono in ui/home.ui.js (vecchio file, non toccato da questa
//   ristrutturazione).
// ───────────────────────────────────────────────────────────────────────
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

// ── VOCE DI CATALOGO ──────────────────────────────────────────────────
CATALOGO_WIDGET.suggerimento = {
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
};

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
