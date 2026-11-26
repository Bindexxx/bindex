// Proposta di scambio: la finestra per comporla o cambiarla. Lato "suo" = cose dello Scambio
// dell'altra persona che ricevi, lato "mio" = cose del tuo Scambio che dai; gli euro li mette una
// parte sola; saldo e "Pareggia" si aggiornano mentre scegli. Si apre da Match, chat e Scambi.

let _propostaStato = null;
const _PROPOSTA_PRIMA_PAGINA = 40;
const _PROPOSTA_MAX_PER_PARTE = 40;

// opzioni: { altroId, nomeAltro, ricevi: [{ tipo, oggettoId, quantita }], dai: [...],
//            euroDai, euroRicevi, sostituisce (id della proposta da cambiare), dopoInvio(id) }
async function apriPropostaScambio(opzioni) {
    const o = opzioni || {};
    if (!o.altroId) return;
    const io = await authGetUserId();
    if (!io || String(o.altroId) === String(io)) return;
    _propostaChiudi();
    const st = {
        io, altroId: o.altroId, nomeAltro: o.nomeAltro || 'Un utente del gruppo',
        sostituisce: o.sostituisce || null, dopoInvio: typeof o.dopoInvio === 'function' ? o.dopoInvio : null,
        voci: { suo: [], mio: [] }, scelte: { suo: new Map(), mio: new Map() },
        euroDai: _propostaEuroValido(o.euroDai), euroRicevi: _propostaEuroValido(o.euroRicevi),
        filtro: { suo: '', mio: '' }, mostra: { suo: _PROPOSTA_PRIMA_PAGINA, mio: _PROPOSTA_PRIMA_PAGINA },
        lato: 'suo', caricamento: true, errore: '', invio: false, mancanti: 0,
        iniziali: { suo: o.ricevi || [], mio: o.dai || [] },
    };
    if (st.euroDai && st.euroRicevi) st.euroRicevi = 0;
    _propostaStato = st;
    _propostaCreaFinestra();
    _propostaRender();

    let esito;
    try { esito = await leggiScambioPerProposta(o.altroId); }
    catch (e) { esito = { data: null, error: e }; }
    if (_propostaStato !== st) return;
    st.caricamento = false;
    if (esito.error) {
        st.errore = 'Non riesco a leggere gli Scambi: ' + (esito.error.message || esito.error);
        _propostaRender();
        return;
    }
    (esito.data || []).forEach(r => {
        const v = {
            chiave: r.tipo + ':' + r.oggetto_id, tipo: r.tipo, oggettoId: r.oggetto_id,
            nome: r.nome || r.codice || '(senza nome)', codice: r.codice, lingua: r.lingua,
            condizione: r.condizione || r.integrita, variante: r.variante, immagine: r.immagine,
            prezzo: r.prezzo == null ? null : Number(r.prezzo), disponibili: Math.max(0, Number(r.disponibili) || 0),
        };
        if (String(r.owner_id) === String(st.io)) st.voci.mio.push(v);
        else if (String(r.owner_id) === String(st.altroId)) st.voci.suo.push(v);
    });
    ['suo', 'mio'].forEach(lato => {
        st.voci[lato].sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
        (st.iniziali[lato] || []).forEach(x => {
            const v = st.voci[lato].find(y => y.chiave === (x.tipo || 'carta') + ':' + x.oggettoId);
            if (!v || v.disponibili < 1) { st.mancanti++; return; }
            if (st.scelte[lato].has(v.chiave) || st.scelte[lato].size >= _PROPOSTA_MAX_PER_PARTE) return;
            st.scelte[lato].set(v.chiave, Math.min(Math.max(1, Math.floor(Number(x.quantita) || 1)), v.disponibili));
        });
    });
    if (!st.scelte.suo.size && st.scelte.mio.size) st.lato = 'mio';
    _propostaRender();
}

