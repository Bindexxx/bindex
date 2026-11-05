// Home: disegno della griglia e gestione dei widget.

const _WIDGET_SU_CARTE = new Set([
    'visualizzazione', 'carte_recenti', 'valore_collezione', 'variazione_valore', 'doppioni', 'location',
    'prezzi', 'prezzi_recenti', 'primo_piano', 'ultima_carta', 'wishlist_obiettivi', 'suggerimento',
    'foto', 'set_completamento',
]);

let _renderHomeInCorso = null;
let _renderHomeAccodato = null;
let _anteprimeTardiveDaRiusare = new Map();

function renderWidgetHome() {
    if (_renderHomeInCorso) {
        if (!_renderHomeAccodato) {
            _renderHomeAccodato = _renderHomeInCorso.catch(() => {}).then(() => {
                _renderHomeAccodato = null;
                return renderWidgetHome();
            });
        }
        return _renderHomeAccodato;
    }
    _renderHomeInCorso = _eseguiRenderWidgetHome().finally(() => { _renderHomeInCorso = null; });
    return _renderHomeInCorso;
}

async function _eseguiRenderWidgetHome() {
    if (!_layoutWidget) await _caricaLayoutWidget();

    const cont = document.getElementById('phoneWidgetPagine');
    if (!cont) return;

    if (_compattaPagineWidget()) _salvaLayoutWidget(false);

    const visibili = _layoutWidget.filter(w => w.visibile);
    const primoRender = !_primoRenderWidgetFatto;

    const misura = _misuraPaginaWidget();

    const attenzioni = {};
    const carteMancanti = typeof _carteNonCaricate === 'function' && _carteNonCaricate();
    const tettoAnteprimaMs = primoRender ? 1500 : 5000;
    const anteprimeInRitardo = new Map();
    const daRiusare = _anteprimeTardiveDaRiusare;
    _anteprimeTardiveDaRiusare = new Map();

    const tessere = await Promise.all(visibili.map(async (w, indice) => {
        const def = CATALOGO_WIDGET[w.id];
        if (!def) return '';
        let anteprima = { righe: ['—'] };
        if (carteMancanti && !def.bloccato && _WIDGET_SU_CARTE.has(w.id)) {
        } else if (!def.bloccato) {
            let timerTetto = null;
            try {
                const richiesta = (w.instanceId && daRiusare.get(w.instanceId)) || Promise.resolve(def.preview(w));
                const tetto = new Promise(ris => { timerTetto = setTimeout(() => { if (w.instanceId) anteprimeInRitardo.set(w.instanceId, richiesta); ris(null); }, tettoAnteprimaMs); });
                anteprima = (await Promise.race([richiesta, tetto])) || { righe: ['—'] };
            } catch (e) { console.error('Errore preview widget ' + w.id + ':', e); }
            finally { clearTimeout(timerTetto); }
        } else {
            anteprima = def.preview(w);
        }

        const classeStato = anteprima.stato === 'allerta' ? 'widget-tile-allerta' : (anteprima.stato === 'ok' ? 'widget-tile-ok' : '');
        const classeCascata = primoRender ? 'widget-tile-entrata' : '';
        const stileRitardo = primoRender ? `style="animation-delay:${Math.min(indice * 45, 400)}ms"` : '';

        const menuSpostaAperto = _menuSpostaWidgetApertoId === w.instanceId;
        const controlliEdit = _editModeWidget ? `
            <div class="widget-edit-controls" onclick="event.stopPropagation()">
                <button type="button" onclick="_nascondiWidget('${w.instanceId}')" title="Rimuovi dalla home" class="widget-edit-remove"><i class="fa-solid fa-xmark"></i></button>
                <button type="button" onclick="_toggleMenuSpostaWidget('${w.instanceId}', event)" title="Sposta"><i class="fa-solid fa-ellipsis-vertical"></i></button>
            </div>
            <div class="widget-menu-sposta${menuSpostaAperto ? ' aperto' : ''}" id="menuSposta_${w.instanceId}" onclick="event.stopPropagation()">
                <button type="button" onclick="_spostaWidgetNellaPagina('${w.instanceId}', -1)"><i class="fa-solid fa-arrow-up"></i> Sposta su</button>
                <button type="button" onclick="_spostaWidgetNellaPagina('${w.instanceId}', 1)"><i class="fa-solid fa-arrow-down"></i> Sposta giù</button>
                <button type="button" onclick="_spostaWidgetInPagina('${w.instanceId}', -1)" ${(w.pagina || 0) === 0 ? 'disabled' : ''}><i class="fa-solid fa-chevron-left"></i> Pagina precedente</button>
                <button type="button" onclick="_spostaWidgetInPagina('${w.instanceId}', 1)"><i class="fa-solid fa-chevron-right"></i> Pagina successiva</button>
                ${def.multiIstanza ? `<button type="button" onclick="_menuSpostaWidgetApertoId=null; _apriRicercaCartaVetrina('${w.instanceId}')"><i class="fa-solid fa-star"></i> Cambia carta</button>` : ''}
            </div>
            <div class="widget-resize-handle" data-widget-id="${w.instanceId}" title="Trascina per ridimensionare"><i class="fa-solid fa-up-right-and-down-left-from-center"></i></div>` : '';

        const nAzioni = Number(anteprima.azioni) || 0;
        const valoreBadge = nAzioni > 0 ? (nAzioni > 99 ? '99+' : String(nAzioni)) : null;
        const badge = (valoreBadge != null && prefBadgeWidgetGet()) ? `<div class="widget-badge">${valoreBadge}</div>` : '';

        const classeRarita = anteprima.rarita ? ` widget-tile-thumb-r-${String(anteprima.rarita).toLowerCase().replace(/\s+/g, '_')}` : '';
        const rigaImmagine = anteprima.immagine
            ? `<div class="widget-tile-thumb-row"><img class="widget-tile-thumb${classeRarita}" src="${_urlImmagineVisualizzabile(anteprima.immagine, 96) || ''}" alt="" onerror="this.style.display='none';"></div>`
            : '';

        const azioneClick = _editModeWidget || def.decorativo ? '' : `onclick="_eseguiAzioneWidget('${w.instanceId}', event)"`;

        const _t = _tagliaEffettiva(w, misura);
        const _ta = _tagliaAspettoWidget(w, misura);
        const _fotoVetrina = (w.id === 'ultima_carta' && anteprima.dati && !anteprima.dati.vuoto && typeof _ballCorpoFotoCarta === 'function')
            ? _ballCorpoFotoCarta(anteprima.dati) : '';
        const _iconaStatica = !_fotoVetrina && (w.mini || _ta.col < CELLE_MIN_PER_SFERA || _ta.row < 2);

        let visuale;
        let badgeSuSfera = false;
        if (BALL_ATTIVA && !anteprima.immagine && _iconaStatica) {
            const aspettoMini = _ballASPETTO[w.id] || { emblema: 'piu', colore: null };
            visuale = `
                <div class="pkdx-icon-wrap pkdx-ball-statica"><div class="pkdx-ball">
                    <div class="pkdx-ball-body">${_ballSvgCache(aspettoMini.emblema, aspettoMini.colore, null)}</div>
                </div>${badge}</div>`;
            badgeSuSfera = true;
        } else if (BALL_ATTIVA && !anteprima.immagine) {
            const aspetto = _ballASPETTO[w.id] || { emblema: 'piu', colore: null };
            let inciso = null;
            if (_ta.col <= 4 && _ta.row <= 2 && prefScritteBallGet()) {
                inciso = _ballTITOLI_BREVI[w.id] || def.titolo;
            }
            visuale = `
                <div class="pkdx-icon-wrap"><div class="pkdx-ball">
                    <span class="pkdx-ball-glow"></span>
                    <span class="pkdx-dust"></span>
                    <span class="ball-shadow"></span>
                    <span class="pkdx-avviso"><i class="a1">!</i><i class="a2">!</i><i class="a3">!</i></span>
                    <div class="pkdx-ball-body">${_ballSvgCache(aspetto.emblema, aspetto.colore, inciso)}</div>
                    <div class="ball-glass"><div class="ball-sweep"></div></div>
                    <span class="pkdx-lock-ring"></span>
                    <span class="pkdx-lock-ring ring-2"></span>
                    ${_ballParticelle()}
                </div>${badge}</div>`;
            badgeSuSfera = true;
        } else {
            visuale = `<i class="fa-solid ${def.icona} widget-tile-icon"></i>`;
        }

        attenzioni[w.instanceId] = _ballChiedeAttenzione(w.id, anteprima);

        const grande = BALL_ATTIVA && !_iconaStatica && !(_ta.col === 3 && _ta.row === 2);
        let corpo;
        if (_fotoVetrina) {
            corpo = `<div class="ball-slot-blocco ball-slot-foto">${_fotoVetrina}</div>`;
        } else if (grande) {
            const c = _ballCorpoWidget(w.id, anteprima);
            const senzaTesta = !!(anteprima.immagine && c.blocco);
            const titoloNelCorpo = /class="ball-k-tit"/.test(c.inline || '');
            corpo = `
                ${senzaTesta ? '' : `
                <div class="ball-testa">
                    ${visuale}
                    <div class="ball-slot-inline">
                        ${titoloNelCorpo ? '' : `<div class="widget-tile-titolo">${def.titolo}</div>`}
                        ${c.inline}
                    </div>
                </div>`}
                ${c.blocco ? `<div class="ball-slot-blocco">${c.blocco}</div>` : ''}`;
        } else {
            corpo = `
                ${visuale}
                ${rigaImmagine}
                <div class="widget-tile-testo">
                    <div class="widget-tile-titolo">${def.titolo}</div>
                    <div class="widget-tile-righe">${(anteprima.righe || []).map(r => `<span>${escapeHtml(r)}</span>`).join('')}</div>
                </div>`;
        }

        return `
            <div class="widget-tile ${classeStato} ${classeCascata} widget-size-${w.size} widget-col-${_t.col} widget-row-${_t.row} ${_formaWidget(_ta.col, _ta.row)} ${_iconaStatica ? 'widget-tile-mini' : ''} ${_fotoVetrina ? 'widget-tile-foto' : ''}" ${stileRitardo} data-widget-id="${w.instanceId}" data-widget-index="${indice}" ${azioneClick}>
                ${controlliEdit}
                ${badgeSuSfera ? '' : badge}
                <div class="tile-tinta"></div><div class="tile-alone"></div>
                ${corpo}
            </div>`;
    }));

    let tileAggiungi = '';
    const _TESSERA_AGGIUNGI = false;
    if (_TESSERA_AGGIUNGI && _editModeWidget && visibili.length < MAX_WIDGET_VISIBILI) {
        tileAggiungi = `
            <div class="widget-tile widget-tile-aggiungi widget-col-3 widget-row-2 wf-piccolo" onclick="_apriPickerAggiungiWidget()">
                <i class="fa-solid fa-plus widget-tile-icon"></i>
                <div class="widget-tile-titolo">Aggiungi</div>
            </div>`;
    }

    const distribuzione = _distribuisciWidgetInPagine(visibili, misura);
    _paginePresenti = distribuzione.length;

    const nPagine = _numeroPagineWidget();
    if (_paginaWidgetCorrente > nPagine - 1) _paginaWidgetCorrente = nPagine - 1;
    const classiGriglia = 'widget-griglia'
        + (BALL_ATTIVA ? ' ball-ui' : '')
        + (_editModeWidget ? ' in-modifica-widget' : '');
    const paginaHtml = [];
    for (let p = 0; p < nPagine; p++) {
        const suQuestaPagina = distribuzione[p] || [];
        const dentro = suQuestaPagina
            .map(w => tessere[visibili.indexOf(w)])
            .join('');
        const ultimaReale = p === nPagine - 1 - (_editModeWidget ? 1 : 0);
        const vuota = !dentro && !(ultimaReale && tileAggiungi);
        paginaHtml.push(`
            <div class="widget-pagina" data-pagina="${p}">
                <div class="${classiGriglia}">${dentro}${ultimaReale ? tileAggiungi : ''}</div>
                ${vuota && _editModeWidget ? '<div class="widget-pagina-vuota">Pagina vuota<br><small>spingi qui un widget con la freccia \u203a</small></div>' : ''}
            </div>`);
    }

    const puntini = nPagine > 1
        ? `<div id="phoneWidgetPuntini">
            <button type="button" class="widget-pagina-freccia" onclick="_vaiAllaPaginaWidgetRelativa(-1)" ${_paginaWidgetCorrente === 0 ? 'disabled' : ''} aria-label="Pagina precedente"><i class="fa-solid fa-chevron-left"></i></button>
            <div class="widget-puntini-pillola">${Array.from({ length: nPagine }, (_, i) =>
                `<button type="button" class="widget-puntino${i === _paginaWidgetCorrente ? ' attivo' : ''}" onclick="_vaiAllaPaginaWidget(${i})" aria-label="Pagina ${i + 1}"></button>`).join('')}</div>
            <button type="button" class="widget-pagina-freccia" onclick="_vaiAllaPaginaWidgetRelativa(1)" ${_paginaWidgetCorrente === nPagine - 1 ? 'disabled' : ''} aria-label="Pagina successiva"><i class="fa-solid fa-chevron-right"></i></button>
        </div>`
        : '';

    const scrollPrima = Math.min(cont.scrollLeft, _paginaWidgetCorrente * cont.clientWidth);
    cont.innerHTML = paginaHtml.join('');
    const vecchiPuntini = document.getElementById('phoneWidgetPuntini');
    if (vecchiPuntini) vecchiPuntini.remove();
    if (puntini) cont.insertAdjacentHTML('afterend', puntini);
    cont.scrollLeft = scrollPrima;

    _primoRenderWidgetFatto = true;
    _ballAttenzioni = attenzioni;
    _potaContenutoFuoriTessera();

    if (primoRender && BALL_ATTIVA) setTimeout(_ballGiraSemaforo, 900);

    if (_editModeWidget) _attivaDragEResize();

    if (primoRender && anteprimeInRitardo.size) {
        Promise.allSettled([...anteprimeInRitardo.values()]).then(() => {
            _anteprimeTardiveDaRiusare = anteprimeInRitardo;
            renderWidgetHome();
        });
    }
}

