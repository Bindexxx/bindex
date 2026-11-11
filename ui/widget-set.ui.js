// Widget e pagina Set.

function setPercentuale(p) {
    return (Number(p) || 0).toLocaleString('it-IT', { maximumFractionDigits: 1 }) + '%';
}

CATALOGO_WIDGET.set_completamento = {
    titolo: 'Set', icona: 'fa-layer-group',
    preview: () => {
        const r = setMCalcolaTutti();
        if (r.daCaricare.length) {
            setMCaricaRighe(r.daCaricare)
                .then(caricate => { if (caricate) setMRidisegnaHome(); })
                .catch(e => console.error('Set — caricamento righe:', e));
        }

        const g = setMSuddividi(r.voci);
        const perAvanzamento = g.inCorso.slice().sort((a, b) => (b.perc || 0) - (a.perc || 0) || a.mancanti - b.mancanti);
        const prima = perAvanzamento[0] || null;
        const nv = setMNotificaNonVista();

        let riga;
        if (nv) riga = `${nv.nome} · ${nv.soglia}%`;
        else if (prima) riga = `${prima.nome} · ${setPercentuale(prima.perc)}`;
        else riga = r.voci.length ? 'Nessun set in corso' : 'Libreria set vuota';

        return {
            righe: [riga],
            dati: {
                prima,
                top: perAvanzamento.slice(0, 4),
                nInCorso: g.inCorso.length,
                nCompletati: g.completati.length,
                nNonIniziati: g.nonIniziati.length,
                nNascosti: g.nascosti.length,
                notifica: nv,
                senzaCatalogo: _setM.conteggi.size === 0,
                vuoto: r.voci.length === 0
            }
        };
    },
    tab: 'set',
};

const _SET_SCHEDE = [
    { id: 'incorso',     etichetta: 'In corso',     chiave: 'inCorso',     vuoto: 'Nessun set in corso: aggiungi una carta di un set per iniziare.' },
    { id: 'completati',  etichetta: 'Completati',   chiave: 'completati',  vuoto: 'Nessun set completato, per ora.' },
    { id: 'noniniziati', etichetta: 'Non iniziati', chiave: 'nonIniziati', vuoto: 'Hai già almeno una carta di ogni set.' },
    { id: 'nascosti',    etichetta: 'Nascosti',     chiave: 'nascosti',    vuoto: 'Nessun set nascosto. Con "Modifica" puoi nascondere quelli che non ti interessano.' }
];

const _setUi = {
    tab: 'incorso',
    modifica: false,
    dett: null,
    filtro: 'tutte',
    modificaDett: false,
    classifica: false,
    msg: '',
    cerca: '',
    lingua: 'tutte',
    token: 0
};

function _setEPC() {
    const el = document.getElementById('set');
    return !!el && el.clientWidth >= 780;
}

