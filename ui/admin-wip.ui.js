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
        cont.innerHTML = '<div class="empty-state">Nessun Work in Progress mai attivato.</div>';
        return;
    }

    cont.innerHTML = data.map(w => `
        <div class="user-row">
            <div>
                <b>${w.target_tipo}</b> · <code>${w.target_id}</code>
                <div style="font-size:0.82rem; color:#888; margin-top:0.2rem;">${w.messaggio}</div>
                <div style="font-size:0.75rem; color:#aaa; margin-top:0.2rem;">
                    ${w.attivo ? 'Attivo' : 'Disattivato'} — dal ${new Date(w.attivato_il).toLocaleString('it-IT')}
                </div>
            </div>
            <div>
                ${w.attivo
                    ? `<button class="btn-secondary" onclick="disattivaWip('${w.id}')">Disattiva</button>`
                    : `<button class="btn-main" onclick="riattivaWip('${w.id}')">Riattiva</button>`}
            </div>
        </div>
    `).join('');
}

async function attivaWip() {
    const targetTipo = document.getElementById('wipTargetTipo').value;
    const targetId = document.getElementById('wipTargetId').value.trim();
    const messaggio = document.getElementById('wipMessaggio').value;

    if (!targetId) { mostraStatus('Inserisci l\'id del bersaglio (widget/pagina/...).', false); return; }

    const sessione = await adminAuthGetSession();
    if (!sessione) { mostraStatus('Sessione scaduta, ricarica la pagina.', false); return; }

    const { error } = await wipCrea({ targetTipo, targetId, messaggio, adminId: sessione.user.id });
    if (error) { mostraStatus('Errore: ' + error.message, false); return; }

    mostraStatus('🚧 Work in Progress attivato.', true);
    document.getElementById('wipTargetId').value = '';
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
