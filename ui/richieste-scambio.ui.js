// Pagina Richieste di scambio.

let _richiesteVista = 'ricevute';
let _richiesteRicevute = [];
let _richiesteInviate = [];
let _richiesteFiltro = 'tutte';
let _richiesteSel = null;
let _richiesteDettaglioTel = false;
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

async function apriPaginaRichieste(mantieni) {
    if (typeof _widgetRichiesteSvuotaCache === 'function') _widgetRichiesteSvuotaCache();
    const userId = await authGetUserId();
    if (!userId) return;

    try { const { error } = await scadiRichiesteOspite(); if (error) console.warn('scadiRichiesteOspite:', error.message); }
    catch (e) { console.warn('scadiRichiesteOspite:', e); }

    if (!mantieni) {
        _richiesteVista = 'ricevute';
        _richiesteFiltro = 'tutte';
        _richiesteSel = null;
        _richiesteDettaglioTel = false;
    }

    const [{ data: ricevute, error: errRic }, { data: inviate, error: errInv }] = await Promise.all([
        richiesteScambioRicevuteList(userId),
        richiesteScambioInviateList(userId),
    ]);
    if (errRic) console.error('apriPaginaRichieste (ricevute):', errRic.message);
    if (errInv) console.error('apriPaginaRichieste (inviate):', errInv.message);

    _richiesteRicevute = ricevute || [];
    _richiesteInviate = inviate || [];

    const ids = [...new Set([
        ..._richiesteRicevute.map(r => r.richiedente_id),
        ..._richiesteInviate.map(r => r.proprietario_id),
    ].filter(Boolean))];
    _richiesteNick = {};
    if (ids.length) {
        try {
            const { data, error } = await chatOttieniNicknames(ids);
            if (error) console.error('apriPaginaRichieste (nickname):', error.message);
            else (data || []).forEach(n => { if (n.nickname) _richiesteNick[n.owner_id] = n.nickname; });
        } catch (e) { console.error('apriPaginaRichieste (nickname):', e); }
    }

    renderPaginaRichieste();
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

function cambiaVistaRichieste(vista) {
    _richiesteVista = vista;
    _richiesteFiltro = 'tutte';
    _richiesteSel = null;
    _richiesteDettaglioTel = false;
    renderPaginaRichieste();
}
function _richiesteImpostaFiltro(f) { _richiesteFiltro = f; _richiesteSel = null; _richiesteDettaglioTel = false; renderPaginaRichieste(); }
function _richiesteApri(id) { _richiesteSel = id; _richiesteDettaglioTel = true; renderPaginaRichieste(); }
function _richiesteIndietro() { _richiesteDettaglioTel = false; renderPaginaRichieste(); }

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
        const conta = (st) => rr.filter(r => r.stato_riga === st).length;
        const attesa = conta('in_attesa'), riservate = conta('accettata');
        const totale = rr.reduce((t, r) => t + (Number(r.prezzo_congelato) || 0) * (Number(r.quantita_richiesta) || 1), 0);
        let chip;
        if (attesa) chip = { cls: 'bx-stato-attesa', testo: `${attesa} in attesa` };
        else if (riservate) chip = { cls: 'bx-stato-riservata', testo: riservate === 1 ? 'Riservata' : `${riservate} riservate` };
        else { const st = STATO_RIGA_LABEL[rr[0].stato_riga] || { testo: rr[0].stato_riga, cls: '' }; chip = { cls: st.cls, testo: st.testo }; }
        return { id, righe: rr, altro, ospite, quando, attesa, riservate, totale, chip, chiusa: !attesa && !riservate };
    }).sort((x, y) => new Date(y.quando) - new Date(x.quando));
}

function _richiesteFiltra(gruppi) {
    if (_richiesteFiltro === 'gestire') return gruppi.filter(g => g.attesa > 0);
    if (_richiesteFiltro === 'corso') return gruppi.filter(g => g.attesa === 0 && g.riservate > 0);
    if (_richiesteFiltro === 'chiuse') return gruppi.filter(g => g.chiusa);
    return gruppi;
}

function _richiesteData(iso, conOra) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const g = d.toLocaleDateString('it-IT', conOra ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'short' });
    return conOra ? `${g}, ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}` : g;
}

