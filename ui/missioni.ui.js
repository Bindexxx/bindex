// ============================================================================
// MISSIONI.UI.JS — Motore di valutazione missioni/traguardi (Fase 1)
// ============================================================================
// STEP separato dal piano "riduzione accoppiamento" concordato con Claudio
// il 2026-09-11. Il catalogo (CATALOGO_MISSIONI, CATALOGO_TRAGUARDI,
// scale, frasi, descrizioni) è stato spostato in
// ui/missioni-catalogo.ui.js — NESSUNA riscrittura, solo spostamento, zero
// cambi di comportamento. Questo file contiene ora SOLO il motore di
// valutazione generico (MOTORE_MISSIONI) e la notifica condivisa dei
// completamenti (_missioniNotificaCompletamenti, usata sia da
// renderPaginaMissioni() sia da ui/missioni-watcher.js).
//
// Contiene SOLO le voci Fase 1 (calcolabili da dati/stato già esistenti,
// nessun nuovo log eventi necessario). Le voci Fase 2 (aperture, ricerche,
// visite binder, streak accessi, categorie, azioni doppioni/estensione)
// sono OMESSE e vanno costruite in una sessione dedicata, dopo aver
// aggiunto la scrittura eventi nel punto giusto del codice (tabella
// activity_log esiste già ma è vuota/dormiente).
//
// Formato dichiarativo (non funzioni per voce): ogni missione/traguardo è
// un oggetto dati con { metrica, operatore, valore }, valutato da questo
// motore generico. Aggiungere una voce = solo editare l'array in
// ui/missioni-catalogo.ui.js, zero rischio di rompere logica JS.
//
// Tabelle DB di supporto (migration 32, eseguita su Bindexxx):
//   missioni_completate(owner_id, missione_id, finestra, periodo, origine, completato_il)
//   traguardi_riscossi(owner_id, traguardo_id, riscosso_il)
//   inventario_ricompense(owner_id, tipo, riferimento_id, quantita, ottenuto_il)
//
// Dipende da CATALOGO_MISSIONI/CATALOGO_TRAGUARDI (ui/missioni-catalogo.ui.js)
// solo a tempo di CHIAMATA dei metodi di MOTORE_MISSIONI (mai a tempo di
// caricamento script) — l'ordine tra questo file e
// ui/missioni-catalogo.ui.js nei <script> tag di index.html è indifferente,
// purché entrambi carichino prima che la pagina Missioni venga aperta.
// ============================================================================

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
//   layout_modificato_periodo  — MAI calcolata per davvero (vedi il commento
//     sopra "layout_modificato_periodo: 0" in fondo a raccogliDati()):
//     m94_personalizza/m95_il_tuo_telefono vengono assegnate da un aggancio
//     diretto in ui/phone.ui.js, non passando da qui. Se in futuro servisse
//     un vero tracciamento "layout prima/dopo per periodo" per qualcos'altro,
//     va costruito da zero in quel momento, non riesumato da questa nota.
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
            matchAttivi, matchTrovatiTotale, binderPubblicatiOggi, binderVisitatiDistinti,
            codaVuota, codaAzzerataOggi,
            missioniTotali, missioniOggi,
            accessoOggi, accessiTotali, giorniConsecutivi,
            ricercheOggi,
            binderAperturePeriodo, binderApertureTotale,
            completateOggiRange, completateSettimanaRange,
            traguardiRiscossiIdTotale,
            aperturaVisualizzazione, aperturaWishlistObiettivi, aperturaPrezzi,
            aperturaDoppioni, aperturaMatch, aperturaLocation,
            aperturaValoreCollezione, aperturaBinder, aperturaEstensione,
            aperturaDettaglioCarta,
            qrGenerato, binderPubblicoVisitato, aperturaCartaTopValore, aperturaUltimaCarta,
            carteDistinteDettaglio,
            carteVecchiaAperta, estensioneFunzioneUsata, widgetDistinti,
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
            missioniMatchTrovatiTotale(userId),
            missioniBinderPubblicatiPeriodo(userId, oggi.inizioISO, oggi.fineISO),
            missioniBinderVisitatiDistintiTotale(userId),
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
            missioniTraguardiRiscossiIdTotale(userId),
            missioniAperturaWidgetPeriodo(userId, 'visualizzazione', oggi.inizioISO, oggi.fineISO),
            missioniAperturaWidgetPeriodo(userId, 'wishlist_obiettivi', oggi.inizioISO, oggi.fineISO),
            missioniAperturaWidgetPeriodo(userId, 'prezzi', oggi.inizioISO, oggi.fineISO),
            missioniAperturaWidgetPeriodo(userId, 'doppioni', oggi.inizioISO, oggi.fineISO),
            missioniAperturaWidgetPeriodo(userId, 'match', oggi.inizioISO, oggi.fineISO),
            missioniAperturaWidgetPeriodo(userId, 'location', oggi.inizioISO, oggi.fineISO),
            missioniAperturaWidgetPeriodo(userId, 'valore_collezione', oggi.inizioISO, oggi.fineISO),
            missioniAperturaWidgetPeriodo(userId, 'binder', oggi.inizioISO, oggi.fineISO),
            missioniAperturaWidgetPeriodo(userId, 'estensione', oggi.inizioISO, oggi.fineISO),
            missioniDettaglioCartaAperturePeriodo(userId, oggi.inizioISO, oggi.fineISO),
            missioniQrGeneratoPeriodo(userId, oggi.inizioISO, oggi.fineISO),
            missioniBinderPubblicoVisitatoPeriodo(userId, oggi.inizioISO, oggi.fineISO),
            missioniDettaglioCartaTopValorePeriodo(userId, oggi.inizioISO, oggi.fineISO),
            missioniAperturaWidgetPeriodo(userId, 'ultima_carta', oggi.inizioISO, oggi.fineISO),
            missioniDettaglioCarteDistintePeriodo(userId, oggi.inizioISO, oggi.fineISO),
            missioniDettaglioCartaVecchiaPeriodo(userId, oggi.inizioISO, oggi.fineISO),
            missioniEstensioneFunzioneUsataPeriodo(userId, oggi.inizioISO, oggi.fineISO),
            missioniWidgetDistintiPeriodo(userId, oggi.inizioISO, oggi.fineISO),
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

        // Traguardo #98 "Collezionista completo" (2026-08-30): stesso
        // approccio di categorieOggi/categorieSettimana sopra, ma su
        // CATALOGO_TRAGUARDI e SENZA range temporale — traguardi_riscossi
        // è permanente, non ha senso un "oggi/questa settimana" qui.
        const _categoriaTraguardoDi = (traguardoId) => {
            const t = CATALOGO_TRAGUARDI.find(x => x.id === traguardoId);
            return t ? t.categoria : null;
        };
        const _idsTraguardiRiscossi = (traguardiRiscossiIdTotale && traguardiRiscossiIdTotale.error)
            ? (console.warn('[missioni] raccolta dati (traguardi riscossi):', traguardiRiscossiIdTotale.error.message), [])
            : ((traguardiRiscossiIdTotale && traguardiRiscossiIdTotale.data) || []).map(row => row.traguardo_id);
        const categorieTraguardi = new Set(_idsTraguardiRiscossi.map(_categoriaTraguardoDi).filter(Boolean));

        // #99/#100 "percentuale_traguardi_sbloccati" (2026-09-01, soglia
        // dinamica invece di numero fisso — vedi nota su
        // t_maestro_cardsync/t_leggenda_cardsync in TRAGUARDI_SINGOLI).
        // Stesso array _idsTraguardiRiscossi sopra, ma escludendo dal
        // NUMERATORE i traguardi con questa stessa metrica — simmetrico al
        // denominatore _totaleTraguardiPerPercentuale, altrimenti sbloccare
        // t_maestro_cardsync (50%) farebbe salire la percentuale contando
        // anche se stesso, potendo superare il 100% prima che tutti i
        // traguardi "reali" siano davvero sbloccati.
        const _traguardiSbloccatiPerPercentuale = _idsTraguardiRiscossi.filter(id => {
            const t = CATALOGO_TRAGUARDI.find(x => x.id === id);
            return t && t.metrica !== 'percentuale_traguardi_sbloccati';
        }).length;
        const percentualeTraguardiSbloccati = _totaleTraguardiPerPercentuale > 0
            ? Math.round((_traguardiSbloccatiPerPercentuale / _totaleTraguardiPerPercentuale) * 100)
            : 0;

        // Missione #78 "Esplora il gruppo" (2026-08-30): OR tra apertura
        // widget Binders e apertura widget Match — "collezione condivisa O
        // sezione sociale", nessuno dei due obbligatorio da solo.
        const _aperturaBinderOggi = v(aperturaBinder, 'count');
        const _aperturaMatchOggi = v(aperturaMatch, 'count');
        const esplorazioneSocialeOggi = _aperturaBinderOggi >= 1 || _aperturaMatchOggi >= 1;

        // Missione #81 "Conta tutto" (2026-08-30, decisione b): "controlla
        // carte, valore e location — 3 statistiche consultate" = numero di
        // widget tra {visualizzazione, valore_collezione, location} aperti
        // almeno una volta oggi, non un evento nuovo.
        const _aperturaVisualizzazioneOggi = v(aperturaVisualizzazione, 'count');
        const _aperturaValoreCollezioneOggi = v(aperturaValoreCollezione, 'count');
        const _aperturaLocationOggi = v(aperturaLocation, 'count');
        const statisticheDistintePeriodo =
            (_aperturaVisualizzazioneOggi >= 1 ? 1 : 0) +
            (_aperturaValoreCollezioneOggi >= 1 ? 1 : 0) +
            (_aperturaLocationOggi >= 1 ? 1 : 0);

        // Missione #93 "Panoramica completa" (2026-08-30): "tutti i widget
        // informativi disponibili" — CATALOGO_WIDGET (ui/phone.ui.js) meno
        // i segnaposto gacha mai implementati (bloccato:true — bustina,
        // polvere, missioni). Contato a runtime, non un numero fisso: se il
        // catalogo cambia, questa soglia si aggiorna da sola.
        const totaleWidgetInformativi = Object.keys(CATALOGO_WIDGET).filter(id => !CATALOGO_WIDGET[id].bloccato).length;
        const widgetDistintiPeriodo = v(widgetDistinti);

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
            match_trovati_totale: v(matchTrovatiTotale, 'count'),
            binder_pubblicati_periodo: v(binderPubblicatiOggi, 'count'),
            binder_visitati_distinti_totale: v(binderVisitatiDistinti),
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
            categorie_traguardi_distinte_totale: categorieTraguardi.size,
            percentuale_traguardi_sbloccati: percentualeTraguardiSbloccati,
            apertura_visualizzazione_periodo: v(aperturaVisualizzazione, 'count'),
            apertura_wishlist_obiettivi_periodo: v(aperturaWishlistObiettivi, 'count'),
            apertura_prezzi_periodo: v(aperturaPrezzi, 'count'),
            apertura_doppioni_periodo: v(aperturaDoppioni, 'count'),
            apertura_match_periodo: v(aperturaMatch, 'count'),
            apertura_location_periodo: v(aperturaLocation, 'count'),
            apertura_valore_collezione_periodo: v(aperturaValoreCollezione, 'count'),
            apertura_binder_periodo: v(aperturaBinder, 'count'),
            apertura_estensione_periodo: v(aperturaEstensione, 'count'),
            apertura_dettaglio_carta_periodo: v(aperturaDettaglioCarta, 'count'),
            qr_generato_periodo: v(qrGenerato, 'count'),
            binder_pubblico_visitato_periodo: v(binderPubblicoVisitato, 'count'),
            apertura_carta_top_valore_periodo: v(aperturaCartaTopValore, 'count'),
            apertura_ultima_carta_periodo: v(aperturaUltimaCarta, 'count'),
            carte_distinte_dettaglio_periodo: v(carteDistinteDettaglio),
            carta_vecchia_aperta_periodo: v(carteVecchiaAperta, 'count'),
            estensione_funzione_usata_periodo: v(estensioneFunzioneUsata, 'count'),
            widget_distinti_periodo: widgetDistintiPeriodo,
            esplorazione_sociale_oggi: esplorazioneSocialeOggi,
            statistiche_distinte_periodo: statisticheDistintePeriodo,
            tutti_widget_informativi_periodo: totaleWidgetInformativi > 0 && widgetDistintiPeriodo >= totaleWidgetInformativi,
            // FIX (Claudio, 2026-09-10): m94_personalizza/m95_il_tuo_telefono
            // (metrica layout_modificato_periodo) non vengono MAI assegnate
            // passando da qui — hanno un aggancio diretto e separato
            // (_missioneAggancioPersonalizzaLayout() in ui/phone.ui.js,
            // chiamata da _salvaLayoutWidget(daAzioneUtente=true)), che
            // inserisce il completamento direttamente in missioni_completate,
            // protetto dallo stesso UNIQUE anti-doppio-accredito di sempre.
            // Nessuna funzione qui calcola mai davvero questa metrica (vedi
            // nota sopra MOTORE_MISSIONI: "richiede ancora funzioni
            // repository non scritte"), quindi valuta() la trovava sempre
            // undefined e stampava un console.warn ad ogni giro — per m95
            // (una_tantum, sempre "in gioco", vedi _valutaEAssegnaUnGiro)
            // letteralmente ogni volta. Impostarla a 0 fisso non cambia
            // NESSUN comportamento reale: valuta() userebbe comunque
            // "0 >= 1" → false via questa strada, esattamente come con
            // undefined — l'assegnazione vera continua identica tramite
            // l'aggancio diretto. Zittisce solo un avviso fuorviante che
            // segnalava un buco senza mai aver avuto effetti pratici.
            layout_modificato_periodo: 0,
            // OTTIMIZZAZIONE (Claudio, 2026-09-10, dallo screenshot Network
            // con decine di POST 409 su traguardi_riscossi): il dato per
            // saltare i traguardi GIA' sbloccati prima di ritentare l'insert
            // era già calcolato qui sopra (_idsTraguardiRiscossi, oggi usato
            // solo per categorie/percentuale) — semplicemente non veniva mai
            // restituito. Esposto qui con underscore iniziale apposta: non è
            // una metrica da confrontare con un operatore in valuta() (nessun
            // catalogo la referenzia come 'metrica'), è solo dato di servizio
            // per _valutaEAssegnaUnGiro sotto. Zero query in più: stesso giro
            // di Promise.all di sempre, solo un valore in più esposto.
            _traguardiRiscossiIds: _idsTraguardiRiscossi,
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

        // FIX (Claudio, 2026-09-10, screenshot Network: decine di POST 409
        // su missioni_completate) — stesso principio del fix già fatto sopra
        // per traguardi_riscossi: prima si ritentava l'insert per OGNI
        // missione soddisfatta, incluse quelle già completate per il
        // periodo corrente. Capita soprattutto con le una_tantum a metrica
        // monotona (es. giorni_consecutivi, missioni_completate_totale):
        // una volta soddisfatte restano soddisfatte per sempre, quindi
        // senza questo filtro vengono ritentate a ogni apertura della
        // pagina Missioni, per sempre. Un solo IN(...) sui periodo
        // DAVVERO in gioco ora (al massimo 4 valori distinti), non una
        // query per missione.
        const periodiInGioco = [...new Set([oggi.periodo, settimana.periodo, mese.periodo, 'sempre'])];
        const { data: righeGiaCompletate, error: errGiaCompletate } = await missioniCompletateIdPerPeriodi(userId, periodiInGioco);
        if (errGiaCompletate) console.warn('[missioni] verifica missioni già completate:', errGiaCompletate.message);
        const _giaCompletate = new Set((righeGiaCompletate || []).map(r => r.missione_id + '|' + r.periodo));

        const missioniSoddisfatte = inGioco.filter(m => this.valuta(m, dati))
            .filter(m => !_giaCompletate.has(m.id + '|' + this.periodoCorrente(m.finestra).periodo));
        // FIX (Claudio, 2026-09-10): prima si ritentava l'insert per OGNI
        // traguardo soddisfatto, inclusi quelli sbloccati mesi fa — 409
        // garantito e ignorato, ma pur sempre una richiesta di rete sprecata
        // ad ogni apertura della pagina Missioni, per sempre. Il filtro qui
        // usa lo stesso identico elenco già raccolto in raccogliDati()
        // (dati._traguardiRiscossiIds, vedi sopra) — nessuna query in più.
        // Il vincolo UNIQUE lato DB resta comunque la vera rete di
        // sicurezza anti-doppio-accredito (questo filtro è solo per non
        // sprecare chiamate su casi che sappiamo già essere no-op).
        const _giaRiscossi = new Set(dati._traguardiRiscossiIds || []);
        const traguardiSoddisfatti = this.valutaTraguardi(dati).filter(t => !_giaRiscossi.has(t.id));

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

