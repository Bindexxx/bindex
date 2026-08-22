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


        // ── FLIP-MODAL — usato in TUTTO IL SITO da ogni click su una carta
        // (tabella, vista compatta mobile, Binder, Home "In primo piano"):
        // ESTENDE lo stesso modale già usato da apriImmagineIngrandita
        // (#immagineModal / stesso pulsante chiudi), come deciso da Claudio
        // per Home, ora esteso a tutti i punti di ingresso su richiesta di
        // Claudio (A15). Animazione: rotazione orizzontale (rotateY), 0.7s
        // — placeholder ragionevole, da aggiustare se Claudio preferisce
        // altro.

        function apriFlipCardHome(id) {
            const card = carteReali.find(c => String(c.id) === String(id));
            if (!card) return;

            document.getElementById('immagineErroreMsg').style.display = 'none';
            document.getElementById('immagineIngranditaImg').style.display = 'none';
            document.getElementById('flipCardScene').style.display = 'block';

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
            document.getElementById('flipCardStats').innerHTML = `
                <div style="font-size:0.78rem; opacity:0.9;"><code style="background:none; color:inherit; padding:0;">${card.code}</code> · ${card.location || '—'}</div>
            `;
            document.getElementById('flipCardBinderBtn').onclick = (e) => { e.stopPropagation(); vaiAllaCartaNelBinder(card.id); };
            renderRetroCartaOwner(card);

            document.getElementById('immagineModal').style.display = 'flex';

            // Mostra prima il fronte, poi gira da sola dopo una breve pausa.
            if (_flipCardTimeout) clearTimeout(_flipCardTimeout);
            _flipCardTimeout = setTimeout(() => inner.classList.add('flipped'), 500);
        }


        // Click sulla scena per girare la carta manualmente in qualunque momento.
        function toggleFlipCard() {
            document.getElementById('flipCardInner').classList.toggle('flipped');
        }


        // Calcola la pagina esatta del Binder dove si trova la carta (stesso
        // ordinamento automatico di renderBinder: tutte le carte di
        // collezione, comprese le Sealed, ordinate per data di inserimento)
        // e ci naviga direttamente.
        function vaiAllaCartaNelBinder(cardId) {
            chiudiImmagineIngrandita();
            const layout = BINDER_LAYOUTS[_binderLayout] || BINDER_LAYOUTS['3x3'];
            const perPagina = layout.cols * layout.rows;
            const carte = carteReali
                .filter(c => c.stato === 'collezione')
                .slice()
                .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
            const indice = carte.findIndex(c => String(c.id) === String(cardId));
            _binderPagina = indice >= 0 ? Math.floor(indice / perPagina) : 0;
            switchTab('binder', document.getElementById('mNav-binder'));
        }
