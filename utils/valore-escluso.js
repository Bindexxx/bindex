// Quali carte non contano nel valore della collezione.

function calcolaIdsEsclusiValore(carteCollezione, binders, righeBinderCarte) {
    const esclusi = new Set();
    const escluso = new Map();
    const locationEscluse = new Map();
    (binders || []).forEach(b => {
        escluso.set(String(b.id), !!b.escludi_valore_collezione);
        if (b.tipo === 'location' && b.location_valore != null) locationEscluse.set(b.location_valore, !!b.escludi_valore_collezione);
    });
    if (![...escluso.values()].some(Boolean)) return esclusi;

    const perCarta = new Map();
    (righeBinderCarte || []).forEach(r => {
        const k = String(r.carta_id);
        if (!perCarta.has(k)) perCarta.set(k, []);
        perCarta.get(k).push(String(r.binder_id));
    });

    (carteCollezione || []).forEach(c => {
        const flag = [locationEscluse.get(c.location) === true];
        (perCarta.get(String(c.id)) || []).forEach(bid => {
            flag.push(escluso.get(bid) === true);
        });
        if (flag.every(Boolean)) esclusi.add(String(c.id));
    });
    return esclusi;
}
