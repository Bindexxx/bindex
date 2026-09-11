// ── ui/navigation.ui.js ────────────────────────────────────────────────
// Navigazione principale: tab (switchTab), drawer/sidebar mobile e
// desktop, easter egg changelog.
//
// STEP separato dal piano "riduzione accoppiamento" concordato con Claudio
// il 2026-09-11. Ricerca globale, tema/dark-mode/animazioni e
// condivisione (link pubblico/QR) sono stati spostati in
// ui/navigation-ricerca.ui.js, ui/navigation-tema.ui.js,
// ui/navigation-condivisione.ui.js — NESSUNA riscrittura del codice
// esistente in nessuno dei quattro file: solo spostamento, zero cambi di
// comportamento.
//
// Chiamato cross-file da ui/navigation-ricerca.ui.js: closeDrawer(),
// switchTab() (dopo un risultato di ricerca). Nessuna istruzione qui gira
// a tempo di caricamento script — l'ordine tra i quattro file
// navigation-*.ui.js è indifferente.


        function handleChangelogClick() {
            changelogClicks++;
            if (changelogClicks >= 3) {
                document.getElementById('bulbasaurModal').style.display = 'flex';
                changelogClicks = 0;
            }
        }


        function closeBulbasaurModal() {
            document.getElementById('bulbasaurModal').style.display = 'none';
        }


        // ── SIDEBAR — apertura/chiusura su mobile (a scomparsa) ─────────────────
        // CONSEGNA 2: stessa funzione di prima (usata anche da switchTab per
        // richiudersi da sola dopo aver scelto una sezione), ora punta alla
        // sidebar unica invece del vecchio drawerPanel separato.
        function openDrawer() {
            document.getElementById('drawerOverlay').classList.add('open');
            document.getElementById('sidebar').classList.add('open');
        }


        function closeDrawer() {
            document.getElementById('drawerOverlay').classList.remove('open');
            document.getElementById('sidebar').classList.remove('open');
        }


        // ── SIDEBAR — comprimi/espandi (solo desktop) ───────────────────────────
        function _applicaStatoSidebarCompressa(compressa) {
            document.body.classList.toggle('sidebar-collapsed', compressa);
            const icona = document.getElementById('sidebarCollapseIcon');
            if (icona) icona.className = compressa ? 'fa-solid fa-angles-right' : 'fa-solid fa-angles-left';
        }

        function toggleSidebarCollapse() {
            const compressa = !document.body.classList.contains('sidebar-collapsed');
            _applicaStatoSidebarCompressa(compressa);
            prefSidebarCompressaSet(compressa);
        }
        _applicaStatoSidebarCompressa(prefSidebarCompressaGet());


        function switchTab(tabId, element) {
            currentMode = tabId;
            highlightedRowId = null;

            prefActiveTabSet(tabId);

            document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
            document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
            document.querySelectorAll('.drawer-item').forEach(item => item.classList.remove('active'));

            document.getElementById('visualizzazione').classList.add('active');
            
            if (element) element.classList.add('active');
            const mobileBtn = document.getElementById(`mNav-${tabId}`);
            if (mobileBtn) mobileBtn.classList.add('active');
            closeDrawer();

            // I tre toggle Carte/Sealed/Wishlist hanno senso solo nella vista
            // Visualizzazione (le altre tab sono già filtrate di loro).
            document.getElementById('rigaToggleTipo').style.display = tabId === 'visualizzazione' ? 'flex' : 'none';

            // Match automatico tra amici — solo dove ha senso (Scambio: cosa
            // vuoi tu che qualcun altro ha; Wishlist: cosa vuole qualcun
            // altro che hai tu).
            const pannelloMatch = document.getElementById('pannelloMatch');
            if (tabId === 'scambio' || tabId === 'wishlist') {
                pannelloMatch.style.display = 'block';
                caricaMatch(tabId);
            } else {
                pannelloMatch.style.display = 'none';
            }

            const qrBtn = document.getElementById('btnShowQrCode');
            const locFilter = document.getElementById('filterLocation');

            if (tabId === 'scambio') {
                qrBtn.style.display = 'inline-flex';
                locFilter.value = 'SCAMBIO';
                locFilter.disabled = true;
                document.getElementById('statLabelCount').innerText = 'In Scambio';
            } else if (tabId === 'wishlist') {
                // Ora esiste anche wishlist.html — riattiva il pulsante
                // Condividi, che punterà lì invece che a scambio.html (vedi
                // _linkPubblicoCondivisione più sotto). Il filtro location
                // resta non pertinente alla wishlist (che è una tabella a
                // parte, non un valore di location).
                qrBtn.style.display = 'inline-flex';
                locFilter.value = '';
                locFilter.disabled = true;
                document.getElementById('statLabelCount').innerText = 'In Wishlist';
            } else if (tabId === 'sealed') {
                // "Fotocopia" di Scambio: stessa tabella condivisa, stesso
                // link/QR pubblico (sealed.html) — filtrata su tipo='sealed'
                // invece che su location='SCAMBIO'. La location resta
                // filtrabile (i prodotti sealed hanno comunque una location
                // fisica), a differenza della wishlist.
                qrBtn.style.display = 'inline-flex';
                locFilter.value = '';
                locFilter.disabled = false;
                document.getElementById('statLabelCount').innerText = 'Sealed';
            } else {
                qrBtn.style.display = 'none';
                locFilter.value = '';
                locFilter.disabled = false;
                document.getElementById('statLabelCount').innerText = 'Carte Totali';
            }

            if (tabId === 'inserimento' || tabId === 'prezzi' || tabId === 'impostazioni' || tabId === 'binder' || tabId === 'home') {
                document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
                document.getElementById(tabId).classList.add('active');
                if (tabId === 'prezzi' && !_locationCaricate) caricaListaLocationCheckbox();
                if (tabId === 'inserimento' && !_locationComuneCaricata) caricaSelectLocationComune();
                if (tabId === 'inserimento') caricaCarteConProblemi();
                // Multi-Binder (2026-08-25): questa riga chiamava renderBinder(),
                // caricaBinderCoverStato(), caricaCardBackStato() — nomi della
                // versione a binder-singolo, non esistono più da quando il
                // sistema è diventato Multi-Binder. Causavano un ReferenceError
                // qui dentro switchTab() ad ogni apertura della tab 'binder' (e
                // quindi anche al login, se l'ultima tab attiva salvata era
                // 'binder') — bug segnalato da Claudio, mai notato prima perché
                // nessuno aveva ancora letto questo file per intero.
                // Il caricamento dati del Multi-Binder oggi passa SEMPRE da
                // apriWidgetBinders() (data/ui/binder.ui.js), chiamata da
                // ui/phone.ui.js:apriDettaglioWidget() subito DOPO switchTab —
                // non va richiamata anche qui, altrimenti si carica due volte
                // ad ogni apertura.
                if (tabId === 'binder') { /* caricamento dati gestito da apriDettaglioWidget() in ui/phone.ui.js */ }
                if (tabId === 'home') { caricaAvvisiHome(); caricaUltimaSincronizzazioneHome(); caricaAttivitaRecentiHome(); renderBinderInPrimoPianoHome(); }
            } else {
                filterTable();
            }
        }