function renderPaginaRichieste() {
    const wrap = document.getElementById('richiesteContenuto');
    if (!wrap) return;

    const eRicevute = _richiesteVista === 'ricevute';
    const tutteRighe = eRicevute ? _richiesteRicevute : _richiesteInviate;
    const gruppiTutti = _richiesteRaggruppa(tutteRighe, eRicevute);

    const riep = document.getElementById('richiesteRiepilogo');
    if (riep) {
        const daGestire = gruppiTutti.filter(g => g.attesa > 0).length;
        const oggAttesa = gruppiTutti.reduce((t, g) => t + g.attesa, 0);
        const oggRis = gruppiTutti.reduce((t, g) => t + g.riservate, 0);
        if (eRicevute) {
            riep.innerHTML = daGestire
                ? `<b>${daGestire} richiest${daGestire === 1 ? 'a' : 'e'} da gestire</b> · ${oggAttesa} oggett${oggAttesa === 1 ? 'o' : 'i'} in attesa${oggRis ? `, ${oggRis} riservat${oggRis === 1 ? 'o' : 'i'}` : ''}`
                : (oggRis ? `Nessuna da gestire · ${oggRis} oggett${oggRis === 1 ? 'o' : 'i'} riservat${oggRis === 1 ? 'o' : 'i'}` : 'Nessuna richiesta da gestire');
        } else {
            riep.innerHTML = gruppiTutti.length
                ? `<b>${oggAttesa} oggett${oggAttesa === 1 ? 'o' : 'i'} in attesa</b>${oggRis ? ` · ${oggRis} riservat${oggRis === 1 ? 'o' : 'i'} in attesa di concludere` : ''}`
                : 'Nessuna richiesta inviata';
        }
    }

    const vistaTab = (id, testo, n) => `<button type="button" class="match-tabbtn ${_richiesteVista === id ? 'attivo' : ''}" onclick="cambiaVistaRichieste('${id}')">${testo} &middot; ${n}</button>`;
    const nRic = new Set(_richiesteRicevute.map(r => r.richiesta_id || r.id)).size;
    const nInv = new Set(_richiesteInviate.map(r => r.richiesta_id || r.id)).size;
    const tabsHtml = `<div class="match-tabs">${vistaTab('ricevute', 'Ricevute', nRic)}${vistaTab('inviate', 'Inviate', nInv)}</div>`;

    const cnt = { tutte: gruppiTutti.length, gestire: gruppiTutti.filter(g => g.attesa > 0).length, corso: gruppiTutti.filter(g => g.attesa === 0 && g.riservate > 0).length, chiuse: gruppiTutti.filter(g => g.chiusa).length };
    const filtri = [['tutte', 'Tutte'], ['gestire', eRicevute ? 'Da gestire' : 'In attesa'], ['corso', eRicevute ? 'In corso' : 'Riservate'], ['chiuse', 'Chiuse']];
    const filtriHtml = `<div class="ric-filtri">${filtri.map(([id, t]) => `<button type="button" class="ric-filtro ${_richiesteFiltro === id ? 'attivo' : ''}" onclick="_richiesteImpostaFiltro('${id}')">${t} &middot; ${cnt[id]}</button>`).join('')}</div>`;

    if (gruppiTutti.length === 0) {
        wrap.innerHTML = `<div class="ric-layout">${tabsHtml}<div class="stato-vuoto"><i class="fa-solid fa-handshake"></i><br>Nessuna richiesta ${eRicevute ? 'ricevuta' : 'inviata'} ancora.</div></div>`;
        return;
    }

    const gruppi = _richiesteFiltra(gruppiTutti);
    if (gruppi.length && !gruppi.some(g => g.id === _richiesteSel)) {
        _richiesteSel = gruppi[0].id;
        _richiesteDettaglioTel = false;
    }
    if (!gruppi.length) _richiesteSel = null;

    const elenco = gruppi.map(g => {
        const nome = _richiesteNomeGruppo(g);
        const n = g.righe.length;
        return `<div class="ric-riga ${g.id === _richiesteSel ? 'sel' : ''}" onclick="_richiesteApri('${escapeJsAttr(String(g.id))}')">
            ${_richiesteAvatarHtml(g, nome)}
            <div class="match-mtesto"><div class="match-persona-nome">${escapeHtml(nome)}${g.ospite ? ' <span class="ric-chip-ospite">OSPITE</span>' : ''}${(eRicevute && g.attesa) ? ' <span class="match-punto"></span>' : ''}</div>
                <div class="match-persona-sotto">${_richiesteData(g.quando)} · ${n} oggett${n === 1 ? 'o' : 'i'}${g.totale ? ` · ${formattaEuro(g.totale)}` : ''}</div></div>
            <span class="bx-stato ${g.chip.cls}">${g.chip.testo}</span><i class="fa-solid fa-chevron-right match-freccia"></i></div>`;
    }).join('') || '<p class="match-vuoto">Nessuna richiesta in questo gruppo.</p>';

    const nota = eRicevute ? 'Una richiesta = tutto quello che una persona ti ha chiesto in una volta.' : 'Quello che hai chiesto tu agli altri, dai Match.';
    const sel = gruppi.find(g => g.id === _richiesteSel);

    wrap.innerHTML = `
        <div class="ric-layout ${_richiesteDettaglioTel ? 'ric-tel-dettaglio' : ''}">
            <div class="ric-master">
                ${tabsHtml}${filtriHtml}
                <div class="ric-elenco">${elenco}</div>
                <div class="match-descr">${nota}</div>
            </div>
            <div class="ric-dettaglio">${sel ? _richiesteDettaglioHtml(sel, eRicevute) : ''}</div>
        </div>`;
    if (typeof fotoProfiloApplica === 'function') fotoProfiloApplica(wrap);
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
        const src = _urlImmagineVisualizzabile(snap.immagine, 96);
        const miniatura = src
            ? `<img class="match-img" src="${src}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'match-img match-img-vuota',innerHTML:'<i class=&quot;fa-solid fa-image&quot;></i>'}))">`
            : `<span class="match-img match-img-vuota"><i class="fa-solid ${r.prodotto_sealed_id ? 'fa-box' : 'fa-image'}"></i></span>`;
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
                ${miniatura}
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
    const azioneTestata = g.ospite
        ? ((eRicevute && !g.chiusa) ? `<button type="button" class="match-icobtn ric-blocca" onclick="_richiesteBloccaOspite('${escapeJsAttr(String(g.id))}')" title="Blocca questo ospite" aria-label="Blocca questo ospite"><i class="fa-solid fa-ban"></i><span class="ric-scrivi-txt"> Blocca</span></button>` : '')
        : `<button type="button" class="match-icobtn match-scrivi" onclick="apriChatPerRichiesta('${g.altro}', '${nomeJs}', '${escapeJsAttr(String(g.id))}')" title="Scrivi a ${escapeHtml(nome)}" aria-label="Scrivi a ${escapeHtml(nome)}"><i class="fa-solid fa-comment"></i><span class="ric-scrivi-txt"> Scrivi a ${escapeHtml(nome)}</span></button>`;

    return `
        <div class="ric-card">
            <div class="match-persona-head ric-testata">
                <button type="button" class="pg-indietro ric-indietro" onclick="_richiesteIndietro()" aria-label="Tutte le richieste" title="Tutte le richieste"><i class="fa-solid fa-chevron-left"></i></button>
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
    const righe = (_richiesteVista === 'ricevute' ? _richiesteRicevute : _richiesteInviate)
        .filter(r => String(r.richiesta_id || r.id) === String(richiestaId) && r.stato_riga === 'accettata');
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
    await apriPaginaRichieste(true);
}

async function _richiesteBloccaOspite(richiestaId) {
    if (!(await chiediConferma({ titolo: 'Bloccare questo ospite?', testo: 'Non potrà più inviarti richieste da questo dispositivo e le sue richieste aperte verso di te verranno annullate.', conferma: 'Blocca', pericolo: true }))) return;
    const { error } = await bloccaOspite(richiestaId);
    if (error) { mostraAvviso('❌ ' + error.message); return; }
    await apriPaginaRichieste(true);
}

async function _richiesteCopiaContatto(testo) {
    try { await navigator.clipboard.writeText(testo); avvisoBreve('📋 Contatto copiato.', { tipo: 'ok' }); }
    catch (_) { await chiediTesto({ titolo: 'Copia il contatto', testo: 'Selezionalo e copialo:', valore: testo, conferma: 'Fatto', annulla: 'Chiudi' }); }
}

async function _azioneRichiesta(azione, rigaId) {
    let risultato;

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
        const rigaC = _richiesteRicevute.find(x => String(x.id) === String(rigaId));
        const msgC = (rigaC && _richiestaOspite(rigaC))
            ? 'Con l\'ospite: l\'oggetto esce dalla tua collezione ora. Azione irreversibile.'
            : 'L\'oggetto verrà trasferito ora. Azione irreversibile.\nIl destinatario lo troverà nella Location "?" e potrà spostarlo dove vuole.';
        if (!(await chiediConferma({ titolo: 'Concludere lo scambio?', testo: msgC, conferma: 'Concludi', pericolo: true }))) return;
        risultato = await concludiRigaRichiesta(rigaId, '?');
    }

    if (risultato && risultato.error) {
        mostraAvviso('❌ ' + risultato.error.message);
        return;
    }

    await apriPaginaRichieste(true);
}

function _chiediMotivo(azione) {
    return new Promise((risolvi) => {
        const titolo = azione === 'sblocca' ? 'Sbloccare la richiesta?' : 'Annullare la richiesta? Scegli un motivo';
        const chiavi = Object.keys(MOTIVI_ANNULLAMENTO).filter(k => azione === 'sblocca' || k !== 'intervento_amministrativo');
        const opzioni = chiavi.map(k => `
            <label class="ric-motivo"><input type="radio" name="ricMotivo" value="${k}"><span>${escapeHtml(MOTIVI_ANNULLAMENTO[k])}</span></label>`).join('');

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="modal-content richiedi-modal" style="text-align:left;">
                <div style="font-weight:800; font-size:1.05rem; margin-bottom:0.8rem; color:var(--text-dark);">${titolo}</div>
                <div class="ric-motivi">${opzioni}</div>
                <div class="richiedi-azioni" style="margin-top:1rem;">
                    <button type="button" class="btn-secondary" data-azione="annulla">Indietro</button>
                    <button type="button" class="btn-main" data-azione="conferma" disabled>${azione === 'sblocca' ? 'Conferma' : 'Annulla richiesta'}</button>
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
