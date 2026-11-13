// Guscio della pagina admin: accesso, controllo del ruolo, schede.

function mostraSolo(el) {
  [loginScreen, deniedScreen, dash, mfaScreen].forEach(e => { if (e) e.style.display = 'none'; });
  el.style.display = (el === dash) ? 'block' : 'flex';
}

async function tentaLogin() {
  const inputUtente = elUser.value.trim();
  const password = elPass.value;
  if (!inputUtente || !password) {
    elErr.textContent = 'Inserisci nome utente e password.';
    elErr.style.display = 'block';
    return;
  }
  // AMBIENTE DI TEST: il nome da solo si completa con @test.local. In produzione
  // '@cardsyncpro.local', insieme agli altri punti marcati così (sito ed estensione)
  // e a sql/110_..._ROLLBACK.sql.
  const email = inputUtente.includes('@') ? inputUtente : inputUtente.toLowerCase() + '@test.local';
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
    await adminAuthLogout();
    mostraSolo(deniedScreen);
    return;
  }

  if (!(await _adminMfaVerificata())) return;

  document.getElementById('who-label').textContent =
    (profilo.username || sessione.user.email) + ' — admin';
  mostraSolo(dash);
  caricaRichieste();
  caricaUtenti();
  caricaLogAdmin();
  if (typeof caricaWip === 'function') caricaWip();
  if (typeof caricaCatalogoAdmin === 'function') caricaCatalogoAdmin();
  if (typeof caricaShopAdmin === 'function') caricaShopAdmin();
}

let _mfaModo = null;

async function _adminMfaVerificata() {
  try {
    return await _adminMfaVerificataOra();
  } catch (e) {
    console.error('[admin] codice da app:', e);
    _mfaMostra('errore', { messaggio: _mfaMessaggioErrore(e) });
    mostraSolo(mfaScreen);
    return false;
  }
}

async function _adminMfaVerificataOra() {
  const { data: livello, error: errLivello } = await adminMfaLivello();
  if (!errLivello && livello && livello.currentLevel === 'aal2') return true;

  _mfaMostra('caricamento');
  mostraSolo(mfaScreen);

  const { data: fattori, error: errFattori } = await adminMfaFattori();
  if (errFattori) { _mfaMostra('errore', { messaggio: _mfaMessaggioErrore(errFattori) }); return false; }
  const tutti = (fattori && fattori.all) || [];
  const attivo = tutti.find(f => f.factor_type === 'totp' && f.status === 'verified');
  if (attivo) {
    _mfaFattoreInCorso = attivo.id;
    _mfaMostra('accesso');
    return false;
  }

  for (const f of tutti) {
    if (f.factor_type === 'totp' && f.status !== 'verified') {
      try { await adminMfaTogli(f.id); } catch (_) {   }
    }
  }
  const nome = 'Bindex admin ' + new Date().toISOString().slice(0, 16).replace('T', ' ');
  const { data: nuovo, error: errIscr } = await adminMfaIscrivi(nome);
  if (errIscr || !nuovo || !nuovo.totp) {
    _mfaMostra('errore', { messaggio: _mfaMessaggioErrore(errIscr) });
    return false;
  }
  _mfaFattoreInCorso = nuovo.id;
  _mfaMostra('iscrizione', { qr: nuovo.totp.qr_code, segreto: nuovo.totp.secret });
  return false;
}

function _mfaQrSrc(qr) {
  if (!qr || typeof qr !== 'string') return '';
  const virgola = qr.indexOf(',');
  const svg = (qr.startsWith('data:') && virgola > 0) ? qr.slice(virgola + 1) : qr;
  if (svg.trim().startsWith('<')) return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  return qr.startsWith('data:image/') ? qr : '';
}

