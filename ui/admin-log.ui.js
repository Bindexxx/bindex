// ── ui/admin-log.ui.js ───────────────────────────────────────────────
// Pannello "Registro" (tab dedicato): elenco sola-lettura di admin_audit_log.
// RESTYLE BINDEX FASE 7: frasi leggibili ("claudio ha reso admin bill") con
// i nomi utente al posto degli id, filtro per azione e per admin, CSV.

let _logAdminRighe = [];
let _logAdminNomi = {};

// Codici scritti da log_admin_action() (DB) e da adminRegistraAzione() (UI).
function _fraseRegistro(r, nome) {
  const chi = nome(r.admin_id);
  const target = r.target_user_id ? nome(r.target_user_id) : null;
  const d = r.details || {};
  switch (r.action) {
    case 'role_change': return `${chi} ha reso ${d.nuovo_ruolo === 'admin' ? 'admin' : 'utente normale'} ${target}`;
    case 'ban': return `${chi} ha bannato ${target}${d.until && !String(d.until).startsWith('9999') ? ' fino al ' + fmtData(d.until) : ' per sempre'}`;
    case 'unban': return `${chi} ha tolto il ban a ${target}`;
    case 'revoke_sessions': return `${chi} ha chiuso le sessioni di ${target}`;
    case 'soft_delete': return `${chi} ha eliminato l'account di ${target}`;
    case 'restore': return `${chi} ha ripristinato l'account di ${target}`;
    case 'reset_password': return `${chi} ha reimpostato la password di ${target}`;
    case 'hard_delete': return `${chi} ha cancellato definitivamente ${target || 'un account'}`;
    case 'anagrafica_update': return `${chi} ha aggiornato i dati anagrafici di ${target}`;
    case 'chat_minorenne_change': return `${chi} ha ${d.minorenne ? 'segnato come minorenne' : 'tolto il segno di minorenne a'} ${target}`;
    case 'richieste_archiviate': return `${chi} ha archiviato ${d.count != null ? d.count : ''} richieste gestite`;
    default: return `${chi}: ${r.action}${target ? ' (' + target + ')' : ''}`;
  }
}

function _nomeUtenteLog(id) {
  return _logAdminNomi[id] || (id ? String(id).slice(0, 8) + '…' : '—');
}

async function caricaLogAdmin() {
  const cont = document.getElementById('logadmin-list');
  const { data, error } = await adminLogAudit(200);

  if (error) { cont.innerHTML = `<div class="empty-state">Errore: ${error.message}</div>`; return; }
  if (!data || data.length === 0) { cont.innerHTML = '<div class="empty-state">Nessuna azione registrata.</div>'; return; }

  // Nomi utente: usa la lista già caricata, altrimenti la chiede.
  let lista = ultimaListaUtenti;
  if (!lista || lista.length === 0) {
    const r = await adminListaUtentiPerFiltro();
    lista = r.data || [];
  }
  _logAdminNomi = Object.fromEntries(lista.map(u => [u.id, u.username]));
  _logAdminRighe = data;

  // Filtro per azione costruito dalle azioni davvero presenti.
  const sel = document.getElementById('logadmin-filtro');
  if (sel && sel.options.length <= 1) {
    [...new Set(data.map(r => r.action))].sort().forEach(a => {
      const o = document.createElement('option');
      o.value = a; o.textContent = a.replace(/_/g, ' ');
      sel.appendChild(o);
    });
  }
  renderLogAdmin();
}

function renderLogAdmin() {
  const cont = document.getElementById('logadmin-list');
  const sel = document.getElementById('logadmin-filtro');
  const filtro = sel ? sel.value : 'all';
  const righe = _logAdminRighe.filter(r => filtro === 'all' || r.action === filtro);
  if (righe.length === 0) { cont.innerHTML = '<div class="empty-state">Nessuna azione con questo filtro.</div>'; return; }
  cont.innerHTML = righe.map(r => `
    <div class="row">
      <div class="main">
        <div class="name">${escAttr(_fraseRegistro(r, _nomeUtenteLog))}</div>
        <div class="meta">${fmtData(r.created_at)}</div>
      </div>
    </div>
  `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  const sel = document.getElementById('logadmin-filtro');
  if (sel) sel.addEventListener('change', renderLogAdmin);
  const csv = document.getElementById('logadmin-csv');
  if (csv) csv.addEventListener('click', () => {
    const righe = _logAdminRighe.map(r => [fmtData(r.created_at), _fraseRegistro(r, _nomeUtenteLog), r.action]);
    if (!righe.length) { mostraStatus('Nessuna azione da esportare.', false); return; }
    _scaricaCSV('registro_admin_' + new Date().toISOString().slice(0, 10) + '.csv', ['Data', 'Azione', 'Codice'], righe);
  });
});
