// ═══════════════════════════════════════════════════════════════════════
// WIDGET-CONTRIBUTI.UI.JS — tessera "Contributi al gruppo" (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP 6 della ristrutturazione file widget home (vedi
// Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md). Estratto da
// ui/phone.ui.js il 2026-09-11. NESSUNA riscrittura: solo spostamento di
// codice, zero cambi di comportamento per l'utente finale.
//
// CATEGORIA C — PUNTO APERTO §7.1 della roadmap. VERIFICATO dal vivo da
// Claudio (2026-09-11) E confermato leggendo navigation.ui.js per intero:
// il click sulla tessera NON apre "nulla" (previsione iniziale sbagliata,
// corretta qui) — apre la pagina VISUALIZZAZIONE. Causa reale: switchTab()
// (ui/navigation.ui.js) attiva INCONDIZIONATAMENTE #visualizzazione ad
// ogni chiamata (prima di qualunque controllo su tabId), e la sostituisce
// con la tab giusta SOLO se tabId è una delle 5 note (visualizzazione/
// inserimento/prezzi/impostazioni/binder/home). 'contributi' non è tra
// queste, quindi quella riga non viene mai sovrascritta: Visualizzazione
// resta visibile come fallback silenzioso. La voce di catalogo qui sotto
// non ha né 'azione' né 'tab' — comportamento preesistente, non introdotto
// da questa ristrutturazione, NON corretto qui senza autorizzazione
// esplicita. Stessa causa vale probabilmente anche per "Variazione
// valore" (§7.2 della roadmap, STEP 19) — da confermare quando ci si
// arriva.
//
// AGGIORNATO (Claudio, 2026-09-11): confermato dal vivo che il click
// ricadeva su Visualizzazione (vedi sopra). Placeholder temporaneo:
// 'azione' con un semplice alert "work in progress", in attesa di
// decidere la destinazione vera.
//
// RISOLTO (sessione 2026-09-24): tolto l'alert, aggiunta pagina di
// dettaglio dedicata — stesso pattern già usato da 'valore'/'achievement'/
// 'primopiano' (tab: 'contributi' nel catalogo, view-section in
// index.html, whitelist di apriDettaglioWidget() in
// paginainiziale-dettaglio.ui.js — MAI switchTab(), whitelist diversa).
// Mostra solo i 3 numeri già letti da _contributiConCache() qui sotto,
// con più spazio/contesto rispetto alla tessera. NESSUNO storico nel
// tempo: verificato dal vivo (Regola d'Oro #3) che activity_log con
// action='aiuto_gruppo' è oggi a ZERO righe in produzione — il test
// disponibile ha usato un solo account, e la RPC scarta esplicitamente
// il caso "owner della riga aiutata == chi la lavora" (non è un
// contributo). Un vero storico richiede prima almeno un test con due
// account diversi che generi una riga reale — vedi compilato di sessione.
// _contributiConCache/_cacheContributi/TTL_CONTRIBUTI_MS: verificato che
// sono usate SOLO dal preview() di questo widget (un solo chiamante) —
// non qualificano come "funzione condivisa fra più widget", restano qui
// invece di andare in widget-funzioni-condivise.ui.js.
//
// _ballCORPI.contributi esiste (ui/widget-render-condiviso.ui.js, motore
// visivo, non toccato in questo step) — legge d.miei, d.personeAiutate,
// d.gruppo dal 'dati' restituito dal preview() qui sotto: forma confermata
// coerente, nessuna modifica necessaria.
// ───────────────────────────────────────────────────────────────────────

// ── VOCE DI CATALOGO ──────────────────────────────────────────────────
    // Sostituisce il segnaposto "I tuoi contributi al gruppo — presto
    // disponibili" della home fissa. Il dato ora esiste (migration 37) e lo
    // scrive l'ESTENSIONE, non il sito: qui si legge soltanto.
    // LIVELLO DI VISIBILITA' INTERMEDIO, deciso da Claudio: il proprio
    // numero e il totale del gruppo, mai chi ha fatto quanto. Non
    // aggiungere qui un elenco per utente: il vincolo vive nella RPC, ma
    // romperlo comincerebbe da questa voce.
CATALOGO_WIDGET.contributi = {
        titolo: 'Contributi al gruppo', icona: 'fa-hands-helping',
        // Due numeri affiancati piu' la barra della quota: sotto questa
        // altezza la barra finisce appiccicata ai numeri.
        tagliaDefault: '6x4',
        // Pagina di dettaglio dedicata (sessione 2026-09-24) — vedi
        // renderPaginaContributi() in fondo a questo file e la
        // view-section #contributi in index.html. Sostituisce il
        // placeholder alert() dell'11/09.
        tab: 'contributi',
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
};

// ── CACHE (TTL 5 minuti) ─────────────────────────────────────────────
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

