// ── ui/binder.ui.js ────────────────────────────────────────────────────
// Multi-Binder (2026-08-25): griglia di contenitori cliccabili (uno per
// location + Wishlist + un binder "extra" personalizzabile), ognuno apribile
// in vista paginata con copertina/sleeve personalizzabili.
//
// Dipende da: data/binder.repository.js, data/locations.repository.js,
// data/user-settings.repository.js, data/moderation.repository.js,
// state/binder.state.js, state/cards.state.js (carteReali),
// data/cards.repository.js (wishlistQueryTutte), ui/auth.ui.js
// (authGetUserId), utils condivisi (_urlImmagineVisualizzabile, escapeHtml).
//
// *** COSA MANCA ANCORA, VOLUTAMENTE NON QUI (vedi chat) ***
// - Modalità "elenco testuale": NON è la stessa funzione di Visualizzazione
//   (renderViewTable scrive dentro id fissi di quella pagina, non
//   riusabile da qui senza rifarla generica — vedi nota su
//   renderBinderElenco più sotto) — è un'implementazione parallela con lo
//   stesso stile della vista compatta mobile. Visivamente coerente, ma
//   codice separato.
// - Effetto "libro sfogliabile" con piega di pagina: DELIBERATAMENTE non
//   qui, lo farà una sessione con Opus (vedi file di handoff quando ci
//   arriviamo). Il click su una carta apre per ora la stessa immagine
//   ingrandita di sempre (apriImmagineIngrandita), non un libro.
// - "Aggiungi ANCHE al binder X" sulla riga carta in Visualizzazione: tocca
//   ui/cards.ui.js, non questo file — prossimo passo.
// - Pubblicazione binder sotto approvazione admin: solo colonne DB pronte
//   (vedi 17_binders_multipli.sql), nessuna UI admin qui.
// - Markup HTML nuovo (#bindersContenitoriGrid, #binderDettaglioWrap,
//   pannello Design con #binderCoverStato/#cardBackStage ecc.): non ancora
//   in index.html, vedi elenco id richiesti in chat.


// ── Ingresso dal widget "Binders" (phone.ui.js chiamerà questa) ─────────
async function apriWidgetBinders() {
    const userId = await authGetUserId();
    if (!userId) return;

    await _caricaModalitaBinderUtente(userId);
    await _garantisciTuttiIBinder(userId);

    const { data, error } = await bindersQueryTutti(userId);
    if (error) { console.error('apriWidgetBinders:', error.message); return; }
    _bindersElenco = data || [];

    _binderAttivo = null;
    await renderGrigliaBinders();
}

async function _caricaModalitaBinderUtente(userId) {
    const { data, error } = await userSettingsGet(userId);
    if (!error && data && data.binder_modalita_visualizzazione) {
        _binderModalita = data.binder_modalita_visualizzazione;
    }
    // Se non c'è ancora nessuna preferenza salvata resta il default
    // 'immagini' già impostato in state/binder.state.js.
}

// Materializza tutti i binder-location (uno per valore distinto di
// location.nome dell'utente) + garantisce wishlist ed extra — chiamata ad
// ogni apertura del widget, upsert quindi innocua se già tutto esiste.
async function _garantisciTuttiIBinder(userId) {
    const { data: locations, error: errLoc } = await locationsList(userId);
    if (errLoc) { console.error('_garantisciTuttiIBinder (locations):', errLoc.message); }
    const nomiLocation = (locations || []).map(l => l.nome).filter(Boolean);

    const risultati = await Promise.all([
        binderLocationMaterializzaBatch(userId, nomiLocation),
        binderWishlistGarantisci(userId),
        binderExtraGarantisci(userId, 'Il mio binder'),
    ]);
    risultati.forEach(({ error }) => { if (error) console.error('_garantisciTuttiIBinder:', error.message); });
}


