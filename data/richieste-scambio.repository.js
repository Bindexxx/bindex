// ── data/richieste-scambio.repository.js ──────────────────────────────────
// Fase 4, Step 3 (2026-09-13). Wrapper delle 6 RPC transazionali (sql/48,
// corrette in sql/49/50) + query di lettura sulle tabelle di sql/47.
// Nessuna scrittura diretta sulle tabelle qui — tutte le scritture passano
// dalle RPC (RLS le blocca comunque lato client, vedi sql/47).

// ── Lettura ─────────────────────────────────────────────────────────────

// Righe dove l'utente è PROPRIETARIO (richieste ricevute) — join minimale,
// il nome/dettagli dell'oggetto vengono dallo snapshot congelato nella
// riga stessa (jsonb), non serve join su carte/prodotti_sealed.
async function richiesteScambioRicevuteList(userId) {
    // FASE 8b: campi ospite (sql/88). Se lo SQL non è ancora applicato le
    // colonne non esistono: si rilegge con la select di prima, così la
    // pagina Richieste non resta mai vuota per un ordine di rilascio.
    const leggi = (campi) => supabaseClient
        .from('richieste_scambio_righe')
        .select(`*, richieste_scambio(${campi})`)
        .eq('proprietario_id', userId)
        .order('creato_il', { ascending: false });
    const esito = await leggi('richiedente_id, creato_il, codice_rq, ospite_nome, ospite_contatto_tipo, ospite_contatto, ospite_messaggio');
    if (esito.error && /codice_rq|ospite_|42703|column/i.test((esito.error.message || '') + ' ' + (esito.error.code || ''))) {
        return leggi('richiedente_id, creato_il');
    }
    return esito;
}

// Righe dove l'utente è RICHIEDENTE (richieste inviate).
async function richiesteScambioInviateList(userId) {
    return supabaseClient
        .from('richieste_scambio_righe')
        .select('*, richieste_scambio(proprietario_id, creato_il)')
        .eq('richiedente_id', userId)
        .order('creato_il', { ascending: false });
}


// ── Scrittura (via RPC — mai tabelle dirette, RLS le blocca comunque) ────

async function inviaRichiestaScambio(proprietarioId, righe) {
    return supabaseClient.rpc('invia_richiesta_scambio', { p_proprietario_id: proprietarioId, p_righe: righe });
}

async function accettaRigaRichiesta(rigaId) {
    return supabaseClient.rpc('accetta_riga_richiesta', { p_riga_id: rigaId });
}

async function rifiutaRigaRichiesta(rigaId) {
    return supabaseClient.rpc('rifiuta_riga_richiesta', { p_riga_id: rigaId });
}

async function annullaRigaRichiesta(rigaId, motivo) {
    return supabaseClient.rpc('annulla_riga_richiesta', { p_riga_id: rigaId, p_motivo: motivo });
}

async function sbloccaRigaRichiesta(rigaId, motivo) {
    return supabaseClient.rpc('sblocca_riga_richiesta', { p_riga_id: rigaId, p_motivo: motivo || 'intervento_amministrativo' });
}

async function concludiRigaRichiesta(rigaId, locationScelta) {
    return supabaseClient.rpc('concludi_riga_richiesta', { p_riga_id: rigaId, p_location_scelta: locationScelta || '?' });
}

// Spostata qui da ui/widget-richieste.ui.js (audit 2026-09-25, B8): regola del progetto,
// nessuna chiamata a supabaseClient fuori da data/*.repository.js.
// Conta le righe che richiedono un'azione del proprietario (in_attesa).
async function richiesteScambioContaDaGestire(userId) {
    return supabaseClient
        .from('richieste_scambio_righe')
        .select('id', { count: 'exact', head: true })
        .eq('proprietario_id', userId)
        .eq('stato_riga', 'in_attesa');
}

// RESTYLE BINDEX FASE 8b (sql/88): richieste degli ospiti.
// Scadenza (7 giorni) e pulizia dati: il DB non ha un pianificatore, quindi
// il sito la fa partire all'apertura della pagina Richieste.
async function scadiRichiesteOspite() {
    return supabaseClient.rpc('scadi_richieste_ospite');
}

// Blocca il dispositivo dell'ospite (solo verso di me) e annulla le sue richieste aperte.
async function bloccaOspite(richiestaId) {
    return supabaseClient.rpc('blocca_ospite', { p_richiesta_id: richiestaId });
}
