// ═══════════════════════════════════════════════════════════════════════
// BINDER-DESIGN.UI.JS — rinomina e copertina (+ editor card-back) per
// binder — CardSync Pro
// ═══════════════════════════════════════════════════════════════════════
// STEP separato dal piano "riduzione accoppiamento" concordato con Claudio
// il 2026-09-11 (secondo giro di taglio, dopo l'estrazione da
// ui/binder.ui.js). NESSUNA riscrittura del codice esistente: solo
// spostamento, zero cambi di comportamento per l'utente finale.
//
// Contiene: rinominaBinderExtraCorrente, caricaDesignBinderAttivo (carica
// nome+copertina+sleeve insieme — chiama caricaSleeveBinderAttivoStato
// cross-file, vedi ui/binder-sleeve.ui.js), caricaNomeBinderAttivoStato/
// proponiNomeBinderAttivo, tutto l'editor copertina
// (_convertiImmagineCopertina, caricaCopertinaBinderAttivoStato,
// gestisciUploadCopertinaBinderAttivo, _salvaCopertinaBinderAttivo,
// galleria default copertina) + editor posizionamento card-back
// (_convertiImmagineCardBack, applyCardBackFieldState,
// _cardBack*Scale/ClampIntoStage/Rescale, _initCardBackDragHandlers).
//
// L'editor sleeve e _caricaGalleriaDefault (helper condiviso dalle due
// gallerie sfondi, usato anche qui per la galleria copertina) sono stati
// spostati in ui/binder-sleeve.ui.js.
//
// ⚠ IL MOTORE FLIPBOOK (_libro*, in fondo a ui/binder.ui.js) resta
// invariato lì — non toccato da nessuno dei due giri di taglio.
//
// Cross-file: apriBinderDettaglio() in ui/binder.ui.js chiama
// caricaDesignBinderAttivo() qui sotto; _salvaCopertinaBinderAttivo() e
// selezionaDefaultCopertinaBinderAttivo() qui sotto chiamano
// renderGrigliaBinders() in ui/binder.ui.js. Nessuna istruzione qui gira a
// tempo di caricamento script — l'ordine tra i tre file (binder.ui.js,
// binder-design.ui.js, binder-sleeve.ui.js) è indifferente, purché tutti
// carichino prima che l'utente apra un dettaglio binder.
// ───────────────────────────────────────────────────────────────────────

// ── Rinomina binder extra ────────────────────────────────────────────────
async function rinominaBinderExtraCorrente(nuovoNome) {
    const binder = _bindersElenco.find(b => String(b.id) === String(_binderAttivo));
    if (!binder || binder.tipo !== 'extra' || !nuovoNome || !nuovoNome.trim()) return;
    const userId = await authGetUserId();
    const { error } = await binderExtraRinomina(userId, binder.id, nuovoNome.trim());
    if (error) { console.error('rinominaBinderExtraCorrente:', error.message); return; }
    binder.nome = nuovoNome.trim();
    const titoloEl = document.getElementById('binderDettaglioTitolo');
    if (titoloEl) titoloEl.textContent = binder.nome;
}




// ── "Design" — copertina e sleeve personalizzate, PER BINDER ────────────
// Porta completa del vecchio meccanismo (era unico per utente, ora è per
// binder — path, slot e metadata sempre agganciati a _binderAttivo).
// Stesso identico comportamento di conversione/upload/moderazione/galleria
// default, stesso editor drag/resize per i 4 campi della sleeve.

async function caricaDesignBinderAttivo() {
    await caricaNomeBinderAttivoStato();
    await caricaCopertinaBinderAttivoStato();
    await caricaSleeveBinderAttivoStato();
}

// ── Nome (con approvazione admin) ────────────────────────────────────
// Stessa metodologia di copertina/sleeve — vedi 21_binder_nome_con_
// approvazione.sql. Il nome VISIBILE (binder.nome, già mostrato nel titolo
// e nella griglia contenitori) non cambia finché admin_process_pending_
// request non approva nome_proposto.
async function caricaNomeBinderAttivoStato() {
    const statoEl = document.getElementById('binderNomeStato');
    const inputEl = document.getElementById('binderNomeInput');
    if (!statoEl || !inputEl) return; // pannello Design non ancora nel DOM
    document.getElementById('binderNomeError').style.display = 'none';

    const binder = _bindersElenco.find(b => String(b.id) === String(_binderAttivo));
    if (!binder) { statoEl.textContent = 'Apri un binder per proporne il nome.'; return; }

    inputEl.value = binder.nome_proposto && binder.nome_stato === 'pending' ? binder.nome_proposto : (binder.nome || '');

    if (!binder.nome_stato || binder.nome_stato === 'approved') {
        statoEl.innerHTML = '<span style="color:var(--success); font-weight:600;">✅ Nome attuale approvato</span>';
    } else if (binder.nome_stato === 'pending') {
        statoEl.innerHTML = `<span style="color:#b8860b; font-weight:600;">⏳ "${escapeHtml(binder.nome_proposto || '')}" in revisione da un admin — nel frattempo resta visibile "${escapeHtml(binder.nome || '')}"</span>`;
    } else if (binder.nome_stato === 'rejected') {
        statoEl.innerHTML = '<span style="color:var(--danger); font-weight:600;">❌ Proposta rifiutata' + (binder.nome_admin_note ? ' — ' + escapeHtml(binder.nome_admin_note) : '') + '</span>';
    }
}

