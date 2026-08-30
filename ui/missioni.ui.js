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
      finestra: 'giornaliera', metrica: 'errori_risolti_oggi', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 3 } },

    { id: 'm12_pulizia_straordinaria', titolo: 'Pulizia straordinaria', categoria: 'inserimento',
      finestra: 'giornaliera', metrica: 'errori_risolti_oggi', operatore: '>=', valore: 3,
      ricompensa: { tipo: 'polvere', quantita: 7 } },

    { id: 'm16_cacciatore_di_carte', titolo: 'Cacciatore di carte', categoria: 'inserimento',
      finestra: 'giornaliera', metrica: 'carte_aggiunte_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 2 },
      nota: 'duplicato concettuale di m02_una_carta_in_piu — il motore di assegnazione giornaliera deve evitare di estrarle insieme' },

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

    { id: 'm57_raccoglitore', titolo: 'Raccoglitore', categoria: 'inserimento',
      finestra: 'giornaliera', metrica: 'carte_stessa_espansione_max', operatore: '>=', valore: 2,
      ricompensa: { tipo: 'polvere', quantita: 4 },
      nota: 'stato cumulativo (gruppo più numeroso per espansione), non vincolato a "aggiunte oggi"' },

    { id: 'm58_rarita_gemelle', titolo: 'Rarità gemelle', categoria: 'inserimento',
      finestra: 'giornaliera', metrica: 'carte_stessa_rarita_max', operatore: '>=', valore: 2,
      ricompensa: { tipo: 'polvere', quantita: 4 },
      nota: 'ex "Doppietta" — rinominata per conflitto con traguardo #68, vedi Catalogo_Missioni_Traguardi_Annotato.md' },

    { id: 'm59_varieta', titolo: 'Varietà', categoria: 'inserimento',
      finestra: 'giornaliera', metrica: 'rarita_distinte', operatore: '>=', valore: 3,
      ricompensa: { tipo: 'polvere', quantita: 6 } },

    { id: 'm63_un_desiderio_in_meno', titolo: 'Un desiderio in meno', categoria: 'prezzi',
      finestra: 'giornaliera', metrica: 'wishlist_obiettivi_raggiunti', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 5 } },

    { id: 'm64_obiettivo_raggiunto', titolo: 'Obiettivo raggiunto', categoria: 'prezzi',
      finestra: 'giornaliera', metrica: 'wishlist_obiettivi_raggiunti', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 6 },
      nota: 'duplicato concettuale di m63' },

    { id: 'm66_aggiornamento_completo', titolo: 'Aggiornamento completo', categoria: 'prezzi',
      finestra: 'settimanale', metrica: 'prezzi_aggiornati_periodo', operatore: '>=', valore: 5,
      ricompensa: { tipo: 'polvere', quantita: 10 } },

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
    ...TRAGUARDI_SINGOLI,
];
// Traguardi #46-55 (Match), #56-65 (binder visitati), #76-85 (accessi), #98
// (Collezionista completo, categorie) sono FASE 2 — non inclusi qui.
// Traguardi #99/#100 (soglie su traguardi sbloccati totali) sono PENDING:
// le soglie originali (50/100) presumono il catalogo completo a 100 voci,
// da ricalcolare quando anche la Fase 2 sarà implementata.


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
//   prezzi_scaduti_totale      — riusa segnale già calcolato dal widget "Da fare"
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

    // Selezione deterministica delle missioni giornaliere di un utente.
    // Stesso input (owner_id + data) => stesso output, sempre. Nessuna
    // tabella "missioni_assegnate": ricalcolato ad ogni apertura pagina.
    // NUMERO_MISSIONI_GIORNO: quante missioni giornaliere estrarre (deciso: 4).
    NUMERO_MISSIONI_GIORNO: 4,

    _hashSemplice(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) {
            h = ((h << 5) - h + str.charCodeAt(i)) | 0;
        }
        return Math.abs(h);
    },

    missioniDelGiorno(ownerId, dataISO) {
        const pool = CATALOGO_MISSIONI.filter(m => m.finestra === 'giornaliera');
        const seme = this._hashSemplice(ownerId + '|' + dataISO);
        // Fisher-Yates deterministico usando il seme come sorgente pseudo-casuale
        const copia = [...pool];
        let s = seme;
        for (let i = copia.length - 1; i > 0; i--) {
            s = (s * 1103515245 + 12345) & 0x7fffffff;
            const j = s % (i + 1);
            [copia[i], copia[j]] = [copia[j], copia[i]];
        }
        return copia.slice(0, this.NUMERO_MISSIONI_GIORNO);
    },
};
