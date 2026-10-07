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
        // Restyle FASE 2 (2026-09-30): titolo corto, come nelle tavole
        // ("Contributi al gruppo" non stava accanto alla sfera).
        titolo: 'Contributi', icona: 'fa-hands-helping',
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
            if (!d) return { righe: ['Dati non disponibili'], dati: null };
            // Nessun badge: un conteggio di contributi non è un'azione.
            const perc = d.gruppo ? Math.round((d.miei / d.gruppo) * 100) : null;
            return {
                righe: [perc != null ? `${perc}% dei controlli` : `${d.miei} cart${d.miei === 1 ? 'a' : 'e'} per il gruppo`],
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
    // "zero", e' proprio l'assenza di risposta (RPC caduta, non autenticato).
    if (!d) {
        container.innerHTML = `
            <div class="page-header">
                <span class="page-title">Contributi al gruppo</span>
            </div>
            <div class="stato-vuoto"><i class="fa-solid fa-triangle-exclamation"></i><br>Dati non disponibili al momento.</div>
        `;
        return;
    }

    // RESTYLE BINDEX FASE 3i (2026-10-01, tavola "Contributi al gruppo"):
    // anello con la quota, frase, due riquadri, "Come funziona" e la scheda
    // "Aiuta il gruppo". Dato AGGREGATO (miei/gruppo): mai nomi né confronti
    // con una persona, come da vincolo di visibilità intermedia.
    // "Tre zeri" = stato reale finché nessuno lavora righe altrui: niente
    // "0% del gruppo", che si leggerebbe come un rimprovero.
    const perc = d.gruppo ? Math.round((d.miei / d.gruppo) * 100) : null;
    const anello = perc == null
        ? `<div class="ct-anello ct-vuoto"><div class="ct-anello-dentro"><i class="fa-solid fa-hands-helping"></i></div></div>`
        : `<div class="ct-anello" style="--ct-perc:${Math.min(100, perc)};"><div class="ct-anello-dentro"><b>${perc}%</b><span>del gruppo</span></div></div>`;
    const frase = perc == null
        ? `<b>Primi contributi in arrivo</b><span>Quando lavori la coda di qualcun altro, compare qui.</span>`
        : (perc > 50
            ? `<b>${d.miei} cart${d.miei === 1 ? 'a' : 'e'} su ${d.gruppo}</b><span>Stai facendo più della metà del lavoro del gruppo.</span>`
            : `<b>${d.miei} cart${d.miei === 1 ? 'a' : 'e'} su ${d.gruppo}</b><span>controllate da te per il gruppo, sul totale lavorato per altri.</span>`);
    const passo = (n, testo) => `<div class="ct-passo"><span>${n}</span><p>${testo}</p></div>`;

    container.innerHTML = `
        <div class="ct-pagina">
            <div class="page-header">
                <span class="page-title">Contributi al gruppo</span>
            </div>
            <div class="ct-quota">${anello}<div class="ct-frase">${frase}</div></div>
            <div class="ct-stat">
                <div><b>${d.miei}</b><span>cart${d.miei === 1 ? 'a lavorata' : 'e lavorate'} per altri</span></div>
                <div><b>${d.personeAiutate}</b><span>person${d.personeAiutate === 1 ? 'a aiutata' : 'e aiutate'}</span></div>
            </div>
            <div class="ct-scheda">
                <h4>Come funziona</h4>
                ${passo(1, 'Attiva “Aiuta il gruppo” nell’estensione')}
                ${passo(2, 'L’estensione lavora da sola la coda di un altro')}
                ${passo(3, 'Ogni carta lavorata per un altro conta qui. Le tue righe non contano.')}
            </div>
            <div class="ct-scheda ct-aiuta">
                <div class="ct-aiuta-ico"><i class="fa-solid fa-hands-helping"></i></div>
                <div><b>Aiuta il gruppo</b><span>Si attiva dall’estensione, in Impostazioni › Account e dati.</span></div>
            </div>
        </div>
    `;
}