// ── NOTIFICA COMPLETAMENTI (avvisi + beep + saldo) ────────────────────────
// STEP 14 ristrutturazione file widget home, 2026-09-11 (vedi
// Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md). Consolida in
// un'unica funzione ciò che prima era duplicato quasi identico in due
// punti: renderPaginaMissioni() (oggi ui/widget-missioni.ui.js) e
// _watcherMissioniGiro() (ui/missioni-watcher.js). I due punti chiamavano
// due metodi DIVERSI per rileggere il saldo polvere — un disallineamento
// reale trovato leggendo il codice, non solo una differenza di stile:
// renderPaginaMissioni usava già polvereSaldoLeggi() (RPC polvere_saldo,
// SELECT SUM lato Postgres, aggiornata 2026-09-07), il watcher era rimasto
// al vecchio ricompenseSaldo(userId,'polvere') (somma lato client, tronca
// oltre ~1000 righe senza segnalarlo). Consolidando qui, il watcher eredita
// automaticamente il metodo corretto.
//
// UNA sola query di lettura quando c'è davvero qualcosa di nuovo — corpo
// di polvere_saldo() verificato su Supabase da Claudio prima di scrivere
// questa funzione (SELECT COALESCE(SUM(quantita),0) FROM
// inventario_ricompense WHERE owner_id=auth.uid() AND tipo='polvere';
// SECURITY DEFINER, nessuna scrittura). Nessun limite aggiuntivo oltre
// alla guardia "solo se è cambiato qualcosa", già presente in entrambi i
// chiamanti originali e qui preservata identica — Claudio ha chiesto
// esplicitamente di non aggiungerne altri.
async function _missioniNotificaCompletamenti(nuoveMissioni, nuoviTraguardi) {
    if (!(nuoveMissioni && nuoveMissioni.length) && !(nuoviTraguardi && nuoviTraguardi.length)) return;

    if (typeof CSBar !== 'undefined') {
        (nuoveMissioni || []).forEach(m => CSBar.avvisa('missione-completata', { text: m.titolo }));
        (nuoviTraguardi || []).forEach(t => CSBar.avvisa('traguardo-sbloccato', { text: t.titolo }));
    }

    // Beep "vinto" — 1200Hz, stesso in entrambi i chiamanti originali.
    // Rispetta già da sé la preferenza suoni (prefSuoniWidgetGet dentro _beep).
    if (typeof _beep === 'function') _beep(1200, 90);

    if (typeof CSBar !== 'undefined' && typeof CSBar.setCurrency === 'function' && typeof polvereSaldoLeggi === 'function') {
        try {
            const { data: saldo, error } = await polvereSaldoLeggi();
            if (!error) CSBar.setCurrency({ value: saldo || 0 });
        } catch (e) { console.error('[missioni] aggiornamento saldo polvere:', e); }
    }
}
