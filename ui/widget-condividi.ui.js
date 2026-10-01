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
        // RESTYLE BINDEX FASE 2 (2026-09-30, tavola "Condividi = pubbliche/
        // private + copertine"): prima solo "Cosa vuoi condividere?". Riusa
        // le letture (con cache di un minuto) delle tessere Binders e
        // Scaffali — nessuna query in più se quelle tessere sono in home.
        preview: async () => {
            const [b, s] = await Promise.all([
                typeof _widgetBinderLeggi === 'function' ? _widgetBinderLeggi() : null,
                typeof _widgetScaffaliLeggi === 'function' ? _widgetScaffaliLeggi() : null,
            ]);
            if (!b && !s) return { righe: ['Cosa vuoi condividere?'] };
            const binders = (b && b.binders) || [], scaffali = (s && s.scaffali) || [];
            const pub = (x) => x.stato_pubblicazione === 'pubblico';
            const pubbliche = binders.filter(pub).length + scaffali.filter(pub).length;
            const private_ = binders.length + scaffali.length - pubbliche;
            const copertine = binders.filter(pub).map(x => ({ nome: x.nome || '', colore: x.colore || null, pubblico: true }))
                .concat(scaffali.filter(pub).map(x => ({ nome: x.nome || '', pubblico: true })));
            return {
                righe: [pubbliche ? `${pubbliche} cos${pubbliche === 1 ? 'a pubblica' : 'e pubbliche'}` : 'Niente di pubblico'],
                dati: { pubbliche, private: private_, copertine },
            };
        },
        azione: (dati, punto) => { apriDettaglioWidget('condividi', punto); },
};

// ── PAGINA "CONDIVIDI" ────────────────────────────────────────────────
// RESTYLE BINDEX FASE 3e (2026-10-01, tavole "Condividi"): TUTTI i binder
// e gli scaffali con il loro stato (pubblico / sempre pubblico / privato),
// non più solo i pubblici. Telefono: griglia di copertine, il tocco apre un
// foglio dal basso con QR, "Condividi…", "Copia link", "Scarica QR". PC
// (pagina larga): elenco a sinistra e, a destra, il dettaglio dell'elemento
// scelto (QR, link con "Copia", "Condividi…", "Apri anteprima"). Su un
// elemento privato il pannello dice che è privato e offre "Rendi
// pubblico" (stessa scrittura delle Impostazioni: binderImpostaPubblicazione
// / scaffaleImpostaPubblicazione).
// Il link porta tema e colori; il nome di chi condivide è il NICKNAME
// (preferenze_utente.nickname), mai l'email: senza nickname il parametro
// ?nome= semplicemente non c'è.
// NON mostrato (serve una lettura in più, rimandato): "N carte" per elemento.
let _condividiElementi = [];       // [{ key, kind, id, nome, tipo, pubblico, fisso, cover, pagina, param }]
let _condividiSelKey = null;
let _condividiNick = null;         // nickname dell'utente o null
let _condividiQrEl = null;         // contenitore del QR attualmente mostrato

const _CD_ICONE_BINDER = { wishlist: 'fa-heart', scambio: 'fa-right-left', extra: 'fa-star', location: 'fa-book-open' };
const _CD_ORDINE_BINDER = { scambio: 0, wishlist: 1, extra: 2, location: 3 };

function _condividiEPC() {
    const pg = document.getElementById('condividi');
    return !!pg && pg.clientWidth >= 780; // stessa soglia del @container in index.css
}

function _condividiElStato(el) { return el.fisso ? 'sempre pubblico' : (el.pubblico ? 'pubblico' : 'privato'); }
function _condividiElTipoEtichetta(el) {
    if (el.kind === 'scaffale') return 'Scaffale';
    return { wishlist: 'Wishlist', scambio: 'Scambio', extra: 'Binder', location: 'Location' }[el.tipo] || 'Binder';
}
function _condividiElIcona(el) {
    if (el.kind === 'scaffale') return el.tipo === 'vetrina' ? 'fa-star' : (el.tipo === 'scambio' ? 'fa-right-left' : 'fa-box-archive');
    return _CD_ICONE_BINDER[el.tipo] || 'fa-book-open';
}
function _condividiElSfondo(el) {
    if (el.kind === 'scaffale') return 'linear-gradient(150deg, #8a6cf0, #5c3fd1)';
    if (el.tipo === 'wishlist') return 'linear-gradient(150deg, #e0568a, #a82255)';
    if (el.tipo === 'scambio') return 'linear-gradient(150deg, #3b8fd1, #15639b)';
    const tinta = (typeof _ballTintaDaNome === 'function') ? _ballTintaDaNome(el.nome) : 'hsl(150, 52%, 40%)';
    return `linear-gradient(150deg, ${tinta}, rgba(0,0,0,.4))`;
}

