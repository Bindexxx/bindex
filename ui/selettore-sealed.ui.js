// Sealed fase C (26/11/2026): scegli il prodotto sealed dal catalogo (sql/151) invece di scriverlo
// a mano. Un campo solo (nome italiano o inglese, sigle come ETB), poi i filtri Tipo ed Espansione.
// Il prodotto scelto va in coda col suo link di Cardmarket (url_diretto): l'estensione non lo cerca.
// Se non c'è, il nome libero resta come prima (lo cerca l'estensione per nome).
//   - Inserimento (Collezione e Wishlist, scheda Sealed): pannello sotto la riga, la riga si blocca;
//   - apriSceltaSealed(...): la stessa ricerca in una finestra (Carte con problemi, Modifica sealed);
//   - ssCollegaPerNome(...): nome scritto proprio come nel catalogo → link (salvataggio, Import CSV).
// Le parole si leggono in utils/sealed-cerca.js, il DB in data/sealed-catalogo.repository.js.

const _SS_ATTESA_MS = 260;
const _SS_MOSTRA = 24;
let _ssUltimoTocco = 0;
let _ssEspansioniPromessa = null;
const _ssCache = new Map();

// ───────────────────────── catalogo ─────────────────────────

function _ssCaricaEspansioni() {
    if (!_ssEspansioniPromessa) {
        _ssEspansioniPromessa = sealedCatalogoEspansioni().then(({ data, error }) => {
            if (error) { _ssEspansioniPromessa = null; return { lista: [], perId: new Map() }; }
            const lista = (data || []).map(e => ({ id: e.id_espansione, nome: e.nome || '' }));
            return { lista, perId: new Map(lista.map(e => [e.id, e.nome])) };
        }).catch(() => { _ssEspansioniPromessa = null; return { lista: [], perId: new Map() }; });
    }
    return _ssEspansioniPromessa;
}

function _ssProdotto(r, perId) {
    return {
        url: r.url, id: r.id_prodotto, categoria: r.categoria || '', nome: r.nome || '', slug: r.slug || '',
        idEspansione: r.id_espansione, espansione: (perId && perId.get(r.id_espansione)) || '',
        immagine: r.foto ? sealedCatalogoFotoUrl(r.foto) : (r.foto_cm || null),
    };
}

// esito = { prodotti, totale, testo, filtri } | { poco: true } | { errore }
async function _ssCerca(testo, filtri) {
    const f = { categoria: (filtri && filtri.categoria) || '', espansione: (filtri && filtri.espansione) || '' };
    const chiave = sealedChiaveRicerca(testo, f);
    if (_ssCache.has(chiave)) return _ssCache.get(chiave);
    const esp = await _ssCaricaEspansioni();
    const q = sealedLeggiTesto(testo, esp.lista);
    if (!q.gruppi.length && !f.categoria && !f.espansione) return { poco: true, prodotti: [], totale: 0, testo, filtri: f };
    let risposta;
    try { risposta = await sealedCatalogoCerca(q.gruppi, f, 120); } catch (e) { risposta = { error: e }; }
    if (risposta.error) return { errore: risposta.error.message || String(risposta.error), prodotti: [], totale: 0, testo, filtri: f };
    const prodotti = sealedOrdina((risposta.data || []).map(r => _ssProdotto(r, esp.perId)), q);
    const esito = { prodotti, totale: risposta.count != null ? risposta.count : prodotti.length, testo, filtri: f, chiave };
    _ssCache.set(chiave, esito);
    if (_ssCache.size > 40) _ssCache.delete(_ssCache.keys().next().value);
    return esito;
}

// ───────────────────────── pezzi comuni ─────────────────────────

function _ssMiniHtml(immagine) {
    const src = immagine && typeof _urlImmagineVisualizzabile === 'function' ? _urlImmagineVisualizzabile(immagine, 200) : null;
    const vuota = '<span class="ss-mini-vuota" aria-hidden="true"><i class="fa-solid fa-box"></i></span>';
    if (!src) return `<span class="sel-mini ss-mini">${vuota}</span>`;
    return `<span class="sel-mini ss-mini"><img src="${src}" alt="" loading="lazy" onerror="this.remove();">${vuota}</span>`;
}