async function proponiNomeBinderAttivo() {
    const inputEl = document.getElementById('binderNomeInput');
    const errEl = document.getElementById('binderNomeError');
    errEl.style.display = 'none';
    const nuovoNome = (inputEl.value || '').trim();

    const binder = _bindersElenco.find(b => String(b.id) === String(_binderAttivo));
    if (!binder) return;

    if (!nuovoNome) { errEl.textContent = 'Il nome non può essere vuoto.'; errEl.style.display = 'block'; return; }
    if (nuovoNome === binder.nome) { errEl.textContent = 'È già il nome attuale.'; errEl.style.display = 'block'; return; }

    const userId = await authGetUserId();
    if (!userId) return;

    const { error: errProponi } = await binderProponiNome(userId, binder.id, nuovoNome);
    if (errProponi) { errEl.textContent = '❌ ' + errProponi.message; errEl.style.display = 'block'; return; }

    binder.nome_proposto = nuovoNome;
    binder.nome_stato = 'pending';

    const { error: errRichiesta } = await creaRichiestaPendente(userId, 'binder_nome', { binder_id: binder.id, nome_proposto: nuovoNome });
    if (errRichiesta) console.error('Nome proposto ma richiesta non collegata:', errRichiesta.message);

    await caricaNomeBinderAttivoStato();
}

// ── Copertina ─────────────────────────────────────────────────────────
function _convertiImmagineCopertina(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            const canvas = document.createElement('canvas');
            canvas.width = BINDER_COVER_W;
            canvas.height = BINDER_COVER_H;
            const ctx = canvas.getContext('2d');
            const scala = Math.max(BINDER_COVER_W / img.width, BINDER_COVER_H / img.height);
            const wScalata = img.width * scala;
            const hScalata = img.height * scala;
            const dx = (BINDER_COVER_W - wScalata) / 2;
            const dy = (BINDER_COVER_H - hScalata) / 2;
            ctx.drawImage(img, dx, dy, wScalata, hScalata);
            canvas.toBlob((blob) => {
                if (!blob) { reject(new Error('Conversione non riuscita.')); return; }
                resolve(blob);
            }, 'image/png');
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('FORMATO_NON_LEGGIBILE')); };
        img.src = url;
    });
}

async function caricaCopertinaBinderAttivoStato() {
    const statoEl = document.getElementById('binderCoverStato');
    const previewEl = document.getElementById('binderCoverPreview');
    const errEl = document.getElementById('binderCoverError');
    if (!statoEl || !previewEl) return; // pannello Design non ancora nel DOM
    errEl.style.display = 'none';

    const userId = await authGetUserId();
    if (!userId || !_binderAttivo) { statoEl.textContent = 'Apri un binder per gestirne la copertina.'; return; }

    const { data: media, error } = await userMediaGet(userId, _binderAttivo, 'binder_cover');
    if (error) { statoEl.textContent = 'Errore nel controllare lo stato: ' + error.message; return; }

    if (!media) {
        statoEl.textContent = 'Nessuna copertina caricata ancora per questo binder.';
        previewEl.innerHTML = '<i class="fa-solid fa-image" style="color:var(--text-muted);"></i>';
        return;
    }

    let previewUrl = null;
    if (media.source === 'default') {
        const { data: pub } = storageDefaultAssetPublicUrl(media.storage_path);
        previewUrl = pub?.publicUrl || null;
    } else {
        const { data: signed } = await storageSignedUrlUserMedia(media.storage_path);
        previewUrl = signed?.signedUrl || null;
    }
    if (previewUrl) previewEl.innerHTML = `<img src="${previewUrl}" style="width:100%; height:100%; object-fit:cover;">`;

    if (media.source === 'default') {
        statoEl.innerHTML = '<span style="color:var(--success); font-weight:600;">✅ Sfondo predefinito selezionato</span>';
    } else if (media.status === 'pending') {
        statoEl.innerHTML = '<span style="color:#b8860b; font-weight:600;">⏳ In revisione da un admin — nel frattempo la copertina resta quella di prima (o quella generica)</span>';
    } else if (media.status === 'approved') {
        statoEl.innerHTML = '<span style="color:var(--success); font-weight:600;">✅ Approvata</span>';
    } else if (media.status === 'rejected') {
        statoEl.innerHTML = '<span style="color:var(--danger); font-weight:600;">❌ Rifiutata' + (media.admin_note ? ' — ' + escapeHtml(media.admin_note) : '') + '</span>';
    }
}

