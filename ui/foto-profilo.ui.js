// ═══════════════════════════════════════════════════════════════════════
// FOTO-PROFILO.UI.JS — foto profilo (Impostazioni → Account) e avatar
// ═══════════════════════════════════════════════════════════════════════
// RESTYLE BINDEX (2026-10-01, sql/90). Stesso percorso di retro carta e
// copertina: file nel bucket privato user-media, riga user_media
// (slot 'profilo') in attesa, richiesta 'photo_upload' all'admin.
// La propria foto si vede subito (anche in attesa) nella barra in alto; gli
// altri la vedono solo dopo l'approvazione (Match, Chat, Richieste).
//
// Avatar degli altri: chi disegna un avatar mette data-avatar-utente="<id>"
// e poi chiama fotoProfiloApplica(contenitore) — una lettura sola per tutti
// gli id visibili, URL firmati in cache per 50 minuti.

const _FP_LATO = 384;
let _fpCacheUrl = new Map(); // user_id → { url, quando } ('' = nessuna foto)

// Ritaglio quadrato centrale, JPEG leggero.
async function _fpPreparaFoto(file) {
    let img;
    try { img = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (_) {
        const url = URL.createObjectURL(file);
        img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('Formato non leggibile (su iPhone scegli "Più compatibile" nelle impostazioni della fotocamera)')); i.src = url; });
    }
    const w = img.width || img.naturalWidth, h = img.height || img.naturalHeight;
    const lato = Math.min(w, h);
    const c = document.createElement('canvas');
    c.width = c.height = _FP_LATO;
    c.getContext('2d').drawImage(img, (w - lato) / 2, (h - lato) / 2, lato, lato, 0, 0, _FP_LATO, _FP_LATO);
    return new Promise((ok, ko) => c.toBlob(b => b ? ok(b) : ko(new Error('Conversione non riuscita')), 'image/jpeg', 0.85));
}

// ── Impostazioni → Account ───────────────────────────────────────────────
async function fotoProfiloRenderImpostazioni() {
    const box = document.getElementById('fotoProfiloBox');
    if (!box) return;
    const userId = await authGetUserId();
    if (!userId) return;
    const { data: riga } = await fotoProfiloMia(userId);
    let anteprima = '';
    if (riga && riga.storage_path) {
        const { data } = await storageSignedUrlUserMedia(riga.storage_path);
        anteprima = data && data.signedUrl ? data.signedUrl : '';
    }
    const stato = !riga ? '' : riga.status === 'approved'
        ? '<span class="fp-stato ok"><i class="fa-solid fa-check"></i> Approvata: la vede il gruppo</span>'
        : riga.status === 'rejected'
            ? `<span class="fp-stato ko"><i class="fa-solid fa-xmark"></i> Rifiutata${riga.admin_note ? ': ' + escapeHtml(riga.admin_note) : ''}</span>`
            : '<span class="fp-stato att"><i class="fa-regular fa-clock"></i> In attesa di approvazione</span>';
    box.innerHTML = `
        <div class="fp-riga">
            <div class="fp-avatar" ${anteprima ? `style="background-image:url('${anteprima}')"` : ''}>${anteprima ? '' : '<i class="fa-solid fa-user"></i>'}</div>
            <div class="fp-testo">
                <b>Foto profilo</b>
                <span>La vedono gli altri del gruppo dopo l'approvazione dell'amministratore.</span>
                ${stato}
            </div>
        </div>
        <label class="btn-secondary fp-scegli"><input type="file" accept="image/*" onchange="fotoProfiloCarica(this)"><i class="fa-solid fa-camera"></i> ${riga ? 'Cambia foto' : 'Scegli foto'}</label>
        <p class="fp-errore" id="fotoProfiloErrore" style="display:none;"></p>`;
}

