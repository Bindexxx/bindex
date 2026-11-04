// Binder: griglia dei binder e vista a pagine.

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
}

async function _garantisciTuttiIBinder(userId) {
    const { data: locations, error: errLoc } = await locationsList(userId);
    if (errLoc) { console.error('_garantisciTuttiIBinder (locations):', errLoc.message); }
    const nomiLocation = (locations || []).map(l => l.nome).filter(Boolean);

    const risultati = await Promise.all([
        binderLocationMaterializzaBatch(userId, nomiLocation),
        binderWishlistGarantisci(userId),
        binderExtraGarantisci(userId, 'Il mio binder'),
        binderScambioGarantisci(userId),
    ]);
    risultati.forEach(({ error }) => { if (error) console.error('_garantisciTuttiIBinder:', error.message); });
}

let _bindersFiltroTesto = '';
let _bindersSelezionato = null;

function _bindersPcLarghezza() {
    const el = document.getElementById('binder');
    return !!el && el.clientWidth >= 780;
}

function _bindersCartePerStat(binder, idsBinder) {
    if (binder.tipo === 'location') return carteReali.filter(c => c.tabella === 'carte' && c.stato === 'collezione' && c.location === binder.location_valore);
    if (binder.tipo === 'wishlist') return carteReali.filter(c => c.tabella === 'wishlist');
    const ids = new Set((idsBinder || []).map(String));
    return carteReali.filter(c => c.tabella === 'carte' && ids.has(String(c.id)));
}

async function _calcolaStatBinder(userId, binder) {
    let ids = null;
    if (binder.tipo === 'extra' || binder.tipo === 'scambio') {
        const { data, error } = await binderCarteQuery(userId, binder.id);
        if (error) console.error('_calcolaStatBinder:', error.message);
        ids = (data || []).map(r => r.carta_id);
    }
    const carte = _bindersCartePerStat(binder, ids);
    const n = (binder.tipo === 'extra' || binder.tipo === 'scambio') ? (ids || []).length : carte.length;
    const valore = carte.reduce((t, c) => t + (Number(c.price) || 0) * (Number(c.qty) || 1), 0);
    return { n, valore };
}

function _bindersCopertinaHtml(binder, copertinaUrl, grande) {
    const nome = escapeHtml(binder.nome || '');
    const colore = (typeof _binderColore === 'function') ? _binderColore(binder) : '#7F77DD';
    const pubblico = binder.stato_pubblicazione === 'pubblico';
    const sfondo = `<i class="bn-icona fa-solid ${_iconaFallbackBinder(binder.tipo)}"></i>` +
        (copertinaUrl ? `<img class="bn-foto" src="${copertinaUrl}" alt="" loading="lazy" onerror="this.remove();">` : '');
    return `<div class="bn-cop${grande ? ' bn-cop-grande' : ''}${copertinaUrl ? ' con-foto' : ''}" style="--bn-colore:${colore}">
        <span class="bn-dorso"></span>${sfondo}
        ${pubblico ? '<b class="bn-globo fa-solid fa-globe" title="Pubblico"></b>' : ''}
        <span class="bn-etichetta">${nome}</span>
    </div>`;
}

function bindersImpostaFiltro(testo) {
    _bindersFiltroTesto = String(testo || '').trim().toLowerCase();
    renderGrigliaBinders();
}

function bindersToggleRicerca() {
    const box = document.getElementById('bindersRicercaBox');
    if (!box) return;
    const aperto = box.style.display !== 'none';
    box.style.display = aperto ? 'none' : '';
    if (aperto) { const inp = document.getElementById('bindersRicercaInput'); if (inp) inp.value = ''; bindersImpostaFiltro(''); }
    else { const inp = document.getElementById('bindersRicercaInput'); if (inp) inp.focus(); }
}

function bindersTessera(binderId, evt) {
    if (evt && evt.detail === 2) return;
    if (_bindersPcLarghezza()) {
        _bindersSelezionato = binderId;
        renderGrigliaBinders();
    } else {
        apriBinderDettaglio(binderId);
    }
}

function bindersImpostazioniDa(binderId) {
    apriBinderDettaglio(binderId).then(() => { if (typeof apriImpostazioniBinderAttivo === 'function') apriImpostazioniBinderAttivo(); });
}

