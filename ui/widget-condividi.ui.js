// ═══════════════════════════════════════════════════════════════════════
// WIDGET-CONDIVIDI.UI.JS — pagina "Condividi" (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP 5 della ristrutturazione file widget home (vedi
// Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md). Estratto da
// ui/phone.ui.js il 2026-09-11.
//
// AGGIORNATO 2026-09-18 (Claudio): via la vecchia lista testuale
// (.pg-riga) con riga fissa hardcoded "Sealed" → sostituita del tutto —
// il Sealed non ha una sua pagina pubblica dedicata, sta dentro gli
// Scaffali (scaffali-pubblico.html). Ora: griglia con copertina uniforme
// stile Pokédex (.condividi-grid/.condividi-*, CSS isolato in index.html,
// stessa formula 58.2%/63:88 di Binder/Scaffali/Achievement — vedi CSS),
// che elenca ogni BINDER pubblico (copertina reale, come già in
// binder.ui.js) + ogni SCAFFALE pubblico (solo icona+nome, Claudio: "la
// copertina non serve, serve il titolo" — stessa scelta già fatta per la
// pagina Scaffali). Click su una tessera → stesso pannello link/QR/
// condivisione nativa di sempre, invariato. Aggiunto anche un placeholder
// "condividi sul profilo" per tessera (feature futura, solo UI).
//
// CATEGORIA A: pagina propria.
//
// COSA RESTA FUORI (non spostato qui, invariato):
// - apriDettaglioWidget (ui/paginainiziale.ui.js) continua a chiamare
//   renderPaginaCondividi() per tabId === 'condividi' — motore home,
//   dispatch generico, non toccato in questo step.
// - _ballTITOLI_BREVI.condividi / _ballASPETTO.condividi
//   (ui/widget-render-condiviso.ui.js) — motore visivo, non toccato.
// - _risolviCopertinaBinder() / _bindersElenco / apriWidgetBinders()
//   (ui/binder.ui.js) — RIUSATI qui, non duplicati: stessa cache
//   (_coperturaBinderCache), nessuna copia locale della logica copertina.
// - _scaffaliElenco (dichiarato in ui/scaffali.ui.js) — riusato come
//   variabile globale, ma NON caricato tramite apriPaginaScaffali() (vedi
//   _garantisciScaffaliElencoWidget più sotto per il motivo).
// - _rettangoloSchermoCornice() (ui/paginainiziale-drag-resize.ui.js) —
//   RIUSATA per posizionare il modale share sul rettangolo vero di
//   #phoneScreen, non toccata né duplicata (vedi _condividiSharePosiziona
//   più sotto, mirror di _binderImpostazioniPosiziona in binder.ui.js).
//
// AGGIORNATO 2026-09-18 (Claudio: "con molti binder/scaffali diventa
// incastrato"): il pannello link/QR/nativo non è più inline sotto la
// griglia — è #condividiShareModal, un modale a schermo intero dentro la
// cornice (markup spostato vicino agli altri modali globali in index.html,
// subito prima di #qrModal — stessa posizione fisica scelta oggi per
// #binderImpostazioniModal).
// ───────────────────────────────────────────────────────────────────────

// ── VOCE DI CATALOGO ──────────────────────────────────────────────────
CATALOGO_WIDGET.condividi = {
        titolo: 'Condividi', icona: 'fa-share-nodes',
        preview: () => ({ righe: ['Cosa vuoi condividere?'] }),
        azione: (dati, punto) => { apriDettaglioWidget('condividi', punto); },
};