// ── PAGINA DI DETTAGLIO (sessione 2026-09-24) ────────────────────────────
// Riempita in #contributiContenuto (index.html, view-section #contributi),
// aperta da apriDettaglioWidget('contributi', ...) via la voce 'tab' nel
// catalogo qui sopra. RIUSA _contributiConCache(): stessa cache 5 minuti
// della tessera, nessuna richiesta "sempre fresca" — vedi nota TTL sopra,
// il dato si muove raramente e il piano Supabase e' free.
//
// STESSO VINCOLO INTERMEDIO della tessera: solo 'miei' e 'gruppo', MAI un
// elenco per persona. 'personeAiutate' e' un conteggio (quante persone
// diverse), non un elenco di CHI — resta ammesso.
//
// NESSUNO STORICO: la RPC leggi_contributi_gruppo() non ha dimensione
// temporale (somma tutto activity_log da sempre in un numero solo) e in
// produzione non esiste ancora una riga reale da mostrare (vedi header del
// file). Quando esistera' un test vero con due account diversi, si potra'
// valutare una RPC nuova (es. leggi_contributi_gruppo_storico(), raggruppata
// per data — MAI per persona) senza toccare leggi_contributi_gruppo().
async function renderPaginaContributi() {
    const container = document.getElementById('contributiContenuto');
    if (!container) return;

    let d;
    try {
        d = await _contributiConCache();
    } catch (e) {
        console.error('renderPaginaContributi:', e);
        d = null;
    }

    // DATO ASSENTE — stessa distinzione della tessera: non e' un errore
    // "zero", e' proprio l'assenza di risposta (RPC caduta, non
    // autenticato). Stesso testo/stile di errore di renderPaginaValoreCollezione.
    if (!d) {
        container.innerHTML = `
            <div class="page-header">
                <span class="page-title">Contributi al gruppo</span>
            </div>
            <p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Dati non disponibili al momento.</p>
        `;
        return;
    }

    // Stesso ramo "tre zeri legittimi" della tessera (_ballCORPI.contributi
    // in widget-render-corpi.ui.js): qui niente calcolo di percentuale,
    // niente "0% del lavoro del gruppo" che si legge come un rimprovero.
    // AGGIUNTA (mockup approvato da Claudio, sessione 2026-09-24): icona
    // grande fa-hands-helping al posto dello spazio vuoto sotto la barra
    // — stessa icona già assegnata al widget nel catalogo qui sopra,
    // Font Awesome caricato globalmente in index.html (riga 14).
    const barraHtml = !d.gruppo
        ? `<div class="pg-barra-track"><div class="pg-barra-fill" style="width:0%"></div></div>
           <div class="pg-sotto" style="text-align:center; margin-top:6px;">Primi contributi in arrivo.</div>
           <div style="text-align:center; padding:22px 0 6px;"><i class="fa-solid fa-hands-helping" style="font-size:2.75rem; color:var(--primary-light);"></i></div>`
        : (() => {
            const perc = Math.round((d.miei / d.gruppo) * 100);
            // AGGIUNTA (mockup approvato): sopra il 50% una frase invece
            // del numero secco — resta un dato AGGREGATO (miei/gruppo),
            // non tocca il vincolo INTERMEDIO: nessun nome, nessun
            // confronto con una persona specifica del gruppo.
            const etichetta = perc > 50
                ? 'Stai facendo più della metà del lavoro del gruppo'
                : `${perc}% del lavoro del gruppo`;
            return `<div class="pg-barra-track"><div class="pg-barra-fill" style="width:${perc}%"></div></div>
                    <div class="pg-sotto" style="text-align:center; margin-top:6px;">${etichetta}</div>`;
        })();

    // AGGIUNTA (mockup approvato): tre passi "come funziona" al posto
    // della sola riga di testo — stesso var(--primary)/var(--primary-light)
    // del tema, nessuna classe CSS nuova.
    const passo = (n, testo) => `
        <div style="display:flex; gap:8px; align-items:flex-start; font-size:0.78rem; color:var(--text-dark); margin-bottom:6px;">
            <span style="flex-shrink:0; width:18px; height:18px; border-radius:50%; background:var(--primary-light); color:var(--primary-dark); font-size:0.68rem; font-weight:700; display:flex; align-items:center; justify-content:center; margin-top:1px;">${n}</span>
            <span>${testo}</span>
        </div>`;
    const comeFunzionaHtml = passo(1, 'Attiva "Aiuta il gruppo" nell\'estensione')
        + passo(2, "L'estensione lavora in autonomia la coda di un altro")
        + passo(3, 'Ogni carta lavorata per un altro conta qui sotto');

    container.innerHTML = `
        <div class="page-header">
            <span class="page-title">Contributi al gruppo</span>
        </div>
        <div class="pg-pagina">
            <div class="pg-intro">
                <div class="pg-sotto">Quando lavori la coda di carte di qualcun altro del gruppo con "Aiuta il gruppo" attivo nell'estensione, conta come contributo qui sotto. Lavorare le tue righe non conta.</div>
            </div>
            <div class="pg-titoletto">Come funziona</div>
            ${comeFunzionaHtml}
            <div class="pg-stat">
                <div><b>${d.miei}</b><span>Cart${d.miei === 1 ? 'a' : 'e'} lavorate per altri</span></div>
                <div><b>${d.personeAiutate}</b><span>Person${d.personeAiutate === 1 ? 'a' : 'e'} aiutate</span></div>
            </div>
            <div class="pg-titoletto">Quota sul lavoro del gruppo</div>
            ${barraHtml}
        </div>
    `;
}
