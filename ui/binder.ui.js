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
        binderScambioGarantisci(userId), // Fase 3, Step 2 (2026-09-12)
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
    if (tipo === 'scambio') return 'fa-right-left'; // Fase 3, Step 2 (2026-09-12)
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
// AGGIORNATO (Claudio, 2026-09-18): "il binder deve essere aperto a
// schermo intero... dare più importanza al binder che al resto".
// .binder-dettaglio-attivo su #binder fa passare .settings-card (condiviso
// con la griglia contenitori) da pagina normale (max-width 900px) a
// colonna flex a tutta altezza — CSS in index.html, vicino a
// .binder-page-btn. display:'flex' (non più 'block') su
// #binderDettaglioWrap perché diventi lui stesso quella colonna.
async function apriBinderDettaglio(binderId) {
    _binderAttivo = binderId;
    _binderPagina = 0;

    document.getElementById('bindersContenitoriGrid').style.display = 'none';
    document.getElementById('binder')?.classList.add('binder-dettaglio-attivo');
    const wrapDettaglio = document.getElementById('binderDettaglioWrap');
    if (wrapDettaglio) wrapDettaglio.style.display = 'flex';

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

    // Fase 3, Step 2 (2026-09-12): 'location'+SCAMBIO non esiste più (sql/45b
    // l'ha migrato a tipo='scambio') — condizione aggiornata di conseguenza.
    // Il ramo location='SCAMBIO' resta per pura difesa, nel caso sfuggisse
    // qualcosa (stesso spirito del trigger DB, vedi sql/45b).
    const eGiaPubblicoFisso = binder.tipo === 'wishlist' || binder.tipo === 'scambio' || (binder.tipo === 'location' && binder.location_valore === 'SCAMBIO');
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
    chiudiImpostazioniBinderAttivo(); // difensivo: se il modale era rimasto aperto
    _libroSmonta(); // OPUS 2026-08-25: libera ResizeObserver e handler del libro
    document.getElementById('binder')?.classList.remove('binder-dettaglio-attivo');
    const wrapDettaglio = document.getElementById('binderDettaglioWrap');
    if (wrapDettaglio) wrapDettaglio.style.display = 'none';
    document.getElementById('bindersContenitoriGrid').style.display = '';
}

// ── Modale impostazioni per-binder (Claudio, 2026-09-18) ─────────────────
// Rinomina/pubblicazione/condivisione/toggle Immagini-Elenco/Design/layout
// — prima tutte visibili sopra la griglia carte in #binderDettaglioWrap,
// ora raccolte in #binderImpostazioniModal (markup in index.html, vicino
// agli altri modali del sito) aperto da un'icona ingranaggio nell'header:
// "ogni binder ha le sue impostazioni". Nessuna logica toccata — gli id
// interni (#binderRinominaWrap, #binderPubblicazioneWrap, ecc.) sono
// identici a prima e continuano a essere popolati/nascosti dalle stesse
// funzioni di sempre (_aggiornaControlliRinominaPubblicazioneCondivisione,
// renderBinderContenuto, caricaDesignBinderAttivo) — solo il contenitore
// che li ospita è cambiato, getElementById non dipende da dove sta il nodo.
// AGGIORNATO 2026-09-18 (Claudio: "è bene che si espanda per tutto lo
// schermo rimanendo dentro la cornice, così è tutto visibile") — il modale
// non è più un box centrato piccolo: viene riposizionato/ridimensionato sul
// rettangolo VERO di #phoneScreen con _rettangoloSchermoCornice() (stessa
// funzione già usata da _posizionaContainerNelloSchermo() per .container in
// ui/paginainiziale-drag-resize.ui.js — nessuna logica di misura duplicata).
// Un listener su resize lo tiene allineato mentre è aperto (rotazione
// schermo, ridimensionamento finestra desktop), rimosso alla chiusura.
let _binderImpostazioniResizeHandler = null;

