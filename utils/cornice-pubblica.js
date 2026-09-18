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

// NOTA: barra-totale/modali di queste pagine sono position:absolute
// (rispetto a #phoneScreen) invece di fixed — vedi utils/cornice-pubblica.css
// per il perché (deciso allo Step 5, resta valido anche ora che
// #phoneFrameBox non ha più alcuna trasformazione: absolute rispetto a
// #phoneScreen è comunque la scelta più semplice e prevedibile).
//
// SEMPLIFICATO (STEP 9 restyle "cornice Pokédex", 2026-09-17): tolto tutto
// il motore POKEDEX_MODES/_modalitaCorniceCorrente/_aggiornaScalaCornice —
// #phoneFrameBox è ora puro CSS (width/height:100%, vedi
// utils/cornice-pubblica.css), niente più da calcolare al resize.

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
    if (typeof CSBar === 'undefined') return; // statusbar.js non caricato, pagina resta usabile senza tendina

    CSBar.init({
        container: '#phoneScreen',
        persist: false, // pagina anonima, nessuna sessione da ricordare tra visite
        installPrompt: false,
        systemNotifications: false,
        watchNetwork: true, // clock + pallino di connessione, generico, nessuna logica applicativa
    });

    // STEP 13 fix (2026-09-17), seconda versione — corregge lo Step 11:
    // vedi commento CSS su .pokedex-ball-tendina per la spiegazione
    // geometrica completa. La pallina è indipendente da .csb-shade,
    // appesa direttamente a #phoneScreen, e segue la posizione vera della
    // tendina ad ogni fotogramma.
    const schermoPerPallina = document.getElementById('phoneScreen');
    if (schermoPerPallina && document.querySelector('.csb-bar')) {
        const pallina = document.createElement('div');
        pallina.id = 'pallinaTendinaVisibile';
        pallina.className = 'pokedex-ball pokedex-ball-tendina';
        schermoPerPallina.appendChild(pallina);
        _avviaSincronizzaPallinaTendina();
    }
}

// Segue la posizione VERA di .csb-shade ad ogni fotogramma — stessa
// funzione di ui/paginainiziale-polling-avvio.ui.js (index.html),
// duplicata qui per lo stesso motivo di sempre: queste pagine pubbliche
// non caricano quel file (Regola d'Oro #1, niente cross-file coupling).
function _avviaSincronizzaPallinaTendina() {
    const pallina = document.getElementById('pallinaTendinaVisibile');
    const shade = document.querySelector('.csb-shade');
    const schermo = document.getElementById('phoneScreen');
    if (!pallina || !shade || !schermo) return;

    function fotogramma() {
        const rectShade = shade.getBoundingClientRect();
        const rectSchermo = schermo.getBoundingClientRect();
        const centroBersaglio = (rectShade.bottom - rectSchermo.top) - 12;
        const offsetY = centroBersaglio - (pallina.offsetHeight / 2);
        pallina.style.transform = `translate(-50%, ${offsetY}px)`;
        requestAnimationFrame(fotogramma);
    }
    requestAnimationFrame(fotogramma);
}
