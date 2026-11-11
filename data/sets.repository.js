// Tabella set_espansioni: letture.

let _setEspansioniCache = null;

async function setEspansioniLeggiTutte() {
    if (_setEspansioniCache) return _setEspansioniCache;

    const { data, error } = await supabaseClient
        .from('set_espansioni')
        .select('*'); // con "lingua" (sql/131); '*' regge anche prima che la colonna esista

    if (error) {
        console.error('Lettura set_espansioni:', error.message);
        return null;
    }
    _setEspansioniCache = data || [];
    return _setEspansioniCache;
}

function setEspansioniSvuotaCache() { _setEspansioniCache = null; }

async function _setLeggiPaginato(costruisci) {
    const PAGINA = 1000;
    const tutte = [];
    let da = 0;
    while (true) {
        const { data, error } = await costruisci().range(da, da + PAGINA - 1);
        if (error) return { data: null, error };
        const righe = data || [];
        tutte.push(...righe);
        if (righe.length < PAGINA) break;
        da += PAGINA;
    }
    return { data: tutte, error: null };
}

async function setCatalogoConteggiLeggi() {
    return supabaseClient.rpc('set_carte_conteggi');
}

// "codice" è il codice della carta nei masterset promo (sql/135: "PAL 050" in BOO24, "A42" in BA24).
// Finché la colonna non c'è sul DB si legge senza, come prima.
let _setCarteConCodice = true;

async function setCatalogoRigheLeggi(sigle) {
    const tutte = [];
    for (let i = 0; i < sigle.length; i += 40) {
        const blocco = sigle.slice(i, i + 40);
        const leggi = () => _setLeggiPaginato(() =>
            supabaseClient.from('set_carte')
                .select('sigla, numero, variante, nome, rarita, immagine, cardmarket_id' + (_setCarteConCodice ? ', codice' : ''))
                .in('sigla', blocco)
                .order('sigla').order('numero').order('variante'));
        let { data, error } = await leggi();
        if (error && _setCarteConCodice && (error.code === '42703' || /codice/.test(error.message || ''))) {
            _setCarteConCodice = false;
            ({ data, error } = await leggi());
        }
        if (error) return { data: null, error };
        tutte.push(...data);
    }
    return { data: tutte, error: null };
}

async function setRaritaLeggi(sigle) {
    const tutte = [];
    for (let i = 0; i < sigle.length; i += 40) {
        const blocco = sigle.slice(i, i + 40);
        const { data, error } = await _setLeggiPaginato(() =>
            supabaseClient.from('set_carte')
                .select('sigla, numero, variante, rarita')
                .in('sigla', blocco)
                .order('sigla').order('numero').order('variante'));
        if (error) return { data: null, error };
        tutte.push(...data);
    }
    return { data: tutte, error: null };
}

async function setNascostiLeggi(userId) {
    return _setLeggiPaginato(() =>
        supabaseClient.from('set_nascosti').select('sigla')
            .eq('owner_id', userId).order('sigla'));
}

async function setNascostoImposta(userId, sigla, nascosto) {
    if (nascosto) {
        return supabaseClient.from('set_nascosti')
            .upsert({ owner_id: userId, sigla }, { onConflict: 'owner_id,sigla', ignoreDuplicates: true });
    }
    return supabaseClient.from('set_nascosti')
        .delete().eq('owner_id', userId).eq('sigla', sigla);
}

async function setIgnorateLeggi(userId) {
    return _setLeggiPaginato(() =>
        supabaseClient.from('set_carte_ignorate').select('sigla, numero, variante')
            .eq('owner_id', userId).order('sigla').order('numero').order('variante'));
}

async function setIgnorataImposta(userId, sigla, numero, variante, ignorata) {
    if (ignorata) {
        return supabaseClient.from('set_carte_ignorate')
            .upsert({ owner_id: userId, sigla, numero, variante },
                    { onConflict: 'owner_id,sigla,numero,variante', ignoreDuplicates: true });
    }
    return supabaseClient.from('set_carte_ignorate')
        .delete().eq('owner_id', userId).eq('sigla', sigla)
        .eq('numero', numero).eq('variante', variante);
}

async function setSoglieLeggi(userId) {
    return _setLeggiPaginato(() =>
        supabaseClient.from('set_soglie_notificate')
            .select('sigla, soglia, raggiunta_il, vista_il')
            .eq('owner_id', userId).order('sigla').order('soglia'));
}

async function setSoglieInserisciSilenziose(userId, righe) {
    for (let i = 0; i < righe.length; i += 500) {
        const blocco = righe.slice(i, i + 500).map(r => ({
            owner_id: userId, sigla: r.sigla, soglia: r.soglia,
            raggiunta_il: r.raggiunta_il, vista_il: r.vista_il
        }));
        const { error } = await supabaseClient.from('set_soglie_notificate')
            .upsert(blocco, { onConflict: 'owner_id,sigla,soglia', ignoreDuplicates: true });
        if (error) return { error };
    }
    return { error: null };
}

async function setSoglieInserisciNotificata(userId, sigla, soglia, raggiuntaIl) {
    return supabaseClient.from('set_soglie_notificate')
        .insert({ owner_id: userId, sigla, soglia, raggiunta_il: raggiuntaIl, vista_il: null });
}

async function setSoglieSegnaViste(userId, vistaIl) {
    return supabaseClient.from('set_soglie_notificate')
        .update({ vista_il: vistaIl })
        .eq('owner_id', userId).is('vista_il', null);
}

async function setCarteVarianteImposta(ids, variante) {
    for (let i = 0; i < ids.length; i += 100) {
        const { error } = await supabaseClient.from('carte')
            .update({ variante }).in('id', ids.slice(i, i + 100));
        if (error) return { error };
    }
    return { error: null };
}
