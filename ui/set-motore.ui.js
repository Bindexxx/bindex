// Set: completamento, soglie, notifiche.

const SET_SENZA_DATI_VARIANTI = new Set([
    'BWP','KSS',
    'TK6N','TK6S','TK7A','TK7B','TK8A','TK8O','TK9P','TK9S','XYP'
]);
function setMSenzaDatiVarianti(sigla) {
    return SET_SENZA_DATI_VARIANTI.has(sigla);
}

const SET_SOGLIE = [25, 50, 75, 90, 99, 100];
const SET_SOGLIE_NASCOSTI = [99, 100];
const SET_INTERVALLO_MS = 30000;
const SET_RETRY_RIGHE_MS = 60000;

const _setM = {
    userId: null,
    baseOk: false,
    catalogoOk: false,
    tentato: false,
    conteggi: new Map(),
    righe: new Map(),
    righeInCaricamento: new Set(),
    righeErroreTs: 0,
    baseTentativoTs: 0,
    firmaRender: null,
    nascosti: new Set(),
    ignorate: new Set(),
    soglie: new Map(),
    occupato: false,
    timer: null
};

function _setMReset(userId) {
    _setM.userId = userId;
    _setM.baseOk = false;
    _setM.catalogoOk = false;
    _setM.tentato = false;
    _setM.conteggi = new Map();
    _setM.righe = new Map();
    _setM.righeInCaricamento = new Set();
    _setM.righeErroreTs = 0;
    _setM.baseTentativoTs = 0;
    _setM.firmaRender = null;
    _setM.nascosti = new Set();
    _setM.ignorate = new Set();
    _setM.soglie = new Map();
}

function setMChiaveIgnorata(sigla, numero, variante) {
    return sigla + '|' + numero + '|' + variante;
}

function setMNormVariante(v) {
    const s = String(v == null ? '' : v).trim().toLowerCase();
    return s || 'normale';
}

const _SET_ORDINE_VARIANTI = { normale: 0, reverse: 1, ball: 2 };
function _setMOrdineVariante(v) {
    return v in _SET_ORDINE_VARIANTI ? _SET_ORDINE_VARIANTI[v] : 10;
}

function setMVariantiPossedute(letto, c) {
    if (c && c.variante) return [setMNormVariante(c.variante)];
    if (letto.variante === 'ball') return ['ball'];
    if (letto.variante === 'stampata') return ['normale', 'stampata'];
    if (letto.variante === 'halloween') return ['normale', 'halloween'];
    return [c && c.reverseHolo ? 'reverse' : 'normale'];
}

function setMPossedute() {
    const per = new Map();
    const coll = (typeof carteReali !== 'undefined' && Array.isArray(carteReali)) ? carteReali : [];
    coll.forEach(c => {
        if (c.stato !== 'collezione' || c.tabella !== 'carte') return;
        const letto = _ballLeggiCodice(c.code);
        if (!letto) return;
        let s = per.get(letto.set);
        if (!s) { s = { numeri: new Map(), carte: 0, senzaNumero: 0 }; per.set(letto.set, s); }
        s.carte++;
        if (letto.numero == null) { s.senzaNumero++; return; }
        let v = s.numeri.get(letto.numero);
        if (!v) { v = new Map(); s.numeri.set(letto.numero, v); }
        setMVariantiPossedute(letto, c).forEach(k => { if (!v.has(k)) v.set(k, c); });
    });
    return per;
}

function _setMDescrittore(sigla, info) {
    const nCat = _setM.conteggi.get(sigla) || 0;
    if (nCat > 0) {
        const righe = _setM.righe.get(sigla);
        if (righe) return { tipo: 'catalogo', righe };
        return { tipo: 'catalogo-da-caricare', n: nCat };
    }
    const tot = info && info.totale;
    if (tot > 0) return { tipo: 'fallback', totale: tot };
    return null;
}

function _setMPerOgniVoce(desc, cb) {
    if (desc.tipo === 'catalogo') {
        desc.righe.forEach(r => cb(r.numero, r.variante, r));
    } else {
        for (let n = 1; n <= desc.totale; n++) cb(n, 'normale', null);
    }
}

function _setMTrovaCarta(pos, numero, variante, qualsiasiVariante) {
    if (!pos) return null;
    const v = pos.numeri.get(numero);
    if (!v) return null;
    if (qualsiasiVariante) return v.values().next().value || null;
    return v.get(variante) || null;
}

