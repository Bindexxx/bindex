// ── ui/impostazioni.ui.js ───────────────────────────────────────────────
// Fase 10 (2026-09-13). Router minimo per il nuovo hub Impostazioni — MAI
// switchTab() qui: quella funzione ha una whitelist fissa di 5 tab ed è
// segnata nella memoria di progetto come "stabile e intoccata" (un bug
// reale c'è già stato lì in passato). #impostazioni resta UNA sola
// view-section (stessa esatta di sempre, raggiunta come prima tramite
// apriDettaglioWidget('impostazioni') → switchTab('impostazioni', null),
// invariato) — hub e sotto-pagine sono semplici div dentro di essa,
// mostrate/nascoste da queste due funzioni soltanto.

// RESTYLE BINDEX: su PC (pagina larga, stessa soglia del @container in
// index.css) il menu resta a sinistra e la sotto-pagina si apre a destra.
function _impostazioniEPC() {
    const pg = document.getElementById('impostazioni');
    return !!pg && pg.clientWidth >= 780;
}

// RESTYLE TAVOLA (2026-10-01): 8 gruppi (profilo, aspetto, home,
// animazioni, notifiche, gruppo, account, info). Sul telefono si vedono
// tutti uno sotto l'altro: _impostazioniApri porta al gruppo e ne apre le
// voci; su PC mostra solo quel gruppo a destra e segna la voce del menu.
// I vecchi nomi di sotto-pagina restano accettati (stessa destinazione).
const _IMPOSTAZIONI_ALIAS = {
    suoni: 'notifiche', tema: 'aspetto', accessibilita: 'animazioni', connessioni: 'gruppo',
    dati: 'account', generali: 'home', bug: 'info',
};
let _impostazioniGruppo = 'aspetto';