function _setUiAttr(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
        .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function renderPaginaSet() {
    const container = document.getElementById('setContenuto');
    if (!container) return;

    _setUi.tab = 'incorso';
    _setUi.modifica = false;
    _setUi.filtro = 'tutte';
    _setUi.modificaDett = false;
    _setUi.classifica = false;
    _setUi.msg = '';
    _setUi.cerca = '';
    _setUi.dett = null;

    let nv = null;
    try { nv = setMNotificaNonVista(); } catch (_) { nv = null; }
    if (nv) _setUi.dett = nv.sigla;

    await _setUiRender();

    if (nv) await setMSegnaViste();

    if (!_setM.baseOk && !_setM.occupato) {
        await setMotoreAggiorna({ render: false });
        await _setUiRender();
    }
}

function _setUiErrore(container, testo) {
    container.innerHTML = `
        <div class="page-header"><span class="page-title">Set</span></div>
        <p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:2rem 0;">${_setUiAttr(testo)}</p>`;
}

async function _setUiRender() {
    const container = document.getElementById('setContenuto');
    if (!container) return;
    try {
        if (_setUi.classifica) _setUiRenderClassifica(container);
        else if (_setEPC()) {
            const elenco = _setUiRenderLista(container);
            if (!_setUi.dett && elenco && elenco.length) _setUi.dett = elenco[0].sigla;
            _setUiSegnaSelezione();
            const destra = document.getElementById('setDettPc');
            if (destra && _setUi.dett) await _setUiRenderDettaglio(destra, true);
            else if (destra) destra.innerHTML = '<p class="set-vuoto-dx">Scegli un set dall\'elenco.</p>';
        }
        else if (_setUi.dett) await _setUiRenderDettaglio(container);
        else _setUiRenderLista(container);
    } catch (e) {
        console.error('renderPaginaSet:', e);
        _setUiErrore(container, 'Errore nel caricamento.');
    }
}

function _setUiRigaHtml(v) {
    const perc = v.completo ? 100 : Math.floor(v.perc);
    const sub = (v.completo ? 'Completo' : `${v.mancanti} ${v.mancanti === 1 ? 'mancante' : 'mancanti'}`)
        + ' · ' + (v.catalogo ? 'masterset' : 'set base');
    const occhio = _setUi.modifica
        ? `<i class="fa-solid ${v.nascosto ? 'fa-eye' : 'fa-eye-slash'} set-riga-occhio" title="${v.nascosto ? 'Mostra' : 'Nascondi'}"></i>`
        : '';
    return `<div class="pg-riga-set set-riga${v.nascosto ? ' nascosto' : ''}" data-sigla="${_setUiAttr(v.sigla)}" onclick="_setUiClickRiga(this.dataset.sigla)">
        <div class="pg-riga-set-testa"><b>${_setUiAttr(v.nome)}${_setUiSiglaTesto(v.sigla, v.nome)}</b><span>${v.hai}/${v.totale} · ${perc}%${occhio}</span></div>
        <div class="pg-barra-track"><div class="pg-barra-fill" style="width:${perc}%"></div></div>
        <div class="set-riga-sub">${sub}</div>
    </div>`;
}

// Sigla da mostrare: senza "@LINGUA", con la lingua accanto per i set non internazionali (es. "SV2A · JP")
function _setUiSiglaTesto(sigla, nome) {
    const vis = _ballSiglaVisibile(sigla);
    const lingua = _ballLinguaSet(sigla);
    const testo = vis + (lingua !== 'INT' ? ' · ' + lingua : '');
    return (nome !== vis || lingua !== 'INT') ? ` <small class="set-sigla">${_setUiAttr(testo)}</small>` : '';
}

// Filtro per lingua dei set: Tutte / Internazionali / Giapponesi / Coreane / Cinesi / Cinesi tradizionali
function _setUiFiltraLingua(voci) {
    if (_setUi.lingua === 'tutte') return voci;
    return voci.filter(v => (v.lingua || 'INT') === _setUi.lingua);
}

function _setUiLingueHtml(voci) {
    const conta = new Map();
    voci.forEach(v => conta.set(v.lingua || 'INT', (conta.get(v.lingua || 'INT') || 0) + 1));
    if (conta.size < 2) return '';
    const ordine = ['INT', 'JP', 'KOR', 'CHN', 'CHN-T'].filter(l => conta.has(l));
    const chip = (id, et) => `<span class="pg-filtro${_setUi.lingua === id ? ' attivo' : ''}" onclick="_setUiImpostaLingua('${id}')">${et}</span>`;
    return `<div class="pg-filtri set-lingue">${chip('tutte', 'Tutte le lingue')}${ordine.map(l => chip(l, `${_BALL_ETICHETTE_LINGUA[l] || l} (${conta.get(l)})`)).join('')}</div>`;
}

function _setUiImpostaLingua(l) {
    _setUi.lingua = l || 'tutte';
    _setUiRender();
}

function _setUiRenderLista(container) {
    const r0 = setMCalcolaTutti();
    const lingue = _setUiLingueHtml(r0.voci);
    if (!lingue) _setUi.lingua = 'tutte';
    const r = { ...r0, voci: _setUiFiltraLingua(r0.voci) };
    if (r.daCaricare.length) {
        setMCaricaRighe(r.daCaricare)
            .then(caricate => { if (caricate && !_setUi.dett) _setUiRender(); })
            .catch(e => console.error('Set — caricamento righe:', e));
    }
    const g = setMSuddividi(r.voci);
    const scheda = _SET_SCHEDE.find(s => s.id === _setUi.tab) || _SET_SCHEDE[0];
    const elenco = g[scheda.chiave];

    const schede = _SET_SCHEDE.map(s =>
        `<span class="pg-filtro${s.id === scheda.id ? ' attivo' : ''}" onclick="_setUiImpostaScheda('${s.id}')">${s.etichetta} (${g[s.chiave].length})</span>`
    ).join('');

    const visibili = r.voci.length - g.nascosti.length;
    const riepilogo = `${visibili} espansioni · ${g.completati.length} completate · conteggio sul totale`;

    const nSco = r.sconosciute.length;
    const avvisoSconosciute = nSco
        ? `<div class="set-nota"><i class="fa-solid fa-triangle-exclamation"></i> ${nSco === 1 ? '1 sigla' : nSco + ' sigle'} in collezione non ${nSco === 1 ? 'è' : 'sono'} in libreria (espansione nuova?): ${
            r.sconosciute.slice(0, 8).map(s => `${_setUiAttr(s.sigla)} (${s.carte})`).join(', ')}${nSco > 8 ? '…' : ''}. Vanno aggiunte alla libreria.</div>`
        : '';
    const daClass = setMDaClassificare();
    const avvisoClass = daClass.length
        ? `<div class="set-nota"><i class="fa-solid fa-tags"></i> ${daClass.length} ${daClass.length === 1 ? 'carta X non ha' : 'carte X non hanno'} ancora la variante (Poké Ball, Energy...) e ${daClass.length === 1 ? 'non conta' : 'non contano'} nel masterset. <span class="page-azione attiva" onclick="_setUiApriClassifica()">Classifica</span></div>`
        : '';
    const avvisoStato = (_setM.tentato && !_setM.baseOk)
        ? '<div class="set-nota">Preferenze Set non disponibili al momento: nascondi/ignora e notifiche sono disattivati.</div>'
        : '';
    const notaModifica = _setUi.modifica
        ? '<div class="set-nota">Tocca un set per nasconderlo o farlo tornare visibile. I set nascosti notificano solo al 99% e al 100%.</div>'
        : '';

    const piuAvanti = g.inCorso.reduce((m, v) => Math.max(m, Math.floor(v.perc || 0)), 0);
    const stat = `
        <div class="set-stat">
            <div><b>${g.inCorso.length}</b><span>in corso</span></div>
            <div><b>${g.completati.length}</b><span>completati</span></div>
            <div><b>${piuAvanti}%</b><span>il più avanti</span></div>
        </div>`;
    const ricerca = `
        <label class="set-cerca"><i class="fa-solid fa-magnifying-glass"></i>
            <input type="search" placeholder="Cerca un set…" value="${_setUiAttr(_setUi.cerca)}" oninput="_setUiCerca(this.value)" autocomplete="off">
        </label>`;
    const ordine = scheda.id === 'completati' ? 'Ordinati per nome' : 'Ordinati dal più vicino al completamento';

    container.innerHTML = `
        <div class="page-header">
            <span class="page-title">Set</span>
            <button type="button" class="set-btn-modifica${_setUi.modifica ? ' attiva' : ''}" onclick="_setUiToggleModifica()"><i class="fa-solid ${_setUi.modifica ? 'fa-check' : 'fa-pen'}"></i> ${_setUi.modifica ? 'Fine' : 'Modifica'}</button>
        </div>
        <div class="pg-pagina">
            <div class="pg-sotto set-solo-pc">${riepilogo}</div>
            ${stat}
            ${avvisoStato}${avvisoClass}${avvisoSconosciute}${notaModifica}
            <div class="set-layout">
                <div class="set-sx">
                    ${ricerca}
                    ${lingue}
                    <div class="pg-filtri">${schede}</div>
                    <div class="set-ordine">${ordine}</div>
                    <div class="set-msg">${_setUiAttr(_setUi.msg)}</div>
                    <div class="pg-elenco" id="setElenco">${_setUiElencoHtml(elenco, scheda)}</div>
                </div>
                <div class="set-dx" id="setDettPc"></div>
            </div>
        </div>`;
    return _setUiFiltraCerca(elenco);
}

function _setUiFiltraCerca(elenco) {
    const q = (_setUi.cerca || '').trim().toLowerCase();
    if (!q) return elenco;
    return elenco.filter(v => String(v.nome || '').toLowerCase().includes(q) || String(v.sigla || '').toLowerCase().includes(q));
}

function _setUiElencoHtml(elenco, scheda) {
    const filtrati = _setUiFiltraCerca(elenco);
    if (filtrati.length) return filtrati.map(_setUiRigaHtml).join('');
    const testo = elenco.length ? 'Nessun set con questo nome in questa scheda.' : scheda.vuoto;
    return `<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1.5rem 0;">${_setUiAttr(testo)}</p>`;
}

function _setUiCerca(testo) {
    _setUi.cerca = testo || '';
    const el = document.getElementById('setElenco');
    if (!el) return;
    const g = setMSuddividi(_setUiFiltraLingua(setMCalcolaTutti().voci));
    const scheda = _SET_SCHEDE.find(s => s.id === _setUi.tab) || _SET_SCHEDE[0];
    el.innerHTML = _setUiElencoHtml(g[scheda.chiave], scheda);
    _setUiSegnaSelezione();
}

function _setUiSegnaSelezione() {
    document.querySelectorAll('#setElenco .set-riga').forEach(r => {
        r.classList.toggle('sel', !!_setUi.dett && r.dataset.sigla === _setUi.dett);
    });
}

function _setUiImpostaScheda(id) {
    _setUi.tab = id;
    _setUi.msg = '';
    if (_setEPC()) _setUi.dett = null;
    _setUiRender();
}

function _setUiToggleModifica() {
    _setUi.modifica = !_setUi.modifica;
    _setUi.msg = '';
    _setUiRender();
}

function _setUiClickRiga(sigla) {
    if (!sigla) return;
    if (_setUi.modifica) return _setUiToggleNascosto(sigla);
    _setUiApriDettaglio(sigla);
}

async function _setUiToggleNascosto(sigla) {
    const userId = await authGetUserId();
    if (!userId) return;
    const eraNascosto = _setM.nascosti.has(sigla);
    _setUi.msg = '';
    if (eraNascosto) _setM.nascosti.delete(sigla); else _setM.nascosti.add(sigla);
    _setUiRender();

    const { error } = await setNascostoImposta(userId, sigla, !eraNascosto);
    if (error) {
        console.error('Set — nascondi/mostra:', error.message || error);
        if (eraNascosto) _setM.nascosti.add(sigla); else _setM.nascosti.delete(sigla);
        _setUi.msg = 'Non sono riuscito a salvare la modifica. Riprova.';
        _setUiRender();
        return;
    }
    setMotoreAggiorna({ render: false });
}

function _setUiApriDettaglio(sigla) {
    _setUi.dett = sigla;
    _setUi.filtro = 'tutte';
    _setUi.modificaDett = false;
    _setUi.msg = '';
    if (_setUiRenderSoloDettaglio()) { _setUiSegnaSelezione(); return; }
    _setUiRender();
    const cont = document.querySelector('.container');
    if (cont && typeof cont.scrollTo === 'function') cont.scrollTo(0, 0);
}

function _setUiRenderSoloDettaglio() {
    const destra = document.getElementById('setDettPc');
    if (!destra || !_setEPC() || !_setUi.dett || _setUi.classifica) return false;
    _setUiRenderDettaglio(destra, true).catch(e => console.error('Set — dettaglio:', e));
    return true;
}

function _setUiChiudiDettaglio() {
    _setUi.dett = null;
    _setUi.modificaDett = false;
    _setUi.msg = '';
    _setUiRender();
}

function _setUiImpostaFiltro(f) {
    _setUi.filtro = f;
    if (_setUiRenderSoloDettaglio()) return;
    _setUiRender();
}

function _setUiToggleModificaDett() {
    _setUi.modificaDett = !_setUi.modificaDett;
    _setUi.msg = '';
    if (_setUiRenderSoloDettaglio()) return;
    _setUiRender();
}

async function _setUiRenderDettaglio(container, inline) {
    const sigla = _setUi.dett;
    const token = ++_setUi.token;
    const lib = (typeof _ballLIBRERIA_SET !== 'undefined' && _ballLIBRERIA_SET) ? _ballLIBRERIA_SET : {};
    const nome = (lib[sigla] && lib[sigla].nome) || sigla;

    const intestazione = (azione) => inline ? `
        <div class="set-dett-testa">
            <span class="set-dett-nome">${_setUiAttr(nome)}${(() => { const vis = _ballSiglaVisibile(sigla); const l = _ballLinguaSet(sigla); return (nome !== vis ? ' · ' + _setUiAttr(vis) : '') + (l !== 'INT' ? ' · ' + _setUiAttr(_BALL_ETICHETTE_LINGUA[l] || l) : ''); })()}</span>
            ${azione || ''}
        </div>` : `
        <div class="page-header">
            <button type="button" class="pg-indietro" onclick="_setUiChiudiDettaglio()" aria-label="Torna ai set"><i class="fa-solid fa-chevron-left"></i></button>
            <span class="page-title">${_setUiAttr(nome)}</span>
            ${azione || ''}
        </div>`;

    let dati = setMVociSet(sigla);
    if (!dati) {
        container.innerHTML = intestazione('') +
            '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:2rem 0;">Caricamento…</p>';
        await setMCaricaRighe([sigla]);
        if (token !== _setUi.token || _setUi.dett !== sigla || !container.isConnected) return;
        dati = setMVociSet(sigla);
        if (!dati) {
            container.innerHTML = intestazione('') +
                '<p style="text-align:center; color:var(--danger); font-size:0.85rem; padding:2rem 0;">Non riesco a leggere le carte di questo set. Riprova tra poco.</p>';
            return;
        }
    }

    const voci = dati.voci;
    let totale = 0, hai = 0;
    voci.forEach(v => { if (!v.ignorata) { totale++; if (v.posseduta) hai++; } });
    const mancanti = totale - hai;
    const perc = totale > 0 ? (hai / totale) * 100 : 0;
    const percTesto = (totale > 0 && hai === totale) ? 100 : Math.floor(perc);

    const filtri = [
        ['tutte', 'Tutte'],
        ['mancano', `Mancano (${mancanti})`],
        ['ce_l_ho', `Ce l'ho (${hai})`]
    ].map(([id, et]) => `<span class="pg-filtro${_setUi.filtro === id ? ' attivo' : ''}" onclick="_setUiImpostaFiltro('${id}')">${et}</span>`).join('');

    const visibili = voci.filter(v => {
        if (_setUi.filtro === 'mancano') return !v.posseduta && !v.ignorata;
        if (_setUi.filtro === 'ce_l_ho') return v.posseduta && !v.ignorata;
        return true;
    });

    const carte = visibili.map(v => {
        const src = (typeof _urlImmagineVisualizzabile === 'function') ? _urlImmagineVisualizzabile(v.immagine, 200) : null;
        const stato = v.ignorata ? 'Ignorata' : (v.posseduta ? "C'è" : 'Manca');
        const classe = v.ignorata ? 'ignorata' : (v.posseduta ? 'ce-l-ho' : 'manca');
        return `<div class="set-carta ${classe}" data-n="${v.numero}" data-v="${_setUiAttr(v.variante)}" onclick="_setUiClickCarta(this)">
            <span class="set-carta-badge">${stato}</span>
            <div class="set-carta-img">${src ? `<img loading="lazy" src="${src}" alt="" onerror="this.remove()">` : ''}<span class="set-carta-num">${v.numero}</span></div>
            <div class="set-carta-nome">${_setUiAttr(v.nome)}</div>
            ${v.variante !== 'normale' ? `<div class="set-carta-var">${_setUiAttr(setMEtichettaVariante(v.variante))}</div>` : ''}
        </div>`;
    }).join('');

    const notaModifica = _setUi.modificaDett
        ? '<div class="set-nota">Tocca una carta per ignorarla o riattivarla. Le carte ignorate non contano nel completamento (es. promo Pokémon Center che non vuoi nel masterset).</div>'
        : '';

    container.innerHTML = intestazione(
        `<span class="page-azione${_setUi.modificaDett ? ' attiva' : ''}" onclick="_setUiToggleModificaDett()">${_setUi.modificaDett ? 'Fine' : 'Ignora carte'}</span>`) + `
        <div class="${inline ? 'set-dett-corpo' : 'pg-pagina'}${_setUi.modificaDett ? ' set-modifica' : ''}">
            <div class="pg-intro">
                <div class="pg-grande">${percTesto}%</div>
                <div class="pg-sotto">${hai}/${totale} · ${mancanti === 0 && totale > 0 ? 'completo' : mancanti + ' mancanti'} · ${dati.catalogo ? 'masterset' : (setMSenzaDatiVarianti(sigla) ? 'set base' : 'set base (catalogo per carta da caricare)')}</div>
            </div>
            ${(!dati.catalogo && setMSenzaDatiVarianti(sigla)) ? '<div class="set-nota">Il database esterno da cui generiamo il catalogo non distingue ancora le varianti (normale/reverse/holo...) per questo set: qui conta solo il numero, come per tutti gli altri. Verrà aggiornato con le varianti appena i dati saranno disponibili.</div>' : ''}
            <div class="pg-barra-track"><div class="pg-barra-fill" style="width:${percTesto}%"></div></div>
            ${notaModifica}
            <div class="pg-filtri">${filtri}</div>
            <div class="set-msg">${_setUiAttr(_setUi.msg)}</div>
            ${carte
                ? `<div class="set-griglia">${carte}</div>`
                : '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1.5rem 0;">Nessuna carta in questa vista.</p>'}
        </div>`;
}

function _setUiClickCarta(el) {
    if (!_setUi.modificaDett || !el) return;
    const numero = parseInt(el.dataset.n, 10);
    const variante = el.dataset.v;
    if (!Number.isFinite(numero) || !variante) return;
    return _setUiToggleIgnora(numero, variante);
}

async function _setUiToggleIgnora(numero, variante) {
    const userId = await authGetUserId();
    const sigla = _setUi.dett;
    if (!userId || !sigla) return;
    const chiave = setMChiaveIgnorata(sigla, numero, variante);
    const eraIgnorata = _setM.ignorate.has(chiave);
    _setUi.msg = '';
    if (eraIgnorata) _setM.ignorate.delete(chiave); else _setM.ignorate.add(chiave);
    _setUiRender();

    const { error } = await setIgnorataImposta(userId, sigla, numero, variante, !eraIgnorata);
    if (error) {
        console.error('Set — ignora carta:', error.message || error);
        if (eraIgnorata) _setM.ignorate.add(chiave); else _setM.ignorate.delete(chiave);
        _setUi.msg = 'Non sono riuscito a salvare la modifica. Riprova.';
        _setUiRender();
        return;
    }
    setMotoreAggiorna({ render: false });
}

function _setUiApriClassifica() {
    _setUi.classifica = true;
    _setUi.msg = '';
    _setUiRender();
}

function _setUiChiudiClassifica() {
    _setUi.classifica = false;
    _setUi.msg = '';
    _setUiRender();
}

function _setUiRenderClassifica(container) {
    const r = setMCalcolaTutti();
    if (r.daCaricare.length) {
        setMCaricaRighe(r.daCaricare)
            .then(caricate => { if (caricate && _setUi.classifica) _setUiRender(); })
            .catch(e => console.error('Set — caricamento righe:', e));
    }
    const lista = setMDaClassificare();
    const conProposta = lista.filter(x => x.proposta);

    let corpo = '';
    let setCorrente = null;
    lista.forEach(x => {
        if (x.sigla !== setCorrente) {
            setCorrente = x.sigla;
            const lib = (typeof _ballLIBRERIA_SET !== 'undefined' && _ballLIBRERIA_SET) ? _ballLIBRERIA_SET : {};
            corpo += `<div class="pg-titoletto">${_setUiAttr((lib[x.sigla] && lib[x.sigla].nome) || x.sigla)}</div>`;
        }
        const opzioni = x.opzioni.map(v =>
            `<option value="${_setUiAttr(v)}"${v === x.proposta ? ' selected' : ''}>${_setUiAttr(setMEtichettaVariante(v) || 'Normale')}</option>`).join('');
        corpo += `<div class="pg-riga set-cl-riga">
            <div class="pg-testo"><b>${_setUiAttr(x.carta.name)}</b><span>${_setUiAttr(x.carta.code)} · ${_setUiAttr(x.metodo)}</span></div>
            <select class="set-cl-select" data-id="${_setUiAttr(x.carta.id)}" onchange="_setUiClassificaUna(this)">
                <option value="">— scegli —</option>${opzioni}
            </select>
        </div>`;
    });

    container.innerHTML = `
        <div class="page-header">
            <button type="button" class="pg-indietro" onclick="_setUiChiudiClassifica()" aria-label="Torna ai set"><i class="fa-solid fa-chevron-left"></i></button>
            <span class="page-title">Da classificare</span>
        </div>
        <div class="pg-pagina">
            <div class="set-nota">Queste carte X non hanno ancora la variante. Le proposte vengono dal link Cardmarket della carta: controllale e conferma. Puoi cambiare scelta riga per riga.</div>
            ${conProposta.length ? `<div class="pg-bottoni"><button type="button" class="primario" onclick="_setUiConfermaProposte()">Conferma le ${conProposta.length} proposte</button></div>` : ''}
            <div class="set-msg">${_setUiAttr(_setUi.msg)}</div>
            <div class="pg-elenco">${lista.length ? corpo
                : '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1.5rem 0;">Nessuna carta da classificare.</p>'}</div>
        </div>`;
}

async function _setUiClassificaUna(sel) {
    if (!sel || !sel.value) return;
    await _setUiSalvaVarianti([{ id: sel.dataset.id, variante: sel.value }]);
}

async function _setUiConfermaProposte() {
    const voci = setMDaClassificare().filter(x => x.proposta).map(x => ({ id: x.carta.id, variante: x.proposta }));
    await _setUiSalvaVarianti(voci);
}

async function _setUiSalvaVarianti(voci) {
    if (!voci.length) return;
    const gruppi = new Map();
    voci.forEach(v => {
        const carta = carteReali.find(c => String(c.id) === String(v.id));
        if (!carta) return;
        if (!gruppi.has(v.variante)) gruppi.set(v.variante, []);
        gruppi.get(v.variante).push(carta);
    });
    _setUi.msg = '';
    for (const [variante, carte] of gruppi) {
        carte.forEach(c => { c.variante = variante; });
        const { error } = await setCarteVarianteImposta(carte.map(c => c.id), variante);
        if (error) {
            console.error('Set — salvataggio variante:', error.message || error);
            carte.forEach(c => { c.variante = null; });
            _setUi.msg = 'Non sono riuscito a salvare alcune varianti. Riprova.';
            break;
        }
    }
    _setUiRender();
    setMotoreAggiorna({ render: false });
}
