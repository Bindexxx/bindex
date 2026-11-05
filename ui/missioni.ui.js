// Motore delle missioni e dei traguardi.

const MOTORE_MISSIONI = {

    _operatori: {
        '>=': (a, b) => a >= b,
        '>':  (a, b) => a > b,
        '==': (a, b) => a === b,
        '<=': (a, b) => a <= b,
        '<':  (a, b) => a < b,
    },

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

    valutaMissioni(dati) {
        return CATALOGO_MISSIONI.filter(m => this.valuta(m, dati));
    },

    valutaTraguardi(dati) {
        return CATALOGO_TRAGUARDI.filter(t => this.valuta(t, dati));
    },

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

    _estraiDaPool(ownerId, chiavePeriodo, pool, numero) {
        const seme = this._hashSemplice(ownerId + '|' + chiavePeriodo);
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

    _pad2(n) { return String(n).padStart(2, '0'); },

    _isoData(d) { return `${d.getFullYear()}-${this._pad2(d.getMonth() + 1)}-${this._pad2(d.getDate())}`; },

    _numeroSettimanaISO(d) {
        const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const giornoSett = (dt.getUTCDay() + 6) % 7;
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
            const giornoSett = (ora.getDay() + 6) % 7;
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

        const v = (r, campo = 'data') => {
            if (r && r.error) { console.warn('[missioni] raccoglata dati:', r.error.message); return 0; }
            return r ? (r[campo] ?? r.count ?? 0) : 0;
        };

        const numeroMissioniOggiCompletate = v(missioniOggi, 'count');
        const poolOggi = this.missioniDelGiorno(userId, oggi.periodo).length;

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

        const _categoriaTraguardoDi = (traguardoId) => {
            const t = CATALOGO_TRAGUARDI.find(x => x.id === traguardoId);
            return t ? t.categoria : null;
        };
        const _idsTraguardiRiscossi = (traguardiRiscossiIdTotale && traguardiRiscossiIdTotale.error)
            ? (console.warn('[missioni] raccolta dati (traguardi riscossi):', traguardiRiscossiIdTotale.error.message), [])
            : ((traguardiRiscossiIdTotale && traguardiRiscossiIdTotale.data) || []).map(row => row.traguardo_id);
        const categorieTraguardi = new Set(_idsTraguardiRiscossi.map(_categoriaTraguardoDi).filter(Boolean));

        const _traguardiSbloccatiPerPercentuale = _idsTraguardiRiscossi.filter(id => {
            const t = CATALOGO_TRAGUARDI.find(x => x.id === id);
            return t && t.metrica !== 'percentuale_traguardi_sbloccati';
        }).length;
        const percentualeTraguardiSbloccati = _totaleTraguardiPerPercentuale > 0
            ? Math.round((_traguardiSbloccatiPerPercentuale / _totaleTraguardiPerPercentuale) * 100)
            : 0;

        const _aperturaBinderOggi = v(aperturaBinder, 'count');
        const _aperturaMatchOggi = v(aperturaMatch, 'count');
        const esplorazioneSocialeOggi = _aperturaBinderOggi >= 1 || _aperturaMatchOggi >= 1;

        const _aperturaVisualizzazioneOggi = v(aperturaVisualizzazione, 'count');
        const _aperturaValoreCollezioneOggi = v(aperturaValoreCollezione, 'count');
        const _aperturaLocationOggi = v(aperturaLocation, 'count');
        const statisticheDistintePeriodo =
            (_aperturaVisualizzazioneOggi >= 1 ? 1 : 0) +
            (_aperturaValoreCollezioneOggi >= 1 ? 1 : 0) +
            (_aperturaLocationOggi >= 1 ? 1 : 0);

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
            layout_modificato_periodo: 0,
            layout_personalizzato_mai: false,
            _traguardiRiscossiIds: _idsTraguardiRiscossi,
        };
    },

    async valutaEAssegna(userId) {
        const primoGiro = await this._valutaEAssegnaUnGiro(userId);

        if (primoGiro.nuoveMissioni.length === 0 && primoGiro.nuoviTraguardi.length === 0) {
            return primoGiro;
        }

        const secondoGiro = await this._valutaEAssegnaUnGiro(userId);
        return {
            dati: secondoGiro.dati,
            missioniOggiPool: secondoGiro.missioniOggiPool,
            missioniSettimanaPool: secondoGiro.missioniSettimanaPool,
            missioniMesePool: secondoGiro.missioniMesePool,
            nuoveMissioni: [...primoGiro.nuoveMissioni, ...secondoGiro.nuoveMissioni],
            nuoviTraguardi: [...primoGiro.nuoviTraguardi, ...secondoGiro.nuoviTraguardi],
        };
    },

    async _valutaEAssegnaUnGiro(userId) {
        const dati = await this.raccogliDati(userId);

        const oggi = this.periodoCorrente('giornaliera');
        const settimana = this.periodoCorrente('settimanale');
        const mese = this.periodoCorrente('mensile');
        const missioniOggiPool = this.missioniDelGiorno(userId, oggi.periodo);
        const missioniSettimanaPool = this.missioniDellaSettimana(userId, settimana.periodo);
        const missioniMesePool = this.missioniDelMese(userId, mese.periodo);

        const pool = { giornaliera: missioniOggiPool, settimanale: missioniSettimanaPool, mensile: missioniMesePool };
        const inGioco = CATALOGO_MISSIONI.filter(m =>
            m.finestra === 'una_tantum' || (pool[m.finestra] || []).some(p => p.id === m.id)
        );

        const periodiInGioco = [...new Set([oggi.periodo, settimana.periodo, mese.periodo, 'sempre'])];
        const { data: righeGiaCompletate, error: errGiaCompletate } = await missioniCompletateIdPerPeriodi(userId, periodiInGioco);
        if (errGiaCompletate) console.warn('[missioni] verifica missioni già completate:', errGiaCompletate.message);
        const _giaCompletate = new Set((righeGiaCompletate || []).map(r => r.missione_id + '|' + r.periodo));

        const missioniSoddisfatte = inGioco.filter(m => this.valuta(m, dati))
            .filter(m => !_giaCompletate.has(m.id + '|' + this.periodoCorrente(m.finestra).periodo));
        const _giaRiscossi = new Set(dati._traguardiRiscossiIds || []);
        const traguardiSoddisfatti = this.valutaTraguardi(dati).filter(t => !_giaRiscossi.has(t.id));

        const nuoveMissioni = [];
        for (const m of missioniSoddisfatte) {
            const { periodo } = this.periodoCorrente(m.finestra);
            const { data: nuovaDavvero, error } = await missioneRiscattaCompletamento(m.id, m.finestra, periodo);
            if (error) {
                console.error('[missioni] errore assegnazione', m.id, error.message);
            } else if (nuovaDavvero) {
                nuoveMissioni.push(m);
            }
        }

        const nuoviTraguardi = [];
        for (const t of traguardiSoddisfatti) {
            const { data: nuovoDavvero, error } = await traguardoRiscatta(t.id);
            if (error) {
                console.error('[missioni] errore riscossione', t.id, error.message);
            } else if (nuovoDavvero) {
                nuoviTraguardi.push(t);
            }
        }

        return { dati, missioniOggiPool, missioniSettimanaPool, missioniMesePool, nuoveMissioni, nuoviTraguardi };
    },
};