function _ssDidascalia(p) {
    return [sealedCategoriaCorta(p.categoria), p.espansione].filter(Boolean).join(' · ');
}

function _ssTesseraHtml(p, i, azione) {
    return `
        <button type="button" class="sel-carta ss-carta" onclick="${azione}(${i})">
            ${_ssMiniHtml(p.immagine)}
            <span class="sel-testo">
                <b>${escapeHtml(p.nome || '(senza nome)')}</b>
                <span class="sel-set">${escapeHtml(_ssDidascalia(p))}</span>
            </span>
        </button>`;
}

// I filtri: Tipo (sempre tutti) ed Espansione (quelle trovate senza filtro di espansione).
function _ssFiltriHtml(filtri, espOpzioni, azione) {
    const chip = (valore, testo) => `<button type="button" class="ss-chip${(filtri.categoria || '') === valore ? ' attivo' : ''}" onclick="${azione}('categoria', '${valore}')" aria-pressed="${(filtri.categoria || '') === valore}">${escapeHtml(testo)}</button>`;
    const tipi = [chip('', 'Tutti')].concat(SEALED_CATEGORIE.map(c => chip(c.id, c.corto))).join('');
    const opz = (espOpzioni || []).slice(0, 60);
    const scelta = filtri.espansione ? String(filtri.espansione) : '';
    if (scelta && !opz.some(e => String(e.id) === scelta)) opz.unshift({ id: scelta, nome: 'espansione scelta', quanti: 0 });
    const esp = opz.length ? `
        <select class="ss-esp" onchange="${azione}('espansione', this.value)" aria-label="Espansione">
            <option value="">Tutte le espansioni</option>
            ${opz.map(e => `<option value="${escapeHtml(String(e.id))}"${String(e.id) === scelta ? ' selected' : ''}>${escapeHtml(e.nome)}${e.quanti ? ` (${e.quanti})` : ''}</option>`).join('')}
        </select>` : '';
    return `<div class="ss-filtri"><div class="ss-chips" role="group" aria-label="Tipo">${tipi}</div>${esp}</div>`;
}

function _ssElencoHtml(esito, azione) {
    if (esito.errore) return `<p class="ss-nota">Il catalogo non risponde (${escapeHtml(esito.errore)}). Puoi salvarlo lo stesso: lo cerca l'estensione per nome.</p>`;
    if (!esito.prodotti.length) return `<p class="ss-nota">Nessun prodotto nel catalogo per “${escapeHtml(esito.testo || '')}”${esito.filtri.categoria || esito.filtri.espansione ? ' con questi filtri' : ''}. Puoi salvarlo così: lo cerca l'estensione per nome.</p>`;
    const visti = esito.prodotti.slice(0, _SS_MOSTRA);
    const altri = esito.totale - visti.length;
    return `<div class="sel-griglia ss-griglia">${visti.map((p, i) => _ssTesseraHtml(p, i, azione)).join('')}</div>
        ${altri > 0 ? `<div class="sel-altre">Ce ne sono altri ${altri}: aggiungi una parola (espansione, Pokémon) o usa i filtri.</div>` : ''}`;
}

// ───────────────────────── Inserimento: pannello sotto la riga ─────────────────────────

function _ssInput(tr) { return tr ? tr.querySelector('td:nth-child(1) > input') : null; }
function _ssRigheDati() { return [...document.querySelectorAll('#entryTableBodySealed tr:not(.ins-sugg-riga)')]; }
function _ssRigaDelPannello() {
    const p = document.querySelector('#entryTableBodySealed tr.ins-sugg-riga');
    return p ? p.previousElementSibling : null;
}

function ssChiudiPannello() {
    document.querySelectorAll('#entryTableBodySealed tr.ins-sugg-riga').forEach(r => r.remove());
    document.querySelectorAll('#entryTableBodySealed tr.ins-con-pannello').forEach(r => r.classList.remove('ins-con-pannello'));
}