function _propostaEuroValido(x) {
    let s = String(x == null ? '' : x).replace(/\s/g, '');
    if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '');
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}
function _propostaEuroTesto(n) { return n > 0 ? n.toFixed(2).replace('.', ',') : ''; }
function _propostaNormalizza(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

function _propostaCreaFinestra() {
    const fondo = document.createElement('div');
    fondo.id = 'propostaScambio';
    fondo.className = 'modal-overlay prop-overlay';
    fondo.style.display = 'flex';
    fondo.innerHTML = '<div class="modal-content prop-modal" role="dialog" aria-modal="true" aria-labelledby="propTitolo" onclick="event.stopPropagation()"></div>';
    fondo.addEventListener('click', (e) => { if (e.target === fondo) _propostaChiudi(); });
    document.addEventListener('keydown', _propostaTasti);
    document.body.appendChild(fondo);
}
function _propostaTasti(e) {
    if (e.key === 'Escape' && _propostaStato && !document.querySelector('.avviso-fondo')) { e.preventDefault(); _propostaChiudi(); }
}
function _propostaChiudi() {
    const f = document.getElementById('propostaScambio');
    if (f) f.remove();
    document.removeEventListener('keydown', _propostaTasti);
    _propostaStato = null;
}

function _propostaVociScelte(lato) {
    const st = _propostaStato;
    return [...st.scelte[lato]].map(([k, q]) => {
        const v = st.voci[lato].find(x => x.chiave === k);
        return { prezzo: v ? v.prezzo : 0, quantita: q };
    });
}
function _propostaPezzi(lato) {
    const st = _propostaStato;
    const n = [...st.scelte[lato].values()].reduce((t, q) => t + q, 0);
    const euro = lato === 'suo' ? st.euroRicevi : st.euroDai;
    return `${n}${euro > 0 ? ' + €' : ''}`;
}
function _propostaTotale(lato) {
    const st = _propostaStato;
    return scambiValoreVoci(_propostaVociScelte(lato)) / 100 + (lato === 'suo' ? st.euroRicevi : st.euroDai);
}

function _propostaRender() {
    const st = _propostaStato;
    const box = document.querySelector('#propostaScambio .prop-modal');
    if (!st || !box) return;
    const scroll = { box: box.scrollTop };
    box.querySelectorAll('.prop-elenco').forEach(el => { scroll[el.dataset.lato] = el.scrollTop; });
    const nome = escapeHtml(st.nomeAltro);
    const testoInvia = st.sostituisce ? 'Manda la proposta nuova' : 'Invia proposta';
    box.innerHTML = `
        <div class="prop-testa">
            <div class="match-avatar prop-avatar" data-avatar-utente="${escapeHtml(String(st.altroId))}">${escapeHtml(st.nomeAltro.charAt(0).toUpperCase())}</div>
            <div class="prop-testa-testo">
                <h3 id="propTitolo">${st.sostituisce ? 'Cambia la proposta a' : 'Proposta a'} ${nome}</h3>
                <div class="prop-sotto">Scegli cosa ricevi e cosa dai: carte, sealed, euro.</div>
            </div>
            <button type="button" class="close-modal-btn prop-chiudi" onclick="_propostaChiudi()" aria-label="Chiudi"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="prop-schede" role="tablist">
            <button type="button" role="tab" aria-selected="${st.lato === 'suo'}" class="${st.lato === 'suo' ? 'attivo' : ''}" onclick="_propostaLato('suo')">Ricevi · <span id="propConta_suo">${_propostaPezzi('suo')}</span></button>
            <button type="button" role="tab" aria-selected="${st.lato === 'mio'}" class="${st.lato === 'mio' ? 'attivo' : ''}" onclick="_propostaLato('mio')">Tu dai · <span id="propConta_mio">${_propostaPezzi('mio')}</span></button>
        </div>
        ${st.mancanti ? `<div class="prop-avviso"><i class="fa-solid fa-circle-info"></i> ${st.mancanti === 1 ? '1 oggetto non è più libero nello Scambio: l\'ho tolto.' : `${st.mancanti} oggetti non sono più liberi nello Scambio: li ho tolti.`}</div>` : ''}
        <div class="prop-colonne">${_propostaLatoHtml('suo')}${_propostaLatoHtml('mio')}</div>
        <div class="prop-fondo">
            <div class="prop-saldo" id="propSaldo">${_propostaSaldoHtml()}</div>
            <div class="prop-errore" id="propErrore" role="alert"${st.errore ? '' : ' hidden'}>${escapeHtml(st.errore)}</div>
            <p class="prop-nota">Gli euro si danno fuori dall'app. Gli oggetti passano solo quando premete Fatto tutti e due. Se ${nome} non risponde entro 14 giorni, la proposta scade.</p>
            <div class="prop-azioni">
                <button type="button" class="btn-secondary" onclick="_propostaChiudi()">Annulla</button>
                <button type="button" class="btn-main" id="propInvia" onclick="_propostaInvia()"${st.caricamento || st.invio ? ' disabled' : ''}>${st.invio ? '<i class="fa-solid fa-spinner fa-spin"></i> Invio…' : `<i class="fa-solid fa-paper-plane"></i> ${testoInvia}`}</button>
            </div>
        </div>`;
    box.querySelectorAll('.prop-elenco').forEach(el => { if (scroll[el.dataset.lato]) el.scrollTop = scroll[el.dataset.lato]; });
    box.scrollTop = scroll.box;
    if (typeof fotoProfiloApplica === 'function') fotoProfiloApplica(box);
}

function _propostaLatoHtml(lato) {
    const st = _propostaStato;
    const nome = escapeHtml(st.nomeAltro);
    const suo = lato === 'suo';
    const euro = suo ? st.euroRicevi : st.euroDai;
    let corpo;
    if (st.caricamento) corpo = '<p class="prop-vuoto"><i class="fa-solid fa-spinner fa-spin"></i> Leggo lo Scambio…</p>';
    else if (!st.voci[lato].length) {
        corpo = `<p class="prop-vuoto">${suo
            ? `${nome} non ha niente di libero nello Scambio, o non lo mostra. Puoi comunque proporgli cose tue in cambio di euro.`
            : 'Non hai niente di libero nel tuo Scambio: puoi offrire euro.'}</p>`;
    } else {
        corpo = `<div class="prop-scelti" id="propScelti_${lato}">${_propostaSceltiHtml(lato)}</div>
            <input type="search" class="prop-cerca" placeholder="${suo ? 'Cerca nel suo Scambio' : 'Cerca nel tuo Scambio'}" value="${escapeHtml(st.filtro[lato])}" oninput="_propostaFiltra('${lato}', this.value)" aria-label="${suo ? 'Cerca nel suo Scambio' : 'Cerca nel tuo Scambio'}">
            <div class="prop-elenco" data-lato="${lato}" id="propElenco_${lato}">${_propostaElencoHtml(lato)}</div>`;
    }
    return `<section class="prop-lato ${st.lato === lato ? 'attivo' : ''}" data-lato="${lato}">
        <div class="prop-lato-testa"><b>${suo ? `Ricevi da ${nome}` : 'Tu dai'}</b><span id="propTot_${lato}">${formattaEuro(_propostaTotale(lato))}</span></div>
        ${corpo}
        <label class="prop-euro"><span>${suo ? 'E ricevi in euro' : 'E dai in euro'}</span>
            <input type="text" inputmode="decimal" autocomplete="off" id="propEuro_${lato}" value="${_propostaEuroTesto(euro)}" placeholder="0,00" oninput="_propostaEuro('${lato}', this.value)" aria-label="${suo ? 'Euro che ricevi' : 'Euro che dai'}"><span>€</span></label>
    </section>`;
}

function _propostaSceltiHtml(lato) {
    const st = _propostaStato;
    const chip = [...st.scelte[lato]].map(([k, q]) => {
        const v = st.voci[lato].find(x => x.chiave === k);
        if (!v) return '';
        return `<span class="prop-chip">${escapeHtml(v.nome)}${q > 1 ? ` ×${q}` : ''}<button type="button" onclick="_propostaScegli('${lato}', '${escapeJsAttr(k)}')" aria-label="Togli ${escapeHtml(v.nome)}" title="Togli"><i class="fa-solid fa-xmark"></i></button></span>`;
    }).join('');
    return chip;
}

function _propostaElencoHtml(lato) {
    const st = _propostaStato;
    const f = _propostaNormalizza(st.filtro[lato]).trim();
    const voci = f ? st.voci[lato].filter(v => _propostaNormalizza(`${v.nome} ${v.codice || ''}`).includes(f)) : st.voci[lato];
    if (!voci.length) return '<p class="prop-vuoto">Nessun oggetto con questo nome.</p>';
    const mostrate = voci.slice(0, st.mostra[lato]);
    const resto = voci.length - mostrate.length;
    return mostrate.map(v => _propostaVoceHtml(lato, v)).join('')
        + (resto > 0 ? `<button type="button" class="prop-altri" onclick="_propostaAltri('${lato}')">Mostra altri ${Math.min(resto, _PROPOSTA_PRIMA_PAGINA)} (ne restano ${resto})</button>` : '');
}

function _propostaVoceHtml(lato, v) {
    const st = _propostaStato;
    const q = st.scelte[lato].get(v.chiave) || 0;
    const sel = q > 0;
    const k = escapeJsAttr(v.chiave);
    const meta = [v.codice, v.lingua, v.condizione, v.variante && v.variante !== 'normale' ? v.variante : null].filter(Boolean).map(escapeHtml);
    if (v.disponibili > 1) meta.push(`${v.disponibili} copie libere`);
    const src = _urlImmagineVisualizzabile(v.immagine, 96);
    const img = src
        ? `<img class="prop-img" src="${src}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'prop-img prop-img-vuota',innerHTML:'<i class=&quot;fa-solid fa-image&quot;></i>'}))">`
        : `<span class="prop-img prop-img-vuota"><i class="fa-solid ${v.tipo === 'sealed' ? 'fa-box' : 'fa-image'}"></i></span>`;
    const quantita = (sel && v.disponibili > 1) ? `<div class="richiedi-qty prop-qty" onclick="event.stopPropagation()" onkeydown="event.stopPropagation()">
            <button type="button"${q <= 1 ? ' disabled' : ''} onclick="_propostaQuantita('${lato}', '${k}', -1)" aria-label="Una copia in meno">−</button><span>${q}</span>
            <button type="button"${q >= v.disponibili ? ' disabled' : ''} onclick="_propostaQuantita('${lato}', '${k}', 1)" aria-label="Una copia in più">+</button></div>` : '';
    return `<div class="prop-voce${sel ? ' sel' : ''}" role="checkbox" aria-checked="${sel}" tabindex="0" data-chiave="${escapeHtml(v.chiave)}" onclick="_propostaScegli('${lato}', '${k}')" onkeydown="_propostaTastoVoce(event, '${lato}', '${k}')">
        <span class="prop-spunta"><i class="fa-solid fa-check"></i></span>${img}
        <div class="prop-voce-testo"><div class="prop-voce-nome">${escapeHtml(v.nome)}</div>${meta.length ? `<div class="prop-voce-meta">${meta.join(' · ')}</div>` : ''}</div>
        <div class="prop-voce-prezzo">${v.prezzo != null ? formattaEuro(v.prezzo) : '—'}</div>
        ${quantita}
    </div>`;
}

function _propostaSaldoHtml() {
    const st = _propostaStato;
    if (!st) return '';
    const s = scambiSaldo(_propostaVociScelte('mio'), _propostaVociScelte('suo'), st.euroDai, st.euroRicevi);
    const d = s.differenza;
    const pari = Math.abs(d) < 0.005;
    const testo = pari ? 'Pari' : (d > 0 ? `Ricevi ${formattaEuro(d)} in più` : `Dai ${formattaEuro(-d)} in più`);
    const oggetti = st.scelte.suo.size + st.scelte.mio.size;
    if (!oggetti && !st.euroDai && !st.euroRicevi) return '<div class="prop-saldo-esito prop-saldo-vuoto">Scegli cosa ricevi e cosa dai</div>';
    const pareggia = (oggetti && !pari)
        ? `<button type="button" class="ric-btn prop-pareggia" onclick="_propostaPareggia()" title="Mette gli euro che mancano dalla parte di chi riceve meno"><i class="fa-solid fa-scale-balanced"></i> Pareggia con gli euro</button>` : '';
    return `<div class="prop-saldo-righe"><span>Ricevi <b>${formattaEuro(s.ricevi)}</b></span><span>Dai <b>${formattaEuro(s.dai)}</b></span></div>
        <div class="prop-saldo-esito${pari ? ' pari' : ''}">${testo}</div>${pareggia}`;
}

// Solo saldo, totali e contatori: i campi restano dove sono, col cursore dentro.
function _propostaAggiornaConti() {
    const st = _propostaStato;
    if (!st) return;
    const saldo = document.getElementById('propSaldo');
    if (saldo) saldo.innerHTML = _propostaSaldoHtml();
    ['suo', 'mio'].forEach(lato => {
        const t = document.getElementById('propTot_' + lato);
        if (t) t.textContent = formattaEuro(_propostaTotale(lato));
        const c = document.getElementById('propConta_' + lato);
        if (c) c.textContent = _propostaPezzi(lato);
    });
}

function _propostaRenderLato(lato) {
    const el = document.getElementById('propElenco_' + lato);
    if (el) {
        const attivo = document.activeElement;
        const chiaveAttiva = (attivo && attivo.classList && attivo.classList.contains('prop-voce') && el.contains(attivo)) ? attivo.dataset.chiave : null;
        const s = el.scrollTop;
        el.innerHTML = _propostaElencoHtml(lato);
        el.scrollTop = s;
        if (chiaveAttiva) {
            const di = [...el.querySelectorAll('.prop-voce')].find(x => x.dataset.chiave === chiaveAttiva);
            if (di) di.focus({ preventScroll: true });
        }
    }
    const ch = document.getElementById('propScelti_' + lato);
    if (ch) ch.innerHTML = _propostaSceltiHtml(lato);
}

function _propostaErrore(testo) {
    const st = _propostaStato;
    if (st) st.errore = testo || '';
    const el = document.getElementById('propErrore');
    if (el) { el.textContent = testo || ''; el.hidden = !testo; }
}

function _propostaScegli(lato, chiave) {
    const st = _propostaStato;
    if (!st) return;
    const v = st.voci[lato].find(x => x.chiave === chiave);
    if (!v) return;
    if (st.scelte[lato].has(chiave)) st.scelte[lato].delete(chiave);
    else {
        if (st.scelte[lato].size >= _PROPOSTA_MAX_PER_PARTE) { _propostaErrore(`Al massimo ${_PROPOSTA_MAX_PER_PARTE} oggetti per parte.`); return; }
        st.scelte[lato].set(chiave, 1);
    }
    _propostaErrore('');
    _propostaRenderLato(lato);
    _propostaAggiornaConti();
}

function _propostaTastoVoce(e, lato, chiave) {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); _propostaScegli(lato, chiave); }
}

