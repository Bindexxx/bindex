// Catalogo di missioni e traguardi (solo dati).

const CATALOGO_MISSIONI = [
    { id: 'm01_primo_accesso', titolo: 'Primo accesso', categoria: 'costanza',
      finestra: 'giornaliera', metrica: 'accesso_oggi', operatore: '==', valore: true,
      ricompensa: { tipo: 'polvere', quantita: 1 },
      nota: 'FASE 2 sbloccata (2026-08-29): richiede activity_log, agganciata in ui/auth.ui.js:_avviaSitoDopoAccesso()' },

    { id: 'm101_in_serie', titolo: 'In serie', categoria: 'costanza',
      finestra: 'giornaliera', metrica: 'giorni_consecutivi', operatore: '>=', valore: 3,
      ricompensa: { tipo: 'polvere', quantita: 3 } },

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

    { id: 'm06_occhiata_alla_collezione', titolo: 'Occhiata alla collezione', categoria: 'esplorazione',
      finestra: 'giornaliera', metrica: 'apertura_visualizzazione_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 2 } },

    { id: 'm07_controllo_wishlist', titolo: 'Controllo Wishlist', categoria: 'esplorazione',
      finestra: 'giornaliera', metrica: 'apertura_wishlist_obiettivi_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 2 } },

    { id: 'm08_occhiata_ai_prezzi', titolo: "Dai un'occhiata ai prezzi", categoria: 'esplorazione',
      finestra: 'giornaliera', metrica: 'apertura_prezzi_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 2 } },

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

    { id: 'm13_sfoglia_larchivio', titolo: "Sfoglia l'archivio", categoria: 'esplorazione',
      finestra: 'giornaliera', metrica: 'apertura_dettaglio_carta_periodo', operatore: '>=', valore: 10,
      ricompensa: { tipo: 'polvere', quantita: 8 } },

    { id: 'm14_cerca_un_doppione', titolo: 'Cerca un doppione', categoria: 'esplorazione',
      finestra: 'giornaliera', metrica: 'apertura_doppioni_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 2 } },

    { id: 'm16_cacciatore_di_carte', titolo: 'Cacciatore di carte', categoria: 'inserimento',
      finestra: 'giornaliera', metrica: 'carte_aggiunte_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 2 },
      nota: 'duplicato concettuale di m02_una_carta_in_piu — il motore di assegnazione giornaliera deve evitare di estrarle insieme' },

    { id: 'm17_completa_una_ricerca', titolo: 'Completa una ricerca', categoria: 'esplorazione',
      finestra: 'giornaliera', metrica: 'ricerche_eseguite_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 2 } },

    { id: 'm84_cerca_e_trova', titolo: 'Cerca e trova', categoria: 'esplorazione',
      finestra: 'giornaliera', metrica: 'ricerche_eseguite_periodo', operatore: '>=', valore: 3,
      ricompensa: { tipo: 'polvere', quantita: 4 } },

    { id: 'm85_ricerca_completa', titolo: 'Ricerca completa', categoria: 'esplorazione',
      finestra: 'giornaliera', metrica: 'ricerche_eseguite_periodo', operatore: '>=', valore: 5,
      ricompensa: { tipo: 'polvere', quantita: 7 } },

    { id: 'm18_qualcuno_ti_ha_trovato', titolo: 'Qualcuno ti ha trovato', categoria: 'social',
      finestra: 'giornaliera', metrica: 'binder_aperture_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 3 } },

    { id: 'm19_doppio_interesse', titolo: 'Doppio interesse', categoria: 'social',
      finestra: 'giornaliera', metrica: 'binder_aperture_periodo', operatore: '>=', valore: 2,
      ricompensa: { tipo: 'polvere', quantita: 5 } },

    { id: 'm20_molto_cercato', titolo: 'Molto cercato', categoria: 'social',
      finestra: 'giornaliera', metrica: 'binder_aperture_periodo', operatore: '>=', valore: 3,
      ricompensa: { tipo: 'polvere', quantita: 7 } },

    { id: 'm23_match_point', titolo: 'Match point', categoria: 'social',
      finestra: 'giornaliera', metrica: 'apertura_match_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 2 } },

    { id: 'm24_primo_match', titolo: 'Primo Match', categoria: 'social',
      finestra: 'giornaliera', metrica: 'match_attivi_totale', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 4 } },

    { id: 'm25_caccia_di_scambi', titolo: 'A caccia di scambi', categoria: 'social',
      finestra: 'giornaliera', metrica: 'match_attivi_totale', operatore: '>=', valore: 3,
      ricompensa: { tipo: 'polvere', quantita: 7 } },

    { id: 'm27_condividi', titolo: 'Condividi', categoria: 'social',
      finestra: 'giornaliera', metrica: 'binder_pubblicati_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 3 } },

    { id: 'm29_qr_hunter', titolo: 'QR Hunter', categoria: 'social',
      finestra: 'giornaliera', metrica: 'qr_generato_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 3 } },

    { id: 'm30_esplora_una_location', titolo: 'Esplora una location', categoria: 'esplorazione',
      finestra: 'giornaliera', metrica: 'apertura_location_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 2 } },

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

    { id: 'm38_occhio_al_valore', titolo: 'Occhio al valore', categoria: 'esplorazione',
      finestra: 'giornaliera', metrica: 'apertura_valore_collezione_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 2 } },

    { id: 'm40_portfolio', titolo: 'Portfolio', categoria: 'esplorazione',
      finestra: 'giornaliera', metrica: 'apertura_valore_collezione_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 3 },
      nota: 'duplicato concettuale di m38 — "consultare il valore medio" e "consultare il totale" sono la stessa apertura widget (la media è testo statico nell\'header, non un elemento cliccabile separato su cui propagare un\'origine come per m39/m83)' },

    { id: 'm39_tesori_nascosti', titolo: 'Tesori nascosti', categoria: 'esplorazione',
      finestra: 'giornaliera', metrica: 'apertura_carta_top_valore_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 4 } },

    { id: 'm41_prima_apertura', titolo: 'Prima apertura', categoria: 'esplorazione',
      finestra: 'giornaliera', metrica: 'apertura_dettaglio_carta_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 2 } },

    { id: 'm42_carta_preferita', titolo: 'Carta preferita', categoria: 'esplorazione',
      finestra: 'giornaliera', metrica: 'apertura_ultima_carta_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 2 } },

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

    { id: 'm57_raccoglitore', titolo: 'Raccoglitore', categoria: 'inserimento',
      finestra: 'giornaliera', metrica: 'carte_stessa_espansione_max', operatore: '>=', valore: 2,
      ricompensa: { tipo: 'polvere', quantita: 4 },
      nota: 'stato cumulativo (gruppo più numeroso per espansione), non vincolato a "aggiunte oggi"' },

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

    { id: 'm69_binder_aperto', titolo: 'Binder aperto', categoria: 'esplorazione',
      finestra: 'giornaliera', metrica: 'apertura_binder_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 2 } },

    { id: 'm70_binder_pubblico', titolo: 'Binder pubblico', categoria: 'social',
      finestra: 'giornaliera', metrica: 'binder_pubblico_visitato_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 2 } },

    { id: 'm78_esplora_il_gruppo', titolo: 'Esplora il gruppo', categoria: 'social',
      finestra: 'giornaliera', metrica: 'esplorazione_sociale_oggi', operatore: '==', valore: true,
      ricompensa: { tipo: 'polvere', quantita: 3 } },

    { id: 'm79_pokedex_aggiornato', titolo: 'Pokédex aggiornato', categoria: 'estensione',
      finestra: 'giornaliera', metrica: 'apertura_estensione_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 2 } },

    { id: 'm80_numeri_alla_mano', titolo: 'Numeri alla mano', categoria: 'esplorazione',
      finestra: 'giornaliera', metrica: 'apertura_visualizzazione_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 1 } },

    { id: 'm81_conta_tutto', titolo: 'Conta tutto', categoria: 'esplorazione',
      finestra: 'giornaliera', metrica: 'statistiche_distinte_periodo', operatore: '>=', valore: 3,
      ricompensa: { tipo: 'polvere', quantita: 5 } },

    { id: 'm82_occhio_ai_dettagli', titolo: 'Occhio ai dettagli', categoria: 'esplorazione',
      finestra: 'giornaliera', metrica: 'carte_distinte_dettaglio_periodo', operatore: '>=', valore: 3,
      ricompensa: { tipo: 'polvere', quantita: 4 } },

    { id: 'm83_tre_tesori', titolo: 'Tre tesori', categoria: 'esplorazione',
      finestra: 'giornaliera', metrica: 'apertura_carta_top_valore_periodo', operatore: '>=', valore: 3,
      ricompensa: { tipo: 'polvere', quantita: 6 } },

    { id: 'm86_archivio_digitale', titolo: 'Archivio digitale', categoria: 'esplorazione',
      finestra: 'giornaliera', metrica: 'apertura_dettaglio_carta_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 2 } },

    { id: 'm87_ritorno_al_passato', titolo: 'Ritorno al passato', categoria: 'esplorazione',
      finestra: 'giornaliera', metrica: 'carta_vecchia_aperta_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 3 } },

    { id: 'm88_estensione_pronta', titolo: 'Estensione pronta', categoria: 'estensione',
      finestra: 'giornaliera', metrica: 'apertura_estensione_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 2 } },

    { id: 'm89_apri_il_pokedex', titolo: 'Apri il Pokédex', categoria: 'estensione',
      finestra: 'giornaliera', metrica: 'estensione_aperta_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 3 } },

    { id: 'm90_collega_il_mondo', titolo: 'Collega il mondo', categoria: 'estensione',
      finestra: 'giornaliera', metrica: 'estensione_funzione_usata_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 5 } },

    { id: 'm91_widget_explorer', titolo: 'Widget explorer', categoria: 'home',
      finestra: 'giornaliera', metrica: 'widget_distinti_periodo', operatore: '>=', valore: 3,
      ricompensa: { tipo: 'polvere', quantita: 3 } },

    { id: 'm92_telefono_completo', titolo: 'Telefono completo', categoria: 'home',
      finestra: 'giornaliera', metrica: 'widget_distinti_periodo', operatore: '>=', valore: 5,
      ricompensa: { tipo: 'polvere', quantita: 6 } },

    { id: 'm93_panoramica_completa', titolo: 'Panoramica completa', categoria: 'home',
      finestra: 'giornaliera', metrica: 'tutti_widget_informativi_periodo', operatore: '==', valore: true,
      ricompensa: { tipo: 'polvere', quantita: 8 } },

    { id: 'm94_personalizza', titolo: 'Personalizza', categoria: 'home',
      finestra: 'giornaliera', metrica: 'layout_modificato_periodo', operatore: '>=', valore: 1,
      ricompensa: { tipo: 'polvere', quantita: 3 } },

    { id: 'm99_super_giornata', titolo: 'Super giornata', categoria: 'meta',
      finestra: 'giornaliera', metrica: 'missioni_completate_periodo', operatore: '>=', valore: 7,
      ricompensa: { tipo: 'polvere', quantita: 15, bonus: 'possibilita_bustina' } },

    { id: 'm100_leggenda_del_giorno', titolo: 'Leggenda del giorno', categoria: 'meta',
      finestra: 'giornaliera', metrica: 'percentuale_missioni_giorno', operatore: '>=', valore: 100,
      ricompensa: { tipo: 'polvere', quantita: 20, bonus: 'possibilita_stampino' },
      nota: 'duplicato concettuale di m53, stessa metrica speciale' },

    { id: 'm96_una_giornata_cardsync', titolo: 'Una giornata CardSync', categoria: 'meta',
      finestra: 'settimanale', metrica: 'tutte_categorie_coperte_settimana', operatore: '==', valore: true,
      ricompensa: { tipo: 'polvere', quantita: 12 } },

    { id: 'm97_collezionista_sociale', titolo: 'Collezionista sociale', categoria: 'meta',
      finestra: 'giornaliera', metrica: 'collezione_e_social_oggi', operatore: '==', valore: true,
      ricompensa: { tipo: 'polvere', quantita: 8 } },

    { id: 'm98_tuttofare', titolo: 'Tuttofare', categoria: 'meta',
      finestra: 'settimanale', metrica: 'categorie_distinte_settimana', operatore: '>=', valore: 5,
      ricompensa: { tipo: 'polvere', quantita: 12 } },
];

function _generaScalaTraguardi(prefissoId, metrica, categoria, voci) {
    return voci.map((v, i) => ({
        id: `${prefissoId}_${i + 1}`,
        titolo: v.titolo,
        metrica: metrica,
        categoria: categoria,
        operatore: '>=',
        valore: v.soglia,
        ricompensa: v.ricompensa,
    }));
}

const SCALA_CARTE = _generaScalaTraguardi('t_carte', 'carte_totali', 'inserimento', [
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

const SCALA_VALORE = _generaScalaTraguardi('t_valore', 'valore_collezione', 'inserimento', [
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

const SCALA_LOCATION = _generaScalaTraguardi('t_location', 'location_distinte', 'inserimento', [
    { soglia: 1,   titolo: 'Prima tappa',            ricompensa: { tipo: 'polvere', quantita: 5 } },
    { soglia: 3,   titolo: 'Viaggiatore',            ricompensa: { tipo: 'stampino', riferimento: 'viaggiatore' } },
    { soglia: 5,   titolo: 'Girovago',               ricompensa: { tipo: 'polvere', quantita: 15 } },
    { soglia: 10,  titolo: 'Globetrotter',           ricompensa: { tipo: 'bustina', quantita: 1 } },
    { soglia: 20,  titolo: 'Cartografo',             ricompensa: { tipo: 'stampino', riferimento: 'cartografo' } },
    { soglia: 30,  titolo: 'Viaggiatore esperto',    ricompensa: { tipo: 'polvere', quantita: 30 } },
    { soglia: 50,  titolo: 'Esploratore instancabile', ricompensa: { tipo: 'bustina', riferimento: 'speciale' } },
    { soglia: 100, titolo: 'Mappa vivente',          ricompensa: { tipo: 'stampino', riferimento: 'raro' } },
    { soglia: 250, titolo: 'Giro del mondo',         ricompensa: { tipo: 'polvere', quantita: 100 } },
    { soglia: 500, titolo: 'Ovunque tu vada',        ricompensa: { tipo: 'stampino', riferimento: 'leggendario' } },
]);

const SCALA_WISHLIST = _generaScalaTraguardi('t_wishlist', 'wishlist_totale', 'prezzi', [
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

const SCALA_DOPPIONI = _generaScalaTraguardi('t_doppioni', 'doppioni_totali', 'inserimento', [
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

const SCALA_MISSIONI_TOTALI = _generaScalaTraguardi('t_missioni', 'missioni_completate_totale', 'meta', [
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

const SCALA_ACCESSI = _generaScalaTraguardi('t_accessi', 'accessi_totali', 'costanza', [
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

const SCALA_COSTANZA_STREAK = _generaScalaTraguardi('t_streak', 'giorni_consecutivi', 'costanza', [
    { soglia: 2,   titolo: 'Torna domani',          ricompensa: { tipo: 'polvere', quantita: 4 } },
    { soglia: 3,   titolo: 'Costanza',              ricompensa: { tipo: 'polvere', quantita: 7 } },
    { soglia: 7,   titolo: 'Settimana attiva',      ricompensa: { tipo: 'polvere', quantita: 15 } },
    { soglia: 14,  titolo: 'Due settimane di fila', ricompensa: { tipo: 'polvere', quantita: 25 } },
    { soglia: 30,  titolo: 'Un mese di fila',       ricompensa: { tipo: 'stampino', riferimento: 'costante' } },
    { soglia: 60,  titolo: 'Due mesi di fila',      ricompensa: { tipo: 'bustina', quantita: 1 } },
    { soglia: 100, titolo: 'Cento giorni di fila',  ricompensa: { tipo: 'polvere', quantita: 75 } },
    { soglia: 250, titolo: 'Fedelissimo',           ricompensa: { tipo: 'stampino', riferimento: 'raro' } },
    { soglia: 365, titolo: 'Un anno intero',        ricompensa: { tipo: 'stampino', riferimento: 'leggendario' } },
]);

const SCALA_BINDER_APERTURE = _generaScalaTraguardi('t_binder_aperture', 'binder_aperture_totale', 'social', [
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

const SCALA_MATCH_TROVATI = _generaScalaTraguardi('t_match', 'match_trovati_totale', 'social', [
    { soglia: 1,    titolo: 'Prima connessione',    ricompensa: { tipo: 'polvere', quantita: 5 } },
    { soglia: 2,    titolo: 'Doppia occasione',     ricompensa: { tipo: 'polvere', quantita: 5 } },
    { soglia: 3,    titolo: 'Si allarga la rete',   ricompensa: { tipo: 'polvere', quantita: 6 } },
    { soglia: 4,    titolo: 'Quasi tutti connessi', ricompensa: { tipo: 'polvere', quantita: 8 } },
    { soglia: 5,    titolo: 'Primo contatto',       ricompensa: { tipo: 'polvere', quantita: 10 } },
    { soglia: 10,   titolo: 'Social collector',     ricompensa: { tipo: 'stampino', riferimento: 'social' } },
    { soglia: 25,   titolo: 'Connesso',             ricompensa: { tipo: 'polvere', quantita: 25 } },
    { soglia: 50,   titolo: 'Cacciatore di Match',  ricompensa: { tipo: 'bustina', quantita: 1 } },
    { soglia: 100,  titolo: 'Matchmaker',           ricompensa: { tipo: 'stampino', riferimento: 'raro' } },
    { soglia: 250,  titolo: 'Network',              ricompensa: { tipo: 'polvere', quantita: 75 } },
    { soglia: 500,  titolo: 'Connettore',           ricompensa: { tipo: 'bustina', quantita: 2 } },
    { soglia: 1000, titolo: 'Nodo della rete',      ricompensa: { tipo: 'stampino', riferimento: 'leggendario' } },
    { soglia: 2500, titolo: 'Leggenda sociale',     ricompensa: { tipo: 'polvere', quantita: 250 } },
]);

const SCALA_BINDER_VISITATI = _generaScalaTraguardi('t_binder_visitati', 'binder_visitati_distinti_totale', 'social', [
    { soglia: 1,    titolo: 'Prima visita',        ricompensa: { tipo: 'polvere', quantita: 3 } },
    { soglia: 2,    titolo: 'Seconda tappa',       ricompensa: { tipo: 'polvere', quantita: 4 } },
    { soglia: 3,    titolo: 'Giro del gruppo',     ricompensa: { tipo: 'polvere', quantita: 5 } },
    { soglia: 4,    titolo: 'Nessuno ti sfugge',   ricompensa: { tipo: 'polvere', quantita: 6 } },
    { soglia: 5,    titolo: 'Curioso',             ricompensa: { tipo: 'polvere', quantita: 5 } },
    { soglia: 10,   titolo: 'Esploratore',         ricompensa: { tipo: 'polvere', quantita: 10 } },
    { soglia: 25,   titolo: 'Viaggiatore sociale', ricompensa: { tipo: 'stampino', riferimento: 'esploratore' } },
    { soglia: 50,   titolo: 'Conoscitore',         ricompensa: { tipo: 'bustina', quantita: 1 } },
    { soglia: 100,  titolo: 'Giro dei binder',     ricompensa: { tipo: 'polvere', quantita: 50 } },
    { soglia: 250,  titolo: 'Esploratore esperto', ricompensa: { tipo: 'stampino', riferimento: 'raro' } },
    { soglia: 500,  titolo: 'Cercatore',           ricompensa: { tipo: 'polvere', quantita: 100 } },
    { soglia: 1000, titolo: 'Grande esploratore',  ricompensa: { tipo: 'bustina', quantita: 2 } },
    { soglia: 2500, titolo: 'Conosci tutti',       ricompensa: { tipo: 'stampino', riferimento: 'leggendario' } },
]);

const TRAGUARDI_SINGOLI = [
    { id: 't_il_tuo_telefono', titolo: 'Il tuo telefono', categoria: 'home',
      metrica: 'layout_personalizzato_mai', operatore: '==', valore: true,
      ricompensa: { tipo: 'polvere', quantita: 5 } },

    { id: 't_giorno_impeccabile', titolo: 'Giorno impeccabile', categoria: 'meta',
      metrica: 'giorno_perfetto_mai', operatore: '==', valore: true,
      ricompensa: { tipo: 'bustina', quantita: 1 },
      nota: 'ex "Giornata perfetta" — rinominato per conflitto con missione m53. Sbloccato la prima volta che percentuale_missioni_giorno raggiunge 100%.' },

    { id: 't_collezionista_completo', titolo: 'Collezionista completo', categoria: 'meta',
      metrica: 'categorie_traguardi_distinte_totale', operatore: '>=', valore: 5,
      ricompensa: { tipo: 'bustina', quantita: 2 } },

    { id: 't_maestro_cardsync', titolo: 'Maestro CardSync', categoria: 'meta',
      metrica: 'percentuale_traguardi_sbloccati', operatore: '>=', valore: 50,
      ricompensa: { tipo: 'stampino', riferimento: 'maestro_cardsync' } },

    { id: 't_leggenda_cardsync', titolo: 'Leggenda CardSync', categoria: 'meta',
      metrica: 'percentuale_traguardi_sbloccati', operatore: '>=', valore: 100,
      ricompensa: { tipo: 'stampino', riferimento: 'leggendario_esclusivo' },
      nota: 'Documento originale: "stampino leggendario esclusivo + 250 Polvere + Bustina speciale" — ricompensa composta semplificata a un solo tipo (stampino), coerente con TUTTI gli altri traguardi del catalogo (nessuno ha mai più di una ricompensa contemporanea, il campo "bonus" esistente è per premi PROBABILISTICI di missione, non applicabile qui). Da rivedere con Claudio se vuole davvero il pacchetto multiplo.' },
];

const CATALOGO_TRAGUARDI = [
    ...SCALA_CARTE,
    ...SCALA_VALORE,
    ...SCALA_LOCATION,
    ...SCALA_WISHLIST,
    ...SCALA_DOPPIONI,
    ...SCALA_MISSIONI_TOTALI,
    ...SCALA_ACCESSI,
    ...SCALA_COSTANZA_STREAK,
    ...SCALA_BINDER_APERTURE,
    ...SCALA_MATCH_TROVATI,
    ...SCALA_BINDER_VISITATI,
    ...TRAGUARDI_SINGOLI,
];

const _totaleTraguardiPerPercentuale = CATALOGO_TRAGUARDI.filter(t => t.metrica !== 'percentuale_traguardi_sbloccati').length;

const _FRASI_MISSIONE = {
    accesso_oggi: { testo: () => 'Accedi al sito.' },
    apertura_binder_periodo: { frase: v => `Apri il widget Binders ${v === 1 ? 'una volta' : v + ' volte'}` },
    apertura_carta_top_valore_periodo: { frase: v => `Apri il dettaglio di una carta tra le più preziose ${v === 1 ? 'una volta' : v + ' volte'}` },
    apertura_dettaglio_carta_periodo: { frase: v => `Apri il dettaglio di ${v === 1 ? 'una carta' : v + ' carte'}` },
    apertura_doppioni_periodo: { frase: () => `Apri il widget Doppioni` },
    apertura_estensione_periodo: { frase: () => `Apri il widget Estensione` },
    apertura_location_periodo: { frase: () => `Apri il widget Location` },
    apertura_match_periodo: { frase: () => `Apri il widget Match` },
    apertura_prezzi_periodo: { frase: () => `Apri il widget Prezzi` },
    apertura_ultima_carta_periodo: { frase: () => `Apri il widget Ultima carta` },
    apertura_valore_collezione_periodo: { frase: () => `Apri il widget Valore collezione` },
    apertura_visualizzazione_periodo: { frase: () => `Apri il widget Visualizzazione` },
    apertura_wishlist_obiettivi_periodo: { frase: () => `Apri il widget Wishlist/Obiettivi` },
    binder_aperture_periodo: { frase: v => `Fatti ${v === 1 ? 'visitare una volta' : 'visitare ' + v + ' volte'} il binder da qualcuno del gruppo` },
    binder_pubblicati_periodo: { frase: v => `Pubblica ${v === 1 ? 'un binder' : v + ' binder'}` },
    binder_pubblico_visitato_periodo: { frase: () => `Visita un binder pubblico di qualcun altro del gruppo (dal pannello Match)` },
    carta_vecchia_aperta_periodo: { frase: () => `Apri il dettaglio di una carta aggiunta in un giorno precedente` },
    carte_aggiunte_periodo: { frase: v => `Aggiungi ${v === 1 ? 'una carta' : v + ' carte'} alla collezione` },
    carte_distinte_dettaglio_periodo: { frase: v => `Apri il dettaglio di ${v} carte diverse` },
    carte_stessa_espansione_max: { testo: v => `Possiedi almeno ${v} carte della stessa espansione in collezione.` },
    categorie_distinte_settimana: { frase: v => `Completa missioni di ${v} categorie diverse` },
    coda_errori_azzerata_oggi: { testo: () => 'Azzera la lista "Carte con problemi" in Inserimento.' },
    collezione_e_social_oggi: { testo: () => 'Fai qualcosa in Inserimento/Collezione E qualcosa nella sezione sociale (Binder o Match), nello stesso giorno.' },
    errori_coda_vuota: { testo: () => 'Non avere nessuna carta in errore in coda.' },
    esplorazione_sociale_oggi: { testo: () => 'Apri il widget Binders o il widget Match.' },
    giorni_consecutivi: { testo: v => `Sei in una serie di accessi di almeno ${v} ${v === 1 ? 'giorno' : 'giorni'} consecutivi.` },
    estensione_aperta_periodo: { frase: () => `Apri il widget Estensione` },
    estensione_funzione_usata_periodo: { frase: () => `Usa davvero una funzione dell'estensione (es. avvia un controllo prezzi)` },
    layout_modificato_periodo: { frase: () => `Modifica il layout della Home (ordine o visibilità dei widget)` },
    location_aggiunta_periodo: { frase: v => `Assegna una location a ${v === 1 ? 'una carta' : v + ' carte'}` },
    location_distinte: { frase: v => `Usa ${v === 1 ? 'una location' : v + ' location diverse'}` },
    match_attivi_totale: { frase: () => `Trova una corrispondenza attiva nel gruppo (pannello Match)` },
    missioni_completate_periodo: { frase: v => `Completa ${v === 1 ? 'un\'altra missione' : v + ' missioni'}` },
    missioni_completate_totale: { frase: v => `Completa ${v} ${v === 1 ? 'missione' : 'missioni'} in totale` },
    percentuale_missioni_giorno: { testo: () => 'Completa tutte le missioni assegnate oggi.' },
    prezzi_aggiornati_periodo: { frase: v => `Aggiorna ${v === 1 ? 'un prezzo' : v + ' prezzi'}` },
    prezzi_aggiornati_settimana: { frase: v => `Aggiorna ${v} prezzi` },
    prezzi_scaduti_totale: { testo: () => 'Non avere nessuna carta con il prezzo da aggiornare.' },
    qr_generato_periodo: { frase: v => `Genera ${v === 1 ? 'un codice QR' : v + ' codici QR'} per condividere un binder` },
    ricerche_eseguite_periodo: { frase: v => `Completa ${v === 1 ? 'una ricerca' : v + ' ricerche'} (con un risultato aperto)` },
    statistiche_distinte_periodo: { frase: v => `Consulta ${v} widget statistici diversi (Visualizzazione, Valore collezione, Location)` },
    tutte_categorie_coperte_settimana: { testo: () => 'Completa almeno una missione per ciascuna categoria, nell\'arco della settimana.' },
    tutti_widget_informativi_periodo: { testo: () => 'Apri tutti i widget informativi della Home.' },
    widget_distinti_periodo: { frase: v => `Apri ${v} widget diversi` },
    wishlist_obiettivi_raggiunti: { frase: v => `Raggiungi ${v === 1 ? 'un obiettivo' : v + ' obiettivi'} di prezzo in Wishlist` },
};

const _FRASI_TRAGUARDO = {
    accessi_totali: { frase: v => `${v} ${v === 1 ? 'accesso totale' : 'accessi totali'} al sito` },
    binder_aperture_totale: { frase: v => `${v} ${v === 1 ? 'visita totale' : 'visite totali'} al tuo binder da parte del gruppo` },
    giorni_consecutivi: { frase: v => `${v} giorni consecutivi di accesso` },
    carte_totali: { frase: v => `${v} ${v === 1 ? 'carta' : 'carte'} in collezione` },
    categorie_traguardi_distinte_totale: { testo: v => `Sblocca almeno un traguardo in ${v} categorie diverse.` },
    percentuale_traguardi_sbloccati: { testo: v => `Sblocca il ${v}% dei traguardi disponibili del catalogo.` },
    doppioni_totali: { frase: v => `${v} ${v === 1 ? 'doppione' : 'doppioni'} in collezione` },
    giorno_perfetto_mai: { testo: () => 'Completa il 100% delle missioni assegnate in un giorno, almeno una volta.' },
    layout_personalizzato_mai: { testo: () => 'Personalizza la Home per la prima volta: sposta, nascondi, aggiungi o ridimensiona un widget.' },
    location_distinte: { frase: v => `${v} location${v === 1 ? '' : ' diverse'}` },
    missioni_completate_totale: { frase: v => `${v} ${v === 1 ? 'missione completata' : 'missioni completate'} in totale` },
    valore_collezione: { frase: v => `${v} € di valore totale della collezione` },
    wishlist_totale: { frase: v => `${v} ${v === 1 ? 'carta' : 'carte'} in Wishlist` },
    match_trovati_totale: { frase: v => `${v} ${v === 1 ? 'Match trovato' : 'Match trovati'} in totale` },
    binder_visitati_distinti_totale: { frase: v => `${v} ${v === 1 ? 'binder diverso visitato' : 'binder diversi visitati'}` },
};

function _finestraTesto(finestra) {
    if (finestra === 'giornaliera') return ' oggi';
    if (finestra === 'settimanale') return ' questa settimana';
    if (finestra === 'mensile') return ' questo mese';
    return '';
}

function _descrizioneMissione(m) {
    const voce = _FRASI_MISSIONE[m.metrica];
    if (!voce) return m.titolo;
    if (voce.testo) return voce.testo(m.valore);
    return `${voce.frase(m.valore)}${_finestraTesto(m.finestra)}.`;
}

function _descrizioneTraguardo(t) {
    const voce = _FRASI_TRAGUARDO[t.metrica];
    if (!voce) return t.titolo;
    if (voce.testo) return voce.testo(t.valore);
    return `Raggiungi ${voce.frase(t.valore)}.`;
}

CATALOGO_MISSIONI.forEach(m => { m.descrizione = _descrizioneMissione(m); });
CATALOGO_TRAGUARDI.forEach(t => { t.descrizione = _descrizioneTraguardo(t); });
