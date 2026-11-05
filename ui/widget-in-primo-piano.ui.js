// Widget In primo piano.

const PRIMO_PIANO_MAX_TILE = 16;
const PRIMO_PIANO_MAX_PAGINA = 80;
const PRIMO_PIANO_CATEGORIE_SENZA_SCROLL = ['valore', 'su', 'giu', 'box'];
const PRIMO_PIANO_PAUSA_VISITA_ORE = 4;
const PRIMO_PIANO_RINFRESCO_VARIAZIONI_MS = 60000;

const _PP_ORIGINE = { valore: 'top_valore', su: 'oscillazione_su', giu: 'oscillazione_giu' };

function _ppEsc(v) {
    return String(v == null ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function _ppEur(v) {
    return formattaEuro(v);
}

function _ppFmtVar(v) {
    const n = Number(v) || 0;
    const a = Math.abs(n);
    const testo = a >= 100 ? Math.round(a).toLocaleString('it-IT') : a.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (n > 0 ? '+' : '−') + testo + ' €';
}

function _ppTitoloOscillazione(cat) {
    const dallUltima = _ppBaseline.pronta && _ppBaseline.da;
    const base = cat === 'su' ? 'Salite' : 'Scese';
    return dallUltima ? `${base} dall’ultima visita` : base;
}

function _ppChiaveCarta(c) {
    return [c.name, c.code, c.lang, c.cond, !!c.reverseHolo, !!c.firstEd].join('||');
}
function _ppChiaveBox(p) {
    return [p.name, p.codice, p.setEspansione, p.lingua, p.integrita].join('||');
}

let _ppBaseline = { pronta: false, da: null, mappa: new Map() };
let _ppBaselineAvviata = false;
let _ppRinfrescoAttivo = false;

async function _ppRicaricaVariazioni() {
    if (!_ppBaseline.pronta || !_ppBaseline.da) return;
    const { data, error } = await variazioniPrezziDa(_ppBaseline.da);
    if (error) { console.error('[primo piano] rilettura variazioni:', error.message); return; }
    const mappa = new Map();
    (data || []).forEach(r => mappa.set(r.tabella + ':' + r.oggetto_id, Number(r.prezzo_base)));
    _ppBaseline = { pronta: true, da: _ppBaseline.da, mappa };
}

async function primoPianoCaricaBaseline() {
    if (_ppBaselineAvviata) return;
    _ppBaselineAvviata = true;
    try {
        const { data: da, error } = await visitaRegistra(PRIMO_PIANO_PAUSA_VISITA_ORE);
        if (error) throw error;
        _ppBaseline = { pronta: true, da: da || null, mappa: new Map() };
        await _ppRicaricaVariazioni();
        if (_ppBaseline.da && !_ppRinfrescoAttivo) {
            _ppRinfrescoAttivo = true;
            setInterval(() => { if (!document.hidden) _ppRicaricaVariazioni(); }, PRIMO_PIANO_RINFRESCO_VARIAZIONI_MS);
        }
    } catch (e) {
        console.error('[primo piano] baseline ultima visita:', e && e.message ? e.message : e);
        _ppBaseline = { pronta: false, da: null, mappa: new Map() };
        _ppBaselineAvviata = false;
    } finally {
        if (typeof renderWidgetHome === 'function' && !document.body.classList.contains('phone-detail-open') && !(typeof _editModeWidget !== 'undefined' && _editModeWidget)) {
            renderWidgetHome();
        }
    }
}

function _ppVariazione(r) {
    if (!(_ppBaseline.pronta && _ppBaseline.da)) {
        return r.variazioneNumerica != null ? r.variazioneNumerica : null;
    }
    const base = _ppBaseline.mappa.get('carte:' + r.id);
    if (base == null) return null;
    const d = (Number(r.price) || 0) - base;
    return Math.abs(d) < 0.005 ? null : d;
}

function _ppNotaOscillazione() {
    if (_ppBaseline.pronta && _ppBaseline.da) {
        const quando = new Date(_ppBaseline.da).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        return `Variazione in euro rispetto all'ultima visita (${quando}).`;
    }
    const base = 'Variazione in euro rispetto all\'ultimo aggiornamento del prezzo di ciascuna carta.';
    return _ppBaseline.pronta ? base + ' Dalla prossima visita si confronta con l\'ultimo accesso.' : base;
}

function _ppCategorie(max) {
    const carte = (typeof carteReali !== 'undefined' ? carteReali : [])
        .filter(c => c.stato === 'collezione' && c.tipo !== 'sealed');

    const gruppi = new Map();
    carte.forEach(c => {
        const k = _ppChiaveCarta(c);
        let g = gruppi.get(k);
        if (!g) { g = { righe: [], copie: 0 }; gruppi.set(k, g); }
        g.righe.push(c);
        g.copie += Number(c.qty) || 1;
    });
    const lista = Array.from(gruppi.values());

    const voceCarta = (g, r) => ({
        id: r.id, nome: r.name || '—', prezzo: Number(r.price) || 0,
        varia: _ppVariazione(r),
        immagine: r.immagine || null, copie: g.copie, tipo: 'carta',
    });
    const migliore = (g, punteggio) => {
        let best = null;
        g.righe.forEach(r => {
            const p = punteggio(r);
            if (p == null) return;
            if (!best || p > best.p) best = { r, p };
        });
        return best ? { g, r: best.r, p: best.p } : null;
    };
    const classifica = (punteggio) => lista
        .map(g => migliore(g, punteggio))
        .filter(Boolean)
        .sort((a, b) => b.p - a.p)
        .slice(0, max)
        .map(x => voceCarta(x.g, x.r));

    const perValore = classifica(r => Number(r.price) || 0);
    const su = classifica(r => { const v = _ppVariazione(r); return (v != null && v > 0) ? v : null; });
    const giu = classifica(r => { const v = _ppVariazione(r); return (v != null && v < 0) ? -v : null; });

    const sealed = typeof prodottiSealedReali !== 'undefined' ? prodottiSealedReali : [];
    const gruppiBox = new Map();
    sealed.forEach(p => {
        const k = _ppChiaveBox(p);
        let g = gruppiBox.get(k);
        if (!g) { g = { rappr: p, copie: 0 }; gruppiBox.set(k, g); }
        if ((Number(p.price) || 0) > (Number(g.rappr.price) || 0)) g.rappr = p;
        g.copie += Number(p.qty) || 1;
    });
    const box = Array.from(gruppiBox.values())
        .sort((a, b) => (Number(b.rappr.price) || 0) - (Number(a.rappr.price) || 0))
        .slice(0, max)
        .map(g => ({
            id: g.rappr.id, nome: g.rappr.name || '—', prezzo: Number(g.rappr.price) || 0,
            varia: null, immagine: g.rappr.immagine || null, copie: g.copie, tipo: 'box',
        }));

    return { perValore, su, giu, box };
}

CATALOGO_WIDGET.primo_piano = {
        titolo: 'In primo piano', icona: 'fa-crown',
        tagliaDefault: '6x8',
        preview: () => {
            const cat = _ppCategorie(PRIMO_PIANO_MAX_TILE);
            const top = cat.perValore[0];
            if (!top) return { righe: ['Nessuna carta ancora'], dati: cat };
            const righe = [`${top.nome}`, formattaEuro(top.prezzo)];
            if (cat.su[0]) righe.push(`↑ ${cat.su[0].nome}`);
            return {
                righe,
                badge: false,
                dati: cat,
            };
        },
        azione: (dati) => {
            const cat = dati && (dati.dati || dati);
            const primo = cat && cat.perValore && cat.perValore[0];
            if (primo && typeof apriFlipCardHome === 'function') apriFlipCardHome(primo.id);
        },
};

function _primoPianoCorpo(d) {
    if (!d) return { inline: '', blocco: '' };
    const top = (d.perValore && d.perValore[0]) || null;
    const inline = top
        ? `<div class="ball-k-big ball-k-mono">${_ppEur(top.prezzo)}</div><span class="ball-k-lab">${_ppEsc(top.nome)} · la più preziosa</span>`
        : '<div class="ball-k-mid">—</div><span class="ball-k-lab">nessuna carta ancora</span>';

    const categorie = [
        ['valore', 'Valore più alto', d.perValore],
        ['su', _ppTitoloOscillazione('su'), d.su],
        ['giu', _ppTitoloOscillazione('giu'), d.giu],
        ['box', 'Box di maggior valore', d.box],
    ].filter(c => c[2] && c[2].length);

    if (!categorie.length) return { inline, blocco: '' };

    const html = categorie.map(([cat, titolo, voci]) =>
        `<div class="pp-gruppo" data-cat="${cat}">` +
            `<div class="pp-titolo" onclick="_ppApriPagina('${cat}', event)"><span>${titolo}</span><i class="fa-solid fa-chevron-right"></i></div>` +
            `<div class="pp-fila">${voci.map(v => _ppMini(v, cat)).join('')}</div>` +
        '</div>'
    ).join('');

    return { inline, blocco: `<div class="pp-wrap" data-n="${categorie.length}">${html}</div>` };
}

function _ppMini(v, cat) {
    const nome = _ppEsc(v.nome);
    const tinta = (typeof _ballTintaDaNome === 'function') ? _ballTintaDaNome(v.nome) : 'hsl(260, 52%, 58%)';
    const url = (v.immagine && typeof _urlImmagineVisualizzabile === 'function') ? _urlImmagineVisualizzabile(v.immagine, 128) : null;
    const img = url ? `<img src="${_ppEsc(url)}" alt="" loading="lazy" onerror="this.remove();">` : '';
    const copie = v.copie > 1 ? `<b class="pp-copie">×${v.copie}</b>` : '';
    const varia = ((cat === 'su' || cat === 'giu') && v.varia != null)
        ? `<b class="ball-mini-badge pp-var ${v.varia > 0 ? 'pp-su' : 'pp-giu'}">${_ppFmtVar(v.varia)}</b>`
        : '';
    return `<span class="ball-mini" style="background:linear-gradient(150deg, ${tinta}, rgba(0,0,0,.35))" title="${nome}" ` +
        `data-id="${_ppEsc(v.id)}" data-tipo="${v.tipo}" data-cat="${cat}" onclick="_ppClicMini(event, this)">` +
        `<i></i><u></u>${img}${copie}${varia}</span>`;
}

function _ppClicMini(evt, el) {
    if (evt) evt.stopPropagation();
    if (typeof _editModeWidget !== 'undefined' && _editModeWidget) return;
    if (typeof _vibraSeSupportato === 'function') _vibraSeSupportato(8);
    const id = el.dataset.id;
    if (el.dataset.tipo === 'box') {
        if (typeof apriModificaSealed === 'function') apriModificaSealed(id);
        return;
    }
    const origine = _PP_ORIGINE[el.dataset.cat];
    if (typeof apriFlipCardHome === 'function') apriFlipCardHome(id, origine ? { origine } : {});
}

function _ppApriPagina(cat, evt) {
    if (evt) evt.stopPropagation();
    if (typeof _editModeWidget !== 'undefined' && _editModeWidget) return;
    if (typeof _vibraSeSupportato === 'function') _vibraSeSupportato(8);
    _ppCategoriaPagina = cat;
    if (typeof apriDettaglioWidget === 'function') apriDettaglioWidget('primopiano', evt);
}

let _ppCategoriaPagina = 'valore';

const _PP_CATEGORIE_PAGINA = [
    { id: 'valore', etichetta: 'Valore', ordine: 'ordinate per valore', unita: ['carta', 'carte'], vuoto: 'Ancora nessuna carta in collezione.' },
    { id: 'su', etichetta: 'Salite', ordine: 'ordinate per aumento maggiore', unita: ['carta', 'carte'], vuoto: 'Nessuna carta è salita di prezzo.' },
    { id: 'giu', etichetta: 'Scese', ordine: 'ordinate per calo maggiore', unita: ['carta', 'carte'], vuoto: 'Nessuna carta è scesa di prezzo.' },
    { id: 'box', etichetta: 'Box', ordine: 'ordinati per valore', unita: ['box', 'box'], vuoto: 'Nessun box in collezione.' },
];
const _PP_CAMPO_DATI = { valore: 'perValore', su: 'su', giu: 'giu', box: 'box' };
const _PP_PODIO = 3;

function _ppValoreCollezione() {
    const carte = (typeof carteReali !== 'undefined' ? carteReali : []).filter(c => c.stato === 'collezione' && c.tipo !== 'sealed' && !c.esclusoValore)
        .reduce((t, c) => t + (Number(c.price) || 0) * (Number(c.qty) || 1), 0);
    const sealed = (typeof prodottiSealedReali !== 'undefined' ? prodottiSealedReali : [])
        .reduce((t, s) => t + (Number(s.price) || 0) * (Number(s.qty) || 1), 0);
    return carte + sealed;
}

function _ppSottoTitolo() {
    if (_ppBaseline.pronta && _ppBaseline.da) {
        const d = new Date(_ppBaseline.da);
        if (!isNaN(d.getTime())) {
            const quando = d.toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '');
            return `Le tue carte che contano di più adesso · salite e scese dalla tua ultima visita, ${quando}`;
        }
        return 'Le tue carte che contano di più adesso · salite e scese dalla tua ultima visita';
    }
    return 'Le tue carte che contano di più adesso · salite e scese dall’ultimo aggiornamento del prezzo di ciascuna carta';
}

async function renderPaginaPrimoPiano() {
    const container = document.getElementById('primopianoContenuto');
    if (!container) return;

    container.innerHTML = `
        <div class="page-header">
            <span class="page-title">In primo piano</span>
        </div>
        <div class="pp-pagina">
            <p class="pg-sotto" id="primopianoSotto" style="margin:0 0 12px;"></p>
            <div class="pg-filtri" id="primopianoFiltri"></div>
            <div id="primopianoTesta"></div>
            <div id="primopianoPodio"></div>
            <div class="pp-pag-griglia" id="primopianoElenco"></div>
            <div id="primopianoNota"></div>
        </div>
    `;
    _ppRenderElencoPagina();

    if (typeof caricaProdottiSealedReali === 'function') {
        try {
            await caricaProdottiSealedReali();
        } catch (e) { console.error('[primo piano] ricarico box:', e); }
    }
    try { await _ppRicaricaVariazioni(); } catch (e) { console.error('[primo piano] rileggo variazioni:', e); }
    _ppRenderElencoPagina();
}

function _ppImpostaCategoriaPagina(cat) {
    _ppCategoriaPagina = cat;
    _ppRenderElencoPagina();
}

function _ppTestoConteggio(def, mostrate, totale) {
    if (!totale) return '';
    const unita = def.unita[totale === 1 ? 0 : 1];
    const quante = mostrate < totale ? `${mostrate} di ${totale}` : `${totale}`;
    return `${quante} ${unita} · ${def.ordine}`;
}

let _ppOsservatorePagina = null;

function _ppFermaOsservatorePagina() {
    if (_ppOsservatorePagina) { _ppOsservatorePagina.disconnect(); _ppOsservatorePagina = null; }
}

function _ppAvviaOsservatorePagina() {
    _ppFermaOsservatorePagina();
    if (typeof ResizeObserver !== 'function') return;
    const griglia = document.getElementById('primopianoElenco');
    const scroller = griglia && griglia.closest('.container');
    if (!scroller) return;
    _ppOsservatorePagina = new ResizeObserver(() => _ppAdattaGrigliaAlloSpazio());
    _ppOsservatorePagina.observe(scroller);
}

function _ppAdattaGrigliaAlloSpazio() {
    const griglia = document.getElementById('primopianoElenco');
    if (!griglia || griglia.dataset.fit !== '1') return;
    if (!griglia.offsetParent) return;
    const scroller = griglia.closest('.container');
    if (!scroller || !scroller.clientHeight) return;
    const tessere = Array.from(griglia.querySelectorAll(':scope > .pp-pag-tile'));
    if (!tessere.length) return;

    const hTessera = tessere[0].getBoundingClientRect().height;
    if (!hTessera) return;
    const stile = getComputedStyle(griglia);
    const colonne = Math.max(1, stile.gridTemplateColumns.split(' ').filter(Boolean).length);
    const gap = parseFloat(stile.rowGap) || 0;

    const rs = scroller.getBoundingClientRect();
    const inizio = griglia.getBoundingClientRect().top - rs.top + scroller.scrollTop;
    let riserva = parseFloat(getComputedStyle(scroller).paddingBottom) || 0;
    const tasto = document.getElementById('btnFisicoTelefono');
    if (tasto) {
        const rb = tasto.getBoundingClientRect();
        if (rb.width && rb.top < rs.bottom && rb.bottom > rs.top) riserva = Math.max(riserva, rs.bottom - rb.top + 8);
    }

    const sotto = document.getElementById('primopianoNota');
    if (sotto) riserva += sotto.offsetHeight;

    const spazio = scroller.clientHeight - inizio - riserva - 1;
    let righe = Math.max(1, Math.floor((spazio + gap) / (hTessera + gap)));
    let n = righe * colonne;
    const applica = () => tessere.forEach((t, i) => { t.style.display = i < n ? '' : 'none'; });
    applica();
    while (righe > 1 && scroller.scrollHeight > scroller.clientHeight + 1) {
        righe--; n = righe * colonne; applica();
    }

    const conteggio = document.getElementById('primopianoConteggio');
    const def = _PP_CATEGORIE_PAGINA.find(c => c.id === griglia.dataset.cat);
    const offset = Number(griglia.dataset.offset) || 0;
    if (conteggio && def) conteggio.textContent = _ppTestoConteggio(def, Math.min(n, tessere.length) + offset, Number(griglia.dataset.totale) || (tessere.length + offset));
}

function _ppFoto(v, larghezza, extra) {
    const src = (v.immagine && typeof _urlImmagineVisualizzabile === 'function') ? (_urlImmagineVisualizzabile(v.immagine, larghezza) || '') : '';
    const fig = src
        ? `<img class="pp-pag-cover" src="${_ppEsc(src)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'pp-pag-cover pp-pag-cover-vuota',innerHTML:'<i class=&quot;fa-solid fa-image&quot;></i>'}))">`
        : `<div class="pp-pag-cover pp-pag-cover-vuota"><i class="fa-solid ${v.tipo === 'box' ? 'fa-box-archive' : 'fa-image'}"></i></div>`;
    return `<div class="pp-pag-foto">${fig}${extra || ''}</div>`;
}

function _ppRenderElencoPagina() {
    const elenco = document.getElementById('primopianoElenco');
    const nota = document.getElementById('primopianoNota');
    if (!elenco) return;
    _ppFermaOsservatorePagina();

    const def = _PP_CATEGORIE_PAGINA.find(c => c.id === _ppCategoriaPagina) || _PP_CATEGORIE_PAGINA[0];
    const dati = _ppCategorie(Infinity);
    const tutte = dati[_PP_CAMPO_DATI[def.id]] || [];
    const oscillazione = def.id === 'su' || def.id === 'giu';

    const sotto = document.getElementById('primopianoSotto');
    if (sotto) sotto.textContent = _ppSottoTitolo();
    const filtri = document.getElementById('primopianoFiltri');
    if (filtri) filtri.innerHTML = _PP_CATEGORIE_PAGINA.map(c =>
        `<span class="pg-filtro${c.id === def.id ? ' attivo' : ''}" data-cat="${c.id}" onclick="_ppImpostaCategoriaPagina('${c.id}')">${c.etichetta} &middot; ${(dati[_PP_CAMPO_DATI[c.id]] || []).length}</span>`
    ).join('');

    const testa = document.getElementById('primopianoTesta');
    if (testa) {
        if (oscillazione && tutte.length) {
            const tot = tutte.reduce((t, v) => t + (Number(v.varia) || 0) * (Number(v.copie) || 1), 0);
            testa.innerHTML = `<div class="pp-testa"><span>${def.etichetta}</span><b class="${tot >= 0 ? 'pp-su' : 'pp-giu'}">${formattaEuroVariazione(tot)}</b></div>`;
        } else testa.innerHTML = '';
    }

    const podioEl = document.getElementById('primopianoPodio');
    const inPodio = def.id === 'valore' ? tutte.slice(0, _PP_PODIO) : [];
    if (podioEl) {
        const totColl = _ppValoreCollezione();
        podioEl.innerHTML = inPodio.length ? `<div class="pp-podio">${inPodio.map((v, i) => {
            const perc = totColl > 0 ? Math.round(v.prezzo / totColl * 100) : null;
            const sottoTxt = v.copie > 1 ? `×${v.copie} · ${_ppEur(v.prezzo * v.copie)} in tutto` : (perc != null ? `${perc}% della collezione` : '');
            return `<div class="pp-podio-voce pp-rango-${i + 1}" data-id="${_ppEsc(v.id)}" data-tipo="${v.tipo}" data-cat="${def.id}" onclick="_ppClicMini(event, this)">
                ${_ppFoto(v, i === 0 ? 300 : 240, `<span class="pp-medaglia pp-medaglia-${i + 1}">${i + 1}</span>`)}
                <div class="pp-pag-nome">${_ppEsc(v.nome)}</div>
                <b class="pp-podio-prezzo">${_ppEur(v.prezzo)}</b>
                <span class="pp-podio-sotto">${sottoTxt}</span>
            </div>`;
        }).join('')}</div>` : '';
    }

    const restanti = tutte.slice(inPodio.length);
    const voci = restanti.slice(0, PRIMO_PIANO_MAX_PAGINA);
    elenco.dataset.fit = '1';
    elenco.dataset.cat = def.id;
    elenco.dataset.totale = String(tutte.length);
    elenco.dataset.offset = String(inPodio.length);

    const link = def.id === 'valore' ? ['Vedi tutte in Collezione', 'visualizzazione']
        : (oscillazione ? ['Vedi tutti i movimenti', 'variazione'] : ['Vedi tutti in Sealed', 'sealed']);
    if (nota) {
        nota.innerHTML = tutte.length ? `
            <div class="pp-piede"><span id="primopianoConteggio">${_ppEsc(_ppTestoConteggio(def, Math.min(voci.length + inPodio.length, tutte.length), tutte.length))}</span>
            <a onclick="apriDettaglioWidget('${link[1]}', event)">${link[0]} &rarr;</a></div>` : '';
    }

    if (!tutte.length) {
        elenco.innerHTML = `<p style="text-align:center; color:var(--text-muted); font-size:0.82rem; padding:1.2rem 0; grid-column:1/-1;">${def.vuoto}</p>`;
        return;
    }

    elenco.innerHTML = voci.map((v, i) => {
        const rango = inPodio.length + i + 1;
        let extra = '', valori;
        if (def.id === 'valore') {
            extra = `<span class="pp-rango">#${rango}</span>${v.copie > 1 ? `<span class="pp-pag-copie">×${v.copie}</span>` : ''}`;
            valori = `<b>${_ppEur(v.prezzo)}</b><span>cad.</span>`;
        } else if (oscillazione) {
            extra = `${v.copie > 1 ? `<span class="pp-pag-copie">×${v.copie}</span>` : ''}<span class="pp-fascia ${v.varia > 0 ? 'pp-fascia-su' : 'pp-fascia-giu'}">${_ppFmtVar(v.varia)}</span>`;
            valori = `<span>${_ppEur(v.prezzo - v.varia)} &rarr; ${_ppEur(v.prezzo)}</span>`;
        } else {
            extra = v.copie > 1 ? `<span class="pp-pag-copie">×${v.copie}</span>` : '';
            valori = `<b>${_ppEur(v.prezzo)}</b><span>cad.</span>`;
        }
        return `
            <div class="pp-pag-tile" data-id="${_ppEsc(v.id)}" data-tipo="${v.tipo}" data-cat="${def.id}" onclick="_ppClicMini(event, this)">
                ${_ppFoto(v, 200, extra)}
                <div class="pp-pag-nome">${_ppEsc(v.nome)}</div>
                <div class="pp-pag-valori">${valori}</div>
            </div>`;
    }).join('');

    if (voci.length) {
        _ppAdattaGrigliaAlloSpazio();
        _ppAvviaOsservatorePagina();
    }
}
