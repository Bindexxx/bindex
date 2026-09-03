// ── ui/home.ui.js ──────────────────────────────────────────────────────
// Dashboard Home: statistiche, avvisi ("cosa richiede la tua attenzione"),
// ultima sincronizzazione, attività recenti, binder in primo piano.


        // ── A10 (Dashboard/Home) — stat-card duplicate, secondo pezzo ───────────
        // Stesso identico calcolo di stat-count/stat-value in Visualizzazione
        // (qty totale e prezzo*qty sommato), ma SEMPRE sulla collezione intera
        // (stato 'collezione', quindi carte + sealed, esclusa la Wishlist) —
        // a differenza delle stat in Visualizzazione, qui il numero non deve
        // cambiare se l'utente ha un filtro/ricerca attivi in un'altra tab.
        function aggiornaStatCardHome() {
            const collezione = carteReali.filter(c => c.stato === 'collezione');
            const totalQty = collezione.reduce((somma, c) => somma + (c.qty || 0), 0);
            const totalSum = collezione.reduce((somma, c) => somma + (c.price || 0) * (c.qty || 0), 0);
            const elCount = document.getElementById('stat-count-home');
            const elValue = document.getElementById('stat-value-home');
            if (elCount) elCount.innerText = totalQty;
            if (elValue) elValue.innerText = `€ ${totalSum.toFixed(2)}`;
        }


        // ── A10 (Dashboard/Home) — "Cosa richiede la tua attenzione", terzo
        // pezzo: prima voce, "prezzi da aggiornare". Le prossime (coda con
        // errori, wishlist sotto target, "Ciao Bill!") si aggiungeranno negli
        // stessi contenitori nei prossimi passaggi, uno alla volta.
        //
        // Soglia: 7 giorni dall'ultimo controllo prezzo registrato in
        // storico_prezzi. Le carte MAI controllate (nessuna riga in
        // storico_prezzi) contano come "da aggiornare". Solo collezione
        // (carte + sealed), esclusa la Wishlist — coerente con le altre
        // stat della Dashboard.
        //
        // storico_prezzi non ha filtro owner_id esplicito nelle query già
        // esistenti nel sito (vedi apriGraficoPrezzo più sotto): qui
        // restiamo comunque scoperti da qualunque dettaglio di RLS non
        // verificato, perché filtriamo esplicitamente sui SOLI id della
        // propria collezione già caricata (idsCollezione), non su tutta la
        // tabella.

        async function _ultimoControlloPerCarta(idsCollezione) {
            if (idsCollezione.length === 0) return {};
            const DIMENSIONE_BLOCCO = 500; // stesso spirito di _selectTuttePagine: eviterela URL troppo lunghe con collezioni grandi
            const blocchi = [];
            for (let i = 0; i < idsCollezione.length; i += DIMENSIONE_BLOCCO) {
                blocchi.push(idsCollezione.slice(i, i + DIMENSIONE_BLOCCO));
            }

            const risultati = await Promise.all(blocchi.map(blocco =>
                storicoPrezziQuery('carte', blocco)
            ));

            const ultimoPerCarta = {};
            risultati.forEach(({ data, error }) => {
                if (error) { console.error('Errore lettura storico_prezzi:', error.message); return; }
                (data || []).forEach(r => {
                    // Grazie all'ordinamento decrescente, la prima riga vista
                    // per ogni carta_id è già la più recente.
                    if (!ultimoPerCarta[r.carta_id]) ultimoPerCarta[r.carta_id] = r.registrato_il;
                });
            });
            return ultimoPerCarta;
        }


        // ── A10 (Dashboard/Home) — seconda voce avvisi: coda con errori ─────────
        // Stesso identico filtro già usato da caricaCarteConProblemi() (righe
        // di coda_carte finite in stato 'errore' per l'utente corrente), ma
        // qui serve solo il CONTEGGIO per la Dashboard — query separata e
        // leggera (head:true, nessun dato scaricato), per non toccare né
        // rallentare la funzione esistente che gestisce il pannello di
        // correzione in Inserimento.
        // FIX (sessione dedicata "correzione manuale per-utente"): le righe
        // che il worker autonomo dell'estensione non riesce a risolvere dopo
        // 3 tentativi vengono spostate da 'coda_carte' a
        // 'correzioni_manuali_carte' (RPC sposta_riga_in_correzione_manuale)
        // invece di restare in coda_carte con stato='errore' — la coda di
        // lavoro resta così sempre "pulita" (solo righe vive). Il conteggio
        // qui passa quindi alla nuova tabella; owner_id la scopa comunque
        // solo al vero proprietario, stesso identico filtro di prima.
        async function _contaCodaErrori() {
            const userId = await authGetUserId();
            if (!userId) return 0;

            const { count, error } = await correzioniManualiConta(userId);

            if (error) { console.error('Errore conteggio coda con errori:', error.message); return 0; }
            return count || 0;
        }


        // ── A10 (Dashboard/Home) — quarta voce avvisi: "Ciao Bill!" ─────────────
        // Solo presenza/assenza, MAI un conteggio (scelta esplicita di
        // Claudio per privacy). Stesso identico pattern già usato
        // dall'estensione in coda_pendente.js (scheda "Controllo prezzi",
        // "Dispositivi al lavoro"): carte con claimed_by valorizzato di
        // recente = qualcuno del gruppo sta calcolando prezzi ADESSO.
        //
        // RISOLTO (Problema #1, parte SELECT): prima leggeva direttamente
        // 'carte' con la policy larga "collezione condivisa per controllo
        // prezzi gruppo", che espone TUTTE le colonne di TUTTI gli owner —
        // qui bastava sapere se esiste almeno una riga prenotata, non serve
        // vedere note/prezzo/location di nessuno. Ora passa dalla RPC
        // leggi_stato_claim_gruppo (SECURITY DEFINER), che restituisce SOLO
        // le colonne di coordinamento (id/dispositivo/claimed_by/claimed_at)
        // e applica lei stessa la soglia di 10 minuti — non serve più
        // calcolarla qui lato client.

        async function _dispositiviAttiviOra() {
            const { data, error } = await claimGruppoStato(SOGLIA_MINUTI_CLAIM_PREZZI);

            if (error) { console.error('Errore lettura dispositivi attivi:', error.message); return false; }
            return (data || []).length > 0;
        }



        async function caricaAvvisiHome() {
            const collezione = carteReali.filter(c => c.stato === 'collezione');
            const idsCollezione = collezione.map(c => c.id);

            const [ultimoPerCarta, codaErrori, qualcunoAlLavoro] = await Promise.all([
                _ultimoControlloPerCarta(idsCollezione),
                _contaCodaErrori(),
                _dispositiviAttiviOra(),
            ]);

            const sogliaMs = SOGLIA_GIORNI_PREZZO_SCADUTO * 24 * 60 * 60 * 1000;
            const adesso = Date.now();
            const carteDaAggiornare = collezione.filter(c => {
                const ultimo = ultimoPerCarta[c.id];
                if (!ultimo) return true; // mai controllata
                return (adesso - new Date(ultimo).getTime()) > sogliaMs;
            });

            // Salvato a parte (non solo il conteggio) per il pannello di
            // dettaglio cliccabile — vedi apriModalePrezziScaduti().
            _elencoPrezziScaduti = carteDaAggiornare.map(c => ({
                name: c.name,
                code: c.code,
                ultimoTesto: ultimoPerCarta[c.id]
                    ? new Date(ultimoPerCarta[c.id]).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    : 'mai controllata',
            }));

            // Stessa identica condizione già usata per il badge "🎯
            // obiettivo!" nella tabella Wishlist (vedi renderViewTable) —
            // nessuna query nuova, carteReali è già caricato.
            const wishlistSottoTarget = carteReali.filter(c =>
                c.tabella === 'wishlist' && c.prezzoObiettivo != null && c.price > 0 && c.price <= c.prezzoObiettivo
            );

            _renderAvvisiHome({ prezziScaduti: carteDaAggiornare.length, codaErrori, wishlistSottoTarget: wishlistSottoTarget.length, qualcunoAlLavoro });
        }


        // Punto unico di rendering per tutti gli avvisi Home.
        function _renderAvvisiHome({ prezziScaduti, codaErrori, wishlistSottoTarget, qualcunoAlLavoro }) {
            const contenitore = document.getElementById('avvisiHomeLista');
            if (!contenitore) return;

            const voci = [];
            if (codaErrori > 0) {
                voci.push(`
                    <div style="display:flex; align-items:center; gap:0.7rem; padding:0.7rem 0; border-bottom:1px solid var(--border-color);">
                        <i class="fa-solid fa-circle-exclamation" style="color:var(--danger); font-size:1.1rem;"></i>
                        <span style="font-size:0.88rem;"><strong>${codaErrori}</strong> cart${codaErrori === 1 ? 'a' : 'e'} in coda ${codaErrori === 1 ? 'ha' : 'hanno'} dato errore durante l'inserimento — vai su Inserimento per correggerl${codaErrori === 1 ? 'a' : 'e'}</span>
                    </div>`);
            }
            if (wishlistSottoTarget > 0) {
                voci.push(`
                    <div style="display:flex; align-items:center; gap:0.7rem; padding:0.7rem 0; border-bottom:1px solid var(--border-color);">
                        <i class="fa-solid fa-bullseye" style="color:var(--success); font-size:1.1rem;"></i>
                        <span style="font-size:0.88rem;"><strong>${wishlistSottoTarget}</strong> cart${wishlistSottoTarget === 1 ? 'a' : 'e'} in wishlist ${wishlistSottoTarget === 1 ? 'è scesa' : 'sono scese'} sotto il prezzo obiettivo 🎯</span>
                    </div>`);
            }
            if (prezziScaduti > 0) {
                voci.push(`
                    <div style="display:flex; align-items:center; gap:0.7rem; padding:0.7rem 0; border-bottom:1px solid var(--border-color); cursor:pointer;" onclick="apriModalePrezziScaduti()" title="Clicca per vedere l'elenco">
                        <i class="fa-solid fa-clock-rotate-left" style="color:var(--danger); font-size:1.1rem;"></i>
                        <span style="font-size:0.88rem;"><strong>${prezziScaduti}</strong> cart${prezziScaduti === 1 ? 'a ha' : 'e hanno'} il prezzo da aggiornare (mai controllat${prezziScaduti === 1 ? 'a' : 'e'} o scadut${prezziScaduti === 1 ? 'o' : 'i'} da più di ${SOGLIA_GIORNI_PREZZO_SCADUTO} giorni)</span>
                        <i class="fa-solid fa-chevron-right" style="margin-left:auto; color:var(--text-muted); font-size:0.75rem;"></i>
                    </div>`);
            }
            if (qualcunoAlLavoro) {
                voci.push(`
                    <div style="display:flex; align-items:center; gap:0.7rem; padding:0.7rem 0; border-bottom:1px solid var(--border-color);">
                        <i class="fa-solid fa-desktop" style="color:var(--primary); font-size:1.1rem;"></i>
                        <span style="font-size:0.88rem;">👋 Ciao Bill! Un dispositivo del gruppo sta facendo i calcoli in questo momento.</span>
                    </div>`);
            }

            const sezione = document.getElementById('sezioneAvvisiHome');
            if (voci.length === 0) {
                sezione.style.display = 'none';
                return;
            }
            sezione.style.display = '';
            contenitore.innerHTML = voci.join('');
        }


        // ── A10 (Dashboard/Home) — "Attività recenti" ────────────────────────────
        // Due liste da 5 elementi ciascuna: ultime carte aggiunte (per
        // created_at, dato già letto da caricaCarteReali) e ultimi prezzi
        // aggiornati (per registrato_il da storico_prezzi, filtrato sui soli
        // id della propria collezione come già fatto per _ultimoControlloPerCarta).
        // "Sposta location" ESCLUSO su richiesta di Claudio (non tracciato
        // da nessuna parte). Variazione valore totale: placeholder testuale,
        // in attesa di uno storico vero del valore (decisione confermata).
        // A15 (dopo test su dispositivo): rende collassabili i due pannelli
        // "Attività recenti" di Home, per ridurre lo scroll su schermi
        // stretti — funziona anche su desktop, nessuna logica di dati
        // toccata, solo mostra/nasconde il contenuto già caricato.
        function toggleAttivitaRecentiHome(headerEl) {
            headerEl.closest('.home-activity-panel').classList.toggle('collassato');
        }



        async function _ultimiPrezziAggiornati(idsCollezione, limite) {
            if (idsCollezione.length === 0) return [];
            const DIMENSIONE_BLOCCO = 500;
            const blocchi = [];
            for (let i = 0; i < idsCollezione.length; i += DIMENSIONE_BLOCCO) {
                blocchi.push(idsCollezione.slice(i, i + DIMENSIONE_BLOCCO));
            }

            const risultati = await Promise.all(blocchi.map(blocco =>
                storicoPrezziQuery('carte', blocco, { limite })
            ));

            let tutte = [];
            risultati.forEach(({ data, error }) => {
                if (error) { console.error('Errore lettura ultimi prezzi aggiornati:', error.message); return; }
                tutte = tutte.concat(data || []);
            });

            return tutte
                .sort((a, b) => new Date(b.registrato_il) - new Date(a.registrato_il))
                .slice(0, limite);
        }


        async function caricaAttivitaRecentiHome() {
            const elAggiunte = document.getElementById('attivitaCarteAggiunteHome');
            const elPrezzi = document.getElementById('attivitaPrezziAggiornatiHome');
            if (!elAggiunte || !elPrezzi) return;

            const collezione = carteReali.filter(c => c.stato === 'collezione');
            const idsCollezione = collezione.map(c => c.id);

            const ultimeAggiunte = collezione
                .slice()
                .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
                .slice(0, NUMERO_ATTIVITA_RECENTI);

            elAggiunte.innerHTML = ultimeAggiunte.length === 0
                ? '<p style="text-align:center; color:var(--text-muted); font-size:0.8rem; padding:0.5rem 0;">Nessuna carta ancora.</p>'
                : ultimeAggiunte.map(c => `
                    <div class="home-activity-row" style="display:flex; justify-content:space-between; align-items:center; padding:0.4rem 0; border-bottom:1px solid var(--border-color); font-size:0.82rem;">
                        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(c.name)}</span>
                        <span style="color:var(--text-muted); font-size:0.72rem; flex-shrink:0; margin-left:0.5rem;">${c.createdAt ? new Date(c.createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) : '—'}</span>
                    </div>`).join('');

            const ultimiPrezzi = await _ultimiPrezziAggiornati(idsCollezione, NUMERO_ATTIVITA_RECENTI);
            const righePrezzi = ultimiPrezzi
                .map(r => ({ evento: r, card: collezione.find(c => String(c.id) === String(r.carta_id)) }))
                .filter(x => x.card); // la carta potrebbe essere stata eliminata nel frattempo

            elPrezzi.innerHTML = righePrezzi.length === 0
                ? '<p style="text-align:center; color:var(--text-muted); font-size:0.8rem; padding:0.5rem 0;">Nessun controllo prezzi ancora.</p>'
                : righePrezzi.map(({ evento, card }) => `
                    <div class="home-activity-row" style="display:flex; justify-content:space-between; align-items:center; padding:0.4rem 0; border-bottom:1px solid var(--border-color); font-size:0.82rem;">
                        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(card.name)} <span style="color:var(--text-muted);">${escapeHtml(card.variation)}</span></span>
                        <span style="color:var(--text-muted); font-size:0.72rem; flex-shrink:0; margin-left:0.5rem;">${new Date(evento.registrato_il).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}</span>
                    </div>`).join('');
        }


        // ── A10 (Dashboard/Home) — "Binder in primo piano", ultimo pezzo ────────
        // Tre categorie di 3 carte: valore più alto, maggiore oscillazione
        // positiva, maggiore oscillazione negativa. SOLO collezione, ESCLUSE
        // le Sealed (avranno le loro tre categorie a parte più avanti —
        // decisione confermata da Claudio). Click su una carta → flip-modal
        // a schermo intero (vedi apriFlipCardHome più sotto), non apre
        // nessuna tab.
        function renderBinderInPrimoPianoHome() {
            const container = document.getElementById('binderInPrimoPianoHome');
            if (!container) return;

            const carteSingole = carteReali.filter(c => c.stato === 'collezione' && c.tipo !== 'sealed');

            const perValore = carteSingole.slice().sort((a, b) => b.price - a.price).slice(0, 3);
            const conVariazione = carteSingole.filter(c => c.variazioneNumerica != null);
            const perOscillazionePositiva = conVariazione.filter(c => c.variazioneNumerica > 0).sort((a, b) => b.variazioneNumerica - a.variazioneNumerica).slice(0, 3);
            const perOscillazioneNegativa = conVariazione.filter(c => c.variazioneNumerica < 0).sort((a, b) => a.variazioneNumerica - b.variazioneNumerica).slice(0, 3);

            const renderMiniatura = (c) => `
                <div class="home-featured-thumb" onclick="apriFlipCardHome('${String(c.id).replace(/'/g, "\\'")}')" title="${(c.name || '').replace(/"/g, '&quot;')} — clicca per i dettagli" style="cursor:pointer; width:64px; flex-shrink:0;">
                    <div class="home-featured-thumb-box" style="width:64px; height:90px; border-radius:8px; overflow:hidden; background:var(--bg-color); display:flex; align-items:center; justify-content:center; border:1px solid var(--border-color);">
                        ${c.immagine ? `<img src="${_urlImmagineVisualizzabile(c.immagine, 128)}" alt="" style="width:100%; height:100%; object-fit:cover;" onerror="this.remove();">` : `<i class="fa-solid fa-image" style="color:var(--text-muted);"></i>`}
                    </div>
                </div>`;

            const renderGruppo = (titolo, icona, colore, carte) => `
                <div class="home-featured-group">
                    <div class="home-featured-title" style="font-size:0.78rem; font-weight:700; color:var(--text-muted); margin-bottom:0.5rem;"><i class="fa-solid ${icona}" style="color:${colore};"></i> ${titolo}</div>
                    ${carte.length === 0
                        ? '<p style="font-size:0.75rem; color:var(--text-muted);">— nessun dato ancora</p>'
                        : `<div class="home-featured-row" style="display:flex; gap:0.5rem;">${carte.map(renderMiniatura).join('')}</div>`}
                </div>`;

            container.innerHTML = `
                <div class="home-featured-grid" style="display:grid; grid-template-columns: repeat(3, 1fr); gap:1rem;">
                    ${renderGruppo('Valore più alto', 'fa-crown', '#d4a017', perValore)}
                    ${renderGruppo('Oscillazione +', 'fa-arrow-trend-up', 'var(--success)', perOscillazionePositiva)}
                    ${renderGruppo('Oscillazione -', 'fa-arrow-trend-down', 'var(--danger)', perOscillazioneNegativa)}
                </div>`;
        }


        // ── FLIP-MODAL — chiamata direttamente da Home "In primo piano" (vedi
        // riga sopra) e da Binder (ui/binder-flipbook.ui.js, _libroClickCarta).
        // CORREZIONE (26/08/2026, segnalato da Opus nel compilato, mai
        // sistemato prima d'ora): il commento precedente diceva "usata da
        // ogni click su una carta in tutto il sito (tabella, vista compatta
        // mobile, Binder, Home)" — non verificato per tabella/vista compatta
        // mobile (vivono in ui/cards.ui.js, non letto in questa sessione):
        // probabilmente passano invece da apriImmagineIngrandita(), il
        // modale più semplice esteso qui sotto, non da questa funzione
        // direttamente. Non dare per buona l'affermazione originale senza
        // aver letto cards.ui.js.
        // ESTENDE lo stesso modale già usato da apriImmagineIngrandita
        // (#immagineModal / stesso pulsante chiudi), come deciso da Claudio
        // per Home, ora esteso a tutti i punti di ingresso su richiesta di
        // Claudio (A15). Animazione: rotazione orizzontale (rotateY), 0.7s
        // — placeholder ragionevole, da aggiustare se Claudio preferisce
        // altro.

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

        // "Sposta in Scambio" (2026-08-30, missione #15 "Fai spazio").
        // Spostamento COMPLETO: semplice update di 'location'. Spostamento
        // PARZIALE (tieni N, sposta il resto): legge la riga grezza per
        // intero via cardsSelectById() (data/cards.repository.js — tutte
        // le colonne reali, non gli alias JS di carteReali, per non
        // rischiare di perdere reverse_holo/first_ed/url/dispositivo mai
        // mappati lato JS), la duplica con qty/location nuovi, azzera
        // claimed_by/claimed_at sulla NUOVA riga (non ancora reclamata da
        // nessuno — quelli della riga originale non si toccano), riduce la
        // quantità della riga originale.
        async function _doppioneSpostaInScambio(cardId) {
            const card = carteReali.find(c => String(c.id) === String(cardId));
            if (!card) return;
            const qty = Number(card.qty) || 1;

            if (card.location === 'Scambio') {
                alert('Questa carta è già in Scambio.');
                return;
            }
            if (qty <= 1) {
                alert('Questa carta non ha copie extra — spostarla tutta in Scambio non lascerebbe nessuna copia nella location attuale. Usa "Modifica carta" per farlo comunque, se è quello che vuoi.');
                return;
            }

            const input = prompt(`Quante copie vuoi spostare in Scambio? La carta ne ha ${qty} in totale.`, String(qty - 1));
            if (input === null) return;
            const mossa = parseInt(input, 10);
            if (!Number.isInteger(mossa) || mossa < 1 || mossa > qty) {
                alert('Numero non valido.');
                return;
            }

            if (mossa === qty) {
                // Tutte le copie: nessuno split, solo location aggiornata.
                const { error } = await cardsUpdateCampo('carte', cardId, 'location', 'Scambio');
                if (error) { alert('Errore nello spostamento: ' + error.message); return; }
            } else {
                // Parziale: duplica la riga grezza, riduce l'originale.
                const { data: riga, error: errSelect } = await cardsSelectById(cardId);
                if (errSelect || !riga) { alert('Errore nella lettura della carta: ' + (errSelect ? errSelect.message : 'non trovata')); return; }

                const nuovaRiga = { ...riga };
                delete nuovaRiga.id;          // nuova riga, nuovo id generato dal DB
                delete nuovaRiga.created_at;  // e nuove date, non quelle della riga originale
                delete nuovaRiga.updated_at;
                nuovaRiga.qty = mossa;
                nuovaRiga.location = 'Scambio';
                nuovaRiga.claimed_by = null;  // non ancora reclamata da nessuno
                nuovaRiga.claimed_at = null;

                const { error: errIns } = await cardsInsertNellaCollezione(nuovaRiga);
                if (errIns) { alert('Errore nella creazione della copia in Scambio: ' + errIns.message); return; }

                const { error: errUpd } = await cardsUpdateCampo('carte', cardId, 'qty', qty - mossa);
                if (errUpd) { alert('La copia è stata creata in Scambio, ma la quantità originale non si è aggiornata: ' + errUpd.message + '. Correggi manualmente da "Modifica carta".'); }
            }

            // FIX (2026-09-01): il commento precedente diceva che
            // chiudiImmagineIngrandita() "non esiste lato privato" e chiudeva
            // il modale a mano. Non era vero: la funzione è definita in
            // ui/modals.ui.js, regolarmente caricato da index.html. La
            // chiusura manuale saltava tre reset che solo quella funzione fa
            // (nascondere #flipCardScene, togliere la classe fullscreen da
            // #immagineModalContent e sbloccare lo scroll del body), quindi
            // dopo questa azione la pagina restava con lo scroll bloccato.
            chiudiImmagineIngrandita();

            await caricaCarteReali(); // ricarica carteReali con la modifica
            if (typeof renderPaginaDoppioni === 'function') renderPaginaDoppioni();
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
