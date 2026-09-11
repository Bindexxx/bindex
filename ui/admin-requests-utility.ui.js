// ═══════════════════════════════════════════════════════════════════════
// ADMIN-REQUESTS-UTILITY.UI.JS — filtri/export/nascondi/archivia richieste
// + sincronizzazione copie pubbliche (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP separato dal piano "riduzione accoppiamento" concordato con Claudio
// il 2026-09-11. Estratto da ui/admin-requests.ui.js. NESSUNA riscrittura
// del codice esistente: solo spostamento, zero cambi di comportamento per
// l'utente finale.
//
// ⚠ La prima parte di questo file (filtri/preset data/reset/nascondi
// gestite) NON è fatta di dichiarazioni di funzione: sono .forEach()/
// addEventListener() eseguiti SUBITO al caricamento dello script, che
// AGGANCIANO listener sugli elementi del DOM (già presenti in admin.html,
// caricato prima di questo script). Le callback dentro i listener sono
// comunque differite (girano solo al click/change dell'utente, mai a
// tempo di parsing) — quindi anche se chiamano caricaRichieste() (in
// ui/admin-requests.ui.js) cross-file, l'ordine tra i due file resta
// indifferente: caricaRichieste() deve solo esistere entro il primo click
// dell'utente, non entro il caricamento dello script.
//
// Contiene: listener filtri/preset data/reset/nascondi gestite,
// _sincronizzaCopiaPubblica.
// ───────────────────────────────────────────────────────────────────────

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
// a un path fisso per utente+binder+slot (fix 26/08/2026), sovrascrivendo
// l'eventuale copia precedente — un solo file pubblico per binder per
// slot, coerente con user_media (nessuna cronologia).
async function _sincronizzaCopiaPubblica(mediaId, slot, ownerUserId) {
    const { data: media, error: errMedia } = await adminMediaStoragePath(mediaId);
    if (errMedia || !media) throw new Error(errMedia?.message || 'media non trovato');

    const { data: signed, error: errSigned } = await adminSignedUrlUserMedia(media.storage_path, 60);
    if (errSigned || !signed?.signedUrl) throw new Error(errSigned?.message || 'impossibile firmare url privato');

    const risposta = await fetch(signed.signedUrl);
    if (!risposta.ok) throw new Error('download fallito (' + risposta.status + ')');
    const blob = await risposta.blob();

    const cartella = slot === 'card_back' ? 'carta' : 'binder';
    // Fix 26/08/2026: rimosso il fallback al vecchio path per-utente.
    // Ogni binder ha sempre la propria copertina/sleeve — media.binder_id
    // deve essere sempre valorizzato per qualunque riga scritta dal codice
    // attuale (vedi binder.ui.js). Se manca, è un dato incoerente: meglio
    // fallire rumorosamente qui che scrivere silenziosamente un path
    // ambiguo/per-utente che nessun lettore (card-back-viewer.ui.js) cerca
    // più.
    if (!media.binder_id) throw new Error(`user_media ${mediaId}: binder_id mancante, impossibile sincronizzare`);
    const destPath = `${cartella}/${ownerUserId}/${media.binder_id}.png`;
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
