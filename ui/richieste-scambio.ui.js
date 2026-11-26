// Pagina Scambi: proposte a due vie (sql/154) e richieste di prima, anche degli ospiti.
// Le proposte si gestiscono intere (Accetta / Cambia / Rifiuta, Ritira, Fatto, Annulla); le richieste
// di prima e quelle degli ospiti restano riga per riga come prima.

let _scambiTab = 'fare';
let _scambiStoricoFiltro = 'tutti';
let _scambiVoci = [];
let _scambiSel = null;
let _scambiDettaglioTel = false;
let _scambiIo = null;
let _scambiDaAprire = null;
let _richiesteRicevute = [];
let _richiesteInviate = [];
let _richiesteNick = {};

const MOTIVI_ANNULLAMENTO = {
    ho_cambiato_idea: 'Ho cambiato idea',
    non_piu_disponibile: 'Non più disponibile',
    accordo_non_concluso: 'Accordo non concluso',
    errore_prenotazione: 'Errore nella prenotazione',
    sostituito_altro_accordo: 'Sostituito da un altro accordo',
    intervento_amministrativo: 'Intervento amministrativo',
};

const MOTIVI_SISTEMA = {
    scaduta: 'Scaduta dopo 7 giorni senza risposta',
    bloccato: 'Ospite bloccato',
};

const STATO_RIGA_LABEL = {
    in_attesa: { testo: 'In attesa', colore: 'var(--text-muted)', cls: 'bx-stato-attesa' },
    accettata: { testo: 'Riservata', colore: 'var(--primary)', cls: 'bx-stato-riservata' },
    rifiutata: { testo: 'Rifiutata', colore: 'var(--danger)', cls: 'bx-stato-rifiutata' },
    annullata: { testo: 'Annullata', colore: 'var(--danger)', cls: 'bx-stato-annullata' },
    conclusa: { testo: 'Conclusa', colore: 'var(--success)', cls: 'bx-stato-conclusa' },
};

async function _scambiProva(fn, nome) {
    try { const r = await fn(); if (r && r.error) console.warn(nome + ':', r.error.message); }
    catch (e) { console.warn(nome + ':', e); }
}

async function apriPaginaRichieste(mantieni) {
    if (typeof _widgetRichiesteSvuotaCache === 'function') _widgetRichiesteSvuotaCache();
    const userId = await authGetUserId();
    if (!userId) return;
    _scambiIo = userId;

    const wrap = document.getElementById('richiesteContenuto');
    if (wrap && !_scambiVoci.length) wrap.innerHTML = '<p class="match-vuoto"><i class="fa-solid fa-spinner fa-spin"></i> Carico gli scambi…</p>';

    await Promise.all([_scambiProva(scadiRichiesteOspite, 'scadiRichiesteOspite'), _scambiProva(scadiProposte, 'scadiProposte')]);

    const [ric, inv, prop] = await Promise.all([
        richiesteScambioRicevuteList(userId),
        richiesteScambioInviateList(userId),
        scambiProposteList(userId),
    ]);
    if (ric.error) console.error('apriPaginaRichieste (ricevute):', ric.error.message);
    if (inv.error) console.error('apriPaginaRichieste (inviate):', inv.error.message);
    if (prop.error) console.error('apriPaginaRichieste (proposte):', prop.error.message);

    _richiesteRicevute = ric.data || [];
    _richiesteInviate = inv.data || [];
    _scambiVoci = _scambiCostruisciVoci(prop.data || []);

    const ids = [...new Set(_scambiVoci.map(v => v.altro).filter(id => id && !String(id).startsWith('ospite:')))];
    _richiesteNick = {};
    if (ids.length) {
        try {
            const { data, error } = await chatOttieniNicknames(ids);
            if (error) console.error('apriPaginaRichieste (nickname):', error.message);
            else (data || []).forEach(n => { if (n.nickname) _richiesteNick[n.owner_id] = n.nickname; });
        } catch (e) { console.error('apriPaginaRichieste (nickname):', e); }
    }

    if (!mantieni) {
        const c = _scambiConta();
        _scambiTab = c.fare ? 'fare' : (c.corso ? 'corso' : (c.storico ? 'storico' : 'fare'));
        _scambiStoricoFiltro = 'tutti';
        _scambiSel = null;
        _scambiDettaglioTel = false;
    }
    if (_scambiDaAprire) {
        const v = _scambiVoci.find(x => String(x.id) === String(_scambiDaAprire));
        if (v) {
            _scambiTab = v.gruppo;
            if (v.gruppo === 'storico') _scambiStoricoFiltro = 'tutti';
            _scambiSel = v.id;
            _scambiDettaglioTel = true;
        }
        _scambiDaAprire = null;
    }
    renderPaginaRichieste();
}

// Da chat, widget e avvisi: apre la pagina Scambi su quello scambio.
function apriScambio(id) {
    _scambiDaAprire = id || null;
    if (typeof apriDettaglioWidget === 'function') apriDettaglioWidget('richieste');
    else apriPaginaRichieste(true);
}

// Dopo una proposta mandata dalla finestra: se la pagina Scambi è aperta, la mostra.
function _scambiDopoProposta(id) {
    const pagina = document.getElementById('richieste');
    if (pagina && pagina.classList.contains('active')) {
        _scambiDaAprire = id || null;
        apriPaginaRichieste(true);
    }
}

function _scambiCostruisciVoci(proposte) {
    const io = _scambiIo;
    const voci = [];
    (proposte || []).forEach(p => {
        if (p.stato_proposta === 'superata') return;
        const mittente = p.richiedente_id === io;
        const righe = p.richieste_scambio_righe || [];
        const v = {
            id: p.id, kind: 'proposta', p, mittente,
            altro: mittente ? p.proprietario_id : p.richiedente_id,
            stato: p.stato_proposta,
            ricevi: righe.filter(r => r.richiedente_id === io),
            dai: righe.filter(r => r.proprietario_id === io),
            euroDai: Number(mittente ? p.euro_da_richiedente : p.euro_da_proprietario) || 0,
            euroRicevi: Number(mittente ? p.euro_da_proprietario : p.euro_da_richiedente) || 0,
            fattoIo: mittente ? p.fatto_richiedente_il : p.fatto_proprietario_il,
            fattoAltro: mittente ? p.fatto_proprietario_il : p.fatto_richiedente_il,
            quando: p.creato_il, aggiornato: p.aggiornato_il || p.creato_il,
        };
        if (v.stato === 'in_attesa') v.gruppo = mittente ? 'corso' : 'fare';
        else if (v.stato === 'accettata') v.gruppo = v.fattoIo ? 'corso' : 'fare';
        else { v.gruppo = 'storico'; v.esito = v.stato === 'conclusa' ? 'fatto' : 'non_andato'; }
        voci.push(v);
    });
    _richiesteRaggruppa(_richiesteRicevute, true).forEach(g => voci.push(_scambiVoceRichiesta(g, true)));
    _richiesteRaggruppa(_richiesteInviate, false).forEach(g => voci.push(_scambiVoceRichiesta(g, false)));
    return voci.sort((a, b) => new Date(b.aggiornato || b.quando) - new Date(a.aggiornato || a.quando));
}