// Copertina (binder con immagine o tinta + icona; scaffale tinta + icona),
// con il globo se pubblico e l'etichetta col nome in basso.
function _condividiCoverHtml(el, piccola) {
    const nome = escapeHtml(el.nome);
    const interno = el.cover
        ? `<img src="${el.cover}" alt="" loading="lazy" onerror="this.remove();">`
        : `<i class="fa-solid ${_condividiElIcona(el)} cd-cover-icona"></i>`;
    return `<div class="cd-cover${piccola ? ' cd-cover-sm' : ''}" style="background:${_condividiElSfondo(el)};">${interno}
        ${el.pubblico ? '<span class="cd-globo"><i class="fa-solid fa-globe"></i></span>' : ''}
        ${piccola ? '' : `<span class="cd-cover-nome">${nome}</span>`}</div>`;
}

async function _condividiNicknameLeggi(userId) {
    try {
        const { data, error } = await userSettingsGet(userId);
        if (!error && data && data.nickname && String(data.nickname).trim()) return String(data.nickname).trim();
    } catch (e) { console.error('[condividi] nickname:', e); }
    return null;
}

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
        _condividiNick = await _condividiNicknameLeggi(userId);
    }

    const binders = (Array.isArray(_bindersElenco) ? _bindersElenco : []).slice()
        .sort((a, b) => (_CD_ORDINE_BINDER[a.tipo] ?? 9) - (_CD_ORDINE_BINDER[b.tipo] ?? 9) || String(a.nome || '').localeCompare(String(b.nome || '')));
    const scaffali = Array.isArray(_scaffaliElenco) ? _scaffaliElenco : [];

    const elBinder = await Promise.all(binders.map(async b => ({
        key: 'b:' + b.id, kind: 'binder', id: b.id, tipo: b.tipo,
        nome: b.nome || b.location_valore || b.tipo,
        pubblico: b.stato_pubblicazione === 'pubblico' || b.tipo === 'wishlist' || b.tipo === 'scambio',
        fisso: b.tipo === 'wishlist' || b.tipo === 'scambio',
        cover: userId ? await _risolviCopertinaBinder(userId, b) : null,
        pagina: 'binder-pubblico.html', param: 'binder',
    })));
    const elScaffali = scaffali.map(sc => ({
        key: 's:' + sc.id, kind: 'scaffale', id: sc.id, tipo: sc.tipo,
        nome: sc.nome || (sc.tipo === 'vetrina' ? 'Vetrina' : (sc.tipo === 'scambio' ? 'Scambio' : '(senza nome)')),
        pubblico: sc.stato_pubblicazione === 'pubblico' || sc.tipo === 'scambio',
        fisso: sc.tipo === 'scambio', cover: null,
        pagina: 'scaffali-pubblico.html', param: 'scaffale',
    }));
    _condividiElementi = elBinder.concat(elScaffali);

    const riep = document.getElementById('condividiRiepilogo');
    const nPub = _condividiElementi.filter(e => e.pubblico).length;
    const nPriv = _condividiElementi.length - nPub;
    if (riep) riep.innerHTML = _condividiElementi.length
        ? `<b>${nPub} cos${nPub === 1 ? 'a pubblica' : 'e pubbliche'}</b> &middot; ${nPriv} priva${nPriv === 1 ? 'ta' : 'te'} &middot; link, QR o condivisione del telefono`
        : 'Link, QR o condivisione del telefono';

    if (!_condividiElementi.length) {
        container.innerHTML = '<div class="stato-vuoto"><i class="fa-solid fa-share-nodes"></i><br>Nessun binder o scaffale ancora.</div>';
        return;
    }

    if (!_condividiElementi.some(e => e.key === _condividiSelKey)) {
        const primo = _condividiElementi.find(e => e.pubblico) || _condividiElementi[0];
        _condividiSelKey = primo.key;
    }

    const sezione = (titolo, elenco) => elenco.length ? `<div class="cd-sezione">${titolo}</div>` : '';
    const tile = (e) => `
        <div class="cd-tile${e.pubblico ? '' : ' cd-privato'}" onclick="_condividiScegli('${escapeJsAttr(e.key)}')">
            ${_condividiCoverHtml(e)}
            <div class="cd-stato">${_condividiElStato(e)}</div>
        </div>`;
    const riga = (e) => `
        <div class="cd-riga${e.key === _condividiSelKey ? ' sel' : ''}${e.pubblico ? '' : ' cd-privato'}" data-key="${escapeHtml(e.key)}" onclick="_condividiScegli('${escapeJsAttr(e.key)}')">
            ${_condividiCoverHtml(e, true)}
            <div class="cd-riga-testo"><b>${escapeHtml(e.nome)}</b><span>${_condividiElTipoEtichetta(e)}</span></div>
            <span class="cd-chip ${e.pubblico ? 'cd-chip-pub' : 'cd-chip-priv'}"><i class="fa-solid ${e.pubblico ? 'fa-globe' : 'fa-lock'}"></i> ${e.fisso ? 'Sempre pubblico' : (e.pubblico ? 'Pubblico' : 'Privato')}</span>
        </div>`;

    container.innerHTML = `
        <div class="cd-pagina">
            <div class="cd-sinistra">
                <div class="cd-griglia-tel">
                    ${sezione('Binder', elBinder)}<div class="cd-griglia">${elBinder.map(tile).join('')}</div>
                    ${sezione('Scaffali', elScaffali)}<div class="cd-griglia">${elScaffali.map(tile).join('')}</div>
                    <p class="cd-legenda"><i class="fa-solid fa-globe"></i> = pubblico, condivisibile per link e QR</p>
                </div>
                <div class="cd-elenco-pc">
                    ${sezione('Binder', elBinder)}${elBinder.map(riga).join('')}
                    ${sezione('Scaffali', elScaffali)}${elScaffali.map(riga).join('')}
                </div>
            </div>
            <div class="cd-pane" id="condividiDettaglio"></div>
        </div>`;

    // Pannello del PC: pronto subito sull'elemento scelto (senza contare
    // come "QR generato" per le missioni: lo conta il gesto esplicito).
    const sel = _condividiElementi.find(e => e.key === _condividiSelKey);
    const pane = document.getElementById('condividiDettaglio');
    if (sel && pane) _condividiRenderDettaglio(sel, pane, false, false);
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
// (navigation-condivisione.ui.js) — duplicata qui apposta invece di
// refactorizzare quella funzione (lei legge lo stato globale di
// navigazione, qui serve il link per un elemento scelto da una lista).
// Regola d'Oro #1: duplicazione locale invece di refactoring cross-file.
// idParamNome: 'binder' o 'scaffale' (scaffali-pubblico.html legge 'scaffale').
// RESTYLE FASE 3e: ?nome= porta il NICKNAME (mai l'email); senza nickname
// il parametro non c'è.
async function _linkCondivisioneWidget(pagina, idParamNome, id, tipoBinder) {
    const sessione = await authGetSession();
    const userId = sessione?.user?.id;
    if (!userId) return null;
    const url = new URL(pagina + '?u=' + encodeURIComponent(userId), window.location.href);
    if (id) url.searchParams.set(idParamNome, id);
    const temaSalvato = prefSiteThemeGet();
    if (temaSalvato) url.searchParams.set('tema', temaSalvato);
    if (prefDarkModeGet()) url.searchParams.set('scuro', '1');
    if (tipoBinder === 'wishlist' && _condividiNick) {
        url.searchParams.set('nome', _condividiNick);
    }
    return url.href;
}

