// ── data/storico-valore.repository.js ────────────────────────────────────
// Istantanea giornaliera del valore della collezione (migration 36).
// Un file nuovo e piccolo invece di allargare uno dei repository esistenti:
// e' l'unico consumatore della tabella e resta isolato.
//
// SCELTA: SCRITTURA DAL CLIENT, NON UN LAVORO PIANIFICATO SUL SERVER.
// Supabase permetterebbe un cron, ma qui non serve e costerebbe di piu':
// il valore va salvato solo se l'utente esiste e usa l'app, e il calcolo
// parte da carteReali che e' gia' in memoria nel browser — zero query per
// ottenerlo. Conseguenza da accettare: se nessuno apre l'app per tre
// giorni, quei tre giorni non hanno riga. Il grafico li salta e la cosa e'
// corretta: non sono giorni "a valore zero", sono giorni non misurati.
//
// L'UNICITA' LA FA IL DATABASE. Il vincolo (owner_id, giorno) della
// migration 36 rende impossibile la riga doppia: cinque dispositivi che
// aprono l'app lo stesso giorno aggiornano la stessa riga. Nessun registro
// "gia' scritto oggi" da tenere lato client — stessa lezione delle
// notifiche missioni.

// Giorno locale in formato YYYY-MM-DD. NON toISOString().slice(0,10): quello
// converte in UTC e per chi apre l'app dopo le 23 (ora italiana, ora legale)
// scriverebbe la riga del giorno dopo, sfasando tutto il grafico di un
// giorno per meta' delle sere.
function _giornoLocaleISO(quando) {
    const d = quando || new Date();
    const mese = String(d.getMonth() + 1).padStart(2, '0');
    const giorno = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mese}-${giorno}`;
}

// Scrive (o riscrive) l'istantanea di oggi. Fire-and-forget: un errore qui
// non deve mai fermare l'avvio dell'app.
// I quattro numeri e il perche' sono spiegati nella migration 36: il totale
// da solo non basta a distinguere "i prezzi sono saliti" da "ho comprato".
async function storicoValoreRegistraOggi(userId) {
    if (!userId || typeof carteReali === 'undefined') return { error: null };

    const collezione = carteReali.filter(c => c.stato === 'collezione');
    const valoreTotale = collezione.reduce((tot, c) => tot + (Number(c.price) || 0) * (Number(c.qty) || 0), 0);
    const pezziTotali = collezione.reduce((tot, c) => tot + (Number(c.qty) || 0), 0);

    // Carte entrate oggi: confronto sul giorno LOCALE, come sopra.
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

    // upsert sul vincolo di unicita': la riga del giorno viene riscritta,
    // cosi' il valore del giorno e' quello dell'ULTIMA apertura e non della
    // prima. Aprire l'app alle 9 e alle 21 lascerebbe altrimenti il valore
    // delle 9.
    const { error } = await supabaseClient
        .from('storico_valore_collezione')
        .upsert(riga, { onConflict: 'owner_id,giorno' });

    if (error) console.error('[storico valore] scrittura istantanea:', error.message);
    return { error };
}

// Ultime N giornate, dalla piu' vecchia alla piu' recente (ordine di
// lettura del grafico). Il filtro owner_id e' ridondante con la RLS ma
// esplicito: rende la query leggibile e non dipende dalla policy per
// essere corretta.
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

// Scompone la differenza fra le ultime due giornate MISURATE (non fra ieri
// e oggi: se ieri l'app non e' stata aperta, ieri non esiste e il confronto
// giusto e' con l'ultimo giorno che esiste davvero).
//
// Restituisce null quando le giornate sono meno di due: e' il caso del
// primo giorno di vita della tabella, in cui non c'e' NIENTE da
// confrontare. Il widget deve dirlo, non mostrare uno zero che sembra
// "nessuna variazione".
function storicoValoreConfronta(righe) {
    if (!Array.isArray(righe) || righe.length < 2) return null;
    const prima = righe[righe.length - 2];
    const dopo = righe[righe.length - 1];

    const variazione = Number(dopo.valore_totale) - Number(prima.valore_totale);
    const daAggiunte = Number(dopo.valore_aggiunte) || 0;
    const pezziInMeno = (Number(prima.pezzi_totali) || 0) - (Number(dopo.pezzi_totali) || 0);

    // Il residuo e' il movimento dei prezzi. ATTENZIONE (limite noto,
    // documentato anche nella migration 36): una carta rimossa finisce qui
    // dentro e verrebbe letta come "i prezzi sono scesi". Per questo si
    // guardano i pezzi: se sono calati, il residuo NON e' attendibile come
    // movimento di prezzo e il widget deve dirlo invece di inventarsi una
    // discesa dei prezzi che non c'e' stata.
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
