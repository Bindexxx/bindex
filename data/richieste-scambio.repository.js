// Richieste e proposte di scambio: RPC transazionali e letture (le scritture passano solo dalle RPC).

// Le righe delle proposte a due vie (sql/154) hanno anche loro chi dà e chi riceve: le due liste
// delle richieste di prima le tolgono, le proposte si leggono da scambiProposteList.
function _soloRichiesteDiPrima(esito) {
    if (esito && Array.isArray(esito.data)) esito.data = esito.data.filter(r => !(r.richieste_scambio && r.richieste_scambio.tipo === 'proposta'));
    return esito;
}
const _RICHIESTE_ERRORE_COLONNA = /codice_rq|ospite_|tipo|42703|column/i;

async function richiesteScambioRicevuteList(userId) {
    const leggi = (campi) => supabaseClient
        .from('richieste_scambio_righe')
        .select(`*, richieste_scambio(${campi})`)
        .eq('proprietario_id', userId)
        .order('creato_il', { ascending: false });
    let esito = await leggi('richiedente_id, creato_il, codice_rq, ospite_nome, ospite_contatto_tipo, ospite_contatto, ospite_messaggio, tipo');
    if (esito.error && _RICHIESTE_ERRORE_COLONNA.test((esito.error.message || '') + ' ' + (esito.error.code || ''))) {
        esito = await leggi('richiedente_id, creato_il, codice_rq, ospite_nome, ospite_contatto_tipo, ospite_contatto, ospite_messaggio');
        if (esito.error && _RICHIESTE_ERRORE_COLONNA.test((esito.error.message || '') + ' ' + (esito.error.code || ''))) esito = await leggi('richiedente_id, creato_il');
    }
    return _soloRichiesteDiPrima(esito);
}

async function richiesteScambioInviateList(userId) {
    const leggi = (campi) => supabaseClient
        .from('richieste_scambio_righe')
        .select(`*, richieste_scambio(${campi})`)
        .eq('richiedente_id', userId)
        .order('creato_il', { ascending: false });
    let esito = await leggi('proprietario_id, creato_il, tipo');
    if (esito.error && _RICHIESTE_ERRORE_COLONNA.test((esito.error.message || '') + ' ' + (esito.error.code || ''))) esito = await leggi('proprietario_id, creato_il');
    return _soloRichiesteDiPrima(esito);
}

const _SCAMBI_CAMPI_PROPOSTA = 'id, tipo, stato, stato_proposta, richiedente_id, proprietario_id, euro_da_richiedente, euro_da_proprietario, '
    + 'fatto_richiedente_il, fatto_proprietario_il, sostituisce_id, motivo_chiusura, chiusa_da, scade_il, aggiornato_il, creato_il, '
    + 'richieste_scambio_righe(id, richiedente_id, proprietario_id, carta_id, prodotto_sealed_id, quantita_richiesta, stato_riga, prezzo_congelato, snapshot, motivo_chiusura)';

// Proposte a due vie in cui ci sono io (mandate o ricevute), con le loro righe.
async function scambiProposteList(userId) {
    return supabaseClient
        .from('richieste_scambio')
        .select(_SCAMBI_CAMPI_PROPOSTA)
        .eq('tipo', 'proposta')
        .or(`richiedente_id.eq.${userId},proprietario_id.eq.${userId}`)
        .order('creato_il', { ascending: false })
        .limit(300);
}

// Proposte ancora aperte (in attesa o accettate) tra me e un'altra persona: per la chat.
async function scambiProposteAperteCon(userId, altroId) {
    return supabaseClient
        .from('richieste_scambio')
        .select(_SCAMBI_CAMPI_PROPOSTA)
        .eq('tipo', 'proposta')
        .in('stato_proposta', ['in_attesa', 'accettata'])
        .or(`and(richiedente_id.eq.${userId},proprietario_id.eq.${altroId}),and(richiedente_id.eq.${altroId},proprietario_id.eq.${userId})`)
        .order('creato_il', { ascending: false });
}

// Lo Scambio mio e quello dell'altra persona, con le copie ancora libere (sql/154).
async function leggiScambioPerProposta(altroId) {
    return supabaseClient.rpc('leggi_scambio_per_proposta', { p_altro: altroId });
}

// ricevo / dai: [{ tipo: 'carta'|'sealed', oggetto_id, quantita }]; gli euro li mette una parte sola.
async function proponiScambio(destinatarioId, ricevo, dai, euroDai, euroRicevo, sostituisceId) {
    return supabaseClient.rpc('proponi_scambio', {
        p_destinatario: destinatarioId, p_ricevo: ricevo || [], p_do: dai || [],
        p_euro_do: Number(euroDai) || 0, p_euro_ricevo: Number(euroRicevo) || 0, p_sostituisce: sostituisceId || null,
    });
}

async function rispondiProposta(richiestaId, accetta) {
    return supabaseClient.rpc('rispondi_proposta', { p_richiesta_id: richiestaId, p_accetta: !!accetta });
}

async function annullaProposta(richiestaId, motivo) {
    return supabaseClient.rpc('annulla_proposta', { p_richiesta_id: richiestaId, p_motivo: motivo || null });
}

// Ritorna 'aspetta_altro' oppure 'conclusa' (allora gli oggetti sono passati).
async function segnaFattoProposta(richiestaId) {
    return supabaseClient.rpc('segna_fatto_proposta', { p_richiesta_id: richiestaId });
}

async function scadiProposte() {
    return supabaseClient.rpc('scadi_proposte');
}

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

async function richiesteScambioContaDaGestire(userId) {
    return supabaseClient
        .from('richieste_scambio_righe')
        .select('id', { count: 'exact', head: true })
        .eq('proprietario_id', userId)
        .eq('stato_riga', 'in_attesa');
}

async function scadiRichiesteOspite() {
    return supabaseClient.rpc('scadi_richieste_ospite');
}

async function bloccaOspite(richiestaId) {
    return supabaseClient.rpc('blocca_ospite', { p_richiesta_id: richiestaId });
}