let _condividiLinkCorrente = null;

// ── Foglio di condivisione (telefono) ───────────────────────────────────
// Stesso modale di prima, riposizionato sul rettangolo VERO di #phoneScreen
// (_rettangoloSchermoCornice), ora disegnato come foglio dal basso.
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

// Scelta di un elemento (tocco sul telefono, clic sulla riga su PC).
async function _condividiScegli(key) {
    const el = _condividiElementi.find(e => e.key === key);
    if (!el) return;
    _condividiSelKey = key;
    if (_condividiEPC()) {
        document.querySelectorAll('#condividi .cd-riga').forEach(r => r.classList.toggle('sel', r.dataset.key === key));
        const pane = document.getElementById('condividiDettaglio');
        if (pane) await _condividiRenderDettaglio(el, pane, false, true);
    } else {
        const dest = document.getElementById('condividiShareContenuto');
        if (!dest) return;
        dest.innerHTML = '';
        apriCondividiPannelloShare();
        await _condividiRenderDettaglio(el, dest, true, true);
    }
}

// Disegna il dettaglio di un elemento dentro 'dest'. foglio = true per il
// foglio del telefono. conta = true se è un gesto dell'utente (conta per la
// missione "QR Hunter" quando il QR viene davvero generato).
async function _condividiRenderDettaglio(el, dest, foglio, conta) {
    const nome = escapeHtml(el.nome);
    const chiudi = foglio ? '<button type="button" class="cd-chiudi" onclick="chiudiCondividiPannelloShare()" aria-label="Chiudi"><i class="fa-solid fa-xmark"></i></button>' : '';
    const stato = _condividiElStato(el);
    const paginaImp = el.kind === 'scaffale' ? 'scaffali' : 'binder';
    const impEtichetta = el.kind === 'scaffale' ? 'Vai agli Scaffali' : 'Vai ai Binder';

    if (!el.pubblico) {
        dest.innerHTML = `
            <div class="cd-det${foglio ? ' cd-det-foglio' : ''}">
                ${chiudi}
                <div class="cd-privato-corpo">
                    ${_condividiCoverHtml(el)}
                    <div class="cd-det-nome">${nome} è privato</div>
                    <p class="cd-det-sotto">Solo tu lo vedi. Rendilo pubblico per avere il link e il QR: chi lo apre lo sfoglia e può chiederti uno scambio.</p>
                    <button type="button" class="cd-btn cd-btn-pieno" onclick="_condividiRendiPubblico('${escapeJsAttr(el.key)}')"><i class="fa-solid fa-globe"></i> Rendi pubblico</button>
                    <p class="cd-det-sotto" style="font-size:0.78rem;">Puoi tornare privato quando vuoi, dalle impostazioni.</p>
                </div>
            </div>`;
        _condividiQrEl = null;
        _condividiLinkCorrente = null;
        return;
    }

    const link = await _linkCondivisioneWidget(el.pagina, el.param, el.id, el.tipo);
    if (!link) { alert('Devi essere loggato per condividere.'); return; }
    _condividiLinkCorrente = link;

    const chi = _condividiNick
        ? `<b>Compari come “${escapeHtml(_condividiNick)}”</b><span>il tuo nickname, mai l’email</span>`
        : `<b>Compari senza nome</b><span>imposta un nickname nelle Impostazioni per farti riconoscere</span>`;
    const scuro = (typeof prefDarkModeGet === 'function' && prefDarkModeGet());
    const nativo = !!navigator.share;

    dest.innerHTML = `
        <div class="cd-det${foglio ? ' cd-det-foglio' : ''}">
            ${chiudi}
            <div class="cd-det-testa">
                ${_condividiCoverHtml(el, true)}
                <div class="cd-det-titoli">
                    <div class="cd-det-nome">${nome}</div>
                    <div class="cd-det-sotto">${stato}${el.kind === 'binder' ? ' · chi apre il link lo sfoglia come un libro e può chiederti uno scambio' : ' · chi apre il link vede i prodotti e può chiederti uno scambio'}</div>
                </div>
            </div>
            <div class="cd-det-corpo">
                <div class="cd-qr-col">
                    <div class="cd-qr" id="condividiQrContainer"></div>
                    <button type="button" class="cd-btn cd-solo-pc" onclick="_condividiScaricaQr()"><i class="fa-solid fa-download"></i> Scarica QR</button>
                </div>
                <div class="cd-det-azioni">
                    <div class="cd-link cd-solo-pc"><i class="fa-solid fa-link"></i><input type="text" id="condividiLinkInput" readonly value="${escapeHtml(link)}"><button type="button" class="cd-btn cd-btn-pieno" onclick="_copiaLinkCondividiWidget()"><i class="fa-solid fa-copy"></i> Copia</button></div>
                    <div class="cd-bottoni">
                        ${nativo ? '<button type="button" class="cd-btn cd-btn-pieno cd-btn-largo" onclick="_condividiNativoWidget()"><i class="fa-solid fa-share-nodes"></i> Condividi…</button>' : ''}
                        <button type="button" class="cd-btn cd-solo-pc" onclick="_condividiApriAnteprima()"><i class="fa-solid fa-arrow-up-right-from-square"></i> Apri anteprima</button>
                        <button type="button" class="cd-btn cd-solo-sheet" onclick="_copiaLinkCondividiWidget()"><i class="fa-solid fa-copy"></i> Copia link</button>
                        <button type="button" class="cd-btn cd-solo-sheet" onclick="_condividiScaricaQr()"><i class="fa-solid fa-download"></i> Scarica QR</button>
                    </div>
                    <div class="cd-info"><i class="fa-solid fa-user"></i><div>${chi}</div></div>
                    <div class="cd-info"><i class="fa-solid fa-palette"></i><div><b>Con i tuoi colori${scuro ? ', tema scuro' : ''}</b><span>chi apre il link vede ${el.kind === 'binder' ? 'il binder' : 'lo scaffale'} come lo vedi tu</span></div></div>
                </div>
            </div>
            ${el.fisso ? '' : `<div class="cd-det-piede cd-solo-pc"><span>Per renderlo privato: impostazioni ${el.kind === 'binder' ? 'del binder' : 'dello scaffale'}</span><button type="button" class="cd-btn" onclick="apriDettaglioWidget('${paginaImp}', event)"><i class="fa-solid fa-gear"></i> ${impEtichetta}</button></div>`}
        </div>`;

    const qrContainer = dest.querySelector('.cd-qr');
    _condividiQrEl = qrContainer;
    try { new QRCode(qrContainer, { text: link, width: 168, height: 168, colorDark: '#2a2438', colorLight: '#ffffff' }); }
    catch (e) { console.error('[condividi] QR non generato:', e); qrContainer.textContent = 'QR non disponibile'; }

    if (conta) {
        // Missione #29 "QR Hunter" (2026-08-30). Fire-and-forget, stesso
        // pattern degli altri hook missioni — un fallimento qui non deve mai
        // bloccare la generazione del QR, già avvenuta sopra.
        (async () => {
            try {
                const userId = await authGetUserId();
                if (userId) await missioniQrGeneratoRegistra(userId);
            } catch (e) { console.error('[missioni] registrazione QR generato:', e); }
        })();
    }
}