function _scambiVoceRichiesta(g, eRicevute) {
    const v = { id: g.id, kind: 'richiesta', g, eRicevute, altro: g.altro, ospite: g.ospite, quando: g.quando, aggiornato: g.aggiornato || g.quando };
    if (eRicevute && g.attesa) v.gruppo = 'fare';
    else if (g.attesa || g.riservate) v.gruppo = 'corso';
    else { v.gruppo = 'storico'; v.esito = g.righe.some(r => r.stato_riga === 'conclusa') ? 'fatto' : 'non_andato'; }
    return v;
}

function _scambiConta() {
    const c = { fare: 0, corso: 0, storico: 0, fatti: 0 };
    _scambiVoci.forEach(v => { c[v.gruppo]++; if (v.esito === 'fatto') c.fatti++; });
    return c;
}

function _richiesteNome(ownerId) { return _richiesteNick[ownerId] || 'Un utente del gruppo'; }

function _richiestaOspite(riga) {
    const rs = riga && riga.richieste_scambio;
    return (rs && rs.codice_rq) ? rs : null;
}
function _richiesteNomeGruppo(g) {
    if (g.ospite) return g.ospite.ospite_nome || 'Ospite';
    return _richiesteNome(g.altro);
}
function _scambiNomeVoce(v) {
    return v.kind === 'richiesta' ? _richiesteNomeGruppo(v.g) : _richiesteNome(v.altro);
}
function _richiesteAvatarHtml(g, nome) {
    return g.ospite
        ? `<div class="match-avatar ric-avatar-ospite" title="Ospite"><i class="fa-solid fa-user"></i></div>`
        : `<div class="match-avatar" data-avatar-utente="${escapeHtml(String(g.altro))}">${escapeHtml(nome.charAt(0).toUpperCase())}</div>`;
}
function _richiesteLinkContatto(tipo, contatto) {
    const c = String(contatto || '').trim();
    if (!c) return null;
    const handle = c.replace(/^@/, '');
    if (tipo === 'whatsapp') {
        let num = c.replace(/[^0-9]/g, '');
        if (num.length === 10 && num.charAt(0) === '3') num = '39' + num;
        return num.length >= 8 ? 'https://wa.me/' + num : null;
    }
    if (tipo === 'telegram') return /^[A-Za-z0-9_]{3,64}$/.test(handle) ? 'https://t.me/' + handle : null;
    if (tipo === 'instagram') return /^[A-Za-z0-9_.]{1,64}$/.test(handle) ? 'https://instagram.com/' + handle : null;
    if (tipo === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) ? 'mailto:' + c : null;
    return null;
}
const _RICHIESTE_CONTATTI = {
    whatsapp: { etichetta: 'WhatsApp', icona: 'fa-brands fa-whatsapp' },
    telegram: { etichetta: 'Telegram', icona: 'fa-brands fa-telegram' },
    instagram: { etichetta: 'Instagram', icona: 'fa-brands fa-instagram' },
    email: { etichetta: 'Email', icona: 'fa-solid fa-envelope' },
};

function _scambiCambiaTab(tab) { _scambiTab = tab; _scambiSel = null; _scambiDettaglioTel = false; renderPaginaRichieste(); }
function _scambiFiltroStorico(f) { _scambiStoricoFiltro = f; _scambiSel = null; _scambiDettaglioTel = false; renderPaginaRichieste(); }
function _richiesteApri(id) { _scambiSel = id; _scambiDettaglioTel = true; renderPaginaRichieste(); }
function _richiesteIndietro() { _scambiDettaglioTel = false; renderPaginaRichieste(); }

function _richiesteRaggruppa(righe, eRicevute) {
    const mappa = new Map();
    righe.forEach(r => {
        const id = r.richiesta_id || r.id;
        if (!mappa.has(id)) mappa.set(id, []);
        mappa.get(id).push(r);
    });
    return [...mappa.entries()].map(([id, rr]) => {
        const ospite = eRicevute ? _richiestaOspite(rr[0]) : null;
        const altro = eRicevute ? (rr[0].richiedente_id || ('ospite:' + id)) : rr[0].proprietario_id;
        const quando = (rr[0].richieste_scambio && rr[0].richieste_scambio.creato_il) || rr[0].creato_il;
        const aggiornato = rr.reduce((m, r) => (r.aggiornato_il && (!m || r.aggiornato_il > m)) ? r.aggiornato_il : m, null) || quando;
        const conta = (st) => rr.filter(r => r.stato_riga === st).length;
        const attesa = conta('in_attesa'), riservate = conta('accettata');
        const totale = rr.reduce((t, r) => t + (Number(r.prezzo_congelato) || 0) * (Number(r.quantita_richiesta) || 1), 0);
        let chip;
        if (attesa) chip = { cls: 'bx-stato-attesa', testo: `${attesa} in attesa` };
        else if (riservate) chip = { cls: 'bx-stato-riservata', testo: riservate === 1 ? 'Riservata' : `${riservate} riservate` };
        else { const st = STATO_RIGA_LABEL[rr[0].stato_riga] || { testo: rr[0].stato_riga, cls: '' }; chip = { cls: st.cls, testo: st.testo }; }
        return { id, righe: rr, altro, ospite, quando, aggiornato, attesa, riservate, totale, chip, chiusa: !attesa && !riservate };
    }).sort((x, y) => new Date(y.quando) - new Date(x.quando));
}

function _richiesteData(iso, conOra) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const g = d.toLocaleDateString('it-IT', conOra ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'short' });
    return conOra ? `${g}, ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}` : g;
}
// "19/11", come l'etichetta che mette il DB nei messaggi della chat.
function _scambiGiornoMese(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    try { return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Rome' }); }
    catch (_) { return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }); }
}

