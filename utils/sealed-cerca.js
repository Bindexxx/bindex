// Sealed fase C (26/11/2026): come si legge quello che scrivi per cercare un prodotto nel catalogo
// sealed (tabella sealed_catalogo, sql/151: nome italiano, slug inglese, categoria, espansione).
// Solo funzioni pure: la ricerca vera è in data/sealed-catalogo.repository.js, la pagina in
// ui/selettore-sealed.ui.js. Provate in tools/test-sito/prova-sealed.js.

// Le categorie di Cardmarket che il catalogo conosce, nell'ordine dei filtri "Tipo".
const SEALED_CATEGORIE = [
    { id: 'Boosters', corto: 'Buste', lungo: 'Busta' },
    { id: 'Booster-Boxes', corto: 'Box', lungo: 'Box di buste' },
    { id: 'Elite-Trainer-Boxes', corto: 'ETB', lungo: 'Set Allenatore Fuoriclasse' },
    { id: 'Blisters', corto: 'Blister', lungo: 'Blister' },
    { id: 'Tins', corto: 'Tin', lungo: 'Tin' },
    { id: 'Box-Sets', corto: 'Collezioni', lungo: 'Collezione' },
    { id: 'Theme-Decks', corto: 'Mazzi', lungo: 'Mazzo' },
    { id: 'Trainer-Kits', corto: 'Kit', lungo: 'Kit allenatore' },
];

// Parole che non servono a trovare niente ("box di buste di scintille").
const _SEALED_VUOTE = new Set(['di', 'del', 'della', 'dello', 'dei', 'degli', 'delle', 'da', 'e', 'ed', 'il', 'lo', 'la', 'le', 'i', 'gli',
    'un', 'una', 'uno', 'con', 'per', 'in', 'the', 'of', 'and', 'a', 'an', 'pokemon', 'tcg']);

// Parole che vogliono dire un tipo di prodotto o un nome che sul catalogo è scritto per intero.
// Ogni parola vale se c'è nel nome o nello slug (uno dei "testi", * = qualunque cosa in mezzo)
// OPPURE se il prodotto è di uno di quei tipi. Le parole che non sono qui valgono solo come testo.
const _SEALED_SINONIMI = {
    etb: { testi: ['elite*trainer*box', 'allenatore*fuoriclasse'], categorie: ['Elite-Trainer-Boxes'] },
    etbs: { testi: ['elite*trainer*box', 'allenatore*fuoriclasse'], categorie: ['Elite-Trainer-Boxes'] },
    fuoriclasse: { testi: ['fuoriclasse', 'elite*trainer'], categorie: ['Elite-Trainer-Boxes'] },
    bb: { testi: ['booster*box', 'box*di*buste'], categorie: ['Booster-Boxes'] },
    busta: { testi: ['bust'], categorie: ['Boosters'] },
    buste: { testi: ['bust'], categorie: ['Boosters'] },
    bustina: { testi: ['bust'], categorie: ['Boosters'] },
    bustine: { testi: ['bust'], categorie: ['Boosters'] },
    pacchetto: { testi: ['bust', 'booster'], categorie: ['Boosters'] },
    booster: { testi: ['booster', 'bust'], categorie: [] },
    boosters: { testi: ['booster', 'bust'], categorie: [] },
    blister: { testi: ['blister'], categorie: ['Blisters'] },
    tin: { testi: [], categorie: ['Tins'] },
    tins: { testi: [], categorie: ['Tins'] },
    latta: { testi: [], categorie: ['Tins'] },
    scatola: { testi: ['box'], categorie: ['Tins', 'Box-Sets'] },
    mazzo: { testi: ['mazz', 'deck'], categorie: ['Theme-Decks'] },
    mazzi: { testi: ['mazz', 'deck'], categorie: ['Theme-Decks'] },
    deck: { testi: ['deck', 'mazz'], categorie: ['Theme-Decks'] },
    decks: { testi: ['deck', 'mazz'], categorie: ['Theme-Decks'] },
    kit: { testi: ['kit'], categorie: ['Trainer-Kits'] },
    collezione: { testi: ['collezion', 'collection'], categorie: ['Box-Sets'] },
    collezioni: { testi: ['collezion', 'collection'], categorie: ['Box-Sets'] },
    collection: { testi: ['collection', 'collezion'], categorie: ['Box-Sets'] },
    upc: { testi: ['ultra*premium*collection'], categorie: [] },
    spc: { testi: ['super*premium*collection'], categorie: [] },
    pc: { testi: ['pokemon*center'], categorie: [] },
};