async function renderGrigliaBinders() {
    const userId = await authGetUserId();
    const griglia = document.getElementById('bindersContenitoriGrid');
    if (!griglia) { console.error('renderGrigliaBinders: manca #bindersContenitoriGrid in index.html'); return; }

    if (_bindersElenco.length === 0) {
        griglia.innerHTML = '<div class="stato-vuoto"><i class="fa-solid fa-layer-group"></i><br>Nessun binder ancora — aggiungi una carta con una Location per crearne uno in automatico.</div>';
        return;
    }

    const righe = await Promise.all(_bindersElenco.map(async binder => {
        const [stat, copertinaUrl] = await Promise.all([
            _calcolaStatBinder(userId, binder),
            _risolviCopertinaBinder(userId, binder),
        ]);
        return { binder, stat, copertinaUrl };
    }));

    const riepilogo = document.getElementById('bindersRiepilogo');
    if (riepilogo) {
        const carteTot = righe.reduce((t, r) => t + r.stat.n, 0);
        const pub = righe.filter(r => r.binder.stato_pubblicazione === 'pubblico').length;
        riepilogo.innerHTML = `<b>${righe.length} binder</b> · ${carteTot} cart${carteTot === 1 ? 'a' : 'e'}${pub ? ` · ${pub} pubblic${pub === 1 ? 'o' : 'i'}` : ''}`;
    }

    const visibili = righe.filter(r => !_bindersFiltroTesto || String(r.binder.nome || '').toLowerCase().includes(_bindersFiltroTesto));
    const pc = _bindersPcLarghezza();
    const tessera = ({ binder, stat, copertinaUrl }) => {
        const idAttr = String(binder.id).replace(/'/g, "\\'");
        const nomeAttr = escapeHtml(binder.nome || '');
        const sel = pc && String(_bindersSelezionato) === String(binder.id);
        return `
            <div class="bn-tessera${sel ? ' selezionata' : ''}" onclick="bindersTessera('${idAttr}', event)" ondblclick="apriBinderDettaglio('${idAttr}')" title="${nomeAttr}">
                ${_bindersCopertinaHtml(binder, copertinaUrl, false)}
                <div class="bn-nome">${nomeAttr}</div>
                <div class="bn-sotto">${stat.n} cart${stat.n === 1 ? 'a' : 'e'}</div>${stat.valore > 0 ? `<div class="bn-sotto">${formattaEuro(stat.valore)}</div>` : ''}
            </div>`;
    };
    const speciali = visibili.filter(r => r.binder.tipo !== 'location').sort((a, b) => ({ extra: 0, wishlist: 1, scambio: 2 }[a.binder.tipo] ?? 9) - ({ extra: 0, wishlist: 1, scambio: 2 }[b.binder.tipo] ?? 9));
    const location = visibili.filter(r => r.binder.tipo === 'location').sort((a, b) => String(a.binder.nome || '').localeCompare(String(b.binder.nome || ''), 'it'));
    const sezione = (titolo, lista) => lista.length ? `<p class="bn-sez">${titolo}</p><div class="bn-righe">${lista.map(tessera).join('')}</div>` : '';

    let anteprima = '';
    if (pc) {
        const sel = righe.find(r => String(r.binder.id) === String(_bindersSelezionato));
        if (sel) {
            const b = sel.binder, idAttr = String(b.id).replace(/'/g, "\\'");
            const tipoTxt = { location: 'Location', wishlist: 'Wishlist', scambio: 'Scambio', extra: 'Il mio binder' }[b.tipo] || '';
            anteprima = `<aside class="bn-anteprima">
                <div class="bn-ant-testa">${_bindersCopertinaHtml(b, sel.copertinaUrl, true)}
                    <div><h4>${escapeHtml(b.nome || '')}</h4>
                    <p><b>${sel.stat.n} cart${sel.stat.n === 1 ? 'a' : 'e'}</b>${sel.stat.valore > 0 ? ' · ' + formattaEuro(sel.stat.valore) : ''}</p>
                    <p class="bn-chip-riga"><span>${tipoTxt}</span>${b.stato_pubblicazione === 'pubblico' ? '<span><i class="fa-solid fa-globe"></i> Pubblico</span>' : '<span>Privato</span>'}${BINDER_LAYOUTS[b.layout] ? `<span>${escapeHtml(b.layout)}</span>` : ''}</p></div>
                </div>
                <button type="button" class="btn-main" onclick="apriBinderDettaglio('${idAttr}')"><i class="fa-solid fa-book-open"></i> Apri binder</button>
                <button type="button" class="btn-secondary" onclick="bindersImpostazioniDa('${idAttr}')"><i class="fa-solid fa-gear"></i> Impostazioni</button>
                ${b.stato_pubblicazione === 'pubblico' ? `<button type="button" class="btn-secondary" onclick="bindersApriCondividi('${idAttr}')"><i class="fa-solid fa-share-nodes"></i> Link e QR</button>` : ''}
                ${b.tipo === 'location' ? '<p class="bn-nota">I binder Location si riempiono da soli con le carte di quella location.</p>' : ''}
            </aside>`;
        } else {
            anteprima = '<aside class="bn-anteprima bn-vuota"><p>Clicca un binder per l\u2019anteprima, doppio clic per aprirlo.</p></aside>';
        }
    }
    griglia.innerHTML = `<div class="bn-colonna">${sezione('SPECIALI', speciali)}${sezione('LOCATION', location)}
        ${visibili.length ? '<p class="bn-legenda"><i class="fa-solid fa-globe"></i> = pubblico · ' + (pc ? 'clic per l\u2019anteprima, doppio clic per aprirlo' : 'tocca un binder per aprirlo') + '</p>' : '<p class="bn-legenda">Nessun binder con questo nome.</p>'}
    </div>${anteprima}`;
}

function _iconaFallbackBinder(tipo) {
    if (tipo === 'wishlist') return 'fa-heart';
    if (tipo === 'extra') return 'fa-star';
    if (tipo === 'scambio') return 'fa-right-left';
    return 'fa-box-open';
}

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

async function apriBinderDettaglio(binderId) {
    _binderAttivo = binderId;
    _binderPagina = 0;

    document.getElementById('bindersContenitoriGrid').style.display = 'none';
    document.getElementById('binder')?.classList.add('binder-dettaglio-attivo');
    const wrapDettaglio = document.getElementById('binderDettaglioWrap');
    if (wrapDettaglio) wrapDettaglio.style.display = 'flex';

    const binder = _bindersElenco.find(b => String(b.id) === String(binderId));
    if (!binder) return;

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
    _binderSincronizzaTesta();
    await caricaDesignBinderAttivo();
}

function _aggiornaControlliRinominaPubblicazioneCondivisione(binder) {
    const rinominaWrap = document.getElementById('binderRinominaWrap');
    if (rinominaWrap) rinominaWrap.style.display = 'none';

    const eGiaPubblicoFisso = binder.tipo === 'wishlist' || binder.tipo === 'scambio' || (binder.tipo === 'location' && binder.location_valore === 'SCAMBIO');
    const pubblicazioneWrap = document.getElementById('binderPubblicazioneWrap');
    if (pubblicazioneWrap) {
        pubblicazioneWrap.style.display = eGiaPubblicoFisso ? 'none' : 'flex';
        const checkbox = document.getElementById('binderPubblicazioneCheckbox');
        if (checkbox) checkbox.checked = binder.stato_pubblicazione === 'pubblico';
    }

    const haPaginaPubblica = true;
    const ePubblico = binder.stato_pubblicazione === 'pubblico';

    const condivisioneWrap = document.getElementById('binderCondivisioneWrap');
    if (condivisioneWrap) condivisioneWrap.style.display = (ePubblico && haPaginaPubblica) ? 'flex' : 'none';

    const condivisioneNonDisponibileWrap = document.getElementById('binderCondivisioneNonDisponibileWrap');
    if (condivisioneNonDisponibileWrap) condivisioneNonDisponibileWrap.style.display = 'none';
}

function _binderEscludiValoreSincronizza(binder) {
    const riga = document.getElementById('binderEscludiValoreRiga');
    const check = document.getElementById('binderEscludiValoreCollezioneCheckbox');
    const msg = document.getElementById('binderEscludiValoreMsg');
    if (msg) msg.textContent = '';
    if (riga) riga.style.display = binder && binder.tipo === 'wishlist' ? 'none' : 'flex';
    if (check && binder) check.checked = !!binder.escludi_valore_collezione;
}

async function impostaEscludiValoreBinderAttivo(escludi) {
    const binder = _bindersElenco.find(b => String(b.id) === String(_binderAttivo));
    if (!binder) return;
    const check = document.getElementById('binderEscludiValoreCollezioneCheckbox');
    const msg = document.getElementById('binderEscludiValoreMsg');
    const userId = await authGetUserId();
    if (!userId) return;
    const { error } = await binderImpostaEscludiValore(userId, binder.id, escludi);
    if (error) {
        console.error('impostaEscludiValoreBinderAttivo:', error.message);
        if (check) check.checked = !escludi;
        if (msg) msg.textContent = 'Non sono riuscito a salvare (la colonna sul database potrebbe non esistere ancora).';
        return;
    }
    binder.escludi_valore_collezione = !!escludi;
    if (typeof _widgetBinderCache !== 'undefined') _widgetBinderCache = null;
    if (typeof caricaCarteReali === 'function') await caricaCarteReali();
}

async function impostaPubblicazioneBinderAttivo(pubblico) {
    const binder = _bindersElenco.find(b => String(b.id) === String(_binderAttivo));
    if (!binder) return;

    const userId = await authGetUserId();
    if (!userId) return;

    const { error } = await binderImpostaPubblicazione(userId, binder.id, pubblico);
    if (error) {
        console.error('impostaPubblicazioneBinderAttivo:', error.message);
        const checkbox = document.getElementById('binderPubblicazioneCheckbox');
        if (checkbox) checkbox.checked = !pubblico;
        return;
    }
    binder.stato_pubblicazione = pubblico ? 'pubblico' : 'privato';
    binder.condivisibile = pubblico;
    _aggiornaControlliRinominaPubblicazioneCondivisione(binder);
}

function tornaAllaGrigliaBinders() {
    _binderAttivo = null;
    chiudiImpostazioniBinderAttivo();
    _libroSmonta();
    document.getElementById('binder')?.classList.remove('binder-dettaglio-attivo');
    const wrapDettaglio = document.getElementById('binderDettaglioWrap');
    if (wrapDettaglio) wrapDettaglio.style.display = 'none';
    document.getElementById('bindersContenitoriGrid').style.display = '';
}

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
    _binderImpostazioniTab('generali');
    _binderColoreDisegnaScelte();
    _binderEscludiValoreSincronizza(_bindersElenco.find(b => String(b.id) === String(_binderAttivo)));
}

function _binderColoreDisegnaScelte() {
    const box = document.getElementById('binderColoreScelte');
    if (!box) return;
    const binder = _bindersElenco.find(b => String(b.id) === String(_binderAttivo));
    if (!binder) { box.innerHTML = ''; return; }
    const attuale = (binder.colore || '').toLowerCase();
    const tinte = (typeof _BALL_TAVOLOZZA !== 'undefined') ? _BALL_TAVOLOZZA : [];
    box.innerHTML = `<button type="button" class="bn-colore-btn bn-colore-auto${attuale ? '' : ' attivo'}" onclick="binderSceltaColore(null)">Automatico</button>` +
        tinte.map(t => `<button type="button" class="bn-colore-btn${attuale === t.toLowerCase() ? ' attivo' : ''}" style="background:${t}" aria-label="Colore ${t}" onclick="binderSceltaColore('${t}')"></button>`).join('');
}

async function binderSceltaColore(colore) {
    const binder = _bindersElenco.find(b => String(b.id) === String(_binderAttivo));
    const msg = document.getElementById('binderColoreMsg');
    if (!binder) return;
    const userId = await authGetUserId();
    if (!userId) return;
    const { error } = await binderImpostaColore(userId, binder.id, colore);
    if (error) {
        console.error('binderSceltaColore:', error.message);
        if (msg) msg.textContent = 'Non sono riuscito a salvare il colore (la colonna sul database potrebbe non esistere ancora).';
        return;
    }
    binder.colore = colore || null;
    if (msg) msg.textContent = '';
    _binderColoreDisegnaScelte();
    if (typeof _widgetBinderCache !== 'undefined') _widgetBinderCache = null;
    if (typeof renderGrigliaBinders === 'function') renderGrigliaBinders();
}

function chiudiImpostazioniBinderAttivo() {
    const modal = document.getElementById('binderImpostazioniModal');
    if (modal) modal.style.display = 'none';
    if (_binderImpostazioniResizeHandler) {
        window.removeEventListener('resize', _binderImpostazioniResizeHandler);
        _binderImpostazioniResizeHandler = null;
    }
}

function _binderImpostazioniTab(tab) {
    document.querySelectorAll('#binderImpostazioniTabs .binder-modalita-btn').forEach(el => {
        el.classList.toggle('active', el.dataset.itab === tab);
    });
    const generali = document.getElementById('binderImpostazioniTabGenerali');
    const design = document.getElementById('binderImpostazioniTabDesign');
    if (generali) generali.style.display = tab === 'generali' ? '' : 'none';
    if (design) design.style.display = tab === 'design' ? '' : 'none';
    if (tab !== 'design') _binderSleeveChiudiEditor();
}

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

let _carteBinderAttivoCache = [];

async function _caricaCarteBinderAttivo(binder) {
    const userId = await authGetUserId();

    if (binder.tipo === 'location') {
        _carteBinderAttivoCache = carteReali
            .filter(c => c.tabella === 'carte' && c.stato === 'collezione' && c.location === binder.location_valore)
            .map(c => ({ id: c.id, name: c.name || c.nome, immagine: c.immagine, qty: c.qty, createdAt: c.createdAt, code: c.code, lang: c.lang, cond: c.cond, price: c.price }));
        return;
    }

    if (binder.tipo === 'wishlist') {
        const { data, error } = await wishlistQueryTutte(userId);
        if (error) { console.error('_caricaCarteBinderAttivo (wishlist):', error.message); _carteBinderAttivoCache = []; return; }
        _carteBinderAttivoCache = (data || []).map(r => ({ id: r.id, name: r.nome, immagine: r.immagine, qty: r.qty, createdAt: r.created_at, code: r.codice || '', lang: r.lingua || '', cond: r.condizione || '', price: r.prezzo != null ? Number(r.prezzo) : 0 }));
        return;
    }

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
        .map(c => ({ id: c.id, name: c.name || c.nome, immagine: c.immagine, qty: c.qty, createdAt: c.createdAt, code: c.code, lang: c.lang, cond: c.cond, price: c.price, quantitaOfferta: usaQuantita ? mappaQuantita[String(c.id)] : undefined }));
}

function renderBinderContenuto() {
    const forzaElenco = _carteBinderAttivoCache.length > SOGLIA_BINDER_SOLO_ELENCO;
    const modalitaEffettiva = forzaElenco ? 'elenco' : _binderModalita;

    const avvisoEl = document.getElementById('binderSoglioAvviso');
    if (avvisoEl) {
        avvisoEl.style.display = forzaElenco ? 'block' : 'none';
        if (forzaElenco) avvisoEl.textContent = `Questo binder ha più di ${SOGLIA_BINDER_SOLO_ELENCO} carte: solo la modalità elenco è disponibile qui dentro.`;
    }

    const layoutSwitcher = document.querySelector('.binder-layout-switcher');
    if (layoutSwitcher) layoutSwitcher.style.display = 'flex';
    const notaGriglia = document.getElementById('binderLayoutNota');
    if (notaGriglia) notaGriglia.style.display = modalitaEffettiva === 'elenco' ? '' : 'none';
    document.querySelectorAll('#binderImpostazioniModal .binder-modalita-btn[data-modalita]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.modalita === modalitaEffettiva);
    });
    document.querySelectorAll('.binder-layout-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.layout === _binderLayout);
    });

    if (modalitaEffettiva === 'elenco') {
        renderBinderElenco();
    } else {
        renderBinderLibro();
    }
}