function _scambiPezzi(righe) { return righe.reduce((t, r) => t + (Number(r.quantita_richiesta) || 1), 0); }
function _scambiRiassunto(v) {
    const pezzo = (n, euro) => [n ? `${n} oggett${n === 1 ? 'o' : 'i'}` : '', euro > 0 ? formattaEuro(euro) : ''].filter(Boolean).join(' + ');
    const ricevi = pezzo(_scambiPezzi(v.ricevi), v.euroRicevi), dai = pezzo(_scambiPezzi(v.dai), v.euroDai);
    return [ricevi ? `ricevi ${ricevi}` : '', dai ? `dai ${dai}` : ''].filter(Boolean).join(' · ');
}

function _scambiChip(v) {
    if (v.kind === 'richiesta') return v.g.chip;
    switch (v.stato) {
        case 'in_attesa': return { cls: 'bx-stato-attesa', testo: v.mittente ? 'In attesa' : 'Da rispondere' };
        case 'accettata': return { cls: 'bx-stato-riservata', testo: v.fattoIo ? 'Fatto da te' : 'Accettata' };
        case 'conclusa': return { cls: 'bx-stato-conclusa', testo: 'Fatto' };
        case 'rifiutata': return { cls: 'bx-stato-rifiutata', testo: 'Rifiutata' };
        case 'scaduta': return { cls: 'bx-stato-annullata', testo: 'Scaduta' };
        default: return { cls: 'bx-stato-annullata', testo: 'Annullata' };
    }
}

function _scambiSottoRiga(v, nome) {
    if (v.kind === 'richiesta') {
        const g = v.g, n = g.righe.length;
        const verso = g.ospite ? 'ti ha chiesto' : (v.eRicevute ? 'ti ha chiesto' : 'hai chiesto');
        return `${_richiesteData(g.quando)} · ${verso} ${n} oggett${n === 1 ? 'o' : 'i'}${g.totale ? ` · ${formattaEuro(g.totale)}` : ''}`;
    }
    let coda = '';
    if (v.stato === 'in_attesa' && v.mittente && v.p.scade_il) coda = ` · scade il ${_richiesteData(v.p.scade_il)}`;
    else if (v.stato === 'accettata') coda = v.fattoIo ? ` · aspetta il Fatto di ${escapeHtml(nome)}` : ' · manca il tuo Fatto';
    return `${_richiesteData(v.quando)} · ${_scambiRiassunto(v)}${coda}`;
}

function _scambiRiepilogoHtml(c) {
    if (c.fare) return `<b>${c.fare} ${c.fare === 1 ? 'scambio aspetta' : 'scambi aspettano'} te</b>${c.corso ? ` · ${c.corso} in corso` : ''}`;
    if (c.corso) return `Niente da fare adesso · ${c.corso} in corso`;
    if (c.storico) return `Niente in corso · ${c.fatti} scamb${c.fatti === 1 ? 'io fatto' : 'i fatti'}`;
    return 'Proponi uno scambio da Match o dalla chat';
}

function renderPaginaRichieste() {
    const wrap = document.getElementById('richiesteContenuto');
    if (!wrap) return;
    const c = _scambiConta();
    const riep = document.getElementById('richiesteRiepilogo');
    if (riep) riep.innerHTML = _scambiRiepilogoHtml(c);

    const tab = (id, icona, testo, n) => `<button type="button" class="match-tabbtn ${_scambiTab === id ? 'attivo' : ''}" onclick="_scambiCambiaTab('${id}')"><i class="fa-solid ${icona}"></i> ${testo} &middot; ${n}</button>`;
    const tabsHtml = `<div class="match-tabs">${tab('fare', 'fa-bell', 'Da fare', c.fare)}${tab('corso', 'fa-hourglass-half', 'In corso', c.corso)}${tab('storico', 'fa-clock-rotate-left', 'Storico', c.storico)}</div>`;

    if (!_scambiVoci.length) {
        wrap.innerHTML = `<div class="ric-layout">${tabsHtml}<div class="stato-vuoto scb-vuoto-pagina"><i class="fa-solid fa-handshake"></i><br>Nessuno scambio ancora.<br>
            <span>Da Match o dalla chat scegli cosa ti interessa e premi <b>Proponi</b>: puoi dare carte, sealed, euro o tutti e tre.</span><br>
            <button type="button" class="ric-btn ric-btn-pieno" onclick="apriDettaglioWidget('match')"><i class="fa-solid fa-heart"></i> Vai a Match</button></div></div>`;
        return;
    }

    let voci = _scambiVoci.filter(v => v.gruppo === _scambiTab);
    let filtriHtml = '';
    if (_scambiTab === 'storico') {
        const fatti = voci.filter(v => v.esito === 'fatto');
        const nNon = voci.length - fatti.length;
        const filtri = [['tutti', 'Tutti', voci.length], ['fatti', 'Fatti', fatti.length], ['non_andati', 'Non andati', nNon]];
        filtriHtml = `<div class="ric-filtri">${filtri.map(([id, t, n]) => `<button type="button" class="ric-filtro ${_scambiStoricoFiltro === id ? 'attivo' : ''}" onclick="_scambiFiltroStorico('${id}')">${t} &middot; ${n}</button>`).join('')}</div>`;
        if (fatti.length) {
            let ricevuti = 0, dati = 0;
            fatti.forEach(v => {
                if (v.kind === 'proposta') { ricevuti += _scambiPezzi(v.ricevi); dati += _scambiPezzi(v.dai); }
                else {
                    const n = _scambiPezzi(v.g.righe.filter(r => r.stato_riga === 'conclusa'));
                    if (v.eRicevute) dati += n; else ricevuti += n;
                }
            });
            filtriHtml += `<div class="scb-storico-riep"><b>${fatti.length}</b> scamb${fatti.length === 1 ? 'io fatto' : 'i fatti'} · ${ricevuti} oggett${ricevuti === 1 ? 'o ricevuto' : 'i ricevuti'} · ${dati} dat${dati === 1 ? 'o' : 'i'}</div>`;
        }
        if (_scambiStoricoFiltro === 'fatti') voci = fatti;
        else if (_scambiStoricoFiltro === 'non_andati') voci = voci.filter(v => v.esito !== 'fatto');
    }

    if (voci.length && !voci.some(v => v.id === _scambiSel)) { _scambiSel = voci[0].id; _scambiDettaglioTel = false; }
    if (!voci.length) _scambiSel = null;

    const VUOTO = { fare: 'Niente da fare: nessuno aspetta una tua risposta.', corso: 'Nessuno scambio in corso.', storico: 'Nessuno scambio chiuso in questo gruppo.' };
    const NOTA = {
        fare: 'Proposte da accettare, cambiare o rifiutare, e scambi accettati in cui manca il tuo Fatto.',
        corso: 'Qui aspetti: la risposta o il Fatto dell\'altra persona.',
        storico: 'Gli scambi fatti e quelli che non sono andati.',
    };
    const elenco = voci.map(v => {
        const nome = _scambiNomeVoce(v);
        const chip = _scambiChip(v);
        return `<div class="ric-riga ${v.id === _scambiSel ? 'sel' : ''}" onclick="_richiesteApri('${escapeJsAttr(String(v.id))}')">
            ${_richiesteAvatarHtml(v.kind === 'richiesta' ? v.g : { altro: v.altro }, nome)}
            <div class="match-mtesto"><div class="match-persona-nome">${escapeHtml(nome)}${v.ospite ? ' <span class="ric-chip-ospite">OSPITE</span>' : ''}${v.gruppo === 'fare' ? ' <span class="match-punto"></span>' : ''}</div>
                <div class="match-persona-sotto">${_scambiSottoRiga(v, nome)}</div></div>
            <span class="bx-stato ${chip.cls}">${chip.testo}</span><i class="fa-solid fa-chevron-right match-freccia"></i></div>`;
    }).join('') || `<p class="match-vuoto">${VUOTO[_scambiTab]}</p>`;

    const sel = voci.find(v => v.id === _scambiSel);
    wrap.innerHTML = `
        <div class="ric-layout ${_scambiDettaglioTel ? 'ric-tel-dettaglio' : ''}">
            <div class="ric-master">
                ${tabsHtml}${filtriHtml}
                <div class="ric-elenco">${elenco}</div>
                <div class="match-descr">${NOTA[_scambiTab]}</div>
            </div>
            <div class="ric-dettaglio">${sel ? _scambiDettaglioHtml(sel) : ''}</div>
        </div>`;
    if (typeof fotoProfiloApplica === 'function') fotoProfiloApplica(wrap);
}

