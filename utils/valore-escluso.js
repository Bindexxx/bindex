// ── utils/valore-escluso.js ──────────────────────────────────────────────
// Funzione pura (nessun accesso a Supabase/DOM): decide quali carte NON
// contano nei totali di valore della collezione, in base all'interruttore
// "Non aggiungere il valore di queste carte alla mia collezione" dei binder
// (colonna binders.escludi_valore_collezione, sql/95).
//
// REGOLA (confermata da Claudio, 2026-10-10): una carta e' esclusa solo se
// TUTTI i binder che la contengono sono esclusi. Appartenenza:
//   - binder tipo 'location': carte.location === binder.location_valore
//     (la location conta SEMPRE come un binder della carta; se la riga del
//     binder-location non esiste, quel "binder" e' non escluso);
//   - binder 'extra' e 'scambio': righe di binder_carte (binder_id, carta_id).
// Il binder 'wishlist' non c'entra (la wishlist non e' mai nel valore).
//
// carteCollezione: [{ id, location }]; binders: righe di 'binders';
// righeBinderCarte: [{ binder_id, carta_id }]. Ritorna Set di id (stringhe).
function calcolaIdsEsclusiValore(carteCollezione, binders, righeBinderCarte) {
    const esclusi = new Set();
    const escluso = new Map();      // binder_id -> bool
    const locationEscluse = new Map(); // location_valore -> bool
    (binders || []).forEach(b => {
        escluso.set(String(b.id), !!b.escludi_valore_collezione);
        if (b.tipo === 'location' && b.location_valore != null) locationEscluse.set(b.location_valore, !!b.escludi_valore_collezione);
    });
    if (![...escluso.values()].some(Boolean)) return esclusi; // nessun binder escluso: niente da calcolare

    const perCarta = new Map(); // carta_id -> [binder_id,...] (extra/scambio)
    (righeBinderCarte || []).forEach(r => {
        const k = String(r.carta_id);
        if (!perCarta.has(k)) perCarta.set(k, []);
        perCarta.get(k).push(String(r.binder_id));
    });

    (carteCollezione || []).forEach(c => {
        // Conta sempre la location come binder (false se manca la riga).
        const flag = [locationEscluse.get(c.location) === true];
        (perCarta.get(String(c.id)) || []).forEach(bid => {
            // binder_id sconosciuto (riga non letta): trattato come non escluso, per prudenza.
            flag.push(escluso.get(bid) === true);
        });
        if (flag.every(Boolean)) esclusi.add(String(c.id));
    });
    return esclusi;
}