function _binderSincronizzaTesta() {
    const binder = _bindersElenco.find(b => String(b.id) === String(_binderAttivo));
    const sotto = document.getElementById('binderDettaglioSotto');
    if (sotto && binder) {
        const n = _carteBinderAttivoCache.length;
        const valore = _carteBinderAttivoCache.reduce((t, c) => t + (Number(c.price) || 0) * (Number(c.qty) || 1), 0);
        sotto.innerHTML = `${n} cart${n === 1 ? 'a' : 'e'}${valore > 0 ? ' · ' + formattaEuro(valore) : ''}${binder.stato_pubblicazione === 'pubblico' ? ' · <i class="fa-solid fa-globe"></i>' : ''}`;
    }
    const cond = document.getElementById('binderCondividiBtn');
    if (cond) cond.style.display = (binder && binder.stato_pubblicazione === 'pubblico') ? '' : 'none';
    const effettiva = _carteBinderAttivoCache.length > SOGLIA_BINDER_SOLO_ELENCO ? 'elenco' : _binderModalita;
    document.querySelectorAll('#binderSegm button').forEach(b => b.classList.toggle('active', b.dataset.m === effettiva));
}

async function impostaModalitaBinder(modalita) {
    if (modalita !== 'immagini' && modalita !== 'elenco') return;
    _binderModalita = modalita;
    const userId = await authGetUserId();
    if (userId) {
        const { error } = await userSettingsUpsertBinderModalita(userId, modalita);
        if (error) console.error('impostaModalitaBinder:', error.message);
    }
    if (_binderAttivo) { renderBinderContenuto(); _binderSincronizzaTesta(); }
}

