// ── ui/binder-pubblico.ui.js ─────────────────────────────────────────────
// Logica UI di binder-pubblico.html — la pagina pubblica GENERICA per
// binder di tipo 'location' (diversi da SCAMBIO, che ha già scambio.html)
// ed 'extra' (mai avuto una pagina pubblica prima d'ora). Wishlist e
// Scambio NON passano da qui, hanno le loro pagine dedicate.
//
// A differenza di scambio.ui.js/wishlist.ui.js: nessuna selezione/quantità/
// "copia riepilogo" — qui non c'è un flusso di trattativa, solo una
// vetrina in sola lettura del binder condiviso. La sleeve del retro carta
// è letta qui direttamente (leggi_media_binder_pubblico), NON tramite
// ui/card-back-viewer.ui.js: quel file non è stato verificato in questa
// sessione (probabilmente precede il Multi-Binder), meglio autosufficiente.
//
// Dipende da: data/binder-pubblico.repository.js, state/binder-pubblico.state.js,
// utils/shared-public.js (applicaTemaCondiviso, _urlImmagineVisualizzabile, escapeHtml).

// Stesse posizioni di default dell'editor privato (state/binder.state.js:
// DEFAULT_STATE_CARD_BACK) — copiate qui perché questa pagina non carica
// quel file. Usate solo se la sleeve non ha un metadata salvato.
const DEFAULT_STATE_CARD_BACK = {
    pokemon:    { left: 13.48, top: 9.33,  scale: 1 },
    condition:  { left: 27.19, top: 31.82, scale: 1 },
    variazione: { left: 27.19, top: 55.25, scale: 1 },
    price:      { left: 66.44, top: 78.27, scale: 1 }
};
const CARD_BACK_W = 900;
const CARD_BACK_H = 1260;

async function caricaCatalogo() {
    const params = new URLSearchParams(window.location.search);
    const binderId = params.get('binder');
    _binderId = binderId;
    const container = document.getElementById('listaContainer');

    if (!binderId) {
        container.innerHTML = '<div class="stato-errore"><i class="fa-solid fa-triangle-exclamation"></i> Link non valido — manca il riferimento al binder.</div>';
        return;
    }

    const { data: info, error: errInfo } = await binderPubblicoLeggiInfo(binderId);
    if (errInfo || !info || info.length === 0) {
        container.innerHTML = '<div class="stato-errore"><i class="fa-solid fa-lock"></i> Questo binder non è (più) pubblico, o il link non è valido.</div>';
        document.getElementById('statRiepilogo').textContent = '';
        return;
    }

    const nomeBinder = info[0].nome || 'Binder';
    document.title = 'CardSync Pro — ' + nomeBinder;
    document.getElementById('titoloBinder').textContent = nomeBinder;

    _caricaCopertinaBinder(binderId); // non bloccante, si aggiorna da sola quando pronta

    const { data, error } = await binderPubblicoLeggiCarte(binderId);
    if (error) {
        container.innerHTML = `<div class="stato-errore"><i class="fa-solid fa-triangle-exclamation"></i> Errore nel caricamento: ${error.message}</div>`;
        return;
    }

    carte = (data || []).map(r => ({
        id: r.id,
        name: r.nome || '',
        code: r.codice || '',
        lang: r.lingua || 'IT',
        cond: r.condizione || 'NM',
        qty: r.qty || 1,
        price: r.prezzo != null ? Number(r.prezzo) : 0,
        notes: r.note || '',
        immagine: r.immagine || null,
    }));

    if (carte.length === 0) {
        container.innerHTML = '<div class="stato-vuoto"><i class="fa-solid fa-box-open"></i><br>Questo binder è vuoto al momento.</div>';
        document.getElementById('statRiepilogo').textContent = '';
        return;
    }

    document.getElementById('statRiepilogo').textContent =
        `${carte.length} cart${carte.length === 1 ? 'a' : 'e'}`;

    renderLista();
}

