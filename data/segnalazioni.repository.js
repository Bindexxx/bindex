// Segnalazioni di bug: solo inserimento.

async function segnalazioniBugInvia({ ownerId, descrizione, logDiagnostico, pagina, browser, schermo }) {
    return supabaseClient.from('segnalazioni_bug').insert({
        owner_id: ownerId,
        descrizione,
        log_diagnostico: logDiagnostico || null,
        pagina: pagina || null,
        browser: browser || null,
        schermo: schermo || null,
    });
}
