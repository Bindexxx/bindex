// ============================================================================
// MISSIONI.UI.JS — Catalogo missioni/traguardi (Fase 1) + motore di valutazione
// ============================================================================
// Contiene SOLO le voci Fase 1 (calcolabili da dati/stato già esistenti,
// nessun nuovo log eventi necessario). Le voci Fase 2 (aperture, ricerche,
// visite binder, streak accessi, categorie, azioni doppioni/estensione)
// sono OMESSE qui e vanno costruite in una sessione dedicata, dopo aver
// aggiunto la scrittura eventi nel punto giusto del codice (tabella
// activity_log esiste già ma è vuota/dormiente).
//
// Formato dichiarativo (non funzioni per voce): ogni missione/traguardo è
// un oggetto dati con { metrica, operatore, valore }, valutato dal motore
// generico _missioniValuta() in fondo al file. Aggiungere una voce = solo
// editare l'array, zero rischio di rompere logica JS.
//
// Tabelle DB di supporto (migration 32, eseguita su Bindexxx):
//   missioni_completate(owner_id, missione_id, finestra, periodo, origine, completato_il)
//   traguardi_riscossi(owner_id, traguardo_id, riscosso_il)
//   inventario_ricompense(owner_id, tipo, riferimento_id, quantita, ottenuto_il)
//
// ATTENZIONE COLLISIONE NOMI: verificare che CATALOGO_MISSIONI, CATALOGO_TRAGUARDI,
// MOTORE_MISSIONI non collidano con altri script già caricati (grep sui 29+ file
// prima di aggiungere lo <script> in index.html — non verificato in questa sessione,
// non avevo accesso agli altri file).
// ============================================================================


// ----------------------------------------------------------------------------
// CATALOGO MISSIONI (Fase 1) — 30 voci
// ----------------------------------------------------------------------------
// finestra: 'giornaliera' | 'settimanale' | 'mensile' | 'una_tantum'
// metrica: chiave interpretata da MOTORE_MISSIONI._metriche (vedi sotto)
// ricompensa.tipo: 'polvere' | 'stampino' | 'bustina' | 'skip_missione'
//
// NOTA: le soglie/ricompense del documento originale sono proposte di game
// design (nota #2 del documento), non valori tecnici definitivi — Claudio le
// bilancerà in fase di test.