function _scambiDettaglioHtml(v) {
    if (v.kind === 'richiesta') return _richiesteDettaglioHtml(v.g, v.eRicevute);
    const nome = _scambiNomeVoce(v);
    const n = escapeHtml(nome);
    const idJs = escapeJsAttr(String(v.id));
    const titolo = v.mittente ? `La tua proposta a ${n}` : `Proposta di ${n}`;
    const sotto = `${_richiesteData(v.quando, true)}${v.p.sostituisce_id ? ' · al posto di una proposta di prima' : ''}`;
    const etichetta = `Proposta del ${_scambiGiornoMese(v.quando)}`;
    return `
        <div class="ric-card scb-card">
            <div class="match-persona-head ric-testata">
                <button type="button" class="pg-indietro ric-indietro" onclick="_richiesteIndietro()" aria-label="Tutti gli scambi" title="Tutti gli scambi"><i class="fa-solid fa-chevron-left"></i></button>
                ${_richiesteAvatarHtml({ altro: v.altro }, nome)}
                <div style="flex:1; min-width:0;">
                    <div class="match-persona-nome ric-titolo">${titolo}</div>
                    <div class="match-persona-sotto">${sotto}</div>
                </div>
                <button type="button" class="match-icobtn match-scrivi" onclick="apriChatPerRichiesta('${escapeJsAttr(String(v.altro))}', '${escapeJsAttr(nome)}', '${idJs}', '${escapeJsAttr(etichetta)}')" title="Scrivi a ${n}" aria-label="Scrivi a ${n}"><i class="fa-solid fa-comment"></i><span class="ric-scrivi-txt"> Scrivi a ${n}</span></button>
            </div>
            ${_scambiPassiHtml(v, n)}
            ${_scambiAvvisoHtml(v, n)}
            <div class="scb-lati">
                ${_scambiLatoHtml(`Ricevi da ${n}`, v.ricevi, v.euroRicevi, 'ricevi')}
                ${_scambiLatoHtml('Tu dai', v.dai, v.euroDai, 'dai')}
            </div>
            ${_scambiSaldoHtml(v)}
            ${_scambiAzioniHtml(v, n)}
        </div>`;
}

function _scambiPassiHtml(v, n) {
    if (v.stato !== 'in_attesa' && v.stato !== 'accettata' && v.stato !== 'conclusa') return '';
    const accettata = v.stato !== 'in_attesa';
    const conclusa = v.stato === 'conclusa';
    const passo = (fatto, attivo, testo) => `<li class="${fatto ? 'fatto' : ''}${attivo ? ' attivo' : ''}"><span class="scb-passo-segno">${fatto ? '<i class="fa-solid fa-check"></i>' : ''}</span><span>${testo}</span></li>`;
    return `<ol class="scb-passi" aria-label="A che punto è">
        ${passo(true, false, 'Proposta')}
        ${passo(accettata, !accettata, 'Accettata')}
        ${passo(conclusa || !!v.fattoIo, accettata && !conclusa && !v.fattoIo, 'Il tuo Fatto')}
        ${passo(conclusa || !!v.fattoAltro, accettata && !conclusa && !v.fattoAltro, `Fatto di ${n}`)}
    </ol>`;
}

function _scambiAvvisoHtml(v, n) {
    const scade = v.p.scade_il ? _richiesteData(v.p.scade_il) : '';
    const daMe = v.p.chiusa_da === _scambiIo;
    let testo, icona = 'fa-circle-info', cls = '';
    switch (v.stato) {
        case 'in_attesa':
            testo = v.mittente
                ? `Aspetti la risposta di ${n}${scade ? `: se non risponde, la proposta scade il ${scade}` : ''}.`
                : `${n} ti propone questo scambio: accettalo, cambialo o rifiutalo${scade ? ` entro il ${scade}` : ''}.`;
            if (!v.mittente) cls = ' scb-avviso-fare';
            break;
        case 'accettata':
            if (v.fattoIo) testo = `Hai premuto Fatto il ${_richiesteData(v.fattoIo, true)}. Gli oggetti passano quando lo preme anche ${n}.`;
            else {
                testo = v.fattoAltro
                    ? `${n} ha già premuto Fatto. Quando vi siete scambiati gli oggetti, premilo anche tu.`
                    : 'Accettata: gli oggetti restano riservati per voi. Vi vedete, fate lo scambio e premete Fatto tutti e due.';
                cls = ' scb-avviso-fare';
            }
            break;
        case 'conclusa':
            testo = `Scambio fatto il ${_richiesteData(v.aggiornato, true)}. Quello che hai ricevuto è nella Location “?”.`;
            icona = 'fa-circle-check'; cls = ' scb-avviso-ok';
            break;
        case 'rifiutata': testo = daMe ? 'Hai rifiutato questa proposta.' : `${n} ha rifiutato la proposta.`; break;
        case 'scaduta': testo = 'Scaduta: nessuna risposta in 14 giorni.'; break;
        default: {
            const motivo = v.p.motivo_chiusura ? (MOTIVI_ANNULLAMENTO[v.p.motivo_chiusura] || v.p.motivo_chiusura) : '';
            testo = `${daMe ? 'Annullata da te' : `Annullata da ${n}`}${motivo ? ': ' + escapeHtml(motivo.toLowerCase()) : ''}.`;
        }
    }
    return `<div class="scb-avviso${cls}"><i class="fa-solid ${icona}"></i><span>${testo}</span></div>`;
}

