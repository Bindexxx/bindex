// ── ui/admin-requests.ui.js ──────────────────────────────────────────
// Pannello "Richieste": elenco pending_requests con filtri, approvazione/
// rifiuto, export CSV, archiviazione, sincronizzazione copie pubbliche.


// ── RICHIESTE PENDENTI ─────────────────────────────────────────
// Etichette leggibili per i 3 tipi di richiesta gestiti dal dispatcher.
function _etichettaTipoRichiesta(type, slot) {
  if (type === 'password_reset') return 'Reset password';
  if (type === 'username_change') return 'Cambio username';
  if (type === 'binder_nome') return 'Nome Binder'; // 21_binder_nome_con_approvazione.sql
  if (type === 'photo_upload') {
    // FASE 4-bis (20/08/2026): prima era genericamente "Foto Binder" per
    // qualsiasi slot — da quando esiste anche card_back (Fase 2) va
    // distinto, altrimenti l'admin approva "alla cieca" su cosa sta
    // davvero approvando.
    if (slot === 'card_back') return 'Retro carta';
    if (slot === 'binder_cover') return 'Copertina Binder';
    return 'Foto Binder'; // slot sconosciuto/non ancora caricato — fallback prudente
  }
  return type;
}



async function _popolaFiltroUtenteRichieste() {
  const sel = document.getElementById('filtroUtenteRichieste');
  if (sel.options.length > 1) return; // già popolato in precedenza
  const { data } = await adminListaUtentiPerFiltro();
  (data || []).forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.id;
    opt.textContent = u.username || u.id;
    sel.appendChild(opt);
  });
}


