// Lavori in corso (manutenzione): lettura per tutti, scrittura solo admin (RLS).

async function wipListaAttivi() {
    return supabaseClient.from('work_in_progress').select('*').eq('attivo', true);
}

async function wipListaTutti() {
    return supabaseClient.from('work_in_progress').select('*').order('attivato_il', { ascending: false });
}

async function wipCrea({ targetTipo, targetId, messaggio, adminId }) {
    return supabaseClient.from('work_in_progress').upsert({
        target_tipo: targetTipo,
        target_id: targetId,
        messaggio,
        attivo: true,
        attivato_da: adminId,
        attivato_il: new Date().toISOString(),
    }, { onConflict: 'target_tipo,target_id' });
}

async function wipDisattiva(id) {
    return supabaseClient.from('work_in_progress').update({ attivo: false }).eq('id', id);
}

async function wipRiattiva(id) {
    return supabaseClient.from('work_in_progress').update({ attivo: true, attivato_il: new Date().toISOString() }).eq('id', id);
}
