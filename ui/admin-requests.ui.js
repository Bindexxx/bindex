// Admin, Richieste: elenco, approvazione e rifiuto.

function _etichettaTipoRichiesta(type, slot) {
  if (type === 'password_reset') return 'Reset password';
  if (type === 'username_change') return 'Cambio username';
  if (type === 'binder_nome') return 'Nome Binder';
  if (type === 'scaffale_nome') return 'Nome Scaffale';
  if (type === 'photo_upload') {
    if (slot === 'card_back') return 'Retro carta';
    if (slot === 'binder_cover') return 'Copertina Binder';
    if (slot === 'profilo') return 'Foto profilo';
    return 'Foto Binder';
  }
  return type;
}

async function _popolaFiltroUtenteRichieste() {
  const sel = document.getElementById('filtroUtenteRichieste');
  if (sel.options.length > 1) return;
  const { data } = await adminListaUtentiPerFiltro();
  (data || []).forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.id;
    opt.textContent = u.username || u.id;
    sel.appendChild(opt);
  });
}

async function _aggiornaContatoreRichieste() {
  const { count } = await adminContaRichiestePendenti();
  const elC = document.getElementById('count-richieste');
  elC.textContent = count || 0;
  elC.classList.toggle('zero', !count);
}

async function caricaRichieste() {
  const cont = document.getElementById('richieste-list');
  await _popolaFiltroUtenteRichieste();
  await _aggiornaContatoreRichieste();

  const tipo = document.getElementById('filtroTipoRichieste').value;
  const utente = document.getElementById('filtroUtenteRichieste').value;
  const stato = document.getElementById('filtroStatoRichieste').value;
  const dataDa = document.getElementById('filtroDataDaRichieste').value;
  const dataA = document.getElementById('filtroDataARichieste').value;

  let query = adminQueryRichieste();
  if (tipo !== 'all') query = query.eq('type', tipo);
  if (utente !== 'all') query = query.eq('user_id', utente);
  if (stato !== 'all') query = query.eq('status', stato);
  if (dataDa) query = query.gte('created_at', dataDa + 'T00:00:00');
  if (dataA) query = query.lte('created_at', dataA + 'T23:59:59');

  const { data, error } = await query;
  if (error) { cont.innerHTML = `<div class="empty-state">Errore: ${error.message}</div>`; return; }
  _ultimeRichiesteCaricate = data || [];

  const userIds = [...new Set(_ultimeRichiesteCaricate.map(r => r.user_id).filter(Boolean))];
  _mappaUsernameRichieste = {};
  if (userIds.length > 0) {
    const { data: profili, error: erroreProfili } = await adminProfiliPerIds(userIds);
    if (!erroreProfili && profili) {
      _mappaUsernameRichieste = Object.fromEntries(profili.map(p => [p.id, p.username]));
    }
  }

  const mediaIds = [...new Set(_ultimeRichiesteCaricate
    .filter(r => r.type === 'photo_upload' && r.status === 'pending' && r.payload?.media_id)
    .map(r => r.payload.media_id))];
  _mappaAnteprimaFotoRichieste = {};
  _mappaSlotRichieste = {};
  if (mediaIds.length > 0) {
    const { data: mediaRows } = await adminUserMediaPerIds(mediaIds);
    if (mediaRows) {
      mediaRows.forEach(m => { _mappaSlotRichieste[m.id] = m.slot; });
      const urls = await Promise.all(mediaRows.map(async (m) => {
        const { data: signed } = await adminSignedUrlUserMedia(m.storage_path, 600);
        return [m.id, signed?.signedUrl || null];
      }));
      _mappaAnteprimaFotoRichieste = Object.fromEntries(urls);
    }
  }

  _mappaPrimaRichieste = {};
  await Promise.all(_ultimeRichiesteCaricate
    .filter(r => (r.type === 'binder_nome' || r.type === 'scaffale_nome') && r.status === 'pending')
    .map(async (r) => {
      try {
        const { data, error } = await adminContestoRichiesta(r.id);
        const riga = Array.isArray(data) ? data[0] : data;
        if (!error && riga && riga.prima) _mappaPrimaRichieste[r.id] = riga.prima;
      } catch (e) { console.error('[admin] contesto richiesta:', e); }
    }));

  renderRichieste();
}

