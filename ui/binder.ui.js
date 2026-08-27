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

    // Fix 26/08/2026: layout per-binder, non più preferenza globale per
    // dispositivo (vedi 25_binder_layout_per_binder.sql). binder.layout
    // arriva già valorizzato da bindersQueryTutti (select('*')).
    _binderLayout = BINDER_LAYOUTS[binder.layout] ? binder.layout : '3x3';

    const titoloEl = document.getElementById('binderDettaglioTitolo');
    if (titoloEl) titoloEl.textContent = binder.nome || '';

    if (binder.tipo === 'extra') {
        const inputRinomina = document.getElementById('binderRinominaInput');
        if (inputRinomina) inputRinomina.value = binder.nome || '';
    }

    _aggiornaControlliRinominaPubblicazioneCondivisione(binder);

    await _caricaCarteBinderAttivo(binder);
    renderBinderContenuto();
    await caricaDesignBinderAttivo(); // copertina + sleeve del binder appena aperto
}

// Rinomina: solo tipo 'extra'. Pubblicazione libera (2026-08-25): solo
// location diverse da SCAMBIO, e 'extra' — Wishlist/Scambio sono sempre
// pubblici (forzato dal trigger DB), il controllo lì sarebbe fuorviante.
// Condivisione: mostrata SOLO se il binder è pubblico E ha una pagina
// pubblica reale (Wishlist, Scambio — vedi _paginaPubblicaBinderAttivo in
// ui/navigation.ui.js). Per gli altri tipi non esiste ancora una pagina
// pubblica generica: mostrare i bottoni produrrebbe un link rotto, si
// mostra invece una nota. Fattorizzata qui perché va rieseguita anche
// subito dopo il toggle pubblicazione, non solo all'apertura del binder.
function _aggiornaControlliRinominaPubblicazioneCondivisione(binder) {
    const rinominaWrap = document.getElementById('binderRinominaWrap');
    // TEMPORANEO (Claudio, 26/08/2026): bypass disattivato, consolidato su
    // approvazione admin per QUALUNQUE tipo di binder (era doppio
    // meccanismo, mai unificato — vedi compilato). rinominaBinderExtraCorrente()
    // e binderExtraRinomina() (data/binder.repository.js) restano definite
    // e intatte, solo irraggiungibili dall'UI — rollback a una riga se
    // serve. Bloccato anche lato DB, non solo qui: vedi trigger
    // trg_binders_blocca_rinomina_diretta in 26_binder_nome_blocco_diretto.sql.
    if (rinominaWrap) rinominaWrap.style.display = 'none';

    const eGiaPubblicoFisso = binder.tipo === 'wishlist' || (binder.tipo === 'location' && binder.location_valore === 'SCAMBIO');
    const pubblicazioneWrap = document.getElementById('binderPubblicazioneWrap');
    if (pubblicazioneWrap) {
        pubblicazioneWrap.style.display = eGiaPubblicoFisso ? 'none' : 'flex';
        const checkbox = document.getElementById('binderPubblicazioneCheckbox');
        if (checkbox) checkbox.checked = binder.stato_pubblicazione === 'pubblico';
    }

    const haPaginaPubblica = true; // Multi-Binder + 22_binder_pubblico_generico.sql: ogni tipo ha ormai una pagina (dedicata o generica)
    const ePubblico = binder.stato_pubblicazione === 'pubblico';

    const condivisioneWrap = document.getElementById('binderCondivisioneWrap');
    if (condivisioneWrap) condivisioneWrap.style.display = (ePubblico && haPaginaPubblica) ? 'flex' : 'none';

    const condivisioneNonDisponibileWrap = document.getElementById('binderCondivisioneNonDisponibileWrap');
    if (condivisioneNonDisponibileWrap) condivisioneNonDisponibileWrap.style.display = 'none'; // non serve più, ogni binder pubblico è condivisibile
}

