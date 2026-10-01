// ── ui/import-csv.ui.js ──────────────────────────────────────────────────
// RESTYLE BINDEX FASE 8e: "Importa da CSV" (Impostazioni → Account e dati).
// RIFATTO 2026-10-01 come nelle tavole PC-imp-acc / PC-csv / PC-csv-prog:
// tre passi nella stessa vista (#importCsvVista, dentro #impostazioni) —
//   1. File: trascina o scegli il CSV, oppure scarica un modello;
//   2. Colonne: ogni colonna del file abbinata a un campo (riconosciute da
//      sole, si possono cambiare); più "Dove vanno" (Collezione/Wishlist,
//      Carte/Sealed), le stesse due scelte di Inserimento;
//   3. Controllo: ogni riga segnata come pronta / già presente (stessa
//      carta già in collezione, si può saltare) / da controllare (valore non
//      riconosciuto, sostituito con quello predefinito) / saltata (senza
//      nome); poi "Metti in coda N carte" invia a blocchi da 100 con barra,
//      e un blocco che non parte si riprova da lì senza rimandare i primi.
// Le righe finiscono nella stessa coda unica 'coda_carte' dell'inserimento
// manuale (queueInsertRighe), con gli stessi campi di _rigaEntryToRigheDb in
// ui/entry.ui.js: l'estensione le elabora come sempre. Nessuna chiamata
// Supabase qui.
//
// Dipende da: authGetUserId (data/auth.repository.js), queueInsertRighe
// (data/queue.repository.js), carteReali (ui/cards.ui.js, solo lettura per
// i "già presenti"), escapeHtml, insAggiornaPagina (facoltativa).

const _IMPORT_CSV_BLOCCO = 100;
const _IMPORT_CSV_MAX_RIGHE = 2000;
const _IMPORT_CSV_CAMPI = [
    ['', '— non usare —'], ['nome', 'Nome'], ['qty', 'Quantità'], ['lingua', 'Lingua'],
    ['condizione', 'Condizione'], ['location', 'Location'], ['nota', 'Note'], ['reverse', 'Reverse'],
    ['first_ed', 'Prima edizione'], ['sigillata_originale', 'Sigillata'], ['destinazione', 'Destinazione'],
];
const _IMPORT_CSV_ALIAS = {
    nome: ['nome', 'name', 'carta', 'card', 'codice', 'titolo'],
    lingua: ['lingua', 'lang', 'language', 'idioma'],
    condizione: ['condizione', 'cond', 'condition', 'stato'],
    qty: ['qty', 'quantita', 'quantità', 'quantity', 'q', 'qta', 'qtà', 'pezzi', 'n'],
    reverse: ['reverse', 'rev', 'reverse_holo'],
    first_ed: ['first_ed', 'first', 'prima_edizione', 'firsted', '1st'],
    sigillata_originale: ['sigillata_originale', 'sigillata', 'sig'],
    nota: ['nota', 'note', 'notes', 'commento'],
    location: ['location', 'ubicazione', 'posizione', 'dove', 'binder', 'scatola'],
    destinazione: ['destinazione', 'dest'],
};
const _IMPORT_CSV_LINGUE = { IT: 'IT', ITA: 'IT', ITALIANO: 'IT', EN: 'EN', ENG: 'EN', INGLESE: 'EN', ENGLISH: 'EN', JP: 'JP', JPN: 'JP', JAP: 'JP', GIAPPONESE: 'JP', KOR: 'KOR', KO: 'KOR', KR: 'KOR', COREANO: 'KOR' };
const _IMPORT_CSV_COND = { NM: 'NM', MINT: 'NM', 'NEAR MINT': 'NM', EX: 'EX', EXCELLENT: 'EX', GD: 'GD', GOOD: 'GD' };

let _impCsv = null; // { file, tabella, mappa[], dest, tipo, saltaGia, righe[], inviate, errore, invio }