function setMCalcolaTutti() {
    const lib = (typeof _ballLIBRERIA_SET !== 'undefined' && _ballLIBRERIA_SET) ? _ballLIBRERIA_SET : {};
    const possedute = setMPossedute();

    const ignPerSigla = new Map();
    _setM.ignorate.forEach(k => {
        const s = k.slice(0, k.indexOf('|'));
        ignPerSigla.set(s, (ignPerSigla.get(s) || 0) + 1);
    });

    const universo = new Set([...Object.keys(lib), ..._setM.conteggi.keys()]);
    const voci = [];
    const daCaricare = [];

    universo.forEach(sigla => {
        const info = lib[sigla];
        const nome = (info && info.nome) || sigla;
        const pos = possedute.get(sigla);
        const nascosto = _setM.nascosti.has(sigla);
        let desc = _setMDescrittore(sigla, info);
        if (!desc) return;

        let provvisorio = false;
        let catalogo = desc.tipo !== 'fallback';

        if (desc.tipo === 'catalogo-da-caricare') {
            if (pos || ignPerSigla.get(sigla)) {
                daCaricare.push(sigla);
                if (info && info.totale > 0) {
                    desc = { tipo: 'fallback', totale: info.totale };
                    catalogo = false;
                    provvisorio = true;
                } else {
                    return;
                }
            } else {
                voci.push(_setMVoce(sigla, nome, desc.n, 0, true, nascosto, false));
                return;
            }
        }

        let totale = 0, hai = 0;
        const fallback = desc.tipo === 'fallback';
        _setMPerOgniVoce(desc, (numero, variante) => {
            if (_setM.ignorate.has(setMChiaveIgnorata(sigla, numero, variante))) return;
            totale++;
            if (_setMTrovaCarta(pos, numero, variante, fallback)) hai++;
        });
        voci.push(_setMVoce(sigla, nome, totale, hai, catalogo, nascosto, provvisorio));
    });

    const sconosciute = [];
    possedute.forEach((s, sigla) => {
        if (!universo.has(sigla)) sconosciute.push({ sigla, carte: s.carte });
    });
    sconosciute.sort((a, b) => b.carte - a.carte || a.sigla.localeCompare(b.sigla));

    return { voci, daCaricare, sconosciute };
}

function _setMVoce(sigla, nome, totale, hai, catalogo, nascosto, provvisorio) {
    return {
        sigla, nome, totale, hai,
        mancanti: totale - hai,
        perc: totale > 0 ? (hai / totale) * 100 : 0,
        catalogo, nascosto, provvisorio,
        iniziato: hai > 0,
        completo: totale > 0 && hai === totale
    };
}

function setMVociSet(sigla) {
    const lib = (typeof _ballLIBRERIA_SET !== 'undefined' && _ballLIBRERIA_SET) ? _ballLIBRERIA_SET : {};
    const info = lib[sigla];
    const desc = _setMDescrittore(sigla, info);
    if (!desc || desc.tipo === 'catalogo-da-caricare') return null;

    const pos = setMPossedute().get(sigla);
    const fallback = desc.tipo === 'fallback';
    const out = [];
    _setMPerOgniVoce(desc, (numero, variante, r) => {
        const carta = _setMTrovaCarta(pos, numero, variante, fallback);
        out.push({
            numero, variante,
            nome: r ? (r.nome || '') : '',
            rarita: r ? (r.rarita || '') : '',
            immagine: (r && r.immagine) || (carta && carta.immagine) || '',
            posseduta: !!carta,
            ignorata: _setM.ignorate.has(setMChiaveIgnorata(sigla, numero, variante))
        });
    });
    return { catalogo: !fallback, voci: out };
}

function setMSuddividi(voci) {
    const perMancanti = (a, b) => a.mancanti - b.mancanti || a.nome.localeCompare(b.nome);
    const g = { inCorso: [], completati: [], nonIniziati: [], nascosti: [] };
    voci.forEach(v => {
        if (v.nascosto) g.nascosti.push(v);
        else if (v.completo) g.completati.push(v);
        else if (v.iniziato) g.inCorso.push(v);
        else g.nonIniziati.push(v);
    });
    g.inCorso.sort(perMancanti);
    g.nonIniziati.sort(perMancanti);
    g.nascosti.sort(perMancanti);
    g.completati.sort((a, b) => a.nome.localeCompare(b.nome));
    return g;
}