// Pubblicazione libera (2026-08-25) — nessuna approvazione admin, vedi
// 19_binder_pubblicazione_libera.sql. Il trigger DB ignora comunque questo
// update per wishlist/SCAMBIO (sempre pubblici), ma la UI non mostra il
// controllo su quei due tipi (vedi sopra), quindi in pratica questa
// funzione viene chiamata solo dove ha davvero effetto.
async function impostaPubblicazioneBinderAttivo(pubblico) {
    const binder = _bindersElenco.find(b => String(b.id) === String(_binderAttivo));
    if (!binder) return;

    const userId = await authGetUserId();
    if (!userId) return;

    const { error } = await binderImpostaPubblicazione(userId, binder.id, pubblico);
    if (error) {
        console.error('impostaPubblicazioneBinderAttivo:', error.message);
        const checkbox = document.getElementById('binderPubblicazioneCheckbox');
        if (checkbox) checkbox.checked = !pubblico; // rollback visivo se la scrittura fallisce
        return;
    }
    binder.stato_pubblicazione = pubblico ? 'pubblico' : 'privato';
    binder.condivisibile = pubblico;
    _aggiornaControlliRinominaPubblicazioneCondivisione(binder);
}

function tornaAllaGrigliaBinders() {
    _binderAttivo = null;
    _libroSmonta(); // OPUS 2026-08-25: libera ResizeObserver e handler del libro
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

    // Il selettore layout (2×2/3×3/4×3/4×4) ha senso solo in modalità
    // immagini — il libro lo usa ancora per decidere quante tasche per
    // pagina (scelta di Opus), l'elenco non ha nessuna paginazione a
    // griglia. Nascosto qui, non serve toccare ogni singolo bottone.
    const layoutSwitcher = document.querySelector('.binder-layout-switcher');
    if (layoutSwitcher) layoutSwitcher.style.display = modalitaEffettiva === 'elenco' ? 'none' : 'flex';

    if (modalitaEffettiva === 'elenco') {
        renderBinderElenco();
    } else {
        // OPUS 2026-08-25: la modalità immagini ora è il libro sfogliabile.
        // renderBinderGrigliaImmagini() resta più sotto, intatta ma non più
        // referenziata: è il rollback a una riga se il libro va tolto in
        // fretta (si rimette qui il vecchio nome e non serve altro).
        renderBinderLibro();
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

    // Nome vero del binder extra se già noto in questa sessione (il widget
    // Binders potrebbe non essere mai stato aperto — _bindersElenco resta
    // vuoto in quel caso, e va bene così, si usa il testo generico).
    const binderExtra = Array.isArray(_bindersElenco) ? _bindersElenco.find(b => String(b.id) === String(_binderExtraId)) : null;
    const nomeBinder = binderExtra && binderExtra.nome ? escapeHtml(binderExtra.nome) : 'Binder';

    document.querySelectorAll(`.btn-binder-toggle[data-id="${idAttr}"]`).forEach((btn) => {
        btn.innerHTML = nelBinder
            ? `<i class="fa-solid fa-layer-group"></i> Rimuovi da "${nomeBinder}"`
            : `<i class="fa-solid fa-layer-group"></i> Aggiungi a "${nomeBinder}"`;
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
    _libroSmonta(); // OPUS 2026-08-25: elenco e libro non convivono mai
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
        const idBinderAttr = String(_binderAttivo).replace(/'/g, "\\'");
        const nomeAttr = escapeHtml(card.name || '');
        const immagineSrc = _urlImmagineVisualizzabile(card.immagine);
        // Coerenza col libro (sessione Opus, 2026-08-25): passa direttamente
        // a apriFlipCardHome con il binderId, non a apriImmagineIngrandita
        // (che non accetta il parametro) — così anche in modalità elenco si
        // vede la sleeve del binder corrente, non il retro di sistema.
        const thumb = immagineSrc
            ? `<img src="${immagineSrc}" alt="" class="riga-compatta-thumb" loading="lazy" onclick="apriFlipCardHome('${idAttr}', { binderId: '${idBinderAttr}' })" onerror="this.style.display='none';">`
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

// OPUS 2026-08-25: le due frecce esistenti (#binderPrevBtn/#binderNextBtn in
// index.html) ora pilotano il giro ANIMATO quando il libro è a schermo,
// invece di ridisegnare tutto di colpo. Senza libro montato il comportamento
// resta identico a prima, riga per riga.
function binderPaginaAvanti() {
    if (_libro) { _libroGira(1); return; }
    _binderPagina++;
    renderBinderContenuto();
}
function binderPaginaIndietro() {
    if (_libro) { _libroGira(-1); return; }
    _binderPagina--;
    renderBinderContenuto();
}
// Fix 26/08/2026: il layout è ora per-binder, salvato su DB (vedi
// 25_binder_layout_per_binder.sql) — non più prefBinderLayoutSet
// (localStorage globale per dispositivo). Update ottimistico: la UI si
// ridisegna subito, un eventuale errore di rete viene solo loggato (stesso
// pattern soft-fail già usato per la copertina) — non vale la pena
// bloccare l'utente per un fallimento di scrittura su un cambio di layout.
async function cambiaLayoutBinder(layout) {
    if (!BINDER_LAYOUTS[layout]) return;
    _binderLayout = layout;
    renderBinderContenuto();
    const userId = await authGetUserId();
    if (!userId) return;
    const { error } = await binderAggiornaLayout(userId, _binderAttivo, layout);
    if (error) console.error('Errore nel salvare il layout del binder:', error.message);
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


// ══════════════════════════════════════════════════════════════════════════
// LIBRO SFOGLIABILE — sessione Opus, 2026-08-25
// ══════════════════════════════════════════════════════════════════════════
// Sostituisce renderBinderGrigliaImmagini() come modalità "immagini" (quella
// resta sopra, intatta e non referenziata: rollback a una riga).
//
// MODELLO — un libro vero è fatto di FOGLI, non di pagine: ogni foglio ha una
// faccia davanti e una dietro, e girandolo si vedono le carte SUCCESSIVE, non
// il retro delle stesse carte. Qui:
//   faccia 0         = copertina del binder
//   faccia 1         = risguardo (interno copertina, vuoto) — SOLO in modalità
//                      doppia, dove serve a far cadere pagina 1 a destra come
//                      in un libro vero
//   facce successive = pagine di carte, cols×rows tasche ciascuna
//
//   modalità singola (schermo stretto): foglio j = {fronte: F[j], retro: F[j+1]}
//     fogli "virtuali" sovrapposti — legittimo perché non si vedono mai le due
//     facce dello stesso foglio insieme. _libro.k = indice della faccia a video.
//   modalità doppia (>= LIBRO_SOGLIA_DOPPIA_PX): foglio j = {F[2j], F[2j+1]}
//     _libro.k = numero di fogli già girati; sinistra = F[2k-1], destra = F[2k].
//
// ANIMAZIONE — cerniera 3D rigida (rotateY attorno al dorso) con ombra che
// segue l'angolo: è quello che fanno anyflip/turn.js in HTML. La curvatura
// della carta è SIMULATA con la luce, non con la geometria: una piega
// davvero deformabile richiede canvas/WebGL.
//
// La sleeve NON compare qui dentro: si vede solo cliccando una carta, che la
// porta in primo piano e la gira col meccanismo già esistente
// (apriFlipCardHome) — decisione di Claudio, 2026-08-25.

const LIBRO_SOGLIA_DOPPIA_PX = 620;   // sotto questa larghezza: una facciata alla volta
const LIBRO_DURATA_GIRO_MS = 620;     // deve combaciare con la transition in index.html
const LIBRO_SOGLIA_DRAG_PX = 8;       // oltre questa distanza è un trascinamento, non un tap
const LIBRO_PAD_PAGINA = 10;
const LIBRO_GAP_TASCHE = 6;
const LIBRO_ALTEZZA_NUMERO = 16;

let _libro = null;          // stato del libro montato (null = nessun libro)
let _libroObserver = null;  // ResizeObserver sul wrap


// ── Montaggio / smontaggio ──────────────────────────────────────────────
function renderBinderLibro() {
    const wrap = document.getElementById('binderLibroWrap');
    if (!wrap) { console.error('renderBinderLibro: manca #binderLibroWrap in index.html'); return; }

    const griglia = document.getElementById('binderGrid');
    const elenco = document.getElementById('binderElencoBody');
    if (griglia) griglia.style.display = 'none';
    if (elenco) elenco.style.display = 'none';
    wrap.style.display = 'block';

    const binder = _bindersElenco.find(b => String(b.id) === String(_binderAttivo));
    const layout = BINDER_LAYOUTS[_binderLayout] || BINDER_LAYOUTS['3x3'];

    // Stesso ordinamento della griglia di prima (per data di inserimento).
    const carte = _carteBinderAttivoCache.slice().sort((a, b) => {
        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return da - db;
    });

    // Se si sta ridisegnando lo STESSO binder (es. dopo una rimozione dal
    // binder extra, o un cambio di layout) la copertina è già risolta e la
    // pagina corrente va conservata. Se invece è un binder appena aperto, il
    // libro parte SEMPRE dalla copertina, chiuso.
    const stessoBinder = !!(_libro && String(_libro.binderId) === String(_binderAttivo));
    const copertinaPrecedente = stessoBinder ? _libro.copertinaUrl : null;

    _libro = {
        binderId: _binderAttivo,
        binder,
        permettiRimozione: !!(binder && binder.tipo === 'extra'),
        carte,
        cols: layout.cols,
        rows: layout.rows,
        perPagina: layout.cols * layout.rows,
        totalePagine: Math.max(1, Math.ceil(carte.length / (layout.cols * layout.rows))),
        copertinaUrl: copertinaPrecedente,
        modo: 'singola',
        facce: [],
        k: 0,
        pw: 0,
        ph: 0,
        animando: false,
        drag: null,
        dragMosso: false,
    };

    document.querySelectorAll('.binder-layout-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.layout === _binderLayout);
    });

    _libroMisura();                        // decide modo (singola/doppia) e dimensioni
    _libro.facce = _libroCostruisciFacce();
    _libro.k = stessoBinder ? _libroKDaPagina(_binderPagina) : 0; // binder nuovo → copertina
    _libroDisegnaStatico();
    _libroInitGesti();
    _libroOsservaResize();

    // La copertina arriva da una signed URL: risolta a parte, senza bloccare
    // il disegno del libro (che è già a schermo). _risolviCopertinaBinder ha
    // già la sua cache, quindi dalla seconda apertura in poi è immediata.
    if (binder && !_libro.copertinaUrl) {
        authGetUserId()
            .then(userId => userId ? _risolviCopertinaBinder(userId, binder) : null)
            .then(url => {
                if (!url || !_libro || String(_libro.binderId) !== String(binder.id)) return; // binder cambiato nel frattempo
                _libro.copertinaUrl = url;
                if (!_libro.animando) _libroDisegnaStatico();
            })
            .catch(e => console.error('renderBinderLibro (copertina):', e));
    }
}


function _libroSmonta() {
    if (_libroObserver) { _libroObserver.disconnect(); _libroObserver = null; }
    _libro = null;
    const wrap = document.getElementById('binderLibroWrap');
    if (wrap) wrap.style.display = 'none';
}


function _libroOsservaResize() {
    if (_libroObserver || typeof ResizeObserver === 'undefined') return;
    const wrap = document.getElementById('binderLibroWrap');
    if (!wrap) return;
    // La cornice del telefono riposiziona .container in px al resize/rotazione
    // (_posizionaContainerNelloSchermo in ui/phone.ui.js): osservare il wrap
    // intercetta sia quello sia qualunque altro cambio di larghezza, senza
    // dipendere da phone.ui.js né da @media sulla finestra.
    _libroObserver = new ResizeObserver(() => {
        if (!_libro || _libro.animando) return;
        const modoPrima = _libro.modo;
        const paginaCorrente = _libroPaginaCorrente();
        _libroMisura();
        if (_libro.modo !== modoPrima) {
            // Cambiando impaginazione cambia anche l'indicizzazione delle
            // facce: si ricostruisce e si torna sulla stessa pagina di carte.
            _libro.facce = _libroCostruisciFacce();
            _libro.k = _libroKDaPagina(paginaCorrente);
        }
        _libroDisegnaStatico();
    });
    _libroObserver.observe(wrap);
}


// ── Geometria ───────────────────────────────────────────────────────────
function _libroMisura() {
    const wrap = document.getElementById('binderLibroWrap');
    const disponibile = (wrap && wrap.clientWidth) ? wrap.clientWidth : 320;
    _libro.modo = disponibile >= LIBRO_SOGLIA_DOPPIA_PX ? 'doppia' : 'singola';

    const cols = _libro.cols, rows = _libro.rows;
    let pw = _libro.modo === 'doppia' ? Math.floor(disponibile / 2) : disponibile;

    // Altezza derivata dalle tasche (63/88, stesso rapporto di .binder-slot),
    // non da un aspect-ratio inventato: così le carte non vengono mai
    // schiacciate né restano bande vuote in fondo alla pagina.
    const altezzaDaLarghezza = (larghezza) => {
        const slotW = (larghezza - 2 * LIBRO_PAD_PAGINA - (cols - 1) * LIBRO_GAP_TASCHE) / cols;
        const slotH = slotW * 88 / 63;
        return Math.round(rows * slotH + (rows - 1) * LIBRO_GAP_TASCHE + 2 * LIBRO_PAD_PAGINA + LIBRO_ALTEZZA_NUMERO);
    };

    let ph = altezzaDaLarghezza(pw);

    // Tetto in altezza: dentro la cornice telefono lo spazio verticale è
    // quello di .container in px reali, non quello della finestra del browser.
    const contenitore = document.querySelector('.container');
    const altezzaUtile = (contenitore && contenitore.clientHeight) ? contenitore.clientHeight : window.innerHeight;
    const maxH = Math.max(240, Math.round(altezzaUtile * 0.62));

    if (ph > maxH) {
        const slotH = (maxH - 2 * LIBRO_PAD_PAGINA - LIBRO_ALTEZZA_NUMERO - (rows - 1) * LIBRO_GAP_TASCHE) / rows;
        const slotW = Math.max(18, slotH * 63 / 88);
        pw = Math.round(cols * slotW + (cols - 1) * LIBRO_GAP_TASCHE + 2 * LIBRO_PAD_PAGINA);
        ph = maxH;
    }

    _libro.pw = Math.max(120, Math.round(pw));
    _libro.ph = Math.max(160, Math.round(ph));
}


// ── Facce e fogli ───────────────────────────────────────────────────────
function _libroCostruisciFacce() {
    const facce = [{ t: 'copertina' }];
    // Il risguardo esiste solo in modalità doppia: serve a far finire pagina 1
    // a DESTRA appena si apre la copertina, come in un libro vero. In modalità
    // singola sarebbe solo una schermata vuota da saltare.
    if (_libro.modo === 'doppia') facce.push({ t: 'risguardo' });
    for (let i = 0; i < _libro.totalePagine; i++) facce.push({ t: 'pagina', i });
    // In doppia i fogli sono coppie di facce: ne serve un numero pari.
    if (_libro.modo === 'doppia' && facce.length % 2 !== 0) facce.push({ t: 'risguardo' });
    return facce;
}

function _libroNumFogli() {
    return _libro.modo === 'doppia' ? _libro.facce.length / 2 : _libro.facce.length - 1;
}

function _libroFronteFoglio(j) {
    return _libro.modo === 'doppia' ? _libro.facce[2 * j] : _libro.facce[j];
}

function _libroRetroFoglio(j) {
    return _libro.modo === 'doppia' ? _libro.facce[2 * j + 1] : _libro.facce[j + 1];
}

function _libroFacciaSinistraPer(k) {
    if (_libro.modo !== 'doppia') return null;
    return k > 0 ? _libro.facce[2 * k - 1] : null;
}

function _libroFacciaDestraPer(k) {
    if (_libro.modo === 'doppia') return k < _libroNumFogli() ? _libro.facce[2 * k] : null;
    return _libro.facce[k] || null;
}

function _libroPuoAvanti() {
    return _libro.k < _libroNumFogli();
}

function _libroPuoIndietro() {
    return _libro.k > 0;
}

// Indice della pagina di carte attualmente in vista — serve a tenere allineato
// _binderPagina, che è stato condiviso col resto del sito (lo legge anche
// vaiAllaCartaNelBinder in ui/home.ui.js).
function _libroPaginaCorrente() {
    const destra = _libroFacciaDestraPer(_libro.k);
    if (destra && destra.t === 'pagina') return destra.i;
    const sinistra = _libroFacciaSinistraPer(_libro.k);
    if (sinistra && sinistra.t === 'pagina') return sinistra.i;
    return 0;
}

// Inverso: da indice di pagina a numero di fogli girati.
function _libroKDaPagina(pagina) {
    const p = Math.max(0, Math.min(Number(pagina) || 0, _libro.totalePagine - 1));
    const k = _libro.modo === 'doppia' ? Math.ceil((p + 2) / 2) : p + 1;
    return Math.max(0, Math.min(k, _libroNumFogli()));
}


// ── Disegno ─────────────────────────────────────────────────────────────
function _libroDisegnaStatico() {
    const scena = document.getElementById('binderLibroScena');
    const sx = document.getElementById('binderLibroSx');
    const dx = document.getElementById('binderLibroDx');
    const foglio = document.getElementById('binderLibroFoglio');
    if (!scena || !sx || !dx || !foglio) return;

    const pw = _libro.pw, ph = _libro.ph;
    scena.classList.toggle('libro-modo-doppia', _libro.modo === 'doppia');
    scena.classList.toggle('libro-modo-singola', _libro.modo === 'singola');
    scena.style.width = (_libro.modo === 'doppia' ? pw * 2 : pw) + 'px';
    scena.style.height = ph + 'px';

    [sx, dx, foglio].forEach(el => { el.style.width = pw + 'px'; el.style.height = ph + 'px'; });
    sx.style.display = _libro.modo === 'doppia' ? 'block' : 'none';
    dx.style.left = (_libro.modo === 'doppia' ? pw : 0) + 'px';
    foglio.style.left = (_libro.modo === 'doppia' ? pw : 0) + 'px';
    foglio.style.display = 'none';

    const facciaSx = _libroFacciaSinistraPer(_libro.k);
    const facciaDx = _libroFacciaDestraPer(_libro.k);
    sx.innerHTML = _libroHtmlFaccia(facciaSx);
    dx.innerHTML = _libroHtmlFaccia(facciaDx);
    sx.classList.toggle('libro-lato-spento', !facciaSx);
    dx.classList.toggle('libro-lato-spento', !facciaDx);

    _binderPagina = _libroPaginaCorrente();
    _libroSincronizzaEtichette();
}


function _libroSincronizzaEtichette() {
    const label = document.getElementById('binderPaginaLabel');
    const prev = document.getElementById('binderPrevBtn');
    const next = document.getElementById('binderNextBtn');
    const vuoto = document.getElementById('binderEmptyMsg');
    const paginazione = document.getElementById('binderPagination');

    if (label) {
        const facciaDx = _libroFacciaDestraPer(_libro.k);
        const facciaSx = _libroFacciaSinistraPer(_libro.k);
        if (_libro.carte.length === 0) {
            label.textContent = 'Binder vuoto';
        } else if (facciaDx && facciaDx.t === 'copertina') {
            label.textContent = 'Copertina';
        } else {
            const numeri = [facciaSx, facciaDx].filter(f => f && f.t === 'pagina').map(f => f.i + 1);
            label.textContent = numeri.length
                ? `Pagin${numeri.length > 1 ? 'e' : 'a'} ${numeri.join('-')} di ${_libro.totalePagine}`
                : `— di ${_libro.totalePagine}`;
        }
    }
    if (prev) prev.disabled = !_libroPuoIndietro();
    if (next) next.disabled = !_libroPuoAvanti();
    // Il libro mostra già le tasche vuote e scrive "Binder vuoto"
    // nell'etichetta: il messaggio separato sarebbe ridondante.
    if (vuoto) vuoto.style.display = 'none';
    if (paginazione) paginazione.style.display = 'flex';
}


function _libroHtmlFaccia(faccia) {
    if (!faccia) return '';
    if (faccia.t === 'copertina') return _libroHtmlCopertina();
    if (faccia.t === 'pagina') return _libroHtmlPagina(faccia.i);
    return '<div class="libro-risguardo"></div>';
}


function _libroHtmlCopertina() {
    const binder = _libro.binder;
    const nome = escapeHtml(binder ? (binder.nome || '') : '');
    const icona = _iconaFallbackBinder(binder ? binder.tipo : 'location');
    const immagine = _libro.copertinaUrl
        ? `<img src="${_libro.copertinaUrl}" alt="${nome}" onerror="this.remove();">`
        : `<i class="fa-solid ${icona}"></i>`;
    return `
        <div class="libro-copertina">
            ${immagine}
            <div class="libro-copertina-etichetta">${nome}</div>
        </div>`;
}


function _libroHtmlPagina(indicePagina) {
    const inizio = indicePagina * _libro.perPagina;
    const carteQuestaPagina = _libro.carte.slice(inizio, inizio + _libro.perPagina);

    let tasche = '';
    for (let i = 0; i < _libro.perPagina; i++) {
        const card = carteQuestaPagina[i];
        if (!card) {
            tasche += '<div class="binder-slot binder-slot-empty"><i class="fa-solid fa-layer-group"></i></div>';
            continue;
        }
        const idAttr = String(card.id).replace(/'/g, "\\'");
        const nomeAttr = (card.name || '').replace(/"/g, '&quot;');
        const immagineSrc = _urlImmagineVisualizzabile(card.immagine, 300);
        tasche += `
            <div class="binder-slot binder-slot-filled" onclick="_libroClickCarta('${idAttr}')" title="${nomeAttr}">
                ${_libro.permettiRimozione ? `<button type="button" class="binder-slot-remove-btn" title="Rimuovi dal Binder" aria-label="Rimuovi dal Binder" onclick="event.stopPropagation(); rimuoviDalBinderExtra('${idAttr}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
                <div class="binder-slot-fallback"><i class="fa-solid fa-image"></i><span>${nomeAttr}</span></div>
                ${immagineSrc ? `<img src="${immagineSrc}" alt="${nomeAttr}" loading="lazy" draggable="false" onerror="this.remove();">` : ''}
                ${card.qty > 1 ? `<span class="binder-slot-qty-badge" title="Hai ${card.qty} copie di questa carta — occupano un solo slot">×${card.qty}</span>` : ''}
            </div>`;
    }

    return `
        <div class="libro-pagina-griglia" style="grid-template-columns: repeat(${_libro.cols}, 1fr);">${tasche}</div>
        <div class="libro-pagina-numero">${indicePagina + 1}</div>`;
}


// Click su una carta: stesso flip-modal del resto del sito, ma con il binder
// corrente (per la sleeve giusta sul retro) e senza il bottone "Vai al
// binder" — sei già dentro il binder. Ignora il click se l'utente stava in
// realtà trascinando per girare pagina.
function _libroClickCarta(id) {
    if (_libro && _libro.dragMosso) { _libro.dragMosso = false; return; }
    apriFlipCardHome(id, { binderId: _binderAttivo, nascondiVaiAlBinder: true });
}


// ── Giro pagina: animazione e trascinamento ─────────────────────────────
// Il foglio ruota attorno al dorso (transform-origin sul lato sinistro): in
// avanti 0° → -180°, all'indietro -180° → 0°. La faccia "retro" è già ruotata
// di 180° in CSS, quindi a fine giro si legge dritta e atterra esattamente
// sulla pagina di sinistra (in modalità singola esce dal riquadro e viene
// tagliata: è il comportamento voluto, si vede la pagina entrare dal bordo).
function _libroPreparaFoglio(j, direzione) {
    const foglio = document.getElementById('binderLibroFoglio');
    const fronte = document.getElementById('binderLibroFronte');
    const retro = document.getElementById('binderLibroRetro');
    const sx = document.getElementById('binderLibroSx');
    const dx = document.getElementById('binderLibroDx');
    if (!foglio || !fronte || !retro || !sx || !dx) return;

    fronte.innerHTML = _libroHtmlFaccia(_libroFronteFoglio(j));
    retro.innerHTML = _libroHtmlFaccia(_libroRetroFoglio(j));

    // La pagina che verrà scoperta va disegnata SOTTO il foglio già adesso,
    // altrimenti a metà rotazione si vedrebbe il vuoto.
    if (direzione > 0) {
        const nuovaDestra = _libroFacciaDestraPer(_libro.k + 1);
        dx.innerHTML = _libroHtmlFaccia(nuovaDestra);
        dx.classList.toggle('libro-lato-spento', !nuovaDestra);
    } else {
        const nuovaSinistra = _libroFacciaSinistraPer(_libro.k - 1);
        sx.innerHTML = _libroHtmlFaccia(nuovaSinistra);
        sx.classList.toggle('libro-lato-spento', !nuovaSinistra);
    }

    foglio.style.display = 'block';
    foglio.style.transition = 'none';
    foglio.style.transform = `rotateY(${direzione > 0 ? 0 : -180}deg)`;
    foglio.style.setProperty('--libro-ombra', '0');
    void foglio.offsetWidth; // forza il ricalcolo prima di riattivare la transizione
    foglio.style.transition = '';
}


function _libroGira(direzione) {
    if (!_libro || _libro.animando) return;
    if (direzione > 0 && !_libroPuoAvanti()) return;
    if (direzione < 0 && !_libroPuoIndietro()) return;

    const j = direzione > 0 ? _libro.k : _libro.k - 1;
    _libro.animando = true;
    _libroPreparaFoglio(j, direzione);

    const foglio = document.getElementById('binderLibroFoglio');
    requestAnimationFrame(() => {
        foglio.classList.add('girando');
        foglio.style.transform = `rotateY(${direzione > 0 ? -180 : 0}deg)`;
    });

    // Chiusura a tempo invece che su transitionend: se la transizione viene
    // interrotta (scheda in background, riapertura rapida) l'evento può non
    // arrivare mai e il libro resterebbe bloccato a metà giro.
    setTimeout(() => {
        foglio.classList.remove('girando');
        _libro.k += direzione;
        _libro.animando = false;
        _libroDisegnaStatico();
    }, LIBRO_DURATA_GIRO_MS + 40);
}


function _libroInitGesti() {
    const scena = document.getElementById('binderLibroScena');
    if (!scena || scena.dataset.gestiPronti === '1') return;
    scena.dataset.gestiPronti = '1';
    scena.addEventListener('pointerdown', _libroPointerDown);
    scena.addEventListener('pointermove', _libroPointerMove);
    scena.addEventListener('pointerup', _libroPointerUp);
    scena.addEventListener('pointercancel', _libroPointerUp);
}


function _libroPointerDown(e) {
    if (!_libro || _libro.animando) return;
    _libro.dragMosso = false;
    _libro.drag = { x0: e.clientX, y0: e.clientY, deciso: false, direzione: 0, progresso: 0 };
}


function _libroPointerMove(e) {
    if (!_libro || !_libro.drag || _libro.animando) return;
    const d = _libro.drag;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;

    if (!d.deciso) {
        // Verticale = scroll della pagina (dentro la cornice telefono c'è lo
        // scroll-snap tra Home e widget): non lo rubiamo mai.
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > LIBRO_SOGLIA_DRAG_PX) { _libro.drag = null; return; }
        if (Math.abs(dx) < LIBRO_SOGLIA_DRAG_PX) return;

        const direzione = dx < 0 ? 1 : -1;
        if (direzione > 0 && !_libroPuoAvanti()) { _libro.drag = null; return; }
        if (direzione < 0 && !_libroPuoIndietro()) { _libro.drag = null; return; }

        d.deciso = true;
        d.direzione = direzione;
        _libro.dragMosso = true; // il click sulla carta che arriverà dopo va ignorato
        _libroPreparaFoglio(direzione > 0 ? _libro.k : _libro.k - 1, direzione);
        const foglioNuovo = document.getElementById('binderLibroFoglio');
        foglioNuovo.classList.add('in-trascinamento');
        // Alcuni browser rifiutano la cattura se il pointer non è partito su
        // questo elemento: è innocuo, il gesto continua a funzionare via scena.
        try { foglioNuovo.setPointerCapture(e.pointerId); } catch (_) { /* ignorato di proposito */ }
    }

    const progresso = Math.max(0, Math.min(1, Math.abs(dx) / _libro.pw));
    d.progresso = progresso;
    const angolo = d.direzione > 0 ? -180 * progresso : -180 * (1 - progresso);
    const foglio = document.getElementById('binderLibroFoglio');
    foglio.style.transform = `rotateY(${angolo}deg)`;
    // Ombra massima a metà giro, come la luce reale su una pagina piegata.
    foglio.style.setProperty('--libro-ombra', String(Math.sin(progresso * Math.PI) * 0.55));
    e.preventDefault();
}


function _libroPointerUp() {
    if (!_libro || !_libro.drag) return;
    const d = _libro.drag;
    _libro.drag = null;
    if (!d.deciso) return;

    const foglio = document.getElementById('binderLibroFoglio');
    foglio.classList.remove('in-trascinamento');
    const completa = d.progresso > 0.35;

    _libro.animando = true;
    foglio.classList.add('girando');
    foglio.style.transform = `rotateY(${(d.direzione > 0) === completa ? -180 : 0}deg)`;
    foglio.style.removeProperty('--libro-ombra');

    setTimeout(() => {
        foglio.classList.remove('girando');
        if (completa) _libro.k += d.direzione;
        _libro.animando = false;
        _libroDisegnaStatico();
    }, LIBRO_DURATA_GIRO_MS + 40);
}
