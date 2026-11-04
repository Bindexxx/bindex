// Ultima visita e prezzi di partenza per le variazioni "dall'ultimo accesso".

async function visitaRegistra(pausaOre) {
    return supabaseClient.rpc('registra_visita', { p_pausa_ore: pausaOre });
}

async function variazioniPrezziDa(daISO) {
    return _selectTuttePagine(supabaseClient.rpc('leggi_variazioni_da', { p_da: daISO }));
}

function presenzaCreaCanale(chiave) {
    return supabaseClient.channel('presenza-cardsync', {
        config: { presence: { key: chiave } },
    });
}
