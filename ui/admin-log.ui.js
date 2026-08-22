// ── ui/admin-log.ui.js ───────────────────────────────────────────────
// Pannello "Log" (tab dedicato): elenco sola-lettura di admin_audit_log.


// ── LOG ADMIN (tab dedicato) ─────────────────────────────────
async function caricaLogAdmin() {
  const cont = document.getElementById('logadmin-list');
  const { data, error } = await adminLogAudit(200);

  if (error) { cont.innerHTML = `<div class="empty-state">Errore: ${error.message}</div>`; return; }
  if (!data || data.length === 0) { cont.innerHTML = '<div class="empty-state">Nessuna azione registrata.</div>'; return; }

  cont.innerHTML = data.map(r => `
    <div class="row">
      <div class="main">
        <div class="name">${r.action}</div>
        <div class="meta mono">${fmtData(r.created_at)} · admin ${r.admin_id}${r.target_user_id ? ' · target ' + r.target_user_id : ''}</div>
      </div>
    </div>
  `).join('');
}
