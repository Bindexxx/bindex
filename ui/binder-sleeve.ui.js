// ═══════════════════════════════════════════════════════════════════════
// BINDER-SLEEVE.UI.JS — editor sleeve (retro carta) per binder + galleria
// sfondi predefiniti condivisa — CardSync Pro
// ═══════════════════════════════════════════════════════════════════════
// STEP separato dal piano "riduzione accoppiamento" concordato con Claudio
// il 2026-09-11 (secondo giro di taglio). Estratto da
// ui/binder-design.ui.js. NESSUNA riscrittura del codice esistente: solo
// spostamento, zero cambi di comportamento per l'utente finale.
//
// Contiene: caricaSleeveBinderAttivoStato, gestisciUploadSleeveBinderAttivo,
// salvaPosizioniSleeveBinderAttivo, ripristinaPosizioniSleeveBinderAttivoDefault,
// toggleGalleriaDefaultSleeveBinderAttivo, selezionaDefaultSleeveBinderAttivo,
// _caricaGalleriaDefault (helper condiviso — usato anche dalla galleria
// copertina in ui/binder-design.ui.js, cross-file).
//
// Cross-file: caricaDesignBinderAttivo() in ui/binder-design.ui.js chiama
// caricaSleeveBinderAttivoStato() qui sotto. Nessuna istruzione qui gira a
// tempo di caricamento script — l'ordine tra i tre file (binder.ui.js,
// binder-design.ui.js, binder-sleeve.ui.js) è indifferente.
// ───────────────────────────────────────────────────────────────────────

