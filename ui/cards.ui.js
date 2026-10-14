// ── ui/cards.ui.js ─────────────────────────────────────────────────────
// Tabella Collezione/Wishlist: caricamento dati, realtime, rendering
// (vista desktop + vista compatta mobile).
//
// STEP separato dal piano "riduzione accoppiamento" concordato con Claudio
// il 2026-09-11. Le altre responsabilità di questo file (menu riga/modale
// modifica/elimina/dropdown inline, selezione multipla, filtro/ricerca)
// sono state spostate in ui/cards-modifica.ui.js, ui/cards-selezione.ui.js,
// ui/cards-filtro.ui.js — NESSUNA riscrittura del codice esistente in
// nessuno dei quattro file: solo spostamento, zero cambi di comportamento.
//
// Contiene: MODI_CON_VISTA_COMPATTA, caricaCarteReali, aggiornamento
// realtime, ordinaTabella, renderViewTable (+ _rigaCompattaHtml per la
// vista compatta).
//
// Chiamato cross-file da ui/cards-modifica.ui.js, ui/cards-selezione.ui.js
// e ui/cards-filtro.ui.js: caricaCarteReali() (ricarica dopo una modifica/
// eliminazione/selezione). A tempo di caricamento script gira solo la
// registrazione del listener 'visibilitychange' del realtime (V4, nessuna
// dipendenza da altri file) — l'ordine tra i quattro file cards-*.ui.js
// nei <script> tag di index.html è indifferente.