function _binderImpostazioniPosiziona() {
    const modal = document.getElementById('binderImpostazioniModal');
    const r = (typeof _rettangoloSchermoCornice === 'function') ? _rettangoloSchermoCornice() : null;
    if (!modal || !r) return;
    modal.style.top = r.top + 'px';
    modal.style.left = r.left + 'px';
    modal.style.width = r.width + 'px';
    modal.style.height = r.height + 'px';
    modal.style.borderRadius = r.borderRadius;
    const contenuto = modal.querySelector('.modal-content');
    if (contenuto) contenuto.style.borderRadius = r.borderRadius;
}

function apriImpostazioniBinderAttivo() {
    const modal = document.getElementById('binderImpostazioniModal');
    if (!modal) return;
    modal.style.display = 'flex';
    _binderImpostazioniPosiziona();
    if (!_binderImpostazioniResizeHandler) {
        _binderImpostazioniResizeHandler = () => _binderImpostazioniPosiziona();
        window.addEventListener('resize', _binderImpostazioniResizeHandler);
    }
    // Sempre da capo su Generali con editor sleeve chiuso (redesign
    // 2026-09-18) — evita di riaprire il modale nello stato in cui era
    // rimasto l'ultima volta (es. editor sleeve ancora aperto). Chiude
    // anche l'editor da sola (vedi sotto: tab !== 'design').
    _binderImpostazioniTab('generali');
}

function chiudiImpostazioniBinderAttivo() {
    const modal = document.getElementById('binderImpostazioniModal');
    if (modal) modal.style.display = 'none';
    if (_binderImpostazioniResizeHandler) {
        window.removeEventListener('resize', _binderImpostazioniResizeHandler);
        _binderImpostazioniResizeHandler = null;
    }
}

// ── Tab Generali/Design (Claudio, 2026-09-18: "raggruppa in tab") ────────
// Stesso pattern .binder-modalita-toggle/.binder-modalita-btn già usato
// altrove nel sito (Achievement, Immagini/Elenco) — solo lo stato di quale
// tab è attiva, nessuna logica di caricamento dati qui (i dati di Nome/
// Copertina/Sleeve sono già stati caricati una volta sola all'apertura del
// binder da caricaDesignBinderAttivo(), indipendentemente da quale tab è
// visibile — cambiare tab mostra/nasconde soltanto).
function _binderImpostazioniTab(tab) {
    document.querySelectorAll('#binderImpostazioniTabs .binder-modalita-btn').forEach(el => {
        el.classList.toggle('active', el.dataset.itab === tab);
    });
    const generali = document.getElementById('binderImpostazioniTabGenerali');
    const design = document.getElementById('binderImpostazioniTabDesign');
    if (generali) generali.style.display = tab === 'generali' ? '' : 'none';
    if (design) design.style.display = tab === 'design' ? '' : 'none';
    // Difensivo: se si cambia tab mentre l'editor sleeve è aperto, lo
    // richiude — evita lo stato incoerente "editor visibile ma tab Design
    // non selezionata".
    if (tab !== 'design') _binderSleeveChiudiEditor();
}

// ── Editor sleeve immersivo (Claudio, 2026-09-18: "va bene che si nasconda
// [il resto] prendendo tutto lo spazio") — #binderSleeveEditorZona
// sostituisce interamente #binderDesignContenutoNormale (Nome/Copertina/
// anteprima Sleeve) e la barra dei tab finché non si torna indietro.
// _cardBackRescale() richiamato esplicitamente all'apertura per lo stesso
// motivo del fix precedente sul vecchio <details>: l'area del canvas ha
// clientWidth 0 finché è display:none, e aprire questa zona non genera da
// solo un evento resize.
function _binderSleeveApriEditor() {
    const zona = document.getElementById('binderSleeveEditorZona');
    const normale = document.getElementById('binderDesignContenutoNormale');
    const tabs = document.getElementById('binderImpostazioniTabs');
    if (!zona) return;
    zona.style.display = 'block';
    if (normale) normale.style.display = 'none';
    if (tabs) tabs.style.display = 'none';
    if (typeof _cardBackRescale === 'function') _cardBackRescale();
}

