// Selettore carte: mentre scrivi nell'Inserimento propone le carte del catalogo (set_carte) con la
// miniatura; quella scelta resta "bloccata" sulla riga e va in coda col link diretto di Cardmarket.
// In più "Indovino la tua carta" (ricerca guidata) usata anche da Carte con problemi.
// Se la ricerca sul DB non c'è ancora (sql/132 non eseguita) il selettore resta spento e
// l'Inserimento funziona come prima.

const _SEL_FAMIGLIE = {
    BOO: { nome: 'BOO', lungo: 'BOO (Trick or Trade)', parole: /\btrick\s*or\s*trade\b/gi, aiuto: 'Masterset a parte (BOO, BOO23, BOO24…), solo in inglese.' },
    PPS: { nome: 'PPS', lungo: 'PPS (bustine premio)', parole: /\bprize\s*pack\b/gi, aiuto: 'Masterset a parte per ogni serie PPS.' },
    BA:  { nome: 'Battle Academy', lungo: 'Battle Academy', parole: /\bbattle\s*academy\b/gi, aiuto: 'In basso a destra hanno un piccolo Pokémon con un numero: conta quello, non il numero del set.' },
    MCD: { nome: "McDonald's", lungo: "McDonald's", parole: /\bmc\s*donald(?:'?s)?\b/gi, aiuto: "Promo McDonald's: un masterset per anno." },
    WCD: { nome: 'WCD', lungo: 'WCD (mazzi dei Mondiali)', parole: /\bworld\s*championships?(?:\s*decks?)?\b/gi, aiuto: 'Mazzi dei Mondiali: masterset a parte per anno.' },
    TK:  { nome: 'Trainer Kit', lungo: 'Trainer Kit', parole: /\btrainer\s*kit\b/gi, aiuto: 'Non serve sapere né il kit né il mazzo.' },
    MFB: { nome: 'My First Battle', lungo: 'My First Battle', parole: /\bmy\s*first\s*battle\b/gi, aiuto: 'Mazzi per bambini col logo in basso a destra: un masterset per mazzo.' },
};
const _SEL_LINGUA_SET = { JP: 'JP', KOR: 'KOR', CHN: 'CHN', 'CHN-T': 'CHN-T' };
const _SEL_LINGUA_RIGA = { JP: 'JP', KOR: 'KOR', CHN: 'CHN', 'CHN-T': 'CHN-T' };
const _SEL_ATTESA_MS = 260;

let _selSpento = false;      // true se il DB non ha la ricerca: niente suggerimenti, tutto come prima
let _selSigle = null;        // sigle note, lette una volta da set_espansioni
let _selUltimoTocco = 0;     // ultimo tocco dentro il pannello (per non bloccare da soli mentre scegli)

// ───────────────────────── sigle note ─────────────────────────

async function _selCaricaSigle() {
    if (_selSigle) return _selSigle;
    const righe = (typeof setEspansioniLeggiTutte === 'function' ? await setEspansioniLeggiTutte() : null) || [];
    const codici = new Map();
    righe.forEach(r => {
        if (!r.sigla) return;
        const codice = String(r.sigla).split('@')[0].toUpperCase();
        if (!codici.has(codice)) codici.set(codice, []);
        codici.get(codice).push({ sigla: r.sigla, lingua: r.lingua || 'INT' });
    });
    const famiglie = {};
    Object.keys(_SEL_FAMIGLIE).forEach(f => {
        const re = f === 'MFB' ? /^MFB/ : new RegExp('^' + f + '(?:\\d|$)');
        famiglie[f] = [...codici.keys()].filter(c => re.test(c));
    });
    const indice = { codici, famiglie };
    if (righe.length) _selSigle = indice;
    return indice;
}

function _selCodiceAttaccato(P, indice) {
    for (let i = P.length - 1; i >= 2; i--) {
        const testa = P.slice(0, i).replace(/-$/, '');
        const coda = P.slice(i);
        if (/^\d{1,4}$/.test(coda) && parseInt(coda, 10) > 0 && indice.codici.has(testa)) return { codice: testa, numero: parseInt(coda, 10) };
    }
    return null;
}

// "jigglypuff 8", "svi 054", "PAL054", "zubat tk 11", "8/12" → cosa cercare nel catalogo.
function _selLeggiTesto(testo, indice) {
    let t = ' ' + String(testo || '') + ' ';
    Object.entries(_SEL_FAMIGLIE).forEach(([f, d]) => { t = t.replace(d.parole, ' ' + f + ' '); });
    const q = { nome: null, numero: null, totale: null, codici: [], famiglia: null, icona: null, alternativa: null, alternativaSempre: false, preciso: false };
    const parole = [];          // le parole del nome
    const tutte = [];           // parole e sigle nell'ordine in cui le hai scritte
    const sigleScritte = [];    // le sigle scritte staccate ("mew", "pal")
    const sigleInTesta = [];    // quelle scritte prima di ogni altra parola
    t.split(/[\s,;]+/).filter(Boolean).forEach(pezzo => {
        const P = pezzo.toUpperCase().replace(/^[#(\[]+|[)\].]+$/g, '');
        if (!P) return;
        const m = P.match(/^(\d{1,4})\/(\d{1,4})$/);
        if (m) { if (parseInt(m[1], 10) > 0) q.numero = parseInt(m[1], 10); q.totale = parseInt(m[2], 10) || null; return; }
        if (/^\d{1,4}$/.test(P)) { if (parseInt(P, 10) > 0) q.numero = parseInt(P, 10); return; }
        const famiglia = (P.match(/^(BOO|PPS|WCD|BA|MFB|MCD|TK)(?=\d|$)/) || [])[1];
        // "boo" da solo è la famiglia (non sai l'anno), anche se il Trick or Trade 2022 ha proprio la sigla BOO
        if (famiglia && P === famiglia) { q.famiglia = famiglia; return; }
        if (indice.codici.has(P)) {
            // "boo24", "mcd16": un set di una famiglia promo, scritto con l'anno
            if (famiglia && (indice.famiglie[famiglia] || []).includes(P)) { q.famiglia = famiglia; q.codici.push(P); return; }
            q.codici.push(P); sigleScritte.push(pezzo); tutte.push(pezzo);
            if (!parole.length) sigleInTesta.push(P);
            return;
        }
        if (famiglia && /^[A-Z]+\d{0,2}$/.test(P)) { q.famiglia = famiglia; return; }
        const attaccato = _selCodiceAttaccato(P, indice);
        if (attaccato) { q.codici.push(attaccato.codice); q.numero = attaccato.numero; return; }
        // "a42": l'icona delle Battle Academy (lettera del mazzo + numero), anche senza scrivere "ba"
        if (/^[A-D]\d{1,3}$/.test(P) && (q.famiglia === 'BA' || (indice.famiglie.BA || []).length)) { q.famiglia = 'BA'; q.icona = P; q.numero = parseInt(P.slice(1), 10); return; }
        parole.push(pezzo); tutte.push(pezzo);
    });
    const pulisci = (lista) => lista.join(' ').toLowerCase().replace(/[%_\\"()\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
    // Senza numero, una sigla scritta per prima ("mew", "mew ex") è più facilmente l'inizio di un nome;
    // dopo un nome ("pikachu pal") è il set.
    if (q.numero == null && !q.famiglia && sigleInTesta.length) {
        q.codici = q.codici.filter(c => !sigleInTesta.includes(c));
        q.nome = pulisci(tutte.filter(x => parole.includes(x) || sigleInTesta.includes(x.toUpperCase()))) || null;
        return q;
    }
    q.nome = pulisci(parole) || null;
    // "mew 8" può essere il set MEW n. 8 oppure un Mew col numero 8: si cercano tutti e due.
    // "mew ex 232" (il set MEW non arriva a 232): se nel set non c'è niente, si riprova come nome.
    if (q.codici.length && q.numero != null && !q.famiglia && sigleScritte.length === q.codici.length && sigleScritte.every(x => /^[A-Za-z]+$/.test(x))) {
        q.alternativa = pulisci(tutte) || null;
        q.alternativaSempre = !parole.length;
    }
    // Preciso = basta a indicare una carta sola: "svi 054", "mcd16 8", "boo24 pal 050", ma anche
    // "boo pal 050" e "ba a42" (famiglia + set d'origine o icona + numero, senza sapere l'anno).
    const dellaFamiglia = q.famiglia ? q.codici.filter(c => (indice.famiglie[q.famiglia] || []).includes(c)) : [];
    const origine = q.famiglia ? q.codici.filter(c => !dellaFamiglia.includes(c)) : [];
    q.serie = origine.length === 1 ? origine[0] : null;
    q.preciso = q.numero != null && (q.famiglia
        ? (dellaFamiglia.length === 1 || !!q.serie || !!q.icona)
        : q.codici.length === 1);
    return q;
}

function _selSiglePerCodici(codici, linguaSet, indice) {
    const sigle = [];
    codici.forEach(c => {
        const voci = indice.codici.get(c) || [];
        const dellaLingua = voci.filter(v => v.lingua === linguaSet);
        (dellaLingua.length ? dellaLingua : voci).forEach(v => sigle.push(v.sigla));
    });
    return sigle;
}

// ───────────────────────── carte del catalogo ─────────────────────────

function _selNumeroTesto(numero, uscita, sigla) {
    const s = String(sigla || '').split('@')[0];
    // Su Cardmarket il numero ha tre cifre dai set di metà 2021 in poi (CRE 045); prima no (HS 72),
    // e mai per McDonald's e Trainer Kit.
    const treCifre = uscita && String(uscita) >= '2021-06-01' && !/^(?:MCD|TK|B\d)/.test(s);
    return treCifre ? String(numero).padStart(3, '0') : String(numero);
}

function _selEtichettaVariante(variante) {
    const v = String(variante || '');
    if (!v || v === 'normale' || v === 'reverse') return '';
    if (v === 'reverse-pokeball') return 'Poké Ball';
    if (v === 'reverse-masterball') return 'Master Ball';
    return v.replace(/^(?:normale|reverse)-/, '').replace(/-/g, ' ');
}

function _selCarta(r) {
    const siglaVista = String(r.sigla || '').split('@')[0];
    const numeroTesto = _selNumeroTesto(r.numero, r.data_uscita, r.sigla);
    const link = r.cardmarket_url || (r.cardmarket_id ? 'https://www.cardmarket.com/it/Pokemon/Products?idProduct=' + r.cardmarket_id : null);
    return {
        sigla: r.sigla, siglaVista, numero: r.numero, numeroTesto, variante: r.variante || 'normale',
        nome: r.nome || '', immagine: r.immagine || null, link,
        setNome: r.set_nome || siglaVista, lingua: r.lingua || 'INT',
        base: r.base !== false, versioni: r.versioni || 1, carteBase: r.carte_base ?? null,
        // la stessa carta può esserci più volte (mazzi diversi dei WCD, holo e non holo delle PPS): V1, V2…
        versione: _selEtichettaVariante(r.variante) || ((/-V(\d+)-[^/]*$/.exec(r.cardmarket_url || '') || [])[1] ? 'V' + /-V(\d+)-[^/]*$/.exec(r.cardmarket_url)[1] : ''),
        codice: r.codice || null,      // masterset promo: "PAL 050" in BOO24, "A42" in BA24
    };
}

function _selCodiceVisibile(c) {
    if (c.codice) return `${c.siglaVista} · ${c.codice}`;
    return `${c.siglaVista} · ${c.numeroTesto}${c.carteBase ? '/' + c.carteBase : ''}`;
}

// Il testo che va in coda: nome + codice come lo scriveresti a mano (serve se il link manca).
function _selTestoCoda(c) {
    return `${c.nome ? c.nome + ' ' : ''}${c.siglaVista} ${c.codice || c.numeroTesto}`.trim();
}

async function _selChiama(parametri) {
    if (_selSpento || typeof catalogoCerca !== 'function') return { carte: [], trovate: 0, errore: true };
    const { data, error } = await catalogoCerca(parametri);
    if (error) {
        // funzione non ancora sul DB (sql/132): si spegne e non si riprova a ogni tasto
        if (error.code === 'PGRST202' || error.code === '42883' || /catalogo_cerca/.test(error.message || '')) _selSpento = true;
        console.error('[selettore carte] ricerca nel catalogo:', error.message);
        return { carte: [], trovate: 0, errore: true };
    }
    const righe = data || [];
    return { carte: righe.map(_selCarta), trovate: righe.length ? Number(righe[0].trovate) || righe.length : 0, errore: false };
}

function _selChiaveCodice(codice) {
    return String(codice || '').toUpperCase().replace(/[\s\-_]/g, '').replace(/^(.*?)0*(\d+)$/, '$1$2');
}

// q = quello che esce da _selLeggiTesto (o dal modulo di Indovino); linguaRiga = IT, EN, JP…
async function _selEsegui(q, linguaRiga, indice, { limite = 12 } = {}) {
    const linguaSet = _SEL_LINGUA_SET[String(linguaRiga || '').toUpperCase()] || 'INT';
    const esito = { carte: [], trovate: 0, errore: false, fuoriCatalogo: null, poco: false, sigle: null };
    let sigle = null;
    let serie = null;
    if (q.famiglia) {
        // "mcd 8" cerca in tutti i McDonald's; "mcd16 8" solo in quello scritto
        const tutta = indice.famiglie[q.famiglia] || [];
        if (!tutta.length) { esito.fuoriCatalogo = q.famiglia; return esito; }
        const scritti = tutta.filter(c => q.codici.includes(c));
        sigle = _selSiglePerCodici(scritti.length ? scritti : tutta, linguaSet, indice);
        // quello che resta è il set d'origine della carta ("pal" in "boo pal 050")
        const origine = q.codici.filter(c => !tutta.includes(c));
        if (origine.length === 1) serie = origine[0];
    } else if (q.codici.length) {
        sigle = _selSiglePerCodici(q.codici, linguaSet, indice);
    }
    const haNome = !!(q.nome && q.nome.replace(/\s/g, '').length >= 2);
    if (!sigle && !haNome && !(q.numero != null && q.totale != null)) { esito.poco = true; return esito; }
    const parametri = {
        nome: q.nome || null, numero: q.numero, sigle,
        lingue: sigle ? null : [linguaSet], totale: q.totale, limite, serie,
    };
    const primo = await _selChiama(parametri);
    esito.carte = primo.carte; esito.trovate = primo.trovate; esito.errore = primo.errore; esito.sigle = sigle;
    // Battle Academy: "a42" è lettera del mazzo + numero; il DB cerca il numero, qui si tiene la lettera giusta
    if (q.icona) {
        esito.carte = esito.carte.filter(c => _selChiaveCodice(c.codice) === _selChiaveCodice(q.icona));
        esito.trovate = esito.carte.length;
    }
    if (q.alternativa && !primo.errore && (q.alternativaSempre || !primo.carte.length)) {
        const secondo = await _selChiama({ nome: q.alternativa, numero: q.numero, sigle: null, lingue: [linguaSet], totale: null, limite: 6 });
        const gia = new Set(esito.carte.map(c => c.sigla + '|' + c.numero + '|' + c.variante));
        const nuove = secondo.carte.filter(c => !gia.has(c.sigla + '|' + c.numero + '|' + c.variante));
        esito.carte = esito.carte.concat(nuove);
        esito.trovate += nuove.length;
        esito.alternative = nuove.length;
    }
    return esito;
}

// Codice preciso ("svi 054") e una sola carta di quel set con quel numero: è lei. Le versioni con
// una pagina Cardmarket loro (Poké Ball, timbri) e le carte trovate "per nome" non contano.
function _selUnicaPrecisa(esito) {
    if (!esito || !esito.q || !esito.q.preciso || esito.errore) return null;
    const cercate = esito.sigle || [];
    const basi = esito.carte.filter(c => c.base && cercate.includes(c.sigla));
    return basi.length === 1 ? basi[0] : null;
}

// ───────────────────────── pezzi di pagina ─────────────────────────

function _selMiniaturaHtml(immagine, larghezza) {
    const src = immagine && typeof _urlImmagineVisualizzabile === 'function' ? _urlImmagineVisualizzabile(immagine, larghezza || 160) : null;
    const vuota = '<span class="sel-mini-vuota" aria-hidden="true"><i></i><b></b><i></i></span>';
    if (!src) return `<span class="sel-mini">${vuota}</span>`;
    return `<span class="sel-mini"><img src="${src}" alt="" loading="lazy" onerror="this.parentNode.classList.add('sel-mini-rotta'); this.remove();">${vuota}</span>`;
}

function _selTesseraHtml(c, i, { scelta = false, azione = '_selScegliDaPannello' } = {}) {
    const linguaSet = c.lingua && c.lingua !== 'INT' ? ` · ${c.lingua}` : '';
    return `
        <button type="button" class="sel-carta${i === 0 && c.base ? ' sel-top' : ''}${scelta ? ' sel-scelta' : ''}" onclick="${azione}(${i})" aria-pressed="${scelta ? 'true' : 'false'}">
            ${_selMiniaturaHtml(c.immagine, 160)}
            <span class="sel-testo">
                <b>${escapeHtml(c.nome || '(senza nome)')}</b>
                <span class="sel-cod">${escapeHtml(_selCodiceVisibile(c))}</span>
                <span class="sel-set">${escapeHtml(c.setNome)}${escapeHtml(linguaSet)}</span>
                ${c.versione ? `<span class="sel-versione">versione ${escapeHtml(c.versione)}</span>` : ''}
                ${c.link ? '' : '<span class="sel-nolink">senza link: la cerca l\'estensione dal codice</span>'}
            </span>
        </button>`;
}

function _selInput(tr) { return tr ? tr.querySelector('.ins-td-nome input') : null; }
function _selLinguaRiga(tr) { return tr?.querySelector('td:nth-child(2) select')?.value || 'IT'; }
function _selRigheDati() { return [...document.querySelectorAll('#entryTableBody tr:not(.ins-sugg-riga)')]; }

function _selChiudiPannello() {
    document.querySelectorAll('#entryTableBody tr.ins-sugg-riga').forEach(r => r.remove());
    document.querySelectorAll('#entryTableBody tr.ins-con-pannello').forEach(r => r.classList.remove('ins-con-pannello'));
}

function _selRigaDelPannello() {
    const pannello = document.querySelector('#entryTableBody tr.ins-sugg-riga');
    return pannello ? pannello.previousElementSibling : null;
}

function _selAggiornaScelta(tr) {
    const box = tr ? tr.querySelector('.ins-scelta') : null;
    if (!box) return;
    const e = tr._selEsito;
    const aperto = tr.classList.contains('ins-con-pannello');
    if (tr.dataset.blocco || !e || aperto || !e.carte.length || !_selInput(tr).value.trim()) { box.innerHTML = ''; return; }
    box.innerHTML = `<button type="button" onclick="selApriSuggerimenti(this)"><i class="fa-solid fa-layer-group"></i> ${e.trovate} cart${e.trovate === 1 ? 'a possibile' : 'e possibili'} · scegli</button>`;
}

function _selMostraPannello(tr, esito) {
    if (!tr || !tr.isConnected || tr.dataset.blocco) return;
    _selChiudiPannello();
    const testo = esito.testo || '';
    let corpo = '';
    let testa = '';
    if (esito.fuoriCatalogo) {
        const f = _SEL_FAMIGLIE[esito.fuoriCatalogo];
        testa = `<span>Le carte <b>${escapeHtml(f ? f.lungo : esito.fuoriCatalogo)}</b> non sono ancora nel catalogo: salvala così e la cerca l'estensione.</span>`;
    } else if (esito.errore || esito.poco) {
        return;
    } else if (!esito.carte.length) {
        testa = `<span>Nessuna carta nel catalogo per “${escapeHtml(testo)}”. Puoi salvarla lo stesso: la cerca l'estensione.</span>`;
    } else {
        const unica = !!_selUnicaPrecisa(esito);
        testa = `<span><b>${esito.trovate} cart${esito.trovate === 1 ? 'a' : 'e'} nel catalogo</b> per “${escapeHtml(testo)}” · ${unica ? 'Invio (o esci dal campo) e la prima si blocca da sola' : 'clicca quella giusta per bloccarla'}</span>`;
        corpo = `<div class="sel-griglia">${esito.carte.map((c, i) => _selTesseraHtml(c, i)).join('')}</div>${esito.trovate > esito.carte.length ? `<div class="sel-altre">Ce ne sono altre ${esito.trovate - esito.carte.length}: aggiungi il numero o la sigla del set per restringere.</div>` : ''}`;
    }
    const riga = document.createElement('tr');
    riga.className = 'ins-sugg-riga';
    riga.innerHTML = `
        <td colspan="10" class="ins-sugg-td">
            <div class="ins-sugg" onmousedown="_selUltimoTocco = Date.now()" ontouchstart="_selUltimoTocco = Date.now()">
                <div class="ins-sugg-testa">
                    ${testa}
                    <span class="ins-sugg-azioni">
                        <button type="button" class="sel-aiuto" onclick="selApriIndovinoDaRiga()"><i class="fa-regular fa-circle-question"></i> Non la trovo, aiutami</button>
                        <button type="button" class="sel-chiudi" onclick="selChiudiSuggerimenti()" aria-label="Chiudi i suggerimenti"><i class="fa-solid fa-xmark"></i></button>
                    </span>
                </div>
                ${corpo}
            </div>
        </td>`;
    tr.after(riga);
    tr.classList.add('ins-con-pannello');
    _selRigheDati().forEach(_selAggiornaScelta);
}

function selChiudiSuggerimenti() {
    _selChiudiPannello();
    _selRigheDati().forEach(_selAggiornaScelta);
}

function selApriSuggerimenti(btn) {
    const tr = btn.closest('tr');
    if (tr && tr._selEsito) _selMostraPannello(tr, tr._selEsito);
}

// ───────────────────────── ricerca della riga ─────────────────────────

async function _selAggiornaRiga(tr, { mostra = true } = {}) {
    if (_selSpento || !tr || !tr.isConnected || tr.dataset.blocco) return null;
    if (typeof _tipoInserimento !== 'undefined' && _tipoInserimento === 'sealed') return null;
    const input = _selInput(tr);
    if (!input) return null;
    const testo = input.value.trim();
    if (testo.length < 2) {
        tr._selEsito = null;
        tr._selGiro = (tr._selGiro || 0) + 1;
        if (_selRigaDelPannello() === tr) _selChiudiPannello();
        _selAggiornaScelta(tr);
        return null;
    }
    const lingua = _selLinguaRiga(tr);
    const chiave = lingua + '|' + testo.toLowerCase();
    if (tr._selEsito && tr._selEsito.chiave === chiave) {
        if (mostra) _selMostraPannello(tr, tr._selEsito);
        return tr._selEsito;
    }
    const giro = (tr._selGiro = (tr._selGiro || 0) + 1);
    const indice = await _selCaricaSigle();
    const q = _selLeggiTesto(testo, indice);
    const esito = await _selEsegui(q, lingua, indice);
    if (tr._selGiro !== giro || !tr.isConnected || tr.dataset.blocco) return null;   // nel frattempo hai scritto altro
    esito.chiave = chiave; esito.testo = testo; esito.q = q;
    tr._selEsito = esito;
    if (mostra && document.activeElement === input) _selMostraPannello(tr, esito);
    else _selAggiornaScelta(tr);
    selRiepilogo();
    return esito;
}

// Chiamata da handleEntryInput quando cambia il nome/codice di una riga.
function selAlScrivere(input) {
    const tr = input.closest('tr');
    if (!tr || _selSpento) return;
    clearTimeout(tr._selTimer);
    tr._selTimer = setTimeout(() => { _selAggiornaRiga(tr); }, _SEL_ATTESA_MS);
}

// Chiamata quando cambia la lingua della riga: i set giapponesi/coreani/cinesi sono a parte.
function selAlCambioLingua(tr) {
    if (!tr || _selSpento || tr.dataset.blocco) return;
    clearTimeout(tr._selTimer);
    tr._selTimer = setTimeout(() => { _selAggiornaRiga(tr, { mostra: _selRigaDelPannello() === tr }); }, 60);
}

function selEntraCampo(input) {
    const tr = input.closest('tr');
    if (!tr || _selSpento || tr.dataset.blocco) return;
    const aperta = _selRigaDelPannello();
    if (aperta && aperta !== tr) selChiudiSuggerimenti();
    if (tr._selEsito && input.value.trim().length >= 2) _selMostraPannello(tr, tr._selEsito);
}

// Uscendo dal campo: se hai scritto un codice preciso e nel catalogo c'è una sola carta, si blocca
// da sola (la vedi con la miniatura e "Non è questa" la sblocca).
function selLasciaCampo(input) {
    const tr = input.closest('tr');
    if (!tr || _selSpento) return;
    setTimeout(() => { _selBloccoDaSolo(tr); }, 200);
}

async function _selBloccoDaSolo(tr) {
    if (!tr.isConnected || tr.dataset.blocco || tr.dataset.selManuale) return;
    const input = _selInput(tr);
    if (!input || document.activeElement === input) return;                 // sei tornato a scrivere
    if (Date.now() - _selUltimoTocco < 600) return;                         // stai scegliendo dal pannello
    if (document.activeElement && document.activeElement.closest && document.activeElement.closest('.ins-sugg-riga, #selIndovino')) return;
    clearTimeout(tr._selTimer);
    const esito = await _selAggiornaRiga(tr, { mostra: false });
    if (!esito || !tr.isConnected || tr.dataset.blocco || document.activeElement === input) return;
    const unica = _selUnicaPrecisa(esito);
    if (unica) _selBlocca(tr, unica, { daSolo: true, testo: esito.testo });
}

// ───────────────────────── blocco della riga ─────────────────────────

function _selBloccoHtml(b) {
    return `
        ${_selMiniaturaHtml(b.immagine, 160)}
        <div class="ins-blocco-testo">
            <div class="ins-blocco-nome"><i class="fa-solid fa-lock"></i><b>${escapeHtml(b.nome || '(senza nome)')}</b>${b.daSolo ? '<span class="ins-blocco-pill">trovata dal codice</span>' : ''}</div>
            <div class="ins-blocco-cod"><span>${escapeHtml(b.codice)}</span><em>${escapeHtml(b.setNome || '')}${b.versione ? ' · versione ' + escapeHtml(b.versione) : ''}</em></div>
            ${b.daSolo ? `<div class="ins-blocco-nota">hai scritto “${escapeHtml(b.testo || '')}” · unica carta possibile, controlla la miniatura</div>` : ''}
            ${b.link ? '' : '<div class="ins-blocco-nota">senza link nel catalogo: la cerca l\'estensione dal codice</div>'}
        </div>
        <button type="button" class="ins-blocco-cambia" onclick="selSblocca(this)">${b.daSolo ? 'Non è questa' : 'Cambia'}</button>`;
}

// Disegna il blocco su una riga (anche quando la riga torna dalla bozza).
function selMostraBlocco(tr, b) {
    const cella = tr ? tr.querySelector('.ins-td-nome') : null;
    const input = _selInput(tr);
    if (!cella || !input || !b || !b.sigla) return;
    tr.dataset.blocco = JSON.stringify(b);
    tr.classList.add('ins-bloccata');
    tr.classList.toggle('ins-bloccata-sola', !!b.daSolo);
    input.value = b.testoCoda || input.value;
    let box = cella.querySelector('.ins-blocco');
    if (!box) { box = document.createElement('div'); box.className = 'ins-blocco'; input.after(box); }
    box.innerHTML = _selBloccoHtml(b);
    _selAggiornaScelta(tr);
}

function _selBlocca(tr, c, { daSolo = false, testo = '' } = {}) {
    const input = _selInput(tr);
    if (!tr || !input) return;
    const b = {
        sigla: c.sigla, numero: c.numero, variante: c.variante, nome: c.nome, immagine: c.immagine, link: c.link,
        setNome: c.setNome, codice: _selCodiceVisibile(c), versione: c.versione || '', lingua: c.lingua,
        testoCoda: _selTestoCoda(c), testo: testo || input.value.trim(), daSolo: !!daSolo,
    };
    if (_selRigaDelPannello() === tr) _selChiudiPannello();
    selMostraBlocco(tr, b);
    // una carta di un set giapponese/coreano/cinese porta la lingua della riga, se non l'hai scelta tu
    const sel = tr.querySelector('td:nth-child(2) select');
    const linguaCarta = _SEL_LINGUA_RIGA[c.lingua];
    if (sel && linguaCarta && sel.value !== linguaCarta && !sel.dataset.manuale) sel.value = linguaCarta;
    if (typeof handleEntryInput === 'function') handleEntryInput(tr.querySelector('.qty-input') || input);
    selRiepilogo();
}

function selSblocca(btn) {
    const tr = btn.closest('tr');
    const input = _selInput(tr);
    if (!tr || !input) return;
    let b = null;
    try { b = JSON.parse(tr.dataset.blocco || 'null'); } catch (_) {}
    delete tr.dataset.blocco;
    tr.dataset.selManuale = '1';           // dopo "Non è questa" la riga non si blocca più da sola
    tr.classList.remove('ins-bloccata', 'ins-bloccata-sola');
    tr.querySelector('.ins-blocco')?.remove();
    input.value = (b && b.testo) || input.value;
    tr._selEsito = null;
    if (typeof handleEntryInput === 'function') handleEntryInput(tr.querySelector('.qty-input') || input);
    input.focus();
    _selAggiornaRiga(tr);
    selRiepilogo();
}

function _selScegliDaPannello(i) {
    const tr = _selRigaDelPannello();
    const c = tr && tr._selEsito ? tr._selEsito.carte[i] : null;
    if (!tr || !c) return;
    _selBlocca(tr, c, { testo: tr._selEsito.testo });
    // avanti con la riga dopo, come con Invio
    const dopo = _selRigheDati()[_selRigheDati().indexOf(tr) + 1];
    _selInput(dopo)?.focus();
}

// Riepilogo in fondo alla tabella: quante righe sono bloccate e quante hanno ancora più carte possibili.
function selRiepilogo() {
    const el = document.getElementById('insSelRiepilogo');
    if (!el) return;
    const righe = _selRigheDati().filter(tr => (_selInput(tr)?.value || '').trim());
    const bloccate = righe.filter(tr => tr.dataset.blocco);
    const daSole = bloccate.filter(tr => tr.classList.contains('ins-bloccata-sola')).length;
    const daScegliere = righe.filter(tr => !tr.dataset.blocco && tr._selEsito && tr._selEsito.carte.length > 0).length;
    const pezzi = [];
    if (bloccate.length) pezzi.push(`<b>${bloccate.length} bloccat${bloccate.length === 1 ? 'a' : 'e'}</b>${daSole ? ` (${daSole} da sol${daSole === 1 ? 'a' : 'e'})` : ''}`);
    if (daScegliere) pezzi.push(`<b>${daScegliere}</b> con più carte possibili`);
    el.innerHTML = pezzi.join(' · ');
}

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('selIndovino')?.style.display === 'flex') { selChiudiIndovino(); return; }
    if (document.querySelector('#entryTableBody tr.ins-sugg-riga')) selChiudiSuggerimenti();
});

// ───────────────────────── Indovino la tua carta ─────────────────────────

let _selInd = null;   // stato della schermata aperta

function _selIndovinoCrea() {
    let el = document.getElementById('selIndovino');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'selIndovino';
    el.className = 'modal-overlay sel-ind-overlay';
    el.onclick = (e) => { if (e.target === el) selChiudiIndovino(); };
    el.innerHTML = `
        <div class="sel-ind" role="dialog" aria-modal="true" aria-labelledby="selIndTitolo">
            <button type="button" class="close-modal-btn" onclick="selChiudiIndovino()" aria-label="Chiudi"><i class="fa-solid fa-xmark"></i></button>
            <h3 id="selIndTitolo">Indovino la tua carta</h3>
            <p class="sel-ind-sotto">Scrivi quello che vedi sulla carta: le carte che combaciano compaiono mentre scrivi. Clicca quella giusta.</p>
            <div class="sel-ind-corpo">
                <div class="sel-ind-modulo">
                    <label for="selIndNome">Nome del Pokémon o della carta</label>
                    <input type="text" id="selIndNome" placeholder="es. Pikachu" autocomplete="off" oninput="_selIndovinoCambia()">
                    <label for="selIndSigla">Sigla del set <small>(in basso a sinistra, se c'è)</small></label>
                    <input type="text" id="selIndSigla" placeholder="es. PAL, SVI, TWM" autocomplete="off" oninput="_selIndovinoCambia()">
                    <span class="sel-ind-etichetta">Numero</span>
                    <div class="sel-ind-numero">
                        <input type="text" id="selIndNumero" inputmode="numeric" placeholder="059" aria-label="Numero della carta" autocomplete="off" oninput="_selIndovinoCambia()">
                        <span>/</span>
                        <input type="text" id="selIndTotale" inputmode="numeric" placeholder="totale (se c'è)" aria-label="Totale del set" autocomplete="off" oninput="_selIndovinoCambia()">
                    </div>
                    <span class="sel-ind-etichetta">C'è un simbolo particolare sulla carta?</span>
                    <div class="sel-ind-chip" id="selIndSimboli"></div>
                    <div class="sel-ind-aiuto" id="selIndAiuto"></div>
                    <div class="sel-ind-ba" id="selIndBA" style="display:none;">
                        <label for="selIndIcona">Numero sull'icona in basso a destra</label>
                        <input type="text" id="selIndIcona" inputmode="numeric" placeholder="42" autocomplete="off" oninput="_selIndovinoCambia()">
                        <span class="sel-ind-etichetta">Lettera del mazzo <small>(se la sai)</small></span>
                        <div class="sel-ind-chip" id="selIndMazzi"></div>
                    </div>
                    <label for="selIndLingua">Lingua</label>
                    <select id="selIndLingua" onchange="_selIndovinoCambia()"></select>
                </div>
                <div class="sel-ind-risultati">
                    <div class="sel-ind-testa" id="selIndTesta"></div>
                    <div class="sel-griglia sel-griglia-grande" id="selIndGriglia"></div>
                    <div class="sel-ind-conferma" id="selIndConferma" style="display:none;"></div>
                    <div class="sel-ind-nota">Nessuna è giusta? Togli un dato (per esempio il numero) e guarda di nuovo, oppure chiudi e lasciala com'è: la cerca l'estensione.</div>
                </div>
            </div>
        </div>`;
    document.body.appendChild(el);
    return el;
}

// opz: { testo, lingua, alScelta(carta) , alTesto(testo) }
async function selApriIndovino(opz = {}) {
    const el = _selIndovinoCrea();
    const indice = await _selCaricaSigle();
    const q = _selLeggiTesto(opz.testo || '', indice);
    _selInd = { simbolo: q.famiglia || 'nessuno', mazzo: q.icona ? q.icona[0] : '', carte: [], scelta: -1, giro: 0, alScelta: opz.alScelta || null, alTesto: opz.alTesto || null };
    document.getElementById('selIndNome').value = q.nome || '';
    document.getElementById('selIndSigla').value = q.codici.join(' ');
    document.getElementById('selIndNumero').value = q.numero != null ? String(q.numero) : '';
    document.getElementById('selIndTotale').value = q.totale != null ? String(q.totale) : '';
    document.getElementById('selIndIcona').value = q.icona ? q.icona.slice(1) : '';
    const lingue = (typeof _INS_LINGUE !== 'undefined' ? _INS_LINGUE : ['IT', 'EN', 'JP']);
    const selLingua = document.getElementById('selIndLingua');
    selLingua.innerHTML = lingue.map(l => `<option value="${l}">${l}</option>`).join('');
    selLingua.value = lingue.includes(opz.lingua) ? opz.lingua : 'IT';
    el.style.display = 'flex';
    _selIndovinoDisegnaChip();
    _selIndovinoCerca();
    setTimeout(() => document.getElementById('selIndNome')?.focus(), 50);
}

function selChiudiIndovino() {
    const el = document.getElementById('selIndovino');
    if (el) el.style.display = 'none';
    _selInd = null;
}

function _selIndovinoDisegnaChip() {
    if (!_selInd) return;
    const voci = [['nessuno', 'Nessuno'], ...Object.entries(_SEL_FAMIGLIE).map(([k, v]) => [k, v.nome])];
    document.getElementById('selIndSimboli').innerHTML = voci.map(([k, nome]) =>
        `<button type="button" class="${_selInd.simbolo === k ? 'attivo' : ''}" aria-pressed="${_selInd.simbolo === k}" onclick="_selIndovinoSimbolo('${k}')">${escapeHtml(nome)}</button>`).join('');
    document.getElementById('selIndMazzi').innerHTML = ['A', 'B', 'C', ''].map(m =>
        `<button type="button" class="${_selInd.mazzo === m ? 'attivo' : ''}" aria-pressed="${_selInd.mazzo === m}" onclick="_selIndovinoMazzo('${m}')">${m || 'Non lo so'}</button>`).join('');
    const f = _SEL_FAMIGLIE[_selInd.simbolo];
    document.getElementById('selIndAiuto').textContent = f ? f.aiuto : 'Nessun simbolo: cerco nei set normali.';
    document.getElementById('selIndBA').style.display = _selInd.simbolo === 'BA' ? '' : 'none';
}

function _selIndovinoSimbolo(k) {
    if (!_selInd) return;
    _selInd.simbolo = k;
    // le BOO esistono solo in inglese
    if (k === 'BOO') document.getElementById('selIndLingua').value = 'EN';
    _selIndovinoDisegnaChip();
    _selIndovinoCerca();
}

function _selIndovinoMazzo(m) {
    if (!_selInd) return;
    _selInd.mazzo = m;
    _selIndovinoDisegnaChip();
    _selIndovinoCerca();
}

function _selIndovinoCambia() {
    if (!_selInd) return;
    clearTimeout(_selInd.timer);
    _selInd.timer = setTimeout(_selIndovinoCerca, _SEL_ATTESA_MS);
}

function _selIndovinoCampi() {
    const v = (id) => (document.getElementById(id)?.value || '').trim();
    const num = (t) => { const n = parseInt(String(t).replace(/\D/g, ''), 10); return n > 0 ? n : null; };
    return { nome: v('selIndNome'), sigla: v('selIndSigla').toUpperCase(), numero: num(v('selIndNumero')), totale: num(v('selIndTotale')), icona: num(v('selIndIcona')), lingua: v('selIndLingua') || 'IT' };
}

// Per i simboli che il catalogo non ha ancora: il testo migliore da dare all'estensione.
function _selIndovinoTesto() {
    if (!_selInd) return '';
    const c = _selIndovinoCampi();
    const tre = (n) => (n != null ? String(n).padStart(3, '0') : '');
    const pezzi = [c.nome];
    switch (_selInd.simbolo) {
        case 'BOO': pezzi.push('boo', c.sigla, tre(c.numero)); break;
        case 'PPS': pezzi.push('pps', c.sigla, c.numero != null ? String(c.numero) : ''); break;
        case 'WCD': pezzi.push('wcd', tre(c.numero)); break;
        case 'BA':  pezzi.push('ba', c.icona != null && _selInd.mazzo ? _selInd.mazzo + c.icona : ''); break;
        case 'MFB': pezzi.push('mfb'); break;
        case 'MCD': pezzi.push('mcd', c.numero != null ? String(c.numero) : ''); break;
        case 'TK':  pezzi.push('tk', c.numero != null ? String(c.numero) : ''); break;
        default:    pezzi.push(c.sigla, c.numero != null ? String(c.numero) : '');
    }
    return pezzi.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

async function _selIndovinoCerca() {
    if (!_selInd) return;
    const stato = _selInd;
    const giro = ++stato.giro;
    const c = _selIndovinoCampi();
    const indice = await _selCaricaSigle();
    const codici = c.sigla.split(/[\s,]+/).filter(Boolean);
    const noti = codici.filter(x => indice.codici.has(x));
    const q = {
        nome: c.nome.toLowerCase().replace(/[%_\\"()\[\]]/g, ' ').replace(/\s+/g, ' ').trim() || null,
        numero: c.numero, totale: c.totale, codici: noti,
        famiglia: stato.simbolo !== 'nessuno' ? stato.simbolo : null, alternativa: null,
        icona: null,
    };
    if (stato.simbolo === 'BA' && c.icona != null) {
        q.numero = c.icona;
        if (stato.mazzo) q.icona = stato.mazzo + c.icona;
    }
    const testa = document.getElementById('selIndTesta');
    const griglia = document.getElementById('selIndGriglia');
    const conferma = document.getElementById('selIndConferma');
    let esito;
    if (codici.length && !noti.length && !q.famiglia) esito = { carte: [], trovate: 0, siglaIgnota: codici.join(' ') };
    else esito = await _selEsegui(q, c.lingua, indice, { limite: 18 });
    if (_selInd !== stato || stato.giro !== giro) return;
    stato.carte = esito.carte || [];
    stato.scelta = -1;
    conferma.style.display = 'none';
    griglia.innerHTML = '';
    const testoPerEstensione = _selIndovinoTesto();
    const bottoneTesto = stato.alTesto && testoPerEstensione
        ? `<button type="button" class="btn-secondary sel-ind-usa-testo" onclick="_selIndovinoUsaTesto()">Usa “${escapeHtml(testoPerEstensione)}” e falla cercare all'estensione</button>` : '';
    if (esito.fuoriCatalogo) {
        const f = _SEL_FAMIGLIE[esito.fuoriCatalogo];
        testa.innerHTML = `<b>Le carte ${escapeHtml(f ? f.lungo : esito.fuoriCatalogo)} non sono ancora nel catalogo.</b><span>Compila quello che sai: preparo io il testo giusto per l'estensione.</span>${bottoneTesto}`;
    } else if (esito.siglaIgnota) {
        testa.innerHTML = `<b>La sigla “${escapeHtml(esito.siglaIgnota)}” non è tra i set del catalogo.</b><span>Controlla com'è scritta, oppure toglila e cerca per nome e numero.</span>${bottoneTesto}`;
    } else if (esito.poco) {
        testa.innerHTML = '<b>Scrivi almeno il nome, oppure sigla e numero.</b>';
    } else if (esito.errore) {
        testa.innerHTML = '<b>La ricerca nel catalogo non risponde.</b><span>Riprova tra poco.</span>';
    } else if (!stato.carte.length) {
        testa.innerHTML = `<b>Nessuna carta combacia.</b><span>Togli un dato e riprova.</span>${bottoneTesto}`;
    } else {
        testa.innerHTML = `<b>${esito.trovate} cart${esito.trovate === 1 ? 'a combacia' : 'e combaciano'}</b><span>dal catalogo Bindex${esito.trovate > stato.carte.length ? ` · vedi le prime ${stato.carte.length}` : ''}</span>`;
        griglia.innerHTML = stato.carte.map((x, i) => _selTesseraHtml(x, i, { azione: '_selIndovinoScegli' })).join('');
    }
}

function _selIndovinoScegli(i) {
    if (!_selInd || !_selInd.carte[i]) return;
    _selInd.scelta = i;
    document.querySelectorAll('#selIndGriglia .sel-carta').forEach((b, n) => { b.classList.toggle('sel-scelta', n === i); b.setAttribute('aria-pressed', n === i ? 'true' : 'false'); });
    const c = _selInd.carte[i];
    const conferma = document.getElementById('selIndConferma');
    conferma.innerHTML = `<span><b>${escapeHtml(c.nome)} · ${escapeHtml(_selCodiceVisibile(c))}</b> · ${c.link ? 'va in coda col link diretto' : 'va in coda col suo codice'}</span><button type="button" class="btn-main" onclick="_selIndovinoConferma()">Usa questa carta</button>`;
    conferma.style.display = 'flex';
}

function _selIndovinoConferma() {
    if (!_selInd || _selInd.scelta < 0) return;
    const c = _selInd.carte[_selInd.scelta];
    const fatto = _selInd.alScelta;
    const lingua = _selIndovinoCampi().lingua;
    selChiudiIndovino();
    if (typeof fatto === 'function') fatto(c, lingua);
}

function _selIndovinoUsaTesto() {
    if (!_selInd) return;
    const testo = _selIndovinoTesto();
    const fatto = _selInd.alTesto;
    const lingua = _selIndovinoCampi().lingua;
    selChiudiIndovino();
    if (testo && typeof fatto === 'function') fatto(testo, lingua);
}

// "Non la trovo, aiutami" dal pannello di una riga dell'Inserimento.
function selApriIndovinoDaRiga() {
    const tr = _selRigaDelPannello();
    if (!tr) return;
    const input = _selInput(tr);
    const impostaLingua = (lingua) => {
        const sel = tr.querySelector('td:nth-child(2) select');
        if (sel && lingua && sel.value !== lingua && [...sel.options].some(o => o.value === lingua)) { sel.value = lingua; sel.dataset.manuale = '1'; }
    };
    selApriIndovino({
        testo: input.value, lingua: _selLinguaRiga(tr),
        alScelta: (c, lingua) => { if (!tr.isConnected) return; impostaLingua(lingua); _selBlocca(tr, c, { testo: input.value.trim() }); },
        alTesto: (testo, lingua) => {
            if (!tr.isConnected) return;
            impostaLingua(lingua);
            input.value = testo;
            tr.dataset.selManuale = '1';
            selChiudiSuggerimenti();
            if (typeof handleEntryInput === 'function') handleEntryInput(input);
        },
    });
}
