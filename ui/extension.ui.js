// ── ui/extension.ui.js ─────────────────────────────────────────────────
// Pannello integrazione con l'estensione Chrome: rilevamento versione,
// istruzioni installazione/aggiornamento/disinstallazione, apertura app
// dal sito verso l'estensione.


        // ── FOTO DETTAGLIO (angoli, pieghe...) — caricate dall'utente ─────────────

        // ── RICERCA UNICA SU TUTTO ─────────────────────────────────────────────────
        // Cerca in TUTTO carteReali (già unisce carte+wishlist), ignorando
        // la tab/filtri attivi al momento — a differenza della barra di
        // ricerca dentro Visualizzazione, che filtra solo quello che è già
        // visibile lì.
        // ═══════════════════════════════════════════════════════════════════
        // PANNELLO CARDSYNC — controllo estensione + accesso, tutto insieme
        // ═══════════════════════════════════════════════════════════════════

        // Il wizard di installazione/aggiornamento (statoIstruzioni, poco più
        // sotto) usa un comando PowerShell — funziona solo su Windows. Su
        // qualunque altro sistema quel percorso è semplicemente inapplicabile,
        // quindi lo saltiamo del tutto (vedi controlloIngressoCardsync).
        // navigator.userAgentData è il modo moderno e più affidabile (Chrome
        // 90+); se assente si ricade su navigator.platform/userAgent.
        function _piattaformaNonWindows() {
            if (navigator.userAgentData && navigator.userAgentData.platform) {
                return navigator.userAgentData.platform.toLowerCase() !== 'windows';
            }
            return !/win/i.test(navigator.platform || navigator.userAgent || '');
        }


        // Chiede la versione all'estensione (se installata) tramite
        // externally_connectable — se non risponde entro 1.2s, la
        // consideriamo assente (disinstallata, o non è Chrome/Chromium).
        function _chiediVersioneEstensione() {
            return new Promise((resolve) => {
                if (!window.chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
                    resolve(null);
                    return;
                }
                let risolto = false;
                const timeoutId = setTimeout(() => { if (!risolto) { risolto = true; resolve(null); } }, 1200);
                try {
                    chrome.runtime.sendMessage(ID_ESTENSIONE_CARDSYNC, { type: 'CARDSYNC_GET_VERSION' }, (risposta) => {
                        if (risolto) return;
                        risolto = true;
                        clearTimeout(timeoutId);
                        if (chrome.runtime.lastError || !risposta) { resolve(null); return; }
                        resolve(risposta.versione || null);
                    });
                } catch (_) {
                    if (!risolto) { risolto = true; clearTimeout(timeoutId); resolve(null); }
                }
            });
        }


        // ── "APRI L'APP" — manda la sessione già attiva qui all'estensione ──────
        // Un sito normale non può aprire da solo una pagina chrome-extension://
        // (bloccato dal browser per sicurezza) — per questo chiediamo
        // all'estensione stessa di aprirsi, passandole anche il token di
        // sessione Supabase già ottenuto qui: entra già autenticata con lo
        // stesso account, senza un secondo login separato. Vedi il listener
        // CARDSYNC_OPEN_APP in background.js (estensione).

        // I 16 temi dell'estensione sono scelti dal sito con solo 3 opzioni
        // (viola/verde/pokemon, vedi setSiteTheme) — mappiamo qui i nomi,
        // l'estensione non ha più un proprio selettore.
        function _temaEstensioneDaSito() {
            const temaSito = prefSiteThemeGet();
            if (temaSito === 'verde') return 'green';
            if (temaSito === 'pokemon') return 'pokemon';
            return 'purple';
        }


        function _mandaAperturaAppAEstensione() {
            return new Promise((resolve) => {
                if (!window.chrome || !chrome.runtime || !chrome.runtime.sendMessage) { resolve(false); return; }
                authGetSession().then((sessione) => {
                    const payload = {
                        type: 'CARDSYNC_OPEN_APP',
                        tema: _temaEstensioneDaSito(),
                        temaScuro: prefDarkModeGet(),
                    };
                    if (sessione) {
                        payload.access_token = sessione.access_token;
                        payload.refresh_token = sessione.refresh_token;
                    }
                    try {
                        chrome.runtime.sendMessage(ID_ESTENSIONE_CARDSYNC, payload, (risposta) => {
                            resolve(!chrome.runtime.lastError && !!risposta && risposta.ok === true);
                        });
                    } catch (_) { resolve(false); }
                });
            });
        }


        async function apriAppEstensione() {
            const btn = document.getElementById('btnApriApp');
            const testoOriginale = btn.innerHTML;
            btn.disabled = true;
            const ok = await _mandaAperturaAppAEstensione();
            if (!ok) {
                btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> <span class="app-launch-btn-text">Non risponde</span>';
                setTimeout(() => { btn.innerHTML = testoOriginale; btn.disabled = false; }, 2500);
                return;
            }
            btn.disabled = false;
        }


        function salvaPreferenzaApriSempreApp(attivo) {
            prefApriSempreAppSet(attivo);
        }


        // Chiede all'estensione lo stato attuale di "aiutaGruppo" (per-
        // dispositivo, chrome.storage.local — vedi CARDSYNC_GET_AIUTA_GRUPPO
        // in background.js). Stessa tolleranza di _chiediVersioneEstensione:
        // se l'estensione non risponde entro 1.2s, o non c'è proprio,
        // risolve a false invece di restare in attesa.
        function _chiediAiutaGruppoEstensione() {
            return new Promise((resolve) => {
                if (!window.chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
                    resolve(false);
                    return;
                }
                let risolto = false;
                const timeoutId = setTimeout(() => { if (!risolto) { risolto = true; resolve(false); } }, 1200);
                try {
                    chrome.runtime.sendMessage(ID_ESTENSIONE_CARDSYNC, { type: 'CARDSYNC_GET_AIUTA_GRUPPO' }, (risposta) => {
                        if (risolto) return;
                        risolto = true;
                        clearTimeout(timeoutId);
                        if (chrome.runtime.lastError || !risposta || !risposta.ok) { resolve(false); return; }
                        resolve(!!risposta.aiutaGruppo);
                    });
                } catch (_) {
                    if (!risolto) { risolto = true; clearTimeout(timeoutId); resolve(false); }
                }
            });
        }

        // Scrive la preferenza nell'estensione (CARDSYNC_SET_AIUTA_GRUPPO) —
        // stessa tolleranza delle altre chiamate verso l'estensione: se non
        // risponde non blocchiamo né avvisiamo l'utente con un errore, la
        // preferenza resta quella che era prima sul dispositivo.
        function salvaPreferenzaAiutaGruppoDispositivo(attivo) {
            if (!window.chrome || !chrome.runtime || !chrome.runtime.sendMessage) return;
            try {
                chrome.runtime.sendMessage(ID_ESTENSIONE_CARDSYNC, { type: 'CARDSYNC_SET_AIUTA_GRUPPO', valore: attivo }, () => {
                    void chrome.runtime.lastError;
                });
            } catch (_) { /* silenzioso */ }
        }


        // Mostra i controlli "Apri l'app" (sidebar) e "Apri sempre l'app" +
        // "Aiuta il gruppo da questo dispositivo" (Impostazioni) solo se
        // l'estensione è stata rilevata (installata e aggiornata — vedi
        // controlloIngressoCardsync). Se la preferenza locale "apri sempre"
        // è attiva, la apre subito senza bisogno di cliccare nulla.
        async function _aggiornaControlliApriApp() {
            const gruppo = document.getElementById('appLaunchGroup');
            const gruppoImpostazioni = document.getElementById('impostazioniEstensioneGroup');
            if (!_versioneVecchiaRilevata) {
                gruppo.style.display = 'none';
                gruppoImpostazioni.style.display = 'none';
                return;
            }
            gruppo.style.display = 'flex';
            gruppoImpostazioni.style.display = 'block';

            const apriSempre = prefApriSempreAppGet();
            document.getElementById('chkApriSempreApp').checked = apriSempre;
            if (apriSempre) _mandaAperturaAppAEstensione();

            document.getElementById('chkAiutaGruppoDispositivo').checked = await _chiediAiutaGruppoEstensione();
        }


        // Emoji diversa in base al tema attivo del sito — solo "atmosfera"
        // (fantasma per il viola, natura per il verde, acqua per l'azzurro),
        // MAI personaggi Pokémon veri e propri: sarebbe materiale protetto
        // da copyright, non qualcosa che generiamo qui.
        function _motivoEmojiTema() {
            if (document.body.classList.contains('theme-verde')) return '🌿';
            if (document.body.classList.contains('theme-pokemon')) return '💧';
            return '👻';
        }

        function _applicaMotiviTema() {
            const emoji = _motivoEmojiTema();
            ['motivoNonInstallata', 'motivoIstruzioni', 'motivoBossFiero'].forEach((id) => {
                const el = document.getElementById(id);
                if (el) el.textContent = emoji;
            });
        }


        function _mostraSoloStato(idStato) {
            ['statoNonInstallata', 'statoIstruzioni', 'statoBeccato', 'statoDisinstalla', 'statoBossFiero']
                .forEach((id) => { document.getElementById(id).style.display = id === idStato ? 'block' : 'none'; });
        }


        function _apriPannelloCardsync() {
            const panel = document.getElementById('cardsyncPanel');
            // Garanzia definitiva anti-annidamento: sempre direttamente sotto body.
            if (panel.parentElement !== document.body) document.body.appendChild(panel);
            panel.style.display = 'block';
            _applicaMotiviTema();
        }

        function nascondiPannelloCardsync() {
            document.getElementById('cardsyncPanel').style.display = 'none';
        }


        // Punto d'ingresso principale — chiamato all'avvio della pagina.
        // Controlla PRIMA l'estensione, poi (solo se è a posto) il login.
        async function controlloIngressoCardsync() {
            try {
                const [versioneInstallata, ultimaVersioneTesto] = await Promise.all([
                    _chiediVersioneEstensione(),
                    fetch('releases/latest-version.txt?t=' + Date.now(), { cache: 'no-store' }).then((r) => (r.ok ? r.text() : null)).catch(() => null),
                ]);
                const ultimaVersione = (ultimaVersioneTesto || '').trim();
                _ultimaVersioneRichiesta = ultimaVersione || null;
                _versioneVecchiaRilevata = !!versioneInstallata;

                const estensioneOk = !ultimaVersione || (versioneInstallata && !versioneMaggioreSito(ultimaVersione, versioneInstallata));

                if (!estensioneOk && _piattaformaNonWindows()) {
                    // Il wizard di installazione/aggiornamento è Windows-only
                    // (comando PowerShell) — su questo dispositivo non ha senso
                    // proporlo: messaggio dedicato, poi si passa dritti al login.
                    await _mostraStatoNonWindows();
                    return;
                }

                if (!estensioneOk) {
                    // Mostra pagina 1: scelta tra aggiornare / non installare / disinstallare.
                    // "Non installare" solo se non è mai stata rilevata (nessuna
                    // versione vecchia in giro); "disinstalla" solo se invece
                    // una versione (vecchia) risponde davvero.
                    document.getElementById('btnNonInstallare').style.display = versioneInstallata ? 'none' : 'flex';
                    document.getElementById('btnDisinstallare').style.display = versioneInstallata ? 'flex' : 'none';
                    document.getElementById('statoNonInstallataTitolo').textContent = versioneInstallata
                        ? 'La tua estensione non è aggiornata'
                        : "Non hai l'estensione installata";
                    document.getElementById('statoNonInstallataTesto').textContent = versioneInstallata
                        ? `Hai la versione ${versioneInstallata}, l'ultima è la ${ultimaVersione} — non è possibile usare versioni vecchie, sorry not sorry.`
                        : `Per usare CardSync Pro su questo PC serve l'estensione, versione ${ultimaVersione} o successiva.`;
                    _apriPannelloCardsync();
                    _mostraSoloStato('statoNonInstallata');
                    return;
                }

                // Estensione a posto — controlla il login. La conferma "il
                // boss è fiero di te" compare sempre, anche se già loggato —
                // cambia solo cosa c'è sotto: il form, o un solo bottone
                // "Continua come..." per chi deve solo confermare.
                await _mostraStatoLoginOControllo();
            } catch (_) { /* silenzioso: un controllo fallito non deve mai bloccare il sito */ }
        }


        // Estratta a parte perché richiamabile anche da "Non installarla"
        // (chi sceglie di non usare l'estensione su questo PC deve comunque
        // poter accedere al sito — prima questo passaggio veniva saltato
        // del tutto, bloccando di fatto il login per sempre in quel caso).
        //
        // mostraTestoEstensione=false: usato da chi ha scelto di NON
        // installare (o non può, es. dispositivo non Windows) — il testo
        // "hai l'estensione installata" sarebbe falso in quel caso.
        // nonWindows=true: usato quando il dispositivo non è Windows e il
        // wizard di installazione/aggiornamento (PowerShell) non è quindi
        // proponibile — messaggio dedicato invece del generico "Nessun
        // problema!" usato da chi sceglie volontariamente di non installare.
        async function _mostraStatoLoginOControllo(mostraTestoEstensione = true, nonWindows = false) {
            if (nonWindows) {
                document.getElementById('statoBossFieroTitolo').textContent = 'Niente Windows, nessun problema!';
                document.getElementById('statoBossFieroTesto').textContent =
                    'Ho notato che non hai Windows: al momento su questo dispositivo non puoi installare l\'estensione. Nessun problema — accedi comunque per usare il sito, ci penserà il PC di Bill a fare i calcoli per te.';
            } else {
                document.getElementById('statoBossFieroTitolo').textContent = mostraTestoEstensione ? 'Il boss è fiero di te!' : 'Nessun problema!';
                document.getElementById('statoBossFieroTesto').textContent = mostraTestoEstensione
                    ? 'Hai l\'estensione installata e aggiornata all\'ultima versione — valuta di attivare la funzione "Aiuta il gruppo" per far sì che non sia solo il PC di Bill a fare i calcoli per gli altri. In questo modo l\'app sarà più veloce per tutti noi. Bill ringrazia. 🙏'
                    : 'Puoi usare il sito tranquillamente anche senza l\'estensione su questo dispositivo — accedi per continuare.';
            }

            const sessione = await assicuraLoginSupabase();
            _apriPannelloCardsync();
            _mostraSoloStato('statoBossFiero');

            if (sessione) {
                document.getElementById('bossFieroLoginForm').style.display = 'none';
                document.getElementById('bossFieroGiaLoggato').style.display = 'block';
                document.getElementById('btnContinuaComeUtente').innerHTML =
                    `Continua come ${_nomeDaEmail(sessione.user.email)} <i class="fa-solid fa-arrow-right"></i>`;
            } else {
                document.getElementById('bossFieroGiaLoggato').style.display = 'none';
                document.getElementById('bossFieroLoginForm').style.display = 'block';
                authEmail.focus();
            }
        }


        function mostraIstruzioniInstallazione() {
            _mostraSoloStato('statoIstruzioni');
            _applicaMotiviTema();

            // Bivio: il sito sa già (dal controllo appena fatto) se è la
            // prima installazione o un semplice aggiornamento — mostra solo
            // le istruzioni rilevanti al caso specifico, invece di un
            // generico "solo la prima volta potrebbe...". Passiamo
            // l'informazione anche al comando stesso (parametro -Tipo),
            // così lo script non deve indovinare da solo se Chrome conosce
            // già questa cartella — glielo diciamo noi, con certezza.
            const tipoOperazione = _versioneVecchiaRilevata ? 'aggiornamento' : 'installazione';
            document.getElementById('comandoAggiornaEstensione').textContent =
                `irm https://bindexxx.github.io/bindex/releases/aggiorna_cardsync.bat -OutFile "$env:TEMP\\aggiorna_cardsync.bat"; & "$env:TEMP\\aggiorna_cardsync.bat" ${tipoOperazione}`;

            const elPasso3 = document.getElementById('statoIstruzioniPasso3');
            if (_versioneVecchiaRilevata) {
                // Chrome conosce già questa cartella (un'estensione ha
                // risposto) — nessun passo manuale in più da fare.
                elPasso3.innerHTML = 'Scarica, installa da solo e riapre Chrome (che aprirà anche la tab Prezzi dell\'estensione e questo sito, da solo). Chrome conosce già questa estensione — nessun altro passo da fare.';
            } else {
                elPasso3.innerHTML = 'Scarica, installa da solo e riapre Chrome (che aprirà anche la tab Prezzi dell\'estensione e questo sito, da solo). <strong>Poi, un ultimo passo a mano</strong> (Chrome lo richiede per sicurezza, non è automatizzabile): vai su <code>chrome://extensions</code>, attiva <strong>"Modalità sviluppatore"</strong> in alto a destra se non è già attiva, poi clicca <strong>"Carica estensione non pacchettizzata"</strong> e seleziona la cartella che lo script ti indicherà.';
            }
        }


        async function _ricontrollaEChiudiIstruzioni() {
            // FIX (anti-furbetti): prima proseguire bastava chiudere il
            // wizard senza aver davvero aggiornato — ora si ricontrolla per
            // davvero, e se non è passato ributta fuori l'avviso scherzoso.
            const versioneInstallata = await _chiediVersioneEstensione();
            if (!_ultimaVersioneRichiesta || (versioneInstallata && !versioneMaggioreSito(_ultimaVersioneRichiesta, versioneInstallata))) {
                controlloIngressoCardsync(); // tutto ok (o controllo non valido) — ricomincia da capo, ora passerà al login
                return;
            }
            _mostraSoloStato('statoBeccato');
        }


        async function _ricontrollaVersioneECambiaStato() {
            // Usato dopo le istruzioni di disinstallazione: ricontrolla tutto da capo.
            controlloIngressoCardsync();
        }


        async function _sceltaNonUsoEstensione() {
            await _mostraStatoLoginOControllo(false);
        }

        async function _mostraStatoNonWindows() {
            await _mostraStatoLoginOControllo(false, true);
        }

        function mostraIstruzioniDisinstallazione() {
            _mostraSoloStato('statoDisinstalla');
        }


        async function _continuaAlSito() {
            nascondiPannelloCardsync();
            await _avviaSitoDopoAccesso();
        }


        function _copiaChromeExtensions(el) {
            navigator.clipboard.writeText('chrome://extensions').then(() => {
                const originale = el.innerHTML;
                el.innerHTML = 'Copiato! <i class="fa-solid fa-check"></i>';
                setTimeout(() => { el.innerHTML = originale; }, 1500);
            });
        }


        function copiaComandoAggiorna() {
            const testo = document.getElementById('comandoAggiornaEstensione').textContent;
            navigator.clipboard.writeText(testo).then(() => {
                const btn = document.getElementById('btnCopiaComando');
                const originale = btn.innerHTML;
                btn.innerHTML = '<i class="fa-solid fa-check"></i>';
                setTimeout(() => { btn.innerHTML = originale; }, 1500);
            });
        }
