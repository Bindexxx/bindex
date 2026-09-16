// ═══════════════════════════════════════════════════════════════════════
// FLIP-CARD-DETAIL.UI.JS — apertura dettaglio carta (flip animato),
// gestione doppioni — CardSync Pro
// ═══════════════════════════════════════════════════════════════════════
// STEP separato dal piano "riduzione accoppiamento" concordato con Claudio
// il 2026-09-11. Estratto da ui/home.ui.js. NESSUNA riscrittura del
// codice esistente: solo spostamento, zero cambi di comportamento per
// l'utente finale.
//
// ⚠ Nonostante il nome storico "apriFlipCardHome" (mai rinominato per non
// toccare i tantissimi punti di chiamata), questo meccanismo NON è
// specifico della Home — è il modo condiviso in cui TUTTO il sito apre il
// dettaglio flip di una carta. Usato da: ui/widget-valore-collezione.ui.js,
// ui/widget-in-primo-piano.ui.js, ui/widget-wishlist.ui.js,
// ui/missioni-catalogo.ui.js, ui/widget-doppioni.ui.js,
// ui/widget-vetrina.ui.js, ui/modals.ui.js, ui/binder.ui.js,
// ui/widget-render-tessere-grandi.ui.js, data/missioni-scrittura.repository.js,
// data/missioni.repository.js — verificato con grep su tutto il progetto,
// non dedotto.
//
// Contiene: apriFlipCardHome, _mostraSceltaGestisciDoppione,
// _doppioneSpostaInScambio, _doppioneApriModifica, toggleFlipCard,
// vaiAllaCartaNelBinder.
//
// Nessuna istruzione qui gira a tempo di caricamento script — l'ordine tra
// questo file e ui/home.ui.js nei <script> tag di index.html è
// indifferente.
// ───────────────────────────────────────────────────────────────────────

        // OPUS 2026-08-25 (libro sfogliabile del Binder): secondo parametro
        // OPZIONALE, aggiunto senza toccare nessuno dei punti di chiamata
        // esistenti (che continuano a passare solo l'id e a comportarsi
        // esattamente come prima).
        //   opzioni.binderId            → di QUALE binder mostrare la sleeve
        //                                 sul retro. Serve perché dal
        //                                 Multi-Binder in poi la sleeve non è
        //                                 più unica per utente ma per binder
        //                                 (user_media.binder_id, vedi
        //                                 17_binders_multipli.sql). Se non
        //                                 passato, renderRetroCartaOwner prova
        //                                 a dedurlo dalla location della carta
        //                                 e, se non ci riesce, mostra il retro
        //                                 di sistema.
        //   opzioni.nascondiVaiAlBinder → nasconde il bottone "Vai al binder"
        //                                 (richiesta di Claudio: se la carta è
        //                                 stata aperta da DENTRO il binder,
        //                                 quel bottone non ha senso).
        function apriFlipCardHome(id, opzioni = {}) {
            const card = carteReali.find(c => String(c.id) === String(id));
            if (!card) return;

            // Missioni #13/#41/#82/#87 (2026-08-30): apertura dettaglio
            // carta. Fire-and-forget, stesso pattern degli altri hook
            // missioni — un fallimento qui non deve mai bloccare il
            // flip-viewer. Nessun dedup: ogni tap conta (deciso da
            // Claudio), anche sulla stessa carta più volte nello stesso
            // giorno. 'vecchia' (#87 "Ritorno al passato"): true se la
            // carta non è stata aggiunta oggi — confronto in giorno-di-
            // calendario locale, stesso principio già usato per lo streak
            // accessi in data/missioni.repository.js.
            const _vecchia = (() => {
                if (!card.createdAt) return false;
                const d = new Date(card.createdAt);
                const oggi = new Date();
                return d.getFullYear() !== oggi.getFullYear() || d.getMonth() !== oggi.getMonth() || d.getDate() !== oggi.getDate();
            })();
            (async () => {
                try {
                    const userId = await authGetUserId();
                    if (userId) await missioniDettaglioCartaRegistra(userId, card.id, opzioni.origine, _vecchia);
                } catch (e) { console.error('[missioni] registrazione apertura dettaglio carta:', e); }
            })();

            // Modale fullscreen (2026-08-31): attivo SOLO qui, non nel
            // modo immagine semplice (apriUrlIngrandito/chiudiImmagineIngrandita
            // in ui/modals.ui.js la rimuovono). display:flex, non 'block':
            // la variante fullscreen del CSS (#immagineModalContent.modal-
            // content-flip-fullscreen #flipCardScene) è un layout a colonna
            // flex, .flip-card-inner calcola la propria larghezza
            // dall'altezza reale via aspect-ratio.
            document.getElementById('immagineModalContent').classList.add('modal-content-flip-fullscreen');
            // Blocca lo scroll della pagina sotto (2026-08-31): il modale è
            // a schermo intero, senza questo restava visibile la scrollbar
            // del body dietro/accanto — nessun altro modale del sito lo
            // fa (sono piccoli, centrati, non coprono la viewport), quindi
            // non tocco nulla di condiviso: solo qui, rimosso in
            // chiudiImmagineIngrandita()/apriUrlIngrandito() in
            // ui/modals.ui.js.
            document.body.style.overflow = 'hidden';
            document.getElementById('immagineErroreMsg').style.display = 'none';
            document.getElementById('immagineIngranditaImg').style.display = 'none';
            const scena = document.getElementById('flipCardScene');
            scena.style.display = 'flex';
            // L'inline margin-top:0.5rem del markup vince sempre sul CSS
            // (specificità inline), va azzerato qui o lascerebbe uno
            // scarto fisso anche in modalità fullscreen.
            scena.style.marginTop = '0';

            const inner = document.getElementById('flipCardInner');
            inner.classList.remove('flipped');

            const frontImg = document.getElementById('flipCardFrontImg');
            frontImg.style.display = '';
            frontImg.src = card.immagine ? (_urlImmagineVisualizzabile(card.immagine, 300) || '') : '';
            if (!card.immagine) frontImg.style.display = 'none';

            // FASE 4: nome/condizione/variazione/prezzo ora sono mostrati
            // sopra la sleeve personalizzata (renderRetroCartaOwner sotto),
            // non più qui in testo semplice. Qui resta solo ciò che non
            // rientra nei 4 campi della sleeve (codice interno e location).
            // Restyle pg-* (2026-08-31): pg-riga con nome/codice/location,
            // pg-stat con prezzo/condizione — stesso pattern delle liste e
            // dei riquadri stat già usati in Match/Missioni/Dashboard.
            // Colore ereditato dallo scrim scuro dell'overlay (vedi CSS
            // .flip-card-back-overlay .pg-* in index.html) — non impostato
            // qui.
            document.getElementById('flipCardStats').innerHTML = `
                <div class="pg-testo">
                    <b>${escapeHtml(card.name || '')}</b>
                    <span><code style="background:none; color:inherit; padding:0;">${escapeHtml(card.code)}</code> · ${escapeHtml(card.location || '—')}</span>
                </div>
            `;
            const prezzoTesto = (card.price != null ? Number(card.price) : 0).toFixed(2) + ' €';
            document.getElementById('flipCardStatBoxes').innerHTML = `
                <div><b>${prezzoTesto}</b><span>Prezzo</span></div>
                <div><b>${card.cond ? escapeHtml(card.cond) : '—'}</b><span>Condizione</span></div>
            `;
            // La visibilità va SEMPRE riscritta, non solo nascosta: il modale
            // è unico e condiviso — senza questo ripristino, una singola
            // apertura dal libro lo lascerebbe nascosto per sempre anche a
            // tutti gli altri punti di ingresso.
            const btnVaiAlBinder = document.getElementById('flipCardBinderBtn');
            btnVaiAlBinder.style.display = opzioni.nascondiVaiAlBinder ? 'none' : '';
            btnVaiAlBinder.onclick = (e) => { e.stopPropagation(); vaiAllaCartaNelBinder(card.id); };
            renderRetroCartaOwner(card, opzioni.binderId || null);

            // "Gestisci doppione" (2026-08-30, pagina Doppioni): mostrato
            // SOLO quando aperto con opzioni.doppione=true — non auto-
            // rilevato da card.qty>1, per non far comparire questo
            // pulsante su Valore/Wishlist/Location se una carta lì ha per
            // caso più copie. Stesso pattern di flipCardBinderBtn sopra:
            // display e onclick riscritti ad ogni apertura, mai lasciati
            // da una apertura precedente.
            const btnDoppione = document.getElementById('flipCardGestisciDoppioneBtn');
            const sceltaDoppione = document.getElementById('flipCardDoppioneScelta');
            sceltaDoppione.style.display = 'none';
            sceltaDoppione.innerHTML = '';
            btnDoppione.style.display = opzioni.doppione ? '' : 'none';
            btnDoppione.onclick = (e) => { e.stopPropagation(); _mostraSceltaGestisciDoppione(card.id); };

            document.getElementById('immagineModal').style.display = 'flex';

            // Mostra prima il fronte, poi gira da sola dopo una breve pausa.
            if (_flipCardTimeout) clearTimeout(_flipCardTimeout);
            _flipCardTimeout = setTimeout(() => inner.classList.add('flipped'), 500);
        }


        // "Gestisci doppione" (2026-08-30) — le 2 scelte decise a suo tempo
        // per la missione #15 "Fai spazio" (B: sposta in Scambio, C: apri
        // scheda di modifica), mai costruite fino ad ora. C è reale
        // (apriModificaCarta esiste già in ui/cards.ui.js). B resta un
        // placeholder onesto: spostare le copie extra in Scambio richiede
        // capire come data/cards.repository.js gestisce lo split di una
        // carta in due righe (quantità tenuta vs quantità spostata) — file
        // mai letto in questa sessione, non inventato.
        function _mostraSceltaGestisciDoppione(cardId) {
            const btn = document.getElementById('flipCardGestisciDoppioneBtn');
            const scelta = document.getElementById('flipCardDoppioneScelta');
            btn.style.display = 'none';
            scelta.style.display = 'flex';
            // Restyle pg-* (2026-08-31): stessa classe pg-bottoni del resto
            // dell'overlay (già gestisce i colori per lo scrim scuro via
            // CSS in index.html) invece di btn-secondary generico.
            scelta.innerHTML = `
                <button onclick="event.stopPropagation(); _doppioneSpostaInScambio('${cardId}')"><i class="fa-solid fa-right-left"></i> Sposta in Scambio</button>
                <button onclick="event.stopPropagation(); _doppioneApriModifica('${cardId}')"><i class="fa-solid fa-pen"></i> Modifica carta</button>
            `;
        }

        // FASE 8 (2026-09-13), CORREZIONE BUG: prima di questo fix la
        // funzione scriveva ancora location='Scambio' — valore morto dalla
        // migration Fase 3 (sql/45b, 2026-09-12), che ha sostituito il
        // vecchio sistema location-based con Binder Scambio + quantita_
        // offerta. Il bottone restava cliccabile e creava copie orfane,
        // mai visibili nello Scambio vero (basato su binder_carte, non su
        // location). Ora riusa lo STESSO meccanismo del bottone "Offri in
        // Scambio" già presente in Visualizzazione (ui/binder.ui.js,
        // apriModaleQuantitaScambio → modale quantità → _applicaQuantita
        // Scambio) — nessuna duplicazione di riga, nessuno split di
        // quantità: la carta resta dov'è, si marca solo quante copie sono
        // offerte. Tutta la vecchia logica di split/duplicazione (mai più
        // necessaria con questo modello, e comunque rotta) è stata
        // rimossa insieme al bug.
        function _doppioneSpostaInScambio(cardId) {
            chiudiImmagineIngrandita();
            if (typeof apriModaleQuantitaScambio === 'function') apriModaleQuantitaScambio(cardId);
        }

        function _doppioneApriModifica(cardId) {
            // FIX (2026-09-01): il commento precedente sosteneva che
            // chiudiImmagineIngrandita() vivesse SOLO in ui/wishlist.ui.js
            // (pagina pubblica) e che qui sarebbe stata chiamata a vuoto.
            // In realtà esiste anche in ui/modals.ui.js, caricato da
            // index.html: la chiusura manuale lasciava lo scroll del body
            // bloccato e la classe fullscreen attaccata al modale, che la
            // successiva apertura in modalità immagine semplice ereditava
            // per un istante. Stessa correzione fatta in
            // _doppioneSpostaInScambio qui sopra.
            chiudiImmagineIngrandita();
            if (typeof apriModificaCarta === 'function') apriModificaCarta(cardId);
        }


        // Click sulla scena per girare la carta manualmente in qualunque momento.
        function toggleFlipCard() {
            document.getElementById('flipCardInner').classList.toggle('flipped');
        }


        // Multi-Binder (2026-08-25): riscritta. Prima calcolava _binderPagina
        // su TUTTA la collezione (tutte le location mescolate) e apriva la
        // sezione con un semplice switchTab, senza mai caricare i dati dei
        // binder — bug pre-esistente al libro sfogliabile, segnalato dalla
        // sessione Opus (§5.1 del riepilogo). Ora: apre davvero il binder a
        // cui la carta appartiene (priorità alla location, stessa logica già
        // scritta in ui/modals.ui.js per la sleeve — _binderDiAppartenenzaSeNoto
        // — riusata qui, non riscritta), e la pagina è calcolata SOLO sulle
        // carte di quel binder specifico.
        async function vaiAllaCartaNelBinder(cardId) {
            chiudiImmagineIngrandita();
            const card = carteReali.find(c => String(c.id) === String(cardId));
            if (!card) return;

            await apriDettaglioWidget('binder', null); // ui/phone.ui.js — apre la sezione E garantisce/carica _bindersElenco

            const idBinder = _binderDiAppartenenzaSeNoto(card); // ui/modals.ui.js
            if (!idBinder) return; // binder non determinabile: resta sulla griglia contenitori, meglio di niente

            await apriBinderDettaglio(idBinder); // ui/binder.ui.js — carica _carteBinderAttivoCache del binder giusto

            const layout = BINDER_LAYOUTS[_binderLayout] || BINDER_LAYOUTS['3x3'];
            const perPagina = layout.cols * layout.rows;
            const indice = _carteBinderAttivoCache.findIndex(c => String(c.id) === String(cardId));
            _binderPagina = indice >= 0 ? Math.floor(indice / perPagina) : 0;
            renderBinderContenuto();
        }
