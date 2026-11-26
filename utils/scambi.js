// Scambi tra utenti: conti puri (valore, saldo, pareggio, scambio suggerito). Nessun DOM, nessun Supabase.
// Tutti i conti sono in centesimi interi, così 0,10 + 0,20 fa 0,30 e non 0,30000000000000004.

function scambiCentesimi(euro) {
    const n = Number(euro);
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

// Valore in centesimi di voci { prezzo, quantita } (quantità mancante = 1).
function scambiValoreVoci(voci) {
    return (voci || []).reduce((t, v) => t + scambiCentesimi(v && v.prezzo) * Math.max(1, Math.floor(Number(v && v.quantita) || 1)), 0);
}

// Saldo visto da me: quanto do (oggetti + euro), quanto ricevo, differenza (> 0: ricevo di più). In euro.
function scambiSaldo(dai, ricevi, euroDai, euroRicevi) {
    const valDai = scambiValoreVoci(dai) + scambiCentesimi(euroDai);
    const valRicevi = scambiValoreVoci(ricevi) + scambiCentesimi(euroRicevi);
    return { dai: valDai / 100, ricevi: valRicevi / 100, differenza: (valRicevi - valDai) / 100 };
}

// Euro che pareggiano gli oggetti: li mette chi riceve meno valore. Uno dei due è sempre 0.
function scambiPareggio(dai, ricevi) {
    const d = scambiValoreVoci(ricevi) - scambiValoreVoci(dai);
    return d > 0 ? { euroDai: d / 100, euroRicevi: 0 } : { euroDai: 0, euroRicevi: -d / 100 };
}

// Tutte le somme possibili di un elenco (al massimo 12 voci): Map somma → indici della scelta.
// A parità di somma tiene la scelta con più oggetti.
function _scambiSomme(prezzi) {
    const somme = new Map();
    const n = prezzi.length;
    for (let maschera = 1; maschera < (1 << n); maschera++) {
        let somma = 0;
        const indici = [];
        for (let i = 0; i < n; i++) if (maschera & (1 << i)) { somma += prezzi[i]; indici.push(i); }
        const prima = somme.get(somma);
        if (!prima || indici.length > prima.length) somme.set(somma, indici);
    }
    return somme;
}

// Scambio suggerito con una persona. ricevibili = cose sue che cerchi, dabili = cose tue che cerca;
// voci { chiave, prezzo, ... } (una copia ciascuna). Sceglie una parte di ognuno dei due elenchi
// con valori vicini: tra le scelte con una differenza entro max(1 €, 10% del valore più alto)
// vince quella col valore più alto (poi quella con più oggetti); se non ce n'è nessuna, quella con la
// differenza più piccola. Oltre 12 voci per parte guarda le 12 di valore più alto.
// Ritorna { ricevi, dai, valoreRicevi, valoreDai, differenza } in euro (differenza > 0: ricevi di più),
// oppure null se uno dei due elenchi è vuoto.
function scambiSuggerito(ricevibili, dabili) {
    const prendi = (voci) => (voci || [])
        .filter(Boolean)
        .map(v => ({ v, c: Math.max(0, scambiCentesimi(v.prezzo)) }))
        .sort((a, b) => b.c - a.c)
        .slice(0, 12);
    const R = prendi(ricevibili), D = prendi(dabili);
    if (!R.length || !D.length) return null;
    const sommeR = _scambiSomme(R.map(x => x.c));
    const sommeD = _scambiSomme(D.map(x => x.c));
    const valoriD = [...sommeD.keys()].sort((a, b) => a - b);

    // la somma di D più vicina a "obiettivo" (ricerca binaria sull'elenco ordinato)
    const vicine = (obiettivo) => {
        let lo = 0, hi = valoriD.length - 1;
        while (lo < hi) { const m = (lo + hi) >> 1; if (valoriD[m] < obiettivo) lo = m + 1; else hi = m; }
        return [valoriD[lo - 1], valoriD[lo]].filter(x => x !== undefined);
    };
    // la somma di D più alta che non supera "tetto"
    const sotto = (tetto) => {
        let lo = 0, hi = valoriD.length - 1, trovato;
        while (lo <= hi) { const m = (lo + hi) >> 1; if (valoriD[m] <= tetto) { trovato = valoriD[m]; lo = m + 1; } else hi = m - 1; }
        return trovato;
    };

    let migliore = null;
    const meglio = (a, b, nOggetti) => {
        const diff = Math.abs(a - b);
        const tolleranza = Math.max(100, Math.round(Math.max(a, b) * 0.1));
        const cand = { a, b, diff, totale: a + b, nOggetti, entro: diff <= tolleranza };
        if (!migliore) { migliore = cand; return; }
        if (cand.entro !== migliore.entro) { if (cand.entro) migliore = cand; return; }
        if (cand.entro) {
            if (cand.totale > migliore.totale || (cand.totale === migliore.totale && (cand.nOggetti > migliore.nOggetti || (cand.nOggetti === migliore.nOggetti && cand.diff < migliore.diff)))) migliore = cand;
        } else if (cand.diff < migliore.diff || (cand.diff === migliore.diff && cand.totale > migliore.totale)) {
            migliore = cand;
        }
    };
    for (const [a, indiciR] of sommeR) {
        const tetto = a + Math.max(100, Math.round(a * 0.1));
        const candidati = new Set(vicine(a));
        const alta = sotto(tetto);
        if (alta !== undefined) candidati.add(alta);
        candidati.forEach(b => meglio(a, b, indiciR.length + sommeD.get(b).length));
    }
    const ricevi = sommeR.get(migliore.a).map(i => R[i].v);
    const dai = sommeD.get(migliore.b).map(i => D[i].v);
    return { ricevi, dai, valoreRicevi: migliore.a / 100, valoreDai: migliore.b / 100, differenza: (migliore.a - migliore.b) / 100 };
}