// ── Sleeve (retro carta) — stesso editor drag/resize di sempre, i campi
// pokemon/condition/variazione/price sono UI pura (nessuna chiamata
// Supabase), portati invariati. Solo caricamento/salvataggio diventano
// per-binder. _cardBackFieldState resta condiviso (un solo editor alla
// volta può essere aperto, quello del binder corrente). ─────────────────
function _convertiImmagineCardBack(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            const canvas = document.createElement('canvas');
            canvas.width = CARD_BACK_W;
            canvas.height = CARD_BACK_H;
            const ctx = canvas.getContext('2d');
            const scala = Math.max(CARD_BACK_W / img.width, CARD_BACK_H / img.height);
            const wScalata = img.width * scala;
            const hScalata = img.height * scala;
            const dx = (CARD_BACK_W - wScalata) / 2;
            const dy = (CARD_BACK_H - hScalata) / 2;
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

function applyCardBackFieldState(fieldKey) {
    const el = document.getElementById('cardBackField-' + fieldKey);
    const s = _cardBackFieldState[fieldKey];
    if (!el || !s) return;
    el.style.left = s.left + '%';
    el.style.top = s.top + '%';
    el.querySelector('.cardback-field-content').style.transform = `scale(${s.scale})`;
}

function _cardBackCurrentStageScale() {
    const stage = document.getElementById('cardBackStage');
    return stage.getBoundingClientRect().width / CARD_BACK_W;
}

function _cardBackClampIntoStage(fieldKey) {
    const el = document.getElementById('cardBackField-' + fieldKey);
    const s = _cardBackFieldState[fieldKey];
    const content = el.querySelector('.cardback-field-content');
    const naturalW = content.scrollWidth;
    const naturalH = content.scrollHeight;
    const scaledW = naturalW * s.scale;
    const scaledH = naturalH * s.scale;
    let leftPx = (s.left / 100) * CARD_BACK_W;
    let topPx = (s.top / 100) * CARD_BACK_H;
    leftPx = Math.max(0, Math.min(leftPx, CARD_BACK_W - scaledW));
    topPx = Math.max(0, Math.min(topPx, CARD_BACK_H - scaledH));
    s.left = (leftPx / CARD_BACK_W) * 100;
    s.top = (topPx / CARD_BACK_H) * 100;
    applyCardBackFieldState(fieldKey);
}

function _cardBackRescale() {
    const stageWrap = document.getElementById('cardBackStageWrap');
    const stage = document.getElementById('cardBackStage');
    if (!stageWrap || !stage || stageWrap.clientWidth === 0) return;
    const scale = stageWrap.clientWidth / CARD_BACK_W;
    stage.style.transform = `scale(${scale})`;
    stageWrap.style.height = (CARD_BACK_H * scale) + 'px';
}
window.addEventListener('resize', _cardBackRescale);

function _initCardBackDragHandlers() {
    if (_cardBackDragInitDone) return;
    _cardBackDragInitDone = true;

    document.querySelectorAll('.cardback-field').forEach(field => {
        const fieldKey = field.dataset.field;
        let dragging = false;
        let startX = 0, startY = 0, startLeftPx = 0, startTopPx = 0;

        function onDragStart(e) {
            if (e.target.closest('.cardback-resize-handle')) return;
            dragging = true;
            field.classList.add('dragging');
            field.setPointerCapture(e.pointerId);
            startX = e.clientX;
            startY = e.clientY;
            startLeftPx = (_cardBackFieldState[fieldKey].left / 100) * CARD_BACK_W;
            startTopPx = (_cardBackFieldState[fieldKey].top / 100) * CARD_BACK_H;
            e.preventDefault();
        }
        function onDragMove(e) {
            if (!dragging) return;
            const scale = _cardBackCurrentStageScale();
            const dx = (e.clientX - startX) / scale;
            const dy = (e.clientY - startY) / scale;
            _cardBackFieldState[fieldKey].left = ((startLeftPx + dx) / CARD_BACK_W) * 100;
            _cardBackFieldState[fieldKey].top = ((startTopPx + dy) / CARD_BACK_H) * 100;
            _cardBackClampIntoStage(fieldKey);
        }
        function onDragEnd() {
            if (!dragging) return;
            dragging = false;
            field.classList.remove('dragging');
        }
        field.addEventListener('pointerdown', onDragStart);
        field.addEventListener('pointermove', onDragMove);
        field.addEventListener('pointerup', onDragEnd);
        field.addEventListener('pointercancel', onDragEnd);

        const resizeHandle = field.querySelector('.cardback-resize-handle');
        let resizing = false;
        let startScale = 1;

        function onResizeStart(e) {
            e.stopPropagation();
            resizing = true;
            field.classList.add('resizing');
            resizeHandle.setPointerCapture(e.pointerId);
            startScale = _cardBackFieldState[fieldKey].scale;
            startX = e.clientX;
            startY = e.clientY;
            e.preventDefault();
        }
        function onResizeMove(e) {
            if (!resizing) return;
            const scale = _cardBackCurrentStageScale();
            const dx = (e.clientX - startX) / scale;
            const delta = dx / 150;
            let newScale = startScale + delta;
            newScale = Math.max(0.4, Math.min(2.5, newScale));
            _cardBackFieldState[fieldKey].scale = newScale;
            _cardBackClampIntoStage(fieldKey);
        }
        function onResizeEnd() {
            if (!resizing) return;
            resizing = false;
            field.classList.remove('resizing');
        }
        resizeHandle.addEventListener('pointerdown', onResizeStart);
        resizeHandle.addEventListener('pointermove', onResizeMove);
        resizeHandle.addEventListener('pointerup', onResizeEnd);
        resizeHandle.addEventListener('pointercancel', onResizeEnd);
    });
}

async function caricaSleeveBinderAttivoStato() {
    const statoEl = document.getElementById('cardBackStato');
    const previewEl = document.getElementById('cardBackPreview');
    const editorWrap = document.getElementById('cardBackEditorWrap');
    if (!statoEl || !previewEl || !editorWrap) return; // pannello Design non ancora nel DOM
    document.getElementById('cardBackError').style.display = 'none';

    const userId = await authGetUserId();
    if (!userId || !_binderAttivo) { statoEl.textContent = 'Apri un binder per gestirne la sleeve.'; return; }

    const { data: media, error } = await userMediaGet(userId, _binderAttivo, 'card_back');
    if (error) { statoEl.textContent = 'Errore nel controllare lo stato: ' + error.message; return; }

    if (!media) {
        statoEl.textContent = 'Nessuna sleeve caricata ancora per questo binder — verrà mostrato il retro di sistema.';
        previewEl.innerHTML = '<i class="fa-solid fa-image" style="color:var(--text-muted);"></i>';
        editorWrap.style.display = 'none';
        _cardBackFieldState = null;
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
    if (previewUrl) {
        previewEl.innerHTML = `<img src="${previewUrl}" style="width:100%; height:100%; object-fit:cover;">`;
        document.getElementById('cardBackBgImg').src = previewUrl;
    }

    if (media.source === 'default') {
        statoEl.innerHTML = '<span style="color:var(--success); font-weight:600;">✅ Sfondo predefinito selezionato</span>';
    } else if (media.status === 'pending') {
        statoEl.innerHTML = '<span style="color:#b8860b; font-weight:600;">⏳ In revisione da un admin — la vedi solo tu, gli altri vedono il retro di sistema nel frattempo</span>';
    } else if (media.status === 'approved') {
        statoEl.innerHTML = '<span style="color:var(--success); font-weight:600;">✅ Approvata</span>';
    } else if (media.status === 'rejected') {
        statoEl.innerHTML = '<span style="color:var(--danger); font-weight:600;">❌ Rifiutata' + (media.admin_note ? ' — ' + escapeHtml(media.admin_note) : '') + '</span>';
    }

    _cardBackFieldState = media.metadata ? JSON.parse(JSON.stringify(media.metadata)) : JSON.parse(JSON.stringify(DEFAULT_STATE_CARD_BACK));
    Object.keys(DEFAULT_STATE_CARD_BACK).forEach(applyCardBackFieldState);
    editorWrap.style.display = 'block';
    _initCardBackDragHandlers();
    _cardBackRescale();
    document.getElementById('cardBackPosStato').textContent = '';
}

async function gestisciUploadSleeveBinderAttivo(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const errEl = document.getElementById('cardBackError');
    errEl.style.display = 'none';

    const userId = await authGetUserId();
    if (!userId || !_binderAttivo) { errEl.textContent = 'Apri un binder prima di caricare una sleeve.'; errEl.style.display = 'block'; return; }

    let pngBlob;
    try {
        pngBlob = await _convertiImmagineCardBack(file);
    } catch (e) {
        errEl.textContent = e.message === 'FORMATO_NON_LEGGIBILE'
            ? '❌ Il tuo dispositivo ha salvato questa foto in un formato che il sito non riesce a leggere (capita spesso con le foto scattate su iPhone, formato HEIC). Su iPhone: Impostazioni → Foto → Formato foto → scegli "Più compatibile", oppure scegli "Più piccola" quando condividi/esporti la foto. Poi riprova.'
            : '❌ Errore nella conversione dell\'immagine: ' + e.message;
        errEl.style.display = 'block';
        event.target.value = '';
        return;
    }

    const path = `${userId}/${_binderAttivo}/card_back`;
    const { error: errUpload } = await storageUploadUserMedia(path, pngBlob);
    if (errUpload) { errEl.textContent = '❌ Errore nel caricamento: ' + errUpload.message; errEl.style.display = 'block'; event.target.value = ''; return; }

    // Ogni nuova sleeve riparte con le posizioni di default (stessa
    // assunzione dichiarata nel vecchio file: un'immagine nuova ha
    // probabilmente una composizione diversa dalla precedente).
    const { data: mediaRow, error: errUpsert } = await userMediaUpsertELeggi({
        user_id: userId,
        binder_id: _binderAttivo,
        slot: 'card_back',
        storage_path: path,
        source: 'upload',
        status: 'pending',
        admin_note: null,
        reviewed_at: null,
        reviewed_by: null,
        metadata: DEFAULT_STATE_CARD_BACK,
    });
    if (errUpsert) { errEl.textContent = '❌ Foto caricata ma non registrata: ' + errUpsert.message; errEl.style.display = 'block'; event.target.value = ''; return; }

    const { error: errRichiesta } = await creaRichiestaPendente(userId, 'photo_upload', { media_id: mediaRow.id });
    if (errRichiesta) console.error('Media registrato ma richiesta non collegata:', errRichiesta.message);

    event.target.value = '';
    await caricaSleeveBinderAttivoStato();
}

// Salva SOLO il metadata (posizioni) sulla riga già esistente — non
// richiede nuova approvazione admin (quella riguarda l'immagine).
async function salvaPosizioniSleeveBinderAttivo() {
    const statoEl = document.getElementById('cardBackPosStato');
    if (!_cardBackFieldState || !_binderAttivo) return;

    const userId = await authGetUserId();
    if (!userId) { statoEl.textContent = 'Sessione non valida.'; return; }

    statoEl.textContent = 'Salvataggio…';
    const { error } = await userMediaUpdateMetadata(userId, _binderAttivo, 'card_back', _cardBackFieldState);
    statoEl.textContent = error ? ('❌ Errore: ' + error.message) : '✅ Posizioni salvate.';
}

function ripristinaPosizioniSleeveBinderAttivoDefault() {
    if (!_cardBackFieldState) return;
    _cardBackFieldState = JSON.parse(JSON.stringify(DEFAULT_STATE_CARD_BACK));
    Object.keys(DEFAULT_STATE_CARD_BACK).forEach(applyCardBackFieldState);
    document.getElementById('cardBackPosStato').textContent = 'Posizioni ripristinate ai valori di default. Ricordati di premere "Salva posizioni".';
}

function toggleGalleriaDefaultSleeveBinderAttivo() {
    const wrap = document.getElementById('cardBackGalleriaWrap');
    const show = wrap.style.display === 'none';
    wrap.style.display = show ? 'block' : 'none';
    if (show) _caricaGalleriaDefault('card_back', 'cardBackGalleriaGrid', selezionaDefaultSleeveBinderAttivo);
}

async function selezionaDefaultSleeveBinderAttivo(filename) {
    const errEl = document.getElementById('cardBackError');
    errEl.style.display = 'none';

    const userId = await authGetUserId();
    if (!userId || !_binderAttivo) { errEl.textContent = 'Apri un binder prima.'; errEl.style.display = 'block'; return; }

    const { error } = await userMediaUpsert({
        user_id: userId,
        binder_id: _binderAttivo,
        slot: 'card_back',
        storage_path: `card_back/${filename}`,
        source: 'default',
        status: 'approved',
        admin_note: null,
        reviewed_at: null,
        reviewed_by: null,
        metadata: DEFAULT_STATE_CARD_BACK,
    });
    if (error) { errEl.textContent = '❌ Errore: ' + error.message; errEl.style.display = 'block'; return; }

    document.getElementById('cardBackGalleriaWrap').style.display = 'none';
    await caricaSleeveBinderAttivoStato();
}

// ── Galleria sfondi predefiniti (condivisa copertina/sleeve) ────────────
// Bucket pubblico 'default-assets', due cartelle: card_back/ e
// binder_cover/ — asset già curati, niente moderazione (status:'approved'
// diretto). Invariata dal vecchio file.
async function _caricaGalleriaDefault(prefix, gridElId, onSelect) {
    const gridEl = document.getElementById(gridElId);
    gridEl.innerHTML = '<span style="font-size:0.75rem; color:var(--text-muted);">Caricamento…</span>';

    const { data, error } = await storageListDefaultAssets(prefix);
    if (error) { gridEl.innerHTML = '<span style="font-size:0.75rem; color:var(--danger);">Errore: ' + error.message + '</span>'; return; }

    const files = (data || []).filter(f => f.name && !f.name.startsWith('.'));
    if (!files.length) { gridEl.innerHTML = '<span style="font-size:0.75rem; color:var(--text-muted);">Nessun default disponibile ancora.</span>'; return; }

    gridEl.innerHTML = '';
    files.forEach(f => {
        const { data: pub } = storageDefaultAssetPublicUrl(`${prefix}/${f.name}`);
        const img = document.createElement('img');
        img.src = pub.publicUrl;
        img.title = f.name;
        img.style.cssText = 'width:60px; height:84px; object-fit:cover; border-radius:6px; cursor:pointer; border:2px solid transparent;';
        img.onmouseenter = () => { img.style.borderColor = 'var(--primary)'; };
        img.onmouseleave = () => { img.style.borderColor = 'transparent'; };
        img.onclick = () => onSelect(f.name);
        gridEl.appendChild(img);
    });
}