async function _setMCaricaBase(userId) {
    _setM.tentato = true;
    _setM.baseTentativoTs = Date.now();
    const [cat, nas, ign, sog] = await Promise.all([
        setCatalogoConteggiLeggi(),
        setNascostiLeggi(userId),
        setIgnorateLeggi(userId),
        setSoglieLeggi(userId)
    ]);

    if (cat.error) {
        _setM.catalogoOk = false;
        console.error('Set — conteggi catalogo:', cat.error.message || cat.error);
    } else {
        _setM.conteggi = new Map();
        (cat.data || []).forEach(r => {
            if (r.sigla && r.carte > 0) _setM.conteggi.set(String(r.sigla).toUpperCase(), r.carte);
        });
        _setM.catalogoOk = true;
    }

    if (nas.error || ign.error || sog.error) {
        _setM.baseOk = false;
        const e = nas.error || ign.error || sog.error;
        console.error('Set — preferenze utente (nascosti/ignorate/soglie):', e.message || e);
        return false;
    }

    _setM.nascosti = new Set(nas.data.map(r => String(r.sigla).toUpperCase()));
    _setM.ignorate = new Set(ign.data.map(r =>
        setMChiaveIgnorata(String(r.sigla).toUpperCase(), Number(r.numero), setMNormVariante(r.variante))));
    _setM.soglie = new Map();
    sog.data.forEach(r => {
        const sigla = String(r.sigla).toUpperCase();
        if (!_setM.soglie.has(sigla)) _setM.soglie.set(sigla, new Map());
        _setM.soglie.get(sigla).set(Number(r.soglia), { raggiunta_il: r.raggiunta_il, vista_il: r.vista_il });
    });
    _setM.baseOk = true;
    return true;
}

async function setMCaricaRighe(sigle) {
    const da = (sigle || []).filter(s =>
        !_setM.righe.has(s) && !_setM.righeInCaricamento.has(s) && (_setM.conteggi.get(s) || 0) > 0);
    if (!da.length) return false;
    if (Date.now() - _setM.righeErroreTs < SET_RETRY_RIGHE_MS) return false;

    da.forEach(s => _setM.righeInCaricamento.add(s));
    try {
        const { data, error } = await setCatalogoRigheLeggi(da);
        if (error) {
            _setM.righeErroreTs = Date.now();
            console.error('Set — righe catalogo:', error.message || error);
            return false;
        }
        const gruppi = new Map();
        da.forEach(s => gruppi.set(s, []));
        data.forEach(r => {
            const sigla = String(r.sigla).toUpperCase();
            if (!gruppi.has(sigla)) return;
            gruppi.get(sigla).push({
                numero: Number(r.numero),
                variante: setMNormVariante(r.variante),
                nome: r.nome || '',
                rarita: r.rarita || '',
                immagine: r.immagine || '',
                cardmarketId: r.cardmarket_id != null ? Number(r.cardmarket_id) : null
            });
        });
        gruppi.forEach((righe, sigla) => {
            righe.sort((a, b) => a.numero - b.numero
                || _setMOrdineVariante(a.variante) - _setMOrdineVariante(b.variante)
                || a.variante.localeCompare(b.variante));
            _setM.righe.set(sigla, righe);
        });
        _setM.righeErroreTs = 0;
        return true;
    } finally {
        da.forEach(s => _setM.righeInCaricamento.delete(s));
    }
}

const _SET_ETICHETTE_VARIANTI = {
    normale: '', reverse: 'Reverse', ball: 'Ball (generica)',
    'reverse-energy': 'Reverse Energy', 'reverse-pokeball': 'Reverse Poké Ball',
    'reverse-masterball': 'Reverse Master Ball', 'reverse-duskball': 'Reverse Dusk Ball',
    'reverse-loveball': 'Reverse Love Ball', 'reverse-friendball': 'Reverse Friend Ball',
    'reverse-quickball': 'Reverse Quick Ball', 'reverse-team-rocket': 'Reverse Team Rocket',
    'reverse-cosmos': 'Reverse Cosmos', holo: 'Holo', 'holo-cosmos': 'Holo Cosmos',
    'holo-gold': 'Holo Oro', 'holo-tinsel': 'Holo Tinsel'
};
function setMEtichettaVariante(v) {
    if (v in _SET_ETICHETTE_VARIANTI) return _SET_ETICHETTE_VARIANTI[v];
    return String(v).replace(/-/g, ' ').replace(/^./, ch => ch.toUpperCase());
}