function _propostaQuantita(lato, chiave, delta) {
    const st = _propostaStato;
    if (!st) return;
    const v = st.voci[lato].find(x => x.chiave === chiave);
    const q = st.scelte[lato].get(chiave);
    if (!v || !q) return;
    st.scelte[lato].set(chiave, Math.min(v.disponibili, Math.max(1, q + delta)));
    _propostaRenderLato(lato);
    _propostaAggiornaConti();
}

function _propostaLato(lato) {
    const st = _propostaStato;
    if (!st || st.lato === lato) return;
    st.lato = lato;
    document.querySelectorAll('#propostaScambio .prop-lato').forEach(s => s.classList.toggle('attivo', s.dataset.lato === lato));
    document.querySelectorAll('#propostaScambio .prop-schede button').forEach((b, i) => {
        const attivo = (i === 0 ? 'suo' : 'mio') === lato;
        b.classList.toggle('attivo', attivo);
        b.setAttribute('aria-selected', String(attivo));
    });
}

function _propostaFiltra(lato, testo) {
    const st = _propostaStato;
    if (!st) return;
    st.filtro[lato] = testo;
    st.mostra[lato] = _PROPOSTA_PRIMA_PAGINA;
    const el = document.getElementById('propElenco_' + lato);
    if (el) { el.innerHTML = _propostaElencoHtml(lato); el.scrollTop = 0; }
}

