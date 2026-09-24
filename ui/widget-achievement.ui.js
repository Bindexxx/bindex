// ── ui/widget-achievement.ui.js ────────────────────────────────────────────
// Fase 9 (2026-09-13). Sola lettura sul lato dati — nessuna scrittura
// diretta di sblocchi qui, per design (vedi data/achievement.repository.js).
//
// RISCRITTO (2026-09-25, Milestones = Achievement — decisione di Claudio in
// sessione: "le milestones devono essere quelle che vengono contate nel
// widget achievement... i traguardi con Achievement a cui mancano gli
// achievement"). Achievement ora mostra TUTTI i traguardi di
// CATALOGO_TRAGUARDI (ui/missioni-catalogo.ui.js, 121 voci: 10 scale +
// TRAGUARDI_SINGOLI) — prima solo i 37 curati a mano in
// achievement_catalogo. Dove esiste una riga curata vince il suo
// titolo/rarità (37 oggi), altrove titolo dal traguardo + rarità calcolata
// con la stessa identica regola già in uso nei 37 curati (verificata per
// comparazione in sessione, non inventata) — vedi
// ui/widget-funzioni-condivise.ui.js (_achievementCostruisciCatalogo/
// _achievementRaritaCalcolata).
//
// Sblocco: da traguardi_riscossi (missioniTraguardiRiscossiIdTotale,
// data/missioni.repository.js), non più da achievement_sbloccati — stesso
// dato scritto da riscatta_traguardo(), una tabella in meno da tenere
// sincronizzata (la RPC non scrive più in achievement_sbloccati da questa
// sessione, vedi sql/73_rimuovi_scrittura_achievement_orfana.sql).
//
// INVARIATO rispetto a prima (2026-09-18): tessere isolate in classi
// proprie .achievement-grid/.achievement-slot-* (CSS in index.html, subito
// dopo .binder-slot-locked). Griglia normale reattiva via --ball-misura,
// griglia Vetrina fissa e più grande. Tre viste raggruppate per rarità
// (Tutti/Ottenuti/Non ottenuti) + Vetrina a sé (tetto 3). Lucchetto
// anonimo "mascherati per sorpresa" per il non sbloccato — INVARIATO
// anche con "Tutti": niente icona di categoria visibile da bloccato,
// stesso trattamento di sempre (Claudio, sessione 2026-09-25: "rimaniamo
// fedeli a ciò che già è stato fatto in achievement").
//
// NUOVO in fondo al file: popup di sblocco (badge+confetti stile trofeo
// Xbox), chiamato da _missioniNotificaCompletamenti() (ui/missioni.ui.js)
// per ogni nuovo traguardo — cross-file, risolto a tempo di chiamata come
// da convenzione del progetto. Markup/CSS in index.html
// (#achievementSbloccatoOverlay, classi .achievement-popup-*).

CATALOGO_WIDGET.achievement = {
    titolo: 'Achievement', icona: 'fa-trophy',
    tab: 'achievement',
    preview: async () => {
        const userId = await authGetUserId();
        if (!userId) return { righe: ['—'], dati: {} };
        const { data: sbloccati, error: errSb } = await missioniTraguardiRiscossiIdTotale(userId);
        if (errSb) return { righe: ['—'], dati: {} };
        const totale = CATALOGO_TRAGUARDI.length;
        const posseduti = (sbloccati || []).length;
        return { righe: [`${posseduti}/${totale} sbloccati`], dati: { totale, posseduti } };
    },
    azione: (dati, evt) => { apriDettaglioWidget('achievement', evt); },
};

// Claudio, 2026-09-18: "SOLO nella vetrina saranno 3" — prima era 16
// (pensato per un binder-grid-4x4 pieno che qui non esiste più). Invariato
// dopo il passaggio a "Tutti": il tetto della Vetrina è una scelta di
// spazio visivo, non legata a quanti achievement esistono nel catalogo.
const ACHIEVEMENT_VETRINA_MAX = 3;