function _binderSleeveChiudiEditor() {
    const zona = document.getElementById('binderSleeveEditorZona');
    const normale = document.getElementById('binderDesignContenutoNormale');
    const tabs = document.getElementById('binderImpostazioniTabs');
    if (zona) zona.style.display = 'none';
    if (normale) normale.style.display = '';
    if (tabs) tabs.style.display = '';
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

    // Fase 3, Step 2 (2026-09-12): il binder Scambio usa la stessa
    // binder_carte di 'extra', ma serve anche quantita_offerta — query
    // gemella con quella colonna in più, stesso motivo di
    // binderCarteQueryConQuantita in data/binder.repository.js.
    const usaQuantita = binder.tipo === 'scambio';
    const { data: righe, error } = usaQuantita
        ? await binderCarteQueryConQuantita(userId, binder.id)
        : await binderCarteQuery(userId, binder.id);
    if (error) { console.error('_caricaCarteBinderAttivo:', error.message); _carteBinderAttivoCache = []; return; }
    const mappaQuantita = {};
    if (usaQuantita) (righe || []).forEach(r => { mappaQuantita[String(r.carta_id)] = r.quantita_offerta; });
    const idsNelBinder = new Set((righe || []).map(r => String(r.carta_id)));
    _carteBinderAttivoCache = carteReali
        .filter(c => c.tabella === 'carte' && c.stato === 'collezione' && idsNelBinder.has(String(c.id)))
        .map(c => ({ id: c.id, name: c.name || c.nome, immagine: c.immagine, qty: c.qty, createdAt: c.createdAt, quantitaOfferta: usaQuantita ? mappaQuantita[String(c.id)] : undefined }));
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
    const permettiRimozione = binder && (binder.tipo === 'extra' || binder.tipo === 'scambio');
    const eScambio = binder && binder.tipo === 'scambio';

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
            const nomeAttr = escapeHtml(card.name || '').replace(/"/g, '&quot;'); // SICUREZZA 2026-09-01: escapeHtml PRIMA, vedi nota sotto
            const immagineSrc = _urlImmagineVisualizzabile(card.immagine, 300);
            html += `
                <div class="binder-slot binder-slot-filled" onclick="${eScambio ? `apriModaleQuantitaScambio('${idAttr}')` : `apriImmagineIngrandita('${idAttr}')`}" title="${nomeAttr}">
                    ${permettiRimozione ? `<button type="button" class="binder-slot-remove-btn" title="${eScambio ? 'Modifica quantità offerta' : 'Rimuovi dal Binder'}" aria-label="${eScambio ? 'Modifica quantità offerta' : 'Rimuovi dal Binder'}" onclick="event.stopPropagation(); ${eScambio ? `rimuoviDaScambioGriglia('${idAttr}')` : `rimuoviDalBinderExtra('${idAttr}')`}"><i class="fa-solid ${eScambio ? 'fa-pen' : 'fa-xmark'}"></i></button>` : ''}
                    <div class="binder-slot-fallback"><i class="fa-solid fa-image"></i><span>${nomeAttr}</span></div>
                    ${immagineSrc ? `<img src="${immagineSrc}" alt="${nomeAttr}" loading="lazy" onerror="this.remove();">` : ''}
                    ${eScambio
                        ? `<span class="binder-slot-qty-badge" title="Quantità offerta in Scambio">Offerte: ${card.quantitaOfferta ?? 0}</span>`
                        : (card.qty > 1 ? `<span class="binder-slot-qty-badge" title="Hai ${card.qty} copie di questa carta — occupano un solo slot">×${card.qty}</span>` : '')}
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

// ── Modale quantità offerta — binder Scambio (Fase 3, Step 2, 2026-09-12) ──
// A differenza del binder 'extra' (toggleBinderMembership, sì/no), qui
// serve un NUMERO — da qui il modale dedicato invece di un semplice toggle.
// Un solo modale, richiamabile sia dal bottone "Offri in Scambio" in
// Visualizzazione (ui/cards.ui.js) sia dalla griglia del binder Scambio
// aperto (renderBinderGrigliaImmagini sotto).
let _scambioModaleCartaId = null;

function apriModaleQuantitaScambio(cartaId) {
    const card = carteReali.find(c => String(c.id) === String(cartaId));
    if (!card) return;
    _scambioModaleCartaId = cartaId;

    document.getElementById('scambioQuantitaTitolo').textContent = card.name || card.nome || '';
    const attuale = _quantitaOfferteScambio[String(cartaId)] ?? 0;
    const input = document.getElementById('scambioQuantitaInput');
    input.value = attuale;
    input.max = card.qty || 1;
    document.getElementById('scambioQuantitaMax').textContent = `Ne possiedi ${card.qty || 1}.`;
    document.getElementById('btnRimuoviScambio').style.display = attuale > 0 ? '' : 'none';

    document.getElementById('scambioQuantitaModal').style.display = 'flex';
}

function chiudiModaleQuantitaScambio() {
    document.getElementById('scambioQuantitaModal').style.display = 'none';
    _scambioModaleCartaId = null;
}

async function confermaQuantitaScambio() {
    if (!_scambioModaleCartaId) return;
    const cartaId = _scambioModaleCartaId;
    const input = document.getElementById('scambioQuantitaInput');
    const quantita = Math.max(0, parseInt(input.value) || 0);

    await _applicaQuantitaScambio(cartaId, quantita);
    chiudiModaleQuantitaScambio();
}

async function rimuoviDaScambio() {
    if (!_scambioModaleCartaId) return;
    await _applicaQuantitaScambio(_scambioModaleCartaId, 0);
    chiudiModaleQuantitaScambio();
}

// Un solo punto per scrivere la quantità, riusato da conferma/rimuovi sopra
// e da rimuoviDaScambioGriglia sotto (griglia del binder Scambio aperto).
// Quantità 0: elimina la riga invece di scrivere 0 — coerente con "offerta
// a 0 = non ancora messa in vendita" già usato lato RPC pubblica (sql/45b),
// e con lo stesso schema di toggleBinderMembership per l'extra (che elimina
// del tutto, non lascia una riga "spenta").
async function _applicaQuantitaScambio(cartaId, quantita) {
    const userId = await authGetUserId();
    if (!userId || !_binderScambioId) return;

    if (quantita <= 0) {
        const { error } = await binderCarteDeleteOne(userId, _binderScambioId, cartaId);
        if (error) { alert('❌ Errore nel rimuovere la carta dallo Scambio: ' + error.message); return; }
        _idsInScambio.delete(String(cartaId));
        delete _quantitaOfferteScambio[String(cartaId)];
    } else {
        const { error } = await binderCarteImpostaQuantitaScambio(userId, _binderScambioId, cartaId, quantita);
        if (error) { alert('❌ Errore nell\'aggiornare la quantità offerta: ' + error.message); return; }
        _idsInScambio.add(String(cartaId));
        _quantitaOfferteScambio[String(cartaId)] = quantita;
    }

    _aggiornaBottoniScambioToggle(cartaId);

    // Stesso motivo di toggleBinderMembership: se il binder Scambio è
    // aperto proprio ora nel widget Binders, la cache locale è disallineata.
    const binderAperto = _bindersElenco.find(b => String(b.id) === String(_binderAttivo));
    if (binderAperto && binderAperto.tipo === 'scambio') {
        await _caricaCarteBinderAttivo(binderAperto);
        renderBinderContenuto();
    }
}

function _aggiornaBottoniScambioToggle(id) {
    const idAttr = String(id);
    const inScambio = _idsInScambio.has(idAttr);
    const quantita = _quantitaOfferteScambio[idAttr] ?? 0;

    document.querySelectorAll(`.btn-scambio-toggle[data-id="${idAttr}"]`).forEach((btn) => {
        btn.innerHTML = inScambio
            ? `<i class="fa-solid fa-right-left"></i> In Scambio: ${quantita}`
            : `<i class="fa-solid fa-right-left"></i> Offri in Scambio`;
        btn.classList.remove('binder-toggle-flash');
        void btn.offsetWidth;
        btn.classList.add('binder-toggle-flash');
        setTimeout(() => btn.classList.remove('binder-toggle-flash'), 600);
    });
}

// Click su uno slot della griglia del binder Scambio aperto — riapre lo
// stesso modale, precompilato (vedi renderBinderGrigliaImmagini sotto).
function rimuoviDaScambioGriglia(cartaId) {
    apriModaleQuantitaScambio(cartaId);
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


// ── RINOMINA, COPERTINA, CARD-BACK, SLEEVE, GALLERIA SFONDI — SPOSTATO
// (piano di taglio 2026-09-11) in ui/binder-design.ui.js. Conteneva:
// rinominaBinderExtraCorrente, caricaDesignBinderAttivo,
// caricaNomeBinderAttivoStato/proponiNomeBinderAttivo, tutto l'editor
// copertina + card-back, tutto l'editor sleeve, _caricaGalleriaDefault.
//
// apriBinderDettaglio() qui sopra chiama caricaDesignBinderAttivo() in
// ui/binder-design.ui.js quando apri il dettaglio di un binder (cross-file,
// vedi nota in quel file).

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
    wrap.style.display = 'flex'; // AGGIORNATO 2026-09-18: era 'block' — flex per centrare la scena e ancorare le frecce laterali (vedi CSS #binder.binder-dettaglio-attivo #binderLibroWrap)

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
        // AGGIUNTO 2026-09-18 (difensivo, Claudio: "hai rotto il flip"):
        // mancava _libro.drag qui — solo _libro.animando (l'animazione di
        // scatto finale) bloccava il ridisegno, non il trascinamento LIVE.
        // Un resize durante un drag attivo (anche minimo, es. un reflow
        // innescato da qualunque cosa nella pagina) faceva ripartire
        // _libroDisegnaStatico(), che rimette .libro-foglio a display:none
        // e ridisegna da _libro.k pre-drag — cancellando visivamente il
        // trascinamento in corso.
        if (!_libro || _libro.animando || _libro.drag) return;
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

    // AGGIORNATO (Claudio, 2026-09-18: "binder a schermo intero, il minimo
    // indispensabile di margine") — #binderLibroWrap è ora esso stesso
    // l'area piena rimasta dopo l'header (flex:1 dentro #binderDettaglioWrap
    // a schermo intero, vedi CSS #binder.binder-dettaglio-attivo in
    // index.html, vicino a .binder-page-btn): si legge la SUA altezza vera,
    // stesso principio già usato sopra per la larghezza, al posto del
    // vecchio tetto indovinato (62% di .container, pensato per un libro
    // incorporato in una pagina normale, non per uno a schermo intero). Il
    // fallback sotto resta solo per un frame eventuale in cui il layout non
    // si sia ancora assestato (clientHeight ancora a 0).
    const altezzaWrap = wrap ? wrap.clientHeight : 0;
    let maxH;
    if (altezzaWrap > 0) {
        maxH = Math.max(240, altezzaWrap);
    } else {
        const contenitore = document.querySelector('.container');
        const altezzaUtile = (contenitore && contenitore.clientHeight) ? contenitore.clientHeight : window.innerHeight;
        maxH = Math.max(240, Math.round(altezzaUtile * 0.9));
    }

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
        const nomeAttr = escapeHtml(card.name || '').replace(/"/g, '&quot;'); // SICUREZZA 2026-09-01: escapeHtml PRIMA, vedi nota sotto
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