async function _caricaCopertinaBinder(binderId) {
    const { data: media, error } = await binderPubblicoLeggiMedia(binderId);
    if (error || !media) return;
    const copertina = media.find(m => m.slot === 'binder_cover');
    if (!copertina) return;

    let url = null;
    if (copertina.source === 'default') {
        const { data: pub } = supabaseClient.storage.from('default-assets').getPublicUrl(copertina.storage_path);
        url = pub?.publicUrl || null;
    } else {
        url = copertina.storage_path; // la RPC ritorna già un path risolvibile solo per gli 'approved'; vedi nota sotto
    }
    // NOTA: per il bucket privato 'user-media' servirebbe una signed URL,
    // che richiede una chiamata storage autenticata — un visitatore
    // anonimo non può generarla. leggi_media_binder_pubblico ritorna lo
    // storage_path grezzo per le foto caricate dall'utente: senza una
    // funzione dedicata che generi la signed URL lato server (SECURITY
    // DEFINER), qui la copertina "upload" personalizzata non è mostrabile
    // pubblicamente — solo quelle scelte dalla galleria default (source:
    // 'default', bucket pubblico) lo sono. Segnalato a Claudio: se vuole
    // anche le copertine caricate visibili pubblicamente, serve una RPC in
    // più (signed URL generata server-side).
    if (copertina.source !== 'default') return;

    const banner = document.getElementById('copertinaBinderBanner');
    if (banner && url) {
        banner.style.backgroundImage = `url('${url}')`;
        banner.style.display = 'block';
    }
}

function renderLista() {
    const container = document.getElementById('listaContainer');
    const searchVal = document.getElementById('searchInput').value.toLowerCase();

    const filtrate = carte.filter(c =>
        c.name.toLowerCase().includes(searchVal) || c.code.toLowerCase().includes(searchVal)
    );

    if (filtrate.length === 0) {
        container.innerHTML = '<div class="stato-vuoto"><i class="fa-solid fa-magnifying-glass"></i><br>Nessuna carta corrisponde alla ricerca.</div>';
        return;
    }

    container.innerHTML = filtrate.map(c => {
        const immagineSrc = _urlImmagineVisualizzabile(c.immagine);
        return `
            <div class="card-row">
                ${immagineSrc ? `<img src="${immagineSrc}" alt="" class="card-thumb" onclick="apriFlipCard('${c.id}')" onerror="this.style.display='none';">` : ''}
                <div class="card-info">
                    <div class="card-name">${escapeHtml(c.name)}${c.code ? ` <span style="color:var(--text-muted); font-weight:600;">(${c.code})</span>` : ''}</div>
                    <div class="card-meta">
                        <span class="badge">${c.lang}</span>
                        <span class="badge">${c.cond}</span>
                        ${c.qty > 1 ? `<span class="badge">×${c.qty}</span>` : ''}
                        ${c.notes ? `<span class="badge">✨ ${escapeHtml(c.notes)}</span>` : ''}
                    </div>
                </div>
                <div class="card-price">${formattaEuro(c.price)}</div>
            </div>
        `;
    }).join('');
}

// ── Flip-card con sleeve del binder (autosufficiente, vedi banner in cima) ─
async function apriFlipCard(id) {
    const card = carte.find(c => String(c.id) === String(id));
    if (!card) return;

    const inner = document.getElementById('flipCardInner');
    inner.classList.remove('flipped');

    const frontImg = document.getElementById('flipCardFrontImg');
    const immagineSrc = _urlImmagineVisualizzabile(card.immagine);
    frontImg.style.display = '';
    frontImg.src = immagineSrc || '';
    if (!immagineSrc) frontImg.style.display = 'none';

    document.getElementById('flipCardStats').innerHTML = `
        <div style="font-weight:800; font-size:0.95rem; margin-bottom:0.2rem;">${escapeHtml(card.name)}</div>
        <div style="font-size:0.78rem; opacity:0.85; margin-bottom:0.6rem;"><code style="background:none; color:inherit; padding:0;">${card.code}</code></div>
        ${card.notes ? `<div style="font-size:0.78rem; opacity:0.85; margin-top:0.4rem;">✨ ${escapeHtml(card.notes)}</div>` : ''}
    `;
    await _renderSleeve(card);

    document.getElementById('immagineModal').style.display = 'flex';

    if (_flipCardTimeout) clearTimeout(_flipCardTimeout);
    _flipCardTimeout = setTimeout(() => inner.classList.add('flipped'), 500);
}