let _achievementTabAttiva = 'tutti'; // 'tutti' | 'ottenuti' | 'non_ottenuti' | 'vetrina'
let _achievementCatalogo = [];
let _achievementSbloccatiSet = new Set();
let _achievementSbloccatiData = {}; // id -> riscosso_il
let _achievementVetrinaIds = [];

const _ACHIEVEMENT_RARITA_LABEL = { leggendaria: 'Leggendarie', rara: 'Rare', comune: 'Comuni' };
const _ACHIEVEMENT_RARITA_ORDINE = ['leggendaria', 'rara', 'comune'];

// Catalogo unito (curati + calcolati) — chiamata al repository isolata
// qui, non dentro widget-funzioni-condivise (mai supabaseClient fuori dai
// repository, pattern fisso del progetto).
async function _achievementCaricaCatalogoUnito() {
    const { data: curati, error } = await achievementCatalogoList();
    if (error) console.warn('[achievement] catalogo curato non disponibile, uso solo calcolato:', error.message);
    return _achievementCostruisciCatalogo(curati || []);
}

async function renderPaginaAchievement() {
    const container = document.getElementById('achievementContenuto');
    if (!container) return;
    container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:2rem 0;"><i class="fa-solid fa-spinner fa-spin"></i> Caricamento...</p>';

    const userId = await authGetUserId();
    if (!userId) return;

    const [catalogoUnito, { data: sbloccati, error: errSb }, { data: prefsRow }] = await Promise.all([
        _achievementCaricaCatalogoUnito(),
        missioniTraguardiRiscossiIdTotale(userId),
        userSettingsGet(userId),
    ]);

    if (errSb) {
        container.innerHTML = '<p style="text-align:center; color:var(--danger); padding:2rem 0;">Errore nel caricamento.</p>';
        return;
    }

    _achievementCatalogo = catalogoUnito;
    _achievementSbloccatiSet = new Set((sbloccati || []).map(s => s.traguardo_id));
    _achievementSbloccatiData = {};
    (sbloccati || []).forEach(s => { _achievementSbloccatiData[s.traguardo_id] = s.riscosso_il; });
    try {
        _achievementVetrinaIds = (prefsRow && prefsRow.achievement_vetrina) ? JSON.parse(prefsRow.achievement_vetrina) : [];
    } catch (_) { _achievementVetrinaIds = []; }

    _achievementTabAttiva = 'tutti';
    container.innerHTML = `
        <div class="page-header">
            <span class="page-title">Achievement</span>
        </div>
        <div class="binder-modalita-toggle">
            <button type="button" class="binder-modalita-btn active" data-atab="tutti" onclick="_achievementImpostaTab('tutti')">Tutti</button>
            <button type="button" class="binder-modalita-btn" data-atab="ottenuti" onclick="_achievementImpostaTab('ottenuti')">Ottenuti</button>
            <button type="button" class="binder-modalita-btn" data-atab="non_ottenuti" onclick="_achievementImpostaTab('non_ottenuti')">Non ottenuti</button>
            <button type="button" class="binder-modalita-btn" data-atab="vetrina" onclick="_achievementImpostaTab('vetrina')">Vetrina</button>
        </div>
        <div id="achievementListaWrap"></div>
    `;
    _achievementRenderLista();
}

function _achievementImpostaTab(tab) {
    _achievementTabAttiva = tab;
    document.querySelectorAll('#achievementContenuto .binder-modalita-btn[data-atab]').forEach(el => {
        el.classList.toggle('active', el.dataset.atab === tab);
    });
    _achievementRenderLista();
}

