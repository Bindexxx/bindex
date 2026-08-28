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
