// ── ui/wip.ui.js ────────────────────────────────────────────────────────
// Fase 11 (2026-09-13). Work in Progress — verificato in UN SOLO punto:
// apriDettaglioWidget() (ui/paginainiziale-dettaglio.ui.js), il funnel
// unico per aprire QUALUNQUE widget o pagina di dettaglio del sito. Un
// solo controllo copre 'widget' E 'pagina' insieme, gli stessi id già
// usati ovunque nel resto del progetto (CATALOGO_WIDGET/tabId).
//
// SCOPE DICHIARATO DI QUESTO GIRO: 'binder_speciale' e 'funzione' sono
// già gestibili dal pannello admin (creabili/attivabili), MA NON ANCORA
// verificati da nessun punto del client — servirebbe agganciare ogni
// singola azione sensibile (creazione binder Scambio, invio richiesta,
// ecc.) uno per uno, lavoro deliberatamente rimandato per non rischiare
// regressioni sparse in un solo giro (Regola d'Oro #4). L'infrastruttura
// (_wipVerifica) è pronta e riusabile quando si vorrà estendere.
//
// Il widget in sé RESTA VISIBILE nella griglia Home (roadmap: "non
// sparisce") — vero automaticamente: questo file interviene SOLO al
// click (apertura), mai sul rendering della tessera in
// ui/paginainiziale-render.ui.js, che non è stato toccato.

let _wipAttiviMap = new Map(); // chiave "tipo:id" -> riga work_in_progress
let _wipResolveFn = null;

async function _wipCaricaCache() {
    try {
        const { data, error } = await wipListaAttivi();
        if (error) { console.error('[WIP] errore caricamento:', error.message); return; }
        _wipAttiviMap = new Map((data || []).map(r => [`${r.target_tipo}:${r.target_id}`, r]));
    } catch (e) {
        console.error('[WIP] errore caricamento:', e);
    }
}

function _wipVerifica(targetTipo, targetId) {
    return _wipAttiviMap.get(`${targetTipo}:${targetId}`) || null;
}

// Ritorna una Promise<boolean>: true = procedi ad aprire il contenuto
// reale (solo se admin e ha scelto "Apri comunque"), false = resta
// bloccato. Un solo modale condiviso, mai più di un WIP alla volta
// (apriDettaglioWidget è sempre una chiamata alla volta).
function _wipMostraBlocco(wip, ehAdmin) {
    return new Promise((resolve) => {
        _wipResolveFn = resolve;
        const testo = document.getElementById('wipModalTesto');
        if (testo) testo.textContent = wip.messaggio;
        const bypassBtn = document.getElementById('wipModalBypassBtn');
        if (bypassBtn) bypassBtn.style.display = ehAdmin ? '' : 'none';
        const modale = document.getElementById('wipModal');
        if (modale) modale.style.display = 'flex';
    });
}

function _wipChiudiModale(procedi) {
    const modale = document.getElementById('wipModal');
    if (modale) modale.style.display = 'none';
    if (_wipResolveFn) { _wipResolveFn(!!procedi); _wipResolveFn = null; }
}
