// Libreria dei set e lettura delle sigle.

const _ballLIBRERIA_MANUALE = {
    ASC: { nome: 'Ascesa Eroica', base: 217, totale: 295 }
};

let _ballLIBRERIA_SET = Object.assign(
    {},
    _ballLIBRERIA_MANUALE,
    (typeof CARDSYNC_SET_LIBRARY !== 'undefined' && CARDSYNC_SET_LIBRARY) ? CARDSYNC_SET_LIBRARY : {}
);

async function _ballCaricaLibreriaDaDb() {
    if (typeof setEspansioniLeggiTutte !== 'function') return;
    try {
        const righe = await setEspansioniLeggiTutte();
        if (!righe || !righe.length) return;

        const daDb = {};
        righe.forEach(r => {
            if (!r.sigla || !r.carte_totali) return;
            daDb[String(r.sigla).toUpperCase()] = {
                nome: r.nome || r.sigla,
                base: r.carte_base ?? null,
                totale: r.carte_totali,
                lingua: r.lingua || 'INT'
            };
        });
        _ballLIBRERIA_SET = Object.assign({}, _ballLIBRERIA_SET, daDb);
        renderWidgetHome();
    } catch (e) {
        console.error('Libreria set da DB:', e);
    } finally {
        if (typeof setAvviaMotore === 'function') setAvviaMotore();
    }
}

function _ballSetBase(testa) {
    const mX = testa.match(/^X([A-Z]{2,6})(-.*)?$/);
    if (mX) return { set: mX[1] + (mX[2] || ''), variante: 'ball' };

    const mPPS = testa.match(/^PPS\d+-(.+)$/);
    if (mPPS) return { set: mPPS[1], variante: 'stampata' };

    const mBOO = testa.match(/^BOO\d+-(.+)$/);
    if (mBOO) return { set: mBOO[1], variante: 'halloween' };

    return { set: testa, variante: null };
}

const _ballALIAS_TESTA = {
    'SM': 'SMP',
    'TR': 'RO',
    'FL': 'UNB',
    'TM': 'TRI',
    'NG': 'N1',
    'NDI': 'N2',
    'NR': 'N3',
    'NDE': 'N4',
    'UD': 'UND',
    'CL': 'COL',
    'TK2-M': 'TK2M',
    'TK10-A': 'TK10A',
    'M24': 'MCD24',
};

function _ballSetBaseConAlias(testa) {
    return _ballSetBase(_ballALIAS_TESTA[testa] || testa);
}

// Set in altre lingue (sql/131): sigla "CODICE@LINGUA" (es. "SV2A@JP", "SV2A@KOR", "CBB2C@CHN"),
// perché lo stesso codice esiste in più lingue. Una carta va nel set della sua lingua; se manca,
// in quello internazionale; se manca anche quello, nel primo set con quel codice in un'altra lingua.
const _BALL_LINGUE_SET = { JP: 'JP', JA: 'JP', KOR: 'KOR', KO: 'KOR', CHN: 'CHN', 'CHN-S': 'CHN', 'CHN-T': 'CHN-T' };
const _BALL_ETICHETTE_LINGUA = { INT: 'Internazionali', JP: 'Giapponesi', KOR: 'Coreane', CHN: 'Cinesi', 'CHN-T': 'Cinesi tradizionali' };

function _ballSiglaPerLingua(set, linguaCarta) {
    if (!set) return set;
    const lib = _ballLIBRERIA_SET || {};
    const l = _BALL_LINGUE_SET[String(linguaCarta || '').toUpperCase().trim()];
    if (l && lib[set + '@' + l]) return set + '@' + l;
    if (lib[set]) return set;
    for (const alt of ['JP', 'KOR', 'CHN', 'CHN-T']) if (lib[set + '@' + alt]) return set + '@' + alt;
    return set;
}

function _ballSiglaVisibile(sigla) {
    return String(sigla || '').split('@')[0];
}

function _ballLinguaSet(sigla) {
    const info = (_ballLIBRERIA_SET || {})[sigla];
    if (info && info.lingua) return info.lingua;
    const i = String(sigla || '').indexOf('@');
    return i > 0 ? String(sigla).slice(i + 1) : 'INT';
}

function _ballLeggiCodice(codice) {
    if (!codice) return null;
    const t = String(codice).trim().toUpperCase();

    const m = t.match(/^(.*?)[\s\-_]*(\d{1,3})$/);
    if (m) {
        const testa = m[1].trim().replace(/^[\s\-_]+|[\s\-_]+$/g, '').replace(/[\s\-_]+/g, '-');
        if (testa && /[A-Z]/.test(testa)) {
            const b = _ballSetBaseConAlias(testa);
            return { set: b.set, variante: b.variante, numero: parseInt(m[2], 10) };
        }
    }

    if (/^[A-Z][A-Z\-]{0,7}$/.test(t)) {
        const b = _ballSetBaseConAlias(t);
        return { set: b.set, variante: b.variante, numero: null };
    }
    return null;
}
