// ── ui/import-csv.ui.js ──────────────────────────────────────────────────
// RESTYLE BINDEX FASE 8e: "Importa da CSV" (Impostazioni → Dati).
// Legge un file CSV, mostra un riepilogo, e dopo conferma invia le righe
// valide alla coda unica 'coda_carte' (queueInsertRighe) a blocchi da 100 —
// stessa identica via dell'inserimento manuale, quindi le carte vengono poi
// elaborate dall'estensione come sempre. Nessuna chiamata Supabase qui.
//
// Colonne riconosciute (maiuscole/minuscole indifferenti, nomi alternativi
// accettati): nome, lingua, condizione, qty, reverse, first_ed,
// sigillata_originale, nota, location, destinazione. Solo "nome" è
// obbligatoria. Separatore , o ; riconosciuto da solo.
//
// Dipende da: authGetUserId (data/auth.repository.js), queueInsertRighe
// (data/queue.repository.js).

const _IMPORT_CSV_BLOCCO = 100;
const _IMPORT_CSV_MAX_RIGHE = 2000;
const _IMPORT_CSV_ALIAS = {
    nome: ['nome', 'name', 'carta', 'codice'],
    lingua: ['lingua', 'lang', 'language'],
    condizione: ['condizione', 'cond', 'condition'],
    qty: ['qty', 'quantita', 'quantità', 'quantity', 'q'],
    reverse: ['reverse', 'rev'],
    first_ed: ['first_ed', 'first', 'prima_edizione', 'firsted'],
    sigillata_originale: ['sigillata_originale', 'sigillata', 'sig'],
    nota: ['nota', 'note', 'notes'],
    location: ['location', 'ubicazione', 'posizione'],
    destinazione: ['destinazione', 'dest'],
};

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

function _importCsvRigheDb(tabella, userId) {
    const intest = tabella[0].map(h => h.trim().toLowerCase());
    const idx = {};
    Object.keys(_IMPORT_CSV_ALIAS).forEach(k => {
        idx[k] = intest.findIndex(h => _IMPORT_CSV_ALIAS[k].includes(h));
    });
    if (idx.nome < 0) return { errore: 'Nel file manca la colonna "nome".' };
    const val = (r, k) => (idx[k] >= 0 ? (r[idx[k]] || '').trim() : '');
    const righeDb = [];
    let scartate = 0, corrette = 0;
    tabella.slice(1).forEach(r => {
        const nome = val(r, 'nome');
        if (!nome) { scartate++; return; }
        let lingua = val(r, 'lingua').toUpperCase();
        if (!['IT', 'EN', 'KOR', 'JP'].includes(lingua)) { if (lingua) corrette++; lingua = 'IT'; }
        let cond = val(r, 'condizione').toUpperCase();
        if (!['NM', 'EX', 'GD'].includes(cond)) { if (cond) corrette++; cond = 'NM'; }
        const qtyGrezza = val(r, 'qty');
        const qty = Math.max(1, parseInt(qtyGrezza, 10) || 1);
        if (qtyGrezza && String(qty) !== qtyGrezza) corrette++;
        const destGrezza = val(r, 'destinazione').toLowerCase();
        const loc = val(r, 'location');
        righeDb.push({
            owner_id: userId,
            nome,
            lingua,
            condizione: cond,
            reverse: _importCsvBool(val(r, 'reverse')),
            first_ed: _importCsvBool(val(r, 'first_ed')),
            sigillata_originale: _importCsvBool(val(r, 'sigillata_originale')),
            nota: val(r, 'nota') || null,
            location: (loc && loc !== '?') ? loc : null,
            destinazione: destGrezza === 'wishlist' ? 'wishlist' : 'collezione',
            qty,
        });
    });
    return { righeDb, scartate, corrette };
}

async function importaCsvDaFile(input) {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    const esito = document.getElementById('importCsvEsito');
    const msg = (t) => { if (esito) esito.textContent = t; };
    try {
        const userId = await authGetUserId();
        if (!userId) return;
        const tabella = _importCsvParse(await file.text());
        if (tabella.length < 2) { msg('Il file è vuoto o ha solo l\'intestazione.'); return; }
        const r = _importCsvRigheDb(tabella, userId);
        if (r.errore) { msg(r.errore); return; }
        if (r.righeDb.length === 0) { msg('Nessuna riga valida nel file.'); return; }
        if (r.righeDb.length > _IMPORT_CSV_MAX_RIGHE) {
            msg(`Il file ha ${r.righeDb.length} righe: il massimo per volta è ${_IMPORT_CSV_MAX_RIGHE}. Dividilo in più file.`);
            return;
        }
        const pezzi = r.righeDb.reduce((t, x) => t + x.qty, 0);
        const dettagli = [];
        if (r.scartate) dettagli.push(`${r.scartate} senza nome (saltate)`);
        if (r.corrette) dettagli.push(`${r.corrette} valori non validi sostituiti con quelli predefiniti`);
        if (!confirm(`Inviare ${r.righeDb.length} righe (${pezzi} pezzi) alla coda?` +
            (dettagli.length ? `\n\n${dettagli.join('\n')}` : '') +
            '\n\nVerranno elaborate dall\'estensione come le carte inserite a mano.')) {
            msg('Importazione annullata.');
            return;
        }
        let inviate = 0;
        for (let i = 0; i < r.righeDb.length; i += _IMPORT_CSV_BLOCCO) {
            msg(`Invio in corso… ${inviate}/${r.righeDb.length}`);
            const blocco = r.righeDb.slice(i, i + _IMPORT_CSV_BLOCCO);
            const { error } = await queueInsertRighe(blocco);
            if (error) {
                msg(`❌ Errore dopo ${inviate} righe inviate: ${error.message}. Le righe già inviate sono in coda: non reimportare tutto il file.`);
                return;
            }
            inviate += blocco.length;
        }
        msg(`✅ ${inviate} righe inviate in coda. Apri l'estensione per farle elaborare.`);
    } catch (e) {
        console.error('[import-csv]', e);
        msg('❌ Impossibile leggere il file: ' + (e.message || e));
    }
}
