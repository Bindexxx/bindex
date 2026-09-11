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