function renderRichieste() {
  const cont = document.getElementById('richieste-list');
  const elenco = _nascondiGiaGestite
    ? _ultimeRichiesteCaricate.filter(r => r.status === 'pending')
    : _ultimeRichiesteCaricate;

  if (elenco.length === 0) {
    cont.innerHTML = '<div class="empty-state">Nessuna richiesta trovata con i filtri attuali.</div>';
    return;
  }

  cont.innerHTML = elenco.map(r => {
    const utente = escAttr(_mappaUsernameRichieste[r.user_id] || r.user_id);
    let dettaglio = '';
    if (r.type === 'username_change' && r.payload?.nuovo_username) {
      dettaglio = `<div class="rq-pd"><span class="prima">${utente}</span><span class="freccia">→</span><span class="dopo">${escAttr(r.payload.nuovo_username)}</span></div>`;
    }
    if (r.type === 'binder_nome' && r.payload?.nome_proposto && _mappaPrimaRichieste[r.id]) {
      dettaglio = `<div class="rq-pd"><span class="prima">${escAttr(_mappaPrimaRichieste[r.id])}</span><span class="freccia">→</span><span class="dopo">${escAttr(r.payload.nome_proposto)}</span></div>`;
    } else if (r.type === 'binder_nome' && r.payload?.nome_proposto) {
      dettaglio = `<div class="rq-pd"><span class="freccia">Nuovo nome del binder:</span><span class="dopo">${escAttr(r.payload.nome_proposto)}</span></div>`;
    }
    if (r.type === 'scaffale_nome' && r.payload?.nome_proposto && _mappaPrimaRichieste[r.id]) {
      dettaglio = `<div class="rq-pd"><span class="prima">${escAttr(_mappaPrimaRichieste[r.id])}</span><span class="freccia">→</span><span class="dopo">${escAttr(r.payload.nome_proposto)}</span></div>`;
    } else if (r.type === 'scaffale_nome' && r.payload?.nome_proposto) {
      dettaglio = `<div class="rq-pd"><span class="freccia">Nuovo nome dello scaffale:</span><span class="dopo">${escAttr(r.payload.nome_proposto)}</span></div>`;
    }
    const urlFoto = r.type === 'photo_upload' ? _mappaAnteprimaFotoRichieste[r.payload?.media_id] : null;
    const slotFoto = r.type === 'photo_upload' ? _mappaSlotRichieste[r.payload?.media_id] : null;

    return `
    <div class="rq-card row" data-id="${r.id}" data-type="${r.type}" data-user-id="${r.user_id || ''}" data-media-id="${r.payload?.media_id || ''}" data-slot="${slotFoto || ''}" data-utente="${utente}">
      ${urlFoto ? `<img class="rq-foto" src="${urlFoto}" alt="Anteprima" onclick="window.open('${urlFoto}','_blank')">` : ''}
      <div class="main">
        <div class="name">${_etichettaTipoRichiesta(r.type, slotFoto)} <span class="badge ${r.status}">${_etichettaStatoRichiesta(r.status)}</span></div>
        <div class="meta mono">${utente} · ${fmtData(r.created_at)}</div>
        ${dettaglio}
        ${r.admin_note ? `<div class="rq-nota">Nota: ${escAttr(r.admin_note)}</div>` : ''}
      </div>
      <div class="row-azioni rq-azioni">
        ${r.status === 'pending' ? `
          <button class="btn-small btn-approve" data-action="approve">✔ Approva</button>
          <button class="btn-small btn-reject" data-action="reject">✘ Rifiuta</button>
        ` : ''}
      </div>
    </div>`;
  }).join('');

  cont.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const riga = btn.closest('.row');
      const id = riga.dataset.id;
      const tipo = riga.dataset.type;
      const azione = btn.dataset.action;
      const mediaId = riga.dataset.mediaId;
      const slotFoto = riga.dataset.slot;
      const ownerUserId = riga.dataset.userId;

      if (azione === 'approve' && tipo === 'username_change') {
        if (!await adminDialog({ titolo: 'Cambio username', testo: 'Le sessioni attive di questo utente verranno revocate: dovrà rifare login con il nuovo username. Verifica di aver letto correttamente il nuovo username.', conferma: 'Approva' })) return;
      }
      if (azione === 'approve' && tipo === 'photo_upload') {
        const etichettaConferma = slotFoto === 'card_back' ? 'come retro carta personalizzato' : 'come copertina del Binder';
        if (!await adminDialog({ titolo: 'Approvare la foto?', testo: `Verrà usata ${etichettaConferma}.`, conferma: 'Approva' })) return;
      }
      if (azione === 'approve' && tipo === 'binder_nome') {
        if (!await adminDialog({ titolo: 'Approvare il nome?', testo: 'Il nuovo nome sostituirà quello del binder.', conferma: 'Approva' })) return;
      }
      if (azione === 'approve' && tipo === 'scaffale_nome') {
        if (!await adminDialog({ titolo: 'Approvare il nome?', testo: 'Il nuovo nome sostituirà quello dello scaffale.', conferma: 'Approva' })) return;
      }

      let nota = null;
      if (azione === 'reject') {
        const esito = await adminDialog({
          titolo: 'Rifiutare la richiesta?',
          testo: `Richiesta di ${riga.dataset.utente}. Il motivo resta nella nota della richiesta.`,
          conferma: 'Rifiuta', pericolo: true, conNota: true,
          motivi: ['Non appropriata', 'Immagine poco leggibile o di bassa qualità', 'Nome non consentito', 'Altro motivo']
        });
        if (!esito) return;
        nota = esito.motivo + (esito.nota ? ' — ' + esito.nota : '');
      }

      riga.querySelectorAll('button').forEach(b => b.disabled = true);

      let payloadRpc = nota ? { nota } : null;
      let nuovaPwGenerata = null;
      if (azione === 'approve' && tipo === 'password_reset') {
        nuovaPwGenerata = generaPassword();
        payloadRpc = { new_password: nuovaPwGenerata };
      }

      const { error } = await adminProcessaRichiesta(id, azione === 'approve' ? 'approved' : 'rejected', payloadRpc);

      if (error) {
        mostraStatus('Errore: ' + error.message, false);
        riga.querySelectorAll('button').forEach(b => b.disabled = false);
        return;
      }

      if (azione === 'approve' && tipo === 'photo_upload' && mediaId && slotFoto && ownerUserId) {
        try {
          await _sincronizzaCopiaPubblica(mediaId, slotFoto, ownerUserId);
        } catch (e) {
          console.error('Copia pubblica non riuscita:', e);
          mostraStatus('Approvata, ma la copia pubblica non è riuscita (' + e.message + '). Riprova con "Sincronizza copie pubbliche".', false);
        }
      }

      if (nuovaPwGenerata) {
        const rigaInMemoria = _ultimeRichiesteCaricate.find(r => String(r.id) === String(id));
        if (rigaInMemoria) rigaInMemoria.status = 'approved';

        const nomeUtente = _mappaUsernameRichieste[riga.dataset.userId] || 'utente';
        riga.querySelector('.row-azioni').innerHTML = `
          <div class="pw-reveal">
            Nuova password per <b>${nomeUtente}</b>:
            <div class="pw-value">${nuovaPwGenerata}</div>
            <button class="btn-small btn-toggle-role" id="pw-share-${id}">📤 Condividi</button>
          </div>`;
        document.getElementById(`pw-share-${id}`).addEventListener('click', async () => {
          const testo = `Bindex — la tua nuova password è: ${nuovaPwGenerata}`;
          if (navigator.share) { try { await navigator.share({ text: testo }); } catch (e) {} }
          else { await navigator.clipboard.writeText(testo); mostraStatus('Copiato negli appunti (condivisione nativa non disponibile su questo browser).', true); }
        });
        mostraStatus('Richiesta approvata.', true);
        _aggiornaContatoreRichieste();
        caricaUtenti();
        caricaLogAdmin();
        return;
      }

      mostraStatus('Richiesta aggiornata.', true);
      caricaRichieste();
      caricaUtenti();
      caricaLogAdmin();
    });
  });
}