function _potaContenutoFuoriTessera() {
    document.querySelectorAll('.widget-tile .ball-slot-blocco').forEach(blocco => {
        const tessera = blocco.closest('.widget-tile');
        if (!tessera) return;
        const stile = getComputedStyle(tessera);
        const fondo = tessera.getBoundingClientRect().bottom - (parseFloat(stile.paddingBottom) || 0);
        const troncati = new Set();
        blocco.querySelectorAll(':scope > .ball-gruppo').forEach(g => { g.style.display = ''; });

        blocco.querySelectorAll(':scope > .ball-riga, :scope > .ball-gruppi > .ball-gruppo, :scope > .ball-spark, :scope > .ball-strip:not(.ball-strip-fill), :scope > .ball-strip-fill > .ball-mini, :scope > .ball-quota, ' +
            ':scope > .ball-riga-set, :scope > .ball-cov:not(.ball-cov-fill), :scope > .ball-cov-fill > .ball-cov-v, :scope > .ball-ripiano, :scope > .ball-medaglie, :scope > .ball-th, :scope > .ball-chips, :scope > .ball-k-lab, :scope > .ball-azione, :scope > .ball-ul > div, :scope > .ball-co > *, ' +
            ':scope > .ball-gruppo > .ball-riga, ' +
            ':scope > .ball-ins > *, :scope > .ball-prz > *').forEach(pezzo => {
            pezzo.style.display = '';
            if (troncati.has(pezzo.parentElement)) { pezzo.style.display = 'none'; return; }
            const r = pezzo.getBoundingClientRect();
            if (r.bottom > fondo + 1 || (pezzo.classList.contains('ball-cov-v') && r.right > blocco.getBoundingClientRect().right + 1)) {
                pezzo.style.display = 'none';
                troncati.add(pezzo.parentElement);
            }
        });
        blocco.querySelectorAll('.ball-co > .ball-co-sez').forEach(titolo => {
            if (titolo.style.display === 'none') return;
            let dopo = titolo.nextElementSibling, haVoci = false;
            while (dopo && !dopo.classList.contains('ball-co-sez') && !dopo.classList.contains('ball-co-foot')) {
                if (dopo.style.display !== 'none') { haVoci = true; break; }
                dopo = dopo.nextElementSibling;
            }
            if (!haVoci) titolo.style.display = 'none';
        });
        blocco.querySelectorAll(':scope > .ball-gruppo').forEach(gruppo => {
            const righe = gruppo.querySelectorAll(':scope > .ball-riga');
            if (righe.length && [...righe].every(r => r.style.display === 'none')) gruppo.style.display = 'none';
        });
        blocco.querySelectorAll('.ball-strip:not(.ball-strip-fill), .ball-cov:not(.ball-cov-fill), .ball-th').forEach(fila => {
            const destra = fila.getBoundingClientRect().right;
            fila.querySelectorAll(':scope > .ball-mini, :scope > i, :scope > img').forEach(m => {
                m.style.display = '';
                if (m.getBoundingClientRect().right > destra + 1) m.style.display = 'none';
            });
        });
    });
}