function _ssMostraPannello(tr, esito) {
    if (!tr || !tr.isConnected || tr.dataset.ssBlocco || esito.poco) return;
    ssChiudiPannello();
    if (!esito.filtri.espansione) tr._ssEspOpzioni = sealedEspansioniDei(esito.prodotti);
    const trovati = esito.prodotti.length
        ? `<span><b>${esito.totale} prodott${esito.totale === 1 ? 'o' : 'i'} nel catalogo</b> per “${escapeHtml(esito.testo)}” · clicca quello giusto</span>`
        : '<span>Scegli dal catalogo, o salvalo col nome scritto</span>';
    const riga = document.createElement('tr');
    riga.className = 'ins-sugg-riga';
    riga.innerHTML = `
        <td colspan="10" class="ins-sugg-td">
            <div class="ins-sugg ss-pannello" onmousedown="_ssUltimoTocco = Date.now()" ontouchstart="_ssUltimoTocco = Date.now()">
                <div class="ins-sugg-testa">
                    ${trovati}
                    <span class="ins-sugg-azioni">
                        <button type="button" class="sel-chiudi" onclick="ssChiudiPannello()" aria-label="Chiudi i suggerimenti"><i class="fa-solid fa-xmark"></i></button>
                    </span>
                </div>
                ${_ssFiltriHtml(esito.filtri, tr._ssEspOpzioni, 'ssFiltroPannello')}
                ${_ssElencoHtml(esito, 'ssScegliDaPannello')}
            </div>
        </td>`;
    tr.after(riga);
    tr.classList.add('ins-con-pannello');
}

async function _ssAggiornaRiga(tr, { mostra = true } = {}) {
    if (!tr || !tr.isConnected || tr.dataset.ssBlocco) return null;
    const input = _ssInput(tr);
    if (!input) return null;
    const testo = input.value.trim();
    const filtri = tr._ssFiltri || { categoria: '', espansione: '' };
    if (testo.length < 2) {
        tr._ssGiro = (tr._ssGiro || 0) + 1;
        tr._ssEsito = null;
        if (_ssRigaDelPannello() === tr) ssChiudiPannello();
        return null;
    }
    const giro = (tr._ssGiro = (tr._ssGiro || 0) + 1);
    const esito = await _ssCerca(testo, filtri);
    if (tr._ssGiro !== giro || !tr.isConnected || tr.dataset.ssBlocco) return null;   // hai scritto altro nel frattempo
    tr._ssEsito = esito;
    if (mostra) _ssMostraPannello(tr, esito);
    return esito;
}

// Da handleEntryInputSealed quando cambia il nome di una riga.
function ssAlScrivere(input) {
    const tr = input.closest('tr');
    if (!tr || tr.dataset.ssBlocco) return;
    clearTimeout(tr._ssTimer);
    tr._ssTimer = setTimeout(() => { _ssAggiornaRiga(tr); }, _SS_ATTESA_MS);
}

function ssEntraCampo(input) {
    const tr = input.closest('tr');
    if (!tr || tr.dataset.ssBlocco) return;
    const aperta = _ssRigaDelPannello();
    if (aperta && aperta !== tr) ssChiudiPannello();
    if (tr._ssEsito && input.value.trim().length >= 2 && _ssRigaDelPannello() !== tr) _ssMostraPannello(tr, tr._ssEsito);
}

function ssFiltroPannello(chiave, valore) {
    const tr = _ssRigaDelPannello();
    if (!tr) return;
    const f = Object.assign({ categoria: '', espansione: '' }, tr._ssFiltri || {});
    f[chiave] = f[chiave] === valore && chiave === 'categoria' ? '' : valore;
    if (chiave === 'categoria') f.espansione = '';
    tr._ssFiltri = f;
    _ssAggiornaRiga(tr);
}

function ssScegliDaPannello(i) {
    const tr = _ssRigaDelPannello();
    const p = tr && tr._ssEsito ? tr._ssEsito.prodotti[i] : null;
    if (!tr || !p) return;
    ssBlocca(tr, p);
    const dopo = _ssRigheDati()[_ssRigheDati().indexOf(tr) + 1];
    _ssInput(dopo)?.focus();
}

// Il prodotto scelto di una riga, o null.
function ssBloccoRiga(tr) {
    try { return tr && tr.dataset.ssBlocco ? JSON.parse(tr.dataset.ssBlocco) : null; } catch (_) { return null; }
}

