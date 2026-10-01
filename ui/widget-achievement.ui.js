// ── ui/widget-achievement.ui.js ────────────────────────────────────────────
// Fase 9 (2026-09-13). Sola lettura sul lato dati — nessuna scrittura
// diretta di sblocchi qui, per design (vedi data/achievement.repository.js).
//
// RISCRITTO (2026-09-25, Milestones = Achievement — decisione di Claudio in
// sessione: "le milestones devono essere quelle che vengono contate nel
// widget achievement... i traguardi con Achievement a cui mancano gli
// achievement"). Achievement ora mostra TUTTI i traguardi di
// CATALOGO_TRAGUARDI (ui/missioni-catalogo.ui.js, 124 voci: 11 scale +
// TRAGUARDI_SINGOLI — aggiornato 2026-09-25 con SCALA_COSTANZA_STREAK) —
// prima solo i 37 curati a mano in
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
        // RESTYLE BINDEX FASE 2 (2026-09-30, tavola "Achievement = ultime
        // medaglie"): le ultime 5 sbloccate (dalla stessa lettura di
        // sempre, nessuna query in più) con la loro rarità, e il nome
        // dell'ultima. Rarità: regola calcolata condivisa
        // (_achievementRaritaCalcolata); per i 37 curati a mano la pagina
        // usa quella salvata, che può differire — qui è solo il colore del
        // tondino, la pagina resta la fonte di verità.
        const rarita = _achievementRaritaCalcolata();
        const ultime = (sbloccati || []).slice()
            .sort((a, b) => String(b.riscosso_il || '').localeCompare(String(a.riscosso_il || '')))
            .slice(0, 5)
            .map(s => {
                const t = CATALOGO_TRAGUARDI.find(x => x.id === s.traguardo_id);
                return { id: s.traguardo_id, titolo: t ? t.titolo : s.traguardo_id, rarita: rarita[s.traguardo_id] || 'comune', quando: s.riscosso_il };
            });
        return { righe: [`${posseduti} di ${totale}`], dati: { totale, posseduti, ultime } };
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
    _achievementRenderPagina();
}

// RESTYLE TAVOLA (2026-10-01, tavola OK-achievement): testata con
// "In evidenza" (la vecchia scheda Vetrina, stessi dati), riepilogo
// "N su M ottenuti" con barra, filtri Tutti/Ottenuti/Da ottenere a
// pillola, sezioni per rarità colorate e tessere con icona, nome e
// rarità; quelle ancora chiuse restano "???" (sorpresa, invariato).
function _achievementRenderPagina() {
    const container = document.getElementById('achievementContenuto');
    if (!container) return;
    const totale = _achievementCatalogo.length;
    const ottenuti = _achievementCatalogo.filter(a => _achievementSbloccatiSet.has(a.id)).length;
    const perc = totale ? Math.round((ottenuti / totale) * 100) : 0;
    const inEvidenza = _achievementTabAttiva === 'vetrina';
    const filtri = [['tutti', 'Tutti'], ['ottenuti', 'Ottenuti'], ['non_ottenuti', 'Da ottenere']]
        .map(([id, et]) => `<button type="button" class="ach-filtro${_achievementTabAttiva === id ? ' attivo' : ''}" data-atab="${id}" onclick="_achievementImpostaTab('${id}')">${et}</button>`).join('');
    container.innerHTML = `
        <div class="page-header">
            <span class="page-title">Achievement</span>
            <button type="button" class="ach-btn-evidenza${inEvidenza ? ' attiva' : ''}" onclick="_achievementImpostaTab('${inEvidenza ? 'tutti' : 'vetrina'}')" title="Gli achievement che mostri in evidenza (massimo ${ACHIEVEMENT_VETRINA_MAX})"><i class="fa-solid fa-star"></i> In evidenza</button>
        </div>
        <div class="ach-riepilogo">
            <div class="ach-riepilogo-testa"><b>${ottenuti} su ${totale} ottenuti</b><span>${perc}%</span></div>
            <div class="pg-barra-track"><div class="pg-barra-fill" style="width:${perc}%"></div></div>
        </div>
        <div class="ach-filtri">${filtri}</div>
        <div id="achievementListaWrap"></div>
    `;
    _achievementRenderLista();
}

function _achievementImpostaTab(tab) {
    _achievementTabAttiva = tab;
    _achievementRenderPagina();
}