async function _eseguiAzioneWidget(instanceId, evt) {
    const w = _layoutWidget.find(x => x.instanceId === instanceId);
    const def = w && CATALOGO_WIDGET[w.id];
    if (!def || def.bloccato) return;

    (async () => {
        try {
            const userId = await authGetUserId();
            if (userId) await missioniAperturaWidgetRegistra(userId, w.id);
        } catch (e) { console.error('[missioni] registrazione apertura widget:', e); }
    })();

    const punto = evt ? { clientX: evt.clientX, clientY: evt.clientY, currentTarget: evt.currentTarget } : null;
    if (BALL_ATTIVA && !_editModeWidget && evt && evt.currentTarget) {
        try { await _ballGiocaCattura(evt.currentTarget); } catch (_) {   }
    }

    if (def.azione) {
        let dati = null;
        try { dati = await def.preview(w); } catch (_) { dati = null; }
        def.azione(dati, punto, w);
        return;
    }
    apriDettaglioWidget(def.tab || w.id, punto);
}

function _spostaWidget(indiceVisibile, direzione) {
    const visibili = _layoutWidget.filter(w => w.visibile);
    const target = visibili[indiceVisibile];
    const idxReale = _layoutWidget.indexOf(target);
    const idxScambio = _layoutWidget.indexOf(visibili[indiceVisibile + direzione]);
    if (idxScambio === undefined || idxScambio < 0) return;
    [_layoutWidget[idxReale], _layoutWidget[idxScambio]] = [_layoutWidget[idxScambio], _layoutWidget[idxReale]];
    _salvaLayoutWidget();
    renderWidgetHome();
}

