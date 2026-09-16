// ── ui/impostazioni.ui.js ───────────────────────────────────────────────
// Fase 10 (2026-09-13). Router minimo per il nuovo hub Impostazioni — MAI
// switchTab() qui: quella funzione ha una whitelist fissa di 5 tab ed è
// segnata nella memoria di progetto come "stabile e intoccata" (un bug
// reale c'è già stato lì in passato). #impostazioni resta UNA sola
// view-section (stessa esatta di sempre, raggiunta come prima tramite
// apriDettaglioWidget('impostazioni') → switchTab('impostazioni', null),
// invariato) — hub e sotto-pagine sono semplici div dentro di essa,
// mostrate/nascoste da queste due funzioni soltanto.

function _impostazioniApri(pagina) {
    const hub = document.getElementById('impostazioniHub');
    if (hub) hub.style.display = 'none';
    document.querySelectorAll('#impostazioni [id^="impostazioniPagina-"]').forEach(el => { el.style.display = 'none'; });
    const target = document.getElementById('impostazioniPagina-' + pagina);
    if (target) target.style.display = '';

    // Inizializza lo stato del checkbox Suoni all'apertura di quella
    // pagina — toggleSuoniWidgetHome() lo tiene sincronizzato DOPO,
    // ma qui serve leggerlo la prima volta (il checkbox non esiste
    // finché la pagina non è aperta almeno una volta).
    if (pagina === 'suoni') {
        const checkbox = document.getElementById('suoniAppToggle');
        if (checkbox) checkbox.checked = prefSuoniWidgetGet();
    }
    if (pagina === 'connessioni') {
        _connessioniRicontrolla();
    }
}

// ═══════════════════════════════════════════════════════════════════════
// FASE 10, STEP 2 (2026-09-13) — CONNESSIONI
// ═══════════════════════════════════════════════════════════════════════
// Stato "semplice" per l'utente normale (roadmap: "utente normale vede
// stato connessione semplice; admin vede diagnostica e Report to admin"
// — la parte admin/diagnostica arriva nello Step 3, qui solo lo stato
// base uguale per tutti). Ogni controllo è indipendente: un servizio giù
// non deve mai bloccare la lettura degli altri tre (Promise.allSettled,
// non Promise.all).

function _badgeConnessione(elId, classe, testo) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.className = 'badge-connessione' + (classe ? ' ' + classe : '');
    el.textContent = testo;
}

async function _connessioniRicontrolla() {
    _badgeConnessione('statoConnSupabase', '', 'Verifica...');
    _badgeConnessione('statoConnEstensione', '', 'Verifica...');
    _badgeConnessione('statoConnPresenza', '', 'Verifica...');
    _badgeConnessione('statoConnWorker', '', 'Verifica...');

    // Supabase — query minima (HEAD, nessuna riga scaricata) solo per
    // verificare che risponda. Qualunque tabella con RLS "solo mie righe"
    // va bene: una risposta (anche 0 righe) prova che DB+auth funzionano,
    // un errore di rete/auth invece lancia.
    (async () => {
        try {
            const { error } = await supabaseClient.from('preferenze_utente').select('owner_id', { count: 'exact', head: true });
            _badgeConnessione('statoConnSupabase', error ? 'errore' : 'ok', error ? 'Non raggiungibile' : 'Connesso');
        } catch (_) {
            _badgeConnessione('statoConnSupabase', 'errore', 'Non raggiungibile');
        }
    })();

    // Estensione — riusa _chiediVersioneEstensione() già esistente
    // (ui/extension.ui.js), stesso identico ping già usato altrove: zero
    // logica di rilevamento duplicata.
    (async () => {
        if (typeof _chiediVersioneEstensione !== 'function') {
            _badgeConnessione('statoConnEstensione', 'boh', 'Non disponibile qui');
            return;
        }
        const versione = await _chiediVersioneEstensione();
        _badgeConnessione('statoConnEstensione', versione ? 'ok' : 'boh', versione ? `v${versione}` : 'Non rilevata');
    })();

    // Presenza — SOLA LETTURA dello stato dell'unico canale Realtime già
    // sottoscritto da _avviaPresenzaLive() (ui/paginainiziale-polling-
    // avvio.ui.js) — mai una seconda subscribe qui.
    if (typeof _ultimoStatoPresenzaRealtime !== 'undefined' && _ultimoStatoPresenzaRealtime === 'ok') {
        _badgeConnessione('statoConnPresenza', 'ok', 'Attiva');
    } else if (typeof _ultimoStatoPresenzaRealtime !== 'undefined' && _ultimoStatoPresenzaRealtime === 'errore') {
        _badgeConnessione('statoConnPresenza', 'errore', 'Non disponibile');
    } else {
        _badgeConnessione('statoConnPresenza', 'boh', 'In corso...');
    }

    // Worker del gruppo — riusa claimGruppoStato() già esistente
    // (data/prices.repository.js), stessa RPC già usata dal Centro
    // operativo per il segnale "il gruppo sta lavorando". Nessun
    // parametro: la RPC applica da sé la soglia di 10 minuti di default
    // (vedi fix del bug SOGLIA_MINUTI_CLAIM_PREZZI in ui/home.ui.js).
    (async () => {
        try {
            const { data, error } = await claimGruppoStato();
            if (error) { _badgeConnessione('statoConnWorker', 'errore', 'Non verificabile'); return; }
            const n = (data || []).length;
            _badgeConnessione('statoConnWorker', n > 0 ? 'ok' : 'boh', n > 0 ? `${n} attiv${n === 1 ? 'o' : 'i'}` : 'Nessuno ora');
        } catch (_) {
            _badgeConnessione('statoConnWorker', 'errore', 'Non verificabile');
        }
    })();
}

function _impostazioniTornaHub() {
    document.querySelectorAll('#impostazioni [id^="impostazioniPagina-"]').forEach(el => { el.style.display = 'none'; });
    const hub = document.getElementById('impostazioniHub');
    if (hub) hub.style.display = '';
}