async function fotoProfiloCarica(input) {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    const errEl = document.getElementById('fotoProfiloErrore');
    const errore = (t) => { if (errEl) { errEl.textContent = '❌ ' + t; errEl.style.display = ''; } };
    const userId = await authGetUserId();
    if (!userId) return;
    let blob;
    try { blob = await _fpPreparaFoto(file); } catch (e) { errore(e.message); return; }
    const path = `${userId}/profilo/foto`;
    const { error: errUp } = await fotoProfiloUpload(path, blob);
    if (errUp) { errore('Caricamento non riuscito: ' + errUp.message); return; }
    const { data: esistente } = await fotoProfiloMia(userId);
    const payload = { storage_path: path, source: 'upload', status: 'pending', admin_note: null, reviewed_at: null, reviewed_by: null };
    const { data: riga, error: errRiga } = esistente
        ? await fotoProfiloAggiorna(esistente.id, payload)
        : await fotoProfiloInserisci({ ...payload, user_id: userId, slot: 'profilo', binder_id: null, scaffale_id: null });
    if (errRiga) { errore('Foto caricata ma non registrata: ' + errRiga.message); return; }
    const { error: errRich } = await creaRichiestaPendente(userId, 'photo_upload', { media_id: riga.id });
    if (errRich) console.error('[foto profilo] richiesta admin:', errRich.message);
    _fpCacheUrl.delete(userId);
    await fotoProfiloRenderImpostazioni();
    fotoProfiloAggiornaBarra();
}

// ── Barra in alto (la mia foto, anche se in attesa) ──────────────────────
async function fotoProfiloAggiornaBarra() {
    if (typeof CSBar === 'undefined' || !CSBar.setProfile) return;
    try {
        const userId = await authGetUserId();
        if (!userId) return;
        const [{ data: riga }, nick] = await Promise.all([
            fotoProfiloMia(userId),
            (typeof userSettingsGet === 'function' ? userSettingsGet(userId).then(r => r && r.data && r.data.nickname).catch(() => null) : Promise.resolve(null)),
        ]);
        let url = '';
        if (riga && riga.storage_path && riga.status !== 'rejected') {
            const { data } = await storageSignedUrlUserMedia(riga.storage_path);
            url = data && data.signedUrl ? data.signedUrl : '';
        }
        const profilo = { avatarUrl: url };
        if (nick) profilo.name = nick;
        CSBar.setProfile(profilo);
    } catch (e) { console.warn('[foto profilo] barra:', e); }
}

// ── Avatar degli altri ───────────────────────────────────────────────────
async function fotoProfiloApplica(contenitore) {
    const radice = contenitore || document;
    const nodi = [...radice.querySelectorAll('[data-avatar-utente]')];
    if (!nodi.length) return;
    const ora = Date.now();
    const ids = [...new Set(nodi.map(n => n.dataset.avatarUtente).filter(id => id && /^[0-9a-f-]{36}$/i.test(id)))];
    const daLeggere = ids.filter(id => { const c = _fpCacheUrl.get(id); return !c || ora - c.quando > 50 * 60 * 1000; });
    if (daLeggere.length) {
        try {
            const { data, error } = await fotoProfiloLeggiAltri(daLeggere);
            if (!error) {
                daLeggere.forEach(id => _fpCacheUrl.set(id, { url: '', quando: ora }));
                const righe = data || [];
                if (righe.length) {
                    const { data: firmati } = await fotoProfiloUrlFirmati(righe.map(r => r.storage_path));
                    righe.forEach((r, i) => {
                        const f = firmati && firmati[i];
                        if (f && f.signedUrl) _fpCacheUrl.set(r.user_id, { url: f.signedUrl, quando: ora });
                    });
                }
            }
        } catch (e) { console.warn('[foto profilo] avatar:', e); }
    }
    nodi.forEach(n => {
        const c = _fpCacheUrl.get(n.dataset.avatarUtente);
        if (c && c.url) { n.style.backgroundImage = `url('${c.url}')`; n.classList.add('con-foto'); }
    });
}
