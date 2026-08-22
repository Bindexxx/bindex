// ── ui/admin-users.ui.js ─────────────────────────────────────────────
// Pannello "Utenti": elenco, ricerca/filtro, cambio ruolo, e modale
// dettaglio utente (anagrafica, ban, password, eliminazione account).

// ── MODALE DETTAGLIO UTENTE ───────────────────────────────────
document.getElementById('modal-close').addEventListener('click', () => modalBackdrop.style.display = 'none');
modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) modalBackdrop.style.display = 'none'; });


// ── UTENTI / RUOLI ────────────────────────────────────────────

async function caricaUtenti() {
  const cont = document.getElementById('utenti-list');
  const { data, error } = await adminListaUtenti();

  if (error) { cont.innerHTML = `<div class="empty-state">Errore: ${error.message}</div>`; return; }
  ultimaListaUtenti = data || [];
  renderUtenti();
}


function statoUtente(u) {
  if (u.deleted_at) return { key: 'deleted', label: 'eliminato' };
  if (u.banned_until && new Date(u.banned_until) > new Date()) {
    const perma = u.banned_until.startsWith('9999') || u.banned_until === 'infinity';
    return { key: 'banned', label: perma ? 'perma-ban' : ('bannato fino al ' + fmtData(u.banned_until)) };
  }
  return { key: 'active', label: 'attivo' };
}


function renderUtenti() {
  const cont = document.getElementById('utenti-list');
  const q = document.getElementById('utenti-search').value.trim().toLowerCase();
  const filtro = document.getElementById('utenti-filter').value;

  let lista = ultimaListaUtenti.filter(u => {
    if (q && !(u.username || '').toLowerCase().includes(q)) return false;
    const s = statoUtente(u);
    if (filtro === 'active' && s.key !== 'active') return false;
    if (filtro === 'banned' && s.key !== 'banned') return false;
    if (filtro === 'deleted' && s.key !== 'deleted') return false;
    if (filtro === 'admin' && u.role !== 'admin') return false;
    return true;
  });

  if (lista.length === 0) { cont.innerHTML = '<div class="empty-state">Nessun utente trovato.</div>'; return; }

  cont.innerHTML = lista.map(u => {
    const s = statoUtente(u);
    return `
    <div class="row" data-id="${u.id}">
      <div class="main clickable" data-open="${u.id}">
        <div class="name">${escAttr(u.username) || '(senza nome)'} <span class="badge ${u.role}">${u.role}</span> <span class="badge ${s.key}">${s.label}</span></div>
        <div class="meta mono">${u.id}</div>
      </div>
      <button class="btn-small btn-toggle-role" data-role="${u.role}" data-id="${u.id}">
        ${u.role === 'admin' ? 'Rendi utente' : 'Rendi admin'}
      </button>
    </div>`;
  }).join('');

  cont.querySelectorAll('[data-open]').forEach(el => {
    el.addEventListener('click', () => apriModaleUtente(el.dataset.open));
  });

  cont.querySelectorAll('.btn-toggle-role').forEach(btn => {
    btn.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      const id = btn.dataset.id;
      const ruoloAttuale = btn.dataset.role;
      const nuovoRuolo = ruoloAttuale === 'admin' ? 'user' : 'admin';
      const utente = ultimaListaUtenti.find(u => u.id === id);
      if (!confirm(`Confermi: cambiare il ruolo di "${utente.username}" in "${nuovoRuolo}"?`)) return;
      btn.disabled = true;

      const { error } = await adminCambiaRuolo(id, nuovoRuolo);
      if (error) { mostraStatus('Errore: ' + error.message, false); btn.disabled = false; return; }
      await adminRegistraAzione('role_change', id, { nuovo_ruolo: nuovoRuolo });
      mostraStatus('Ruolo aggiornato.', true);
      caricaUtenti();
    });
  });
}

document.getElementById('utenti-search').addEventListener('input', renderUtenti);
document.getElementById('utenti-filter').addEventListener('change', renderUtenti);


