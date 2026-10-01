// ── ui/admin-wip.ui.js ─────────────────────────────────────────────────
// Fase 11 (2026-09-13). Pannello admin per attivare/disattivare Work in
// Progress. RLS fa comunque da barriera reale (solo is_admin() scrive) —
// questo pannello è solo la comodità, non la sicurezza.

async function caricaWip() {
    const cont = document.getElementById('wip-list');
    cont.innerHTML = '<div class="empty-state">Caricamento…</div>';

    const { data, error } = await wipListaTutti();
    if (error) {
        cont.innerHTML = `<div class="empty-state">Errore: ${error.message}</div>`;
        return;
    }
    if (!data || data.length === 0) {
        cont.innerHTML = '<div class="empty-state">Nessun lavoro in corso mai attivato.</div>';
        return;
    }

    // RESTYLE BINDEX FASE 7: stesse battute di sempre, ma con interruttore
    // attivo/spento al posto dei due pulsanti Disattiva/Riattiva.
    cont.innerHTML = data.map(w => `
        <div class="row">
            <div class="main">
                <div class="name">${escAttr(w.target_tipo)} · <code>${escAttr(w.target_id)}</code></div>
                <div class="meta">${escAttr(w.messaggio)}</div>
                <div class="meta">${w.attivo ? 'Attivo' : 'Spento'} — dal ${new Date(w.attivato_il).toLocaleString('it-IT')}</div>
            </div>
            <label class="adm-switch" title="${w.attivo ? 'Spegni' : 'Accendi'}">
                <input type="checkbox" ${w.attivo ? 'checked' : ''} onchange="this.checked ? riattivaWip('${w.id}') : disattivaWip('${w.id}')">
                <span></span>
            </label>
        </div>
    `).join('');
}

// ── Bersagli validi (2026-09-26, Claudio: "trasforma in tendina") ─────
// Sono gli id che arrivano davvero ad apriDettaglioWidget() in
// ui/paginainiziale-dettaglio.ui.js, l'unico punto dove il WIP viene
// controllato: def.tab || id di CATALOGO_WIDGET, più le destinazioni
// aperte direttamente (dafare, impostazioni, primopiano). Copia locale
// voluta (admin.html non carica il catalogo widget di index): se nasce un
// widget/pagina nuovo, va aggiunto anche qui.
const WIP_BERSAGLI = [
    ['achievement', 'Achievement'],
    ['binder', 'Binders'],
    ['bustina', 'Bustina'],
    ['dafare', 'Centro operativo (Da fare)'],
    ['chat', 'Chat'],
    ['condividi', 'Condividi'],
    ['contributi', 'Contributi al gruppo'],
    ['foto', 'Foto carte'],
    ['doppioni', 'Doppioni'],
    ['impostazioni', 'Impostazioni (anche widget Estensione)'],
    ['primopiano', 'In primo piano'],
    ['inserimento', 'Inserimento'],
    ['location', 'Location'],
    ['match', 'Match trovati'],
    ['missioni', 'Missioni'],
    ['polvere', 'Polvere'],
    ['prezzi', 'Prezzi (anche Prezzi aggiornati)'],
    ['richieste', 'Richieste'],
    ['scaffali', 'Scaffali'],
    ['sealed', 'Sealed'],
    ['set', 'Set'],
    ['valore', 'Valore collezione'],
    ['variazione', 'Variazione valore'],
    ['visualizzazione', 'Visualizzazione (anche Ultime aggiunte)'],
    ['wishlist', 'Wishlist'],
];
const WIP_SCELTA_ALTRO = '__altro__';

function _wipRiempiTendina() {
    const sel = document.getElementById('wipTargetScelta');
    if (!sel || sel.options.length) return;
    sel.innerHTML = '<option value="">— Scegli il bersaglio —</option>'
        + WIP_BERSAGLI.map(([id, nome]) => `<option value="${id}">${nome} (${id})</option>`).join('')
        + `<option value="${WIP_SCELTA_ALTRO}">Altro… (scrivi l'id)</option>`;
}

// Tendina per widget/pagina; campo di testo per binder speciale/funzione
// (nessun elenco fisso) o quando si sceglie "Altro…".
function _wipAggiornaCampoId() {
    _wipRiempiTendina();
    const tipo = document.getElementById('wipTargetTipo').value;
    const sel = document.getElementById('wipTargetScelta');
    const input = document.getElementById('wipTargetId');
    const conElenco = (tipo === 'widget' || tipo === 'pagina');
    sel.style.display = conElenco ? '' : 'none';
    input.style.display = (!conElenco || sel.value === WIP_SCELTA_ALTRO) ? '' : 'none';
}

document.addEventListener('DOMContentLoaded', _wipAggiornaCampoId);

async function attivaWip() {
    const targetTipo = document.getElementById('wipTargetTipo').value;
    const scelta = document.getElementById('wipTargetScelta').value;
    const conElenco = (targetTipo === 'widget' || targetTipo === 'pagina');
    const targetId = (conElenco && scelta !== WIP_SCELTA_ALTRO)
        ? scelta
        : document.getElementById('wipTargetId').value.trim();
    const messaggio = document.getElementById('wipMessaggio').value;

    if (!targetId) { mostraStatus('Inserisci l\'id del bersaglio (widget/pagina/...).', false); return; }

    const sessione = await adminAuthGetSession();
    if (!sessione) { mostraStatus('Sessione scaduta, ricarica la pagina.', false); return; }

    const { error } = await wipCrea({ targetTipo, targetId, messaggio, adminId: sessione.user.id });
    if (error) { mostraStatus('Errore: ' + error.message, false); return; }

    mostraStatus('🚧 Work in Progress attivato.', true);
    document.getElementById('wipTargetId').value = '';
    document.getElementById('wipTargetScelta').value = '';
    _wipAggiornaCampoId();
    caricaWip();
}

async function disattivaWip(id) {
    const { error } = await wipDisattiva(id);
    if (error) { mostraStatus('Errore: ' + error.message, false); return; }
    mostraStatus('Work in Progress disattivato.', true);
    caricaWip();
}

async function riattivaWip(id) {
    const { error } = await wipRiattiva(id);
    if (error) { mostraStatus('Errore: ' + error.message, false); return; }
    mostraStatus('🚧 Work in Progress riattivato.', true);
    caricaWip();
}