function toggleFlipCard() {
    document.getElementById('flipCardInner').classList.toggle('flipped');
}

// Risolta una sola volta per pagina (il binder non cambia durante la
// navigazione) e tenuta in _sleeveRisolta — evita di richiamare la RPC ad
// ogni singola carta aperta.
async function _renderSleeve(card) {
    const wrap = document.getElementById('cbdWrap');
    wrap.style.display = 'none';

    if (_sleeveRisolta === null) {
        const { data: media, error } = await binderPubblicoLeggiMedia(_binderId);
        const riga = (!error && media) ? media.find(m => m.slot === 'card_back') : null;
        if (!riga) {
            _sleeveRisolta = false; // niente sleeve, non ritentare ad ogni carta
        } else if (riga.source === 'default') {
            const { data: pub } = supabaseClient.storage.from('default-assets').getPublicUrl(riga.storage_path);
            _sleeveRisolta = pub?.publicUrl ? { url: pub.publicUrl, metadata: riga.metadata } : false;
        } else {
            // Upload personalizzato: stesso limite della copertina, vedi
            // _caricaCopertinaBinder — nessuna signed URL generabile da
            // anonimo senza una RPC dedicata. Sleeve non mostrabile qui,
            // resta il retro var(--primary) di sempre.
            _sleeveRisolta = false;
        }
    }

    if (!_sleeveRisolta) return; // resta il semplice sfondo var(--primary), nessuna regressione

    document.getElementById('cbdBgImg').src = _sleeveRisolta.url;
    const posizioni = (_sleeveRisolta.metadata && typeof _sleeveRisolta.metadata === 'object') ? _sleeveRisolta.metadata : DEFAULT_STATE_CARD_BACK;

    _cbdScrivi('pokemon', card.name || '');
    _cbdScrivi('condition', card.cond || '');
    _cbdScrivi('variazione', card.notes || '');
    _cbdScrivi('price', formattaEuro(card.price));

    Object.keys(DEFAULT_STATE_CARD_BACK).forEach(chiave => {
        const campo = document.getElementById('cbdField-' + chiave);
        if (!campo) return;
        const s = posizioni[chiave] || DEFAULT_STATE_CARD_BACK[chiave];
        campo.style.left = s.left + '%';
        campo.style.top = s.top + '%';
        const contenuto = campo.querySelector('.cbd-field-content');
        if (contenuto) contenuto.style.transform = `scale(${s.scale != null ? s.scale : 1})`;
    });

    wrap.style.display = 'block';
    const stage = document.getElementById('cbdStage');
    const scala = wrap.clientWidth / CARD_BACK_W;
    stage.style.transform = `scale(${scala})`;
    requestAnimationFrame(() => { stage.style.transform = `scale(${wrap.clientWidth / CARD_BACK_W})`; });
}

function _cbdScrivi(chiave, testo) {
    const el = document.getElementById('cbdText-' + chiave);
    if (el) el.textContent = testo;
}

function chiudiImmagineIngrandita() {
    document.getElementById('immagineModal').style.display = 'none';
    document.getElementById('flipCardInner').classList.remove('flipped');
    if (_flipCardTimeout) { clearTimeout(_flipCardTimeout); _flipCardTimeout = null; }
}
