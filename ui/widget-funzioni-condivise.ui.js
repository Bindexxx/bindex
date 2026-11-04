// Funzioni a pagina intera condivise fra più widget.

function _achievementRaritaCalcolata() {
    const gruppi = {};
    CATALOGO_TRAGUARDI.forEach(t => {
        (gruppi[t.metrica] = gruppi[t.metrica] || []).push(t);
    });
    const rarita = {};
    Object.values(gruppi).forEach(voci => {
        const ordinate = [...voci].sort((a, b) => a.valore - b.valore);
        ordinate.forEach((t, i) => {
            if (ordinate.length < 2) { rarita[t.id] = 'rara'; return; }
            if (i === ordinate.length - 1) rarita[t.id] = 'leggendaria';
            else if (i === ordinate.length - 2) rarita[t.id] = 'rara';
            else rarita[t.id] = 'comune';
        });
    });
    return rarita;
}

function _achievementCostruisciCatalogo(curati) {
    const curatiMap = new Map((curati || []).map(a => [a.id, a]));
    const raritaCalcolata = _achievementRaritaCalcolata();
    return CATALOGO_TRAGUARDI.map(t => {
        const c = curatiMap.get(t.id);
        return {
            id: t.id,
            titolo: c ? c.titolo : t.titolo,
            rarita: c ? c.rarita : (raritaCalcolata[t.id] || 'comune'),
            nome_file: c ? c.nome_file : null,
        };
    });
}