async function apriModaleUtente(userId) {
  const u = ultimaListaUtenti.find(x => x.id === userId);
  if (!u) return;
  document.getElementById('modal-username').textContent = u.username || '(senza nome)';
  renderModaleBody(u);
  modalBackdrop.style.display = 'flex';

  const { data: log } = await adminActivityLog(userId, 30);
  const logCont = document.getElementById('modal-activity-log');
  if (logCont) {
    if (!log || log.length === 0) {
      logCont.innerHTML = '<div class="empty-state">Nessuna attività registrata (funzione di raccolta log non ancora collegata a sito/estensione).</div>';
    } else {
      logCont.innerHTML = log.map(l => `<div class="log-line">${l.action} <span class="lmeta">— ${l.source} · ${fmtData(l.created_at)}</span></div>`).join('');
    }
  }
}


function renderModaleBody(u) {
  const s = statoUtente(u);
  modalBody.innerHTML = `
    <div class="section-title">Stato</div>
    <span class="badge ${s.key}">${s.label}</span> <span class="badge ${u.role}">${u.role}</span>

    <div class="section-title">Dati anagrafici (facoltativi, solo admin)</div>
    <div style="display:flex;flex-direction:column;gap:9px;">
      <div>
        <label for="anag-nome" style="margin:0 0 3px;">Nome reale</label>
        <input type="text" id="anag-nome" value="${escAttr(u.nome_reale)}" placeholder="—">
      </div>
      <div>
        <label for="anag-cognome" style="margin:0 0 3px;">Cognome reale</label>
        <input type="text" id="anag-cognome" value="${escAttr(u.cognome_reale)}" placeholder="—">
      </div>
      <div>
        <label for="anag-telefono" style="margin:0 0 3px;">Telefono</label>
        <input type="text" id="anag-telefono" value="${escAttr(u.telefono)}" placeholder="—">
      </div>
      <div>
        <label for="anag-email" style="margin:0 0 3px;">Email di contatto <span style="font-weight:400;text-transform:none;">(mai usata per l'accesso al sito)</span></label>
        <input type="text" id="anag-email" value="${escAttr(u.email_contatto)}" placeholder="—">
      </div>
      <button class="btn-small btn-toggle-role" data-act="salva-anagrafica" style="align-self:flex-start;">💾 Salva dati anagrafici</button>
    </div>

    <div class="section-title">Ban</div>
    <div class="action-grid">
      <div class="inline-form">
        <input type="number" id="ban-giorni" min="1" placeholder="gg" value="7">
        <button class="btn-small btn-ghost" data-act="ban-temp">Ban temporaneo</button>
      </div>
      <button class="btn-small btn-danger" data-act="ban-perma">Perma-ban</button>
      <button class="btn-small btn-approve" data-act="unban" ${s.key !== 'banned' ? 'disabled' : ''}>Sban</button>
    </div>

    <div class="section-title">Password</div>
    <div id="pw-area">
      <button class="btn-small btn-toggle-role" data-act="reset-pw">Genera e reimposta password</button>
    </div>

    <div class="section-title">Account</div>
    <div class="action-grid">
      ${s.key === 'deleted'
        ? `<button class="btn-small btn-approve" data-act="restore">Ripristina account</button>`
        : `<button class="btn-small btn-danger" data-act="soft-delete">Elimina account (soft)</button>`}
      <button class="btn-small btn-ghost" data-act="revoke">Revoca sessioni ora</button>
    </div>

    <div class="section-title">Zona pericolosa</div>
    <div class="danger-box">
      <p>⚠️ Hard delete: cancella DEFINITIVAMENTE l'account e tutti i dati collegati. Azione irreversibile — usala solo per ripulire account di test.</p>
      <button class="btn-small btn-danger" data-act="hard-delete">🗑 Hard delete</button>
    </div>

    <div class="section-title">Log attività (sito + estensione)</div>
    <div id="modal-activity-log"><div class="empty-state">Caricamento…</div></div>
  `;

  modalBody.querySelectorAll('[data-act]').forEach(btn => {
    btn.addEventListener('click', () => gestisciAzioneUtente(u, btn.dataset.act));
  });
}


