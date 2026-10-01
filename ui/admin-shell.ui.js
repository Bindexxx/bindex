// ── ui/admin-shell.ui.js ───────────────────────────────────────────────
// Guscio dell'app admin: login/logout, controllo ruolo all'avvio, tab
// navigation, messaggio di stato condiviso da tutti i pannelli.



function mostraSolo(el) {
  [loginScreen, deniedScreen, dash].forEach(e => e.style.display = 'none');
  el.style.display = (el === dash) ? 'block' : 'flex';
}


// ── LOGIN ──────────────────────────────────────────────────────

async function tentaLogin() {
  const inputUtente = elUser.value.trim();
  const password = elPass.value;
  if (!inputUtente || !password) {
    elErr.textContent = 'Inserisci nome utente e password.';
    elErr.style.display = 'block';
    return;
  }
  const email = inputUtente.includes('@') ? inputUtente : inputUtente.toLowerCase() + '@cardsyncpro.local';
  elSubmit.disabled = true;
  elSubmit.textContent = 'Accesso in corso…';
  elErr.style.display = 'none';

  const { error } = await adminAuthLogin(email, password);
  if (error) {
    elErr.textContent = '❌ ' + (error.message === 'Invalid login credentials' ? 'Nome utente o password errati.' : error.message);
    elErr.style.display = 'block';
    elSubmit.disabled = false;
    elSubmit.textContent = 'Accedi';
    return;
  }
  await controllaRuoloEAvvia();
}

elSubmit.addEventListener('click', tentaLogin);
[elUser, elPass].forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') tentaLogin(); }));


async function logout() {
  await adminAuthLogout();
  location.reload();
}
document.getElementById('logout-btn').addEventListener('click', logout);
document.getElementById('denied-logout').addEventListener('click', logout);


// ── CONTROLLO RUOLO ADMIN ─────────────────────────────────────
async function controllaRuoloEAvvia() {
  const sessione = await adminAuthGetSession();
  if (!sessione) { mostraSolo(loginScreen); return; }

  const { data: profilo, error } = await adminProfiloRuolo(sessione.user.id);

  if (error || !profilo || profilo.role !== 'admin') {
    mostraSolo(deniedScreen);
    return;
  }

  const bannatoAdesso = profilo.banned_until && new Date(profilo.banned_until) > new Date();
  if (profilo.deleted_at || bannatoAdesso) {
    // Auth Hooks non disponibile sul piano attuale (vedi sez.9 stato):
    // il blocco vero e proprio del login lo facciamo qui, subito dopo
    // il login riuscito — non impedisce l'accesso via chiamata diretta
    // alle API, ma copre l'uso normale della dashboard.
    await adminAuthLogout();
    mostraSolo(deniedScreen);
    return;
  }

  document.getElementById('who-label').textContent =
    (profilo.username || sessione.user.email) + ' — admin';
  mostraSolo(dash);
  caricaRichieste();
  caricaUtenti();
  caricaLogAdmin();
  if (typeof caricaWip === 'function') caricaWip();
}

// ── TABS ───────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
  });
});


function mostraStatus(msg, ok) {
  const el = document.getElementById('status-msg');
  el.textContent = msg;
  el.className = 'status-msg ' + (ok ? 'ok' : 'err');
  clearTimeout(mostraStatus._t);
  mostraStatus._t = setTimeout(() => { el.className = 'status-msg'; }, 4500);
}


// ═══════════════════════════════════════════════════════════════════════
// RESTYLE BINDEX FASE 7 — dialogo interno al posto di confirm()/prompt()
// ═══════════════════════════════════════════════════════════════════════
// adminDialog({ titolo, testo, conferma, pericolo, motivi, conNota, scriviPerConfermare })
// → Promise: null se annullato; altrimenti { motivo, nota }.
// motivi: elenco di scelte (radio) — la prima è preselezionata.
// scriviPerConfermare: testo da digitare per abilitare "Conferma"
// (sostituisce il prompt() dell'hard delete).
function adminDialog(opz) {
  return new Promise(resolve => {
    const bg = document.getElementById('adm-dialog-bg');
    const ok = document.getElementById('adm-dialog-ok');
    const annulla = document.getElementById('adm-dialog-annulla');
    const boxMotivi = document.getElementById('adm-dialog-motivi');
    const nota = document.getElementById('adm-dialog-nota');
    const conf = document.getElementById('adm-dialog-conferma-testo');

    document.getElementById('adm-dialog-titolo').textContent = opz.titolo || 'Conferma';
    document.getElementById('adm-dialog-testo').textContent = opz.testo || '';
    ok.textContent = opz.conferma || 'Conferma';
    ok.className = opz.pericolo ? 'btn-small btn-danger' : 'btn-main';
    if (opz.pericolo) ok.style.padding = '9px 16px';

    boxMotivi.innerHTML = '';
    (opz.motivi || []).forEach((m, i) => {
      const lab = document.createElement('label');
      lab.innerHTML = '<input type="radio" name="adm-motivo"' + (i === 0 ? ' checked' : '') + '> <span></span>';
      lab.querySelector('input').value = m;
      lab.querySelector('span').textContent = m;
      boxMotivi.appendChild(lab);
    });
    nota.style.display = opz.conNota ? '' : 'none';
    nota.value = '';
    conf.style.display = opz.scriviPerConfermare ? '' : 'none';
    conf.value = '';
    conf.placeholder = opz.scriviPerConfermare ? ('Scrivi: ' + opz.scriviPerConfermare) : '';
    const aggiornaOk = () => { ok.disabled = !!opz.scriviPerConfermare && conf.value !== opz.scriviPerConfermare; };
    conf.oninput = aggiornaOk;
    aggiornaOk();

    const chiudi = (esito) => {
      bg.style.display = 'none';
      ok.onclick = annulla.onclick = bg.onclick = null;
      document.removeEventListener('keydown', tasto);
      resolve(esito);
    };
    const tasto = (e) => { if (e.key === 'Escape') chiudi(null); };
    ok.onclick = () => {
      const r = boxMotivi.querySelector('input:checked');
      chiudi({ motivo: r ? r.value : null, nota: nota.value.trim() || null });
    };
    annulla.onclick = () => chiudi(null);
    bg.onclick = (e) => { if (e.target === bg) chiudi(null); };
    document.addEventListener('keydown', tasto);
    bg.style.display = 'flex';
  });
}

// Etichette italiane degli stati richiesta.
function _etichettaStatoRichiesta(s) {
  return ({ pending: 'da approvare', approved: 'approvata', rejected: 'rifiutata' })[s] || s;
}