// minuscolo, senza accenti; apostrofi e punti spariscono ("Ethan's" → "ethans", "10.6" → "106"),
// tutto il resto che non è lettera o cifra diventa spazio
function sealedNormalizza(testo) {
    return String(testo == null ? '' : testo)
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/['’`.]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

// Come Cardmarket scrive lo slug di un nome (minuscolo): "Zorua & Zoroark ex" → "zorua-zoroark-ex".
function sealedSlugDaNome(nome) {
    return sealedNormalizza(nome).replace(/\s+/g, '-');
}

// Lo slug di un prodotto scritto come parole: "Prismatic-Evolutions-Booster" → "prismatic evolutions booster".
function _sealedParoleSlug(slug) {
    return sealedNormalizza(String(slug || '').replace(/-/g, ' '));
}

// Le parole utili di un testo, nell'ordine, senza doppioni.
function sealedParole(testo) {
    const viste = new Set();
    return sealedNormalizza(testo).split(' ').filter(p => {
        if (!p || viste.has(p) || _SEALED_VUOTE.has(p)) return false;
        if (p.length < 2 && !/^\d$/.test(p)) return false;
        viste.add(p);
        return true;
    });
}

// La parola senza l'ultima vocale, così singolare e plurale si trovano a vicenda
// ("prismatica" → "prismatic": Prismatiche e Prismatic-Evolutions; "scintilla" → Scintille).
function _sealedRadice(p) {
    return p.length >= 5 && /[aeiou]$/.test(p) && !/\d/.test(p) ? p.slice(0, -1) : p;
}

// Da quello che hai scritto alla ricerca: un gruppo per parola, e il prodotto deve soddisfare tutti
// i gruppi. Un gruppo vale se il nome o lo slug contiene uno dei testi, o il prodotto è di uno dei
// tipi, o è di una delle espansioni il cui nome ha quella parola (espansioni = [{ id, nome }]).
function sealedLeggiTesto(testo, espansioni) {
    const parole = sealedParole(testo);
    const elenco = Array.isArray(espansioni) ? espansioni : [];
    const gruppi = parole.map(p => {
        const sin = _SEALED_SINONIMI[p];
        const radice = _sealedRadice(p);
        const testi = sin ? [...new Set([radice, ...sin.testi])] : [radice];
        const categorie = sin ? sin.categorie.slice() : [];
        // tin/tins: la parola da sola si trova in mezzo a troppe altre ("destined"): conta solo il tipo
        if (sin && sin.testi.length === 0) testi.splice(0, testi.length);
        const espIds = p.length >= 3
            ? elenco.filter(e => (' ' + sealedNormalizza(e.nome) + ' ').includes(' ' + radice)).map(e => e.id).slice(0, 40)
            : [];
        return { parola: p, radice, testi, categorie, espansioni: espIds };
    });
    return { parole, gruppi };
}

// La chiave per ricordare una ricerca già fatta.
function sealedChiaveRicerca(testo, filtri) {
    const f = filtri || {};
    return sealedParole(testo).join(' ') + '|' + (f.categoria || '') + '|' + (f.espansione || '');
}

// Quanto un prodotto somiglia a quello che hai scritto (più alto = più in alto nell'elenco).
// p = { nome, slug, categoria, idEspansione }; q = risultato di sealedLeggiTesto.
function sealedPunteggio(p, q) {
    const paroleNome = sealedNormalizza(p.nome).split(' ');
    const paroleSlug = _sealedParoleSlug(p.slug).split(' ');
    const tutte = paroleNome.concat(paroleSlug);
    let punti = 0;
    (q && q.gruppi ? q.gruppi : []).forEach(g => {
        if (tutte.includes(g.parola)) punti += 4;
        else if (tutte.some(w => w.startsWith(g.radice || g.parola))) punti += 3;
        else if (g.categorie.includes(p.categoria)) punti += 3;
        else if (g.espansioni.includes(p.idEspansione)) punti += 2;
        else punti += 1;
    });
    // a parità, i prodotti "base" (nome più corto) prima delle versioni speciali e delle confezioni da 10
    punti -= Math.min(2, paroleNome.length / 12);
    if (/\b(case|display|confezione di \d+)\b/i.test(p.nome) || /-Case$/.test(p.slug || '')) punti -= 0.5;
    return punti;
}

function sealedOrdina(prodotti, q) {
    return (prodotti || [])
        .map(p => ({ p, punti: sealedPunteggio(p, q) }))
        .sort((a, b) => b.punti - a.punti || String(a.p.nome).localeCompare(String(b.p.nome), 'it'))
        .map(x => x.p);
}

// Le espansioni presenti nei risultati, le più frequenti prima (per il filtro "Espansione").
function sealedEspansioniDei(prodotti) {
    const conta = new Map();
    (prodotti || []).forEach(p => {
        if (p.idEspansione == null) return;
        const c = conta.get(p.idEspansione) || { id: p.idEspansione, nome: p.espansione || '', quanti: 0 };
        c.quanti++;
        conta.set(p.idEspansione, c);
    });
    return [...conta.values()].sort((a, b) => b.quanti - a.quanti || a.nome.localeCompare(b.nome, 'it'));
}

// Import CSV: il prodotto del catalogo che ha proprio quel nome (italiano come su Cardmarket, o il
// nome inglese dello slug). Più prodotti con lo stesso nome → nessuno (non si sceglie a caso).
// prodotti = righe del catalogo { nome, slug, url, ... }; restituisce una Map nome CSV → prodotto.
function sealedAbbinaNomi(nomi, prodotti) {
    const perNome = new Map();
    const perSlug = new Map();
    const metti = (mappa, chiave, p) => {
        if (!chiave) return;
        const gia = mappa.get(chiave);
        mappa.set(chiave, gia && gia.url !== p.url ? 'doppio' : p);
    };
    (prodotti || []).forEach(p => {
        metti(perNome, sealedNormalizza(p.nome), p);
        metti(perSlug, String(p.slug || '').toLowerCase(), p);
    });
    const esito = new Map();
    (nomi || []).forEach(n => {
        const a = perNome.get(sealedNormalizza(n));
        const b = perSlug.get(sealedSlugDaNome(n));
        let scelto = null;
        if (a && a !== 'doppio') scelto = a;
        else if (!a && b && b !== 'doppio') scelto = b;
        if (scelto && b && b !== 'doppio' && b.url !== scelto.url) scelto = null;
        if (scelto) esito.set(n, scelto);
    });
    return esito;
}

// Dal link di un prodotto alla sua categoria ("…/Products/Booster-Boxes/…" → "Booster-Boxes").
function sealedCategoriaDaUrl(url) {
    const m = String(url || '').match(/\/Products\/([^/?#]+)\//);
    return m ? m[1] : null;
}

function sealedCategoriaCorta(id) {
    const c = SEALED_CATEGORIE.find(x => x.id === id);
    return c ? c.lungo : (id || '');
}

// Il link del prodotto con la lingua, come lo salva l'estensione (_aggiungiLinguaSealed in
// background.js): il controllo prezzi apre proprio questo link.
const _SEALED_ID_LINGUA = { IT: '5', EN: '1', DE: '3', FR: '2', ES: '4', PT: '8', JP: '7', KOR: '10', CHN: '6', 'CHN-T': '11', IND: '16', THAI: '17', RU: '9' };
function sealedUrlConLingua(url, lingua) {
    if (!url) return url;
    const base = String(url).split('?')[0];
    const id = _SEALED_ID_LINGUA[String(lingua || 'IT').toUpperCase().trim()];
    return id ? `${base}?language=${id}` : base;
}