// ── ui/cards.ui.js ─────────────────────────────────────────────────────
// Tabella Collezione/Wishlist: caricamento, rendering, ordinamento, ricerca
// e filtro, modifica (modale e inline), selezione multipla, eliminazione,
// aggiornamento in tempo reale.


        // Le quattro tab che condividono la stessa tabella e possono quindi
        // passare alla vista compatta mobile. Unica fonte per i due punti che
        // ne hanno bisogno: renderViewTable (decide quale layout disegnare) e
        // il listener di resize in fondo al file (decide quando ridisegnare).
        // Prima erano due elenchi scritti a mano in posti diversi, e infatti
        // si erano scollati — vedi il FIX del 2026-09-01 sul resize.
        const MODI_CON_VISTA_COMPATTA = ['visualizzazione', 'scambio', 'wishlist', 'sealed'];


        // ── Riga del database → oggetto di carteReali ───────────────────────
        // (V4 velocità, 2026-10-12) Estratte IDENTICHE dalle due .map() di
        // caricaCarteReali, per riusarle quando un evento realtime aggiorna una
        // sola carta (vedi _applicaEventiInMemoria più sotto).
        function _rigaCarteDaDb(r, idsEsclusiValore) {
            return {
                id: r.id,
                tabella: 'carte',
                stato: 'collezione',
                esclusoValore: idsEsclusiValore.has(String(r.id)), // sql/95: non conta nei totali di valore
                tipo: r.tipo || null,
                name: r.nome || '',
                code: r.codice || '',
                location: r.location || '',
                qty: r.qty || 1,
                lang: r.lingua || 'IT',
                cond: r.condizione || 'NM',
                // AGGIUNTO (sessione widget Doppioni, 2026-09-18): prima non
                // portati in carteReali — nessun consumer esistente li usava,
                // aggiunta puramente additiva (2 chiavi in più su un oggetto
                // già esistente, nessun campo tolto/rinominato). Servono per
                // distinguere varianti reverse holo / prima edizione nel
                // raggruppamento "stessa carta, più righe" della pagina
                // Doppioni — prima venivano trattate come identiche a parità
                // di nome/codice/lingua/condizione, come succedeva già
                // ovunque nel sito prima di questa aggiunta.
                reverseHolo: !!r.reverse_holo,
                firstEd: !!r.first_ed,
                // 2026-09-20 (widget Set, sql/67): stampa posseduta scelta
                // (es. 'reverse-pokeball'). null = non specificata. Solo
                // il widget Set la legge; nessun consumer esistente cambia.
                variante: r.variante || null,
                sigillataOriginale: !!r.sigillata_originale,
                price: r.prezzo != null ? Number(r.prezzo) : 0,
                variation: _mappaVariazione(r),
                // A10 (Dashboard/Home) — stesso diff già calcolato dentro
                // _mappaVariazione, ma come numero puro invece che stringa
                // formattata: serve per ordinare le carte per oscillazione
                // nel blocco "Binder in primo piano". Duplicazione minima
                // voluta, non un refactor di _mappaVariazione.
                variazioneNumerica: (r.prezzo_precedente != null && r.prezzo != null) ? (Number(r.prezzo) - Number(r.prezzo_precedente)) : null,
                link: r.url || '#',
                notes: r.note || '',
                immagine: r.immagine || null,
                createdAt: r.created_at || null, // usato per l'ordine automatico nel Binder (Stage 1)
                ultimoControllo: r.ultimo_controllo || null, // RESTYLE: "controllate" in Prezzi aggiornati e Controllo prezzi
            };
        }

        function _rigaWishlistDaDb(r) {
            return {
                id: r.id,
                tabella: 'wishlist',
                stato: 'wishlist',
                name: r.nome || '',
                code: r.codice || '',
                location: r.location || '', // FIX: prima era sempre vuota per errore — la wishlist ha una location vera dalla migrazione wishlist_location.sql
                qty: r.qty || 1,
                // Fase 6, Step 2 (2026-09-13): NIENTE fallback '|| IT' qui
                // (a differenza di _rigaCarteDaDb sopra) — '' è la sentinella
                // "qualsiasi lingua" per le preferenze wishlist (sql/52),
                // un fallback la cancellerebbe ad ogni ricaricamento.
                lang: r.lingua || '',
                // condizione: dal Fase 6 significa "minima accettata", non
                // più un valore esatto — stesso campo, semantica cambiata
                // solo in fase di lettura/match (sql/52), zero DDL.
                cond: r.condizione || 'NM',
                price: r.prezzo != null ? Number(r.prezzo) : 0,
                variation: _mappaVariazione(r),
                link: r.url || '#',
                notes: r.note || '',
                immagine: r.immagine || null,
                prezzoObiettivo: r.prezzo_obiettivo != null ? Number(r.prezzo_obiettivo) : null,
                variazioneNumerica: (r.prezzo_precedente != null && r.prezzo != null) ? (Number(r.prezzo) - Number(r.prezzo_precedente)) : null, // RESTYLE: colonna Var. della Wishlist
            };
        }


        // ── (V5 velocità, 2026-10-12) COLLEZIONE SALVATA SUL DISPOSITIVO ─────
        // All'apertura la home si disegna subito con i dati dell'ultima visita;
        // il caricamento dal database parte comunque e li sostituisce appena
        // arriva. Stesso posto della sessione: localStorage con "Mantieni
        // accesso", sessionStorage senza (sparisce chiudendo la scheda) —
        // _authStoragePreferito() in config/supabase.js. Svuotata al logout
        // (cacheCarteSvuota, ui/auth.ui.js). Dati di più di 14 giorni o di
        // un'altra versione del formato: ignorati.
        const _CACHE_CARTE_PREFISSO = 'bindex_cache_carte_v1:';
        const _CACHE_CARTE_MAX_ETA_MS = 14 * 24 * 60 * 60 * 1000;
        let _carteCacheProvata = false;   // la cache si legge solo al primo caricamento
        let _carteDaCache = false;        // true finché i dati mostrati vengono dalla cache
        let _carteCacheSalvataIl = null;  // ms: quando era stata salvata la cache mostrata
        let _carteUltimoErrore = null;    // messaggio dell'ultimo caricamento fallito (null = ok)
        let _cacheCarteTimer = null;

        function _storageCacheCarte() {
            try { return (typeof _authStoragePreferito === 'function') ? _authStoragePreferito() : window.localStorage; } catch (_) { return null; }
        }

        function _idrataCarteDaCache(userId) {
            const st = _storageCacheCarte();
            if (!st) return false;
            let dati = null;
            try { dati = JSON.parse(st.getItem(_CACHE_CARTE_PREFISSO + userId) || 'null'); } catch (_) { return false; }
            if (!dati || dati.userId !== userId || !Array.isArray(dati.carte)) return false;
            if (!dati.salvato || Date.now() - dati.salvato > _CACHE_CARTE_MAX_ETA_MS) return false;
            carteReali = dati.carte;
            _idsNelBinder = new Set(dati.idsNelBinder || []);
            _idsInScambio = new Set(dati.idsInScambio || []);
            _quantitaOfferteScambio = dati.quantitaOfferteScambio || {};
            _carteDaCache = true;
            _carteCacheSalvataIl = dati.salvato;
            return true;
        }

        // Scrittura rimandata di 2 s: durante un controllo prezzi gli
        // aggiornamenti arrivano a raffica, si salva una volta sola alla fine.
        // Immagini incorporate (vecchi data: URI, decine di KB l'una) non
        // vengono salvate: la miniatura arriva comunque col caricamento vero.
        // Oltre 3 MB in tutto non si salva nulla (lo spazio è condiviso).
        const _CACHE_CARTE_MAX_IMMAGINE = 2000;
        const _CACHE_CARTE_MAX_TOTALE = 3 * 1024 * 1024;
        function _salvaCacheCarte(userId) {
            clearTimeout(_cacheCarteTimer);
            _cacheCarteTimer = setTimeout(() => {
                const st = _storageCacheCarte();
                if (!st) return;
                try {
                    const carte = carteReali.map(c => (c.immagine && c.immagine.length > _CACHE_CARTE_MAX_IMMAGINE) ? { ...c, immagine: null } : c);
                    const testo = JSON.stringify({
                        userId, salvato: Date.now(), carte,
                        idsNelBinder: [..._idsNelBinder], idsInScambio: [..._idsInScambio],
                        quantitaOfferteScambio: _quantitaOfferteScambio,
                    });
                    if (testo.length > _CACHE_CARTE_MAX_TOTALE) { st.removeItem(_CACHE_CARTE_PREFISSO + userId); return; }
                    st.setItem(_CACHE_CARTE_PREFISSO + userId, testo);
                    // mai una copia "orfana" nell'altro storage (preferenza cambiata)
                    const altro = st === window.localStorage ? window.sessionStorage : window.localStorage;
                    altro.removeItem(_CACHE_CARTE_PREFISSO + userId);
                } catch (_) { /* spazio pieno o storage bloccato: alla prossima apertura si parte dal database */ }
            }, 2000);
        }

        // Logout (ui/auth.ui.js): nessun dato della collezione resta sul dispositivo.
        function cacheCarteSvuota() {
            clearTimeout(_cacheCarteTimer);
            [window.localStorage, window.sessionStorage].forEach(st => {
                try {
                    Object.keys(st).filter(k => k.startsWith('bindex_cache_carte_')).forEach(k => st.removeItem(k));
                } catch (_) { /* storage non disponibile */ }
            });
        }


        // ── (Q1 quality of life, 2026-10-12) COLLEZIONE NON CARICATA ─────────
        // Prima un caricamento fallito finiva solo in console: tessere e
        // pagine mostravano "0 carte", "tutto in ordine"... come se fosse vero,
        // fino al refresh. Ora: barra fissa con Riprova (ui/avvisi.ui.js),
        // nuovi tentativi da soli (10 s, 30 s, 1 min, poi ogni 2 min; subito al
        // ritorno della rete; con la scheda in secondo piano al ritorno) e, se
        // non c'è nessun dato da mostrare, le tessere che dipendono dalla
        // collezione scrivono "—" (_carteNonCaricate, letta da renderWidgetHome).
        const _CARTE_ATTESE_TENTATIVO = [10000, 30000, 60000, 120000];
        let _carteTentativi = 0;
        let _carteTimerTentativo = null;

        function _carteNonCaricate() {
            return !!_carteUltimoErrore && !_carteDaCache && carteReali.length === 0;
        }

        function _carteSegnalaErrore() {
            let testo;
            if (_carteDaCache) {
                const quando = _carteCacheSalvataIl ? new Date(_carteCacheSalvataIl) : null;
                testo = 'Nessun collegamento al database: stai vedendo la collezione salvata'
                    + (quando ? ' il ' + quando.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) + ' alle ' + quando.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '') + '.';
            } else if (carteReali.length) {
                testo = 'Aggiornamento della collezione non riuscito: quello che vedi potrebbe non essere aggiornato.';
            } else {
                testo = 'Collezione non caricata: controlla la connessione.';
            }
            if (typeof avvisoFisso === 'function') {
                avvisoFisso('carte', testo, { tipo: 'errore', azione: { etichetta: 'Riprova', fn: () => { _carteTentativi = 0; caricaCarteReali(); } } });
            }
            clearTimeout(_carteTimerTentativo);
            const attesa = _CARTE_ATTESE_TENTATIVO[Math.min(_carteTentativi, _CARTE_ATTESE_TENTATIVO.length - 1)];
            _carteTentativi++;
            _carteTimerTentativo = setTimeout(() => {
                _carteTimerTentativo = null;
                if (document.hidden) { _ricaricaCarteAlRitorno = true; return; } // riprova al ritorno sulla scheda
                caricaCarteReali();
            }, attesa);
            // Senza dati: tessere a "—" invece degli stati "tutto ok" falsi.
            if (_carteNonCaricate() && typeof renderWidgetHome === 'function' && typeof _editModeWidget !== 'undefined' && !_editModeWidget
                && !document.body.classList.contains('phone-detail-open')) {
                renderWidgetHome();
            }
        }

        function _carteErroreRisolto() {
            clearTimeout(_carteTimerTentativo);
            _carteTimerTentativo = null;
            _carteTentativi = 0;
            if (typeof avvisoFissoTogli === 'function') avvisoFissoTogli('carte');
        }

        window.addEventListener('online', () => {
            if (!_carteUltimoErrore) return;
            _carteTentativi = 0;
            caricaCarteReali();
        });


        let _caricamentoCarteInCorso = false;

        async function caricaCarteReali() {
            const userId = await authGetUserId();
            if (!userId) return;

            // (V5) Primo caricamento: prima di andare in rete, la home si
            // disegna con la collezione salvata (se c'è).
            if (!_carteCacheProvata) {
                _carteCacheProvata = true;
                if (!carteReali.length && _idrataCarteDaCache(userId)) _aggiornaVisteDopoCarte({ daCache: true });
            }

            _caricamentoCarteInCorso = true;
            try {
                await _caricaCarteRealiDalDb(userId);
            } catch (e) {
                // (Q1) rete caduta a metà, risposta non valida...: stesso
                // trattamento di un errore restituito da Supabase.
                console.error('Errore caricamento carte:', e);
                _carteUltimoErrore = (e && e.message) || 'errore sconosciuto';
                _carteSegnalaErrore();
            } finally {
                _caricamentoCarteInCorso = false;
            }
        }

        async function _caricaCarteRealiDalDb(userId) {
            // Multi-Binder (2026-08-25): binder_carte ora è per-binder, non più
            // globale per utente — serve l'id del binder 'extra' PRIMA di
            // interrogare binder_carte. Get-or-create idempotente (vedi
            // data/binder.repository.js), fatto qui perché caricaCarteReali()
            // gira ad ogni apertura del sito, non solo aprendo il widget
            // Binders — _idsNelBinder deve essere corretto comunque (i
            // pulsanti "Aggiungi al Binder" in Visualizzazione/Wishlist non
            // dipendono dal widget Binders essendo mai stato aperto).
            // Fase 3, Step 2 (2026-09-12): stesso identico schema per il
            // binder Scambio — serve sia a _idsInScambio/_quantitaOfferteScambio
            // sotto (tab privata "Scambio") sia a _linkPubblicoCondivisione()
            // in ui/navigation-condivisione.ui.js (link/QR pubblico).
            // (V5 velocità, 2026-10-12) I due get-or-create sono indipendenti:
            // partono insieme invece che uno dopo l'altro.
            if (!_binderExtraId || !_binderScambioId) {
                const [esitoExtra, esitoScambio] = await Promise.all([
                    _binderExtraId ? null : binderExtraGarantisci(userId, 'Il mio binder'),
                    _binderScambioId ? null : binderScambioGarantisci(userId),
                ]);
                if (esitoExtra) {
                    if (esitoExtra.error) console.error('Errore nel garantire il binder extra:', esitoExtra.error.message);
                    else if (esitoExtra.data) _binderExtraId = esitoExtra.data.id;
                }
                if (esitoScambio) {
                    if (esitoScambio.error) console.error('Errore nel garantire il binder Scambio:', esitoScambio.error.message);
                    else if (esitoScambio.data) _binderScambioId = esitoScambio.data.id;
                }
            }

            // Collezione e wishlist ora vivono in DUE TABELLE separate (non
            // più stato='wishlist' dentro 'carte') — le leggiamo insieme e le
            // uniamo in un solo array per riusare la stessa tabella/filtri sul
            // sito. 'tabella' su ogni riga ricorda da dove viene, così
            // modifica/eliminazione sanno su quale tabella agire dopo.
            const [{ data: dataCarte, error: errCarte }, { data: dataWishlist, error: errWishlist }, { data: dataBinder, error: errBinder }, { data: dataScambio, error: errScambio }, { data: dataTuttiBinder }, { data: dataAppartenenze }] = await Promise.all([
                _selectTuttePagine(cardsQueryCollezione(userId)),
                _selectTuttePagine(wishlistQueryOrdinata(userId)),
                _binderExtraId ? _selectTuttePagine(binderCarteQuery(userId, _binderExtraId)) : Promise.resolve({ data: [], error: null }),
                _binderScambioId ? _selectTuttePagine(binderCarteQueryConQuantita(userId, _binderScambioId)) : Promise.resolve({ data: [], error: null }),
                // sql/95: serve per le carte escluse dai totali di valore. Non
                // bloccante: se fallisce (o la colonna non esiste ancora) nessuna
                // carta risulta esclusa e il sito funziona come prima.
                bindersQueryTutti(userId),
                _selectTuttePagine(binderCarteQueryTutteAppartenenze(userId)),
            ]);

            if (errCarte || errWishlist) {
                console.error('Errore caricamento carte:', (errCarte || errWishlist).message);
                _carteUltimoErrore = (errCarte || errWishlist).message || 'errore sconosciuto';
                _carteSegnalaErrore(); // (Q1)
                return;
            }

            // Fase A0/A3: non blocchiamo il caricamento della collezione se
            // la lettura del Binder fallisce (tabella nuova) — logghiamo e
            // procediamo con Set vuoto, il resto del sito resta usabile.
            if (errBinder) {
                console.error('Errore caricamento binder_carte:', errBinder.message);
                _idsNelBinder = new Set();
            } else {
                _idsNelBinder = new Set((dataBinder || []).map(r => String(r.carta_id)));
            }

            // Fase 3, Step 2: stesso trattamento non bloccante per lo Scambio.
            if (errScambio) {
                console.error('Errore caricamento binder Scambio:', errScambio.message);
                _idsInScambio = new Set();
                _quantitaOfferteScambio = {};
            } else {
                _idsInScambio = new Set((dataScambio || []).map(r => String(r.carta_id)));
                _quantitaOfferteScambio = {};
                (dataScambio || []).forEach(r => { _quantitaOfferteScambio[String(r.carta_id)] = r.quantita_offerta; });
            }

            const _idsEsclusiValore = (typeof calcolaIdsEsclusiValore === 'function')
                ? calcolaIdsEsclusiValore((dataCarte || []).map(r => ({ id: r.id, location: r.location })), dataTuttiBinder, dataAppartenenze)
                : new Set();

            const righeCarte = (dataCarte || []).map(r => _rigaCarteDaDb(r, _idsEsclusiValore));
            const righeWishlist = (dataWishlist || []).map(_rigaWishlistDaDb);

            carteReali = [...righeCarte, ...righeWishlist];
            _carteDaCache = false;
            _carteUltimoErrore = null;
            _carteErroreRisolto(); // (Q1) via la barra d'errore e i tentativi in coda

            if (typeof raritaAggiorna === 'function') raritaAggiorna(); // rarità dal catalogo (parte sincrona = dalla cache)
            _aggiornaVisteDopoCarte({});
            _salvaCacheCarte(userId);
        }


        // Popola la tendina filtro con le location REALMENTE presenti nei
        // tuoi dati, invece del vecchio elenco fisso scritto a mano.
        function _popolaFiltroLocationCarte() {
            const selectLoc = document.getElementById('filterLocation');
            if (!selectLoc) return;
            const locationPresenti = [...new Set(carteReali.map(c => c.location).filter(Boolean))].sort();
            const valorePrecedente = selectLoc.value;
            selectLoc.innerHTML = '<option value="">Tutte le Location</option>';
            locationPresenti.forEach(loc => {
                const opt = document.createElement('option');
                opt.value = loc;
                opt.textContent = loc;
                selectLoc.appendChild(opt);
            });
            if (valorePrecedente) selectLoc.value = valorePrecedente;
        }


        // Tutto quello che va ridisegnato quando carteReali cambia (prima era
        // in coda a caricaCarteReali, identico).
        //  - daCache: dati salvati sul dispositivo (V5) — niente funzioni che
        //    leggono a loro volta dal database (le fa il caricamento vero).
        //  - leggero: aggiornamento realtime applicato in memoria (V4) — le tre
        //    letture dal database della home si rifanno al massimo ogni 15 s.
        let _avvisiHomeLeggeriTimer = null;
        function _aggiornaVisteDopoCarte({ daCache = false, leggero = false } = {}) {
            _popolaFiltroLocationCarte();
            filterTable();
            aggiornaStatCardHome();
            if (!daCache) {
                if (leggero) {
                    if (!_avvisiHomeLeggeriTimer) {
                        _avvisiHomeLeggeriTimer = setTimeout(() => {
                            _avvisiHomeLeggeriTimer = null;
                            caricaAvvisiHome();
                            caricaUltimaSincronizzazioneHome();
                            caricaAttivitaRecentiHome();
                        }, 15000);
                    }
                } else {
                    clearTimeout(_avvisiHomeLeggeriTimer);
                    _avvisiHomeLeggeriTimer = null;
                    caricaAvvisiHome();
                    caricaUltimaSincronizzazioneHome();
                    caricaAttivitaRecentiHome();
                }
            }
            renderBinderInPrimoPianoHome();
            // Widget della home (Collezione, Valore, Doppioni...): i dati sono
            // appena cambiati (realtime, import, modifica), ridisegnarli subito
            // invece di aspettare il giro automatico da 15 secondi. Stesse
            // condizioni del giro automatico: non durante la modifica della
            // home (spezzerebbe il trascinamento) e non con una pagina aperta
            // (alla chiusura si ridisegna comunque).
            if (typeof renderWidgetHome === 'function' && typeof _editModeWidget !== 'undefined' && !_editModeWidget
                && !document.body.classList.contains('phone-detail-open')) {
                renderWidgetHome();
            }
        }


        // ── AGGIORNAMENTO IN TEMPO REALE ──────────────────────────────────────────
        // Prima questa pagina caricava 'carte'/'wishlist' una sola volta,
        // all'apertura — carte aggiunte dopo (dall'estensione, magari su un
        // altro PC) restavano invisibili finché non si premeva F5. Supabase
        // Realtime avvisa il browser in tempo reale a ogni insert/update/
        // delete sulle tabelle sottoscritte, senza bisogno di ricaricare né
        // di ripetuti controlli manuali (polling).
        //
        // Debounce di 600ms: durante un controllo prezzi che aggiorna decine
        // di righe una via l'altra, altrimenti ricaricheremmo l'intera
        // collezione ad ogni singola riga — aspettiamo che gli eventi si
        // "calmino" prima di ricaricare una volta sola.
        //
        // (V4 velocità, 2026-10-12)
        //  a) Scheda in secondo piano: nessuna ricarica; una sola, completa,
        //     quando si torna sulla scheda.
        //  b) Gli eventi raccolti nel debounce si applicano in memoria quando
        //     sono semplici aggiornamenti di carte già presenti (prezzo,
        //     quantità, note... — il caso del controllo prezzi, una carta alla
        //     volta): niente più 18 query e ~0,5 MB a ogni carta. Carte nuove,
        //     eliminate, location/nome/stato cambiati o eventi incompleti →
        //     ricarica completa, come sempre.
        let _eventiRealtimeCarte = [];
        let _ricaricaCarteAlRitorno = false;

        function _pianificaRicaricaCarte(evento) {
            if (document.hidden) {
                _ricaricaCarteAlRitorno = true;
                _eventiRealtimeCarte = [];
                if (_debounceRicaricaCarte) { clearTimeout(_debounceRicaricaCarte); _debounceRicaricaCarte = null; }
                return;
            }
            _eventiRealtimeCarte.push(evento || null);
            if (_debounceRicaricaCarte) clearTimeout(_debounceRicaricaCarte);
            _debounceRicaricaCarte = setTimeout(_applicaEventiRealtimeCarte, 600);
        }

        document.addEventListener('visibilitychange', () => {
            if (document.hidden || !_ricaricaCarteAlRitorno) return;
            _ricaricaCarteAlRitorno = false;
            _eventiRealtimeCarte = [];
            caricaCarteReali();
        });

        async function _applicaEventiRealtimeCarte() {
            _debounceRicaricaCarte = null;
            // Un caricamento completo è già in corso: gli eventi restano in
            // coda e si applicano dopo, sui dati freschi.
            if (_caricamentoCarteInCorso) {
                _debounceRicaricaCarte = setTimeout(_applicaEventiRealtimeCarte, 600);
                return;
            }
            const eventi = _eventiRealtimeCarte;
            _eventiRealtimeCarte = [];
            if (!eventi.length) return;
            if (_carteDaCache || !_applicaEventiInMemoria(eventi)) {
                await caricaCarteReali();
                return;
            }
            if (typeof raritaAggiorna === 'function') raritaAggiorna();
            _aggiornaVisteDopoCarte({ leggero: true });
            const userId = await authGetUserId();
            if (userId) _salvaCacheCarte(userId);
        }

        // true = tutti gli eventi applicati sulle righe in memoria; false =
        // serve la ricarica completa (in quel caso carteReali NON viene toccato).
        function _applicaEventiInMemoria(eventi) {
            const sostituzioni = new Map(); // indice in carteReali → riga nuova
            for (const ev of eventi) {
                if (!ev || ev.eventType !== 'UPDATE' || !ev.new || ev.new.id == null) return false;
                if (ev.table !== 'carte' && ev.table !== 'wishlist') return false;
                const r = ev.new;
                if (!('nome' in r) || !('prezzo' in r) || !('location' in r)) return false; // evento incompleto
                const i = carteReali.findIndex(c => c.tabella === ev.table && String(c.id) === String(r.id));
                if (i < 0) return false;
                const vecchia = carteReali[i];
                if ((r.nome || '') !== vecchia.name) return false;            // cambia l'ordine alfabetico
                if ((r.location || '') !== vecchia.location) return false;    // cambia filtri ed esclusioni dal valore
                if (ev.table === 'carte') {
                    if (r.stato !== 'collezione') return false;               // esce dalla collezione
                    const esclusa = vecchia.esclusoValore ? new Set([String(r.id)]) : new Set();
                    sostituzioni.set(i, _rigaCarteDaDb(r, esclusa));
                } else {
                    sostituzioni.set(i, _rigaWishlistDaDb(r));
                }
            }
            sostituzioni.forEach((riga, i) => { carteReali[i] = riga; });
            return true;
        }


        async function _avviaRealtimeCarte() {
            const userId = await authGetUserId();
            if (!userId) return;

            cardsRealtimeSubscribe(userId, _pianificaRicaricaCarte);
        }

        /* LOGICA EASTER EGG CHANGELOG */


        function ordinaTabella(colonna) {
            if (_sortColonna === colonna) _sortAsc = !_sortAsc;
            else { _sortColonna = colonna; _sortAsc = true; }
            filterTable();
        }


        function _freccettaOrdinamento(colonna) {
            if (_sortColonna !== colonna) return '';
            return ` <i class="fa-solid fa-${_sortAsc ? 'arrow-up' : 'arrow-down'}" style="font-size:0.65rem;"></i>`;
        }


        function renderViewTable(data) {
            // (V1 velocità, 2026-10-12) Tabella condivisa e Collezione vivono
            // nella sezione 'visualizzazione': con un'altra sezione attiva (home,
            // impostazioni, inserimento, binder, prezzi, pagine dei widget) non
            // si vedono, e ridisegnarle a vuoto costava ~2 s sul telefono a ogni
            // avvio e a ogni ricarica realtime. switchTab() le ridisegna comunque
            // (filterTable) quando si torna su Collezione/Scambio/Wishlist/Sealed.
            const sezioneTabella = document.getElementById('visualizzazione');
            if (sezioneTabella && !sezioneTabella.classList.contains('active')) return;

            const tbody = document.getElementById('viewTableBody');
            const theadRow = document.getElementById('tableHeaderRow');
            const pannelloTabella = document.getElementById('pannelloTabella');
            const contenitoreCompatto = document.getElementById('viewCardsCompact');
            tbody.innerHTML = '';

            // RESTYLE BINDEX (2026-10-01): la tab Collezione ha il suo render
            // (ui/collezione-vista.ui.js). Scambio/Wishlist/Sealed restano qui.
            if (currentMode === 'visualizzazione' && typeof collezioneRender === 'function') {
                collezioneRender(data);
                return;
            }
            if (typeof collezioneDisattiva === 'function') collezioneDisattiva();

            if (_sortColonna) {
                data = [...data].sort((a, b) => {
                    let va = a[_sortColonna], vb = b[_sortColonna];
                    if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb || '').toLowerCase(); }
                    if (va < vb) return _sortAsc ? -1 : 1;
                    if (va > vb) return _sortAsc ? 1 : -1;
                    return 0;
                });
            }

            // Vista compatta: solo tab Visualizzazione, solo telefono vero
            // (sotto i 640px) — non su finestre desktop ridotte, dove invece
            // vogliamo che la tabella classica entri semplicemente tutta
            // senza scorrimento (vedi CSS più stretto qui sotto).
            // FIX: Scambio/Wishlist/Sealed usavano ancora la conversione
            // generica "tabella → schedine con etichette" — che non gestisce
            // bene la combinazione miniatura+nome (si sovrapponevano,
            // mostrando frammenti tipo "Ra"/"V9" invece del nome intero). La
            // vista compatta "vera", già pensata apposta per questo, ora si
            // applica a tutte le tab con la tabella condivisa, non solo a
            // Visualizzazione.
            const modalitaCompatta = MODI_CON_VISTA_COMPATTA.includes(currentMode) && window.innerWidth <= 640;
            pannelloTabella.style.display = modalitaCompatta ? 'none' : '';
            contenitoreCompatto.style.display = modalitaCompatta ? '' : 'none';

            const th = (label, colonna) => colonna
                ? `<th style="cursor:pointer; user-select:none;" onclick="ordinaTabella('${colonna}')">${label}${_freccettaOrdinamento(colonna)}</th>`
                : `<th>${label}</th>`;

            theadRow.innerHTML = `
                <th><input type="checkbox" id="checkAllRows" onchange="toggleSelezionaTutte(this.checked)" title="Seleziona tutte (quelle filtrate)"></th>
                ${th('Q.TÀ', 'qty')}
                ${th('NOME CARTA', 'name')}
                ${th('CODICE', 'code')}
                ${th('LOCATION', 'location')}
                ${th('LINGUA', 'lang')}
                ${th('COND.', 'cond')}
                ${th('PREZZO CAD.', 'price')}
                <th>VAR.</th>
                <th>LINK</th>
                <th>NOTE</th>
                <th>AZIONI</th>
            `;

            let totalSum = 0;
            let totalQty = 0;
            let htmlCompatto = '';

            data.forEach(card => {
                const tr = document.createElement('tr');
                tr.classList.add('interactive-row');
                if (highlightedRowId === card.id) {
                    tr.classList.add('highlighted-row');
                }

                tr.onclick = (e) => {
                    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input')) return;
                    toggleRowHighlight(card.id);
                };

                const langClass = card.lang === 'KOR' ? 'badge-lang-kor' : 'badge-lang';
                const condClass = card.cond === 'EX' ? 'badge-cond-ex' : 'badge-cond';
                const varClass = card.variation.includes('▲') ? 'variation-up' : (card.variation.includes('▼') ? 'variation-down' : 'variation-none');

                totalSum += card.price * card.qty;
                totalQty += card.qty;

                const idAttr = String(card.id).replace(/'/g, "\\'");
                // escapeJsAttr (audit 2026-09-25, A3/M2): una " o un a-capo
                // in location/nome/codice/note rompeva l'onclick della cella.
                const locAttr = escapeJsAttr(card.location || '');
                // FIX: Cardmarket blocca l'hotlinking diretto delle proprie
                // immagini (per questo il <img src> mostrava l'icona rotta) —
                // images.weserv.nl le recupera lato server e le riserve dal
                // proprio dominio, stesso proxy già usato in sidebar.html.
                // Da ora l'estensione salva l'immagine come "data URI"
                // (incorporata, scaricata direttamente dalla pagina
                // Cardmarket vera) invece di un semplice link esterno — che
                // Cardmarket blocca se richiesto da un dominio diverso (da
                // qui il problema delle miniature sempre rotte). Se il
                // valore è già un data URI (inizia con "data:") lo uso
                // direttamente; se invece è ancora un vecchio URL esterno
                // (carte aggiunte prima di questa correzione), tento il
                // proxy come ripiego — funziona per alcune immagini, non per
                // tutte, ma è meglio di niente per lo storico.
                const immagineSrc = _urlImmagineVisualizzabile(card.immagine);
                const thumb = immagineSrc
                    ? `<img src="${immagineSrc}" alt="" style="width:32px; height:44px; object-fit:cover; border-radius:4px; vertical-align:middle; margin-right:0.5rem; box-shadow:0 1px 4px rgba(0,0,0,0.15); cursor:pointer;" loading="lazy" title="Ingrandisci" onclick="event.stopPropagation(); apriImmagineIngrandita('${idAttr}')" onerror="this.style.display='none';">`
                    : '';
                const obiettivoRaggiunto = card.tabella === 'wishlist' && card.prezzoObiettivo != null && card.price > 0 && card.price <= card.prezzoObiettivo;
                if (obiettivoRaggiunto) tr.style.backgroundColor = 'var(--success-bg)';

                const nomeAttr = escapeJsAttr(card.name);
                const codeAttr = escapeJsAttr(card.code || '');
                const notesAttr = escapeJsAttr(card.notes || '');
                // (Audit sicurezza 2026-10-12) Link della carta: solo http/https e
                // escapato. Prima finiva grezzo nell'href: il link puo' essere
                // scritto anche dal controllo prezzi di gruppo (altri utenti).
                const linkSicuro = urlEsternoSicuro(card.link);

                if (modalitaCompatta) {
                    htmlCompatto += _rigaCompattaHtml(card, idAttr, locAttr, nomeAttr, langClass, condClass, varClass, immagineSrc, obiettivoRaggiunto);
                    return; // niente <tr>, questa carta esiste solo nella vista compatta
                }

                tr.innerHTML = `
                    <td><input type="checkbox" class="riga-checkbox" data-id="${idAttr}" data-tabella="${card.tabella}" onclick="event.stopPropagation(); aggiornaSelezioneMultipla();"></td>
                    <td data-label="Q.tà" class="cella-editabile" title="Clicca per modificare" onclick="event.stopPropagation(); modificaCampoInline('${idAttr}', '${card.tabella}', 'qty', ${card.qty}, 'Quantità', 'intero')"><strong>${card.qty}</strong></td>
                    <td data-label="Nome" class="cella-editabile" title="${card.name.replace(/"/g, '&quot;')} — clicca per modificare" onclick="event.stopPropagation(); modificaCampoInline('${idAttr}', '${card.tabella}', 'nome', '${nomeAttr}', 'Nome')" style="max-width:170px; overflow:hidden; text-overflow:ellipsis;">${thumb}<strong>${escapeHtml(card.name)}</strong>${obiettivoRaggiunto ? ` <span class="badge" style="background-color:var(--success-bg); color:var(--success);" title="Prezzo sceso al di sotto del tuo obiettivo (${card.prezzoObiettivo.toFixed(2)} €)">🎯 obiettivo!</span>` : ''}${card.sigillataOriginale ? ` <span class="badge" style="background-color:var(--primary-light); color:var(--primary);" title="Ancora sigillata nella bustina originale">📦 sigillata</span>` : ''}</td>
                    <td data-label="Codice" class="cella-editabile" title="Clicca per modificare" onclick="event.stopPropagation(); modificaCampoInline('${idAttr}', '${card.tabella}', 'codice', '${codeAttr}', 'Codice')"><code>${escapeHtml(card.code)}</code></td>
                    <td data-label="Location"><span class="badge badge-location" title="${(card.location || '').replace(/"/g, '&quot;')} — clicca per modificare" onclick="event.stopPropagation(); modificaLocationInline(event, '${idAttr}', '${card.tabella}', '${locAttr}')">${escapeHtml(card.location || '—')}</span></td>
                    <td data-label="Lingua"><span class="badge ${langClass} cella-editabile" title="Clicca per modificare" onclick="event.stopPropagation(); modificaLinguaInline(event, '${idAttr}', '${card.tabella}', '${escapeJsAttr(card.lang || '')}')">${card.lang ? escapeHtml(card.lang) : 'Qualsiasi'}</span></td>
                    <td data-label="Cond."><span class="badge ${condClass} cella-editabile" title="Clicca per modificare" onclick="event.stopPropagation(); modificaCondizioneInline(event, '${idAttr}', '${card.tabella}', '${escapeJsAttr(card.cond || '')}')">${escapeHtml(card.cond)}</span></td>
                    <td data-label="Prezzo" id="prezzoCella-${idAttr}" class="price cella-editabile" title="Clicca per modificare" onclick="event.stopPropagation(); modificaCampoInline('${idAttr}', '${card.tabella}', 'prezzo', ${card.price}, 'Prezzo (€)', 'numero')">${formattaEuro(card.price)}</td>
                    <td data-label="Var." class="${varClass}">${escapeHtml(card.variation)}</td>
                    <td data-label="Link">
                        ${linkSicuro ? `<a href="${linkSicuro}" target="_blank" rel="noopener noreferrer" class="link-icon">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i>
                        </a>` : ''}
                    </td>
                    <td data-label="Note" class="cella-editabile" title="${card.notes ? card.notes.replace(/"/g, '&quot;') + ' — ' : ''}clicca per modificare" onclick="event.stopPropagation(); modificaCampoInline('${idAttr}', '${card.tabella}', 'note', '${notesAttr}', 'Note', 'facoltativo')" style="max-width:90px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text-muted); font-size:0.75rem;">${card.notes ? escapeHtml(card.notes) : '—'}</td>
                    <td style="text-align:center;">
                        <div style="position:relative; display:inline-block;">
                            <button class="btn-danger" style="color:var(--text-muted);" onclick="event.stopPropagation(); toggleMenuAzioniTabella('${idAttr}')" title="Azioni"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                            <div id="menuAzioniTabella-${idAttr}" class="menu-azioni-tabella" style="display:none;">
                                <button onclick="apriModificaCarta('${idAttr}')"><i class="fa-solid fa-pen"></i> Modifica</button>
                                ${card.tabella === 'wishlist' ? `<button onclick="segnaOttenuta('${card.id}')" style="color:var(--success);"><i class="fa-solid fa-check"></i> Ottenuta</button>` : ''}
                                ${card.tabella === 'carte' && card.stato === 'collezione' ? `<button class="btn-binder-toggle" data-id="${idAttr}" onclick="event.stopPropagation(); toggleBinderMembership('${idAttr}')"><i class="fa-solid fa-layer-group"></i> ${_idsNelBinder.has(String(card.id)) ? 'Rimuovi dal Binder' : 'Aggiungi al Binder'}</button>` : ''}
                                ${card.tabella === 'carte' && card.stato === 'collezione' ? `<button class="btn-scambio-toggle" data-id="${idAttr}" onclick="event.stopPropagation(); apriModaleQuantitaScambio('${idAttr}')"><i class="fa-solid fa-right-left"></i> ${_idsInScambio.has(String(card.id)) ? `In Scambio: ${_quantitaOfferteScambio[String(card.id)] ?? 0}` : 'Offri in Scambio'}</button>` : ''}
                                <button onclick="apriGraficoPrezzo('${idAttr}', '${card.tabella}', '${nomeAttr}')"><i class="fa-solid fa-chart-line"></i> Andamento prezzo</button>
                                ${card.tabella === 'carte' && card.stato === 'collezione' ? `<button onclick="fotoApriCarta('${idAttr}')"><i class="fa-solid fa-camera"></i> Foto reali</button>` : ''}
                                <button onclick="eliminaCarta('${card.id}')" style="color:var(--danger);"><i class="fa-solid fa-trash"></i> Elimina</button>
                            </div>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            if (modalitaCompatta) {
                contenitoreCompatto.innerHTML = htmlCompatto || '<p style="text-align:center; color:var(--text-muted); padding:2rem 0;">Nessuna carta trovata.</p>';
            }

            document.getElementById('stat-count').innerText = totalQty;
            document.getElementById('stat-value').innerText = formattaEuro(totalSum);
            const uniqueLocs = [...new Set(data.map(item => item.location))].length;
            document.getElementById('stat-locations').innerText = uniqueLocs;

            // La selezione multipla non sopravvive a un nuovo render (cambio
            // filtro, refresh realtime...) — semplifica la logica ed evita
            // di tenere "selezionate" righe che magari non sono più visibili.
            _aggiornaBarraSelezioneMultipla();
        }


        // Costruisce l'HTML di una singola schedina per la vista compatta
        // mobile — nome+link+prezzo+variazione in cima, meta condensati
        // (quantità/codice/lingua/condizione) e pill Location sotto, azioni
        // in un pannello a comparsa per non affollare la card.
        function _rigaCompattaHtml(card, idAttr, locAttr, nomeAttr, langClass, condClass, varClass, immagineSrc, obiettivoRaggiunto) {
            const thumbCompatta = immagineSrc
                ? `<img src="${immagineSrc}" alt="" class="riga-compatta-thumb" loading="lazy" onclick="event.stopPropagation(); apriImmagineIngrandita('${idAttr}')" onerror="this.style.display='none';">`
                : '';
            const iconaVariazione = varClass === 'variation-up'
                ? '<i class="fa-solid fa-arrow-up" style="color:var(--success); font-size:0.7rem;"></i>'
                : (varClass === 'variation-down' ? '<i class="fa-solid fa-arrow-down" style="color:var(--danger); font-size:0.7rem;"></i>' : '');
            // (Audit sicurezza 2026-10-12) solo http/https, escapato (vedi urlEsternoSicuro).
            const linkSicuro = urlEsternoSicuro(card.link);
            const linkIcona = linkSicuro
                ? `<a href="${linkSicuro}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="color:var(--primary); flex-shrink:0;"><i class="fa-solid fa-arrow-up-right-from-square" style="font-size:0.68rem;"></i></a>`
                : '';
            const metaTesto = [
                `x${card.qty}`,
                card.code || null,
                card.lang,
                card.cond,
            ].filter(Boolean).join(' · ');

            return `
                <div class="riga-compatta">
                    <div class="riga-compatta-top">
                        <input type="checkbox" class="riga-checkbox" data-id="${idAttr}" data-tabella="${card.tabella}" onclick="event.stopPropagation(); aggiornaSelezioneMultipla();">
                        ${thumbCompatta}
                        <span class="riga-compatta-nome">
                            <span class="riga-compatta-nome-testo">${escapeHtml(card.name)}</span>
                            ${linkIcona}
                        </span>
                        ${iconaVariazione}
                        <span class="riga-compatta-prezzo" id="prezzoCellaCompatta-${idAttr}">${formattaEuro(card.price)}</span>
                        <button class="riga-compatta-menu-btn" onclick="event.stopPropagation(); toggleMenuCompatto('${idAttr}')"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                    </div>
                    <div class="riga-compatta-meta">
                        <span class="riga-compatta-meta-testo">${escapeHtml(metaTesto)}</span>
                        <span class="pill-location">${escapeHtml(card.location || '—')}</span>
                        ${obiettivoRaggiunto ? `<span class="pill-location" style="background-color:var(--success-bg); color:var(--success);">🎯 obiettivo</span>` : ''}
                        ${card.sigillataOriginale ? `<span class="pill-location" style="background-color:var(--primary-light); color:var(--primary);">📦 sigillata</span>` : ''}
                    </div>
                    <div class="riga-compatta-azioni" id="menuCompatto-${idAttr}" style="display:none;">
                        <button onclick="event.stopPropagation(); apriModificaCarta('${idAttr}')"><i class="fa-solid fa-pen"></i> Modifica</button>
                        ${card.tabella === 'wishlist' ? `<button onclick="segnaOttenuta('${card.id}')"><i class="fa-solid fa-check"></i> Ottenuta</button>` : ''}
                        ${card.tabella === 'carte' && card.stato === 'collezione' ? `<button class="btn-binder-toggle" data-id="${idAttr}" onclick="event.stopPropagation(); toggleBinderMembership('${idAttr}')"><i class="fa-solid fa-layer-group"></i> ${_idsNelBinder.has(String(card.id)) ? 'Rimuovi dal Binder' : 'Aggiungi al Binder'}</button>` : ''}
                        ${card.tabella === 'carte' && card.stato === 'collezione' ? `<button class="btn-scambio-toggle" data-id="${idAttr}" onclick="event.stopPropagation(); apriModaleQuantitaScambio('${idAttr}')"><i class="fa-solid fa-right-left"></i> ${_idsInScambio.has(String(card.id)) ? `In Scambio: ${_quantitaOfferteScambio[String(card.id)] ?? 0}` : 'Offri in Scambio'}</button>` : ''}
                        <button onclick="apriGraficoPrezzo('${idAttr}', '${card.tabella}', '${nomeAttr}')"><i class="fa-solid fa-chart-line"></i> Andamento</button>
                        ${card.tabella === 'carte' && card.stato === 'collezione' ? `<button onclick="fotoApriCarta('${idAttr}')"><i class="fa-solid fa-camera"></i> Foto</button>` : ''}
                        <button onclick="eliminaCarta('${card.id}')" style="color:var(--danger);"><i class="fa-solid fa-trash"></i> Elimina</button>
                    </div>
                </div>
            `;
        }