// ── PAGINA "CONDIVIDI" ────────────────────────────────────────────────
// Elenca tutto il condivisibile reale: ogni binder pubblico + ogni
// scaffale pubblico. Click su una tessera → pannello con link/QR/
// condivisione nativa per QUELLA cosa.
async function renderPaginaCondividi() {
    const container = document.getElementById('condividiLista');
    if (!container) return;
    container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Caricamento…</p>';
    chiudiCondividiPannelloShare(); // difensivo: se il modale era rimasto aperto (stesso pattern di chiudiImpostazioniBinderAttivo in binder.ui.js)

    const userId = await authGetUserId();

    // apriWidgetBinders() è la stessa funzione già riusata altrove (vedi
    // home.ui.js) per garantire _bindersElenco senza dover navigare via —
    // qui restiamo sulla pagina Condividi, non su Binders.
    if (!Array.isArray(_bindersElenco) || _bindersElenco.length === 0) {
        try { await apriWidgetBinders(); } catch (e) { console.error('renderPaginaCondividi: caricamento binder:', e); }
    }
    // Stesso principio per gli scaffali, MA senza passare da
    // apriPaginaScaffali(): quella imposta currentMode='scaffali' (stato
    // globale di navigazione, usato da _linkPubblicoCondivisione per
    // sapere "dove sei") — qui restiamo su Condividi, quell'effetto
    // collaterale ci taggherebbe come se fossimo dentro Scaffali.
    if (userId) {
        try { await _garantisciScaffaliElencoWidget(userId); } catch (e) { console.error('renderPaginaCondividi: caricamento scaffali:', e); }
    }

    const bindersPubblici = (Array.isArray(_bindersElenco) ? _bindersElenco : [])
        .filter(b => b.stato_pubblicazione === 'pubblico');
    const scaffaliPubblici = (Array.isArray(_scaffaliElenco) ? _scaffaliElenco : [])
        .filter(s => s.stato_pubblicazione === 'pubblico');

    if (bindersPubblici.length === 0 && scaffaliPubblici.length === 0) {
        container.innerHTML = '<div class="stato-vuoto"><i class="fa-solid fa-share-nodes"></i><br>Nessun binder o scaffale pubblico ancora — pubblicane uno dalle rispettive Impostazioni per condividerlo qui.</div>';
        return;
    }

    // Stesso set di icone fallback di _iconaFallbackBinder (ui/binder.ui.js)
    // — duplicato qui apposta (Regola d'Oro #1: duplicazione locale invece
    // di refactoring cross-file per esporre quella funzione).
    const iconaPerTipoBinder = { wishlist: 'fa-heart', location: 'fa-layer-group', extra: 'fa-box-archive', scambio: 'fa-right-left' };

    const tessereBinder = await Promise.all(bindersPubblici.map(async b => {
        const copertinaUrl = await _risolviCopertinaBinder(userId, b);
        const idAttr = String(b.id).replace(/'/g, "\\'");
        const nomeAttr = escapeHtml(b.nome || b.location_valore || b.tipo);
        const icona = iconaPerTipoBinder[b.tipo] || 'fa-layer-group';
        return `
            <div class="condividi-tile" data-tipo-elemento="binder" title="${nomeAttr}" onclick="_condividiElementoWidget('binder-pubblico.html', 'binder', '${idAttr}', '${b.tipo}', event)">
                <div class="condividi-cover">
                    ${copertinaUrl
                        ? `<img src="${copertinaUrl}" alt="${nomeAttr}" loading="lazy" onerror="this.remove();">`
                        : `<i class="fa-solid ${icona}"></i>`}
                    <label class="condividi-profilo-toggle" title="Condividi sul profilo (in arrivo)" onclick="event.stopPropagation();">
                        <input type="checkbox">
                    </label>
                </div>
                <div class="condividi-nome">${nomeAttr}</div>
            </div>`;
    }));

    // Scaffali: NESSUNA copertina (stessa scelta di #scaffali .binder-
    // contenitore-nome in index.html — "la copertina non serve, serve il
    // titolo"), quindi solo icona + nome enfatizzato via CSS
    // ([data-tipo-elemento="scaffale"] .condividi-nome). Icone: stesso
    // identico set di renderGrigliaScaffali() in ui/scaffali.ui.js — SOLO
    // Vetrina ha un'icona dedicata, Scambio incluso nel fallback generico
    // (non fa-right-left come i binder: verificato nel file reale prima
    // di scrivere, non dedotto dal nome).
    const tessereScaffale = scaffaliPubblici.map(s => {
        const idAttr = String(s.id).replace(/'/g, "\\'");
        const nomeAttr = escapeHtml(s.nome || (s.tipo === 'vetrina' ? 'Vetrina' : '(senza nome)'));
        const icona = s.tipo === 'vetrina' ? 'fa-star' : 'fa-box-archive';
        return `
            <div class="condividi-tile" data-tipo-elemento="scaffale" title="${nomeAttr}" onclick="_condividiElementoWidget('scaffali-pubblico.html', 'scaffale', '${idAttr}', null, event)">
                <div class="condividi-cover">
                    <i class="fa-solid ${icona}"></i>
                    <label class="condividi-profilo-toggle" title="Condividi sul profilo (in arrivo)" onclick="event.stopPropagation();">
                        <input type="checkbox">
                    </label>
                </div>
                <div class="condividi-nome">${nomeAttr}</div>
            </div>`;
    });

    container.innerHTML = `<div class="condividi-grid">${tessereBinder.join('') + tessereScaffale.join('')}</div>`;
}

// Carica _scaffaliElenco (dichiarato in ui/scaffali.ui.js) SENZA gli
// effetti collaterali di apriPaginaScaffali() — vedi commento sopra nella
// chiamata. Stessa guardia-sul-vuoto già usata per _bindersElenco: non
// ricarica se già popolato da una visita precedente alla pagina Scaffali
// in questa sessione (comportamento preesistente, non introdotto qui).
async function _garantisciScaffaliElencoWidget(userId) {
    if (Array.isArray(_scaffaliElenco) && _scaffaliElenco.length > 0) return;
    const { data, error } = await scaffaliList(userId);
    if (error) { console.error('_garantisciScaffaliElencoWidget:', error.message); return; }
    _scaffaliElenco = data || [];
}

// Stessa identica logica di costruzione URL di _linkPubblicoCondivisione
// (navigation.ui.js) — duplicata qui apposta invece di refactorizzare
// quella funzione: lei legge lo stato globale di navigazione (currentMode/
// _binderAttivo, "il binder che hai aperto ORA"), qui invece serve il
// link per un elemento scelto da una lista, senza navigarci dentro. File
// diverso, stesso comportamento — Regola d'Oro #1 (duplicazione locale
// invece di refactoring cross-file).
//
// AGGIORNATO 2026-09-18: idParamNome generalizzato ('binder' o
// 'scaffale', invece di 'binder' fisso) — scaffali-pubblico.html legge
// proprio il param 'scaffale' (verificato nel file reale), diverso da
// quello dei binder.
async function _linkCondivisioneWidget(pagina, idParamNome, id, tipoBinder) {
    const sessione = await authGetSession();
    const userId = sessione?.user?.id;
    if (!userId) return null;
    const url = new URL(pagina + '?u=' + encodeURIComponent(userId), window.location.href);
    if (id) url.searchParams.set(idParamNome, id);
    const temaSalvato = prefSiteThemeGet();
    if (temaSalvato) url.searchParams.set('tema', temaSalvato);
    if (prefDarkModeGet()) url.searchParams.set('scuro', '1');
    if (tipoBinder === 'wishlist' && sessione?.user?.email) {
        url.searchParams.set('nome', _nomeDaEmail(sessione.user.email));
    }
    return url.href;
}

let _condividiLinkCorrente = null;

// ── Modale condivisione a schermo intero (Claudio, 2026-09-18: "con
// molti binder/scaffali diventa incastrato") — MIRROR ESATTO di
// _binderImpostazioniPosiziona()/apriImpostazioniBinderAttivo()/
// chiudiImpostazioniBinderAttivo() in ui/binder.ui.js: stessa tecnica
// (_rettangoloSchermoCornice() per combaciare col rettangolo VERO di
// #phoneScreen, listener su resize tenuto vivo solo mentre il modale è
// aperto). Duplicazione intenzionale (Regola d'Oro #1) — dominio diverso
// (pannello share vs impostazioni binder), nessun rischio di toccare
// binder.ui.js riusando/generalizzando quelle funzioni. ─────────────────
let _condividiShareResizeHandler = null;

function _condividiSharePosiziona() {
    const modal = document.getElementById('condividiShareModal');
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

function apriCondividiPannelloShare() {
    const modal = document.getElementById('condividiShareModal');
    if (!modal) return;
    modal.style.display = 'flex';
    _condividiSharePosiziona();
    if (!_condividiShareResizeHandler) {
        _condividiShareResizeHandler = () => _condividiSharePosiziona();
        window.addEventListener('resize', _condividiShareResizeHandler);
    }
}

function chiudiCondividiPannelloShare() {
    const modal = document.getElementById('condividiShareModal');
    if (modal) modal.style.display = 'none';
    if (_condividiShareResizeHandler) {
        window.removeEventListener('resize', _condividiShareResizeHandler);
        _condividiShareResizeHandler = null;
    }
}

async function _condividiElementoWidget(pagina, idParamNome, id, tipoBinder, evt) {
    if (evt) evt.stopPropagation();
    const link = await _linkCondivisioneWidget(pagina, idParamNome, id, tipoBinder);
    if (!link) { alert('Devi essere loggato per condividere.'); return; }
    _condividiLinkCorrente = link;

    document.getElementById('condividiLinkInput').value = link;
    const qrContainer = document.getElementById('condividiQrContainer');
    qrContainer.innerHTML = '';
    new QRCode(qrContainer, { text: link, width: 160, height: 160, colorDark: '#2a2438', colorLight: '#ffffff' });

    // Missione #29 "QR Hunter" (2026-08-30). Fire-and-forget, stesso
    // pattern degli altri hook missioni — un fallimento qui non deve mai
    // bloccare la generazione del QR, già avvenuta sopra.
    (async () => {
        try {
            const userId = await authGetUserId();
            if (userId) await missioniQrGeneratoRegistra(userId);
        } catch (e) { console.error('[missioni] registrazione QR generato:', e); }
    })();

    // Stesso criterio di navigation.ui.js: il pulsante nativo compare solo
    // dove il browser lo supporta davvero, niente pulsante rotto altrove.
    document.getElementById('condividiBtnNativo').style.display = navigator.share ? 'block' : 'none';
    apriCondividiPannelloShare();
}

async function _copiaLinkCondividiWidget() {
    if (!_condividiLinkCorrente) return;
    try {
        await navigator.clipboard.writeText(_condividiLinkCorrente);
        alert('Link copiato negli appunti!');
    } catch (e) {
        prompt('Copia questo link:', _condividiLinkCorrente);
    }
}

async function _condividiNativoWidget() {
    if (!_condividiLinkCorrente) return;
    try { await navigator.share({ title: 'CardSync Pro', url: _condividiLinkCorrente }); }
    catch (e) { /* utente ha annullato, o browser l'ha bloccata — normale, nessun errore da mostrare */ }
}
