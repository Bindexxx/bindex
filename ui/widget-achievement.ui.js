// ── ui/widget-achievement.ui.js ────────────────────────────────────────────
// Fase 9 (2026-09-13). Achievement = i traguardi con ricompensa
// tipo='stampino' (sql/59) — nessun nuovo criterio di sblocco, riusa
// interamente il motore missioni/traguardi già esistente e già blindato
// (sql/58). Solo lettura da qui: achievement_catalogo/achievement_
// sbloccati non hanno nessuna scrittura client, per design (vedi
// data/achievement.repository.js).
//
// Riusa lo stile Binder come richiesto dalla roadmap: .binder-grid.
// binder-grid-4x4 + .binder-slot/.binder-slot-filled/.binder-slot-empty
// (già definiti in index.html per i Binder carte) — nessun CSS nuovo per
// la griglia, solo un modificatore .binder-slot-locked per il non
// sbloccato "mascherato per sorpresa" (nuovo, in fondo al file HTML).

CATALOGO_WIDGET.achievement = {
    titolo: 'Achievement', icona: 'fa-trophy',
    tab: 'achievement',
    preview: async () => {
        const userId = await authGetUserId();
        if (!userId) return { righe: ['—'], dati: {} };
        const [{ data: catalogo, error: errCat }, { data: sbloccati, error: errSb }] = await Promise.all([
            achievementCatalogoList(), achievementSbloccatiList(userId),
        ]);
        if (errCat || errSb) return { righe: ['—'], dati: {} };
        const totale = (catalogo || []).length;
        const posseduti = (sbloccati || []).length;
        return { righe: [`${posseduti}/${totale} sbloccati`], dati: { totale, posseduti } };
    },
    azione: (dati, evt) => { apriDettaglioWidget('achievement', evt); },
};


let _achievementTabAttiva = 'tutti';
let _achievementCatalogo = [];
let _achievementSbloccatiSet = new Set();
let _achievementSbloccatiData = {}; // id -> sbloccato_il
let _achievementVetrinaIds = [];

const _ACHIEVEMENT_RARITA_LABEL = { leggendaria: 'Leggendarie', rara: 'Rare', comune: 'Comuni' };
const _ACHIEVEMENT_RARITA_ORDINE = ['leggendaria', 'rara', 'comune'];

async function renderPaginaAchievement() {
    const container = document.getElementById('achievementContenuto');
    if (!container) return;
    container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:2rem 0;"><i class="fa-solid fa-spinner fa-spin"></i> Caricamento...</p>';

    const userId = await authGetUserId();
    if (!userId) return;

    const [{ data: catalogo, error: errCat }, { data: sbloccati, error: errSb }, { data: prefsRow }] = await Promise.all([
        achievementCatalogoList(),
        achievementSbloccatiList(userId),
        userSettingsGet(userId),
    ]);

    if (errCat || errSb) {
        container.innerHTML = '<p style="text-align:center; color:var(--danger); padding:2rem 0;">Errore nel caricamento.</p>';
        return;
    }

    _achievementCatalogo = catalogo || [];
    _achievementSbloccatiSet = new Set((sbloccati || []).map(s => s.achievement_id));
    _achievementSbloccatiData = {};
    (sbloccati || []).forEach(s => { _achievementSbloccatiData[s.achievement_id] = s.sbloccato_il; });
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
// sorpresa" (roadmap). nome_file è sempre NULL per ora (placeholder, vedi
// sql/59): quando ci saranno immagini reali, qui va aggiunto un <img> con
// fallback su questa stessa icona trofeo, stesso schema già usato per
// bustina/prodotti sealed.
function _achievementCard(a) {
    const sbloccato = _achievementSbloccatiSet.has(a.id);
    if (!sbloccato) {
        return `<div class="binder-slot binder-slot-locked" title="Achievement non ancora sbloccato (${_ACHIEVEMENT_RARITA_LABEL[a.rarita] || a.rarita})">
            <i class="fa-solid fa-lock"></i>
        </div>`;
    }
    const inVetrina = _achievementVetrinaIds.includes(a.id);
    const dataSbloccato = _achievementSbloccatiData[a.id] ? new Date(_achievementSbloccatiData[a.id]).toLocaleDateString('it-IT') : '';
    const titoloAttr = escapeHtml(a.titolo);
    return `<div class="binder-slot binder-slot-filled" onclick="_achievementToggleVetrina('${a.id}')" title="${titoloAttr} — sbloccato il ${dataSbloccato}${inVetrina ? ' (in vetrina, tocca per rimuovere)' : ' (tocca per aggiungere alla vetrina)'}">
        <div class="binder-slot-fallback"><i class="fa-solid fa-trophy"></i><span>${titoloAttr}</span></div>
        ${inVetrina ? '<span class="binder-slot-qty-badge"><i class="fa-solid fa-star"></i></span>' : ''}
    </div>`;
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
        wrap.innerHTML = `<div class="binder-grid binder-grid-4x4">${selezionati.map(_achievementCard).join('')}</div>`;
        return;
    }

    // Tab "Tutti" — un binder-grid-4x4 per fascia di rarità, leggendarie
    // per prime (le più rare, le più interessanti da controllare per
    // prime — stessa logica "il più importante prima" di altre pagine
    // del sito, es. Centro operativo).
    let html = '';
    _ACHIEVEMENT_RARITA_ORDINE.forEach(rar => {
        const voci = _achievementCatalogo.filter(a => a.rarita === rar);
        if (voci.length === 0) return;
        const sbloccatiN = voci.filter(a => _achievementSbloccatiSet.has(a.id)).length;
        html += `<div class="pg-titoletto">${_ACHIEVEMENT_RARITA_LABEL[rar]} — ${sbloccatiN}/${voci.length}</div>
            <div class="binder-grid binder-grid-4x4">${voci.map(_achievementCard).join('')}</div>`;
    });
    wrap.innerHTML = html;
}

async function _achievementToggleVetrina(id) {
    if (!_achievementSbloccatiSet.has(id)) return; // sicurezza — i lucchetti non hanno onclick, non dovrebbe mai capitare
    const userId = await authGetUserId();
    if (!userId) return;

    const giaDentro = _achievementVetrinaIds.includes(id);
    if (giaDentro) {
        _achievementVetrinaIds = _achievementVetrinaIds.filter(x => x !== id);
    } else {
        if (_achievementVetrinaIds.length >= 16) {
            alert('La Vetrina può contenere al massimo 16 achievement (un 4×4 pieno) — togline uno prima di aggiungerne un altro.');
            return;
        }
        _achievementVetrinaIds.push(id);
    }

    const { error } = await userSettingsUpsertAchievementVetrina(userId, _achievementVetrinaIds);
    if (error) console.error('[achievement] salvataggio vetrina:', error.message); // non bloccante, la UI resta comunque aggiornata localmente

    _achievementRenderLista();
}