async function _missioniNotificaCompletamenti(nuoveMissioni, nuoviTraguardi) {
    if (!(nuoveMissioni && nuoveMissioni.length) && !(nuoviTraguardi && nuoviTraguardi.length)) return;

    if (typeof CSBar !== 'undefined') {
        const elenco = (voci) => {
            const t = voci.map(v => v.titolo).filter(Boolean);
            return t.length <= 2 ? t.join(' e ') : t.slice(0, 2).join(', ') + ` e ${t.length - 2 === 1 ? 'un\'altra' : 'altre ' + (t.length - 2)}`;
        };
        const missioni = nuoveMissioni || [], traguardi = nuoviTraguardi || [];
        if (missioni.length >= 3) CSBar.avvisa('missione-completata', { text: `${missioni.length} missioni completate: ${elenco(missioni)}` });
        else missioni.forEach(m => CSBar.avvisa('missione-completata', { text: m.titolo }));
        if (traguardi.length >= 3) CSBar.avvisa('traguardo-sbloccato', { text: `${traguardi.length} traguardi sbloccati: ${elenco(traguardi)}` });
        else traguardi.forEach(t => CSBar.avvisa('traguardo-sbloccato', { text: t.titolo }));
    }

    if (typeof _beep === 'function') _beep(1200, 90);

    if (typeof CSBar !== 'undefined' && typeof CSBar.setCurrency === 'function' && typeof polvereSaldoLeggi === 'function') {
        try {
            const { data: saldo, error } = await polvereSaldoLeggi();
            if (!error) CSBar.setCurrency({ value: saldo || 0 });
        } catch (e) { console.error('[missioni] aggiornamento saldo polvere:', e); }
    }

    if (nuoviTraguardi && nuoviTraguardi.length && typeof _achievementNotificaSblocco === 'function') {
        nuoviTraguardi.forEach((t, i) => {
            setTimeout(() => _achievementNotificaSblocco(t), i * 3500);
        });
    }
}
