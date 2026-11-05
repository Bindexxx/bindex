// Scaffali dei prodotti sealed: chiamate a Supabase.

async function scaffaliList(userId) {
    return supabaseClient.from('scaffali').select('id, nome, tipo, stato_pubblicazione, condivisibile').eq('owner_id', userId).order('created_at');
}

async function scaffaleGarantisciVetrina(userId) {
    const { data: esistente, error: errSelect } = await supabaseClient
        .from('scaffali').select('*').eq('owner_id', userId).eq('tipo', 'vetrina').maybeSingle();
    if (errSelect) return { data: null, error: errSelect };
    if (esistente) return { data: esistente, error: null };
    return supabaseClient.from('scaffali').insert({ owner_id: userId, tipo: 'vetrina', nome: 'Vetrina' }).select().single();
}

async function scaffaleInsert(userId, nome) {
    return supabaseClient.from('scaffali').insert({ owner_id: userId, tipo: 'libero', nome }).select().single();
}

async function scaffaleDelete(userId, scaffaleId) {
    return supabaseClient.from('scaffali').delete().eq('owner_id', userId).eq('id', scaffaleId);
}

async function scaffaleImpostaPubblicazione(userId, scaffaleId, pubblico) {
    return supabaseClient.from('scaffali')
        .update({ stato_pubblicazione: pubblico ? 'pubblico' : 'privato', condivisibile: pubblico })
        .eq('owner_id', userId).eq('id', scaffaleId);
}

async function scaffaleProdottiList(userId, scaffaleId) {
    return supabaseClient.from('scaffale_prodotti').select('prodotto_id, ordine, aggiunta_il').eq('owner_id', userId).eq('scaffale_id', scaffaleId);
}

async function scaffaleProdottiImpostaOrdine(userId, scaffaleId, prodottoIdsInOrdine) {
    for (let i = 0; i < prodottoIdsInOrdine.length; i++) {
        const { error } = await supabaseClient.from('scaffale_prodotti').update({ ordine: i + 1 })
            .eq('owner_id', userId).eq('scaffale_id', scaffaleId).eq('prodotto_id', prodottoIdsInOrdine[i]);
        if (error) return { error };
    }
    return { error: null };
}

async function scaffaleProdottoAggiungi(userId, scaffaleId, prodottoId) {
    return supabaseClient.from('scaffale_prodotti').insert({ owner_id: userId, scaffale_id: scaffaleId, prodotto_id: prodottoId });
}

async function scaffaleProdottoRimuovi(userId, scaffaleId, prodottoId) {
    return supabaseClient.from('scaffale_prodotti').delete().eq('owner_id', userId).eq('scaffale_id', scaffaleId).eq('prodotto_id', prodottoId);
}

async function scaffaleProdottiTuttiUtente(userId) {
    return supabaseClient.from('scaffale_prodotti').select('scaffale_id, prodotto_id, quantita_offerta').eq('owner_id', userId);
}

async function scaffaleProdottiConteggiTutti(userId) {
    return supabaseClient.from('scaffale_prodotti').select('scaffale_id').eq('owner_id', userId);
}

async function scaffaleScambioGarantisci(userId) {
    const { data: esistente, error: errSelect } = await supabaseClient
        .from('scaffali').select('*').eq('owner_id', userId).eq('tipo', 'scambio').maybeSingle();
    if (errSelect) return { data: null, error: errSelect };
    if (esistente) return { data: esistente, error: null };

    return supabaseClient
        .from('scaffali')
        .insert({ owner_id: userId, tipo: 'scambio', nome: 'Scambio', stato_pubblicazione: 'pubblico', condivisibile: true })
        .select()
        .single();
}

function scaffaleProdottiQueryConQuantita(userId, scaffaleId) {
    return supabaseClient.from('scaffale_prodotti').select('prodotto_id, quantita_offerta').eq('owner_id', userId).eq('scaffale_id', scaffaleId);
}

async function scaffaleProdottoImpostaQuantitaScambio(userId, scaffaleId, prodottoId, quantita) {
    return supabaseClient.from('scaffale_prodotti')
        .upsert({ owner_id: userId, scaffale_id: scaffaleId, prodotto_id: prodottoId, quantita_offerta: quantita }, { onConflict: 'owner_id,scaffale_id,prodotto_id' });
}

async function scaffaliConta(userId) {
    return supabaseClient.from('scaffali').select('id', { count: 'exact', head: true }).eq('owner_id', userId);
}