const CATALOGO_MISSIONI = [
    { id: 'm01_primo_accesso', titolo: 'Primo accesso', categoria: 'costanza',
      finestra: 'giornaliera', metrica: 'accesso_oggi', operatore: '==', valore: true,
      ricompensa: { tipo: 'polvere', quantita: 1 },
      nota: 'FASE 2 sbloccata (2026-08-29): richiede activity_log, agganciata in ui/auth.ui.js:_avviaSitoDopoAccesso()' },

    { id: 'm02_una_carta_in_piu', titolo: 'Una carta in più', categoria: 'inserimento',
      finestra: 'giornaliera', metrica: 'carte_aggiunte_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 2 } },

    { id: 'm03_fai_scorta', titolo: 'Fai scorta', categoria: 'inserimento',
      finestra: 'giornaliera', metrica: 'carte_aggiunte_periodo', operatore: '>=', valore: 3,
      ricompensa: { tipo: 'polvere', quantita: 5 } },

    { id: 'm04_giornata_produttiva', titolo: 'Giornata produttiva', categoria: 'inserimento',
      finestra: 'giornaliera', metrica: 'carte_aggiunte_periodo', operatore: '>=', valore: 5,
      ricompensa: { tipo: 'polvere', quantita: 8 } },

    { id: 'm05_grande_raccolto', titolo: 'Grande raccolto', categoria: 'inserimento',
      finestra: 'giornaliera', metrica: 'carte_aggiunte_periodo', operatore: '>=', valore: 10,
      ricompensa: { tipo: 'polvere', quantita: 15 } },

    { id: 'm09_controllo_mercato', titolo: 'Controllo mercato', categoria: 'prezzi',
      finestra: 'giornaliera', metrica: 'prezzi_aggiornati_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 3 } },

    { id: 'm10_analista', titolo: 'Analista', categoria: 'prezzi',
      finestra: 'giornaliera', metrica: 'prezzi_aggiornati_periodo', operatore: '>=', valore: 3,
      ricompensa: { tipo: 'polvere', quantita: 6 } },

    { id: 'm11_metti_ordine', titolo: 'Metti ordine', categoria: 'inserimento',
      finestra: 'giornaliera', metrica: 'coda_errori_azzerata_oggi', operatore: '==', valore: true,
      ricompensa: { tipo: 'polvere', quantita: 3 },
      nota: 'ridefinita come binaria (non conteggio) — dafare_risolti traccia solo la transizione attivo->risolto del segnale aggregato coda_errori, una volta, non eventi singoli' },

    // m12_pulizia_straordinaria SPOSTATA IN FASE 2: dafare_risolti traccia solo
    // la transizione attivo->risolto di un segnale aggregato (una volta per
    // segnale), non un conteggio di eventi singoli — "3 errori risolti" non è
    // calcolabile da questa fonte. Vedi Catalogo_Missioni_Traguardi_Annotato.md.

    { id: 'm16_cacciatore_di_carte', titolo: 'Cacciatore di carte', categoria: 'inserimento',
      finestra: 'giornaliera', metrica: 'carte_aggiunte_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 2 },
      nota: 'duplicato concettuale di m02_una_carta_in_piu — il motore di assegnazione giornaliera deve evitare di estrarle insieme' },

    // FASE 2 sbloccate (2026-08-29): ricerche eseguite, agganciate in
    // ui/navigation.ui.js:vaiARisultatoRicerca() — conta solo click su un
    // risultato trovato (ricerca "riuscita"), non ogni tasto premuto.
    { id: 'm17_completa_una_ricerca', titolo: 'Completa una ricerca', categoria: 'esplorazione',
      finestra: 'giornaliera', metrica: 'ricerche_eseguite_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 2 } },

    { id: 'm84_cerca_e_trova', titolo: 'Cerca e trova', categoria: 'esplorazione',
      finestra: 'giornaliera', metrica: 'ricerche_eseguite_periodo', operatore: '>=', valore: 3,
      ricompensa: { tipo: 'polvere', quantita: 4 } },

    { id: 'm85_ricerca_completa', titolo: 'Ricerca completa', categoria: 'esplorazione',
      finestra: 'giornaliera', metrica: 'ricerche_eseguite_periodo', operatore: '>=', valore: 5,
      ricompensa: { tipo: 'polvere', quantita: 7 } },

    // FASE 2 sbloccate (2026-08-29), TEMA CAMBIATO da "esplorazione" a
    // "popolarità": binder-pubblico.html è anonimo per design (nessuna
    // sessione), impossibile sapere CHI visita — l'evento è quindi
    // attribuito al PROPRIETARIO del binder aperto, non al visitatore.
    // Da qui il titolo diverso dall'originale ("Esploratore"/"Viaggiatore"
    // presumevano un attore-visitatore che qui non possiamo identificare).
    // Missioni originali #21 "Nuova conoscenza" (nuovo UTENTE mai visitato)
    // e #22 "Curiosone" (5 CARTE viste dentro un binder) restano FASE 2
    // permanentemente bloccate anche con questa reinterpretazione: la prima
    // richiede identità visitatore (impossibile), la seconda richiede
    // eventi per-singola-carta (non tracciati, solo apertura binder intero).
    { id: 'm18_qualcuno_ti_ha_trovato', titolo: 'Qualcuno ti ha trovato', categoria: 'social',
      finestra: 'giornaliera', metrica: 'binder_aperture_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 3 } },

    { id: 'm19_doppio_interesse', titolo: 'Doppio interesse', categoria: 'social',
      finestra: 'giornaliera', metrica: 'binder_aperture_periodo', operatore: '>=', valore: 2,
      ricompensa: { tipo: 'polvere', quantita: 5 } },

    { id: 'm20_molto_cercato', titolo: 'Molto cercato', categoria: 'social',
      finestra: 'giornaliera', metrica: 'binder_aperture_periodo', operatore: '>=', valore: 3,
      ricompensa: { tipo: 'polvere', quantita: 7 } },

    { id: 'm24_primo_match', titolo: 'Primo Match', categoria: 'social',
      finestra: 'giornaliera', metrica: 'match_attivi_totale', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 4 } },

    { id: 'm25_caccia_di_scambi', titolo: 'A caccia di scambi', categoria: 'social',
      finestra: 'giornaliera', metrica: 'match_attivi_totale', operatore: '>=', valore: 3,
      ricompensa: { tipo: 'polvere', quantita: 7 } },

    { id: 'm27_condividi', titolo: 'Condividi', categoria: 'social',
      finestra: 'giornaliera', metrica: 'binder_pubblicati_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 3 } },

    { id: 'm31_nuovo_posto', titolo: 'Nuovo posto', categoria: 'inserimento',
      finestra: 'giornaliera', metrica: 'location_aggiunta_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 2 } },

    { id: 'm32_due_luoghi', titolo: 'Due luoghi', categoria: 'inserimento',
      finestra: 'giornaliera', metrica: 'location_distinte', operatore: '>=', valore: 2,
      ricompensa: { tipo: 'polvere', quantita: 4 },
      nota: 'stato cumulativo, non evento del giorno — semplificazione accettata' },

    { id: 'm36_controllo_qualita', titolo: 'Controllo qualità', categoria: 'inserimento',
      finestra: 'giornaliera', metrica: 'errori_coda_vuota', operatore: '==', valore: true,
      ricompensa: { tipo: 'polvere', quantita: 8 } },

    { id: 'm37_il_prezzo_giusto', titolo: 'Il prezzo giusto', categoria: 'prezzi',
      finestra: 'giornaliera', metrica: 'prezzi_aggiornati_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 3 },
      nota: 'duplicato concettuale di m09_controllo_mercato' },

    { id: 'm50_missione_compiuta', titolo: 'Missione compiuta', categoria: 'meta',
      finestra: 'una_tantum', metrica: 'missioni_completate_totale', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 3 } },

    { id: 'm51_inarrestabile', titolo: 'Inarrestabile', categoria: 'meta',
      finestra: 'giornaliera', metrica: 'missioni_completate_periodo', operatore: '>=', valore: 3,
      ricompensa: { tipo: 'polvere', quantita: 6 } },

    { id: 'm52_giornata_piena', titolo: 'Giornata piena', categoria: 'meta',
      finestra: 'giornaliera', metrica: 'missioni_completate_periodo', operatore: '>=', valore: 5,
      ricompensa: { tipo: 'polvere', quantita: 10 } },

    { id: 'm53_giornata_perfetta', titolo: 'Giornata perfetta', categoria: 'meta',
      finestra: 'giornaliera', metrica: 'percentuale_missioni_giorno', operatore: '>=', valore: 100,
      ricompensa: { tipo: 'polvere', quantita: 15, bonus: 'possibilita_bustina' },
      nota: 'metrica speciale: gestita direttamente dal motore (missioni completate oggi / missioni assegnate oggi), non un conteggio semplice' },

    { id: 'm54_cacciatore_di_obiettivi', titolo: 'Cacciatore di obiettivi', categoria: 'meta',
      finestra: 'una_tantum', metrica: 'missioni_completate_totale', operatore: '>=', valore: 10,
      ricompensa: { tipo: 'polvere', quantita: 15 } },

    // FASE 2 sbloccate (2026-08-29): streak giorni consecutivi con accesso.
    // finestra 'una_tantum' (non giornaliera): una volta raggiunta una
    // soglia di streak la ricompensa va data UNA volta sola, non ogni
    // giorno per tutta la durata dello streak — stesso ragionamento di
    // m54 sopra (totale, non periodo).
    { id: 'm44_torna_domani', titolo: 'Torna domani', categoria: 'costanza',
      finestra: 'una_tantum', metrica: 'giorni_consecutivi', operatore: '>=', valore: 2,
      ricompensa: { tipo: 'polvere', quantita: 4 } },

    { id: 'm45_costanza', titolo: 'Costanza', categoria: 'costanza',
      finestra: 'una_tantum', metrica: 'giorni_consecutivi', operatore: '>=', valore: 3,
      ricompensa: { tipo: 'polvere', quantita: 7 } },

    { id: 'm46_settimana_attiva', titolo: 'Settimana attiva', categoria: 'costanza',
      finestra: 'una_tantum', metrica: 'giorni_consecutivi', operatore: '>=', valore: 7,
      ricompensa: { tipo: 'polvere', quantita: 15 } },

    { id: 'm57_raccoglitore', titolo: 'Raccoglitore', categoria: 'inserimento',
      finestra: 'giornaliera', metrica: 'carte_stessa_espansione_max', operatore: '>=', valore: 2,
      ricompensa: { tipo: 'polvere', quantita: 4 },
      nota: 'stato cumulativo (gruppo più numeroso per espansione), non vincolato a "aggiunte oggi"' },

    // m58_rarita_gemelle e m59_varieta: ELIMINATE dal catalogo (decisione
    // Claudio, 2026-08-29). Rarità non trovata in nessun file reale: non è
    // una colonna di 'carte' (verificato via information_schema), non è
    // in ui/prices.ui.js né in data/sets.library.js (contiene solo
    // nome/base/totale per set). c.rarita in phone.ui.js è probabilmente
    // un campo mai popolato. Vedi Catalogo_Missioni_Traguardi_Annotato.md.

    { id: 'm63_un_desiderio_in_meno', titolo: 'Un desiderio in meno', categoria: 'prezzi',
      finestra: 'giornaliera', metrica: 'wishlist_obiettivi_raggiunti', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 5 } },

    { id: 'm64_obiettivo_raggiunto', titolo: 'Obiettivo raggiunto', categoria: 'prezzi',
      finestra: 'giornaliera', metrica: 'wishlist_obiettivi_raggiunti', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 6 },
      nota: 'duplicato concettuale di m63' },

    { id: 'm66_aggiornamento_completo', titolo: 'Aggiornamento completo', categoria: 'prezzi',
      finestra: 'settimanale', metrica: 'prezzi_aggiornati_settimana', operatore: '>=', valore: 5,
      ricompensa: { tipo: 'polvere', quantita: 10 },
      nota: 'CORREZIONE: metrica rinominata da prezzi_aggiornati_periodo a prezzi_aggiornati_settimana — stesso nome della versione giornaliera (m09/m10/m37) avrebbe prodotto un valore sbagliato quando entrambe le finestre sono valutate nello stesso ciclo (vedi MOTORE_MISSIONI.raccogliDati)' },

    { id: 'm68_mercato_pulito', titolo: 'Mercato pulito', categoria: 'prezzi',
      finestra: 'giornaliera', metrica: 'prezzi_scaduti_totale', operatore: '==', valore: 0,
      ricompensa: { tipo: 'polvere', quantita: 10 } },

    { id: 'm75_matchmaker', titolo: 'Matchmaker', categoria: 'social',
      finestra: 'una_tantum', metrica: 'match_attivi_totale', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 4 },
      nota: 'duplicato concettuale di m24, ma una_tantum invece di giornaliera' },

    { id: 'm89_apri_il_pokedex', titolo: 'Apri il Pokédex', categoria: 'estensione',
      finestra: 'giornaliera', metrica: 'estensione_aperta_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 3 } },

    { id: 'm94_personalizza', titolo: 'Personalizza', categoria: 'home',
      finestra: 'giornaliera', metrica: 'layout_modificato_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 3 } },

    { id: 'm95_il_tuo_telefono', titolo: 'Il tuo telefono', categoria: 'home',
      finestra: 'una_tantum', metrica: 'layout_modificato_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 5 },
      nota: 'duplicato concettuale di m94' },

    { id: 'm99_super_giornata', titolo: 'Super giornata', categoria: 'meta',
      finestra: 'giornaliera', metrica: 'missioni_completate_periodo', operatore: '>=', valore: 7,
      ricompensa: { tipo: 'polvere', quantita: 15, bonus: 'possibilita_bustina' } },

    { id: 'm100_leggenda_del_giorno', titolo: 'Leggenda del giorno', categoria: 'meta',
      finestra: 'giornaliera', metrica: 'percentuale_missioni_giorno', operatore: '>=', valore: 100,
      ricompensa: { tipo: 'polvere', quantita: 20, bonus: 'possibilita_stampino' },
      nota: 'duplicato concettuale di m53, stessa metrica speciale' },

    // FASE 2 sbloccate (2026-08-29): categorie missione. #96 ridefinita
    // 'settimanale' (Claudio, 2026-08-30): con solo 4 missioni/giorno
    // estratte a caso, coprire le 8 categorie esistenti in un solo giorno
    // è strutturalmente impossibile — in una settimana è realistico. #97
    // resta giornaliera (richiede solo 2 categorie specifiche).
    { id: 'm96_una_giornata_cardsync', titolo: 'Una giornata CardSync', categoria: 'meta',
      finestra: 'settimanale', metrica: 'tutte_categorie_coperte_settimana', operatore: '==', valore: true,
      ricompensa: { tipo: 'polvere', quantita: 12 } },

    { id: 'm97_collezionista_sociale', titolo: 'Collezionista sociale', categoria: 'meta',
      finestra: 'giornaliera', metrica: 'collezione_e_social_oggi', operatore: '==', valore: true,
      ricompensa: { tipo: 'polvere', quantita: 8 } },

    // #98 SPOSTATA a settimanale (2026-08-30): stessa identica logica di
    // #96 — con un pool di 4 missioni giornaliere, coprire 5 categorie
    // diverse in UN giorno richiede che tutte e 4 le estratte siano di
    // categorie diverse (non garantito dall'estrazione casuale) PIÙ che
    // una settimanale/una_tantum scatti per la prima volta proprio quel
    // giorno — nella pratica, su un account già avviato, sostanzialmente
    // mai raggiungibile. In una settimana è ampiamente realistico.
    { id: 'm98_tuttofare', titolo: 'Tuttofare', categoria: 'meta',
      finestra: 'settimanale', metrica: 'categorie_distinte_settimana', operatore: '>=', valore: 5,
      ricompensa: { tipo: 'polvere', quantita: 12 } },
];


// ----------------------------------------------------------------------------
// CATALOGO TRAGUARDI (Fase 1) — generato da scale + voci singole
// ----------------------------------------------------------------------------
// I traguardi sono PERMANENTI: una volta in traguardi_riscossi restano
// sbloccati anche se lo stato scende dopo (es. si vendono doppioni).
// Generatore di scala: stessa metrica, soglie crescenti, titoli reali dal
// documento originale (CardSync_100_Missioni_100_Traguardi.txt).

function _generaScalaTraguardi(prefissoId, metrica, voci) {
    // voci: [{ soglia, titolo, ricompensa }, ...]
    return voci.map((v, i) => ({
        id: `${prefissoId}_${i + 1}`,
        titolo: v.titolo,
        metrica: metrica,
        operatore: '>=',
        valore: v.soglia,
        ricompensa: v.ricompensa,
    }));
}

const SCALA_CARTE = _generaScalaTraguardi('t_carte', 'carte_totali', [
    { soglia: 1,      titolo: 'Primo passo',            ricompensa: { tipo: 'stampino', riferimento: 'primo_passo' } },
    { soglia: 5,      titolo: 'Inizia la collezione',   ricompensa: { tipo: 'polvere', quantita: 5 } },
    { soglia: 10,     titolo: 'Piccolo raccoglitore',   ricompensa: { tipo: 'polvere', quantita: 10 } },
    { soglia: 25,     titolo: 'Apprendista',            ricompensa: { tipo: 'stampino', riferimento: 'apprendista' } },
    { soglia: 50,     titolo: 'Collezionista',          ricompensa: { tipo: 'polvere', quantita: 25 } },
    { soglia: 100,    titolo: 'Raccoglitore esperto',   ricompensa: { tipo: 'bustina', quantita: 1 } },
    { soglia: 250,    titolo: 'Collezionista veterano', ricompensa: { tipo: 'polvere', quantita: 50 } },
    { soglia: 500,    titolo: 'Archivista',             ricompensa: { tipo: 'stampino', riferimento: 'archivista' } },
    { soglia: 1000,   titolo: 'Grande collezione',      ricompensa: { tipo: 'bustina', quantita: 2 } },
    { soglia: 2500,   titolo: 'Maestro collezionista',  ricompensa: { tipo: 'stampino', riferimento: 'maestro' } },
    { soglia: 5000,   titolo: 'Leggenda',               ricompensa: { tipo: 'polvere', quantita: 100, bonus: 'bustina' } },
    { soglia: 10000,  titolo: 'Biblioteca di carte',    ricompensa: { tipo: 'stampino', riferimento: 'raro' } },
    { soglia: 25000,  titolo: 'Tesoro infinito',        ricompensa: { tipo: 'polvere', quantita: 250 } },
    { soglia: 50000,  titolo: 'Archivio vivente',       ricompensa: { tipo: 'bustina', riferimento: 'speciale' } },
    { soglia: 100000, titolo: 'Collezione monumentale', ricompensa: { tipo: 'stampino', riferimento: 'leggendario' } },
]);

const SCALA_VALORE = _generaScalaTraguardi('t_valore', 'valore_collezione', [
    { soglia: 10,    titolo: 'Primo tesoro',         ricompensa: { tipo: 'polvere', quantita: 5 } },
    { soglia: 50,    titolo: 'Piccolo capitale',     ricompensa: { tipo: 'polvere', quantita: 10 } },
    { soglia: 100,   titolo: 'Tesoretto',            ricompensa: { tipo: 'polvere', quantita: 15 } },
    { soglia: 250,   titolo: 'Collezione preziosa',  ricompensa: { tipo: 'stampino', riferimento: 'tesoro' } },
    { soglia: 500,   titolo: 'Cinque stelle',        ricompensa: { tipo: 'bustina', quantita: 1 } },
    { soglia: 1000,  titolo: "Collezione d'oro",     ricompensa: { tipo: 'polvere', quantita: 50 } },
    { soglia: 2500,  titolo: 'Tesoro importante',    ricompensa: { tipo: 'stampino', riferimento: 'raro' } },
    { soglia: 5000,  titolo: 'Collezione di valore', ricompensa: { tipo: 'polvere', quantita: 100 } },
    { soglia: 10000, titolo: 'Grande patrimonio',    ricompensa: { tipo: 'bustina', quantita: 2 } },
    { soglia: 25000, titolo: 'Tesoro leggendario',   ricompensa: { tipo: 'stampino', riferimento: 'leggendario', bonus: '250_polvere' } },
]);

const SCALA_LOCATION = _generaScalaTraguardi('t_location', 'location_distinte', [
    { soglia: 1,   titolo: 'Prima tappa',            ricompensa: { tipo: 'polvere', quantita: 5 } },
    { soglia: 3,   titolo: 'Viaggiatore',            ricompensa: { tipo: 'stampino', riferimento: 'viaggiatore' } },
    { soglia: 5,   titolo: 'Esploratore',            ricompensa: { tipo: 'polvere', quantita: 15 } },
    { soglia: 10,  titolo: 'Globetrotter',           ricompensa: { tipo: 'bustina', quantita: 1 } },
    { soglia: 20,  titolo: 'Cartografo',             ricompensa: { tipo: 'stampino', riferimento: 'cartografo' } },
    { soglia: 30,  titolo: 'Viaggiatore esperto',    ricompensa: { tipo: 'polvere', quantita: 30 } },
    { soglia: 50,  titolo: 'Esploratore instancabile', ricompensa: { tipo: 'bustina', riferimento: 'speciale' } },
    { soglia: 100, titolo: 'Mappa vivente',          ricompensa: { tipo: 'stampino', riferimento: 'raro' } },
    { soglia: 250, titolo: 'Giro del mondo',         ricompensa: { tipo: 'polvere', quantita: 100 } },
    { soglia: 500, titolo: 'Ovunque tu vada',        ricompensa: { tipo: 'stampino', riferimento: 'leggendario' } },
]);

const SCALA_WISHLIST = _generaScalaTraguardi('t_wishlist', 'wishlist_totale', [
    { soglia: 1,    titolo: 'Primo desiderio',        ricompensa: { tipo: 'polvere', quantita: 3 } },
    { soglia: 5,    titolo: 'Cacciatore',              ricompensa: { tipo: 'polvere', quantita: 5 } },
    { soglia: 10,   titolo: 'Wishlist attiva',         ricompensa: { tipo: 'polvere', quantita: 10 } },
    { soglia: 25,   titolo: 'Cacciatore esperto',      ricompensa: { tipo: 'stampino', riferimento: 'cacciatore' } },
    { soglia: 50,   titolo: 'Lista dei desideri',      ricompensa: { tipo: 'bustina', quantita: 1 } },
    { soglia: 100,  titolo: 'Cacciatore instancabile', ricompensa: { tipo: 'polvere', quantita: 50 } },
    { soglia: 250,  titolo: 'Obiettivi ambiziosi',     ricompensa: { tipo: 'stampino', riferimento: 'raro' } },
    { soglia: 500,  titolo: 'Wishlist infinita',       ricompensa: { tipo: 'polvere', quantita: 100 } },
    { soglia: 1000, titolo: 'Collezionista esigente',  ricompensa: { tipo: 'bustina', quantita: 2 } },
    { soglia: 2500, titolo: 'Tutto in lista',          ricompensa: { tipo: 'stampino', riferimento: 'leggendario' } },
]);

const SCALA_DOPPIONI = _generaScalaTraguardi('t_doppioni', 'doppioni_totali', [
    { soglia: 1,    titolo: 'Primo doppione',       ricompensa: { tipo: 'polvere', quantita: 3 } },
    { soglia: 5,    titolo: 'Riserva',               ricompensa: { tipo: 'polvere', quantita: 5 } },
    { soglia: 10,   titolo: 'Doppietta',             ricompensa: { tipo: 'polvere', quantita: 10 } },
    { soglia: 25,   titolo: 'Scorta personale',      ricompensa: { tipo: 'stampino', riferimento: 'doppione' } },
    { soglia: 50,   titolo: 'Magazzino',             ricompensa: { tipo: 'bustina', quantita: 1 } },
    { soglia: 100,  titolo: 'Accumulo',              ricompensa: { tipo: 'polvere', quantita: 50 } },
    { soglia: 250,  titolo: 'Collezionista seriale', ricompensa: { tipo: 'stampino', riferimento: 'raro' } },
    { soglia: 500,  titolo: 'Riserva strategica',    ricompensa: { tipo: 'polvere', quantita: 100 } },
    { soglia: 1000, titolo: 'Montagna di doppioni',  ricompensa: { tipo: 'bustina', quantita: 2 } },
    { soglia: 2500, titolo: 'Tesoro duplicato',      ricompensa: { tipo: 'stampino', riferimento: 'leggendario' } },
]);
// NOTA: "Fai scorta" (titolo originale soglia 5) rinominato "Riserva" per
// conflitto con missione m03_fai_scorta — vedi Catalogo_Missioni_Traguardi_Annotato.md

const SCALA_MISSIONI_TOTALI = _generaScalaTraguardi('t_missioni', 'missioni_completate_totale', [
    { soglia: 1,    titolo: 'Prima missione',          ricompensa: { tipo: 'stampino', riferimento: 'recluta' } },
    { soglia: 5,    titolo: 'Recluta',                 ricompensa: { tipo: 'polvere', quantita: 10 } },
    { soglia: 10,   titolo: 'Apprendista missioni',    ricompensa: { tipo: 'polvere', quantita: 15 } },
    { soglia: 25,   titolo: 'Cacciatore di quest',     ricompensa: { tipo: 'stampino' } },
    { soglia: 50,   titolo: 'Mission Runner',          ricompensa: { tipo: 'bustina', quantita: 1 } },
    { soglia: 100,  titolo: 'Veterano delle missioni', ricompensa: { tipo: 'polvere', quantita: 50 } },
    { soglia: 250,  titolo: 'Specialista',             ricompensa: { tipo: 'stampino', riferimento: 'raro' } },
    { soglia: 500,  titolo: 'Maestro delle missioni',  ricompensa: { tipo: 'bustina', quantita: 2 } },
    { soglia: 1000, titolo: 'Leggenda delle quest',    ricompensa: { tipo: 'stampino', riferimento: 'leggendario' } },
    { soglia: 2500, titolo: 'Instancabile',            ricompensa: { tipo: 'polvere', quantita: 250 } },
]);
// NOTA: "Inarrestabile" (titolo originale soglia 2500) rinominato "Instancabile"
// per conflitto con missione m51_inarrestabile.

// FASE 2 sbloccata (2026-08-29): traguardi #76-85, Accessi — richiede
// activity_log, vedi missioniAccessiTotali() in data/missioni.repository.js.
const SCALA_ACCESSI = _generaScalaTraguardi('t_accessi', 'accessi_totali', [
    { soglia: 1,    titolo: 'Benvenuto',            ricompensa: { tipo: 'polvere', quantita: 3 } },
    { soglia: 3,    titolo: 'Abitudine',            ricompensa: { tipo: 'polvere', quantita: 5 } },
    { soglia: 7,    titolo: 'Frequentatore',        ricompensa: { tipo: 'polvere', quantita: 10 } },
    { soglia: 30,   titolo: 'Cliente abituale',     ricompensa: { tipo: 'stampino' } },
    { soglia: 100,  titolo: 'Presenza costante',    ricompensa: { tipo: 'bustina', quantita: 1 } },
    { soglia: 250,  titolo: 'Veterano',             ricompensa: { tipo: 'polvere', quantita: 50 } },
    { soglia: 500,  titolo: 'Punto fermo',          ricompensa: { tipo: 'stampino', riferimento: 'raro' } },
    { soglia: 1000, titolo: 'Storico CardSync',     ricompensa: { tipo: 'bustina', quantita: 2 } },
    { soglia: 2500, titolo: 'Leggenda del Pokédex', ricompensa: { tipo: 'stampino', riferimento: 'leggendario' } },
    { soglia: 5000, titolo: 'Sempre qui',           ricompensa: { tipo: 'polvere', quantita: 250 } },
]);

// FASE 2 sbloccata (2026-08-29), TEMA CAMBIATO da "binder visitati" a
// "binder aperti" — stesso motivo delle missioni #18-20 sopra (nessuna
// identità visitatore disponibile, evento attribuito al proprietario).
// Titoli originali (#56-65: Prima visita, Curioso, Esploratore...)
// sostituiti — presumevano un attore-visitatore.
const SCALA_BINDER_APERTURE = _generaScalaTraguardi('t_binder_aperture', 'binder_aperture_totale', [
    { soglia: 1,    titolo: 'Prima scoperta',        ricompensa: { tipo: 'polvere', quantita: 3 } },
    { soglia: 5,    titolo: 'Piccola fama',          ricompensa: { tipo: 'polvere', quantita: 5 } },
    { soglia: 10,   titolo: 'Ti conoscono',          ricompensa: { tipo: 'polvere', quantita: 10 } },
    { soglia: 25,   titolo: 'Volto noto',            ricompensa: { tipo: 'stampino' } },
    { soglia: 50,   titolo: 'Punto di riferimento',  ricompensa: { tipo: 'bustina', quantita: 1 } },
    { soglia: 100,  titolo: 'Molto seguito',         ricompensa: { tipo: 'polvere', quantita: 50 } },
    { soglia: 250,  titolo: 'Popolare nel gruppo',   ricompensa: { tipo: 'stampino', riferimento: 'raro' } },
    { soglia: 500,  titolo: 'Un classico',           ricompensa: { tipo: 'polvere', quantita: 100 } },
    { soglia: 1000, titolo: 'Leggenda condivisa',    ricompensa: { tipo: 'bustina', quantita: 2 } },
    { soglia: 2500, titolo: 'Il binder più visto',   ricompensa: { tipo: 'stampino', riferimento: 'leggendario' } },
]);
// NOTA: traguardi #56-65 originali (binder visitati da TE) restano FASE 2
// permanentemente bloccati, stesso motivo delle missioni #21/#22 sopra.

// Traguardi singoli (non in scala)
const TRAGUARDI_SINGOLI = [
    { id: 't_giorno_impeccabile', titolo: 'Giorno impeccabile', categoria: 'meta',
      metrica: 'giorno_perfetto_mai', operatore: '==', valore: true,
      ricompensa: { tipo: 'bustina', quantita: 1 },
      nota: 'ex "Giornata perfetta" — rinominato per conflitto con missione m53. Sbloccato la prima volta che percentuale_missioni_giorno raggiunge 100%.' },
];

const CATALOGO_TRAGUARDI = [
    ...SCALA_CARTE,
    ...SCALA_VALORE,
    ...SCALA_LOCATION,
    ...SCALA_WISHLIST,
    ...SCALA_DOPPIONI,
    ...SCALA_MISSIONI_TOTALI,
    ...SCALA_ACCESSI,
    ...SCALA_BINDER_APERTURE,
    ...TRAGUARDI_SINGOLI,
];
// Traguardi #46-55 (Match), #56-65 (binder visitati), #98 (Collezionista
// completo, categorie) restano FASE 2 — non inclusi qui.
// Traguardi #99/#100 (soglie su traguardi sbloccati totali) sono PENDING:
// le soglie originali (50/100) presumono il catalogo completo a 100 voci,
// da ricalcolare quando anche il resto della Fase 2 sarà implementato.


// ----------------------------------------------------------------------------
// MOTORE DI VALUTAZIONE GENERICO
// ----------------------------------------------------------------------------
// Riceve un oggetto "dati" con i valori già calcolati delle metriche (vedi
// elenco sotto) e valuta condizione/soglia. Il motore NON fa query dirette
// al DB — quello spetta a data/*.repository.js (mai chiamare supabaseClient
// da qui), secondo il pattern del progetto: UI raccoglie input → chiama
// repository → passa i dati al motore.
//
// METRICHE ATTESE nell'oggetto "dati" (da calcolare in un repository dedicato,
// es. data/missioni.repository.js — NON ANCORA SCRITTO, prossimo passo):
//   carte_aggiunte_periodo     — count(carte) WHERE owner_id=X AND created_at IN periodo
//   prezzi_aggiornati_periodo  — count(DISTINCT carta_id) FROM storico_prezzi WHERE ... IN periodo
//   errori_risolti_oggi        — da preferenze_utente.dafare_risolti (ultime 24h)
//   errori_coda_vuota          — boolean, coda_carte/coda_wishlist stato='errore' count==0
//   carte_totali               — count(carte) WHERE owner_id=X
//   valore_collezione          — sum(carte.prezzo) WHERE owner_id=X
//   location_distinte          — count(DISTINCT location) su location o su carte.location
//   location_aggiunta_periodo  — carta con location valorizzata, created_at IN periodo
//   wishlist_totale            — count(wishlist) WHERE owner_id=X
//   wishlist_obiettivi_raggiunti — count wishlist/carte con prezzo<=prezzo_obiettivo
//   doppioni_totali            — count(carte) WHERE qty>1
//   carte_stessa_espansione_max — max count raggruppando per codice-espansione
//   carte_stessa_rarita_max    — max count raggruppando per rarità
//   rarita_distinte            — count(DISTINCT rarità) tra le carte
//   match_attivi_totale        — length(trovaMatch()) — riusa funzione esistente in queue.ui.js
//   binder_pubblicati_periodo  — count(binders) WHERE stato_pubblicazione='pubblico' AND created_at IN periodo
//   prezzi_scaduti_totale      — carte.ultimo_controllo IS NULL OR < oggi-SOGLIA_GIORNI_PREZZO_SCADUTO giorni (vedi ui/prices.ui.js:apriModalePrezziScaduti). Solo collezione, non wishlist (stessa scelta di caricaUltimaSincronizzazioneHome).
//   estensione_aperta_periodo  — RICHIEDE nuova scrittura sul canale chrome.runtime esistente
//   layout_modificato_periodo  — confronto layout salvato prima/dopo, al momento del salvataggio
//   missioni_completate_totale — count(missioni_completate) WHERE owner_id=X
//   missioni_completate_periodo — count(missioni_completate) WHERE owner_id=X AND periodo=Y
//   percentuale_missioni_giorno — (missioni_completate oggi / missioni assegnate oggi) * 100
//   giorno_perfetto_mai        — boolean, true se mai raggiunto 100% in un giorno (per traguardo)
//
// Diverse di queste richiedono ancora funzioni repository non scritte in
// questa sessione (non avevo accesso a data/*.repository.js) — vedi nota di
// consegna in fondo alla chat.

const MOTORE_MISSIONI = {

    _operatori: {
        '>=': (a, b) => a >= b,
        '>':  (a, b) => a > b,
        '==': (a, b) => a === b,
        '<=': (a, b) => a <= b,
        '<':  (a, b) => a < b,
    },

    // Valuta una singola voce (missione o traguardo) contro l'oggetto dati.
    valuta(voce, dati) {
        const valoreAttuale = dati[voce.metrica];
        if (valoreAttuale === undefined) {
            console.warn(`[missioni] metrica "${voce.metrica}" assente nei dati per voce "${voce.id}"`);
            return false;
        }
        const op = this._operatori[voce.operatore];
        if (!op) {
            console.warn(`[missioni] operatore "${voce.operatore}" non riconosciuto per voce "${voce.id}"`);
            return false;
        }
        return op(valoreAttuale, voce.valore);
    },

    // Valuta l'intero catalogo missioni contro i dati, ritorna le voci soddisfatte.
    valutaMissioni(dati) {
        return CATALOGO_MISSIONI.filter(m => this.valuta(m, dati));
    },

    // Valuta l'intero catalogo traguardi contro i dati, ritorna le voci soddisfatte.
    valutaTraguardi(dati) {
        return CATALOGO_TRAGUARDI.filter(t => this.valuta(t, dati));
    },

    // Selezione deterministica delle missioni per finestra, di un utente.
    // Stesso input (owner_id + chiave periodo) => stesso output, sempre.
    // Nessuna tabella "missioni_assegnate": ricalcolato ad ogni apertura
    // pagina. Generalizzata (2026-08-30, Claudio) dalla sola giornaliera
    // alle tre finestre ricorrenti — le una_tantum NON passano da qui,
    // restano sempre "in gioco" tutte insieme (sono obiettivi permanenti,
    // non ha senso nasconderne a sorte alcune).
    NUMERO_MISSIONI_GIORNO: 4,
    NUMERO_MISSIONI_SETTIMANA: 2,
    NUMERO_MISSIONI_MESE: 2,

    _hashSemplice(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) {
            h = ((h << 5) - h + str.charCodeAt(i)) | 0;
        }
        return Math.abs(h);
    },

    // pool: array di missioni già filtrate per finestra. chiavePeriodo:
    // stringa stabile per l'unità di tempo corrente (data/settimana/mese).
    // numero: quante estrarre — se il pool è più piccolo del numero
    // richiesto (caso comune oggi per settimanali/mensili, pool ancora
    // piccoli), ritorna semplicemente tutto il pool.
    _estraiDaPool(ownerId, chiavePeriodo, pool, numero) {
        const seme = this._hashSemplice(ownerId + '|' + chiavePeriodo);
        // Fisher-Yates deterministico usando il seme come sorgente pseudo-casuale
        const copia = [...pool];
        let s = seme;
        for (let i = copia.length - 1; i > 0; i--) {
            s = (s * 1103515245 + 12345) & 0x7fffffff;
            const j = s % (i + 1);
            [copia[i], copia[j]] = [copia[j], copia[i]];
        }
        return copia.slice(0, numero);
    },

    missioniDelGiorno(ownerId, dataISO) {
        const pool = CATALOGO_MISSIONI.filter(m => m.finestra === 'giornaliera');
        return this._estraiDaPool(ownerId, dataISO, pool, this.NUMERO_MISSIONI_GIORNO);
    },

    missioniDellaSettimana(ownerId, periodoSettimana) {
        const pool = CATALOGO_MISSIONI.filter(m => m.finestra === 'settimanale');
        return this._estraiDaPool(ownerId, periodoSettimana, pool, this.NUMERO_MISSIONI_SETTIMANA);
    },

    missioniDelMese(ownerId, periodoMese) {
        const pool = CATALOGO_MISSIONI.filter(m => m.finestra === 'mensile');
        return this._estraiDaPool(ownerId, periodoMese, pool, this.NUMERO_MISSIONI_MESE);
    },

    // ── Periodo corrente per finestra ─────────────────────────────────
    // 'periodo' è la stringa salvata in missioni_completate.periodo (chiave
    // dello UNIQUE insieme a owner_id+missione_id — vedi migration 32).
    // inizioISO/fineISO servono alle query *_periodo del repository
    // (created_at/registrato_il >= inizio AND < fine).
    _pad2(n) { return String(n).padStart(2, '0'); },

    _isoData(d) { return `${d.getFullYear()}-${this._pad2(d.getMonth() + 1)}-${this._pad2(d.getDate())}`; },

    _numeroSettimanaISO(d) {
        // Algoritmo standard settimana ISO-8601 (lunedì primo giorno).
        const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const giornoSett = (dt.getUTCDay() + 6) % 7; // lunedì=0
        dt.setUTCDate(dt.getUTCDate() - giornoSett + 3);
        const primoGennaio = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
        const numero = 1 + Math.round(((dt - primoGennaio) / 86400000 - 3 + ((primoGennaio.getUTCDay() + 6) % 7)) / 7);
        return { anno: dt.getUTCFullYear(), settimana: numero };
    },

    periodoCorrente(finestra, ora = new Date()) {
        if (finestra === 'una_tantum') return { periodo: 'sempre', inizioISO: null, fineISO: null };

        if (finestra === 'giornaliera') {
            const inizio = new Date(ora.getFullYear(), ora.getMonth(), ora.getDate());
            const fine = new Date(inizio); fine.setDate(fine.getDate() + 1);
            return { periodo: this._isoData(inizio), inizioISO: inizio.toISOString(), fineISO: fine.toISOString() };
        }

        if (finestra === 'settimanale') {
            const giornoSett = (ora.getDay() + 6) % 7; // lunedì=0
            const lunedi = new Date(ora.getFullYear(), ora.getMonth(), ora.getDate() - giornoSett);
            const prossimoLunedi = new Date(lunedi); prossimoLunedi.setDate(prossimoLunedi.getDate() + 7);
            const { anno, settimana } = this._numeroSettimanaISO(ora);
            return { periodo: `${anno}-W${this._pad2(settimana)}`, inizioISO: lunedi.toISOString(), fineISO: prossimoLunedi.toISOString() };
        }

        if (finestra === 'mensile') {
            const inizio = new Date(ora.getFullYear(), ora.getMonth(), 1);
            const fine = new Date(ora.getFullYear(), ora.getMonth() + 1, 1);
            return { periodo: `${ora.getFullYear()}-${this._pad2(ora.getMonth() + 1)}`, inizioISO: inizio.toISOString(), fineISO: fine.toISOString() };
        }

        throw new Error(`periodoCorrente: finestra "${finestra}" non riconosciuta`);
    },

    // ── Raccolta dati ──────────────────────────────────────────────────
    // Chiama i repository necessari per TUTTE le metriche Fase 1 e
    // restituisce l'oggetto "dati" pronto per valuta()/valutaMissioni()/
    // valutaTraguardi(). Un solo giro di Promise.all per chiamata.
    async raccogliDati(userId) {
        const oggi = this.periodoCorrente('giornaliera');
        const settimana = this.periodoCorrente('settimanale');

        const [
            carteAggiunteOggi, carteTotali, valoreCollezione, doppioniTotali,
            locationDistinte, locationAggiuntaOggi, espansioneMax,
            prezziAggiornatiOggi, prezziAggiornatiSettimana, prezziScaduti,
            wishlistTotale, wishlistObiettivi,
            matchAttivi, binderPubblicatiOggi,
            codaVuota, codaAzzerataOggi,
            missioniTotali, missioniOggi,
            accessoOggi, accessiTotali, giorniConsecutivi,
            ricercheOggi,
            binderAperturePeriodo, binderApertureTotale,
            completateOggiRange, completateSettimanaRange,
        ] = await Promise.all([
            missioniCarteAggiuntePeriodo(userId, oggi.inizioISO, oggi.fineISO),
            missioniCarteTotali(userId),
            missioniValoreCollezione(userId),
            missioniDoppioniTotali(userId),
            missioniLocationDistinte(userId),
            missioniLocationAggiuntaPeriodo(userId, oggi.inizioISO, oggi.fineISO),
            missioniCarteStessaEspansioneMax(userId),
            missioniPrezziAggiornatiPeriodo(userId, 'carte', oggi.inizioISO, oggi.fineISO),
            missioniPrezziAggiornatiPeriodo(userId, 'carte', settimana.inizioISO, settimana.fineISO),
            missioniPrezziScadutiTotale(userId),
            missioniWishlistTotale(userId),
            missioniWishlistObiettiviRaggiunti(userId),
            missioniMatchAttiviTotale(userId),
            missioniBinderPubblicatiPeriodo(userId, oggi.inizioISO, oggi.fineISO),
            missioniErroriCodaVuota(userId),
            missioniCodaErroriAzzerataOggi(userId),
            missioniCompletateTotale(userId),
            missioniCompletatePeriodo(userId, oggi.periodo),
            missioniAccessoOggi(userId),
            missioniAccessiTotali(userId),
            missioniGiorniConsecutivi(userId),
            missioniRicercheEseguitePeriodo(userId, oggi.inizioISO, oggi.fineISO),
            missioniBinderAperturePeriodo(userId, oggi.inizioISO, oggi.fineISO),
            missioniBinderApertureTotale(userId),
            missioniCompletateIdRangeTemporale(userId, oggi.inizioISO, oggi.fineISO),
            missioniCompletateIdRangeTemporale(userId, settimana.inizioISO, settimana.fineISO),
        ]);

        // Ogni chiamata sopra ritorna { data, error } o { count, error } (le
        // *_totale con head:true) — normalizzo qui, un errore singolo non
        // deve far fallire l'intera raccolta (resta 0/false, loggato).
        const v = (r, campo = 'data') => {
            if (r && r.error) { console.warn('[missioni] raccoglata dati:', r.error.message); return 0; }
            return r ? (r[campo] ?? r.count ?? 0) : 0;
        };

        const numeroMissioniOggiCompletate = v(missioniOggi, 'count');
        const poolOggi = this.missioniDelGiorno(userId, oggi.periodo).length;

        // Categorie (#96-98): mappa missione_id → categoria usando il
        // catalogo JS (il DB non conosce le categorie, sono solo qui).
        const _categoriaDi = (missioneId) => {
            const m = CATALOGO_MISSIONI.find(x => x.id === missioneId);
            return m ? m.categoria : null;
        };
        const _idsDaRange = (r) => {
            if (r && r.error) { console.warn('[missioni] raccolta dati (categorie):', r.error.message); return []; }
            return (r && r.data) ? r.data.map(row => row.missione_id) : [];
        };
        const categorieOggi = new Set(_idsDaRange(completateOggiRange).map(_categoriaDi).filter(Boolean));
        const categorieSettimana = new Set(_idsDaRange(completateSettimanaRange).map(_categoriaDi).filter(Boolean));
        const totaleCategorieCatalogo = new Set(CATALOGO_MISSIONI.map(m => m.categoria)).size;

        return {
            carte_aggiunte_periodo: v(carteAggiunteOggi, 'count'),
            carte_totali: v(carteTotali, 'count'),
            valore_collezione: v(valoreCollezione),
            doppioni_totali: v(doppioniTotali, 'count'),
            location_distinte: v(locationDistinte),
            location_aggiunta_periodo: v(locationAggiuntaOggi, 'count'),
            carte_stessa_espansione_max: v(espansioneMax),
            prezzi_aggiornati_periodo: v(prezziAggiornatiOggi),
            prezzi_aggiornati_settimana: v(prezziAggiornatiSettimana),
            prezzi_scaduti_totale: v(prezziScaduti, 'count'),
            wishlist_totale: v(wishlistTotale, 'count'),
            wishlist_obiettivi_raggiunti: v(wishlistObiettivi, 'count'),
            match_attivi_totale: v(matchAttivi),
            binder_pubblicati_periodo: v(binderPubblicatiOggi, 'count'),
            errori_coda_vuota: v(codaVuota),
            coda_errori_azzerata_oggi: v(codaAzzerataOggi),
            missioni_completate_totale: v(missioniTotali, 'count'),
            missioni_completate_periodo: numeroMissioniOggiCompletate,
            percentuale_missioni_giorno: poolOggi > 0 ? Math.round((numeroMissioniOggiCompletate / poolOggi) * 100) : 0,
            giorno_perfetto_mai: poolOggi > 0 && numeroMissioniOggiCompletate >= poolOggi,
            accesso_oggi: v(accessoOggi),
            accessi_totali: v(accessiTotali, 'count'),
            giorni_consecutivi: v(giorniConsecutivi),
            ricerche_eseguite_periodo: v(ricercheOggi, 'count'),
            binder_aperture_periodo: v(binderAperturePeriodo, 'count'),
            binder_aperture_totale: v(binderApertureTotale, 'count'),
            categorie_distinte_periodo: categorieOggi.size,
            categorie_distinte_settimana: categorieSettimana.size,
            collezione_e_social_oggi: categorieOggi.has('inserimento') && categorieOggi.has('social'),
            tutte_categorie_coperte_settimana: categorieSettimana.size >= totaleCategorieCatalogo,
        };
    },

    // ── Valutazione + assegnazione automatica ───────────────────────────
    // Raccoglie i dati, valuta l'intero catalogo Fase 1, e per ogni voce
    // soddisfatta prova a INSERIRE il completamento/riscossione. L'UNIQUE
    // di migration 32 (owner_id+periodo+missione_id / owner_id+traguardo_id)
    // fa da guardia anti-doppio-accredito: un insert che fallisce con
    // 23505 significa "già assegnata", non è un errore — non si assegna di
    // nuovo la ricompensa. Solo gli insert riusciti (novità vere) tornano
    // nell'elenco "nuove" per il feedback visivo alla pagina che chiama.
    //
    // SECONDO GIRO (bug trovato e corretto, 2026-08-30): le missioni/
    // traguardi "meta" (m51-54, m96-100, t_giorno_impeccabile) dipendono da
    // missioni_completate — ma 'dati' è calcolato PRIMA di inserire i
    // completamenti di QUESTO stesso giro. Se in un solo giro l'utente
    // completa abbastanza missioni "normali" da far scattare anche una
    // meta (es. 5 categorie diverse per m98 "Tuttofare"), la meta non
    // verrebbe rilevata finché non si riapre la pagina una seconda volta —
    // non è "automatico, si sblocca da solo" come deciso. Fix: se il primo
    // giro ha inserito qualcosa, ricalcolo 'dati' da capo e rifaccio un
    // secondo giro completo. Sicuro farlo sempre (anche se non necessario):
    // le missioni non-meta dipendono solo da stato reale (mai da altre
    // missioni), quindi non c'è rischio di catena infinita — un secondo
    // giro è sempre sufficiente, mai serve un terzo.
    async valutaEAssegna(userId) {
        const primoGiro = await this._valutaEAssegnaUnGiro(userId);

        if (primoGiro.nuoveMissioni.length === 0 && primoGiro.nuoviTraguardi.length === 0) {
            return primoGiro; // niente di nuovo, nessun secondo giro necessario
        }

        const secondoGiro = await this._valutaEAssegnaUnGiro(userId);
        return {
            dati: secondoGiro.dati, // il più aggiornato dei due
            missioniOggiPool: secondoGiro.missioniOggiPool,
            missioniSettimanaPool: secondoGiro.missioniSettimanaPool,
            missioniMesePool: secondoGiro.missioniMesePool,
            nuoveMissioni: [...primoGiro.nuoveMissioni, ...secondoGiro.nuoveMissioni],
            nuoviTraguardi: [...primoGiro.nuoviTraguardi, ...secondoGiro.nuoviTraguardi],
        };
    },

    // Singolo giro raccolta-valutazione-assegnazione — estratto da
    // valutaEAssegna() sopra per poterlo richiamare due volte in sequenza.
    async _valutaEAssegnaUnGiro(userId) {
        const dati = await this.raccogliDati(userId);

        const oggi = this.periodoCorrente('giornaliera');
        const settimana = this.periodoCorrente('settimanale');
        const mese = this.periodoCorrente('mensile');
        const missioniOggiPool = this.missioniDelGiorno(userId, oggi.periodo);
        const missioniSettimanaPool = this.missioniDellaSettimana(userId, settimana.periodo);
        const missioniMesePool = this.missioniDelMese(userId, mese.periodo);

        // "In gioco" (2026-08-30, generalizzato): giornaliere/settimanali/
        // mensili SOLO se estratte nel pool della loro finestra corrente —
        // le una_tantum restano sempre tutte in gioco (obiettivi permanenti,
        // nessuna estrazione a sorte per quelle, vedi missioniDelGiorno
        // e sorelle qui sopra).
        const pool = { giornaliera: missioniOggiPool, settimanale: missioniSettimanaPool, mensile: missioniMesePool };
        const inGioco = CATALOGO_MISSIONI.filter(m =>
            m.finestra === 'una_tantum' || (pool[m.finestra] || []).some(p => p.id === m.id)
        );
        const missioniSoddisfatte = inGioco.filter(m => this.valuta(m, dati));
        const traguardiSoddisfatti = this.valutaTraguardi(dati);

        const nuoveMissioni = [];
        for (const m of missioniSoddisfatte) {
            const { periodo } = this.periodoCorrente(m.finestra);
            const { error } = await missioniInserisciCompletamento(userId, m.id, m.finestra, periodo);
            if (!error) {
                nuoveMissioni.push(m);
                await ricompenseInserisci(userId, m.ricompensa.tipo, m.id, m.ricompensa.quantita || 1);
            } else if (error.code !== '23505') {
                console.error('[missioni] errore assegnazione', m.id, error.message);
            }
        }

        const nuoviTraguardi = [];
        for (const t of traguardiSoddisfatti) {
            const { error } = await traguardiInserisciRiscossione(userId, t.id);
            if (!error) {
                nuoviTraguardi.push(t);
                await ricompenseInserisci(userId, t.ricompensa.tipo, t.id, t.ricompensa.quantita || 1);
            } else if (error.code !== '23505') {
                console.error('[missioni] errore riscossione', t.id, error.message);
            }
        }

        return { dati, missioniOggiPool, missioniSettimanaPool, missioniMesePool, nuoveMissioni, nuoviTraguardi };
    },
};
