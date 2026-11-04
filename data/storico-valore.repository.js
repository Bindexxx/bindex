// Istantanea giornaliera del valore della collezione.

function _giornoLocaleISO(quando) {
    const d = quando || new Date();
    const mese = String(d.getMonth() + 1).padStart(2, '0');
    const giorno = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mese}-${giorno}`;
}

async function storicoValoreRegistraOggi(userId) {
    if (!userId || typeof carteReali === 'undefined') return { error: null };

    const collezione = carteReali.filter(c => c.stato === 'collezione' && !c.esclusoValore);
    const valoreTotale = collezione.reduce((tot, c) => tot + (Number(c.price) || 0) * (Number(c.qty) || 0), 0);
    const pezziTotali = collezione.reduce((tot, c) => tot + (Number(c.qty) || 0), 0);

    const oggi = _giornoLocaleISO();
    const aggiunteOggi = collezione.filter(c => c.createdAt && _giornoLocaleISO(new Date(c.createdAt)) === oggi);
    const valoreAggiunte = aggiunteOggi.reduce((tot, c) => tot + (Number(c.price) || 0) * (Number(c.qty) || 0), 0);

    const riga = {
        owner_id: userId,
        giorno: oggi,
        valore_totale: Number(valoreTotale.toFixed(2)),
        pezzi_totali: pezziTotali,
        carte_aggiunte: aggiunteOggi.length,
        valore_aggiunte: Number(valoreAggiunte.toFixed(2)),
        registrato_il: new Date().toISOString(),
    };

    const { error } = await supabaseClient
        .from('storico_valore_collezione')
        .upsert(riga, { onConflict: 'owner_id,giorno' });

    if (error) console.error('[storico valore] scrittura istantanea:', error.message);
    return { error };
}

async function storicoValoreUltimiGiorni(userId, quantiGiorni) {
    if (!userId) return { data: [], error: null };
    const limite = Math.max(2, Number(quantiGiorni) || 30);

    const { data, error } = await supabaseClient
        .from('storico_valore_collezione')
        .select('giorno, valore_totale, pezzi_totali, carte_aggiunte, valore_aggiunte')
        .eq('owner_id', userId)
        .order('giorno', { ascending: false })
        .limit(limite);

    if (error) { console.error('[storico valore] lettura:', error.message); return { data: [], error }; }
    return { data: (data || []).slice().reverse(), error: null };
}

function storicoValoreConfronta(righe) {
    if (!Array.isArray(righe) || righe.length < 2) return null;
    const prima = righe[righe.length - 2];
    const dopo = righe[righe.length - 1];

    const variazione = Number(dopo.valore_totale) - Number(prima.valore_totale);
    const daAggiunte = Number(dopo.valore_aggiunte) || 0;
    const pezziInMeno = (Number(prima.pezzi_totali) || 0) - (Number(dopo.pezzi_totali) || 0);

    const residuo = variazione - daAggiunte;
    const rimozioniSospette = pezziInMeno > 0;

    return {
        giornoPrima: prima.giorno,
        giornoDopo: dopo.giorno,
        variazione,
        daAggiunte,
        carteAggiunte: Number(dopo.carte_aggiunte) || 0,
        daPrezzi: rimozioniSospette ? null : residuo,
        rimozioniSospette,
        pezziInMeno: rimozioniSospette ? pezziInMeno : 0,
    };
}
