// ── ui/binder.ui.js ────────────────────────────────────────────────────
// Binder: rendering griglia, layout, paginazione, copertina personalizzata,
// retro carta personalizzato (editor drag/resize), galleria sfondi
// predefiniti, aggiunta/rimozione carte dal Binder.


        // ── BINDER — Stage 1 (Traccia A): solo grafica e navigazione ───────────
        // TEMPORANEO: mostra tutta la collezione (carte + sealed, stato
        // 'collezione'), non ancora filtrata sul campo dedicato "nel Binder"
        // — quel campo non esiste ancora su Supabase (Fase A0, non ancora
        // fatta). Nessun editing/drag-and-drop/persistenza qui: solo lettura,
        // con dati e immagini reali (stesso proxy della tabella, con
        // miniatura più grande). Layout preferito salvato per-dispositivo,
        // stesso pattern già usato altrove nel sito (es. sidebar compressa).

        function renderBinder() {
            const layout = BINDER_LAYOUTS[_binderLayout] || BINDER_LAYOUTS['3x3'];
            const perPagina = layout.cols * layout.rows;

            // Fase A0/A3: filtro vero "nel Binder" al posto di tutta la
            // collezione. _idsNelBinder viene da binder_carte (caricaCarteReali);
            // finché non esiste la Fase A6 (Aggiungi al Binder) resta vuoto
            // e questa vista appare vuota di conseguenza — comportamento
            // atteso, non un bug.
            const carte = carteReali
                .filter(c => c.stato === 'collezione' && _idsNelBinder.has(String(c.id)))
                .slice()
                .sort((a, b) => {
                    const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                    return da - db;
                });

            const totalePagine = Math.max(1, Math.ceil(carte.length / perPagina));
            if (_binderPagina > totalePagine - 1) _binderPagina = totalePagine - 1;
            if (_binderPagina < 0) _binderPagina = 0;

            const inizio = _binderPagina * perPagina;
            const carteQuestaPagina = carte.slice(inizio, inizio + perPagina);

            document.querySelectorAll('.binder-layout-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.layout === _binderLayout);
            });

            const griglia = document.getElementById('binderGrid');
            griglia.className = `binder-grid binder-grid-${_binderLayout}`;

            let html = '';
            for (let i = 0; i < perPagina; i++) {
                const card = carteQuestaPagina[i];
                if (card) {
                    const idAttr = String(card.id).replace(/'/g, "\\'");
                    const nomeAttr = (card.name || '').replace(/"/g, '&quot;');
                    const immagineSrc = _urlImmagineVisualizzabile(card.immagine, 300);
                    html += `
                        <div class="binder-slot binder-slot-filled" onclick="apriImmagineIngrandita('${idAttr}')" title="${nomeAttr}">
                            <button type="button" class="binder-slot-remove-btn" title="Rimuovi dal Binder" aria-label="Rimuovi dal Binder" onclick="event.stopPropagation(); rimuoviDalBinderSlot('${idAttr}')"><i class="fa-solid fa-xmark"></i></button>
                            <div class="binder-slot-fallback"><i class="fa-solid fa-image"></i><span>${nomeAttr}</span></div>
                            ${immagineSrc ? `<img src="${immagineSrc}" alt="${nomeAttr}" loading="lazy" onerror="this.remove();">` : ''}
                            ${card.qty > 1 ? `<span class="binder-slot-qty-badge" title="Hai ${card.qty} copie di questa carta — occupano un solo slot">×${card.qty}</span>` : ''}
                        </div>`;
                } else {
                    html += `<div class="binder-slot binder-slot-empty"><i class="fa-solid fa-layer-group"></i></div>`;
                }
            }
            griglia.innerHTML = html;

            document.getElementById('binderPaginaLabel').textContent = carte.length
                ? `Pagina ${_binderPagina + 1} di ${totalePagine}`
                : 'Nessuna carta in collezione';
            document.getElementById('binderPrevBtn').disabled = _binderPagina <= 0;
            document.getElementById('binderNextBtn').disabled = _binderPagina >= totalePagine - 1;
            document.getElementById('binderEmptyMsg').style.display = carte.length ? 'none' : 'block';
            // A5: il pager si nasconde del tutto se esiste una sola pagina
            // (o nessuna carta) — prima restava sempre visibile con le
            // frecce disattivate.
            document.getElementById('binderPagination').style.display = totalePagine > 1 ? 'flex' : 'none';
        }


        // ── COPERTINA BINDER (Fase 2c) ──────────────────────────────
        // Slot 'binder_cover' su user_media (bucket privato 'user-media',
        // path {user_id}/binder_cover). Upload → converte SEMPRE in PNG
        // 1024x1419 (ritaglio centrato, no deformazione) via Canvas
        // prima di caricare — qualsiasi formato/dimensione in ingresso
        // che il browser sa decodificare. Ogni sostituzione riparte da
        // status 'pending' e resta visibile solo ad admin+proprietario
        // finché non viene approvata. Grazie alla policy aggiornata
        // (06_user_media_update_sempre.sql, eseguita sul DB il
        // 19/08/2026) l'utente può sostituire la copertina in QUALSIASI
        // stato precedente (pending/approved/rejected), non solo pending.

        // Converte un file immagine qualsiasi in PNG 1024x1419 con
        // ritaglio centrato (stile "cover", riempie tutto lo spazio
        // senza deformare). Rigetta con errore esplicito i file che il
        // browser non riesce a decodificare (es. HEIC su Safari/iOS).
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
                img.onerror = () => {
                    URL.revokeObjectURL(url);
                    reject(new Error('FORMATO_NON_LEGGIBILE'));
                };
                img.src = url;
            });
        }


        async function caricaBinderCoverStato() {
            const statoEl = document.getElementById('binderCoverStato');
            const previewEl = document.getElementById('binderCoverPreview');
            document.getElementById('binderCoverError').style.display = 'none';

            const userId = await authGetUserId();
            if (!userId) { statoEl.textContent = 'Accedi per gestire la copertina.'; return; }

            const { data: media, error } = await userMediaGet(userId, 'binder_cover');

            if (error) { statoEl.textContent = 'Errore nel controllare lo stato: ' + error.message; return; }

            if (!media) {
                statoEl.textContent = 'Nessuna copertina caricata ancora.';
                previewEl.innerHTML = '<i class="fa-solid fa-image" style="color:var(--text-muted);"></i>';
                return;
            }

            // Fase 2bis (20/08/2026): se l'utente ha scelto un default dalla
            // galleria (source='default'), storage_path punta al bucket
            // pubblico 'default-assets', non a 'user-media' — URL pubblico
            // diretto, niente signed URL (che richiederebbe comunque un
            // bucket privato).
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
            }

            if (media.source === 'default') {
                statoEl.innerHTML = '<span style="color:var(--success); font-weight:600;">✅ Sfondo predefinito selezionato</span>';
            } else if (media.status === 'pending') {
                statoEl.innerHTML = '<span style="color:#b8860b; font-weight:600;">⏳ In revisione da un admin</span>';
            } else if (media.status === 'approved') {
                statoEl.innerHTML = '<span style="color:var(--success); font-weight:600;">✅ Approvata</span>';
            } else if (media.status === 'rejected') {
                statoEl.innerHTML = '<span style="color:var(--danger); font-weight:600;">❌ Rifiutata' + (media.admin_note ? ' — ' + escapeHtml(media.admin_note) : '') + '</span>';
            }
            // Il bottone "Carica foto" resta sempre visibile e attivo:
            // la nuova policy permette di sostituire in qualsiasi stato.
        }


        async function gestisciUploadBinderCover(event) {
            const file = event.target.files?.[0];
            if (!file) return;
            const errEl = document.getElementById('binderCoverError');
            errEl.style.display = 'none';

            const userId = await authGetUserId();
            if (!userId) { errEl.textContent = 'Sessione non valida, ricarica la pagina.'; errEl.style.display = 'block'; return; }

            let pngBlob;
            try {
                pngBlob = await _convertiImmagineCopertina(file);
            } catch (e) {
                if (e.message === 'FORMATO_NON_LEGGIBILE') {
                    errEl.textContent = '❌ Il tuo dispositivo ha salvato questa foto in un formato che il sito non riesce a leggere (capita spesso con le foto scattate su iPhone, formato HEIC). Su iPhone: Impostazioni → Foto → Formato foto → scegli "Più compatibile", oppure scegli "Più piccola" quando condividi/esporti la foto. Poi riprova.';
                } else {
                    errEl.textContent = '❌ Errore nella conversione dell\'immagine: ' + e.message;
                }
                errEl.style.display = 'block';
                event.target.value = '';
                return;
            }

            const path = `${userId}/binder_cover`;
            const { error: errUpload } = await storageUploadUserMedia(path, pngBlob);
            if (errUpload) { errEl.textContent = '❌ Errore nel caricamento: ' + errUpload.message; errEl.style.display = 'block'; event.target.value = ''; return; }

            const { data: mediaRow, error: errUpsert } = await userMediaUpsertELeggi({
                user_id: userId,
                slot: 'binder_cover',
                storage_path: path,
                source: 'upload',
                status: 'pending',
                admin_note: null,
                reviewed_at: null,
                reviewed_by: null
            });

            if (errUpsert) { errEl.textContent = '❌ Foto caricata ma non registrata: ' + errUpsert.message; errEl.style.display = 'block'; event.target.value = ''; return; }

            const { error: errRichiesta } = await creaRichiestaPendente(userId, 'photo_upload', { media_id: mediaRow.id });
            if (errRichiesta) console.error('Media registrato ma richiesta non collegata:', errRichiesta.message);

            event.target.value = '';
            await caricaBinderCoverStato();
        }


        // ── RETRO CARTA PERSONALIZZATO (Fase 2, backcarte, 20/08/2026) ───
        // Slot 'card_back' su user_media (bucket privato 'user-media', path
        // {user_id}/card_back). Stesso pattern upload/pending di
        // gestisciUploadBinderCover() sopra. In più: campo 'metadata' jsonb
        // (Fase 1 SQL) contiene il fieldState — posizioni % dei 4 campi
        // (pokemon/condition/variazione/price) disegnati sopra la sleeve.
        // Editor drag/resize portato da modalita-crea-la-tua-sleeve.html del
        // pacchetto backcarte, stage aggiornato da 750x1040 a 900x1260 (vedi
        // ROADMAP sez.1 punto 8 — formato 5:7, standard reale delle carte
        // trading 63,5x88,9mm, coerente con l'aspect-ratio già usato dal
        // modale flip di index.html).

        // Posizioni di fabbrica dei 4 campi — stessi valori % del file
        // backcarte originale (DEFAULT_STATE), solo 'altro_0' rinominato in
        // 'variazione' (mostra la variazione di prezzo, non più un fumetto
        // libero — vedi decisione di Claudio, 20/08/2026).

        // Stato correntemente mostrato nell'editor (mutato dal drag/resize,
        // salvato solo quando l'utente preme "Salva posizioni"). null finché
        // non esiste nessuna sleeve da editare.

        // Converte un file immagine qualsiasi in PNG 900x1260 con ritaglio
        // centrato ("cover", nessuna deformazione) — stessa identica logica
        // di _convertiImmagineCopertina() sopra, solo dimensioni diverse.
        // Funzione separata e non generalizzata su richiesta esplicita di
        // Claudio (niente parametrizzazione cross-funzione a rischio).
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
                img.onerror = () => {
                    URL.revokeObjectURL(url);
                    reject(new Error('FORMATO_NON_LEGGIBILE'));
                };
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


        // Collega drag (corpo campo + maniglia blu) e resize (maniglia
        // verde) ai 4 campi, via Pointer Events (mouse + touch). Va fatto
        // UNA sola volta: i campi sono statici nel DOM, cambia solo
        // _cardBackFieldState (mutato qui) e l'immagine di sfondo.
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


        async function caricaCardBackStato() {
            const statoEl = document.getElementById('cardBackStato');
            const previewEl = document.getElementById('cardBackPreview');
            const editorWrap = document.getElementById('cardBackEditorWrap');
            document.getElementById('cardBackError').style.display = 'none';

            const userId = await authGetUserId();
            if (!userId) { statoEl.textContent = 'Accedi per gestire il retro carta.'; return; }

            const { data: media, error } = await userMediaGet(userId, 'card_back');

            if (error) { statoEl.textContent = 'Errore nel controllare lo stato: ' + error.message; return; }

            if (!media) {
                statoEl.textContent = 'Nessuna sleeve caricata ancora — verrà mostrato il retro di sistema.';
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


        async function gestisciUploadCardBack(event) {
            const file = event.target.files?.[0];
            if (!file) return;
            const errEl = document.getElementById('cardBackError');
            errEl.style.display = 'none';

            const userId = await authGetUserId();
            if (!userId) { errEl.textContent = 'Sessione non valida, ricarica la pagina.'; errEl.style.display = 'block'; return; }

            let pngBlob;
            try {
                pngBlob = await _convertiImmagineCardBack(file);
            } catch (e) {
                if (e.message === 'FORMATO_NON_LEGGIBILE') {
                    errEl.textContent = '❌ Il tuo dispositivo ha salvato questa foto in un formato che il sito non riesce a leggere (capita spesso con le foto scattate su iPhone, formato HEIC). Su iPhone: Impostazioni → Foto → Formato foto → scegli "Più compatibile", oppure scegli "Più piccola" quando condividi/esporti la foto. Poi riprova.';
                } else {
                    errEl.textContent = '❌ Errore nella conversione dell\'immagine: ' + e.message;
                }
                errEl.style.display = 'block';
                event.target.value = '';
                return;
            }

            const path = `${userId}/card_back`;
            const { error: errUpload } = await storageUploadUserMedia(path, pngBlob);
            if (errUpload) { errEl.textContent = '❌ Errore nel caricamento: ' + errUpload.message; errEl.style.display = 'block'; event.target.value = ''; return; }

            // NOTA: ogni nuova sleeve riparte con le posizioni di default
            // (assunzione di Claude, non esplicitamente decisa da Claudio —
            // una nuova immagine ha probabilmente una composizione diversa
            // da quella vecchia, riusare le vecchie posizioni rischierebbe
            // di piazzare i campi in punti sbagliati).
            const { data: mediaRow, error: errUpsert } = await userMediaUpsertELeggi({
                user_id: userId,
                slot: 'card_back',
                storage_path: path,
                source: 'upload',
                status: 'pending',
                admin_note: null,
                reviewed_at: null,
                reviewed_by: null,
                metadata: DEFAULT_STATE_CARD_BACK
            });

            if (errUpsert) { errEl.textContent = '❌ Foto caricata ma non registrata: ' + errUpsert.message; errEl.style.display = 'block'; event.target.value = ''; return; }

            const { error: errRichiesta } = await creaRichiestaPendente(userId, 'photo_upload', { media_id: mediaRow.id });
            if (errRichiesta) console.error('Media registrato ma richiesta non collegata:', errRichiesta.message);

            event.target.value = '';
            await caricaCardBackStato();
        }


        // Salva SOLO il fieldState (metadata) sulla riga già esistente, senza
        // toccare status/pending_requests: spostare i campi non richiede una
        // nuova approvazione admin (quella riguarda l'immagine, non le
        // posizioni). Richiede la policy UPDATE già estesa a qualsiasi stato
        // (06_user_media_update_sempre.sql, già confermata sul DB per
        // binder_cover — stessa RLS slot-agnostica, vedi ROADMAP sez.1).
        async function salvaPosizioniCardBack() {
            const statoEl = document.getElementById('cardBackPosStato');
            if (!_cardBackFieldState) return;

            const userId = await authGetUserId();
            if (!userId) { statoEl.textContent = 'Sessione non valida.'; return; }

            statoEl.textContent = 'Salvataggio…';
            const { error } = await userMediaUpdateMetadata(userId, 'card_back', _cardBackFieldState);

            statoEl.textContent = error ? ('❌ Errore: ' + error.message) : '✅ Posizioni salvate.';
        }


        function ripristinaPosizioniCardBackDefault() {
            if (!_cardBackFieldState) return;
            _cardBackFieldState = JSON.parse(JSON.stringify(DEFAULT_STATE_CARD_BACK));
            Object.keys(DEFAULT_STATE_CARD_BACK).forEach(applyCardBackFieldState);
            document.getElementById('cardBackPosStato').textContent = 'Posizioni ripristinate ai valori di default. Ricordati di premere "Salva posizioni".';
        }


        // ── GALLERIA SFONDI PREDEFINITI (Fase 2bis, 20/08/2026) ──────────
        // Bucket pubblico 'default-assets' (05_schema_default_assets_bucket.sql),
        // due cartelle: card_back/ e binder_cover/. Selezionare un default
        // È immediato (status:'approved', niente pending_requests): sono
        // asset già curati da Claudio/Claudio, non serve moderazione.
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


        function toggleGalleriaDefaultBinderCover() {
            const wrap = document.getElementById('binderCoverGalleriaWrap');
            const show = wrap.style.display === 'none';
            wrap.style.display = show ? 'block' : 'none';
            if (show) _caricaGalleriaDefault('binder_cover', 'binderCoverGalleriaGrid', selezionaDefaultBinderCover);
        }


        async function selezionaDefaultBinderCover(filename) {
            const errEl = document.getElementById('binderCoverError');
            errEl.style.display = 'none';

            const userId = await authGetUserId();
            if (!userId) { errEl.textContent = 'Sessione non valida, ricarica la pagina.'; errEl.style.display = 'block'; return; }

            const { error } = await userMediaUpsert({
                user_id: userId,
                slot: 'binder_cover',
                storage_path: `binder_cover/${filename}`,
                source: 'default',
                status: 'approved',
                admin_note: null,
                reviewed_at: null,
                reviewed_by: null
            });

            if (error) { errEl.textContent = '❌ Errore: ' + error.message; errEl.style.display = 'block'; return; }

            document.getElementById('binderCoverGalleriaWrap').style.display = 'none';
            await caricaBinderCoverStato();
        }


        function toggleGalleriaDefaultCardBack() {
            const wrap = document.getElementById('cardBackGalleriaWrap');
            const show = wrap.style.display === 'none';
            wrap.style.display = show ? 'block' : 'none';
            if (show) _caricaGalleriaDefault('card_back', 'cardBackGalleriaGrid', selezionaDefaultCardBack);
        }


        async function selezionaDefaultCardBack(filename) {
            const errEl = document.getElementById('cardBackError');
            errEl.style.display = 'none';

            const userId = await authGetUserId();
            if (!userId) { errEl.textContent = 'Sessione non valida, ricarica la pagina.'; errEl.style.display = 'block'; return; }

            const { error } = await userMediaUpsert({
                user_id: userId,
                slot: 'card_back',
                storage_path: `card_back/${filename}`,
                source: 'default',
                status: 'approved',
                admin_note: null,
                reviewed_at: null,
                reviewed_by: null,
                metadata: DEFAULT_STATE_CARD_BACK
            });

            if (error) { errEl.textContent = '❌ Errore: ' + error.message; errEl.style.display = 'block'; return; }

            document.getElementById('cardBackGalleriaWrap').style.display = 'none';
            await caricaCardBackStato();
        }


        // ── RENDER RETRO CARTA — RAMO OWNER (Fase 4, 20/08/2026) ─────────
        // Usato SOLO da index.html: area privata, l'utente loggato vede
        // sempre la PROPRIA sleeve, anche se ancora in revisione (pending) —
        // serve da anteprima. Fallback a 3 livelli: sleeve propria (qualsiasi
        // stato) → default di sistema (default-assets/card_back/defaultcard.png)
        // → nessuno stage (resta il carta_retro.png statico via CSS, rete di
        // sicurezza estrema se anche il default di sistema non è raggiungibile).
        async function renderRetroCartaOwner(card) {
            const wrap = document.getElementById('cbdWrap');
            try {
                const userId = await authGetUserId();

                let sleeveUrl = null;
                let fieldState = DEFAULT_STATE_CARD_BACK;

                if (userId) {
                    const { data: media } = await userMediaGet(userId, 'card_back');

                    if (media) {
                        if (media.source === 'default') {
                            const { data: pub } = storageDefaultAssetPublicUrl(media.storage_path);
                            sleeveUrl = pub?.publicUrl || null;
                        } else {
                            const { data: signed } = await storageSignedUrlUserMedia(media.storage_path);
                            sleeveUrl = signed?.signedUrl || null;
                        }
                        fieldState = media.metadata || DEFAULT_STATE_CARD_BACK;
                    }
                }

                if (!sleeveUrl) {
                    const { data: pub } = storageDefaultAssetPublicUrl('card_back/defaultcard.png');
                    sleeveUrl = pub?.publicUrl || null;
                }

                if (!sleeveUrl) { wrap.style.display = 'none'; return; }

                document.getElementById('cbdBgImg').src = sleeveUrl;
                _popolaCbdField('pokemon', card.name || '', fieldState.pokemon);
                _popolaCbdField('condition', card.cond || 'NM', fieldState.condition);
                _popolaCbdField('variazione', (card.variation !== undefined && card.variation !== null) ? String(card.variation) : '', fieldState.variazione);
                _popolaCbdField('price', (card.price !== undefined && card.price !== null) ? card.price.toFixed(2) + ' €' : '', fieldState.price);

                wrap.style.display = 'block';
                _cbdRescale();
            } catch (e) {
                console.error('renderRetroCartaOwner:', e);
                wrap.style.display = 'none'; // fallback silenzioso a carta_retro.png statico
            }
        }


        function _popolaCbdField(key, text, pos) {
            const fieldEl = document.getElementById('cbdField-' + key);
            const textEl = document.getElementById('cbdText-' + key);
            if (textEl) textEl.textContent = text;
            if (fieldEl && pos) {
                fieldEl.style.left = pos.left + '%';
                fieldEl.style.top = pos.top + '%';
                fieldEl.querySelector('.cbd-field-content').style.transform = `scale(${pos.scale || 1})`;
            }
        }


        function _cbdRescale() {
            const wrap = document.getElementById('cbdWrap');
            const stage = document.getElementById('cbdStage');
            if (!wrap || !stage || wrap.clientWidth === 0) return;
            const scale = wrap.clientWidth / CARD_BACK_W;
            stage.style.transform = `scale(${scale})`;
        }
        window.addEventListener('resize', _cbdRescale);


        // A6, punto 4 — rimozione diretta dallo slot pieno nel Binder.
        // Riusa toggleBinderMembership() così com'è (già gestisce la conferma
        // di rimozione e l'update di _idsNelBinder) — qui aggiungo solo il
        // refresh immediato della griglia, dato che siamo già sulla tab
        // Binder e vogliamo vedere lo slot sparire subito, non al prossimo
        // cambio tab. Se l'utente annulla la conferma, renderBinder() ridisegna
        // comunque la stessa identica situazione (nessun effetto visibile).
        async function rimuoviDalBinderSlot(id) {
            await toggleBinderMembership(id);
            renderBinder();
        }


        // A6, punto 5 — conferma al cambio layout: la disposizione visiva
        // cambia (più/meno colonne), quindi un ordine "curato" a mano può
        // risultare diverso. Nessuna conferma se il Binder è vuoto (niente da
        // riorganizzare) o se si risceglie il layout già attivo (no-op).

        function impostaBinderLayout(layout) {
            if (!BINDER_LAYOUTS[layout]) return;
            if (layout === _binderLayout) return;

            if (_idsNelBinder.size > 0) {
                const etichetta = BINDER_LAYOUT_ETICHETTE[layout] || layout;
                const ok = confirm(`Passando al layout ${etichetta} la disposizione cambierà — se avevi organizzato le carte in un ordine preciso potrebbe risultare diversa. Continuare?`);
                if (!ok) return;
            }

            _binderLayout = layout;
            _binderPagina = 0;
            prefBinderLayoutSet(layout);
            renderBinder();
        }


        function binderPaginaPrecedente() {
            if (_binderPagina > 0) { _binderPagina--; renderBinder(); }
        }


        function binderPaginaSuccessiva() {
            _binderPagina++;
            renderBinder();
        }


        // ── A6 — Aggiungi/Rimuovi dal Binder ──────────────────────────────────
        // Azione leggera: NON richiama caricaCarteReali() per intero (troppo
        // pesante per un singolo insert/delete su binder_carte). Aggiorna solo
        // _idsNelBinder in memoria + i pulsanti a schermo con quell'id (tabella
        // desktop e schedina mobile compatta possono coesistere nel DOM).
        // Se in quel momento la tab attiva è "binder", il prossimo giro di
        // renderBinder() (es. cambiando tab e tornando) userà comunque il Set
        // già aggiornato, quindi nessuna incoerenza — semplicemente non
        // ridisegniamo la griglia Binder qui per non uscire dallo scope di
        // questo pezzo (il click parte sempre da Visualizzazione/Wishlist,
        // mai dalla tab Binder stessa in questa consegna).
        async function toggleBinderMembership(id) {
            const card = carteReali.find(c => String(c.id) === String(id));
            if (!card || card.tabella !== 'carte' || card.stato !== 'collezione') return;

            const giaNelBinder = _idsNelBinder.has(String(id));

            if (giaNelBinder) {
                if (!confirm(`Rimuovere "${card.name}" dal Binder?`)) return;
            }

            const userId = await authGetUserId();
            if (!userId) return;

            if (giaNelBinder) {
                const { error } = await binderCarteDeleteOne(userId, id);
                if (error) { alert('❌ Errore nel rimuovere la carta dal Binder: ' + error.message); return; }
                _idsNelBinder.delete(String(id));
            } else {
                const { error } = await binderCarteInsert({ owner_id: userId, carta_id: id });
                if (error) { alert('❌ Errore nell\'aggiungere la carta al Binder: ' + error.message); return; }
                _idsNelBinder.add(String(id));
            }

            _aggiornaBottoniBinderToggle(id);
        }


        // Aggiorna icona/testo/animazione di TUTTI i pulsanti a schermo legati
        // a quell'id (tabella + vista compatta, se entrambi presenti nel DOM).
        function _aggiornaBottoniBinderToggle(id) {
            const idAttr = String(id);
            const nelBinder = _idsNelBinder.has(idAttr);
            document.querySelectorAll(`.btn-binder-toggle[data-id="${idAttr}"]`).forEach((btn) => {
                btn.innerHTML = nelBinder
                    ? '<i class="fa-solid fa-layer-group"></i> Rimuovi dal Binder'
                    : '<i class="fa-solid fa-layer-group"></i> Aggiungi al Binder';
                btn.classList.remove('binder-toggle-flash');
                void btn.offsetWidth; // riavvia l'animazione anche se già stata giocata di recente
                btn.classList.add('binder-toggle-flash');
                setTimeout(() => btn.classList.remove('binder-toggle-flash'), 600);
            });
        }


        // ── A6, punto 2 — Modale "Aggiungi carte al Binder" ───────────────────
        // _modificheBinderPendenti: Map<id, true|false> — true = da aggiungere,
        // false = da rimuovere. Contiene SOLO gli id il cui stato è stato
        // toccato in questa sessione di modale (checkbox cliccata), non tutte
        // le carte visibili. Azzerata ad ogni apertura/chiusura del modale.

        function apriAggiungiCarteBinder() {
            _modificheBinderPendenti = new Map();
            document.getElementById('aggiungiCarteBinderInput').value = '';
            document.getElementById('aggiungiCarteBinderRisultati').innerHTML =
                '<p style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding:1rem 0;">Scrivi almeno 2 caratteri.</p>';
            _aggiornaBottoneApplicaBinder();
            document.getElementById('aggiungiCarteBinderModal').style.display = 'flex';
        }


        function chiudiAggiungiCarteBinder() {
            document.getElementById('aggiungiCarteBinderModal').style.display = 'none';
            _modificheBinderPendenti = new Map();
        }


        // Stesso identico pattern di eseguiRicercaGlobale (min 2 caratteri,
        // stesso limite risultati), ma con checkbox al posto del click-to-go
        // e filtrato SOLO su stato==='collezione' (Wishlist/Sealed esclusi:
        // non ha senso metterli nel Binder).
        function eseguiRicercaAggiungiCarteBinder(query) {
            const container = document.getElementById('aggiungiCarteBinderRisultati');
            const q = query.trim().toLowerCase();
            if (q.length < 2) {
                container.innerHTML = '<p style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding:1rem 0;">Scrivi almeno 2 caratteri.</p>';
                return;
            }

            const risultati = carteReali
                .filter(c => c.tabella === 'carte' && c.stato === 'collezione')
                .filter(c => c.name.toLowerCase().includes(q) || (c.code || '').toLowerCase().includes(q))
                .slice(0, 40);

            if (risultati.length === 0) {
                container.innerHTML = '<p style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding:1rem 0;">Nessuna carta trovata.</p>';
                return;
            }

            container.innerHTML = risultati.map(c => {
                const idAttr = String(c.id).replace(/'/g, "\\'");
                // Stato "di partenza" = presente in binder ORA, a meno che in
                // questa sessione di modale non sia già stata toccata (in tal
                // caso vince la scelta pendente, per restare coerenti se
                // l'utente cerca termini diversi e ritrova la stessa carta).
                const spuntata = _modificheBinderPendenti.has(idAttr)
                    ? _modificheBinderPendenti.get(idAttr)
                    : _idsNelBinder.has(idAttr);
                return `
                    <label class="risultato-ricerca-globale" style="display:flex; align-items:center; gap:0.6rem; cursor:pointer;">
                        <input type="checkbox" data-id="${idAttr}" ${spuntata ? 'checked' : ''} onchange="_segnaModificaBinderPendente('${idAttr}', this.checked)">
                        <span class="risultato-ricerca-globale-nome" style="flex:1;">${escapeHtml(c.name)}${c.code ? ` <span style="color:var(--text-muted); font-weight:600;">(${c.code})</span>` : ''}${c.qty > 1 ? ` <span style="color:var(--text-muted); font-weight:600;">×${c.qty}</span>` : ''}</span>
                    </label>
                `;
            }).join('');
        }


        function _segnaModificaBinderPendente(id, spuntata) {
            const giaNelBinder = _idsNelBinder.has(id);
            // Se il nuovo stato coincide con quello reale attuale, non è più
            // una "modifica pendente" — la togliamo dalla mappa per tenere il
            // conteggio/conferma finale accurati.
            if (spuntata === giaNelBinder) {
                _modificheBinderPendenti.delete(id);
            } else {
                _modificheBinderPendenti.set(id, spuntata);
            }
            _aggiornaBottoneApplicaBinder();
        }


        function _aggiornaBottoneApplicaBinder() {
            const n = _modificheBinderPendenti.size;
            const btn = document.getElementById('aggiungiCarteBinderApplicaBtn');
            btn.disabled = n === 0;
            btn.textContent = n === 0 ? 'Applica' : `Applica (${n} cambiament${n === 1 ? 'o' : 'i'})`;
        }


        // Applica in blocco tutte le modifiche pendenti: insert per le
        // aggiunte, delete per le rimozioni. Conferma UNA sola volta, solo se
        // tra i cambiamenti c'è almeno una rimozione (coerente col toggle
        // singolo del punto 1, che chiede conferma solo per rimuovere).
        async function applicaModificheBinder() {
            if (_modificheBinderPendenti.size === 0) return;

            const daAggiungere = [];
            const daRimuovere = [];
            _modificheBinderPendenti.forEach((spuntata, id) => {
                (spuntata ? daAggiungere : daRimuovere).push(id);
            });

            if (daRimuovere.length > 0) {
                const msg = daRimuovere.length === 1
                    ? 'Stai per rimuovere 1 carta dal Binder. Continuare?'
                    : `Stai per rimuovere ${daRimuovere.length} carte dal Binder. Continuare?`;
                if (!confirm(msg)) return;
            }

            const userId = await authGetUserId();
            if (!userId) return;

            if (daAggiungere.length > 0) {
                const { error } = await binderCarteInsert(daAggiungere.map(id => ({ owner_id: userId, carta_id: id })));
                if (error) { alert('❌ Errore nell\'aggiungere alcune carte al Binder: ' + error.message); return; }
                daAggiungere.forEach(id => _idsNelBinder.add(id));
            }

            if (daRimuovere.length > 0) {
                const { error } = await binderCarteDeleteBatch(userId, daRimuovere);
                if (error) { alert('❌ Errore nel rimuovere alcune carte dal Binder: ' + error.message); return; }
                daRimuovere.forEach(id => _idsNelBinder.delete(id));
            }

            // Aggiorna anche i pulsanti toggle del punto 1, se visibili altrove
            // nel DOM in questo momento (tabella/vista compatta).
            [...daAggiungere, ...daRimuovere].forEach(id => _aggiornaBottoniBinderToggle(id));

            chiudiAggiungiCarteBinder();
            renderBinder(); // siamo già nella tab Binder: aggiornamento immediato
        }
