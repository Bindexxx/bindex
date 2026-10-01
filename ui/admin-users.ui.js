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
    return { key: 'banned', label: perma ? 'ban per sempre' : ('bannato fino al ' + fmtData(u.banned_until)) };
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
      if (!await adminDialog({ titolo: 'Cambiare ruolo?', testo: `"${utente.username}" diventerà "${nuovoRuolo}".`, conferma: 'Conferma' })) return;
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
      logCont.innerHTML = '<div class="empty-state">Nessuna attività registrata.</div>';
    } else {
      logCont.innerHTML = log.map(l => `<div class="log-line">${l.action} <span class="lmeta">— ${l.source} · ${fmtData(l.created_at)}</span></div>`).join('');
    }
  }

  // AGGIUNTO (2026-09-24, sql/72): checkbox minorenne — renderizzata
  // disabilitata in renderModaleBody (stato ignoto finché non arriva la
  // risposta), abilitata e valorizzata qui, stesso pattern del log
  // attività sopra (mostra la modale subito, riempi dopo).
  const chatCheck = document.getElementById('chat-minorenne-check');
  if (chatCheck) {
    const { data: restrizione, error: errR } = await adminChatRestrizioneGet(userId);
    if (errR) {
      console.error('apriModaleUtente: errore lettura restrizione chat:', errR.message);
    } else {
      chatCheck.checked = !!(restrizione && restrizione.minorenne);
      chatCheck.disabled = false;
      chatCheck.addEventListener('change', async () => {
        chatCheck.disabled = true;
        const nuovoValore = chatCheck.checked;
        const azione = nuovoValore ? 'marcare' : 'togliere il segno da';
        if (!await adminDialog({ titolo: 'Utente minorenne', testo: `Confermi di voler ${azione} "${u.username}" come minorenne? ${nuovoValore ? 'La chat diventerà non disponibile per questo account (sia in invio che in ricezione).' : 'La chat torna disponibile per questo account.'}`, conferma: 'Conferma' })) {
          chatCheck.checked = !nuovoValore;
          chatCheck.disabled = false;
          return;
        }
        const { error } = await adminChatImpostaMinorenne(userId, nuovoValore);
        if (error) {
          mostraStatus('Errore: ' + error.message, false);
          chatCheck.checked = !nuovoValore;
        } else {
          await adminRegistraAzione('chat_minorenne_change', userId, { minorenne: nuovoValore });
          mostraStatus(nuovoValore ? 'Utente marcato come minorenne — chat bloccata.' : 'Segno di minorenne rimosso — chat riabilitata.', true);
        }
        chatCheck.disabled = false;
      });
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

    <div class="section-title">Chat — restrizioni d'uso</div>
    <div class="action-grid">
      <label style="display:flex;align-items:center;gap:0.5rem;font-weight:600;cursor:pointer;">
        <input type="checkbox" id="chat-minorenne-check" style="width:auto;" disabled>
        Utente minorenne — chat non disponibile
      </label>
    </div>

    <div class="section-title">Ban</div>
    <div class="action-grid">
      <div class="ban-rapidi">
        <button class="btn-small btn-ghost" data-act="ban-1">1 giorno</button>
        <button class="btn-small btn-ghost" data-act="ban-7">7 giorni</button>
        <button class="btn-small btn-ghost" data-act="ban-30">30 giorni</button>
      </div>
      <div class="inline-form">
        <input type="number" id="ban-giorni" min="1" placeholder="gg" value="7">
        <button class="btn-small btn-ghost" data-act="ban-temp">Altro (giorni)</button>
      </div>
      <button class="btn-small btn-danger" data-act="ban-perma">Ban per sempre</button>
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
    if (azione === 'ban-temp' || azione === 'ban-1' || azione === 'ban-7' || azione === 'ban-30') {
      const giorni = azione === 'ban-temp'
        ? parseInt(document.getElementById('ban-giorni').value, 10)
        : parseInt(azione.slice(4), 10);
      if (!giorni || giorni < 1) { mostraStatus('Inserisci un numero di giorni valido.', false); return; }
      if (!await adminDialog({ titolo: 'Bannare?', testo: `"${u.username}" sarà bannato per ${giorni} giorni.`, conferma: 'Banna', pericolo: true })) return;
      const until = new Date(Date.now() + giorni * 86400000).toISOString();
      const { error } = await adminBanUtente(u.id, until, `Ban temporaneo (${giorni} giorni)`);
      if (error) throw error;
      mostraStatus('Utente bannato.', true);
    }
    else if (azione === 'ban-perma') {
      if (!await adminDialog({ titolo: 'Ban per sempre?', testo: `"${u.username}" resterà bloccato finché non lo sbanni tu.`, conferma: 'Banna per sempre', pericolo: true })) return;
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
      if (!await adminDialog({ titolo: 'Chiudere le sessioni?', testo: `Tutte le sessioni attive di "${u.username}" verranno chiuse.`, conferma: 'Chiudi sessioni' })) return;
      const { error } = await adminRevocaSessioni(u.id);
      if (error) throw error;
      mostraStatus('Sessioni revocate.', true);
    }
    else if (azione === 'soft-delete') {
      if (!await adminDialog({ titolo: 'Eliminare l\'account?', testo: `L'account "${u.username}" viene disattivato. È reversibile con "Ripristina".`, conferma: 'Elimina', pericolo: true })) return;
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
      if (!await adminDialog({ titolo: '⚠️ Cancellazione definitiva', testo: `Cancella DEFINITIVAMENTE l'account "${u.username}" e tutti i suoi dati. Non si può annullare.`, conferma: 'Cancella per sempre', pericolo: true, scriviPerConfermare: u.username })) return;
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
