// Missioni: letture che alimentano MOTORE_MISSIONI.raccogliDati().

async function missioniCarteAggiuntePeriodo(userId, inizioISO, fineISO) {
    return supabaseClient.from('carte').select('id', { count: 'exact', head: true })
        .eq('owner_id', userId).eq('stato', 'collezione')
        .gte('created_at', inizioISO).lt('created_at', fineISO);
}

async function missioniCarteTotali(userId) {
    return supabaseClient.from('carte').select('id', { count: 'exact', head: true })
        .eq('owner_id', userId).eq('stato', 'collezione');
}

async function missioniValoreCollezione(userId) {
    const { data, error } = await supabaseClient.from('carte').select('prezzo')
        .eq('owner_id', userId).eq('stato', 'collezione');
    if (error) return { data: 0, error };
    const totale = (data || []).reduce((s, r) => s + (Number(r.prezzo) || 0), 0);
    return { data: totale, error: null };
}

async function missioniDoppioniTotali(userId) {
    return supabaseClient.from('carte').select('id', { count: 'exact', head: true })
        .eq('owner_id', userId).eq('stato', 'collezione').gt('qty', 1);
}

async function missioniLocationDistinte(userId) {
    const { data, error } = await supabaseClient.from('carte').select('location')
        .eq('owner_id', userId).eq('stato', 'collezione').not('location', 'is', null);
    if (error) return { data: 0, error };
    return { data: new Set((data || []).map(r => r.location)).size, error: null };
}

async function missioniLocationAggiuntaPeriodo(userId, inizioISO, fineISO) {
    return supabaseClient.from('carte').select('id', { count: 'exact', head: true })
        .eq('owner_id', userId).eq('stato', 'collezione').not('location', 'is', null)
        .gte('created_at', inizioISO).lt('created_at', fineISO);
}

async function missioniCarteStessaEspansioneMax(userId) {
    const { data, error } = await supabaseClient.from('carte').select('codice')
        .eq('owner_id', userId).eq('stato', 'collezione');
    if (error) return { data: 0, error };
    const conteggi = {};
    (data || []).forEach(r => {
        const letto = typeof _ballLeggiCodice === 'function' ? _ballLeggiCodice(r.codice) : null;
        const set = letto ? letto.set : null;
        if (!set) return;
        conteggi[set] = (conteggi[set] || 0) + 1;
    });
    const max = Object.values(conteggi).reduce((m, n) => Math.max(m, n), 0);
    return { data: max, error: null };
}

async function missioniWishlistTotale(userId) {
    return supabaseClient.from('wishlist').select('id', { count: 'exact', head: true }).eq('owner_id', userId);
}

async function missioniWishlistObiettiviRaggiunti(userId) {
    const { data, error } = await supabaseClient.from('wishlist').select('prezzo, prezzo_obiettivo')
        .eq('owner_id', userId).not('prezzo_obiettivo', 'is', null);
    if (error) return { count: 0, error };
    const conteggio = (data || []).filter(r => Number(r.prezzo) > 0 && Number(r.prezzo) <= Number(r.prezzo_obiettivo)).length;
    return { count: conteggio, error: null };
}

async function missioniPrezziAggiornatiPeriodo(userId, tabella, inizioISO, fineISO) {
    const { data: carte, error: errCarte } = await supabaseClient.from('carte').select('id')
        .eq('owner_id', userId).eq('stato', 'collezione');
    if (errCarte) return { data: 0, error: errCarte };
    const ids = (carte || []).map(c => c.id);
    if (ids.length === 0) return { data: 0, error: null };

    const DIMENSIONE_BLOCCO = 500;
    const blocchi = [];
    for (let i = 0; i < ids.length; i += DIMENSIONE_BLOCCO) blocchi.push(ids.slice(i, i + DIMENSIONE_BLOCCO));

    const risultati = await Promise.all(blocchi.map(blocco =>
        supabaseClient.from('storico_prezzi').select('carta_id')
            .eq('tabella', tabella).in('carta_id', blocco)
            .gte('registrato_il', inizioISO).lt('registrato_il', fineISO)
    ));
    const distinti = new Set();
    for (const { data, error } of risultati) {
        if (error) return { data: 0, error };
        (data || []).forEach(r => distinti.add(r.carta_id));
    }
    return { data: distinti.size, error: null };
}