async function toggleBinderMembership(id) {
    const card = carteReali.find(c => String(c.id) === String(id));
    if (!card || card.tabella !== 'carte' || card.stato !== 'collezione') return;
    if (!_binderExtraId) { console.error('toggleBinderMembership: binder extra non ancora pronto'); return; }

    const giaNelBinder = _idsNelBinder.has(String(id));
    if (giaNelBinder) {
        if (!(await chiediConferma({ titolo: 'Togliere dal binder?', testo: `"${card.name}" esce dal tuo binder personale (resta in collezione).`, conferma: 'Togli' }))) return;
    }

    const userId = await authGetUserId();
    if (!userId) return;

    if (giaNelBinder) {
        const { error } = await binderCarteDeleteOne(userId, _binderExtraId, id);
        if (error) { mostraAvviso('❌ Errore nel rimuovere la carta dal Binder: ' + error.message); return; }
        _idsNelBinder.delete(String(id));
    } else {
        const { error } = await binderCarteInsert({ owner_id: userId, binder_id: _binderExtraId, carta_id: id });
        if (error) { mostraAvviso('❌ Errore nell\'aggiungere la carta al Binder: ' + error.message); return; }
        _idsNelBinder.add(String(id));
    }

    _aggiornaBottoniBinderToggle(id);

    const binderAperto = _bindersElenco.find(b => String(b.id) === String(_binderAttivo));
    if (binderAperto && binderAperto.tipo === 'extra') {
        await _caricaCarteBinderAttivo(binderAperto);
        renderBinderContenuto();
    }
}

