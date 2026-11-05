// Admin, Richieste: filtri, esportazione, archivio.

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

async function _sincronizzaCopiaPubblica(mediaId, slot, ownerUserId) {
    const { data: media, error: errMedia } = await adminMediaStoragePath(mediaId);
    if (errMedia || !media) throw new Error(errMedia?.message || 'media non trovato');

    const { data: signed, error: errSigned } = await adminSignedUrlUserMedia(media.storage_path, 60);
    if (errSigned || !signed?.signedUrl) throw new Error(errSigned?.message || 'impossibile firmare url privato');

    const risposta = await fetch(signed.signedUrl);
    if (!risposta.ok) throw new Error('download fallito (' + risposta.status + ')');
    const blob = await risposta.blob();

    const cartella = slot === 'card_back' ? 'carta' : 'binder';
    if (!media.binder_id) throw new Error(`user_media ${mediaId}: binder_id mancante, impossibile sincronizzare`);
    const destPath = `${cartella}/${ownerUserId}/${media.binder_id}.png`;
    const { error: errUpload } = await adminUploadImmaginiVisibili(destPath, blob);
    if (errUpload) throw errUpload;
}

document.getElementById('btn-sincronizza-pubbliche').addEventListener('click', async () => {
  if (!await adminDialog({ titolo: 'Sincronizzare le copie pubbliche?', testo: 'Ricrea le copie pubbliche di TUTTE le foto già approvate (retro carta + copertine). Può richiedere qualche secondo per ogni foto.', conferma: 'Sincronizza' })) return;

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

document.getElementById('btn-archivia-gestite').addEventListener('click', async () => {
  const daArchiviare = _ultimeRichiesteCaricate.filter(r => r.status === 'approved' || r.status === 'rejected');
  if (daArchiviare.length === 0) { mostraStatus('Nessuna richiesta già gestita da archiviare con i filtri attuali.', false); return; }
  if (!await adminDialog({ titolo: 'Archiviare le richieste gestite?', testo: `${daArchiviare.length} richieste già gestite (secondo i filtri attuali) non saranno più visibili nel pannello, ma restano nel database. Non è reversibile da qui.`, conferma: 'Archivia', pericolo: true })) return;

  const ids = daArchiviare.map(r => r.id);
  const { error } = await adminArchiviaRichieste(ids);
  if (error) { mostraStatus('Errore: ' + error.message, false); return; }
  await adminRegistraAzione('richieste_archiviate', null, { count: ids.length });
  mostraStatus(`${ids.length} richieste archiviate.`, true);
  caricaRichieste();
  caricaLogAdmin();
});