async function gestisciAzioneUtente(u, azione) {
  try {
    if (azione === 'ban-temp') {
      const giorni = parseInt(document.getElementById('ban-giorni').value, 10);
      if (!giorni || giorni < 1) { mostraStatus('Inserisci un numero di giorni valido.', false); return; }
      if (!confirm(`Bannare "${u.username}" per ${giorni} giorni?`)) return;
      const until = new Date(Date.now() + giorni * 86400000).toISOString();
      const { error } = await adminBanUtente(u.id, until, `Ban temporaneo (${giorni} giorni)`);
      if (error) throw error;
      mostraStatus('Utente bannato.', true);
    }
    else if (azione === 'ban-perma') {
      if (!confirm(`Perma-bannare "${u.username}"? Resterà bloccato finché non lo sbanni tu.`)) return;
      const { error } = await adminBanUtente(u.id, '9999-12-31T23:59:59Z', 'Perma-ban');
      if (error) throw error;
      mostraStatus('Utente perma-bannato.', true);
    }
    else if (azione === 'unban') {
      const { error } = await adminSbannaUtente(u.id);
      if (error) throw error;
      mostraStatus('Ban rimosso.', true);
    }
    else if (azione === 'revoke') {
      if (!confirm(`Revocare subito tutte le sessioni attive di "${u.username}"?`)) return;
      const { error } = await adminRevocaSessioni(u.id);
      if (error) throw error;
      mostraStatus('Sessioni revocate.', true);
    }
    else if (azione === 'soft-delete') {
      if (!confirm(`Eliminare (soft) l'account "${u.username}"? È reversibile con "Ripristina".`)) return;
      const { error } = await adminSoftDeleteUtente(u.id);
      if (error) throw error;
      mostraStatus('Account eliminato (soft).', true);
    }
    else if (azione === 'restore') {
      const { error } = await adminRipristinaUtente(u.id);
      if (error) throw error;
      mostraStatus('Account ripristinato.', true);
    }
    else if (azione === 'reset-pw') {
      const nuovaPw = generaPassword();
      const { error } = await adminResetPassword(u.id, nuovaPw);
      if (error) throw error;
      mostraStatus('Password reimpostata.', true);
      const pwArea = document.getElementById('pw-area');
      pwArea.innerHTML = `
        <div class="pw-reveal">
          Nuova password per <b>${escAttr(u.username)}</b>:
          <div class="pw-value">${nuovaPw}</div>
          <button class="btn-small btn-toggle-role" id="pw-share">📤 Condividi</button>
        </div>`;
      document.getElementById('pw-share').addEventListener('click', async () => {
        const testo = `CardSync Pro — la tua nuova password è: ${nuovaPw}`;
        if (navigator.share) { try { await navigator.share({ text: testo }); } catch(e) {} }
        else { await navigator.clipboard.writeText(testo); mostraStatus('Copiato negli appunti (condivisione nativa non disponibile su questo browser).', true); }
      });
    }
    else if (azione === 'salva-anagrafica') {
      const payload = {
        nome_reale: document.getElementById('anag-nome').value.trim() || null,
        cognome_reale: document.getElementById('anag-cognome').value.trim() || null,
        telefono: document.getElementById('anag-telefono').value.trim() || null,
        email_contatto: document.getElementById('anag-email').value.trim() || null
      };
      const { error } = await adminAggiornaAnagrafica(u.id, payload);
      if (error) throw error;
      await adminRegistraAzione('anagrafica_update', u.id, payload);
      mostraStatus('Dati anagrafici salvati.', true);
    }
    else if (azione === 'hard-delete') {
      const conferma = prompt(`⚠️ AZIONE IRREVERSIBILE.\nQuesto cancella DEFINITIVAMENTE l'account "${u.username}" e tutti i suoi dati.\nScrivi esattamente "${u.username}" per confermare:`);
      if (conferma !== u.username) { mostraStatus('Conferma non corrispondente, azione annullata.', false); return; }
      const { error } = await adminHardDeleteUtente(u.id);
      if (error) throw error;
      mostraStatus('Account cancellato definitivamente.', true);
      modalBackdrop.style.display = 'none';
    }

    caricaUtenti();
    caricaLogAdmin();
  } catch (err) {
    mostraStatus('Errore: ' + (err.message || err), false);
  }
}