function _scambiImmagineHtml(immagine, sealed) {
    const src = _urlImmagineVisualizzabile(immagine, 96);
    return src
        ? `<img class="match-img" src="${src}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'match-img match-img-vuota',innerHTML:'<i class=&quot;fa-solid fa-image&quot;></i>'}))">`
        : `<span class="match-img match-img-vuota"><i class="fa-solid ${sealed ? 'fa-box' : 'fa-image'}"></i></span>`;
}

function _scambiLatoHtml(titolo, righe, euro, cls) {
    const totale = righe.reduce((t, r) => t + (Number(r.prezzo_congelato) || 0) * (Number(r.quantita_richiesta) || 1), 0) + (Number(euro) || 0);
    const oggetti = righe.map(r => {
        const snap = r.snapshot || {};
        const meta = [snap.codice, snap.lingua, snap.condizione || snap.integrita_packaging].filter(Boolean).map(escapeHtml).join(' · ');
        const q = Number(r.quantita_richiesta) || 1;
        const prezzo = r.prezzo_congelato != null ? `${q > 1 ? `${q} × ` : ''}${formattaEuro(r.prezzo_congelato)}` : (q > 1 ? `${q} copie · senza prezzo` : 'senza prezzo');
        return `<div class="scb-ogg">${_scambiImmagineHtml(snap.immagine, !!r.prodotto_sealed_id)}
            <div class="ric-ogg-testo"><div class="match-riga-nome">${escapeHtml(snap.nome || snap.codice || '(senza nome)')}</div>
                ${meta ? `<div class="match-riga-prezzo">${meta}</div>` : ''}<div class="match-riga-prezzo">${prezzo}</div></div></div>`;
    }).join('');
    const euroHtml = euro > 0 ? `<div class="scb-ogg scb-ogg-euro"><span class="match-img scb-euro-ico"><i class="fa-solid fa-euro-sign"></i></span>
        <div class="ric-ogg-testo"><div class="match-riga-nome">${formattaEuro(euro)}</div><div class="match-riga-prezzo">in euro, fuori dall'app</div></div></div>` : '';
    return `<section class="scb-lato scb-lato-${cls}">
        <div class="scb-lato-testa"><b>${titolo}</b><span>${formattaEuro(totale)}</span></div>
        ${oggetti}${euroHtml}${!righe.length && !(euro > 0) ? '<p class="scb-niente">Niente</p>' : ''}
    </section>`;
}

function _scambiSaldoHtml(v) {
    const voci = (righe) => righe.map(r => ({ prezzo: r.prezzo_congelato, quantita: r.quantita_richiesta }));
    const s = scambiSaldo(voci(v.dai), voci(v.ricevi), v.euroDai, v.euroRicevi);
    const d = s.differenza;
    const testo = Math.abs(d) < 0.005 ? 'Pari: date e ricevete lo stesso valore'
        : (d > 0 ? `Ricevi ${formattaEuro(d)} in più di quello che dai` : `Dai ${formattaEuro(-d)} in più di quello che ricevi`);
    return `<div class="scb-saldo"><span class="scb-saldo-tit">Saldo</span><b>${testo}</b><small>Prezzi di quando è partita la proposta · gli euro si danno fuori dall'app.</small></div>`;
}

function _scambiAzioniHtml(v, n) {
    const id = escapeJsAttr(String(v.id));
    const b = (azione, icona, testo, cls) => `<button type="button" class="ric-btn ${cls || ''}" onclick="_scambiAzione('${azione}', '${id}')"><i class="fa-solid ${icona}"></i> ${testo}</button>`;
    let bottoni = '', spiega = '';
    if (v.stato === 'in_attesa' && !v.mittente) {
        bottoni = b('accetta', 'fa-check', 'Accetta', 'ric-btn-pieno') + b('cambia', 'fa-pen', 'Cambia') + b('rifiuta', 'fa-xmark', 'Rifiuta', 'ric-btn-rosso');
        spiega = `Accetti: gli oggetti restano riservati per voi. Cambia: mandi a ${n} una proposta diversa al posto di questa.`;
    } else if (v.stato === 'in_attesa') {
        bottoni = b('cambia', 'fa-pen', 'Cambia') + b('ritira', 'fa-rotate-left', 'Ritira', 'ric-btn-rosso');
        spiega = 'Cambia: la proposta nuova prende il posto di questa.';
    } else if (v.stato === 'accettata') {
        bottoni = (v.fattoIo ? '' : b('fatto', 'fa-flag-checkered', 'Fatto', 'ric-btn-pieno')) + b('annulla', 'fa-ban', 'Annulla lo scambio', 'ric-btn-rosso');
        spiega = v.fattoIo ? `Se lo scambio non si fa più, puoi annullarlo: gli oggetti tornano liberi.` : 'Premi Fatto quando vi siete scambiati gli oggetti: passano quando lo premete tutti e due.';
    } else if (v.stato === 'conclusa') {
        bottoni = b('rifai', 'fa-plus', `Nuova proposta a ${n}`);
    } else {
        bottoni = b('rifai', 'fa-rotate-right', 'Proponi di nuovo');
        spiega = 'Riapre la proposta con gli stessi oggetti, se sono ancora liberi.';
    }
    return `<div class="ric-fondo scb-azioni">${spiega ? `<span>${spiega}</span>` : ''}<div class="scb-bottoni">${bottoni}</div></div>`;
}

