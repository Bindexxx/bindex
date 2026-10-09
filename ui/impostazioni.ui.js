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

// RESTYLE TAVOLA (2026-10-01): 7 gruppi (profilo, aspetto, home,
// animazioni, notifiche, account, info; 'Gruppo e connessioni' rimosso
// 2026-10-05, le sue voci utili sono in 'account'). Sul telefono si vedono
// tutti uno sotto l'altro: _impostazioniApri porta al gruppo e ne apre le
// voci; su PC mostra solo quel gruppo a destra e segna la voce del menu.
// I vecchi nomi di sotto-pagina restano accettati (stessa destinazione).
const _IMPOSTAZIONI_ALIAS = {
    suoni: 'notifiche', tema: 'aspetto', accessibilita: 'animazioni', connessioni: 'account', gruppo: 'account',
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
    if (gruppo === 'account') {
        _impostazioniAggiornaDiagnostica(); // card Diagnostica: solo admin
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

function _impostazioniTornaHub() {
    if (typeof importCsvChiudi === 'function') importCsvChiudi(); // riaprendo si riparte dalle impostazioni (non durante un invio)
    const cerca = document.getElementById('impCerca');
    if (cerca && cerca.value) { cerca.value = ''; _impostazioniCerca(''); }
    _impostazioniProfiloRiepilogo();
    _impostazioniCompila();
    if (_impostazioniEPC()) {
        // PC: a destra non resta mai vuoto — si riparte da Aspetto.
        _impostazioniApri('aspetto');
        return;
    }
    // Telefono: tutto l'elenco, voci con più campi chiuse, dall'inizio.
    document.querySelectorAll('#impostazioni .imp-voce.espandibile.aperta').forEach(v => v.classList.remove('aperta'));
    _impostazioniAlMostrare('notifiche');
}

// ── VOCI NUOVE DELLE TAVOLE (2026-10-01) ───────────────────────────────
// Sfere e skin, scorciatoie della tendina, badge a numero/pallino, banner
// (quali e dove), suono, vibrazione, anteprime e prove. Tutte preferenze
// di QUESTO dispositivo (data/preferences.repository.js e le impostazioni
// interne di CSBar in statusbar.js). _scorciatoieAggiorna e
// _impSincronizzaControlli stanno in ui/paginainiziale-polling-avvio.ui.js.

const _IMP_SUONI_ETICHETTE = { pokeball: 'Poké Ball', gameboy: 'Game Boy', cristallo: 'Cristallo', tamburo: 'Tamburo', nessuno: 'Nessuno' };
const _IMP_ANTEPRIMA_HOME = ['valore_collezione', 'prezzi_recenti', 'missioni', 'chat', 'match', 'wishlist_obiettivi'];

// Riempie i controlli nuovi con lo stato vero (chiamata all'apertura).
function _impostazioniCompila() {
    const badge = document.getElementById('impBadgeStile');
    if (badge) badge.value = !prefBadgeWidgetGet() ? 'nascosto' : prefBadgeStileGet();
    const banner = document.getElementById('impBanner');
    if (banner) banner.value = prefBannerGet();
    const ambitoPrezzi = document.getElementById('impAmbitoPrezzi');
    if (ambitoPrezzi) ambitoPrezzi.value = prefAmbitoPrezziGet();
    const pos = document.getElementById('impBannerPos');
    if (pos) pos.value = prefBannerPosGet();
    const suono = document.getElementById('impSuono');
    if (suono && typeof CSBar !== 'undefined' && CSBar.getSounds) {
        suono.innerHTML = CSBar.getSounds().map(id => `<option value="${id}">${escapeHtml(_IMP_SUONI_ETICHETTE[id] || id)}</option>`).join('');
        suono.value = CSBar.getSound();
    }
    const vib = document.getElementById('impVibrazione');
    if (vib && typeof CSBar !== 'undefined' && CSBar.getSetting) vib.checked = CSBar.getSetting('vibrazione');
    // Senza supporto del browser (iPhone/iPad, molti PC) la voce non serve.
    const rigaVib = vib && vib.closest('label');
    if (rigaVib) rigaVib.style.display = _vibrazioneSupportata() ? '' : 'none';
    _impScorciatoieRender();
    _impAnteprime();
}

// Sfere e skin: si attivano dallo Zaino dello Shop (stessi dati, nessun
// doppione qui).
function _impApriZaino() {
    apriDettaglioWidget('shop');
    setTimeout(() => { if (typeof shopScheda === 'function') shopScheda('zaino'); }, 400);
}

// ── Scorciatoie della tendina ──
function _impScorciatoieRender() {
    const box = document.getElementById('impScorciatoieLista');
    const n = document.getElementById('impScorciatoieN');
    if (typeof _SCORCIATOIE_TENDINA === 'undefined') return;
    const scelte = prefScorciatoieGet();
    if (n) n.textContent = String(scelte.filter(_scorciatoiaDisponibile).length);
    if (!box) return;
    // Prima quelle scelte (nel loro ordine), poi le altre.
    const ordine = [...scelte.filter(_scorciatoiaDisponibile), ...Object.keys(_SCORCIATOIE_TENDINA).filter(id => !scelte.includes(id) && _scorciatoiaDisponibile(id))];
    box.innerHTML = ordine.map(id => {
        const d = _SCORCIATOIE_TENDINA[id];
        const on = scelte.includes(id);
        return `<label class="imp-scorciatoia${on ? ' on' : ''}"><input type="checkbox" ${on ? 'checked' : ''} onchange="_impScorciatoieCambia('${id}', this.checked)"><span class="imp-scorciatoia-glifo">${escapeHtml(d.glyph)}</span>${escapeHtml(d.label)}</label>`;
    }).join('');
}

function _impScorciatoieCambia(id, on) {
    let scelte = prefScorciatoieGet().filter(x => x !== id);
    if (on) scelte.push(id);
    if (scelte.length > 8) scelte = scelte.slice(-8); // due righe da quattro
    prefScorciatoieSet(scelte);
    _impScorciatoieRender();
    if (typeof _scorciatoieAggiorna === 'function') _scorciatoieAggiorna();
}

// ── Badge sulle sfere: numero / pallino / nascosto ──
function _impApplicaBadgeStile() {
    document.body.classList.toggle('badge-pallino', prefBadgeStileGet() === 'pallino');
}

function _impBadgeCambia(valore) {
    if (valore === 'nascosto') toggleBadgeWidget(false);
    else {
        prefBadgeStileSet(valore);
        _impApplicaBadgeStile();
        toggleBadgeWidget(true);
    }
    if (typeof _impSincronizzaControlli === 'function') _impSincronizzaControlli();
}

// ── Controllo prezzi: di chi (2026-10-09, prima era nella pagina Controllo prezzi) ──
function _impAmbitoPrezziCambia(valore) {
    prefAmbitoPrezziSet(valore);
    _impostaAmbitoControlloPrezzi(valore);
    _impostaAmbitoControlloPrezziSealed(valore);
    if (typeof prezziMostraDiChi === 'function') prezziMostraDiChi();
}

// ── Banner ──
function _impBannerCambia(valore) { prefBannerSet(valore); }

function _impApplicaBannerPos() {
    document.body.classList.toggle('banner-basso', prefBannerPosGet() === 'basso');
}

function _impBannerPosCambia(valore) {
    prefBannerPosSet(valore);
    _impApplicaBannerPos();
    _impProvaBanner();
}

function _impProvaBanner() {
    if (typeof CSBar === 'undefined' || !CSBar.provaBanner) return;
    CSBar.provaBanner({ title: 'Irene ti ha scritto', text: 'Ce l\'hai ancora il Moonbreon?', icon: '●' });
}

// ── Suono e vibrazione (impostazioni interne della tendina) ──
function _impSuonoCambia(valore) {
    if (typeof CSBar !== 'undefined' && CSBar.setSound) CSBar.setSound(valore, true);
}

function _impProvaSuono() {
    if (typeof CSBar !== 'undefined' && CSBar.playSound) CSBar.playSound();
}

function _impVibrazioneCambia(on) {
    if (typeof CSBar === 'undefined' || !CSBar.setSetting) return;
    CSBar.setSetting('vibrazione', on);
    if (on) { try { if (navigator.vibrate) navigator.vibrate(25); } catch (_) { /* non supportata */ } }
    if (typeof _scorciatoieAggiorna === 'function') _scorciatoieAggiorna();
}

// ── Anteprime (sfere vere, stesso disegno della Home) ──
// _ballSvgCache restituisce la STESSA stringa per sfere uguali: inserita piu'
// volte nella pagina (anteprima Aspetto, anteprima Home, Prova cattura, Home
// vera) ripete gli stessi id dei gradienti, e il browser li risolve sul
// primo elemento trovato — se sta in un gruppo nascosto (display:none) la
// sfera resta senza riempimento, cioe' trasparente. Qui ogni copia
// dell'anteprima riceve id propri.
let _impSvgContatore = 0;
function _impSvgIdUnici(svg) {
    const suffisso = '-i' + (++_impSvgContatore);
    return String(svg).replace(/\bid="([^"]+)"/g, (m, id) => `id="${id}${suffisso}"`)
        .replace(/url\(#([^)]+)\)/g, (m, id) => `url(#${id}${suffisso})`)
        .replace(/href="#([^"]+)"/g, (m, id) => `href="#${id}${suffisso}"`);
}

function _impBallHtml(id, opz) {
    const o = opz || {};
    if (typeof _ballSvgCache !== 'function') return '';
    const asp = (typeof _ballASPETTO !== 'undefined' && _ballASPETTO[id]) || { emblema: 'piu', colore: null };
    const def = (typeof CATALOGO_WIDGET !== 'undefined' && CATALOGO_WIDGET[id]) || { titolo: '' };
    const inciso = o.scritte && prefScritteBallGet() ? ((typeof _ballTITOLI_BREVI !== 'undefined' && _ballTITOLI_BREVI[id]) || def.titolo) : null;
    const badge = o.badge != null && prefBadgeWidgetGet() ? `<div class="widget-badge">${o.badge}</div>` : '';
    return `<div class="imp-ball" data-id="${id}">
        <div class="pkdx-icon-wrap"><div class="pkdx-ball">
            <span class="pkdx-ball-glow"></span>
            <span class="pkdx-dust"></span>
            <span class="ball-shadow"></span>
            <div class="pkdx-ball-body">${_impSvgIdUnici(_ballSvgCache(asp.emblema, asp.colore, inciso))}</div>
            <div class="ball-glass"><div class="ball-sweep"></div></div>
            <span class="pkdx-lock-ring"></span>
            <span class="pkdx-lock-ring ring-2"></span>
            ${typeof _ballParticelle === 'function' ? _ballParticelle() : ''}
        </div>${badge}</div>
        ${o.etichetta ? `<span class="imp-ball-nome">${escapeHtml(def.titolo || '')}</span>` : ''}
    </div>`;
}

function _impAnteprime() {
    if (typeof _ballSvutaCache === 'function') _ballSvutaCache(); // colori/scritte appena cambiati
    const aspetto = document.getElementById('impAnteprimaAspetto');
    if (aspetto) {
        const misura = parseInt(document.getElementById('temaDiametroWidget')?.value, 10) || 90;
        aspetto.classList.add('ball-ui');
        aspetto.style.setProperty('--imp-ball', misura + 'px'); // misura reale: l'anteprima mostra davvero la dimensione scelta
        aspetto.innerHTML = ['missioni', 'chat', 'match'].map(id => _impBallHtml(id, {})).join('');
        const nota = document.getElementById('impAnteprimaAspettoNota');
        const testo = document.getElementById('temaDiametroAnteprimaTesto');
        if (nota) nota.textContent = `Sfere da ${misura} px. ${testo ? testo.textContent : ''}`.trim();
    }
    const home = document.getElementById('impAnteprimaHome');
    if (home) {
        home.classList.add('ball-ui');
        const badge = [null, 3, 1, 2, 1, null];
        home.innerHTML = _IMP_ANTEPRIMA_HOME.map((id, i) => _impBallHtml(id, { scritte: true, badge: badge[i], etichetta: true })).join('');
    }
    const prova = document.getElementById('impProvaCattura');
    if (prova && !prova.dataset.inCorso) {
        prova.classList.add('ball-ui');
        prova.innerHTML = _impBallHtml('missioni', {});
    }
}

// Prova la cattura sulla sfera del pannello, anche con l'animazione spenta
// (è una prova): stessa _ballGiocaCattura della Home.
async function _impProvaCattura() {
    const prova = document.getElementById('impProvaCattura');
    if (!prova || prova.dataset.inCorso || typeof _ballGiocaCattura !== 'function') return;
    _impAnteprime();
    const tile = prova.querySelector('.imp-ball');
    if (!tile) return;
    prova.dataset.inCorso = '1';
    const anim = prefAnimWidgetGet(), cattura = prefAnimCatturaGet(), ridotte = prefRiduciAnimazioniGet();
    try {
        if (ridotte) { prefRiduciAnimazioniSet(false); _ballApplicaClasseAnimazioni(); } // la prova la fa vedere comunque
        if (!anim) prefAnimWidgetSet(true);
        if (!cattura) prefAnimCatturaSet(true);
        await _ballGiocaCattura(tile);
    } catch (e) {
        console.error('[impostazioni] prova cattura:', e);
    } finally {
        prefAnimWidgetSet(anim);
        prefAnimCatturaSet(cattura);
        if (ridotte) { prefRiduciAnimazioniSet(true); _ballApplicaClasseAnimazioni(); }
        delete prova.dataset.inCorso;
    }
}
