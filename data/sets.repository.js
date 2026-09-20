// ── data/sets.repository.js ──────────────────────────────────────────────
// Unico punto da cui si legge la tabella 'set_espansioni' (migration 28).
// Come tutti i file in data/, è l'unico autorizzato a toccare
// supabaseClient: ui/*.ui.js non deve mai chiamarlo direttamente.
//
// COSA CONTIENE LA TABELLA
// Le espansioni Pokémon con due conteggi distinti: carte_base è il numero
// stampato sulla carta ("123/217"), carte_totali comprende le secret rare
// (295 per Ascesa Eroica). L'avanzamento va calcolato su carte_totali.
//
// PERCHÉ C'È ANCHE UN FILE STATICO
// data/sets.library.js contiene la stessa libreria generata da
// genera-libreria-set.html. Le due strade convivono di proposito:
//   - il file statico non costa nessuna query e funziona anche offline;
//   - la tabella si aggiorna senza toccare il repository del sito, che è
//     ciò che serve quando gli utenti saranno molti.
// Il client prova la tabella e, se non risponde o è vuota, usa il file:
// una libreria un po' più vecchia è sempre meglio di nessuna libreria.

// Espansioni lette una volta per sessione: sono dati di riferimento che
// cambiano quando esce un'espansione, non serve rileggerli a ogni giro.
let _setEspansioniCache = null;

async function setEspansioniLeggiTutte() {
    if (_setEspansioniCache) return _setEspansioniCache;

    const { data, error } = await supabaseClient
        .from('set_espansioni')
        .select('sigla, nome, carte_base, carte_totali');

    if (error) {
        console.error('Lettura set_espansioni:', error.message);
        return null;   // chi chiama ricade sul file statico
    }
    _setEspansioniCache = data || [];
    return _setEspansioniCache;
}

// Svuota la cache: serve dopo un aggiornamento della tabella da admin.
function setEspansioniSvuotaCache() { _setEspansioniCache = null; }


// ═══════════════════════════════════════════════════════════════════════
// MASTERSET (2026-09-20, sql/66_set_masterset.sql)
// ═══════════════════════════════════════════════════════════════════════
// Catalogo per carta + preferenze per-utente del widget Set (set nascosti,
// carte ignorate, soglie già raggiunte). Stessa regola di sempre: solo
// questo file parla con supabaseClient. Le funzioni restituiscono il
// risultato grezzo { data, error } di Supabase — chi chiama decide cosa
// fare in caso di errore (il widget degrada senza rompersi: vedi
// ui/set-motore.ui.js).

// PostgREST restituisce al massimo 1000 righe per richiesta: il catalogo
// (decine di migliaia di righe) e le soglie di un utente (~200 set × 7)
// possono superarle. Senza paginare, le righe oltre la 1000ª sparirebbero
// in silenzio — per le soglie vorrebbe dire ri-notificare cose già
// notificate. 'costruisci' deve restituire una query NUOVA a ogni chiamata
// e con un ordinamento stabile.
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

// ── Catalogo (lettura pubblica) ──────────────────────────────────────────
// { data: [{ sigla, carte }] } — una riga per set che ha almeno una carta
// nel catalogo.
async function setCatalogoConteggiLeggi() {
    return supabaseClient.rpc('set_carte_conteggi');
}

// Righe del catalogo per le sigle richieste (a blocchi, per non superare
// la lunghezza dell'URL con filtro .in()).
async function setCatalogoRigheLeggi(sigle) {
    const tutte = [];
    for (let i = 0; i < sigle.length; i += 40) {
        const blocco = sigle.slice(i, i + 40);
        const { data, error } = await _setLeggiPaginato(() =>
            supabaseClient.from('set_carte')
                .select('sigla, numero, variante, nome, rarita, immagine')
                .in('sigla', blocco)
                .order('sigla').order('numero').order('variante'));
        if (error) return { data: null, error };
        tutte.push(...data);
    }
    return { data: tutte, error: null };
}

// ── Set nascosti ─────────────────────────────────────────────────────────
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

// ── Carte ignorate dal masterset ─────────────────────────────────────────
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

// ── Soglie raggiunte ─────────────────────────────────────────────────────
async function setSoglieLeggi(userId) {
    return _setLeggiPaginato(() =>
        supabaseClient.from('set_soglie_notificate')
            .select('sigla, soglia, raggiunta_il, vista_il')
            .eq('owner_id', userId).order('sigla').order('soglia'));
}

// Righe registrate senza notifica (marcatori e soglie già superate alla
// prima valutazione, soglie "assorbite" da una più alta). ignoreDuplicates:
// se un altro dispositivo le ha già scritte non è un errore.
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

// UNA soglia da notificare: insert semplice (NON upsert) apposta — se un
// altro dispositivo l'ha già scritta l'errore è 23505 (chiave duplicata) e
// il chiamante sa di non dover notificare due volte.
async function setSoglieInserisciNotificata(userId, sigla, soglia, raggiuntaIl) {
    return supabaseClient.from('set_soglie_notificate')
        .insert({ owner_id: userId, sigla, soglia, raggiunta_il: raggiuntaIl, vista_il: null });
}

async function setSoglieSegnaViste(userId, vistaIl) {
    return supabaseClient.from('set_soglie_notificate')
        .update({ vista_il: vistaIl })
        .eq('owner_id', userId).is('vista_il', null);
}
