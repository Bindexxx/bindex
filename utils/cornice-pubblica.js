// ── utils/cornice-pubblica.js ────────────────────────────────────────────
// STEP 5 restyle "cornice Pokédex" (2026-09-17). Motore condiviso da
// wishlist.html/binder-pubblico.html/scaffali-pubblico.html — stessa
// logica di stage a risoluzione nativa+scala di index.html
// (ui/paginainiziale-cornice-statusbar.ui.js), portata qui perché queste
// pagine sono standalone e non caricano quel file. Duplicazione voluta
// (Regola d'Oro #1) invece di far dipendere pagine pubbliche anonime da
// file dell'app privata.
//
// A differenza della Home, qui NON c'è una griglia widget a pagine — il
// contenuto (header/lista/barra in fondo) scorre normalmente dentro
// #phoneScreen. La tendina (CSBar) però è la STESSA, identica, come
// richiesto da Claudio — stesso look (vedi utils/cornice-pubblica.css),
// stessa libreria, solo una configurazione più leggera (niente notifiche
// applicative: queste pagine sono viste da visitatori anonimi).
// ───────────────────────────────────────────────────────────────────────

// NOTA: barra-totale/modali di queste pagine sono stati convertiti da
// position:fixed a position:absolute (rispetto a #phoneScreen) nell'HTML
// di ciascuna pagina — un elemento fixed dentro un antenato con
// transform (qui #phoneFrameBox) ha un comportamento sottile che non
// potevo verificare dal vivo; absolute rispetto a #phoneScreen è più
// prevedibile ed è il motivo per cui lo scroll vero vive in
// #phoneContenutoScorribile (figlio di #phoneScreen) invece che su
// #phoneScreen stesso — vedi utils/cornice-pubblica.css.
const POKEDEX_MODES = {
    'mobile-verticale':    { larghezza: 390,  altezza: 844 },
    'mobile-orizzontale':  { larghezza: 844,  altezza: 390 },
    'desktop-verticale':   { larghezza: 768,  altezza: 1366 },
    'desktop-orizzontale': { larghezza: 1366, altezza: 768 },
};

function _modalitaCorniceCorrente() {
    const desktop = window.matchMedia('(pointer: fine)').matches;
    const verticale = window.innerHeight > window.innerWidth;
    if (desktop) return verticale ? 'desktop-verticale' : 'desktop-orizzontale';
    return verticale ? 'mobile-verticale' : 'mobile-orizzontale';
}

function _aggiornaScalaCornice() {
    const box = document.getElementById('phoneFrameBox');
    const shell = document.getElementById('phoneShell');
    if (!box || !shell) return;

    const modo = _modalitaCorniceCorrente();
    const nativa = POKEDEX_MODES[modo];

    const margine = parseFloat(getComputedStyle(shell).paddingLeft) || 0;
    const spazioW = Math.max(0, shell.clientWidth - margine * 2);
    const spazioH = Math.max(0, shell.clientHeight - margine * 2);
    if (!spazioW || !spazioH) return;

    const scala = Math.min(spazioW / nativa.larghezza, spazioH / nativa.altezza);

    box.style.width = nativa.larghezza + 'px';
    box.style.height = nativa.altezza + 'px';
    box.style.transform = `scale(${scala})`;
    box.dataset.modalitaCornice = modo;
}

function _gestisciResizeCornicePubblica() {
    _aggiornaScalaCornice();
}

let _resizeCornicePubblicaTimer = null;
function _gestisciResizeCornicePubblicaDebounced() {
    clearTimeout(_resizeCornicePubblicaTimer);
    _resizeCornicePubblicaTimer = setTimeout(_gestisciResizeCornicePubblica, 120);
}

// Torna in cima al contenuto scorribile — unica funzione sensata per il
// "tasto fisico" su una pagina pubblica senza navigazione multi-pagina.
function _clickTornaSuPubblico() {
    const schermo = document.getElementById('phoneScreen');
    if (schermo) schermo.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── COLORE CORNICE DEL PROPRIETARIO (STEP 6 restyle "cornice Pokédex",
// 2026-09-17) — sostituisce/completa i parametri URL ?principale=/
// &secondario= di applicaTemaCondiviso() (utils/shared-public.js) col
// valore VERO salvato dal proprietario su Supabase (sql/63), quando
// l'owner_id della pagina è noto (dopo che caricaCatalogo() è tornata).
// Se la RPC fallisce o il proprietario non ha ancora scelto un colore,
// restano validi i valori già applicati da applicaTemaCondiviso()
// (URL o default) — nessun errore bloccante, solo un tentativo in più.
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

// Inizializza cornice + tendina — chiamata dal bootstrap di ciascuna
// pagina (dopo applicaTemaCondiviso(), così i colori sono già pronti).
function initCorniciaPubblica() {
    _aggiornaScalaCornice();
    window.addEventListener('resize', _gestisciResizeCornicePubblicaDebounced, { passive: true });
    window.addEventListener('orientationchange', _gestisciResizeCornicePubblica);

    if (typeof CSBar === 'undefined') return; // statusbar.js non caricato, pagina resta usabile senza tendina

    CSBar.init({
        container: '#phoneScreen',
        persist: false, // pagina anonima, nessuna sessione da ricordare tra visite
        installPrompt: false,
        systemNotifications: false,
        watchNetwork: true, // clock + pallino di connessione, generico, nessuna logica applicativa
    });

    const shade = document.querySelector('.csb-shade');
    if (shade) {
        const pallina = document.createElement('div');
        pallina.className = 'pokedex-ball pokedex-ball-tendina';
        shade.appendChild(pallina);
    }
}