function _importCsvParse(testo) {
    if (testo.charCodeAt(0) === 0xFEFF) testo = testo.slice(1);
    const primaRiga = testo.split(/\r?\n/, 1)[0] || '';
    const sep = (primaRiga.match(/;/g) || []).length > (primaRiga.match(/,/g) || []).length ? ';' : ',';
    const righe = [];
    let riga = [], cella = '', fra = false;
    for (let i = 0; i < testo.length; i++) {
        const c = testo[i];
        if (fra) {
            if (c === '"') {
                if (testo[i + 1] === '"') { cella += '"'; i++; } else fra = false;
            } else cella += c;
        } else if (c === '"') fra = true;
        else if (c === sep) { riga.push(cella); cella = ''; }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && testo[i + 1] === '\n') i++;
            riga.push(cella); cella = '';
            if (riga.some(x => x.trim() !== '')) righe.push(riga);
            riga = [];
        } else cella += c;
    }
    riga.push(cella);
    if (riga.some(x => x.trim() !== '')) righe.push(riga);
    return righe;
}

function _importCsvBool(v) {
    return ['true', '1', 'si', 'sì', 'x', 'yes', 'y', 'vero'].includes(String(v || '').trim().toLowerCase());
}

// Abbinamento automatico: intestazione ripulita (minuscole, senza punti/
// spazi agli estremi) confrontata con gli alias; ogni campo una volta sola.
function _importCsvMappaAuto(intest) {
    const usati = new Set();
    return intest.map(h => {
        const k = String(h || '').trim().toLowerCase().replace(/[.:]+$/, '').replace(/\s+/g, '_');
        const campo = Object.keys(_IMPORT_CSV_ALIAS).find(c => !usati.has(c) && _IMPORT_CSV_ALIAS[c].includes(k));
        if (campo) usati.add(campo);
        return campo || '';
    });
}

// Carte già in collezione con lo stesso nome (stesso criterio di
// "hai già" in Inserimento): totale pezzi e location.
function _importCsvGia(nome) {
    const n = String(nome || '').toLowerCase();
    if (n.length < 3 || typeof carteReali === 'undefined' || !Array.isArray(carteReali)) return null;
    const uguali = carteReali.filter(c => c.tabella === 'carte' && c.stato === 'collezione' &&
        ((c.name && c.name.toLowerCase() === n) || (c.code && c.name && n.includes(c.code.toLowerCase()) && n.includes(c.name.toLowerCase().split(' ')[0]))));
    if (!uguali.length) return null;
    return {
        qty: uguali.reduce((t, c) => t + (Number(c.qty) || 1), 0),
        dove: [...new Set(uguali.map(c => c.location).filter(Boolean))].join(', '),
    };
}