function _nascondiWidget(instanceId) {
    const idx = _layoutWidget.findIndex(x => x.instanceId === instanceId);
    if (idx < 0) return;
    const w = _layoutWidget[idx];
    const def = CATALOGO_WIDGET[w.id];
    if (def && def.multiIstanza) {
        _layoutWidget.splice(idx, 1);
    } else {
        w.visibile = false;
    }
    _salvaLayoutWidget();
    renderWidgetHome();
}

function _apriPickerAggiungiWidget() {
    const nascosti = _layoutWidget.filter(w => !w.visibile && !(CATALOGO_WIDGET[w.id] && CATALOGO_WIDGET[w.id].multiIstanza));
    const multi = Object.entries(CATALOGO_WIDGET).filter(([, def]) => def.multiIstanza);

    const container = document.getElementById('widgetPickerLista');
    const vociMulti = multi.map(([id, def]) => `
        <div class="widget-picker-riga" onclick="_aggiungiIstanzaWidget('${id}')">
            <i class="fa-solid ${def.icona}"></i> Aggiungi ${def.titolo}
        </div>`);
    const vociSingole = nascosti.map(w => `
        <div class="widget-picker-riga" onclick="_mostraWidget('${w.id}')">
            <i class="fa-solid ${CATALOGO_WIDGET[w.id].icona}"></i> ${CATALOGO_WIDGET[w.id].titolo}
        </div>`);
    const tutte = [...vociMulti, ...vociSingole].join('');
    container.innerHTML = tutte || '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Nessun altro widget disponibile.</p>';
    document.getElementById('widgetPickerModal').style.display = 'flex';
}