async function missioniPrezziScadutiTotale(userId) {
    const { data: carte, error: errCarte } = await supabaseClient.from('carte').select('id')
        .eq('owner_id', userId).eq('stato', 'collezione');
    if (errCarte) return { count: 0, error: errCarte };
    const ids = (carte || []).map(c => c.id);
    if (ids.length === 0) return { count: 0, error: null };

    const DIMENSIONE_BLOCCO = 500;
    const blocchi = [];
    for (let i = 0; i < ids.length; i += DIMENSIONE_BLOCCO) blocchi.push(ids.slice(i, i + DIMENSIONE_BLOCCO));

    const risultati = await Promise.all(blocchi.map(blocco => storicoPrezziQuery('carte', blocco)));
    const ultimoPerCarta = {};
    for (const { data, error } of risultati) {
        if (error) return { count: 0, error };
        (data || []).forEach(r => {
            if (!ultimoPerCarta[r.carta_id] || r.registrato_il > ultimoPerCarta[r.carta_id]) {
                ultimoPerCarta[r.carta_id] = r.registrato_il;
            }
        });
    }

    const sogliaMs = SOGLIA_GIORNI_PREZZO_SCADUTO * 24 * 60 * 60 * 1000;
    const adesso = Date.now();
    const scadute = ids.filter(id => {
        const ultimo = ultimoPerCarta[id];
        if (!ultimo) return true;
        return (adesso - new Date(ultimo).getTime()) > sogliaMs;
    }).length;

    return { count: scadute, error: null };
}

async function missioniMatchAttiviTotale(userId) {
    const [{ data: scambio, error: e1 }, { data: wishlist, error: e2 }] = await Promise.all([
        trovaMatch('trova_match_scambio_wishlist', userId),
        trovaMatch('trova_match_wishlist_scambio', userId),
    ]);
    if (e1 || e2) return { data: 0, error: e1 || e2 };
    return { data: (scambio || []).length + (wishlist || []).length, error: null };
}

async function missioniMatchTrovatiTotale(userId) {
    return supabaseClient.from('activity_log').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('action', 'match_trovato');
}

async function missioniBinderPubblicatiPeriodo(userId, inizioISO, fineISO) {
    return supabaseClient.from('binders').select('id', { count: 'exact', head: true })
        .eq('owner_id', userId).eq('stato_pubblicazione', 'pubblico')
        .gte('created_at', inizioISO).lt('created_at', fineISO);
}

async function missioniErroriCodaVuota(userId) {
    const { count, error } = await correzioniManualiConta(userId);
    if (error) return { data: false, error };
    return { data: (count || 0) === 0, error: null };
}

async function missioniCodaErroriAzzerataOggi(userId) {
    const { data, error } = await userSettingsGet(userId);
    if (error) return { data: false, error };

    let storico = {};
    try { storico = (data && data.dafare_risolti) ? JSON.parse(data.dafare_risolti) : {}; } catch (_) { storico = {}; }

    const voce = storico['coda_errori'];
    if (!voce || !voce.risoltoIl) return { data: false, error: null };

    const oggi = new Date();
    const d = new Date(voce.risoltoIl);
    const risoltoOggi = d.getFullYear() === oggi.getFullYear() && d.getMonth() === oggi.getMonth() && d.getDate() === oggi.getDate();
    return { data: risoltoOggi, error: null };
}

async function missioniBinderVisitatiDistintiTotale(userId) {
    const { data, error } = await supabaseClient.from('activity_log').select('details')
        .eq('user_id', userId).eq('action', 'binder_pubblico_visitato');
    if (error) return { data: 0, error };
    const distinti = new Set((data || []).map(r => r.details && r.details.binderId).filter(Boolean));
    return { data: distinti.size, error: null };
}

async function missioniAccessoOggi(userId) {
    const oggiInizio = new Date(); oggiInizio.setHours(0, 0, 0, 0);
    const { count, error } = await supabaseClient.from('activity_log')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('action', 'accesso').gte('created_at', oggiInizio.toISOString());
    if (error) return { data: false, error };
    return { data: (count || 0) > 0, error: null };
}

