// ── data/wip.repository.js ─────────────────────────────────────────────
// Fase 11 (2026-09-13). Caricato sia su index.html (sola lettura: ogni
// utente deve sapere se qualcosa è in manutenzione) sia su admin.html
// (lettura+scrittura). RLS fa il resto — un utente normale che provasse
// a chiamare wipCrea/wipDisattiva otterrebbe comunque un errore RLS lato
// server, questo file non è l'unica barriera.
//
// Dipende da: supabaseClient.

async function wipListaAttivi() {
    return supabaseClient.from('work_in_progress').select('*').eq('attivo', true);
}

// Solo admin.html: elenco completo (anche i disattivati, per riattivarli
// senza doverli ricreare da zero).
async function wipListaTutti() {
    return supabaseClient.from('work_in_progress').select('*').order('attivato_il', { ascending: false });
}

async function wipCrea({ targetTipo, targetId, messaggio, adminId }) {
    // upsert sul vincolo UNIQUE(target_tipo, target_id): riattivare un
    // bersaglio già esistente aggiorna la riga invece di fallire per
    // doppione — più comodo per l'admin (stesso target, nuovo messaggio,
    // un solo click) senza dover prima cercare e disattivare quello vecchio.
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