// Non sbloccato: NESSUN titolo, solo rarità/lucchetto — "mascherati per
// sorpresa" (roadmap, invariato dopo il passaggio a "Tutti", Claudio
// 2026-09-25). nome_file è sempre NULL per i traguardi calcolati (mai
// curati manualmente), e NULL o valorizzato per i 37 curati a seconda di
// achievement_catalogo: quando ci saranno immagini reali, qui va aggiunto
// un <img> con fallback su questa stessa icona trofeo.
function _achievementCard(a) {
    const sbloccato = _achievementSbloccatiSet.has(a.id);
    if (!sbloccato) {
        return `<div class="achievement-slot achievement-slot-locked" title="Achievement non ancora sbloccato (${_ACHIEVEMENT_RARITA_LABEL[a.rarita] || a.rarita})">
            <i class="fa-solid fa-lock"></i>
        </div>`;
    }
    const inVetrina = _achievementVetrinaIds.includes(a.id);
    const dataSbloccato = _achievementSbloccatiData[a.id] ? new Date(_achievementSbloccatiData[a.id]).toLocaleDateString('it-IT') : '';
    const titoloAttr = escapeHtml(a.titolo);
    return `<div class="achievement-slot achievement-slot-filled" onclick="_achievementToggleVetrina('${a.id}')" title="${titoloAttr} — sbloccato il ${dataSbloccato}${inVetrina ? ' (in vetrina, tocca per rimuovere)' : ' (tocca per aggiungere alla vetrina)'}">
        <div class="achievement-slot-fallback"><i class="fa-solid fa-trophy"></i><span>${titoloAttr}</span></div>
        ${inVetrina ? '<span class="achievement-slot-qty-badge"><i class="fa-solid fa-star"></i></span>' : ''}
    </div>`;
}

// Elenco raggruppato per rarità, riusato da 'tutti'/'ottenuti'/
// 'non_ottenuti' — cambia solo il filtro passato, il resto (ordine
// rarità, conteggio per fascia) è identico. Leggendarie per prime.
// INVARIATA nella logica — opera ora sull'array unito (curati + calcolati,
// 121 voci), non più sul solo elenco curato (37).
function _achievementListaPerRarita(filtro) {
    let html = '';
    _ACHIEVEMENT_RARITA_ORDINE.forEach(rar => {
        const voci = _achievementCatalogo.filter(a => a.rarita === rar && filtro(a));
        if (voci.length === 0) return;
        const sbloccatiN = voci.filter(a => _achievementSbloccatiSet.has(a.id)).length;
        html += `<div class="pg-titoletto">${_ACHIEVEMENT_RARITA_LABEL[rar]} — ${sbloccatiN}/${voci.length}</div>
            <div class="achievement-grid">${voci.map(_achievementCard).join('')}</div>`;
    });
    return html;
}

function _achievementRenderLista() {
    const wrap = document.getElementById('achievementListaWrap');
    if (!wrap) return;

    if (_achievementTabAttiva === 'vetrina') {
        const selezionati = _achievementCatalogo.filter(a => _achievementVetrinaIds.includes(a.id));
        if (selezionati.length === 0) {
            wrap.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:2rem 0;">Nessun achievement in vetrina.<br><small>Vai su "Tutti" e tocca un achievement sbloccato per aggiungerlo.</small></p>';
            return;
        }
        wrap.innerHTML = `<div class="achievement-vetrina-grid">${selezionati.map(_achievementCard).join('')}</div>`;
        return;
    }

    if (_achievementTabAttiva === 'ottenuti') {
        const html = _achievementListaPerRarita(a => _achievementSbloccatiSet.has(a.id));
        wrap.innerHTML = html || '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:2rem 0;">Nessun achievement ottenuto ancora.</p>';
        return;
    }

    if (_achievementTabAttiva === 'non_ottenuti') {
        const html = _achievementListaPerRarita(a => !_achievementSbloccatiSet.has(a.id));
        wrap.innerHTML = html || '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:2rem 0;">Li hai ottenuti tutti!</p>';
        return;
    }

    // 'tutti'
    wrap.innerHTML = _achievementListaPerRarita(() => true);
}

