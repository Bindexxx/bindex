// Widget Contributi al gruppo.

CATALOGO_WIDGET.contributi = {
        titolo: 'Contributi', icona: 'fa-hands-helping',
        tagliaDefault: '6x4',
        tab: 'contributi',
        preview: async () => {
            const d = await _contributiConCache();
            if (!d) return { righe: ['Dati non disponibili'], dati: null };
            const perc = d.gruppo ? Math.round((d.miei / d.gruppo) * 100) : null;
            return {
                righe: [perc != null ? `${perc}% dei controlli` : `${d.miei} cart${d.miei === 1 ? 'a' : 'e'} per il gruppo`],
                dati: d,
            };
        },
};

const TTL_CONTRIBUTI_MS = 5 * 60 * 1000;
let _cacheContributi = { quando: 0, dati: null };

async function _contributiConCache() {
    if (_cacheContributi.dati && Date.now() - _cacheContributi.quando < TTL_CONTRIBUTI_MS) return _cacheContributi.dati;
    if (typeof contributiGruppoLeggi !== 'function') return null;
    try {
        const { data, error } = await contributiGruppoLeggi();
        if (error || !data) return null;
        _cacheContributi = { quando: Date.now(), dati: data };
        return data;
    } catch (e) {
        console.error('[widget contributi]', e);
        return null;
    }
}

async function renderPaginaContributi() {
    const container = document.getElementById('contributiContenuto');
    if (!container) return;

    let d;
    try {
        d = await _contributiConCache();
    } catch (e) {
        console.error('renderPaginaContributi:', e);
        d = null;
    }

    if (!d) {
        container.innerHTML = `
            <div class="page-header">
                <span class="page-title">Contributi al gruppo</span>
            </div>
            <div class="stato-vuoto"><i class="fa-solid fa-triangle-exclamation"></i><br>Dati non disponibili al momento.</div>
        `;
        return;
    }

    const perc = d.gruppo ? Math.round((d.miei / d.gruppo) * 100) : null;
    const anello = perc == null
        ? `<div class="ct-anello ct-vuoto"><div class="ct-anello-dentro"><i class="fa-solid fa-hands-helping"></i></div></div>`
        : `<div class="ct-anello" style="--ct-perc:${Math.min(100, perc)};"><div class="ct-anello-dentro"><b>${perc}%</b><span>del gruppo</span></div></div>`;
    const frase = perc == null
        ? `<b>Primi contributi in arrivo</b><span>Quando lavori la coda di qualcun altro, compare qui.</span>`
        : (perc > 50
            ? `<b>${d.miei} cart${d.miei === 1 ? 'a' : 'e'} su ${d.gruppo}</b><span>Stai facendo più della metà del lavoro del gruppo.</span>`
            : `<b>${d.miei} cart${d.miei === 1 ? 'a' : 'e'} su ${d.gruppo}</b><span>controllate da te per il gruppo, sul totale lavorato per altri.</span>`);
    const passo = (n, testo) => `<div class="ct-passo"><span>${n}</span><p>${testo}</p></div>`;

    container.innerHTML = `
        <div class="ct-pagina">
            <div class="page-header">
                <span class="page-title">Contributi al gruppo</span>
            </div>
            <div class="ct-quota">${anello}<div class="ct-frase">${frase}</div></div>
            <div class="ct-stat">
                <div><b>${d.miei}</b><span>cart${d.miei === 1 ? 'a lavorata' : 'e lavorate'} per altri</span></div>
                <div><b>${d.personeAiutate}</b><span>person${d.personeAiutate === 1 ? 'a aiutata' : 'e aiutate'}</span></div>
            </div>
            <div class="ct-scheda">
                <h4>Come funziona</h4>
                ${passo(1, 'Attiva “Aiuta il gruppo” nell’estensione')}
                ${passo(2, 'L’estensione lavora da sola la coda di un altro')}
                ${passo(3, 'Ogni carta lavorata per un altro conta qui. Le tue righe non contano.')}
            </div>
            <div class="ct-scheda ct-aiuta">
                <div class="ct-aiuta-ico"><i class="fa-solid fa-hands-helping"></i></div>
                <div><b>Aiuta il gruppo</b><span>Si attiva dall’estensione, in Impostazioni › Account e dati.</span></div>
            </div>
        </div>
    `;
}