function setMDaClassificare() {
    const coll = (typeof carteReali !== 'undefined' && Array.isArray(carteReali)) ? carteReali : [];
    const out = [];
    coll.forEach(c => {
        if (c.stato !== 'collezione' || c.tabella !== 'carte' || c.variante) return;
        const letto = _ballLeggiCodice(c.code);
        if (!letto || letto.variante !== 'ball' || letto.numero == null) return;
        const righe = _setM.righe.get(letto.set);
        if (!righe) return;
        const delNumero = righe.filter(r => r.numero === letto.numero);
        const speciali = delNumero
            .filter(r => r.variante.indexOf('-') > 0 && r.cardmarketId)
            .sort((a, b) => a.cardmarketId - b.cardmarketId);
        if (!speciali.length) return;

        const link = String(c.link || '');
        const mv = /-V(\d+)-/.exec(link);
        let proposta = null, metodo = 'scegli a mano';
        if (mv && /Additionals/.test(link)) {
            const k = parseInt(mv[1], 10);
            if (speciali[k - 1]) { proposta = speciali[k - 1].variante; metodo = 'dal link (V' + k + ')'; }
            else metodo = 'V' + k + ' non trovata nel catalogo';
        } else if (!mv && speciali.length === 1) {
            proposta = speciali[0].variante;
            metodo = /\/Products\/Singles\//.test(link) ? 'stampa unica' : 'unica possibile';
        } else if (mv) {
            metodo = 'link non degli Additionals';
        }
        const altre = delNumero.filter(r => !speciali.includes(r))
            .sort((a, b) => _setMOrdineVariante(a.variante) - _setMOrdineVariante(b.variante));
        out.push({
            carta: c, sigla: letto.set, numero: letto.numero, proposta, metodo,
            opzioni: [...speciali, ...altre].map(r => r.variante)
        });
    });
    out.sort((a, b) => a.sigla.localeCompare(b.sigla) || a.numero - b.numero || String(a.carta.name).localeCompare(String(b.carta.name)));
    return out;
}

function setMSoglieRaggiunte(v) {
    if (!(v.totale > 0)) return [];
    return SET_SOGLIE.filter(s => s === 100 ? v.hai === v.totale : v.hai * 100 >= s * v.totale);
}

function setMNotifica(v, soglia) {
    if (typeof CSBar !== 'undefined' && CSBar && typeof CSBar.notify === 'function') {
        const testo = soglia === 100 ? 'Set completato al 100%!'
            : (soglia === 99 ? 'Ci sei quasi: 99%' : 'Hai raggiunto il ' + soglia + '%');
        try {
            CSBar.notify({
                title: v.nome, text: testo, icon: '\u2726',
                target: '#set', priority: soglia >= 90 ? 'high' : 'normal'
            });
        } catch (e) { console.error('Set — notifica CSBar:', e); }
    }
    if (typeof _beep === 'function') { try { _beep(1000, 90); } catch (_) {   } }
}

function _setMRegistraLocale(sigla, soglia, raggiuntaIl, vistaIl) {
    if (!_setM.soglie.has(sigla)) _setM.soglie.set(sigla, new Map());
    _setM.soglie.get(sigla).set(soglia, { raggiunta_il: raggiuntaIl, vista_il: vistaIl });
}

async function setMValutaSoglie(userId, voci) {
    if (!_setM.baseOk || !_setM.catalogoOk) return 0;

    const adesso = new Date().toISOString();
    const silenziose = [];
    const daNotificare = [];

    voci.forEach(v => {
        if (v.provvisorio || !(v.totale > 0)) return;
        const reg = _setM.soglie.get(v.sigla);
        const raggiunte = setMSoglieRaggiunte(v);

        if (!reg) {
            silenziose.push({ sigla: v.sigla, soglia: 0, raggiunta_il: adesso, vista_il: adesso });
            raggiunte.forEach(s => silenziose.push({ sigla: v.sigla, soglia: s, raggiunta_il: adesso, vista_il: adesso }));
            return;
        }

        const nuove = raggiunte.filter(s => !reg.has(s));
        if (!nuove.length) return;
        const permesse = v.nascosto ? SET_SOGLIE_NASCOSTI : SET_SOGLIE;
        const notificabili = nuove.filter(s => permesse.includes(s));
        const top = notificabili.length ? Math.max(...notificabili) : null;
        nuove.forEach(s => {
            if (s !== top) silenziose.push({ sigla: v.sigla, soglia: s, raggiunta_il: adesso, vista_il: adesso });
        });
        if (top != null) daNotificare.push({ v, soglia: top });
    });

    if (silenziose.length) {
        const { error } = await setSoglieInserisciSilenziose(userId, silenziose);
        if (error) {
            console.error('Set — registrazione soglie:', error.message || error);
            return 0;
        }
        silenziose.forEach(r => _setMRegistraLocale(r.sigla, r.soglia, r.raggiunta_il, r.vista_il));
    }

    let inviate = 0;
    for (const { v, soglia } of daNotificare) {
        const { error } = await setSoglieInserisciNotificata(userId, v.sigla, soglia, adesso);
        if (error) {
            if (error.code === '23505') {
                _setMRegistraLocale(v.sigla, soglia, adesso, null);
            } else {
                console.error('Set — registrazione notifica:', error.message || error);
            }
            continue;
        }
        _setMRegistraLocale(v.sigla, soglia, adesso, null);
        setMNotifica(v, soglia);
        inviate++;
    }
    return inviate;
}