// Contatore badge sulla tab "Richieste": SEMPRE il totale reale delle
// pending non archiviate, indipendente dai filtri applicati alla vista
// (altrimenti filtrando per tipo/utente il numero diventerebbe fuorviante).
async function _aggiornaContatoreRichieste() {
  const { count } = await adminContaRichiestePendenti();
  document.getElementById('count-richieste').textContent = count || 0;
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

  // Join fatto qui in JS invece che con l'embed di PostgREST: evita di
  // dipendere dalla cache schema delle foreign key (che si è dimostrata
  // inaffidabile per questa tabella), con una seconda query separata.
  const userIds = [...new Set(_ultimeRichiesteCaricate.map(r => r.user_id).filter(Boolean))];
  _mappaUsernameRichieste = {};
  if (userIds.length > 0) {
    const { data: profili, error: erroreProfili } = await adminProfiliPerIds(userIds);
    if (!erroreProfili && profili) {
      _mappaUsernameRichieste = Object.fromEntries(profili.map(p => [p.id, p.username]));
    }
  }

  // Per le richieste photo_upload pending, recuperiamo l'anteprima
  // dell'immagine da approvare/rifiutare (Fase 3 — prima non era
  // visibile, l'admin doveva approvare "alla cieca").
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
    let dettaglio = '';
    if (r.type === 'username_change' && r.payload?.nuovo_username) {
      dettaglio = `<div class="meta">→ nuovo username: <b>${escAttr(r.payload.nuovo_username)}</b></div>`;
    }
    if (r.type === 'binder_nome' && r.payload?.nome_proposto) {
      dettaglio = `<div class="meta">→ nuovo nome binder: <b>${escAttr(r.payload.nome_proposto)}</b></div>`;
    }
    const urlFoto = r.type === 'photo_upload' ? _mappaAnteprimaFotoRichieste[r.payload?.media_id] : null;
    const slotFoto = r.type === 'photo_upload' ? _mappaSlotRichieste[r.payload?.media_id] : null;

    return `
    <div class="row" data-id="${r.id}" data-type="${r.type}" data-user-id="${r.user_id || ''}" data-media-id="${r.payload?.media_id || ''}" data-slot="${slotFoto || ''}">
      ${urlFoto ? `<img src="${urlFoto}" style="width:52px; height:52px; border-radius:8px; object-fit:cover; flex-shrink:0; cursor:pointer;" onclick="window.open('${urlFoto}','_blank')">` : ''}
      <div class="main">
        <div class="name">${_etichettaTipoRichiesta(r.type, slotFoto)} <span class="badge ${r.status}">${r.status}</span></div>
        <div class="meta mono">${escAttr(_mappaUsernameRichieste[r.user_id] || r.user_id)} · ${fmtData(r.created_at)}</div>
        ${dettaglio}
        ${r.admin_note ? `<div class="meta">Nota: ${escAttr(r.admin_note)}</div>` : ''}
      </div>
      <div class="row-azioni" style="display:flex; gap:8px;">
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
      const azione = btn.dataset.action; // 'approve' | 'reject'
      const mediaId = riga.dataset.mediaId;
      const slotFoto = riga.dataset.slot;
      const ownerUserId = riga.dataset.userId;

      if (azione === 'approve' && tipo === 'username_change') {
        if (!confirm('Confermi il cambio username? Le sessioni attive di questo utente verranno revocate: dovrà rifare login con il nuovo username. Verifica di aver letto correttamente il nuovo username prima di procedere.')) return;
      }
      if (azione === 'approve' && tipo === 'photo_upload') {
        const etichettaConferma = slotFoto === 'card_back' ? 'come retro carta personalizzato' : 'come copertina del Binder';
        if (!confirm(`Approvare questa foto ${etichettaConferma}?`)) return;
      }
      if (azione === 'approve' && tipo === 'binder_nome') {
        if (!confirm('Approvare il nuovo nome per questo binder?')) return;
      }

      let nota = null;
      if (azione === 'reject') {
        nota = prompt('Motivo del rifiuto (facoltativo, lasciare vuoto per saltare):');
        if (nota === null) return; // annullato dal prompt
        nota = nota.trim() || null;
      }

      riga.querySelectorAll('button').forEach(b => b.disabled = true);

      // ── Ramo password_reset in approvazione: genera la password qui,
      // la passa al dispatcher, poi la mostra con tasto Condividi. Per
      // tutti gli altri casi il payload è nota (rifiuto) o assente.
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

      // FASE 4-bis (20/08/2026): dopo un'approvazione di photo_upload,
      // copia il file nel bucket pubblico 'immaginivisibili' — serve a
      // scambio.html/wishlist.html (viewer anonimi, non possono leggere
      // il bucket privato 'user-media'). Non blocca il flusso: se questo
      // passo fallisce, l'approvazione in DB è comunque già andata a
      // buon fine (l'utente la vede su index.html); si vedrà solo un
      // avviso qui, recuperabile in qualsiasi momento col bottone
      // "Sincronizza copie pubbliche".
      if (azione === 'approve' && tipo === 'photo_upload' && mediaId && slotFoto && ownerUserId) {
        try {
          await _sincronizzaCopiaPubblica(mediaId, slotFoto, ownerUserId);
        } catch (e) {
          console.error('Copia pubblica non riuscita:', e);
          mostraStatus('Approvata, ma la copia pubblica non è riuscita (' + e.message + '). Riprova con "Sincronizza copie pubbliche".', false);
        }
      }

      if (nuovaPwGenerata) {
        // FIX (bug [14]): _ultimeRichiesteCaricate non viene ricaricato da
        // qui (di proposito: il pannello password sotto va mostrato SUBITO,
        // un refresh lo farebbe sparire visto che la password non è salvata
        // da nessuna parte, va copiata ora). Ma senza aggiornare anche solo
        // lo status in memoria, un clic su "Nascondi già gestite"/"Mostra
        // tutte" PRIMA del prossimo caricaRichieste() ricostruiva la riga
        // da un record ancora 'pending' — pannello password sparito,
        // bottoni Approva/Rifiuta ricomparsi, un secondo Approva sarebbe
        // andato in errore RPC (richiesta non più pending). Aggiornando lo
        // status qui, un render successivo la mostra correttamente come
        // "approved" (nessun bottone, vedi renderRichieste), niente stato
        // inconsistente.
        const rigaInMemoria = _ultimeRichiesteCaricate.find(r => String(r.id) === String(id));
        if (rigaInMemoria) rigaInMemoria.status = 'approved';

        // Non ricarichiamo subito la lista: mostriamo prima la password
        // generata con il tasto Condividi, stesso pattern già usato
        // nella modale utente per "Genera e reimposta password".
        const nomeUtente = _mappaUsernameRichieste[riga.dataset.userId] || 'utente';
        riga.querySelector('.row-azioni').innerHTML = `
          <div class="pw-reveal">
            Nuova password per <b>${nomeUtente}</b>:
            <div class="pw-value">${nuovaPwGenerata}</div>
            <button class="btn-small btn-toggle-role" id="pw-share-${id}">📤 Condividi</button>
          </div>`;
        document.getElementById(`pw-share-${id}`).addEventListener('click', async () => {
          const testo = `CardSync Pro — la tua nuova password è: ${nuovaPwGenerata}`;
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

// ── FILTRI, EXPORT, NASCONDI, ARCHIVIA (Fase f) ─────────────────
['filtroTipoRichieste', 'filtroUtenteRichieste', 'filtroStatoRichieste', 'filtroDataDaRichieste', 'filtroDataARichieste'].forEach(id => {
  document.getElementById(id).addEventListener('change', () => caricaRichieste());
});

document.querySelectorAll('[data-preset]').forEach(btn => {
  btn.addEventListener('click', () => {
    const oggi = new Date();
    let da;
    if (btn.dataset.preset === 'oggi') da = new Date(oggi);
    else if (btn.dataset.preset === '7g') { da = new Date(oggi); da.setDate(da.getDate() - 6); }
    else if (btn.dataset.preset === 'mese') da = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
    // FIX (bug [15]): .toISOString() converte sempre a UTC — con orario
    // Italia, cliccando un preset tra mezzanotte e le ~2 del mattino la
    // data calcolata risultava quella di ieri invece di oggi. _dataLocaleISO
    // usa i componenti locali (anno/mese/giorno) invece di passare per UTC.
    document.getElementById('filtroDataDaRichieste').value = _dataLocaleISO(da);
    document.getElementById('filtroDataARichieste').value = _dataLocaleISO(oggi);
    caricaRichieste();
  });
});

document.getElementById('btn-reset-filtri-richieste').addEventListener('click', () => {
  document.getElementById('filtroTipoRichieste').value = 'all';
  document.getElementById('filtroUtenteRichieste').value = 'all';
  document.getElementById('filtroStatoRichieste').value = 'all';
  document.getElementById('filtroDataDaRichieste').value = '';
  document.getElementById('filtroDataARichieste').value = '';
  caricaRichieste();
});

document.getElementById('btn-nascondi-gestite').addEventListener('click', (ev) => {
  _nascondiGiaGestite = !_nascondiGiaGestite;
  ev.target.textContent = _nascondiGiaGestite ? '👁️ Mostra tutte' : '🙈 Nascondi già gestite';
  renderRichieste();
});


// ── COPIA PUBBLICA card_back/binder_cover (Fase 4-bis, 20/08/2026) ──
// Il bucket 'immaginivisibili' è pubblico ma non deve MAI contenere
// foto non approvate: questa funzione va chiamata SOLO per media già
// approvati (chiamante: handler approve sopra, o sincronizzazione
// manuale sotto). Legge il file dal bucket privato 'user-media' (qui
// l'admin ha già i permessi, vedi policy "admin legge tutti i file"
// in 03_schema_ban_media_logs.sql) e lo ricarica in 'immaginivisibili'
// a un path fisso per utente+slot, sovrascrivendo l'eventuale copia
// precedente — un solo file pubblico per utente per slot, coerente
// con user_media (nessuna cronologia).
async function _sincronizzaCopiaPubblica(mediaId, slot, ownerUserId) {
    const { data: media, error: errMedia } = await adminMediaStoragePath(mediaId);
    if (errMedia || !media) throw new Error(errMedia?.message || 'media non trovato');

    const { data: signed, error: errSigned } = await adminSignedUrlUserMedia(media.storage_path, 60);
    if (errSigned || !signed?.signedUrl) throw new Error(errSigned?.message || 'impossibile firmare url privato');

    const risposta = await fetch(signed.signedUrl);
    if (!risposta.ok) throw new Error('download fallito (' + risposta.status + ')');
    const blob = await risposta.blob();

    const cartella = slot === 'card_back' ? 'carta' : 'binder';
    const destPath = `${cartella}/${ownerUserId}.png`;
    const { error: errUpload } = await adminUploadImmaginiVisibili(destPath, blob);
    if (errUpload) throw errUpload;
}

// Bottone "Sincronizza copie pubbliche": ricrea le copie pubbliche per
// TUTTE le righe user_media già approvate con source='upload' e slot
// in (card_back, binder_cover) — utile una tantum dopo aver attivato
// questa funzione (le approvazioni fatte PRIMA di questa modifica non
// hanno mai avuto la copia creata automaticamente), o come recupero
// manuale se una singola copia fallisse silenziosamente.
document.getElementById('btn-sincronizza-pubbliche').addEventListener('click', async () => {
  if (!confirm('Ricreare le copie pubbliche per TUTTE le foto già approvate (retro carta + copertine Binder)? Può richiedere qualche secondo per ogni foto.')) return;

  const btn = document.getElementById('btn-sincronizza-pubbliche');
  btn.disabled = true;
  btn.textContent = '⏳ Sincronizzazione…';

  const { data: righe, error } = await adminMediaApprovatiDaSincronizzare();

  if (error) { mostraStatus('Errore: ' + error.message, false); btn.disabled = false; btn.textContent = '🔁 Sincronizza copie pubbliche'; return; }

  let ok = 0, falliti = 0;
  for (const r of (righe || [])) {
    try {
      await _sincronizzaCopiaPubblica(r.id, r.slot, r.user_id);
      ok++;
    } catch (e) {
      console.error('Sync fallita per', r.id, e);
      falliti++;
    }
  }

  btn.disabled = false;
  btn.textContent = '🔁 Sincronizza copie pubbliche';
  mostraStatus(`Sincronizzazione completata: ${ok} riuscite${falliti ? ', ' + falliti + ' fallite (vedi console)' : ''}.`, falliti === 0);
});

// Export 1/2: richieste degli utenti (da pending_requests), rispetta i
// filtri correntemente applicati alla vista.
document.getElementById('btn-esporta-richieste').addEventListener('click', () => {
  if (_ultimeRichiesteCaricate.length === 0) { mostraStatus('Nessun dato da esportare con i filtri attuali.', false); return; }
  const intestazioni = ['Data richiesta', 'Tipo', 'Utente', 'Stato', 'Dettaglio', 'Nota admin', 'Data revisione'];
  const righe = _ultimeRichiesteCaricate.map(r => [
    fmtData(r.created_at),
    _etichettaTipoRichiesta(r.type),
    _mappaUsernameRichieste[r.user_id] || r.user_id,
    r.status,
    r.type === 'username_change' ? ('nuovo username: ' + (r.payload?.nuovo_username || '')) : '',
    r.admin_note || '',
    r.reviewed_at ? fmtData(r.reviewed_at) : ''
  ]);
  _scaricaCSV('richieste_cardsync_' + new Date().toISOString().slice(0, 10) + '.csv', intestazioni, righe);
});

// Export 2/2: log delle azioni admin (da admin_audit_log) — il vero
// "backup di ciò che è stato fatto dagli admin" (Q7). Rispetta solo
// l'intervallo di date scelto (tipo/utente/stato non si applicano a
// questa tabella, che ha una struttura diversa da pending_requests).
document.getElementById('btn-esporta-log-admin').addEventListener('click', async () => {
  const dataDa = document.getElementById('filtroDataDaRichieste').value;
  const dataA = document.getElementById('filtroDataARichieste').value;
  let query = adminQueryLogAdminEsportazione();
  if (dataDa) query = query.gte('created_at', dataDa + 'T00:00:00');
  if (dataA) query = query.lte('created_at', dataA + 'T23:59:59');
  const { data, error } = await query;
  if (error) { mostraStatus('Errore: ' + error.message, false); return; }
  if (!data || data.length === 0) { mostraStatus('Nessuna azione admin da esportare nell\'intervallo scelto.', false); return; }

  const mappaU = Object.fromEntries(ultimaListaUtenti.map(u => [u.id, u.username]));
  const intestazioni = ['Data', 'Azione', 'Admin', 'Utente target', 'Dettagli'];
  const righe = data.map(r => [
    fmtData(r.created_at),
    r.action,
    mappaU[r.admin_id] || r.admin_id,
    r.target_user_id ? (mappaU[r.target_user_id] || r.target_user_id) : '',
    r.details ? JSON.stringify(r.details) : ''
  ]);
  _scaricaCSV('log_admin_cardsync_' + new Date().toISOString().slice(0, 10) + '.csv', intestazioni, righe);
});

// Archivia (deleted_at) tutte le richieste GIÀ GESTITE (approved/
// rejected) che corrispondono ai filtri correntemente applicati — mai
// le pending. Doppia conferma perché non reversibile da qui (resta nel
// DB con deleted_at valorizzato, recuperabile solo via SQL diretto).
document.getElementById('btn-archivia-gestite').addEventListener('click', async () => {
  const daArchiviare = _ultimeRichiesteCaricate.filter(r => r.status === 'approved' || r.status === 'rejected');
  if (daArchiviare.length === 0) { mostraStatus('Nessuna richiesta già gestita da archiviare con i filtri attuali.', false); return; }
  if (!confirm(`Stai per archiviare ${daArchiviare.length} richieste già gestite (corrispondenti ai filtri attuali). Non saranno più visibili nel pannello, ma restano nel database. Continuare?`)) return;
  if (!confirm('Conferma definitiva: procedere con l\'archiviazione?')) return;

  const ids = daArchiviare.map(r => r.id);
  const { error } = await adminArchiviaRichieste(ids);
  if (error) { mostraStatus('Errore: ' + error.message, false); return; }
  await adminRegistraAzione('richieste_archiviate', null, { count: ids.length });
  mostraStatus(`${ids.length} richieste archiviate.`, true);
  caricaRichieste();
  caricaLogAdmin();
});