function ssBlocca(tr, p) {
    const input = _ssInput(tr);
    const cella = input ? input.parentElement : null;
    if (!tr || !input || !cella || !p || !p.url) return;
    if (_ssRigaDelPannello() === tr) ssChiudiPannello();
    const b = { url: p.url, nome: p.nome, categoria: p.categoria, espansione: p.espansione, immagine: p.immagine, testo: input.value.trim() };
    tr.dataset.ssBlocco = JSON.stringify(b);
    tr.classList.add('ss-bloccata');
    input.value = p.nome;
    let box = cella.querySelector('.ins-blocco');
    if (!box) { box = document.createElement('div'); box.className = 'ins-blocco ss-blocco'; input.after(box); }
    box.innerHTML = `
        ${_ssMiniHtml(b.immagine)}
        <div class="ins-blocco-testo">
            <div class="ins-blocco-nome"><i class="fa-solid fa-lock"></i><b>${escapeHtml(b.nome)}</b></div>
            <div class="ins-blocco-cod"><em>${escapeHtml(_ssDidascalia(b))}</em></div>
        </div>
        <button type="button" class="ins-blocco-cambia" onclick="ssSblocca(this)">Cambia</button>`;
    if (typeof handleEntryInputSealed === 'function') handleEntryInputSealed(input);
}

function ssSblocca(btn) {
    const tr = btn.closest('tr');
    const input = _ssInput(tr);
    if (!tr || !input) return;
    const b = ssBloccoRiga(tr);
    delete tr.dataset.ssBlocco;
    tr.classList.remove('ss-bloccata');
    tr.querySelector('.ss-blocco')?.remove();
    input.value = (b && b.testo) || input.value;
    tr._ssEsito = null;
    input.focus();
    _ssAggiornaRiga(tr);
}

// Riga tolta o svuotata: via il pannello e il prodotto scelto.
function ssTogliRiga(tr) {
    if (!tr) return;
    if (_ssRigaDelPannello() === tr) ssChiudiPannello();
    clearTimeout(tr._ssTimer);
    tr._ssGiro = (tr._ssGiro || 0) + 1;
    delete tr.dataset.ssBlocco;
    tr.classList.remove('ss-bloccata');
    tr.querySelector('.ss-blocco')?.remove();
    tr._ssEsito = null;
    tr._ssFiltri = null;
}

// Nomi scritti proprio come nel catalogo (italiano o inglese) → il loro prodotto. Map nome → prodotto.
// Un nome che corrisponde a più prodotti resta senza (lo cerca l'estensione come prima).
async function ssCollegaPerNome(nomi) {
    const elenco = [...new Set((nomi || []).map(n => String(n || '').trim()).filter(n => n.length >= 3))];
    const esito = new Map();
    if (!elenco.length || typeof sealedCatalogoPerNomi !== 'function') return esito;
    try {
        const esp = await _ssCaricaEspansioni();
        for (let i = 0; i < elenco.length; i += 50) {
            const pezzo = elenco.slice(i, i + 50);
            const { data, error } = await sealedCatalogoPerNomi(pezzo, pezzo.map(sealedSlugDaNome));
            if (error || !data) continue;
            sealedAbbinaNomi(pezzo, data.map(r => _ssProdotto(r, esp.perId))).forEach((p, n) => esito.set(n, p));
        }
    } catch (e) {
        console.warn('[selettore sealed] collegamento per nome:', e);
    }
    return esito;
}

// ───────────────────────── la finestra ─────────────────────────

let _ssFinestra = null;   // { testo, filtri, esito, espOpzioni, alScelta, alTesto, giro }

