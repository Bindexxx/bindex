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
// - Modalità "elenco testuale": deve essere IDENTICA alla vista
//   Visualizzazione attuale — serve ui/cards.ui.js per copiarla esatta
//   invece di indovinarla. renderBinderElenco() sotto è uno STUB minimo,
//   solo per non lasciare la UI rotta nel frattempo.
// - Editor sleeve/retro-carta per-binder (drag/resize dei campi
//   pokemon/condition/variazione/price): la versione precedente di questo
//   file lo aveva per l'unico Binder globale — va riportato qui adattato a
//   binder_id, prossimo passo dedicato.
// - Effetto "libro sfogliabile" con piega di pagina: DELIBERATAMENTE non
//   qui, lo farà una sessione con Opus (vedi file di handoff quando ci
//   arriviamo). Il click su una carta apre per ora la stessa immagine
//   ingrandita di sempre (apriImmagineIngrandita), non un libro.
// - "Aggiungi ANCHE al binder X" sulla riga carta in Visualizzazione: tocca
//   ui/cards.ui.js, non questo file — prossimo passo.
// - Pubblicazione binder sotto approvazione admin: solo colonne DB pronte
//   (vedi 17_binders_multipli.sql), nessuna UI admin qui.


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

// STUB — vedi blocco di commenti in cima al file. Non è la vista finale,
// solo per non lasciare la modalità elenco/soglia-1088 completamente rotta
// nel frattempo.
function renderBinderElenco() {
    const griglia = document.getElementById('binderGrid');
    if (!griglia) return;
    griglia.className = 'binder-grid-elenco-stub';
    griglia.innerHTML = `
        <div class="stato-vuoto" style="grid-column:1/-1;">
            <i class="fa-solid fa-list"></i><br>
            Modalità elenco in arrivo (in attesa di ui/cards.ui.js per riusarla identica a Visualizzazione).<br>
            <small>${_carteBinderAttivoCache.length} carte in questo binder.</small>
        </div>`;
    document.getElementById('binderPagination').style.display = 'none';
    document.getElementById('binderEmptyMsg').style.display = 'none';
}

async function rimuoviDalBinderExtra(cartaId) {
    const binder = _bindersElenco.find(b => String(b.id) === String(_binderAttivo));
    if (!binder || binder.tipo !== 'extra') return;
    const userId = await authGetUserId();
    const { error } = await binderCarteDeleteOne(userId, binder.id, cartaId);
    if (error) { console.error('rimuoviDalBinderExtra:', error.message); return; }
    _carteBinderAttivoCache = _carteBinderAttivoCache.filter(c => String(c.id) !== String(cartaId));
    renderBinderContenuto();
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


// ── "Design" — copertina personalizzata per-binder ───────────────────────
// Porta dello stesso meccanismo già esistente (upload → conversione PNG →
// stato 'pending' → richiesta di moderazione) ma con path/slot agganciati
// al binder aperto (_binderAttivo) invece che unici per utente. La
// pipeline di conversione HEIC→PNG viveva nel vecchio binder.ui.js in un
// punto che non ho ancora letto per intero — vedi TODO in cima al file, la
// porto nel prossimo passo insieme all'editor sleeve. Questa funzione
// presume che 'pngBlob' arrivi già pronto da quella pipeline.
async function caricaCopertinaBinderAttivo(pngBlob) {
    const userId = await authGetUserId();
    const binder = _bindersElenco.find(b => String(b.id) === String(_binderAttivo));
    if (!userId || !binder) return { error: new Error('Binder non attivo') };

    const path = `${userId}/${binder.id}/binder_cover`;
    const { error: errUpload } = await storageUploadUserMedia(path, pngBlob);
    if (errUpload) return { error: errUpload };

    const { data: mediaRow, error: errUpsert } = await userMediaUpsertELeggi({
        user_id: userId,
        binder_id: binder.id,
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

    _coperturaBinderCache.delete(binder.id); // forza ri-risoluzione al prossimo render della griglia
    return { error: null };
}

async function selezionaCopertinaDefaultBinderAttivo(filename) {
    const userId = await authGetUserId();
    const binder = _bindersElenco.find(b => String(b.id) === String(_binderAttivo));
    if (!userId || !binder) return { error: new Error('Binder non attivo') };

    const { error } = await userMediaUpsert({
        user_id: userId,
        binder_id: binder.id,
        slot: 'binder_cover',
        storage_path: `binder_cover/${filename}`,
        source: 'default',
        status: 'approved',
        admin_note: null,
        reviewed_at: null,
        reviewed_by: null,
    });
    if (error) return { error };

    _coperturaBinderCache.delete(binder.id);
    return { error: null };
}