// ── Griglia dei contenitori ──────────────────────────────────────────────
// Richiede in index.html un contenitore <div id="bindersContenitoriGrid">
// dentro la view-section Binder, AFFIANCO (non al posto di) al binderGrid
// esistente — vedi nota separata in chat prima di toccare index.html.
async function renderGrigliaBinders() {
    const userId = await authGetUserId();
    const griglia = document.getElementById('bindersContenitoriGrid');
    if (!griglia) { console.error('renderGrigliaBinders: manca #bindersContenitoriGrid in index.html'); return; }

    if (_bindersElenco.length === 0) {
        griglia.innerHTML = '<div class="stato-vuoto"><i class="fa-solid fa-layer-group"></i><br>Nessun binder ancora — aggiungi una carta con una Location per crearne uno in automatico.</div>';
        return;
    }

    const righe = await Promise.all(_bindersElenco.map(async binder => {
        const [conteggio, copertinaUrl] = await Promise.all([
            _calcolaConteggioBinder(userId, binder),
            _risolviCopertinaBinder(userId, binder),
        ]);
        return { binder, conteggio, copertinaUrl };
    }));

    griglia.innerHTML = righe.map(({ binder, conteggio, copertinaUrl }) => {
        const idAttr = String(binder.id).replace(/'/g, "\\'");
        const nomeAttr = escapeHtml(binder.nome || '');
        const iconaFallback = _iconaFallbackBinder(binder.tipo);
        return `
            <div class="binder-contenitore-tile" onclick="apriBinderDettaglio('${idAttr}')" title="${nomeAttr}">
                <div class="binder-contenitore-cover">
                    ${copertinaUrl
                        ? `<img src="${copertinaUrl}" alt="${nomeAttr}" loading="lazy" onerror="this.remove();">`
                        : `<i class="fa-solid ${iconaFallback}"></i>`}
                </div>
                <div class="binder-contenitore-nome">${nomeAttr}</div>
                <div class="binder-contenitore-conteggio">${conteggio} cart${conteggio === 1 ? 'a' : 'e'}</div>
            </div>`;
    }).join('');
}

function _iconaFallbackBinder(tipo) {
    if (tipo === 'wishlist') return 'fa-heart';
    if (tipo === 'extra') return 'fa-star';
    return 'fa-box-open'; // location
}

// wishlistQueryTutte torna il query builder non risolto (per pagination con
// _selectTuttePagine, vedi cards.repository.js) — qui lo risolvo con un
// await diretto senza paginare: assumo che la wishlist di un singolo
// utente non superi il limite di riga default di PostgREST (~1000).
// Gruppo di 5 persone, rischio concreto basso — se in futuro serve
// paginare, va usato _selectTuttePagine() come fa il resto del sito
// (utils/pagination.utils.js, non ancora letto in questa sessione).
async function _calcolaConteggioBinder(userId, binder) {
    if (binder.tipo === 'location') {
        return carteReali.filter(c => c.tabella === 'carte' && c.stato === 'collezione' && c.location === binder.location_valore).length;
    }
    if (binder.tipo === 'wishlist') {
        const { data, error } = await wishlistQueryTutte(userId);
        if (error) { console.error('_calcolaConteggioBinder (wishlist):', error.message); return 0; }
        return (data || []).length;
    }
    const { data, error } = await binderCarteQuery(userId, binder.id);
    if (error) { console.error('_calcolaConteggioBinder (extra):', error.message); return 0; }
    return (data || []).length;
}

async function _risolviCopertinaBinder(userId, binder) {
    if (_coperturaBinderCache.has(binder.id)) return _coperturaBinderCache.get(binder.id);

    const { data: media, error } = await userMediaGet(userId, binder.id, 'binder_cover');
    let url = null;
    if (!error && media) {
        if (media.source === 'default') {
            const { data: pub } = storageDefaultAssetPublicUrl(media.storage_path);
            url = pub?.publicUrl || null;
        } else {
            const { data: signed } = await storageSignedUrlUserMedia(media.storage_path);
            url = signed?.signedUrl || null;
        }
    }
    _coperturaBinderCache.set(binder.id, url);
    return url;
}


// ── Vista di dettaglio (modalità immagini, paginata) ────────────────────
async function apriBinderDettaglio(binderId) {
    _binderAttivo = binderId;
    _binderPagina = 0;

    document.getElementById('bindersContenitoriGrid').style.display = 'none';
    const wrapDettaglio = document.getElementById('binderDettaglioWrap');
    if (wrapDettaglio) wrapDettaglio.style.display = 'block';

    const binder = _bindersElenco.find(b => String(b.id) === String(binderId));
    if (!binder) return;

    const titoloEl = document.getElementById('binderDettaglioTitolo');
    if (titoloEl) titoloEl.textContent = binder.nome || '';

    await _caricaCarteBinderAttivo(binder);
    renderBinderContenuto();
    await caricaDesignBinderAttivo(); // copertina + sleeve del binder appena aperto
}

function tornaAllaGrigliaBinders() {
    _binderAttivo = null;
    const wrapDettaglio = document.getElementById('binderDettaglioWrap');
    if (wrapDettaglio) wrapDettaglio.style.display = 'none';
    document.getElementById('bindersContenitoriGrid').style.display = '';
}

// Popola _carteBinderAttivoCache con le carte del binder aperto, forma
// unificata {id, name, immagine, qty, createdAt} qualunque sia il tipo —
// stessa forma già usata dal vecchio renderBinder().
let _carteBinderAttivoCache = [];

async function _caricaCarteBinderAttivo(binder) {
    const userId = await authGetUserId();

    if (binder.tipo === 'location') {
        _carteBinderAttivoCache = carteReali
            .filter(c => c.tabella === 'carte' && c.stato === 'collezione' && c.location === binder.location_valore)
            .map(c => ({ id: c.id, name: c.name || c.nome, immagine: c.immagine, qty: c.qty, createdAt: c.createdAt }));
        return;
    }

    if (binder.tipo === 'wishlist') {
        const { data, error } = await wishlistQueryTutte(userId);
        if (error) { console.error('_caricaCarteBinderAttivo (wishlist):', error.message); _carteBinderAttivoCache = []; return; }
        _carteBinderAttivoCache = (data || []).map(r => ({ id: r.id, name: r.nome, immagine: r.immagine, qty: r.qty, createdAt: r.created_at }));
        return;
    }

    const { data: righe, error } = await binderCarteQuery(userId, binder.id);
    if (error) { console.error('_caricaCarteBinderAttivo (extra):', error.message); _carteBinderAttivoCache = []; return; }
    const idsNelBinder = new Set((righe || []).map(r => String(r.carta_id)));
    _carteBinderAttivoCache = carteReali
        .filter(c => c.tabella === 'carte' && c.stato === 'collezione' && idsNelBinder.has(String(c.id)))
        .map(c => ({ id: c.id, name: c.name || c.nome, immagine: c.immagine, qty: c.qty, createdAt: c.createdAt }));
}

function renderBinderContenuto() {
    const forzaElenco = _carteBinderAttivoCache.length > SOGLIA_BINDER_SOLO_ELENCO;
    const modalitaEffettiva = forzaElenco ? 'elenco' : _binderModalita;

    const avvisoEl = document.getElementById('binderSoglioAvviso');
    if (avvisoEl) {
        avvisoEl.style.display = forzaElenco ? 'block' : 'none';
        if (forzaElenco) avvisoEl.textContent = `Questo binder ha più di ${SOGLIA_BINDER_SOLO_ELENCO} carte: solo la modalità elenco è disponibile qui dentro.`;
    }

    if (modalitaEffettiva === 'elenco') {
        renderBinderElenco();
    } else {
        renderBinderGrigliaImmagini();
    }
}

async function impostaModalitaBinder(modalita) {
    if (modalita !== 'immagini' && modalita !== 'elenco') return;
    _binderModalita = modalita;
    const userId = await authGetUserId();
    if (userId) {
        const { error } = await userSettingsUpsertBinderModalita(userId, modalita);
        if (error) console.error('impostaModalitaBinder:', error.message);
    }
    if (_binderAttivo) renderBinderContenuto();
}

// Adattata dal vecchio renderBinder(): stessa paginazione/layout, ma legge
// da _carteBinderAttivoCache (già filtrato per il binder aperto, qualunque
// tipo) invece che da _idsNelBinder globale. Il bottone "rimuovi" (✕) ha
// senso SOLO per il binder 'extra' (associazione manuale) — per
// location/wishlist rimuovere qui non avrebbe un'azione univoca (andrebbe
// cambiata la location della carta, o cancellata dalla wishlist: azioni
// che vivono già altrove nel sito), quindi resta nascosto per quei due tipi.
function renderBinderGrigliaImmagini() {
    const binder = _bindersElenco.find(b => String(b.id) === String(_binderAttivo));
    const permettiRimozione = binder && binder.tipo === 'extra';

    const griglia = document.getElementById('binderGrid');
    const contenitoreElenco = document.getElementById('binderElencoBody');
    griglia.style.display = '';
    if (contenitoreElenco) contenitoreElenco.style.display = 'none';

    const layout = BINDER_LAYOUTS[_binderLayout] || BINDER_LAYOUTS['3x3'];
    const perPagina = layout.cols * layout.rows;

    const carte = _carteBinderAttivoCache.slice().sort((a, b) => {
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
                    ${permettiRimozione ? `<button type="button" class="binder-slot-remove-btn" title="Rimuovi dal Binder" aria-label="Rimuovi dal Binder" onclick="event.stopPropagation(); rimuoviDalBinderExtra('${idAttr}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
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
        : 'Nessuna carta in questo binder';
    document.getElementById('binderPrevBtn').disabled = _binderPagina <= 0;
    document.getElementById('binderNextBtn').disabled = _binderPagina >= totalePagine - 1;
    document.getElementById('binderEmptyMsg').style.display = carte.length ? 'none' : 'block';
    document.getElementById('binderPagination').style.display = totalePagine > 1 ? 'flex' : 'none';
}

// ── Aggiungi/Rimuovi dal binder extra (bottoni già esistenti in
// Visualizzazione/Wishlist, ui/cards.ui.js) ─────────────────────────────
// Portate dal vecchio binder.ui.js (era il binder singolo, ora è
// specificamente il binder 'extra') — stesso comportamento: azione
// leggera, aggiorna solo _idsNelBinder + i pulsanti a schermo, non
// ricarica tutta la collezione.
async function toggleBinderMembership(id) {
    const card = carteReali.find(c => String(c.id) === String(id));
    if (!card || card.tabella !== 'carte' || card.stato !== 'collezione') return;
    if (!_binderExtraId) { console.error('toggleBinderMembership: binder extra non ancora pronto'); return; }

    const giaNelBinder = _idsNelBinder.has(String(id));
    if (giaNelBinder) {
        if (!confirm(`Rimuovere "${card.name}" dal tuo binder personale?`)) return;
    }

    const userId = await authGetUserId();
    if (!userId) return;

    if (giaNelBinder) {
        const { error } = await binderCarteDeleteOne(userId, _binderExtraId, id);
        if (error) { alert('❌ Errore nel rimuovere la carta dal Binder: ' + error.message); return; }
        _idsNelBinder.delete(String(id));
    } else {
        const { error } = await binderCarteInsert({ owner_id: userId, binder_id: _binderExtraId, carta_id: id });
        if (error) { alert('❌ Errore nell\'aggiungere la carta al Binder: ' + error.message); return; }
        _idsNelBinder.add(String(id));
    }

    _aggiornaBottoniBinderToggle(id);

    // Se in questo momento è aperto proprio il binder extra nel widget
    // Binders, la lista in memoria (_carteBinderAttivoCache) è ora
    // disallineata — la ricarico solo in quel caso specifico, non ad ogni
    // toggle (che parte quasi sempre da Visualizzazione, non da qui).
    const binderAperto = _bindersElenco.find(b => String(b.id) === String(_binderAttivo));
    if (binderAperto && binderAperto.tipo === 'extra') {
        await _caricaCarteBinderAttivo(binderAperto);
        renderBinderContenuto();
    }
}

function _aggiornaBottoniBinderToggle(id) {
    const idAttr = String(id);
    const nelBinder = _idsNelBinder.has(idAttr);
    document.querySelectorAll(`.btn-binder-toggle[data-id="${idAttr}"]`).forEach((btn) => {
        btn.innerHTML = nelBinder
            ? '<i class="fa-solid fa-layer-group"></i> Rimuovi dal Binder'
            : '<i class="fa-solid fa-layer-group"></i> Aggiungi al Binder';
        btn.classList.remove('binder-toggle-flash');
        void btn.offsetWidth;
        btn.classList.add('binder-toggle-flash');
        setTimeout(() => btn.classList.remove('binder-toggle-flash'), 600);
    });
}

// Rimozione diretta dallo slot pieno nella griglia immagini del binder
// extra (bottone ✕ su ogni slot, vedi renderBinderGrigliaImmagini).
async function rimuoviDalBinderExtra(cartaId) {
    await toggleBinderMembership(cartaId);
}


// ── Modalità elenco (parallela a renderViewTable di Visualizzazione, non
// la stessa funzione — vedi nota) ────────────────────────────────────────
// renderViewTable() in ui/cards.ui.js scrive dentro id fissi della pagina
// Visualizzazione (#viewTableBody, #tableHeaderRow, #stat-count...) — sono
// GLI STESSI elementi della tab Visualizzazione, non se ne possono avere
// due copie nel DOM con lo stesso id. Richiamarla da qui scriverebbe nella
// tabella di Visualizzazione, non in quella del Binder. Questa è quindi
// un'implementazione parallela con lo STESSO stile visivo della vista
// compatta (_rigaCompattaHtml), su un contenitore proprio del Binder
// (#binderElencoBody) — stessi campi, stessa occhiata, DOM separato.
// Se in futuro renderViewTable() viene generalizzata per accettare un
// contenitore target, questa funzione può sparire in favore di quella.
function renderBinderElenco() {
    const contenitore = document.getElementById('binderElencoBody');
    const binderGridEl = document.getElementById('binderGrid');
    if (!contenitore) { console.error('renderBinderElenco: manca #binderElencoBody in index.html'); return; }
    if (binderGridEl) binderGridEl.style.display = 'none';
    contenitore.style.display = '';

    const binder = _bindersElenco.find(b => String(b.id) === String(_binderAttivo));
    const permettiRimozione = binder && binder.tipo === 'extra';

    if (_carteBinderAttivoCache.length === 0) {
        contenitore.innerHTML = '<div class="stato-vuoto"><i class="fa-solid fa-layer-group"></i><br>Nessuna carta in questo binder.</div>';
        document.getElementById('binderPagination').style.display = 'none';
        return;
    }

    const carte = _carteBinderAttivoCache.slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    contenitore.innerHTML = carte.map(card => {
        const idAttr = String(card.id).replace(/'/g, "\\'");
        const nomeAttr = escapeHtml(card.name || '');
        const immagineSrc = _urlImmagineVisualizzabile(card.immagine);
        const thumb = immagineSrc
            ? `<img src="${immagineSrc}" alt="" class="riga-compatta-thumb" loading="lazy" onclick="apriImmagineIngrandita('${idAttr}')" onerror="this.style.display='none';">`
            : '';
        return `
            <div class="riga-compatta">
                <div class="riga-compatta-top">
                    ${thumb}
                    <span class="riga-compatta-nome">
                        <span class="riga-compatta-nome-testo">${nomeAttr}</span>
                    </span>
                    ${card.qty > 1 ? `<span class="riga-compatta-prezzo">×${card.qty}</span>` : ''}
                    ${permettiRimozione ? `<button class="riga-compatta-menu-btn" onclick="rimuoviDalBinderExtra('${idAttr}')" title="Rimuovi dal Binder"><i class="fa-solid fa-xmark"></i></button>` : ''}
                </div>
            </div>`;
    }).join('');

    document.getElementById('binderPagination').style.display = 'none';
    document.getElementById('binderEmptyMsg').style.display = 'none';
}

function binderPaginaAvanti() {
    _binderPagina++;
    renderBinderContenuto();
}
function binderPaginaIndietro() {
    _binderPagina--;
    renderBinderContenuto();
}
function cambiaLayoutBinder(layout) {
    if (!BINDER_LAYOUTS[layout]) return;
    _binderLayout = layout;
    prefBinderLayoutSet(layout);
    renderBinderContenuto();
}


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
    await caricaCopertinaBinderAttivoStato();
    await caricaSleeveBinderAttivoStato();
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