// Icona per categoria del traguardo (CATALOGO_TRAGUARDI.categoria) — le
// immagini vere (nome_file) non ci sono ancora per nessuno.
const _ACHIEVEMENT_ICONA_CATEGORIA = {
    inserimento: 'fa-layer-group', prezzi: 'fa-tag', meta: 'fa-crown',
    costanza: 'fa-fire', social: 'fa-user-group', home: 'fa-mobile-screen-button',
};
const _ACHIEVEMENT_RARITA_SING = { leggendaria: 'leggendaria', rara: 'rara', comune: 'comune' };
let _achievementCategorie = null;
function _achievementIcona(id) {
    if (!_achievementCategorie) {
        _achievementCategorie = {};
        (typeof CATALOGO_TRAGUARDI !== 'undefined' ? CATALOGO_TRAGUARDI : []).forEach(t => { _achievementCategorie[t.id] = t.categoria; });
    }
    return _ACHIEVEMENT_ICONA_CATEGORIA[_achievementCategorie[id]] || 'fa-trophy';
}

// Non sbloccato: NESSUN titolo, solo rarità/lucchetto — "mascherati per
// sorpresa" (roadmap, invariato). Sbloccato: icona, titolo, rarità; tocco
// = metti/togli in evidenza (stessa vetrina di prima, max 3).
function _achievementCard(a) {
    const rar = _ACHIEVEMENT_RARITA_SING[a.rarita] ? a.rarita : 'comune';
    const sbloccato = _achievementSbloccatiSet.has(a.id);
    if (!sbloccato) {
        return `<div class="ach-tessera chiusa r-${rar}" title="Achievement non ancora sbloccato (${_ACHIEVEMENT_RARITA_SING[rar]})">
            <span class="ach-icona"><i class="fa-solid fa-lock"></i></span>
            <b>???</b><small>${_ACHIEVEMENT_RARITA_SING[rar]}</small>
        </div>`;
    }
    const inVetrina = _achievementVetrinaIds.includes(a.id);
    const dataSbloccato = _achievementSbloccatiData[a.id] ? new Date(_achievementSbloccatiData[a.id]).toLocaleDateString('it-IT') : '';
    const titoloAttr = escapeHtml(a.titolo);
    return `<div class="ach-tessera aperta r-${rar}" onclick="_achievementToggleVetrina('${a.id}')" title="${titoloAttr} — sbloccato il ${dataSbloccato}${inVetrina ? ' (in evidenza, tocca per togliere)' : ' (tocca per mettere in evidenza)'}">
        ${inVetrina ? '<i class="fa-solid fa-star ach-stella"></i>' : ''}
        <span class="ach-icona"><i class="fa-solid ${_achievementIcona(a.id)}"></i></span>
        <b>${titoloAttr}</b><small>${_ACHIEVEMENT_RARITA_SING[rar]}</small>
    </div>`;
}

// Elenco raggruppato per rarità, riusato da 'tutti'/'ottenuti'/
// 'non_ottenuti' — cambia solo il filtro passato. Leggendarie per prime.
function _achievementListaPerRarita(filtro) {
    let html = '';
    _ACHIEVEMENT_RARITA_ORDINE.forEach(rar => {
        const tutte = _achievementCatalogo.filter(a => a.rarita === rar);
        const voci = tutte.filter(filtro);
        if (voci.length === 0) return;
        const sbloccatiN = tutte.filter(a => _achievementSbloccatiSet.has(a.id)).length;
        // Prima gli ottenuti, poi i chiusi: con molte voci si vede subito
        // cosa si ha (stesso ordine del catalogo dentro ciascun gruppo).
        voci.sort((x, y) => (_achievementSbloccatiSet.has(y.id) ? 1 : 0) - (_achievementSbloccatiSet.has(x.id) ? 1 : 0));
        html += `<div class="ach-sezione r-${rar}"><b>${_ACHIEVEMENT_RARITA_LABEL[rar]}</b><span>${sbloccatiN}/${tutte.length}</span></div>
            <div class="ach-griglia">${voci.map(_achievementCard).join('')}</div>`;
    });
    return html;
}

function _achievementRenderLista() {
    const wrap = document.getElementById('achievementListaWrap');
    if (!wrap) return;

    if (_achievementTabAttiva === 'vetrina') {
        const selezionati = _achievementCatalogo.filter(a => _achievementVetrinaIds.includes(a.id));
        const nota = `<p class="ach-nota">In evidenza ${selezionati.length} su ${ACHIEVEMENT_VETRINA_MAX}. Tocca un achievement ottenuto (anche da "Tutti") per metterlo o toglierlo.</p>`;
        if (selezionati.length === 0) {
            wrap.innerHTML = nota + '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:2rem 0;">Nessun achievement in evidenza.</p>';
            return;
        }
        wrap.innerHTML = nota + `<div class="ach-griglia">${selezionati.map(_achievementCard).join('')}</div>`;
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