async function _scambiAzione(azione, id) {
    const v = _scambiVoci.find(x => String(x.id) === String(id));
    if (!v || v.kind !== 'proposta') return;
    const nome = _scambiNomeVoce(v);
    let esito = null;

    if (azione === 'cambia' || azione === 'rifai') {
        const nuova = v.stato === 'conclusa';
        const prendi = (righe) => righe
            .map(r => ({ tipo: r.carta_id ? 'carta' : 'sealed', oggettoId: r.carta_id || r.prodotto_sealed_id, quantita: Number(r.quantita_richiesta) || 1 }))
            .filter(x => x.oggettoId);
        apriPropostaScambio({
            altroId: v.altro, nomeAltro: nome,
            ricevi: nuova ? [] : prendi(v.ricevi), dai: nuova ? [] : prendi(v.dai),
            euroDai: nuova ? 0 : v.euroDai, euroRicevi: nuova ? 0 : v.euroRicevi,
            sostituisce: azione === 'cambia' ? v.id : null,
        });
        return;
    }
    if (azione === 'accetta') {
        if (!(await chiediConferma({ titolo: 'Accettare lo scambio?', testo: `Gli oggetti restano riservati per te e ${nome}. Passano quando premete Fatto tutti e due.`, conferma: 'Accetta' }))) return;
        esito = await rispondiProposta(v.id, true);
    } else if (azione === 'rifiuta') {
        if (!(await chiediConferma({ titolo: 'Rifiutare la proposta?', testo: `${nome} vedrà che l'hai rifiutata. Se vuoi cambiare qualcosa, usa Cambia.`, conferma: 'Rifiuta', pericolo: true }))) return;
        esito = await rispondiProposta(v.id, false);
    } else if (azione === 'ritira') {
        if (!(await chiediConferma({ titolo: 'Ritirare la proposta?', testo: `${nome} non potrà più accettarla.`, conferma: 'Ritira', pericolo: true }))) return;
        esito = await annullaProposta(v.id, null);
    } else if (azione === 'annulla') {
        const motivo = await _chiediMotivo('annulla', { titolo: 'Annullare lo scambio? Scegli un motivo', conferma: 'Annulla lo scambio' });
        if (!motivo) return;
        esito = await annullaProposta(v.id, motivo);
    } else if (azione === 'fatto') {
        const testo = v.fattoAltro
            ? `${nome} ha già premuto Fatto: gli oggetti passano adesso e quello che ricevi arriva nella Location "?". Non si torna indietro.`
            : `Quando lo preme anche ${nome}, gli oggetti passano e quello che ricevi arriva nella Location "?". Non si torna indietro.`;
        if (!(await chiediConferma({ titolo: 'Vi siete scambiati gli oggetti?', testo, conferma: 'Fatto' }))) return;
        esito = await segnaFattoProposta(v.id);
        if (esito && !esito.error) {
            if (esito.data === 'conclusa') {
                avvisoBreve('🎉 Scambio fatto! Quello che hai ricevuto è nella Location “?”.', { tipo: 'ok' });
                if (typeof caricaCarteReali === 'function') caricaCarteReali();
            } else {
                avvisoBreve(`👍 Fatto segnato: ora tocca a ${nome}.`, { tipo: 'ok' });
            }
        }
    } else {
        return;
    }
    if (esito && esito.error) mostraAvviso('❌ ' + esito.error.message);
    _scambiDaAprire = v.id;
    await apriPaginaRichieste(true);
}