function setMNotificaNonVista() {
    let migliore = null;
    _setM.soglie.forEach((reg, sigla) => {
        reg.forEach((r, soglia) => {
            if (soglia <= 0 || r.vista_il) return;
            if (!migliore || String(r.raggiunta_il) > String(migliore.raggiunta_il)) {
                migliore = { sigla, soglia, raggiunta_il: r.raggiunta_il };
            }
        });
    });
    if (!migliore) return null;
    const lib = (typeof _ballLIBRERIA_SET !== 'undefined' && _ballLIBRERIA_SET) ? _ballLIBRERIA_SET : {};
    migliore.nome = (lib[migliore.sigla] && lib[migliore.sigla].nome) || migliore.sigla;
    return migliore;
}

async function setMSegnaViste() {
    if (!_setM.userId || !setMNotificaNonVista()) return;
    const adesso = new Date().toISOString();
    const { error } = await setSoglieSegnaViste(_setM.userId, adesso);
    if (error) { console.error('Set — segna viste:', error.message || error); return; }
    _setM.soglie.forEach(reg => reg.forEach(r => { if (!r.vista_il) r.vista_il = adesso; }));
}

async function setMotoreAggiorna(opts) {
    if (_setM.occupato) return;
    _setM.occupato = true;
    try {
        const userId = await authGetUserId();
        if (!userId) return;
        if (_setM.userId !== userId) _setMReset(userId);

        if (typeof carteReali === 'undefined' || !Array.isArray(carteReali) || carteReali.length === 0) return;

        if ((!_setM.baseOk || !_setM.catalogoOk) && Date.now() - _setM.baseTentativoTs >= SET_RETRY_RIGHE_MS) {
            await _setMCaricaBase(userId);
        }
        if (!_setM.baseOk) return;

        let r = setMCalcolaTutti();
        if (r.daCaricare.length) {
            await setMCaricaRighe(r.daCaricare);
            r = setMCalcolaTutti();
        }
        const notifiche = await setMValutaSoglie(userId, r.voci);

        const firma = setMFirma(r);
        if (notifiche > 0 || (opts && opts.render && firma !== _setM.firmaRender)) {
            _setM.firmaRender = firma;
            setMRidisegnaHome();
        }
    } catch (e) {
        console.error('Set — motore:', e);
    } finally {
        _setM.occupato = false;
    }
}

function setMFirma(r) {
    const g = setMSuddividi(r.voci);
    const nv = setMNotificaNonVista();
    return [
        g.inCorso.slice(0, 4).map(v => v.sigla + ':' + v.hai + '/' + v.totale).join(','),
        g.completati.length, g.nonIniziati.length, g.nascosti.length,
        nv ? nv.sigla + nv.soglia : ''
    ].join('|');
}

function setMRidisegnaHome() {
    if (typeof renderWidgetHome !== 'function') return;
    if (document.body.classList.contains('phone-detail-open')) return;
    if (typeof _editModeWidget !== 'undefined' && _editModeWidget) return;
    renderWidgetHome();
}

function setAvviaMotore() {
    if (_setM.timer) return;
    _setM.timer = setInterval(() => { if (!document.hidden) setMotoreAggiorna({ render: true }); }, SET_INTERVALLO_MS);
    setTimeout(() => { setMotoreAggiorna({ render: true }); }, 3000);
}
