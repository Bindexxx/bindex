// ═══════════════════════════════════════════════════════════════════════
// WIDGET-SET.UI.JS — voce di catalogo + pagina "Set" (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// RISCRITTO (2026-09-20, restyle widget SET + masterset). Prima: elenco dei
// soli set di cui si possedeva una carta, ordinato per %, sola
// consultazione. Ora:
//   - TUTTE le espansioni esistenti, ordinate per carte mancanti
//     (crescente), divise in quattro schede: In corso (default) /
//     Completati / Non iniziati / Nascosti.
//   - Modalità "Modifica": si nascondono/mostrano i set. I nascosti
//     notificano solo al 99% e al 100%.
//   - Dettaglio di un set: tutte le carte del catalogo (una per variante),
//     quelle che mancano in scala di grigi + segnalino "Manca", quelle
//     possedute con "C'è". In modalità "Ignora carte" si escludono a mano
//     le carte che non si vogliono nel masterset (es. promo Pokémon Center).
//   - Pallina in home: set più vicino al completamento; quando scatta una
//     soglia (25/50/75/90/99/100%) mostra quella notifica finché non si
//     apre la pagina o ne arriva una più recente.
//
// DOVE STA LA LOGICA: calcolo, catalogo, soglie e notifiche sono in
// ui/set-motore.ui.js (nessun DOM). Qui solo voce di catalogo e pagina.
// Dati: data/sets.repository.js. Parser sigle: ui/set-libreria-sigle.ui.js.
//
// COSA RESTA FUORI (invariato):
// - apriDettaglioWidget (ui/paginainiziale-dettaglio.ui.js) chiama
//   renderPaginaSet() per tabId === 'set'.
// - _ballCORPI.set_completamento (ui/widget-render-corpi.ui.js): aggiornato
//   solo il corpo di questo widget, con gli stessi mattoni di sempre
//   (_ballRigaBarra/_ballPill). _ballASPETTO/_ballTITOLI_BREVI invariati.
// - Nessun collegamento con il widget Match.
// ───────────────────────────────────────────────────────────────────────