function _richiesteDettaglioHtml(g, eRicevute) {
    const nome = _richiesteNomeGruppo(g);
    const nomeJs = escapeJsAttr(nome);
    const n = g.righe.length;
    const titolo = g.ospite
        ? `${escapeHtml(nome)} <span class="ric-chip-ospite">OSPITE</span>`
        : (eRicevute ? `Richiesta di ${escapeHtml(nome)}` : `La tua richiesta a ${escapeHtml(nome)}`);
    const sotto = `${_richiesteData(g.quando, true)} · ${n} oggett${n === 1 ? 'o' : 'i'}${eRicevute && !g.ospite ? ' dal tuo Scambio' : ''}${g.totale ? ` · ${formattaEuro(g.totale)}` : ''}${g.ospite ? ` · ${escapeHtml(g.ospite.codice_rq)}` : ''}${(!eRicevute && g.attesa) ? ` · aspetta che ${escapeHtml(nome)} accetti` : ''}`;
    let ospiteHtml = '';
    if (g.ospite) {
        const o = g.ospite;
        const c = _RICHIESTE_CONTATTI[o.ospite_contatto_tipo];
        let contatto;
        if (o.ospite_contatto_tipo === 'persona') {
            contatto = `<div class="ric-contatto"><span class="ric-contatto-ico"><i class="fa-solid fa-handshake"></i></span>
                <div class="ric-contatto-testo"><b>Di persona</b><span>Nessun contatto lasciato · quando vi vedete chiedigli il codice <b>${escapeHtml(o.codice_rq)}</b></span></div></div>`;
        } else if (c && o.ospite_contatto) {
            const link = _richiesteLinkContatto(o.ospite_contatto_tipo, o.ospite_contatto);
            contatto = `<div class="ric-contatto"><span class="ric-contatto-ico"><i class="${c.icona}"></i></span>
                <div class="ric-contatto-testo"><b>${c.etichetta} ${escapeHtml(o.ospite_contatto)}</b><span>ospite · rispondigli lì</span></div>
                <button type="button" class="ric-btn" onclick="_richiesteCopiaContatto('${escapeJsAttr(o.ospite_contatto)}')" title="Copia" aria-label="Copia il contatto"><i class="fa-regular fa-copy"></i></button>
                ${link ? `<a class="ric-btn ric-btn-pieno" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" title="Apri" aria-label="Apri ${c.etichetta}"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>` : ''}</div>`;
        } else {
            contatto = `<div class="ric-contatto"><span class="ric-contatto-ico"><i class="fa-solid fa-user-slash"></i></span>
                <div class="ric-contatto-testo"><b>Dati dell'ospite cancellati</b><span>La richiesta è chiusa: nome e contatto non si conservano.</span></div></div>`;
        }
        ospiteHtml = contatto + (o.ospite_messaggio ? `<div class="ric-messaggio">“${escapeHtml(o.ospite_messaggio)}”</div>` : '');
    }
    const comeFunziona = g.ospite ? `
        <div class="ric-come">Accetti <i class="fa-solid fa-arrow-right"></i> riservata · Concludi <i class="fa-solid fa-arrow-right"></i> la carta esce dalla tua collezione</div>` : eRicevute ? `
        <div class="ric-come"><b>Come funziona:</b>
            <span class="bx-stato bx-stato-attesa">In attesa</span> <i class="fa-solid fa-arrow-right"></i>
            <span class="bx-stato bx-stato-riservata">Riservata</span> <span>(accetti: nessun altro può chiederla)</span> <i class="fa-solid fa-arrow-right"></i>
            <span class="bx-stato bx-stato-conclusa">Conclusa</span> <span>(l'oggetto passa a ${escapeHtml(nome)} e gli arriva in “?”)</span></div>` : '';

    const righe = g.righe.map(r => {
        const snap = r.snapshot || {};
        const nomeOgg = escapeHtml(snap.nome || snap.codice || '(senza nome)');
        const stato = STATO_RIGA_LABEL[r.stato_riga] || { testo: r.stato_riga, cls: '' };
        const idAttr = escapeJsAttr(String(r.id));
        let azioni = '';
        if (eRicevute && r.stato_riga === 'in_attesa') {
            azioni = `<button type="button" class="ric-btn ric-btn-pieno" onclick="_azioneRichiesta('accetta', '${idAttr}')"><i class="fa-solid fa-check"></i> Accetta</button>
                      <button type="button" class="ric-btn" onclick="_azioneRichiesta('rifiuta', '${idAttr}')"><i class="fa-solid fa-xmark"></i> Rifiuta</button>`;
        } else if (eRicevute && r.stato_riga === 'accettata') {
            azioni = `<button type="button" class="ric-btn" onclick="_azioneRichiesta('concludi', '${idAttr}')"><i class="fa-solid fa-flag-checkered"></i> Concludi</button>
                      <button type="button" class="ric-btn ric-btn-rosso" onclick="_azioneRichiesta('sblocca', '${idAttr}')"><i class="fa-solid fa-lock-open"></i> Sblocca</button>`;
        } else if (!eRicevute && (r.stato_riga === 'in_attesa' || r.stato_riga === 'accettata')) {
            azioni = `<button type="button" class="ric-btn ric-btn-rosso" onclick="_azioneRichiesta('annulla', '${idAttr}')"><i class="fa-solid fa-ban"></i> Annulla</button>`;
        }
        const motivoTxt = r.motivo_chiusura ? ` · Motivo: ${escapeHtml(MOTIVI_ANNULLAMENTO[r.motivo_chiusura] || MOTIVI_SISTEMA[r.motivo_chiusura] || r.motivo_chiusura)}` : '';
        return `
            <div class="ric-oggetto">
                ${_scambiImmagineHtml(snap.immagine, !!r.prodotto_sealed_id)}
                <div class="ric-ogg-testo">
                    <div class="match-riga-nome">${nomeOgg}</div>
                    <div class="match-riga-prezzo">×${r.quantita_richiesta}${r.prezzo_congelato != null ? ` · ${formattaEuro(r.prezzo_congelato)} cad. · prezzo fissato al momento della richiesta` : ''}${motivoTxt}</div>
                </div>
                <span class="bx-stato ${stato.cls}">${stato.testo}</span>
                <div class="ric-azioni">${azioni}</div>
            </div>`;
    }).join('');

    const daConcludere = eRicevute ? g.righe.filter(r => r.stato_riga === 'accettata') : [];
    const daAccettare = eRicevute ? g.righe.filter(r => r.stato_riga === 'in_attesa') : [];
    const fondoAccetta = daAccettare.length >= 2 ? `
        <button type="button" class="ric-btn ric-btn-pieno ric-accetta-tutto" onclick="_richiesteAccettaTutto('${escapeJsAttr(String(g.id))}')"><i class="fa-solid fa-check-double"></i> Accetta tutto (${daAccettare.length})</button>` : '';
    const fondo = daConcludere.length >= 2 ? `
        <div class="ric-fondo">
            <span>${g.ospite ? 'Concludi quando lo scambio è avvenuto davvero: gli oggetti escono dalla tua collezione e non si torna indietro.' : `Concludi quando lo scambio è avvenuto davvero: gli oggetti passano a ${escapeHtml(nome)} e non si torna indietro.`}</span>
            <button type="button" class="ric-btn ric-btn-pieno" onclick="_richiesteConcludiTutto('${escapeJsAttr(String(g.id))}')"><i class="fa-solid fa-flag-checkered"></i> Concludi tutto (${daConcludere.length})</button>
        </div>` : '';
    const etichetta = `Richiesta del ${_scambiGiornoMese(g.quando)}`;
    const azioneTestata = g.ospite
        ? ((eRicevute && !g.chiusa) ? `<button type="button" class="match-icobtn ric-blocca" onclick="_richiesteBloccaOspite('${escapeJsAttr(String(g.id))}')" title="Blocca questo ospite" aria-label="Blocca questo ospite"><i class="fa-solid fa-ban"></i><span class="ric-scrivi-txt"> Blocca</span></button>` : '')
        : `<button type="button" class="match-icobtn match-scrivi" onclick="apriChatPerRichiesta('${escapeJsAttr(String(g.altro))}', '${nomeJs}', '${escapeJsAttr(String(g.id))}', '${escapeJsAttr(etichetta)}')" title="Scrivi a ${escapeHtml(nome)}" aria-label="Scrivi a ${escapeHtml(nome)}"><i class="fa-solid fa-comment"></i><span class="ric-scrivi-txt"> Scrivi a ${escapeHtml(nome)}</span></button>`;

    return `
        <div class="ric-card">
            <div class="match-persona-head ric-testata">
                <button type="button" class="pg-indietro ric-indietro" onclick="_richiesteIndietro()" aria-label="Tutti gli scambi" title="Tutti gli scambi"><i class="fa-solid fa-chevron-left"></i></button>
                ${_richiesteAvatarHtml(g, nome)}
                <div style="flex:1; min-width:0;">
                    <div class="match-persona-nome ric-titolo">${titolo}</div>
                    <div class="match-persona-sotto">${sotto}</div>
                </div>
                ${azioneTestata}
            </div>
            ${ospiteHtml}
            ${g.ospite ? '' : comeFunziona}
            <div class="ric-oggetti">${righe}</div>
            ${fondoAccetta}
            ${g.ospite ? comeFunziona : ''}
            ${fondo}
        </div>`;
}