function _chiudiPickerAggiungiWidget() {
    document.getElementById('widgetPickerModal').style.display = 'none';
}

function _mostraWidget(id) {
    const visibiliCount = _layoutWidget.filter(w => w.visibile).length;
    if (visibiliCount >= MAX_WIDGET_VISIBILI) { mostraAvviso(`Massimo ${MAX_WIDGET_VISIBILI} widget in home.`); return; }
    const w = _layoutWidget.find(x => x.id === id);
    if (w) {
        w.visibile = true;
        w.pagina = _paginaWidgetCorrente;
        if (w.size === '3x2') w.size = _tagliaDiNascita(id);
    }
    _salvaLayoutWidget();
    _chiudiPickerAggiungiWidget();
    renderWidgetHome();
}

function _aggiungiIstanzaWidget(id) {
    const visibiliCount = _layoutWidget.filter(w => w.visibile).length;
    if (visibiliCount >= MAX_WIDGET_VISIBILI) { mostraAvviso(`Massimo ${MAX_WIDGET_VISIBILI} widget in home.`); return; }
    const nuovo = { id, instanceId: _nuovoInstanceId(), visibile: true, size: _tagliaDiNascita(id), mini: false, cartaId: null, pagina: _paginaWidgetCorrente, v: VERSIONE_LAYOUT_WIDGET };
    _layoutWidget.push(nuovo);
    _salvaLayoutWidget();
    _chiudiPickerAggiungiWidget();
    renderWidgetHome();
    _apriRicercaCartaVetrina(nuovo.instanceId);
}

function toggleModificaWidgetHome() {
    _editModeWidget = !_editModeWidget;
    const btn = document.getElementById('btnModificaWidgetHome');
    if (btn) {
        btn.classList.toggle('attivo', _editModeWidget);
        const label = btn.querySelector('span');
        if (label) label.textContent = _editModeWidget ? 'Fatto' : 'Modifica';
    }
    document.body.classList.toggle('home-in-modifica', _editModeWidget);
    renderWidgetHome();
}