function _mfaMostra(modo, dati) {
  _mfaModo = modo;
  dati = dati || {};
  const titolo = document.getElementById('mfa-titolo');
  const testo = document.getElementById('mfa-testo');
  const qrBox = document.getElementById('mfa-qr-box');
  const qr = document.getElementById('mfa-qr');
  const segreto = document.getElementById('mfa-segreto');
  const etichetta = document.getElementById('mfa-codice-label');
  const campo = document.getElementById('mfa-codice');
  const errore = document.getElementById('mfa-errore');
  const conferma = document.getElementById('mfa-conferma');

  const conCodice = modo === 'iscrizione' || modo === 'accesso';
  errore.style.display = 'none';
  errore.textContent = '';
  campo.value = '';
  etichetta.style.display = campo.style.display = conCodice ? '' : 'none';
  conferma.style.display = modo === 'caricamento' ? 'none' : '';
  conferma.disabled = false;
  conferma.textContent = modo === 'errore' ? 'Riprova' : 'Conferma';

  if (modo === 'iscrizione') {
    qr.src = _mfaQrSrc(dati.qr);
    segreto.textContent = dati.segreto || '';
    qrBox.style.display = 'block';
  } else {
    qr.removeAttribute('src');
    segreto.textContent = '';
    qrBox.style.display = 'none';
  }

  if (modo === 'caricamento') {
    titolo.textContent = '🔐 Codice di sicurezza';
    testo.textContent = 'Controllo in corso…';
  } else if (modo === 'iscrizione') {
    titolo.textContent = '🔐 Attiva il codice di sicurezza';
    testo.textContent = 'Per entrare nella dashboard admin serve, oltre alla password, un codice a 6 cifre che cambia ogni 30 secondi. Inquadra il QR con un\'app di autenticazione (Google Authenticator, Microsoft Authenticator, Authy, 1Password…) e scrivi qui sotto il codice che compare. Alla conferma Supabase chiude le tue altre sessioni senza codice (es. l\'estensione o un altro PC): lì basterà rientrare.';
  } else if (modo === 'accesso') {
    titolo.textContent = '🔐 Codice di sicurezza';
    testo.textContent = 'Apri l\'app di autenticazione e scrivi il codice a 6 cifre di Bindex admin.';
  } else if (modo === 'errore') {
    titolo.textContent = '🔐 Codice di sicurezza non disponibile';
    testo.textContent = 'Senza il codice la dashboard admin resta chiusa.';
    errore.textContent = dati.messaggio || 'Errore imprevisto: riprova.';
    errore.style.display = 'block';
  }
  if (conCodice) setTimeout(() => campo.focus(), 0);
}

function _mfaMessaggioErrore(err) {
  const codice = (err && err.code) || '';
  const testo = (err && err.message) || '';
  if (codice === 'mfa_verification_failed' || /invalid totp/i.test(testo)) return 'Codice non valido o scaduto: riprova con quello nuovo.';
  if (codice === 'mfa_challenge_expired') return 'Il codice è scaduto: riprova con quello nuovo.';
  if (/^mfa_.*not_enabled$/.test(codice) || /not enabled|disabled/i.test(testo)) {
    return 'Il codice da app è spento nel progetto: in Supabase apri Authentication → Multi-Factor, attiva "App Authenticator (TOTP)" e premi Riprova.';
  }
  if (codice === 'too_many_enrolled_mfa_factors') return 'Troppi dispositivi registrati: toglili dalla dashboard Supabase (Authentication → Users → il tuo utente) e premi Riprova.';
  if ((err && err.status === 429) || /rate limit/i.test(codice + ' ' + testo)) return 'Troppi tentativi: aspetta un minuto e riprova.';
  return 'Errore: ' + (testo || 'riprova tra poco') + '.';
}

async function _mfaConferma() {
  const campo = document.getElementById('mfa-codice');
  const errore = document.getElementById('mfa-errore');
  const conferma = document.getElementById('mfa-conferma');
  if (conferma.disabled) return;
  if (_mfaModo === 'errore') { await controllaRuoloEAvvia(); return; }
  const codice = (campo.value || '').replace(/\D/g, '');
  const mostraErrore = (msg) => { errore.textContent = msg; errore.style.display = 'block'; };
  if (codice.length !== 6) { mostraErrore('Scrivi le 6 cifre del codice.'); campo.focus(); return; }
  if (!_mfaFattoreInCorso) { mostraErrore('Ricarica la pagina e riprova.'); return; }

  conferma.disabled = true;
  conferma.textContent = 'Verifica…';
  errore.style.display = 'none';
  let error = null;
  try {
    ({ error } = await adminMfaVerifica(_mfaFattoreInCorso, codice));
  } catch (e) {
    error = e;
  }
  conferma.disabled = false;
  conferma.textContent = 'Conferma';
  if (error) {
    mostraErrore(_mfaMessaggioErrore(error));
    campo.value = '';
    campo.focus();
    return;
  }
  _mfaFattoreInCorso = null;
  _mfaMostra('caricamento');
  await controllaRuoloEAvvia();
}

document.getElementById('mfa-conferma').addEventListener('click', _mfaConferma);
document.getElementById('mfa-codice').addEventListener('keydown', e => { if (e.key === 'Enter') _mfaConferma(); });
document.getElementById('mfa-esci').addEventListener('click', logout);

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

function _etichettaStatoRichiesta(s) {
  return ({ pending: 'da approvare', approved: 'approvata', rejected: 'rifiutata' })[s] || s;
}