function _propostaAltri(lato) {
    const st = _propostaStato;
    if (!st) return;
    st.mostra[lato] += _PROPOSTA_PRIMA_PAGINA;
    _propostaRenderLato(lato);
}

function _propostaEuro(lato, testo) {
    const st = _propostaStato;
    if (!st) return;
    const n = _propostaEuroValido(testo);
    const altro = lato === 'suo' ? 'mio' : 'suo';
    if (lato === 'suo') st.euroRicevi = n; else st.euroDai = n;
    if (n > 0 && (altro === 'suo' ? st.euroRicevi : st.euroDai) > 0) {
        if (altro === 'suo') st.euroRicevi = 0; else st.euroDai = 0;
        const campo = document.getElementById('propEuro_' + altro);
        if (campo) campo.value = '';
        avvisoBreve('Gli euro li mette una parte sola: ho tolto quelli dall\'altra parte.');
    }
    if (/[^0-9.,\s]/.test(testo)) _propostaErrore('Scrivi gli euro così: 2,50');
    else if (n > 10000) _propostaErrore('Al massimo 10.000 € per proposta.');
    else _propostaErrore('');
    _propostaAggiornaConti();
}

function _propostaPareggia() {
    const st = _propostaStato;
    if (!st) return;
    const p = scambiPareggio(_propostaVociScelte('mio'), _propostaVociScelte('suo'));
    st.euroDai = p.euroDai;
    st.euroRicevi = p.euroRicevi;
    const mio = document.getElementById('propEuro_mio');
    if (mio) mio.value = _propostaEuroTesto(st.euroDai);
    const suo = document.getElementById('propEuro_suo');
    if (suo) suo.value = _propostaEuroTesto(st.euroRicevi);
    _propostaErrore('');
    _propostaAggiornaConti();
}