function _aggiornaBottoniBinderToggle(id) {
    const idAttr = String(id);
    const nelBinder = _idsNelBinder.has(idAttr);

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

async function rimuoviDalBinderExtra(cartaId) {
    await toggleBinderMembership(cartaId);
}

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

async function _applicaQuantitaScambio(cartaId, quantita) {
    const userId = await authGetUserId();
    if (!userId || !_binderScambioId) return;

    if (quantita <= 0) {
        const { error } = await binderCarteDeleteOne(userId, _binderScambioId, cartaId);
        if (error) { mostraAvviso('❌ Errore nel rimuovere la carta dallo Scambio: ' + error.message); return; }
        _idsInScambio.delete(String(cartaId));
        delete _quantitaOfferteScambio[String(cartaId)];
        _aggiornaBottoniScambioToggle(cartaId);
    } else {
        const cartaEsistente = carteReali.find(c => String(c.id) === String(cartaId) && c.tabella === 'carte');
        if (!cartaEsistente) { mostraAvviso('Carta non trovata.'); return; }
        const qtyOriginale = Number(cartaEsistente.qty) || 1;
        const N = Math.max(1, Math.min(quantita, qtyOriginale));

        const { error } = await _scambioSplitCartaVerso(cartaId, qtyOriginale, N, userId);
        if (error) { mostraAvviso('❌ Errore nell\'aggiornare la quantità offerta: ' + error.message); return; }

        await caricaCarteReali();
        filterTable();
    }

    const binderAperto = _bindersElenco.find(b => String(b.id) === String(_binderAttivo));
    if (binderAperto && binderAperto.tipo === 'scambio') {
        await _caricaCarteBinderAttivo(binderAperto);
        renderBinderContenuto();
    }
}

async function _scambioSplitCartaVerso(cartaId, qtyOriginale, N, userId) {
    if (N >= qtyOriginale) {
        const { error } = await binderCarteImpostaQuantitaScambio(userId, _binderScambioId, cartaId, qtyOriginale);
        return { error };
    }

    const { data: grezza, error: errLettura } = await cardsSelectById(cartaId);
    if (errLettura) return { error: errLettura };

    const nuovaRiga = { ...grezza };
    delete nuovaRiga.id;
    delete nuovaRiga.updated_at;
    nuovaRiga.owner_id = userId;
    nuovaRiga.qty = N;

    const { data: inserite, error: errInsert } = await cardsInsertNellaCollezione(nuovaRiga);
    if (errInsert) return { error: errInsert };
    const nuovoId = inserite && inserite[0] && inserite[0].id;
    if (!nuovoId) return { error: { message: 'Riga inserita ma id non restituito dal database.' } };

    const { error: errDecremento } = await cardsUpdateCampo('carte', cartaId, 'qty', qtyOriginale - N);
    if (errDecremento) return { error: errDecremento };

    const { error: errTag } = await binderCarteImpostaQuantitaScambio(userId, _binderScambioId, nuovoId, N);
    return { error: errTag };
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

let _binderElencoFiltro = '';
function _binderElencoImpostaFiltro(testo) {
    _binderElencoFiltro = String(testo || '');
    renderBinderElenco();
    const inp = document.getElementById('binderElencoCerca');
    if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
}

function renderBinderElenco() {
    const contenitore = document.getElementById('binderElencoBody');
    const binderGridEl = document.getElementById('binderGrid');
    if (!contenitore) { console.error('renderBinderElenco: manca #binderElencoBody in index.html'); return; }
    if (binderGridEl) binderGridEl.style.display = 'none';
    _libroSmonta();
    contenitore.style.display = '';

    const binder = _bindersElenco.find(b => String(b.id) === String(_binderAttivo));
    const permettiRimozione = binder && binder.tipo === 'extra';

    if (_carteBinderAttivoCache.length === 0) {
        contenitore.innerHTML = '<div class="stato-vuoto"><i class="fa-solid fa-layer-group"></i><br>Nessuna carta in questo binder.</div>';
        document.getElementById('binderPagination').style.display = 'none';
        return;
    }

    const testo = (_binderElencoFiltro || '').toLowerCase();
    const carte = _carteBinderAttivoCache
        .filter(c => !testo || String(c.name || '').toLowerCase().includes(testo) || String(c.code || '').toLowerCase().includes(testo))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const righe = carte.map(card => {
        const idAttr = String(card.id).replace(/'/g, "\\'");
        const idBinderAttr = String(_binderAttivo).replace(/'/g, "\\'");
        const immagineSrc = _urlImmagineVisualizzabile(card.immagine, 120);
        const meta = [card.code, card.lang, card.cond].filter(Boolean).map(escapeHtml).join(' · ') + (card.qty > 1 ? ` · ×${card.qty}` : '');
        return `
            <div class="bn-riga" onclick="apriFlipCardHome('${idAttr}', { binderId: '${idBinderAttr}' })">
                <span class="bn-thumb">${immagineSrc ? `<img src="${immagineSrc}" alt="" loading="lazy" onerror="this.style.display='none';">` : ''}<i class="fa-solid fa-magnifying-glass-plus bn-lente"></i></span>
                <span class="bn-riga-testo"><b>${escapeHtml(card.name || '')}</b><small>${meta}</small></span>
                <span class="bn-riga-prezzo">${card.price > 0 ? formattaEuro(card.price) : '—'}</span>
                ${permettiRimozione ? `<button class="riga-compatta-menu-btn" onclick="event.stopPropagation(); rimuoviDalBinderExtra('${idAttr}')" title="Rimuovi dal Binder"><i class="fa-solid fa-xmark"></i></button>` : ''}
            </div>`;
    }).join('');

    contenitore.innerHTML = `
        <div class="bn-ricerca-el"><i class="fa-solid fa-magnifying-glass"></i><input type="text" id="binderElencoCerca" placeholder="Cerca nel binder" value="${escapeHtml(_binderElencoFiltro || '')}" oninput="_binderElencoImpostaFiltro(this.value)"></div>
        <div class="bn-lista">${righe || '<p class="bn-vuoto-el">Nessuna carta con questo nome.</p>'}</div>
        <p class="bn-hint-el">Tocca una carta per vederla a tutto schermo</p>`;

    document.getElementById('binderPagination').style.display = 'none';
    document.getElementById('binderEmptyMsg').style.display = 'none';
}

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
async function cambiaLayoutBinder(layout) {
    if (!BINDER_LAYOUTS[layout]) return;
    _binderLayout = layout;
    renderBinderContenuto();
    const userId = await authGetUserId();
    if (!userId) return;
    const { error } = await binderAggiornaLayout(userId, _binderAttivo, layout);
    if (error) console.error('Errore nel salvare il layout del binder:', error.message);
}

const LIBRO_SOGLIA_DOPPIA_PX = 620;
const LIBRO_DURATA_GIRO_MS = 620;
const LIBRO_SOGLIA_DRAG_PX = 8;
const LIBRO_PAD_PAGINA = 10;
const LIBRO_GAP_TASCHE = 6;
const LIBRO_ALTEZZA_NUMERO = 16;

let _libro = null;
let _libroObserver = null;

function renderBinderLibro() {
    const wrap = document.getElementById('binderLibroWrap');
    if (!wrap) { console.error('renderBinderLibro: manca #binderLibroWrap in index.html'); return; }

    const griglia = document.getElementById('binderGrid');
    const elenco = document.getElementById('binderElencoBody');
    if (griglia) griglia.style.display = 'none';
    if (elenco) elenco.style.display = 'none';
    wrap.style.display = 'flex';

    const binder = _bindersElenco.find(b => String(b.id) === String(_binderAttivo));
    const layout = BINDER_LAYOUTS[_binderLayout] || BINDER_LAYOUTS['3x3'];

    const carte = _carteBinderAttivoCache.slice().sort((a, b) => {
        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return da - db;
    });

    const stessoBinder = !!(_libro && String(_libro.binderId) === String(_binderAttivo));
    const copertinaPrecedente = stessoBinder ? _libro.copertinaUrl : null;

    _libro = {
        binderId: _binderAttivo,
        binder,
        permettiRimozione: !!(binder && binder.tipo === 'extra'),
        eScambio: !!(binder && binder.tipo === 'scambio'),
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

    _libroMisura();
    _libro.facce = _libroCostruisciFacce();
    _libro.k = stessoBinder ? _libroKDaPagina(_binderPagina) : 0;
    _libroDisegnaStatico();
    _libroInitGesti();
    _libroOsservaResize();

    if (binder && !_libro.copertinaUrl) {
        authGetUserId()
            .then(userId => userId ? _risolviCopertinaBinder(userId, binder) : null)
            .then(url => {
                if (!url || !_libro || String(_libro.binderId) !== String(binder.id)) return;
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
    _libroObserver = new ResizeObserver(() => {
        if (!_libro || _libro.animando || _libro.drag) return;
        const modoPrima = _libro.modo;
        const paginaCorrente = _libroPaginaCorrente();
        _libroMisura();
        if (_libro.modo !== modoPrima) {
            _libro.facce = _libroCostruisciFacce();
            _libro.k = _libroKDaPagina(paginaCorrente);
        }
        _libroDisegnaStatico();
    });
    _libroObserver.observe(wrap);
}

function _libroMisura() {
    const wrap = document.getElementById('binderLibroWrap');
    const disponibile = (wrap && wrap.clientWidth) ? wrap.clientWidth : 320;
    _libro.modo = disponibile >= LIBRO_SOGLIA_DOPPIA_PX ? 'doppia' : 'singola';

    const cols = _libro.cols, rows = _libro.rows;
    let pw = _libro.modo === 'doppia' ? Math.floor(disponibile / 2) : disponibile;

    const altezzaDaLarghezza = (larghezza) => {
        const slotW = (larghezza - 2 * LIBRO_PAD_PAGINA - (cols - 1) * LIBRO_GAP_TASCHE) / cols;
        const slotH = slotW * 88 / 63;
        return Math.round(rows * slotH + (rows - 1) * LIBRO_GAP_TASCHE + 2 * LIBRO_PAD_PAGINA + LIBRO_ALTEZZA_NUMERO);
    };

    let ph = altezzaDaLarghezza(pw);

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

function _libroCostruisciFacce() {
    const facce = [{ t: 'copertina' }];
    if (_libro.modo === 'doppia') facce.push({ t: 'risguardo' });
    for (let i = 0; i < _libro.totalePagine; i++) facce.push({ t: 'pagina', i });
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

function _libroPaginaCorrente() {
    const destra = _libroFacciaDestraPer(_libro.k);
    if (destra && destra.t === 'pagina') return destra.i;
    const sinistra = _libroFacciaSinistraPer(_libro.k);
    if (sinistra && sinistra.t === 'pagina') return sinistra.i;
    return 0;
}

function _libroKDaPagina(pagina) {
    const p = Math.max(0, Math.min(Number(pagina) || 0, _libro.totalePagine - 1));
    const k = _libro.modo === 'doppia' ? Math.ceil((p + 2) / 2) : p + 1;
    return Math.max(0, Math.min(k, _libroNumFogli()));
}

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
        const nomeAttr = escapeHtml(card.name || '').replace(/"/g, '&quot;');
        const immagineSrc = _urlImmagineVisualizzabile(card.immagine, 300);
        tasche += `
            <div class="binder-slot binder-slot-filled" onclick="_libroClickCarta('${idAttr}')" title="${nomeAttr}">
                ${_libro.permettiRimozione ? `<button type="button" class="binder-slot-remove-btn" title="Rimuovi dal Binder" aria-label="Rimuovi dal Binder" onclick="event.stopPropagation(); rimuoviDalBinderExtra('${idAttr}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
                <div class="binder-slot-fallback"><i class="fa-solid fa-image"></i><span>${nomeAttr}</span></div>
                ${immagineSrc ? `<img src="${immagineSrc}" alt="${nomeAttr}" loading="lazy" draggable="false" onerror="this.remove();">` : ''}
                ${_libro.eScambio
                    ? `<button type="button" class="binder-slot-qty-badge binder-slot-scambio-badge" title="Cambia la quantità offerta in Scambio" aria-label="Quantità offerta: ${card.quantitaOfferta ?? 0}. Tocca per cambiarla" onclick="event.stopPropagation(); if (_libro && _libro.dragMosso) { _libro.dragMosso = false; return; } apriModaleQuantitaScambio('${idAttr}')"><i class="fa-solid fa-right-left"></i> ${card.quantitaOfferta ?? 0}</button>`
                    : (card.qty > 1 ? `<span class="binder-slot-qty-badge" title="Hai ${card.qty} copie di questa carta — occupano un solo slot">×${card.qty}</span>` : '')}
            </div>`;
    }

    return `
        <div class="libro-pagina-griglia" style="grid-template-columns: repeat(${_libro.cols}, 1fr);">${tasche}</div>
        <div class="libro-pagina-numero">${indicePagina + 1}</div>`;
}

function _libroClickCarta(id) {
    if (_libro && _libro.dragMosso) { _libro.dragMosso = false; return; }
    apriFlipCardHome(id, { binderId: _binderAttivo, nascondiVaiAlBinder: true });
}

function _libroPreparaFoglio(j, direzione) {
    const foglio = document.getElementById('binderLibroFoglio');
    const fronte = document.getElementById('binderLibroFronte');
    const retro = document.getElementById('binderLibroRetro');
    const sx = document.getElementById('binderLibroSx');
    const dx = document.getElementById('binderLibroDx');
    if (!foglio || !fronte || !retro || !sx || !dx) return;

    fronte.innerHTML = _libroHtmlFaccia(_libroFronteFoglio(j));
    retro.innerHTML = _libroHtmlFaccia(_libroRetroFoglio(j));

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
    void foglio.offsetWidth;
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
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > LIBRO_SOGLIA_DRAG_PX) { _libro.drag = null; return; }
        if (Math.abs(dx) < LIBRO_SOGLIA_DRAG_PX) return;

        const direzione = dx < 0 ? 1 : -1;
        if (direzione > 0 && !_libroPuoAvanti()) { _libro.drag = null; return; }
        if (direzione < 0 && !_libroPuoIndietro()) { _libro.drag = null; return; }

        d.deciso = true;
        d.direzione = direzione;
        _libro.dragMosso = true;
        _libroPreparaFoglio(direzione > 0 ? _libro.k : _libro.k - 1, direzione);
        const foglioNuovo = document.getElementById('binderLibroFoglio');
        foglioNuovo.classList.add('in-trascinamento');
        try { foglioNuovo.setPointerCapture(e.pointerId); } catch (_) {   }
    }

    const progresso = Math.max(0, Math.min(1, Math.abs(dx) / _libro.pw));
    d.progresso = progresso;
    const angolo = d.direzione > 0 ? -180 * progresso : -180 * (1 - progresso);
    const foglio = document.getElementById('binderLibroFoglio');
    foglio.style.transform = `rotateY(${angolo}deg)`;
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

async function bindersApriCondividi(binderId) {
    if (typeof apriDettaglioWidget !== 'function') return;
    apriDettaglioWidget('condividi', null);
    const key = 'b:' + binderId;
    for (let i = 0; i < 30; i++) {
        if (typeof _condividiElementi !== 'undefined' && Array.isArray(_condividiElementi) && _condividiElementi.find(e => e.key === key)) {
            if (typeof _condividiScegli === 'function') _condividiScegli(key);
            return;
        }
        await new Promise(r => setTimeout(r, 100));
    }
}