async function gestisciUploadCopertinaBinderAttivo(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const errEl = document.getElementById('binderCoverError');
    errEl.style.display = 'none';

    const userId = await authGetUserId();
    if (!userId || !_binderAttivo) { errEl.textContent = 'Apri un binder prima di caricare una copertina.'; errEl.style.display = 'block'; return; }

    let pngBlob;
    try {
        pngBlob = await _convertiImmagineCopertina(file);
    } catch (e) {
        errEl.textContent = e.message === 'FORMATO_NON_LEGGIBILE'
            ? '❌ Il tuo dispositivo ha salvato questa foto in un formato che il sito non riesce a leggere (capita spesso con le foto scattate su iPhone, formato HEIC). Su iPhone: Impostazioni → Foto → Formato foto → scegli "Più compatibile", oppure scegli "Più piccola" quando condividi/esporti la foto. Poi riprova.'
            : '❌ Errore nella conversione dell\'immagine: ' + e.message;
        errEl.style.display = 'block';
        event.target.value = '';
        return;
    }

    const { error } = await _salvaCopertinaBinderAttivo(pngBlob);
    if (error) { errEl.textContent = '❌ ' + error.message; errEl.style.display = 'block'; event.target.value = ''; return; }

    event.target.value = '';
    await caricaCopertinaBinderAttivoStato();
    await renderGrigliaBinders(); // aggiorna anche la miniatura nella griglia contenitori
}

// Upload + registrazione (path per-binder) + richiesta di moderazione.
async function _salvaCopertinaBinderAttivo(pngBlob) {
    const userId = await authGetUserId();
    if (!userId || !_binderAttivo) return { error: new Error('Nessun binder aperto') };

    const path = `${userId}/${_binderAttivo}/binder_cover`;
    const { error: errUpload } = await storageUploadUserMedia(path, pngBlob);
    if (errUpload) return { error: errUpload };

    const { data: mediaRow, error: errUpsert } = await userMediaUpsertELeggi({
        user_id: userId,
        binder_id: _binderAttivo,
        slot: 'binder_cover',
        storage_path: path,
        source: 'upload',
        status: 'pending',
        admin_note: null,
        reviewed_at: null,
        reviewed_by: null,
    });
    if (errUpsert) return { error: errUpsert };

    const { error: errRichiesta } = await creaRichiestaPendente(userId, 'photo_upload', { media_id: mediaRow.id });
    if (errRichiesta) console.error('Copertina registrata ma richiesta non collegata:', errRichiesta.message);

    _coperturaBinderCache.delete(_binderAttivo);
    return { error: null };
}

function toggleGalleriaDefaultCopertinaBinderAttivo() {
    const wrap = document.getElementById('binderCoverGalleriaWrap');
    const show = wrap.style.display === 'none';
    wrap.style.display = show ? 'block' : 'none';
    if (show) _caricaGalleriaDefault('binder_cover', 'binderCoverGalleriaGrid', selezionaDefaultCopertinaBinderAttivo);
}

async function selezionaDefaultCopertinaBinderAttivo(filename) {
    const errEl = document.getElementById('binderCoverError');
    errEl.style.display = 'none';

    const userId = await authGetUserId();
    if (!userId || !_binderAttivo) { errEl.textContent = 'Apri un binder prima.'; errEl.style.display = 'block'; return; }

    const { error } = await userMediaUpsert({
        user_id: userId,
        binder_id: _binderAttivo,
        slot: 'binder_cover',
        storage_path: `binder_cover/${filename}`,
        source: 'default',
        status: 'approved',
        admin_note: null,
        reviewed_at: null,
        reviewed_by: null,
    });
    if (error) { errEl.textContent = '❌ Errore: ' + error.message; errEl.style.display = 'block'; return; }

    document.getElementById('binderCoverGalleriaWrap').style.display = 'none';
    _coperturaBinderCache.delete(_binderAttivo);
    await caricaCopertinaBinderAttivoStato();
    await renderGrigliaBinders();
}