async function _propostaInvia() {
    const st = _propostaStato;
    if (!st || st.invio || st.caricamento) return;
    const comeRighe = (lato) => [...st.scelte[lato]].map(([k, q]) => {
        const i = k.indexOf(':');
        return { tipo: k.slice(0, i), oggetto_id: k.slice(i + 1), quantita: q };
    });
    const ricevo = comeRighe('suo'), dai = comeRighe('mio');
    if (!ricevo.length && !dai.length) { _propostaErrore(`Scegli almeno un oggetto, tuo o di ${st.nomeAltro}.`); return; }
    const scritti = ['mio', 'suo'].map(l => (document.getElementById('propEuro_' + l) || {}).value || '').join('');
    if (/[^0-9.,\s]/.test(scritti)) { _propostaErrore('Scrivi gli euro così: 2,50'); return; }
    if (st.euroDai > 10000 || st.euroRicevi > 10000) { _propostaErrore('Al massimo 10.000 € per proposta.'); return; }

    st.invio = true;
    const btn = document.getElementById('propInvia');
    const testoInvia = st.sostituisce ? 'Manda la proposta nuova' : 'Invia proposta';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Invio…'; }
    let esito;
    try { esito = await proponiScambio(st.altroId, ricevo, dai, st.euroDai, st.euroRicevi, st.sostituisce); }
    catch (e) { esito = { data: null, error: e }; }
    if (_propostaStato !== st) return;
    st.invio = false;
    if (esito.error) {
        _propostaErrore(esito.error.message || String(esito.error));
        if (btn) { btn.disabled = false; btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> ${testoInvia}`; }
        return;
    }
    const id = esito.data, nome = st.nomeAltro, dopo = st.dopoInvio, cambiata = !!st.sostituisce;
    _propostaChiudi();
    avvisoBreve(cambiata ? `✅ Proposta cambiata: ${nome} trova la nuova in Scambi.` : `✅ Proposta inviata a ${nome}.`, { tipo: 'ok' });
    if (typeof _widgetRichiesteSvuotaCache === 'function') _widgetRichiesteSvuotaCache();
    if (dopo) { try { dopo(id); } catch (e) { console.error('apriPropostaScambio (dopo l\'invio):', e); } }
    if (typeof _scambiDopoProposta === 'function') _scambiDopoProposta(id);
}