function _missioniGiornoLocale(d) {
    const mese = String(d.getMonth() + 1).padStart(2, '0');
    const giorno = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mese}-${giorno}`;
}

async function missioniAccessiTotali(userId) {
    const { data, error } = await _selectTuttePagine(
        supabaseClient.from('activity_log').select('created_at')
            .eq('user_id', userId).eq('action', 'accesso')
            .order('created_at', { ascending: false })
    );
    if (error) return { count: 0, error };
    const giorni = new Set((data || []).map(r => _missioniGiornoLocale(new Date(r.created_at))));
    return { count: giorni.size, error: null };
}

async function missioniGiorniConsecutivi(userId) {
    const { data, error } = await _selectTuttePagine(
        supabaseClient.from('activity_log')
            .select('created_at').eq('user_id', userId).eq('action', 'accesso')
            .order('created_at', { ascending: false })
    );
    if (error) return { data: 0, error };

    const giorniUnici = new Set((data || []).map(r => _missioniGiornoLocale(new Date(r.created_at))));
    let cursore = new Date(); cursore.setHours(0, 0, 0, 0);
    if (!giorniUnici.has(_missioniGiornoLocale(cursore))) {
        cursore.setDate(cursore.getDate() - 1);
    }
    let streak = 0;
    while (giorniUnici.has(_missioniGiornoLocale(cursore))) {
        streak++;
        cursore.setDate(cursore.getDate() - 1);
    }
    return { data: streak, error: null };
}

async function missioniRicercheEseguitePeriodo(userId, inizioISO, fineISO) {
    return supabaseClient.from('activity_log').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('action', 'ricerca_eseguita')
        .gte('created_at', inizioISO).lt('created_at', fineISO);
}

async function missioniBinderAperturePeriodo(userId, inizioISO, fineISO) {
    return missioniAperturaWidgetPeriodo(userId, 'binder', inizioISO, fineISO);
}
async function missioniBinderApertureTotale(userId) {
    return supabaseClient.from('activity_log').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('action', 'apertura_widget').eq('details->>widget', 'binder');
}

async function missioniAperturaWidgetPeriodo(userId, widgetId, inizioISO, fineISO) {
    return supabaseClient.from('activity_log').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('action', 'apertura_widget').eq('details->>widget', widgetId)
        .gte('created_at', inizioISO).lt('created_at', fineISO);
}

async function missioniDettaglioCartaAperturePeriodo(userId, inizioISO, fineISO) {
    return supabaseClient.from('activity_log').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('action', 'apertura_dettaglio_carta')
        .gte('created_at', inizioISO).lt('created_at', fineISO);
}

async function missioniQrGeneratoPeriodo(userId, inizioISO, fineISO) {
    return supabaseClient.from('activity_log').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('action', 'qr_generato')
        .gte('created_at', inizioISO).lt('created_at', fineISO);
}

async function missioniBinderPubblicoVisitatoPeriodo(userId, inizioISO, fineISO) {
    return supabaseClient.from('activity_log').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('action', 'binder_pubblico_visitato')
        .gte('created_at', inizioISO).lt('created_at', fineISO);
}

async function missioniDettaglioCartaTopValorePeriodo(userId, inizioISO, fineISO) {
    return supabaseClient.from('activity_log').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('action', 'apertura_dettaglio_carta').eq('details->>origine', 'top_valore')
        .gte('created_at', inizioISO).lt('created_at', fineISO);
}

async function missioniDettaglioCarteDistintePeriodo(userId, inizioISO, fineISO) {
    const { data, error } = await supabaseClient.from('activity_log').select('details')
        .eq('user_id', userId).eq('action', 'apertura_dettaglio_carta')
        .gte('created_at', inizioISO).lt('created_at', fineISO);
    if (error) return { data: 0, error };
    const distinte = new Set((data || []).map(r => r.details && r.details.cartaId).filter(Boolean));
    return { data: distinte.size, error: null };
}

async function missioniDettaglioCartaVecchiaPeriodo(userId, inizioISO, fineISO) {
    return supabaseClient.from('activity_log').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('action', 'apertura_dettaglio_carta').eq('details->>vecchia', 'true')
        .gte('created_at', inizioISO).lt('created_at', fineISO);
}

async function missioniEstensioneFunzioneUsataPeriodo(userId, inizioISO, fineISO) {
    return supabaseClient.from('activity_log').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('action', 'estensione_funzione_usata')
        .gte('created_at', inizioISO).lt('created_at', fineISO);
}

async function missioniWidgetDistintiPeriodo(userId, inizioISO, fineISO) {
    const { data, error } = await supabaseClient.from('activity_log').select('details')
        .eq('user_id', userId).eq('action', 'apertura_widget')
        .gte('created_at', inizioISO).lt('created_at', fineISO);
    if (error) return { data: 0, error };
    const distinti = new Set((data || []).map(r => r.details && r.details.widget).filter(Boolean));
    return { data: distinti.size, error: null };
}

async function missioniCompletateTotale(userId) {
    return supabaseClient.from('missioni_completate').select('missione_id', { count: 'exact', head: true })
        .eq('owner_id', userId);
}

async function missioniCompletatePeriodo(userId, periodo) {
    return supabaseClient.from('missioni_completate').select('missione_id', { count: 'exact', head: true })
        .eq('owner_id', userId).eq('periodo', periodo);
}

async function missioniCompletateIdRangeTemporale(userId, inizioISO, fineISO) {
    return supabaseClient.from('missioni_completate').select('missione_id')
        .eq('owner_id', userId).gte('completato_il', inizioISO).lt('completato_il', fineISO);
}

async function missioniCompletateIdPerPeriodi(userId, periodi) {
    return supabaseClient.from('missioni_completate').select('missione_id, periodo')
        .eq('owner_id', userId).in('periodo', periodi);
}

async function missioniTraguardiRiscossiIdTotale(userId) {
    return supabaseClient.from('traguardi_riscossi').select('traguardo_id, riscosso_il').eq('owner_id', userId);
}

async function ricompenseSaldo(userId, tipo) {
    const { data, error } = await supabaseClient.from('inventario_ricompense')
        .select('quantita').eq('owner_id', userId).eq('tipo', tipo);
    if (error) return { data: 0, error };
    const saldo = (data || []).reduce((s, r) => s + (Number(r.quantita) || 0), 0);
    return { data: saldo, error: null };
}
