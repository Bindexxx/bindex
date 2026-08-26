// ── ui/navigation.ui.js ────────────────────────────────────────────────
// Navigazione generale: tab, drawer/sidebar mobile e desktop, dark mode,
// temi, riduci animazioni, condivisione (link pubblico, QR), ricerca
// globale, easter egg changelog.

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


        function apriRicercaGlobale() {
            closeDrawer(); // stesso pattern di switchTab(): su mobile il drawer si richiude dopo la scelta
            document.getElementById('ricercaGlobaleModal').style.display = 'flex';
            document.getElementById('ricercaGlobaleInput').value = '';
            document.getElementById('ricercaGlobaleRisultati').innerHTML = '<p style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding:1rem 0;">Scrivi per cercare tra tutte le tue carte.</p>';
            setTimeout(() => document.getElementById('ricercaGlobaleInput').focus(), 50);
        }


        function chiudiRicercaGlobale() {
            document.getElementById('ricercaGlobaleModal').style.display = 'none';
        }


        // Determina l'etichetta e il colore in base a dove vive la carta —
        // priorità: wishlist, poi sealed, poi scambio, altrimenti collezione.
        function _etichettaSezione(card) {
            if (card.tabella === 'wishlist') return { testo: 'Wishlist', bg: 'var(--bg-success)', colore: 'var(--success)' };
            if (card.tipo === 'sealed') return { testo: 'Sealed', bg: 'var(--primary-light)', colore: 'var(--primary)' };
            if (card.location === 'SCAMBIO') return { testo: 'Scambio', bg: 'var(--bg-accent, var(--primary-light))', colore: 'var(--primary)' };
            return { testo: 'Collezione', bg: 'var(--bg-color)', colore: 'var(--text-muted)' };
        }


        function eseguiRicercaGlobale(query) {
            const container = document.getElementById('ricercaGlobaleRisultati');
            const q = query.trim().toLowerCase();
            if (q.length < 2) {
                container.innerHTML = '<p style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding:1rem 0;">Scrivi almeno 2 caratteri.</p>';
                return;
            }

            const risultati = carteReali
                .filter(c => c.name.toLowerCase().includes(q) || (c.code || '').toLowerCase().includes(q))
                .slice(0, 40);

            if (risultati.length === 0) {
                container.innerHTML = '<p style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding:1rem 0;">Nessuna carta trovata.</p>';
                return;
            }

            container.innerHTML = risultati.map(c => {
                const et = _etichettaSezione(c);
                const idAttr = String(c.id).replace(/'/g, "\\'");
                return `
                    <div class="risultato-ricerca-globale" onclick="vaiARisultatoRicerca('${idAttr}', '${c.tabella}')">
                        <span class="risultato-ricerca-globale-nome">${escapeHtml(c.name)}${c.code ? ` <span style="color:var(--text-muted); font-weight:600;">(${c.code})</span>` : ''}</span>
                        <span class="risultato-ricerca-globale-pill" style="background-color:${et.bg}; color:${et.colore};">${et.testo}</span>
                    </div>
                `;
            }).join('');
        }


        // Chiude il modale, salta nella tab giusta, e evidenzia la riga.
        function vaiARisultatoRicerca(id, tabella) {
            chiudiRicercaGlobale();
            const card = carteReali.find(c => String(c.id) === String(id));
            if (!card) return;

            const et = _etichettaSezione(card);
            const tabDiDestinazione = tabella === 'wishlist' ? 'wishlist' : (et.testo === 'Sealed' ? 'sealed' : 'visualizzazione');
            // Assicura che i toggle Carte/Sealed/Wishlist in Visualizzazione
            // non nascondano il risultato appena trovato.
            if (tabDiDestinazione === 'visualizzazione') {
                _filtriTipo.carte = true; _filtriTipo.sealed = true;
                document.getElementById('toggleTipoCarte')?.classList.add('active');
                document.getElementById('toggleTipoSealed')?.classList.add('active');
            }

            const navBtn = document.querySelector(`nav .nav-item[onclick*="'${tabDiDestinazione}'"]`);
            switchTab(tabDiDestinazione, navBtn);

            setTimeout(() => {
                toggleRowHighlight(card.id);
                const riga = document.querySelector(`[data-id="${id}"]`)?.closest('tr, .riga-compatta');
                if (riga) riga.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 150);
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


        function toggleDarkMode(isDark) {
            prefDarkModeSet(isDark);
            if (isDark) {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }
        }


        // ── A14 — TOGGLE "RIDUCI ANIMAZIONI" + FEEDBACK VISIVO SUL PREZZO ───────
        // Preferenza per-dispositivo (localStorage, stesso pattern di
        // "Aiuta il gruppo" e del layout Binder), NON legata all'account:
        // ogni PC/telefono la sceglie per sé.
        function _animazioniRidotte() {
            return prefRiduciAnimazioniGet();
        }

        function toggleRiduciAnimazioni(ridotte) {
            prefRiduciAnimazioniSet(ridotte);
        }


        function setSiteTheme(themeName) {
            prefSiteThemeSet(themeName);
            document.body.classList.remove('theme-verde', 'theme-pokemon');
            // FIX (Colleziona/Carta singola sembravano "mai attivi"): questa
            // funzione girava document.querySelectorAll('.theme-btn') senza
            // restringere ai soli bottoni del selettore tema — ma la STESSA
            // classe CSS è riusata anche dai toggle di Inserimento
            // (Destinazione/Tipo Prodotto), che quindi perdevano "active" ad
            // ogni caricamento pagina (questa funzione gira sempre, per
            // applicare il tema salvato). Elenco esplicito dei 3 id invece
            // di un selettore generico che finiva per toccare bottoni non suoi.
            ['themeBtn-viola', 'themeBtn-verde', 'themeBtn-pokemon'].forEach(id => document.getElementById(id)?.classList.remove('active'));

            if (themeName === 'verde') {
                document.body.classList.add('theme-verde');
                document.getElementById('themeBtn-verde').classList.add('active');
            } else if (themeName === 'pokemon') {
                document.body.classList.add('theme-pokemon');
                document.getElementById('themeBtn-pokemon').classList.add('active');
            } else {
                document.getElementById('themeBtn-viola').classList.add('active');
            }
        }


        // Costruisce il link pubblico alla pagina condivisa giusta per la tab
        // attiva (scambio.html o wishlist.html), usando l'id utente come
        // riferimento. Entrambe le pagine sono pensate per chi NON ha e non
        // avrà mai un account CardSync Pro: nessun login richiesto — solo i
        // dati previsti dalla rispettiva RLS pubblica su Supabase.
        // Multi-Binder (2026-08-25): quando si condivide da dentro il
        // dettaglio di un binder, currentMode vale 'binder' (impostato da
        // switchTab) — non basta più a scegliere la pagina, serve sapere
        // QUALE binder è aperto. Wishlist e Scambio mappano alle pagine
        // pubbliche reali già esistenti (stesso link di sempre). Per
        // qualunque altro tipo (location diversa da SCAMBIO, extra) non
        // esiste ancora una pagina pubblica dedicata — leggi_binder_pubblico
        // oggi non è nemmeno leggibile per il tipo 'extra' — quindi si
        // ritorna null: i pulsanti di condivisione in ui/binder.ui.js
        // restano nascosti per quei binder, non generano un link rotto.
        function _paginaPubblicaBinderAttivo() {
            const binder = (typeof _bindersElenco !== 'undefined' && Array.isArray(_bindersElenco))
                ? _bindersElenco.find(b => String(b.id) === String(_binderAttivo))
                : null;
            if (!binder) return null;
            if (binder.tipo === 'wishlist') return 'wishlist.html';
            if (binder.tipo === 'location' && binder.location_valore === 'SCAMBIO') return 'scambio.html';
            return null; // nessuna pagina pubblica generica ancora — vedi commento sopra
        }

        async function _linkPubblicoCondivisione() {
            const sessione = await authGetSession();
            const userId = sessione?.user?.id;
            if (!userId) return null;
            let pagina;
            if (currentMode === 'binder') {
                pagina = _paginaPubblicaBinderAttivo();
                if (!pagina) return null; // binder senza pagina pubblica dedicata, vedi sopra
            } else {
                pagina = currentMode === 'wishlist' ? 'wishlist.html' : (currentMode === 'sealed' ? 'sealed.html' : 'scambio.html');
            }
            const url = new URL(pagina + '?u=' + encodeURIComponent(userId), window.location.href);
            // Chi apre il link vede lo stesso tema che hai scelto tu sul tuo
            // dispositivo — non c'è login per chi riceve il link, quindi
            // niente localStorage da leggere: il tema viaggia nell'URL.
            const temaSalvato = prefSiteThemeGet();
            if (temaSalvato) url.searchParams.set('tema', temaSalvato);
            if (prefDarkModeGet()) url.searchParams.set('scuro', '1');
            // A16: solo per la Wishlist, passa anche il nome del proprietario
            // (riusa _nomeDaEmail già esistente) — serve a personalizzare il
            // testo di "Copia riepilogo" su wishlist.html ("Carte che potrei
            // procurare a [Nome]"), senza nessuna nuova chiamata a Supabase
            // né esporre l'email completa, solo un nome leggibile.
            if (pagina === 'wishlist.html' && sessione?.user?.email) {
                url.searchParams.set('nome', _nomeDaEmail(sessione.user.email));
            }
            return url.href;
        }


        async function copyShareLink() {
            const link = await _linkPubblicoCondivisione();
            if (!link) { alert('Devi essere loggato per generare il link.'); return; }
            try {
                await navigator.clipboard.writeText(link);
                alert('Link copiato negli appunti!');
            } catch (e) {
                prompt('Copia questo link:', link);
            }
        }


        async function openQrModal() {
            const link = await _linkPubblicoCondivisione();
            if (!link) { alert('Devi essere loggato per generare il QR.'); return; }
            const modal = document.getElementById('qrModal');
            const container = document.getElementById('qrcodeContainer');
            container.innerHTML = '';
            new QRCode(container, {
                text: link,
                width: 180,
                height: 180,
                colorDark : "#2a2438",
                colorLight : "#ffffff"
            });
            // A16: il pulsante di condivisione nativa (foglio di condivisione
            // del telefono) compare solo dove il browser lo supporta
            // davvero (navigator.share) — niente pulsante rotto altrove.
            document.getElementById('btnCondividiNativo').style.display = navigator.share ? 'flex' : 'none';
            modal.style.display = 'flex';
        }


        function closeQrModal() {
            document.getElementById('qrModal').style.display = 'none';
        }


        // A16: apre la pagina pubblica reale (con i dati veri di quel
        // proprietario) in una nuova scheda — scelta di Claudio al posto di
        // una mini-anteprima dentro il modale, più semplice e affidabile.
        async function apriAnteprimaLinkCondiviso() {
            const link = await _linkPubblicoCondivisione();
            if (!link) { alert('Devi essere loggato per generare l\'anteprima.'); return; }
            window.open(link, '_blank');
        }


        // A16: foglio di condivisione nativo del sistema (WhatsApp/Messaggi/
        // Email a scelta dell'utente) — IN AGGIUNTA a "Copia Link", non al
        // posto. Bottone visibile solo dove il browser lo supporta.
        async function condividiLinkNativo() {
            const link = await _linkPubblicoCondivisione();
            if (!link) { alert('Devi essere loggato per condividere il link.'); return; }
            try {
                await navigator.share({ title: 'CardSync Pro', url: link });
            } catch (e) {
                // L'utente ha annullato la condivisione, o il browser l'ha
                // bloccata — nessun errore da mostrare, è un'azione normale.
            }
        }