// "Rendi pubblico": stessa scrittura delle Impostazioni (binder/scaffale).
async function _condividiRendiPubblico(key) {
    const el = _condividiElementi.find(e => e.key === key);
    if (!el) return;
    const userId = await authGetUserId();
    if (!userId) return;
    const { error } = el.kind === 'binder'
        ? await binderImpostaPubblicazione(userId, el.id, true)
        : await scaffaleImpostaPubblicazione(userId, el.id, true);
    if (error) { alert('Errore: ' + error.message); return; }
    const origine = el.kind === 'binder'
        ? (_bindersElenco || []).find(b => String(b.id) === String(el.id))
        : (_scaffaliElenco || []).find(sc => String(sc.id) === String(el.id));
    if (origine) { origine.stato_pubblicazione = 'pubblico'; origine.condivisibile = true; }
    chiudiCondividiPannelloShare();
    await renderPaginaCondividi();
    if (!_condividiEPC()) await _condividiScegli(key);
}

// "Scarica QR": salva il QR mostrato come immagine PNG.
function _condividiScaricaQr() {
    if (!_condividiQrEl) return;
    const canvas = _condividiQrEl.querySelector('canvas');
    const img = _condividiQrEl.querySelector('img');
    const href = canvas ? canvas.toDataURL('image/png') : (img ? img.src : null);
    if (!href) return;
    const el = _condividiElementi.find(e => e.key === _condividiSelKey);
    const a = document.createElement('a');
    a.href = href;
    a.download = 'qr-' + String(el ? el.nome : 'condividi').replace(/[^\w\-]+/g, '_') + '.png';
    document.body.appendChild(a); a.click(); a.remove();
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

function _condividiApriAnteprima() {
    if (_condividiLinkCorrente) window.open(_condividiLinkCorrente, '_blank');
}

async function _condividiNativoWidget() {
    if (!_condividiLinkCorrente) return;
    try { await navigator.share({ title: 'Bindex', url: _condividiLinkCorrente }); }
    catch (e) { /* utente ha annullato, o browser l'ha bloccata — normale, nessun errore da mostrare */ }
}