async function _achievementToggleVetrina(id) {
    if (!_achievementSbloccatiSet.has(id)) return; // sicurezza — i lucchetti non hanno onclick, non dovrebbe mai capitare
    const userId = await authGetUserId();
    if (!userId) return;

    const giaDentro = _achievementVetrinaIds.includes(id);
    if (giaDentro) {
        _achievementVetrinaIds = _achievementVetrinaIds.filter(x => x !== id);
    } else {
        if (_achievementVetrinaIds.length >= ACHIEVEMENT_VETRINA_MAX) {
            alert(`La Vetrina può contenere al massimo ${ACHIEVEMENT_VETRINA_MAX} achievement — togline uno prima di aggiungerne un altro.`);
            return;
        }
        _achievementVetrinaIds.push(id);
    }

    const { error } = await userSettingsUpsertAchievementVetrina(userId, _achievementVetrinaIds);
    if (error) console.error('[achievement] salvataggio vetrina:', error.message); // non bloccante, la UI resta comunque aggiornata localmente

    _achievementRenderLista();
}

// ── POPUP DI SBLOCCO (NUOVO, 2026-09-25) ────────────────────────────────
// Stile trofeo Xbox richiesto da Claudio: badge + confetti + eyebrow
// "Traguardo sbloccato" — chiamata da _missioniNotificaCompletamenti()
// (ui/missioni.ui.js) per ogni traguardo appena riscosso, fire-and-forget
// (non blocca quella funzione). Markup/CSS in index.html.
//
// La rarità mostrata segue la STESSA regola del catalogo: se il traguardo
// è tra i 37 curati vince quella rarità, altrimenti quella calcolata —
// una query in più ad achievement_catalogo, ma solo quando scatta davvero
// uno sblocco (evento raro), non ad ogni giro del motore.
async function _achievementNotificaSblocco(traguardo) {
    let rarita = 'comune', titolo = traguardo.titolo;
    try {
        const { data: curati } = await achievementCatalogoList();
        const c = (curati || []).find(a => a.id === traguardo.id);
        if (c) {
            rarita = c.rarita; titolo = c.titolo;
        } else if (typeof _achievementRaritaCalcolata === 'function') {
            rarita = _achievementRaritaCalcolata()[traguardo.id] || 'comune';
        }
    } catch (e) {
        console.error('[achievement] lookup rarità per popup:', e);
    }
    _achievementMostraOverlaySblocco(titolo, rarita);
}

let _achievementPopupTimeout = null;

function _achievementMostraOverlaySblocco(titolo, rarita) {
    const overlay = document.getElementById('achievementSbloccatoOverlay');
    const card = document.getElementById('achievementPopupCard');
    const titoloEl = document.getElementById('achievementPopupTitolo');
    const confettiWrap = document.getElementById('achievementPopupConfetti');
    if (!overlay || !card || !titoloEl) return;

    titoloEl.textContent = titolo;
    card.className = 'achievement-popup-card rarita-' + (rarita || 'comune');

    // Confetti generati al volo — posizione/colore/ritardo random via
    // variabili inline, nessuna libreria esterna. Rispetta
    // body.senza-anim-widget (CSS in index.html: display:none sui pezzi),
    // stessa preferenza già rispettata da _beep()/altre animazioni widget.
    if (confettiWrap) {
        confettiWrap.innerHTML = '';
        const colori = ['#F2C230', 'var(--primary)', '#2E9E5F', '#ffffff'];
        for (let i = 0; i < 18; i++) {
            const pezzo = document.createElement('span');
            pezzo.className = 'achievement-popup-confetto';
            pezzo.style.left = (Math.random() * 100) + '%';
            pezzo.style.background = colori[i % colori.length];
            pezzo.style.animationDelay = (Math.random() * 0.3) + 's';
            pezzo.style.setProperty('--rot', (Math.random() * 360) + 'deg');
            confettiWrap.appendChild(pezzo);
        }
    }

    overlay.classList.add('mostrato');
    overlay.onclick = _achievementChiudiOverlaySblocco;

    clearTimeout(_achievementPopupTimeout);
    _achievementPopupTimeout = setTimeout(_achievementChiudiOverlaySblocco, 3200);
}

function _achievementChiudiOverlaySblocco() {
    const overlay = document.getElementById('achievementSbloccatoOverlay');
    if (overlay) overlay.classList.remove('mostrato');
    clearTimeout(_achievementPopupTimeout);
}