async function _richiesteConcludiTutto(richiestaId) {
    const righe = _richiesteRicevute.filter(r => String(r.richiesta_id || r.id) === String(richiestaId) && r.stato_riga === 'accettata');
    if (!righe.length) return;
    const conOspite = !!_richiestaOspite(righe[0]);
    if (!(await chiediConferma({
        titolo: `Concludere ${righe.length} oggetti?`,
        testo: conOspite
            ? `Tutti e ${righe.length} gli oggetti riservati escono dalla tua collezione ora. Azione irreversibile.`
            : `Tutti e ${righe.length} gli oggetti riservati verranno trasferiti ora. Azione irreversibile.\nIl destinatario li troverà nella Location "?" e potrà spostarli dove vuole.`,
        conferma: 'Concludi', pericolo: true,
    }))) return;
    for (const r of righe) {
        const { error } = await concludiRigaRichiesta(r.id, '?');
        if (error) { mostraAvviso('❌ ' + error.message); break; }
    }
    _scambiDaAprire = richiestaId;
    await apriPaginaRichieste(true);
}

async function _richiesteAccettaTutto(richiestaId) {
    const righe = _richiesteRicevute.filter(r => String(r.richiesta_id || r.id) === String(richiestaId) && r.stato_riga === 'in_attesa');
    if (!righe.length) return;
    if (!(await chiediConferma({ titolo: `Accettare ${righe.length} oggetti?`, testo: 'Diventeranno riservati.', conferma: 'Accetta tutto' }))) return;
    for (const r of righe) {
        const { error } = await accettaRigaRichiesta(r.id);
        if (error) { mostraAvviso('❌ ' + error.message); break; }
    }
    _scambiDaAprire = richiestaId;
    await apriPaginaRichieste(true);
}

async function _richiesteBloccaOspite(richiestaId) {
    if (!(await chiediConferma({ titolo: 'Bloccare questo ospite?', testo: 'Non potrà più inviarti richieste da questo dispositivo e le sue richieste aperte verso di te verranno annullate.', conferma: 'Blocca', pericolo: true }))) return;
    const { error } = await bloccaOspite(richiestaId);
    if (error) { mostraAvviso('❌ ' + error.message); return; }
    _scambiDaAprire = richiestaId;
    await apriPaginaRichieste(true);
}

async function _richiesteCopiaContatto(testo) {
    try { await navigator.clipboard.writeText(testo); avvisoBreve('📋 Contatto copiato.', { tipo: 'ok' }); }
    catch (_) { await chiediTesto({ titolo: 'Copia il contatto', testo: 'Selezionalo e copialo:', valore: testo, conferma: 'Fatto', annulla: 'Chiudi' }); }
}

async function _azioneRichiesta(azione, rigaId) {
    let risultato;
    const riga = [..._richiesteRicevute, ..._richiesteInviate].find(x => String(x.id) === String(rigaId));

    if (azione === 'accetta') {
        if (!(await chiediConferma({ titolo: 'Accettare la richiesta?', testo: 'La carta/prodotto diventerà riservato.', conferma: 'Accetta' }))) return;
        risultato = await accettaRigaRichiesta(rigaId);

    } else if (azione === 'rifiuta') {
        if (!(await chiediConferma({ titolo: 'Rifiutare la richiesta?', conferma: 'Rifiuta', pericolo: true }))) return;
        risultato = await rifiutaRigaRichiesta(rigaId);

    } else if (azione === 'annulla' || azione === 'sblocca') {
        const motivo = await _chiediMotivo(azione);
        if (!motivo) return;
        risultato = azione === 'annulla' ? await annullaRigaRichiesta(rigaId, motivo) : await sbloccaRigaRichiesta(rigaId, motivo);

    } else if (azione === 'concludi') {
        const msgC = (riga && _richiestaOspite(riga))
            ? 'Con l\'ospite: l\'oggetto esce dalla tua collezione ora. Azione irreversibile.'
            : 'L\'oggetto verrà trasferito ora. Azione irreversibile.\nIl destinatario lo troverà nella Location "?" e potrà spostarlo dove vuole.';
        if (!(await chiediConferma({ titolo: 'Concludere lo scambio?', testo: msgC, conferma: 'Concludi', pericolo: true }))) return;
        risultato = await concludiRigaRichiesta(rigaId, '?');
    }

    if (risultato && risultato.error) {
        mostraAvviso('❌ ' + risultato.error.message);
        return;
    }

    if (riga) _scambiDaAprire = riga.richiesta_id || riga.id;
    await apriPaginaRichieste(true);
}

// testi: { titolo, conferma } per usarla anche con le proposte.
function _chiediMotivo(azione, testi) {
    testi = testi || {};
    return new Promise((risolvi) => {
        const titolo = testi.titolo || (azione === 'sblocca' ? 'Sbloccare la richiesta?' : 'Annullare la richiesta? Scegli un motivo');
        const chiavi = Object.keys(MOTIVI_ANNULLAMENTO).filter(k => azione === 'sblocca' || k !== 'intervento_amministrativo');
        const opzioni = chiavi.map(k => `
            <label class="ric-motivo"><input type="radio" name="ricMotivo" value="${k}"><span>${escapeHtml(MOTIVI_ANNULLAMENTO[k])}</span></label>`).join('');

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay prop-sopra';
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="modal-content richiedi-modal" style="text-align:left;">
                <div style="font-weight:800; font-size:1.05rem; margin-bottom:0.8rem; color:var(--text-dark);">${escapeHtml(titolo)}</div>
                <div class="ric-motivi">${opzioni}</div>
                <div class="richiedi-azioni" style="margin-top:1rem;">
                    <button type="button" class="btn-secondary" data-azione="annulla">Indietro</button>
                    <button type="button" class="btn-main" data-azione="conferma" disabled>${escapeHtml(testi.conferma || (azione === 'sblocca' ? 'Conferma' : 'Annulla richiesta'))}</button>
                </div>
            </div>`;

        const btnConferma = overlay.querySelector('[data-azione="conferma"]');
        const scelto = () => { const r = overlay.querySelector('input[name="ricMotivo"]:checked'); return r ? r.value : ''; };

        function chiudi(valore) {
            document.removeEventListener('keydown', suTasto);
            overlay.remove();
            risolvi(valore);
        }
        function suTasto(e) { if (e.key === 'Escape') chiudi(null); }

        overlay.querySelectorAll('input[name="ricMotivo"]').forEach(i => i.addEventListener('change', () => { btnConferma.disabled = !scelto(); }));
        btnConferma.addEventListener('click', () => { if (scelto()) chiudi(scelto()); });
        overlay.querySelector('[data-azione="annulla"]').addEventListener('click', () => chiudi(null));
        overlay.addEventListener('click', (e) => { if (e.target === overlay) chiudi(null); });
        document.addEventListener('keydown', suTasto);

        document.body.appendChild(overlay);
    });
}