function _impostazioniApri(pagina) {
    const gruppo = _IMPOSTAZIONI_ALIAS[pagina] || pagina;
    _impostazioniGruppo = gruppo;
    const pc = _impostazioniEPC();
    document.querySelectorAll('#impostazioni .imp-menu button[data-gruppo]').forEach(b => {
        b.classList.toggle('attivo', b.dataset.gruppo === gruppo);
    });
    document.querySelectorAll('#impostazioni .imp-gruppo').forEach(g => {
        g.classList.toggle('attivo', g.dataset.gruppo === gruppo);
    });
    const target = document.getElementById('impostazioniPagina-' + gruppo);
    if (!pc && target) {
        // Telefono: apri le voci del gruppo e portalo in vista.
        target.querySelectorAll('.imp-voce.espandibile').forEach(v => v.classList.add('aperta'));
        target.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
    _impostazioniAlMostrare(gruppo);
}

// Cose da rileggere quando un gruppo diventa visibile (prima lo faceva
// _impostazioniApri per la singola sotto-pagina, stessa logica).
function _impostazioniAlMostrare(gruppo) {
    if (gruppo === 'notifiche') {
        const checkbox = document.getElementById('suoniAppToggle');
        if (checkbox && typeof prefSuoniWidgetGet === 'function') checkbox.checked = prefSuoniWidgetGet();
    }
    if (gruppo === 'profilo') {
        if (typeof fotoProfiloRenderImpostazioni === 'function') fotoProfiloRenderImpostazioni();
        if (typeof _nicknameCaricaSeVuoto === 'function') _nicknameCaricaSeVuoto();
    }
    if (gruppo === 'gruppo') {
        _connessioniRicontrolla();
        _impostazioniAggiornaDiagnostica();
    }
}

// Telefono: tocco su una voce con più campi = apri/chiudi il suo corpo.
// Su PC i corpi sono sempre aperti (CSS), il tocco non cambia nulla.
function _impostazioniEspandi(voce) {
    if (!voce || _impostazioniEPC()) return;
    const aperta = voce.classList.toggle('aperta');
    if (aperta && voce.classList.contains('imp-profilo')) _impostazioniAlMostrare('profilo');
}

// PC: ricerca nel menu — mostra tutti i gruppi e solo le voci che
// contengono il testo; vuota = torna al gruppo scelto.
function _impostazioniCerca(testo) {
    const q = String(testo || '').trim().toLowerCase();
    const gruppi = document.querySelector('#impostazioni .imp-gruppi');
    if (!gruppi) return;
    gruppi.classList.toggle('cercando', !!q);
    document.querySelectorAll('#impostazioni .imp-menu button[data-gruppo]').forEach(b => {
        b.classList.toggle('attivo', !q && b.dataset.gruppo === _impostazioniGruppo);
    });
    gruppi.querySelectorAll('.imp-gruppo').forEach(g => {
        let trovate = 0;
        g.querySelectorAll('.imp-voce').forEach(v => {
            const corpo = v.classList.contains('espandibile') ? v.nextElementSibling : null;
            const testoVoce = (v.textContent + ' ' + (corpo ? corpo.textContent : '')).toLowerCase();
            const ok = !q || testoVoce.includes(q) || g.querySelector('.imp-gruppo-titolo').textContent.toLowerCase().includes(q);
            v.classList.toggle('imp-nascosta', !ok);
            if (corpo) corpo.classList.toggle('imp-nascosta', !ok);
            if (ok) trovate++;
        });
        g.classList.toggle('imp-nascosta', !!q && !trovate);
    });
}

// Riga profilo in cima: iniziale (o foto approvata) e nome mostrato.
async function _impostazioniProfiloRiepilogo() {
    const nomeEl = document.getElementById('impProfiloNome');
    const iniz = document.getElementById('impProfiloIniziale');
    if (!nomeEl || !iniz) return;
    try {
        const userId = await authGetUserId();
        if (!userId) return;
        const [{ data: prefs }, sessione] = await Promise.all([
            userSettingsGet(userId),
            typeof authGetSession === 'function' ? authGetSession() : Promise.resolve(null),
        ]);
        const email = sessione && sessione.user ? (sessione.user.email || '') : '';
        const nome = (prefs && prefs.nickname) || email.split('@')[0] || 'Il tuo profilo';
        nomeEl.textContent = nome;
        iniz.textContent = nome.charAt(0).toUpperCase();
    } catch (e) {
        console.error('[impostazioni] riepilogo profilo:', e);
    }
}

let _impostazioniEhAdmin = null; // cache: null = non ancora verificato

async function _impostazioniControllaAdmin() {
    if (_impostazioniEhAdmin !== null) return _impostazioniEhAdmin;
    try {
        const userId = await authGetUserId();
        if (!userId || typeof authGetRuolo !== 'function') { _impostazioniEhAdmin = false; return false; }
        const { data, error } = await authGetRuolo(userId);
        _impostazioniEhAdmin = !error && !!data && data.role === 'admin';
    } catch (_) {
        _impostazioniEhAdmin = false;
    }
    return _impostazioniEhAdmin;
}

async function _impostazioniAggiornaDiagnostica() {
    const card = document.getElementById('impostazioniDiagnosticaCard');
    if (!card) return;
    const ehAdmin = await _impostazioniControllaAdmin();
    card.style.display = ehAdmin ? '' : 'none';
    if (ehAdmin) {
        const viewer = document.getElementById('impostazioniLogViewer');
        if (viewer && typeof _logDiagnosticoTesto === 'function') viewer.textContent = _logDiagnosticoTesto(80);
    }
}

function _impostazioniCopiaLog() {
    if (typeof _logDiagnosticoTesto !== 'function' || typeof _logDiagnosticoInfoDispositivo !== 'function') return;
    const testo = _logDiagnosticoInfoDispositivo() + '\n\n--- Log ---\n' + _logDiagnosticoTesto(80);
    navigator.clipboard.writeText(testo).then(() => {
        alert('📋 Log copiato negli appunti.');
    }).catch(() => {
        alert(testo); // fallback se il clipboard non è disponibile
    });
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
            const { error } = await preferenzeUtentePing(); // data/user-settings.repository.js (audit 2026-09-25, B8)
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
    const cerca = document.getElementById('impCerca');
    if (cerca && cerca.value) { cerca.value = ''; _impostazioniCerca(''); }
    _impostazioniProfiloRiepilogo();
    if (_impostazioniEPC()) {
        // PC: a destra non resta mai vuoto — si riparte da Aspetto.
        _impostazioniApri('aspetto');
        return;
    }
    // Telefono: tutto l'elenco, voci con più campi chiuse, dall'inizio.
    document.querySelectorAll('#impostazioni .imp-voce.espandibile.aperta').forEach(v => v.classList.remove('aperta'));
    _impostazioniAlMostrare('notifiche');
}
