// Contributi al gruppo: letture.

async function contributiGruppoLeggi() {
    const { data, error } = await supabaseClient.rpc('leggi_contributi_gruppo');

    if (error) {
        console.error('[contributi gruppo] lettura:', error.message);
        return { data: null, error };
    }

    const riga = Array.isArray(data) ? data[0] : data;
    if (!riga) return { data: null, error: null };

    return {
        data: {
            miei: Number(riga.miei) || 0,
            personeAiutate: Number(riga.persone_aiutate) || 0,
            gruppo: Number(riga.gruppo) || 0,
        },
        error: null,
    };
}