// opzioni = { titolo, sottotitolo, testo, alScelta(prodotto), alTesto(testo) | null, testoBottone }
function apriSceltaSealed(opzioni = {}) {
    let ov = document.getElementById('ssScelta');
    if (!ov) {
        ov = document.createElement('div');
        ov.id = 'ssScelta';
        ov.className = 'modal-overlay ss-overlay';
        ov.setAttribute('role', 'dialog');
        ov.setAttribute('aria-modal', 'true');
        ov.onclick = (e) => { if (e.target === ov) chiudiSceltaSealed(); };
        document.body.appendChild(ov);
    } else {
        document.body.appendChild(ov);   // sempre l'ultima finestra, sopra le altre (e per "indietro")
    }
    _ssFinestra = {
        testo: opzioni.testo || '', filtri: { categoria: '', espansione: '' }, esito: null, espOpzioni: [],
        alScelta: opzioni.alScelta || null, alTesto: opzioni.alTesto || null, giro: 0,
    };
    ov.innerHTML = `
        <div class="modal-content ss-finestra" onclick="event.stopPropagation()">
            <button type="button" class="close-modal-btn" onclick="chiudiSceltaSealed()" aria-label="Chiudi"><i class="fa-solid fa-xmark"></i></button>
            <h3 class="ss-titolo"><i class="fa-solid fa-box-archive"></i> ${escapeHtml(opzioni.titolo || 'Scegli il prodotto')}</h3>
            ${opzioni.sottotitolo ? `<p class="ss-sottotitolo">${escapeHtml(opzioni.sottotitolo)}</p>` : ''}
            <input type="text" id="ssSceltaTesto" class="ss-campo" placeholder="Nome in italiano o inglese, anche ETB, box, busta…" value="${escapeHtml(_ssFinestra.testo)}" oninput="_ssFinestraScrive(this.value)" autocomplete="off">
            <div id="ssSceltaCorpo" class="ss-corpo"></div>
            <div class="ss-piede">
                <button type="button" class="btn-secondary" data-azione="annulla" onclick="chiudiSceltaSealed()">Annulla</button>
                ${_ssFinestra.alTesto ? `<button type="button" class="btn-secondary" id="ssSceltaUsaTesto" onclick="_ssFinestraUsaTesto()">${escapeHtml(opzioni.testoBottone || 'Usa il nome scritto')}</button>` : ''}
            </div>
        </div>`;
    ov.style.display = 'flex';
    const campo = document.getElementById('ssSceltaTesto');
    if (campo) { campo.focus(); campo.select(); }
    _ssFinestraCerca();
}

function chiudiSceltaSealed() {
    const ov = document.getElementById('ssScelta');
    if (ov) { ov.style.display = 'none'; ov.innerHTML = ''; }
    if (_ssFinestra) clearTimeout(_ssFinestra.timer);
    _ssFinestra = null;
}

function _ssFinestraScrive(valore) {
    if (!_ssFinestra) return;
    _ssFinestra.testo = valore;
    clearTimeout(_ssFinestra.timer);
    _ssFinestra.timer = setTimeout(_ssFinestraCerca, _SS_ATTESA_MS);
}

async function _ssFinestraCerca() {
    const f = _ssFinestra;
    if (!f) return;
    const corpo = document.getElementById('ssSceltaCorpo');
    const giro = ++f.giro;
    if (f.testo.trim().length < 2 && !f.filtri.categoria && !f.filtri.espansione) {
        f.esito = null;
        if (corpo) corpo.innerHTML = `${_ssFiltriHtml(f.filtri, f.espOpzioni, '_ssFiltroFinestra')}<p class="ss-nota">Scrivi almeno due lettere del nome.</p>`;
        return;
    }
    const esito = await _ssCerca(f.testo, f.filtri);
    if (_ssFinestra !== f || f.giro !== giro) return;
    f.esito = esito;
    if (!f.filtri.espansione) f.espOpzioni = sealedEspansioniDei(esito.prodotti);
    if (corpo) corpo.innerHTML = `${_ssFiltriHtml(f.filtri, f.espOpzioni, '_ssFiltroFinestra')}${_ssElencoHtml(esito, '_ssScegliDaFinestra')}`;
}

function _ssFiltroFinestra(chiave, valore) {
    const f = _ssFinestra;
    if (!f) return;
    f.filtri[chiave] = f.filtri[chiave] === valore && chiave === 'categoria' ? '' : valore;
    if (chiave === 'categoria') f.filtri.espansione = '';
    _ssFinestraCerca();
}

function _ssScegliDaFinestra(i) {
    const f = _ssFinestra;
    const p = f && f.esito ? f.esito.prodotti[i] : null;
    if (!p) return;
    const fatto = f.alScelta;
    chiudiSceltaSealed();
    if (typeof fatto === 'function') fatto(p);
}

function _ssFinestraUsaTesto() {
    const f = _ssFinestra;
    if (!f || typeof f.alTesto !== 'function') return;
    const testo = f.testo.trim();
    if (!testo) return;
    const fatto = f.alTesto;
    chiudiSceltaSealed();
    fatto(testo);
}