// Righe del file → righe da controllare, con stato e avvisi.
function _importCsvValuta() {
    const s = _impCsv;
    const col = (campo) => s.mappa.indexOf(campo);
    const idx = {}; Object.keys(_IMPORT_CSV_ALIAS).forEach(k => { idx[k] = col(k); });
    const val = (r, k) => (idx[k] >= 0 ? String(r[idx[k]] || '').trim() : '');
    s.righe = s.tabella.slice(1).map(r => {
        const nome = val(r, 'nome');
        const avvisi = [];
        const linguaGrezza = val(r, 'lingua');
        let lingua = _IMPORT_CSV_LINGUE[linguaGrezza.toUpperCase()] || 'IT';
        if (linguaGrezza && !_IMPORT_CSV_LINGUE[linguaGrezza.toUpperCase()]) avvisi.push(`lingua "${linguaGrezza}" non riconosciuta → IT`);
        const condGrezza = val(r, 'condizione');
        const cond = _IMPORT_CSV_COND[condGrezza.toUpperCase()] || 'NM';
        if (condGrezza && !_IMPORT_CSV_COND[condGrezza.toUpperCase()]) avvisi.push(`condizione "${condGrezza}" non riconosciuta → NM`);
        const qtyGrezza = val(r, 'qty');
        const qty = Math.max(1, parseInt(qtyGrezza, 10) || 1);
        if (qtyGrezza && String(qty) !== qtyGrezza) avvisi.push(`quantità "${qtyGrezza}" → ${qty}`);
        const loc = val(r, 'location');
        const destGrezza = val(r, 'destinazione').toLowerCase();
        const dest = idx.destinazione >= 0 && destGrezza ? (destGrezza === 'wishlist' ? 'wishlist' : 'collezione') : s.dest;
        const db = {
            nome, lingua, condizione: cond,
            reverse: _importCsvBool(val(r, 'reverse')),
            first_ed: _importCsvBool(val(r, 'first_ed')),
            sigillata_originale: _importCsvBool(val(r, 'sigillata_originale')),
            nota: val(r, 'nota') || null,
            location: (loc && loc !== '?') ? loc : null,
            destinazione: dest, qty,
            ...(s.tipo === 'sealed' ? { tipo: 'sealed' } : {}),
        };
        let stato = 'ok', nota = '';
        if (!nome) { stato = 'saltata'; nota = 'senza nome: saltata'; }
        else {
            const gia = dest === 'collezione' && s.tipo !== 'sealed' ? _importCsvGia(nome) : null;
            if (gia) { stato = 'gia'; nota = `già in collezione${gia.dove ? ' (' + gia.dove + ')' : ''} → diventerebbe ×${gia.qty + qty}`; }
            else if (avvisi.length) { stato = 'avviso'; nota = avvisi.join(' · '); }
        }
        return { db, stato, nota, linguaGrezza, condGrezza };
    });
}

function _importCsvDaInviare() {
    if (!_impCsv || !_impCsv.righe) return [];
    return _impCsv.righe.filter(r => r.stato !== 'saltata' && !(r.stato === 'gia' && _impCsv.saltaGia));
}

// ── Apertura / chiusura della vista ─────────────────────────────────────
function importCsvApri() {
    if (!_impCsv || !_impCsv.invio) _impCsv = { file: '', tabella: null, mappa: [], dest: 'collezione', tipo: 'carta', saltaGia: true, righe: null, inviate: 0, errore: '', invio: false, mostraTutte: false };
    document.getElementById('impostazioni')?.classList.add('imp-csv-aperto');
    _importCsvRender();
    const cont = document.querySelector('.container');
    if (cont && typeof cont.scrollTo === 'function') cont.scrollTo(0, 0);
}

function importCsvChiudi() {
    if (_impCsv && _impCsv.invio) return; // durante l'invio resta aperta
    document.getElementById('impostazioni')?.classList.remove('imp-csv-aperto');
    const v = document.getElementById('importCsvVista');
    if (v) v.innerHTML = '';
}

function importCsvIndietro() {
    if (!_impCsv || _impCsv.invio) return;
    _impCsv.tabella = null; _impCsv.righe = null; _impCsv.file = ''; _impCsv.inviate = 0; _impCsv.errore = '';
    _importCsvRender();
}

// Chiamata dall'<input type=file id="importCsvFile"> (stesso nome di prima).
async function importaCsvDaFile(input) {
    const file = input && input.files && input.files[0];
    if (input) input.value = '';
    if (file) await _importCsvLeggi(file);
}

async function _importCsvLeggi(file) {
    if (!_impCsv) importCsvApri();
    try {
        const tabella = _importCsvParse(await file.text());
        _impCsv.file = file.name || 'file.csv';
        _impCsv.errore = '';
        if (tabella.length < 2) { _impCsv.errore = 'Il file è vuoto o ha solo l\'intestazione.'; _importCsvRender(); return; }
        if (tabella.length - 1 > _IMPORT_CSV_MAX_RIGHE) {
            _impCsv.errore = `Il file ha ${tabella.length - 1} righe: il massimo per volta è ${_IMPORT_CSV_MAX_RIGHE}. Dividilo in più file.`;
            _importCsvRender(); return;
        }
        _impCsv.tabella = tabella;
        _impCsv.mappa = _importCsvMappaAuto(tabella[0]);
        _impCsv.inviate = 0;
        _importCsvValuta();
        _importCsvRender();
    } catch (e) {
        console.error('[import-csv]', e);
        _impCsv.errore = 'Impossibile leggere il file: ' + (e.message || e);
        _importCsvRender();
    }
}

