// ── ui/storico-valore.avvio.js ───────────────────────────────────────────
// Scrive l'istantanea giornaliera del valore della collezione (migration
// 36) una volta per sessione, all'avvio.
//
// PERCHE' UN FILE A SE' E NON UNA RIGA DENTRO phone.ui.js
// Stesso ragionamento del watcher delle missioni: phone.ui.js e' a 4.500
// righe e ogni modifica li' dentro va rispedita per intero. Questo pezzo
// non ha niente a che vedere con la scocca del telefono — e' un compito di
// avvio — e sta meglio isolato, dove si legge tutto in una schermata.
//
// PERCHE' NON SUBITO AL 'load'
// storicoValoreRegistraOggi calcola il valore da carteReali. Al momento del
// 'load' quella variabile esiste ma e' quasi certamente vuota: le carte
// arrivano da Supabase poco dopo. Scrivere in quel momento significherebbe
// registrare "valore zero, zero pezzi" come istantanea della giornata — e
// il giorno dopo il widget direbbe che la collezione e' cresciuta di
// millecinquecento euro dal nulla. Da qui l'attesa e i tentativi qui sotto.
//
// PERCHE' UNA VOLTA SOLA PER SESSIONE
// La riga del giorno viene riscritta a ogni chiamata (upsert sul vincolo
// owner_id+giorno), quindi ripetere non crea doppioni — ma e' comunque una
// scrittura inutile. Una per sessione basta: chi tiene l'app aperta per
// giorni e' un caso raro, e al massimo perde l'aggiornamento serale del
// valore, non un giorno intero di storico.

// Primo tentativo dopo 25 secondi: piu' tardi del watcher delle missioni
// (20s) di proposito, per non accavallare le due scritture nello stesso
// istante dell'avvio.
const RITARDO_ISTANTANEA_VALORE_MS = 25000;
// Se le carte non sono ancora arrivate, riprova. 6 tentativi ogni 15
// secondi coprono un minuto e mezzo: oltre, o la rete e' giu' o l'utente
// non e' loggato, e in entrambi i casi insistere non serve.
const RIPROVE_ISTANTANEA_VALORE = 6;
const PAUSA_RIPROVA_ISTANTANEA_MS = 15000;

let _istantaneaValoreFatta = false;
let _riproveIstantaneaValore = 0;

async function _provaIstantaneaValore() {
    if (_istantaneaValoreFatta) return;

    // Dipendenze tutte globali. Se una manca (file non caricato, ordine
    // degli script cambiato) esco in silenzio invece di riempire la console.
    if (typeof storicoValoreRegistraOggi !== 'function') return;
    if (typeof authGetUserId !== 'function') return;

    const riprova = () => {
        if (_riproveIstantaneaValore++ < RIPROVE_ISTANTANEA_VALORE) {
            setTimeout(_provaIstantaneaValore, PAUSA_RIPROVA_ISTANTANEA_MS);
        }
    };

    try {
        const userId = await authGetUserId();
        if (!userId) return riprova(); // non ancora loggato

        // LA GUARDIA IMPORTANTE: mai scrivere un'istantanea a collezione
        // vuota. Una collezione davvero vuota e una collezione non ancora
        // caricata sono indistinguibili da qui, e sbagliare significa
        // falsare lo storico. Nel dubbio si aspetta: chi ha davvero zero
        // carte non ha niente da mettere in un grafico del valore, quindi
        // non perde nulla.
        if (typeof carteReali === 'undefined' || !carteReali.length) return riprova();

        await storicoValoreRegistraOggi(userId);
        _istantaneaValoreFatta = true;
    } catch (e) {
        console.error('[storico valore] istantanea di avvio:', e);
        riprova();
    }
}

// addEventListener e NON window.onload = ...: index.html assegna gia'
// window.onload con la sua funzione di avvio, e un'assegnazione diretta qui
// la cancellerebbe (o verrebbe cancellata) a seconda dell'ordine di
// caricamento. Stesso idioma di ui/missioni-watcher.js.
window.addEventListener('load', () => {
    setTimeout(_provaIstantaneaValore, RITARDO_ISTANTANEA_VALORE_MS);
});
