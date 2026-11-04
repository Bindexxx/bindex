// Cornice delle pagine pubbliche.

function _clickTornaSuPubblico() {
    const schermo = document.getElementById('phoneScreen');
    if (schermo) schermo.scrollTo({ top: 0, behavior: 'smooth' });
}

async function applicaColoreCorniceProprietario(ownerId) {
    if (!ownerId || typeof coloreCorniceProprietarioGet !== 'function' || typeof derivaVariabiliTema !== 'function') return;
    try {
        const { data, error } = await coloreCorniceProprietarioGet(ownerId);
        if (error || !data || !data.colore_principale || !data.colore_secondario) return;
        const scuro = document.body.classList.contains('dark-mode');
        const variabili = derivaVariabiliTema(data.colore_principale, data.colore_secondario, scuro);
        Object.entries(variabili).forEach(([nome, valore]) => {
            document.documentElement.style.setProperty(nome, valore);
        });
    } catch (e) {
        console.error('[colore cornice pubblica] lettura fallita, restano i colori da URL/default', e);
    }
}

function initCorniciaPubblica() {
    if (typeof CSBar === 'undefined') return;

    CSBar.init({
        container: '#phoneScreen',
        persist: false,
        installPrompt: false,
        systemNotifications: false,
        watchNetwork: true,
    });

    const schermoPerPallina = document.getElementById('phoneScreen');
    if (schermoPerPallina && document.querySelector('.csb-bar')) {
        const pallina = document.createElement('div');
        pallina.id = 'pallinaTendinaVisibile';
        pallina.className = 'pokedex-ball pokedex-ball-tendina';
        schermoPerPallina.appendChild(pallina);
        _avviaSincronizzaPallinaTendina();

        pallina.addEventListener('pointerdown', (ev) => {
            const maniglia = document.querySelector('.csb-handle');
            if (!maniglia) return;
            const inoltrato = new PointerEvent('pointerdown', {
                bubbles: true,
                cancelable: true,
                pointerId: ev.pointerId,
                pointerType: ev.pointerType,
                isPrimary: ev.isPrimary,
                button: 0,
                buttons: ev.buttons,
                clientX: ev.clientX,
                clientY: ev.clientY,
            });
            maniglia.dispatchEvent(inoltrato);
        });
    }
}

function _avviaSincronizzaPallinaTendina() {
    const pallina = document.getElementById('pallinaTendinaVisibile');
    const shade = document.querySelector('.csb-shade');
    const schermo = document.getElementById('phoneScreen');
    if (!pallina || !shade || !schermo) return;

    function fotogramma() {
        const rectShade = shade.getBoundingClientRect();
        const rectSchermo = schermo.getBoundingClientRect();
        const fondoTendina = rectShade.bottom - rectSchermo.top;
        const piccoloStacco = 4;
        const offsetY = fondoTendina + piccoloStacco;
        pallina.style.transform = `translate(-50%, ${offsetY}px)`;
        requestAnimationFrame(fotogramma);
    }
    requestAnimationFrame(fotogramma);
}