// ── VOCE DI CATALOGO ──────────────────────────────────────────────────
CATALOGO_WIDGET.set_completamento = {
    titolo: 'Set', icona: 'fa-layer-group',
    preview: () => {
        const r = setMCalcolaTutti();
        // Set con catalogo di cui servono le righe per contare bene: si
        // caricano in background e la Home si ridisegna SOLO se sono
        // davvero arrivate (altrimenti loop preview → ridisegno → preview).
        if (r.daCaricare.length) {
            setMCaricaRighe(r.daCaricare)
                .then(caricate => { if (caricate) setMRidisegnaHome(); })
                .catch(e => console.error('Set — caricamento righe:', e));
        }

        const g = setMSuddividi(r.voci);
        const prima = g.inCorso[0] || null;
        const nv = setMNotificaNonVista();

        let riga;
        if (nv) riga = `${nv.nome}: ${nv.soglia}%`;
        else if (prima) riga = `${prima.nome}: ${prima.mancanti} alla fine`;
        else riga = r.voci.length ? 'Nessun set in corso' : 'Libreria set vuota';

        return {
            righe: [riga],
            // Badge: '!' se c'è una notifica non vista, altrimenti le carte
            // che mancano al set in testa (prima era il primo numero pescato
            // dal testo, che con nomi tipo "151" dava il numero sbagliato).
            badge: nv ? '!' : (prima ? prima.mancanti : false),
            dati: {
                prima,
                top: g.inCorso.slice(0, 4),
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

// ── PAGINA "SET" ─────────────────────────────────────────────────────────
const _SET_SCHEDE = [
    { id: 'incorso',     etichetta: 'In corso',     chiave: 'inCorso',     vuoto: 'Nessun set in corso: aggiungi una carta di un set per iniziare.' },
    { id: 'completati',  etichetta: 'Completati',   chiave: 'completati',  vuoto: 'Nessun set completato, per ora.' },
    { id: 'noniniziati', etichetta: 'Non iniziati', chiave: 'nonIniziati', vuoto: 'Hai già almeno una carta di ogni set.' },
    { id: 'nascosti',    etichetta: 'Nascosti',     chiave: 'nascosti',    vuoto: 'Nessun set nascosto. Con "Modifica" puoi nascondere quelli che non ti interessano.' }
];

const _setUi = {
    tab: 'incorso',
    modifica: false,        // elenco: nascondi/mostra set
    dett: null,             // sigla del set aperto, null = elenco
    filtro: 'tutte',        // dettaglio: tutte | mancano | ce_l_ho
    modificaDett: false,    // dettaglio: ignora/riattiva carte
    classifica: false,      // schermata "carte X da classificare"
    msg: '',
    token: 0
};

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
    _setUi.dett = null;

    // Se c'è una notifica non vista, la pagina si apre direttamente sul set
    // giusto (vale sia dal clic sulla notifica in tendina sia dalla pallina).
    let nv = null;
    try { nv = setMNotificaNonVista(); } catch (_) { nv = null; }
    if (nv) _setUi.dett = nv.sigla;

    await _setUiRender();

    // Aperta la pagina = vista. La pallina si aggiorna alla chiusura (la
    // Home si ridisegna da sola).
    if (nv) await setMSegnaViste();

    // Stato non ancora letto (pagina aperta appena dopo l'avvio): un
    // tentativo e ridisegno.
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
        if (_setUi.dett) await _setUiRenderDettaglio(container);
        else if (_setUi.classifica) _setUiRenderClassifica(container);
        else _setUiRenderLista(container);
    } catch (e) {
        console.error('renderPaginaSet:', e);
        _setUiErrore(container, 'Errore nel caricamento.');
    }
}

// ── ELENCO ───────────────────────────────────────────────────────────────
function _setUiRigaHtml(v) {
    const perc = v.completo ? 100 : Math.floor(v.perc);
    const sub = (v.completo ? 'Completo' : `${v.mancanti} ${v.mancanti === 1 ? 'mancante' : 'mancanti'}`)
        + ' · ' + (v.catalogo ? 'masterset' : 'set base');
    const occhio = _setUi.modifica
        ? `<i class="fa-solid ${v.nascosto ? 'fa-eye' : 'fa-eye-slash'} set-riga-occhio" title="${v.nascosto ? 'Mostra' : 'Nascondi'}"></i>`
        : '';
    return `<div class="pg-riga-set set-riga${v.nascosto ? ' nascosto' : ''}" data-sigla="${_setUiAttr(v.sigla)}" onclick="_setUiClickRiga(this.dataset.sigla)">
        <div class="pg-riga-set-testa"><b>${_setUiAttr(v.nome)}</b><span>${v.hai}/${v.totale} · ${perc}%${occhio}</span></div>
        <div class="pg-barra-track"><div class="pg-barra-fill" style="width:${perc}%"></div></div>
        <div class="set-riga-sub">${sub}</div>
    </div>`;
}

function _setUiRenderLista(container) {
    const r = setMCalcolaTutti();
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
    const riepilogo = `${visibili} espansioni · ${g.completati.length} completate`;

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

    container.innerHTML = `
        <div class="page-header">
            <span class="page-title">Set</span>
            <span class="page-azione${_setUi.modifica ? ' attiva' : ''}" onclick="_setUiToggleModifica()">${_setUi.modifica ? 'Fine' : 'Modifica'}</span>
        </div>
        <div class="pg-pagina">
            <div class="pg-sotto">${riepilogo}</div>
            ${avvisoStato}${avvisoClass}${avvisoSconosciute}${notaModifica}
            <div class="pg-filtri">${schede}</div>
            <div class="set-msg">${_setUiAttr(_setUi.msg)}</div>
            <div class="pg-elenco">${elenco.length
                ? elenco.map(_setUiRigaHtml).join('')
                : `<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1.5rem 0;">${_setUiAttr(scheda.vuoto)}</p>`}</div>
        </div>`;
}

function _setUiImpostaScheda(id) {
    _setUi.tab = id;
    _setUi.msg = '';
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

// ── DETTAGLIO DI UN SET ──────────────────────────────────────────────────
function _setUiApriDettaglio(sigla) {
    _setUi.dett = sigla;
    _setUi.filtro = 'tutte';
    _setUi.modificaDett = false;
    _setUi.msg = '';
    _setUiRender();
    const cont = document.querySelector('.container');
    if (cont && typeof cont.scrollTo === 'function') cont.scrollTo(0, 0);
}

function _setUiChiudiDettaglio() {
    _setUi.dett = null;
    _setUi.modificaDett = false;
    _setUi.msg = '';
    _setUiRender();
}

function _setUiImpostaFiltro(f) {
    _setUi.filtro = f;
    _setUiRender();
}

function _setUiToggleModificaDett() {
    _setUi.modificaDett = !_setUi.modificaDett;
    _setUi.msg = '';
    _setUiRender();
}

async function _setUiRenderDettaglio(container) {
    const sigla = _setUi.dett;
    const token = ++_setUi.token;
    const lib = (typeof _ballLIBRERIA_SET !== 'undefined' && _ballLIBRERIA_SET) ? _ballLIBRERIA_SET : {};
    const nome = (lib[sigla] && lib[sigla].nome) || sigla;

    const intestazione = (azione) => `
        <div class="page-header">
            <span class="page-azione attiva" onclick="_setUiChiudiDettaglio()"><i class="fa-solid fa-chevron-left"></i> Set</span>
            <span class="page-title">${_setUiAttr(nome)}</span>
            ${azione || ''}
        </div>`;

    let dati = setMVociSet(sigla);
    if (!dati) {
        container.innerHTML = intestazione('') +
            '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:2rem 0;">Caricamento…</p>';
        await setMCaricaRighe([sigla]);
        if (token !== _setUi.token || _setUi.dett !== sigla) return;   // nel frattempo l'utente ha cambiato schermata
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
        <div class="pg-pagina${_setUi.modificaDett ? ' set-modifica' : ''}">
            <div class="pg-intro">
                <div class="pg-grande">${percTesto}%</div>
                <div class="pg-sotto">${hai}/${totale} · ${mancanti === 0 && totale > 0 ? 'completo' : mancanti + ' mancanti'} · ${dati.catalogo ? 'masterset' : 'set base (catalogo per carta da caricare)'}</div>
            </div>
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
    // Ignorare/riattivare una carta cambia la percentuale: rivaluta le soglie.
    setMotoreAggiorna({ render: false });
}


// ── CLASSIFICAZIONE DELLE CARTE X ────────────────────────────────────────
// Le carte X (reverse a motivo) non dicono da sole QUALE motivo hanno. Qui
// si assegna la variante (colonna carte.variante): il sito propone quella
// ricavata dal link Cardmarket (regola in setMDaClassificare) e si conferma
// tutto insieme, oppure si sceglie a mano riga per riga. Ogni scelta vale
// subito nel masterset e si può correggere in seguito da qui.
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
    // Le righe del catalogo servono per proporre: se mancano (pagina aperta
    // subito dopo l'avvio) si caricano e si ridisegna.
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
            <span class="page-azione attiva" onclick="_setUiChiudiClassifica()"><i class="fa-solid fa-chevron-left"></i> Set</span>
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

// Salva le varianti raggruppate per valore: una chiamata per variante, non
// una per carta. Optimistic: se un gruppo fallisce si annulla SOLO quello.
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
    // Il masterset è cambiato: rivaluta le soglie.
    setMotoreAggiorna({ render: false });
}
