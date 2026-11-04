// Missioni: scrittura di eventi e assegnazioni.

async function missioniMatchTrovatiRegistraNuovi(userId, chiavi) {
    if (!chiavi || chiavi.length === 0) return { error: null };
    const { data, error: errLettura } = await supabaseClient.from('activity_log')
        .select('details').eq('user_id', userId).eq('action', 'match_trovato');
    if (errLettura) return { error: errLettura };
    const gia = new Set((data || []).map(r => r.details && r.details.chiave).filter(Boolean));
    const nuove = [...new Set(chiavi)].filter(c => !gia.has(c));
    if (nuove.length === 0) return { error: null };
    return supabaseClient.from('activity_log').insert(
        nuove.map(chiave => ({ user_id: userId, source: 'sito', action: 'match_trovato', details: { chiave } }))
    );
}

async function missioniAperturaWidgetRegistra(userId, widgetId) {
    return supabaseClient.from('activity_log').insert({
        user_id: userId, source: 'sito', action: 'apertura_widget', details: { widget: widgetId },
    });
}

async function missioniDettaglioCartaRegistra(userId, cartaId, origine, vecchia) {
    return supabaseClient.from('activity_log').insert({
        user_id: userId, source: 'sito', action: 'apertura_dettaglio_carta',
        details: { cartaId, origine: origine || null, vecchia: !!vecchia },
    });
}

async function missioniRicercaRegistra(userId, nomeCarta) {
    return supabaseClient.from('activity_log').insert({
        user_id: userId, source: 'sito', action: 'ricerca_eseguita', details: { nome: nomeCarta || null },
    });
}

async function missioniEstensioneFunzioneUsataRegistra(userId) {
    return supabaseClient.from('activity_log').insert({
        user_id: userId, source: 'sito', action: 'estensione_funzione_usata', details: {},
    });
}

async function missioniBinderPubblicoVisitatoRegistra(userId, binderId) {
    return supabaseClient.from('activity_log').insert({
        user_id: userId, source: 'sito', action: 'binder_pubblico_visitato',
        details: { binderId: binderId || null },
    });
}

async function missioniQrGeneratoRegistra(userId) {
    return supabaseClient.from('activity_log').insert({
        user_id: userId, source: 'sito', action: 'qr_generato', details: {},
    });
}

async function missioniAccessoRegistraOggi(userId) {
    const oggiInizio = new Date(); oggiInizio.setHours(0, 0, 0, 0);
    const { count, error: errCheck } = await supabaseClient.from('activity_log')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('action', 'accesso').gte('created_at', oggiInizio.toISOString());
    if (errCheck) return { error: errCheck };
    if ((count || 0) > 0) return { error: null };

    return supabaseClient.from('activity_log').insert({
        user_id: userId, source: 'sito', action: 'accesso', details: {},
    });
}

async function missioniInserisciCompletamento(userId, missioneId, finestra, periodo) {
    return supabaseClient.from('missioni_completate').insert({
        owner_id: userId,
        missione_id: missioneId,
        finestra,
        periodo,
        origine: 'normale',
        completato_il: new Date().toISOString(),
    });
}

async function traguardiInserisciRiscossione(userId, traguardoId) {
    return supabaseClient.from('traguardi_riscossi').insert({
        owner_id: userId,
        traguardo_id: traguardoId,
        riscosso_il: new Date().toISOString(),
    });
}

async function ricompenseInserisci(userId, tipo, riferimentoId, quantita) {
    return supabaseClient.from('inventario_ricompense').insert({
        owner_id: userId,
        tipo,
        riferimento_id: riferimentoId,
        quantita: quantita || 1,
        ottenuto_il: new Date().toISOString(),
    });
}

async function ricompensaConsumaSkip(userId, missioneId, finestra, periodo) {
    const { data: saldo, error: errSaldo } = await ricompenseSaldo(userId, 'skip_missione');
    if (errSaldo) return { error: errSaldo };
    if (saldo < 1) return { error: { message: 'Nessuno skip disponibile' } };

    const { error: errConsumo } = await supabaseClient.from('inventario_ricompense').insert({
        owner_id: userId, tipo: 'skip_missione', riferimento_id: missioneId, quantita: -1,
        ottenuto_il: new Date().toISOString(),
    });
    if (errConsumo) return { error: errConsumo };

    return supabaseClient.from('missioni_completate').insert({
        owner_id: userId, missione_id: missioneId, finestra, periodo, origine: 'skip',
        completato_il: new Date().toISOString(),
    });
}

async function missioneRiscattaCompletamento(missioneId, finestra, periodo) {
    return supabaseClient.rpc('riscatta_missione_completata', {
        p_missione_id: missioneId, p_finestra: finestra, p_periodo: periodo,
    });
}

async function traguardoRiscatta(traguardoId) {
    return supabaseClient.rpc('riscatta_traguardo', { p_traguardo_id: traguardoId });
}