function _importCsvTrascina(ev, entra) {
    ev.preventDefault();
    ev.currentTarget.classList.toggle('sopra', !!entra);
}

function _importCsvRilascia(ev) {
    ev.preventDefault();
    ev.currentTarget.classList.remove('sopra');
    const file = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
    if (file) _importCsvLeggi(file);
}

function importCsvScaricaModello() {
    const testo = 'nome;qty;lingua;condizione;location;nota;reverse;first_ed;sigillata_originale\n' +
        'Charizard ex OBF 125;1;IT;NM;Binder 1;;no;no;no\n';
    const blob = new Blob(['﻿' + testo], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'modello_bindex.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function _importCsvCambiaColonna(i, campo) {
    if (!_impCsv || _impCsv.invio) return;
    // Un campo può stare su una sola colonna: chi lo aveva prima lo perde.
    if (campo) _impCsv.mappa = _impCsv.mappa.map((c, k) => (k !== i && c === campo ? '' : c));
    _impCsv.mappa[i] = campo;
    _importCsvValuta();
    _importCsvRender();
}

function _importCsvImposta(chiave, valore) {
    if (!_impCsv || _impCsv.invio) return;
    _impCsv[chiave] = valore;
    if (chiave !== 'saltaGia' && chiave !== 'mostraTutte') _importCsvValuta();
    _importCsvRender();
}

// ── Invio a blocchi ─────────────────────────────────────────────────────
async function importCsvInvia() {
    const s = _impCsv;
    if (!s || s.invio) return;
    const userId = await authGetUserId();
    if (!userId) return;
    const righe = _importCsvDaInviare().map(r => ({ owner_id: userId, ...r.db }));
    if (!righe.length) return;
    s.invio = true; s.errore = ''; s.totale = righe.length;
    _importCsvRender();
    for (let i = s.inviate; i < righe.length; i += _IMPORT_CSV_BLOCCO) {
        const blocco = righe.slice(i, i + _IMPORT_CSV_BLOCCO);
        const { error } = await queueInsertRighe(blocco);
        if (error) {
            s.invio = false;
            s.errore = `Il blocco ${Math.floor(i / _IMPORT_CSV_BLOCCO) + 1} non è partito (${error.message}). I blocchi prima sono già in coda: riprova da qui.`;
            _importCsvRender();
            return;
        }
        s.inviate = i + blocco.length;
        _importCsvRender();
    }
    s.invio = false; s.finito = true;
    _importCsvRender();
    if (typeof insAggiornaPagina === 'function') insAggiornaPagina();
}

// ── Disegno ─────────────────────────────────────────────────────────────
function _importCsvPassi(attivo) {
    const passi = ['File', 'Colonne', 'Controllo'];
    return `<div class="csv-passi">${passi.map((p, i) => {
        const n = i + 1;
        const fatto = n < attivo;
        return `<span class="${fatto ? 'fatto' : n === attivo ? 'attivo' : ''}"><b>${fatto ? '<i class="fa-solid fa-check"></i>' : n}</b>${p}</span>`;
    }).join('')}</div>`;
}

function _importCsvRender() {
    const v = document.getElementById('importCsvVista');
    if (!v || !_impCsv) return;
    const s = _impCsv;
    const esc = (t) => escapeHtml(String(t == null ? '' : t));

    if (!s.tabella) {
        v.innerHTML = `
            <div class="csv-testa">
                <div><span class="page-title">Importa da CSV</span><p>Hai la collezione segnata altrove? Caricala in un colpo solo</p></div>
                ${_importCsvPassi(1)}
            </div>
            <div class="csv-card csv-passo1">
                <div class="csv-drop" ondragover="_importCsvTrascina(event, true)" ondragleave="_importCsvTrascina(event, false)" ondrop="_importCsvRilascia(event)">
                    <i class="fa-solid fa-file-csv"></i>
                    <b>Trascina qui il file CSV</b>
                    <span>oppure</span>
                    <button type="button" class="btn-secondary" onclick="document.getElementById('importCsvFile').click()">Scegli un file</button>
                </div>
                ${s.errore ? `<p class="csv-errore">${esc(s.errore)}</p>` : ''}
                <p class="csv-nota">Va bene un foglio Excel/Google salvato come CSV, e anche il CSV esportato da Bindex. Serve almeno una colonna col nome della carta.</p>
                <div class="csv-azioni-riga">
                    <button type="button" class="btn-secondary" onclick="importCsvScaricaModello()"><i class="fa-solid fa-download"></i> Scarica un modello</button>
                    <button type="button" class="btn-secondary" onclick="importCsvChiudi()">Torna alle impostazioni</button>
                </div>
            </div>`;
        return;
    }

    const intest = s.tabella[0];
    const colonne = intest.map((h, i) => `
        <div class="csv-col">
            <span class="csv-col-file">${esc(h || '(senza nome)')}</span>
            <i class="fa-solid fa-arrow-right"></i>
            <select onchange="_importCsvCambiaColonna(${i}, this.value)" ${s.invio ? 'disabled' : ''}>
                ${_IMPORT_CSV_CAMPI.map(([k, et]) => `<option value="${k}"${s.mappa[i] === k ? ' selected' : ''}>${et}</option>`).join('')}
            </select>
        </div>`).join('');
    const seg = (chiave, opzioni) => `<div class="csv-seg">${opzioni.map(([k, et]) =>
        `<button type="button" class="${s[chiave] === k ? 'attivo' : ''}" onclick="_importCsvImposta('${chiave}', '${k}')" ${s.invio ? 'disabled' : ''}>${et}</button>`).join('')}</div>`;

    const righe = s.righe || [];
    const n = { ok: 0, gia: 0, avviso: 0, saltata: 0 };
    righe.forEach(r => { n[r.stato]++; });
    const daInviare = _importCsvDaInviare().length;
    const senzaNome = s.mappa.indexOf('nome') < 0;
    const icona = { ok: 'fa-circle-check', gia: 'fa-clone', avviso: 'fa-triangle-exclamation', saltata: 'fa-ban' };
    const MOSTRA = 8;
    const visibili = s.mostraTutte ? righe : righe.slice(0, MOSTRA);
    const tabella = senzaNome
        ? '<p class="csv-errore">Abbina una colonna a "Nome": senza il nome della carta non si può cercare niente.</p>'
        : `<div class="csv-tabella-wrap"><table class="csv-tabella">
            <thead><tr><th></th><th>Nome</th><th>Qtà</th><th>Lingua</th><th>Cond.</th><th>Location</th><th></th></tr></thead>
            <tbody>${visibili.map(r => `
                <tr class="st-${r.stato}${r.stato === 'gia' && s.saltaGia ? ' esclusa' : ''}">
                    <td><i class="fa-solid ${icona[r.stato]}"></i></td>
                    <td class="csv-nome">${esc(r.db.nome || '—')}</td>
                    <td>${r.db.qty}</td>
                    <td>${esc(r.linguaGrezza && r.stato === 'avviso' ? r.linguaGrezza : r.db.lingua)}</td>
                    <td>${esc(r.db.condizione)}</td>
                    <td>${esc(r.db.location || '?')}</td>
                    <td class="csv-nota-riga">${esc(r.nota)}</td>
                </tr>`).join('')}
            </tbody></table></div>
            ${righe.length > MOSTRA ? `<button type="button" class="csv-altre" onclick="_importCsvImposta('mostraTutte', ${!s.mostraTutte})">${s.mostraTutte ? 'Mostra solo le prime' : `… e altre ${righe.length - MOSTRA} righe`}</button>` : ''}
            ${n.gia ? `<label class="csv-salta"><input type="checkbox" ${s.saltaGia ? 'checked' : ''} ${s.invio ? 'disabled' : ''} onchange="_importCsvImposta('saltaGia', this.checked)"> <b>Salta i ${n.gia} già presenti</b> — toglila se sono davvero copie in più</label>` : ''}`;

    let piede;
    if (s.invio || s.inviate > 0 || s.finito) {
        const tot = s.totale || daInviare;
        const blocchi = Math.max(1, Math.ceil(tot / _IMPORT_CSV_BLOCCO));
        const bloccoOra = Math.min(blocchi, Math.floor(s.inviate / _IMPORT_CSV_BLOCCO) + (s.finito ? 0 : 1));
        const perc = tot ? Math.round((s.inviate / tot) * 100) : 0;
        piede = `
            <div class="csv-prog">
                <div class="csv-prog-testa"><b>${s.finito ? `In coda: ${s.inviate} carte` : `In coda: ${s.inviate} di ${tot}`}</b><span>${s.finito ? 'fatto' : `blocco ${bloccoOra} di ${blocchi} · da ${_IMPORT_CSV_BLOCCO} righe`}</span></div>
                <div class="pg-barra-track"><div class="pg-barra-fill" style="width:${perc}%"></div></div>
                ${s.errore ? `<p class="csv-errore">${esc(s.errore)}</p><div class="csv-azioni-riga"><button type="button" class="btn-main" onclick="importCsvInvia()"><i class="fa-solid fa-rotate"></i> Riprova da qui</button></div>`
                    : s.finito ? `<p class="csv-nota">Fatto: le trovi in Inserimento, in "Ultimo invio". L'estensione cerca codici e prezzi come sempre.</p><div class="csv-azioni-riga"><button type="button" class="btn-secondary" onclick="importCsvChiudi(); _impCsv = null;">Chiudi</button></div>`
                    : '<p class="csv-nota">Puoi chiudere la pagina: i blocchi già inviati restano in coda. Se un blocco non parte, lo riprovi da qui.</p>'}
            </div>`;
    } else {
        piede = `
            <div class="csv-piede">
                <p class="csv-nota">Finiscono nella stessa coda di Inserimento: l'estensione cerca codici e prezzi come sempre, e le trovi in "Ultimo invio".</p>
                <button type="button" class="btn-secondary" onclick="importCsvIndietro()">Indietro</button>
                <button type="button" class="btn-main" onclick="importCsvInvia()" ${daInviare && !senzaNome ? '' : 'disabled'}><i class="fa-solid fa-file-import"></i> Metti in coda ${daInviare} ${daInviare === 1 ? 'carta' : 'carte'}</button>
            </div>`;
    }

    v.innerHTML = `
        <div class="csv-testa">
            <div><span class="page-title">Importa da CSV</span><p>${esc(s.file)} · ${righe.length} righe lette</p></div>
            ${_importCsvPassi(3)}
        </div>
        <div class="csv-layout">
            <div class="csv-sx">
                <div class="csv-card">
                    <h4>Colonne abbinate</h4>
                    ${colonne}
                    <p class="csv-nota">Riconosciute da sole; puoi cambiarle. Le colonne che mancano prendono il valore di Inserimento (IT, NM, 1, "?").</p>
                </div>
                <div class="csv-card">
                    <h4>Dove vanno</h4>
                    ${seg('dest', [['collezione', 'Collezione'], ['wishlist', 'Wishlist']])}
                    ${seg('tipo', [['carta', 'Carte'], ['sealed', 'Sealed']])}
                </div>
            </div>
            <div class="csv-card csv-dx">
                <div class="csv-controllo-testa"><h4>Controllo</h4>
                    <span><em class="c-ok">${n.ok} pronte</em>${n.gia ? ` <em class="c-gia">${n.gia} già presenti</em>` : ''}${n.avviso ? ` <em class="c-avviso">${n.avviso} da controllare</em>` : ''}${n.saltata ? ` <em class="c-saltata">${n.saltata} saltate</em>` : ''}</span></div>
                ${tabella}
                ${piede}
            </div>
        </div>`;
}
