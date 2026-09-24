// ═══════════════════════════════════════════════════════════════════════
// WIDGET-FUNZIONI-CONDIVISE.UI.JS — funzioni a pagina intera condivise fra
// più widget (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// Nasceva vuoto dallo STEP 2 della ristrutturazione (2026-09-11) — prima
// aggiunta reale, sessione 2026-09-25 (Milestones = Achievement).
//
// Contiene: la regola di rarità condivisa tra il widget Achievement
// (griglia, ui/widget-achievement.ui.js) e il popup di sblocco chiamato
// da ui/missioni.ui.js (_missioniNotificaCompletamenti) — deve vivere qui
// e non solo nel file del widget perché missioni.ui.js la usa per il
// popup senza dover duplicare la formula in due punti.
//
// Regola VERIFICATA (comparazione sessione 2026-09-25 tra le 37 righe
// curate a mano in achievement_catalogo e CATALOGO_TRAGUARDI, non
// inventata): per ogni scala (stessa 'metrica') l'ULTIMO gradino curato è
// sempre rarità leggendaria, il PENULTIMO sempre rara, tutti gli altri
// comune — verificato su tutte e 10 le scale presenti in
// ui/missioni-catalogo.ui.js, zero eccezioni. Qui la applichiamo
// sull'INTERA scala (non solo sul sottoinsieme curato), per i traguardi
// che non hanno ancora una riga curata in achievement_catalogo.
//
// Dipende da CATALOGO_TRAGUARDI (ui/missioni-catalogo.ui.js) solo a tempo
// di CHIAMATA delle due funzioni sotto (mai a tempo di caricamento
// script) — l'ordine tra questo file e ui/missioni-catalogo.ui.js nei
// <script> tag di index.html è indifferente, purché entrambi carichino
// prima che il widget Achievement o il popup di sblocco vengano usati.
// ───────────────────────────────────────────────────────────────────────

// Mappa { traguardo_id: 'comune'|'rara'|'leggendaria' } per TUTTI i
// traguardi di CATALOGO_TRAGUARDI, raggruppati per 'metrica' (= scala di
// appartenenza — ogni scala generata da _generaScalaTraguardi usa una
// metrica univoca, vedi ui/missioni-catalogo.ui.js). Una metrica con una
// sola voce (nessun "penultimo" possibile — oggi capita solo per un
// eventuale futuro traguardo singolo con metrica propria) prende 'rara' di
// default, via di mezzo tra i due estremi.
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

// Unisce CATALOGO_TRAGUARDI (TUTTI i traguardi — decisione di Claudio,
// sessione 2026-09-25: "Tutti") con le righe curate a mano in
// achievement_catalogo (37 oggi, vedi data/achievement.repository.js):
// dove esiste una riga curata vince il suo titolo/rarità/nome_file,
// altrove titolo dal traguardo (già presente in CATALOGO_TRAGUARDI, vedi
// ui/missioni-catalogo.ui.js) + rarità calcolata sopra con la stessa
// identica regola. 'curati' è l'array grezzo tornato da
// achievementCatalogoList() (data/achievement.repository.js) — passato
// come parametro, non richiesto da questa funzione: nessuna chiamata a
// supabaseClient qui, coerente col pattern del progetto (UI raccoglie
// dati → chiama repository → passa i dati alle funzioni pure).
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
