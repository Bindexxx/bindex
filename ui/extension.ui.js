// Collegamento con l'estensione: versione, istruzioni, apertura dell'app, tema.

function _piattaformaNonWindows() {
            if (navigator.userAgentData && navigator.userAgentData.platform) {
                return navigator.userAgentData.platform.toLowerCase() !== 'windows';
            }
            return !/win/i.test(navigator.platform || navigator.userAgent || '');
        }

        const TIMEOUT_RISPOSTA_ESTENSIONE_MS = 5000;
        function _chiediVersioneEstensione() {
            return new Promise((resolve) => {
                if (!window.chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
                    resolve(null);
                    return;
                }
                let risolto = false;
                const timeoutId = setTimeout(() => { if (!risolto) { risolto = true; resolve(null); } }, TIMEOUT_RISPOSTA_ESTENSIONE_MS);
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

        function _temaEstensioneDaSito() {
            const temaSito = prefSiteThemeGet();
            if (temaSito === 'verde') return 'green';
            if (temaSito === 'pokemon') return 'pokemon';
            return 'purple';
        }

        function mandaTemaScuroAEstensione(isDark) {
            if (!window.chrome || !chrome.runtime || !chrome.runtime.sendMessage) return;
            try {
                chrome.runtime.sendMessage(ID_ESTENSIONE_CARDSYNC, { type: 'CARDSYNC_SET_TEMA', temaScuro: !!isDark }, () => { void chrome.runtime.lastError; });
            } catch (_) {   }
        }

        function _mandaAperturaAppAEstensione() {
            return new Promise((resolve) => {
                if (!window.chrome || !chrome.runtime || !chrome.runtime.sendMessage) { resolve(false); return; }
                const payload = {
                    type: 'CARDSYNC_OPEN_APP',
                    tema: _temaEstensioneDaSito(),
                    temaScuro: prefDarkModeGet(),
                };
                try {
                    chrome.runtime.sendMessage(ID_ESTENSIONE_CARDSYNC, payload, (risposta) => {
                        resolve(!chrome.runtime.lastError && !!risposta && risposta.ok === true);
                    });
                } catch (_) { resolve(false); }
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

        function _chiediAiutaGruppoEstensione() {
            return new Promise((resolve) => {
                if (!window.chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
                    resolve(false);
                    return;
                }
                let risolto = false;
                const timeoutId = setTimeout(() => { if (!risolto) { risolto = true; resolve(false); } }, TIMEOUT_RISPOSTA_ESTENSIONE_MS);
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

        function salvaPreferenzaAiutaGruppoDispositivo(attivo) {
            if (!window.chrome || !chrome.runtime || !chrome.runtime.sendMessage) return;
            try {
                chrome.runtime.sendMessage(ID_ESTENSIONE_CARDSYNC, { type: 'CARDSYNC_SET_AIUTA_GRUPPO', valore: attivo }, () => {
                    void chrome.runtime.lastError;
                });
            } catch (_) {   }
        }

        function _chiediLavoraAChiusoEstensione() {
            return new Promise((resolve) => {
                if (!window.chrome || !chrome.runtime || !chrome.runtime.sendMessage) { resolve(true); return; }
                let risolto = false;
                const timeoutId = setTimeout(() => { if (!risolto) { risolto = true; resolve(true); } }, TIMEOUT_RISPOSTA_ESTENSIONE_MS);
                try {
                    chrome.runtime.sendMessage(ID_ESTENSIONE_CARDSYNC, { type: 'CARDSYNC_GET_LAVORA_A_CHIUSO' }, (risposta) => {
                        if (risolto) return;
                        risolto = true;
                        clearTimeout(timeoutId);
                        if (chrome.runtime.lastError || !risposta || !risposta.ok) { resolve(true); return; }
                        resolve(risposta.lavoraAChiuso !== false);
                    });
                } catch (_) {
                    if (!risolto) { risolto = true; clearTimeout(timeoutId); resolve(true); }
                }
            });
        }

        function salvaPreferenzaLavoraAChiuso(attivo) {
            if (!window.chrome || !chrome.runtime || !chrome.runtime.sendMessage) return;
            try {
                chrome.runtime.sendMessage(ID_ESTENSIONE_CARDSYNC, { type: 'CARDSYNC_SET_LAVORA_A_CHIUSO', valore: attivo }, () => {
                    void chrome.runtime.lastError;
                });
            } catch (_) {   }
        }

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

            const [aiuta, lavoraAChiuso] = await Promise.all([_chiediAiutaGruppoEstensione(), _chiediLavoraAChiusoEstensione()]);
            document.getElementById('chkAiutaGruppoDispositivo').checked = aiuta;
            document.getElementById('chkLavoraAChiuso').checked = lavoraAChiuso;

            _controllaAccountEstensione();
        }

        const ID_AVVISO_ACCOUNT_ESTENSIONE = 'account-estensione';

        function _chiediUtenteEstensione() {
            return new Promise((resolve) => {
                if (!window.chrome || !chrome.runtime || !chrome.runtime.sendMessage) { resolve(null); return; }
                let risolto = false;
                const timeoutId = setTimeout(() => { if (!risolto) { risolto = true; resolve(null); } }, TIMEOUT_RISPOSTA_ESTENSIONE_MS);
                try {
                    chrome.runtime.sendMessage(ID_ESTENSIONE_CARDSYNC, { type: 'CARDSYNC_GET_UTENTE' }, (risposta) => {
                        if (risolto) return;
                        risolto = true;
                        clearTimeout(timeoutId);
                        if (chrome.runtime.lastError || !risposta || !risposta.ok) { resolve(null); return; }
                        resolve({ userId: risposta.userId || null, nome: risposta.nome || null });
                    });
                } catch (_) {
                    if (!risolto) { risolto = true; clearTimeout(timeoutId); resolve(null); }
                }
            });
        }

        async function _controllaAccountEstensione() {
            if (!_versioneVecchiaRilevata) return;
            try {
                const [estensione, userIdSito] = await Promise.all([_chiediUtenteEstensione(), authGetUserId()]);
                if (!estensione || !estensione.userId || !userIdSito || estensione.userId === userIdSito) {
                    avvisoFissoTogli(ID_AVVISO_ACCOUNT_ESTENSIONE);
                    return;
                }
                avvisoFisso(ID_AVVISO_ACCOUNT_ESTENSIONE,
                    `L'estensione è collegata a ${_nomeDaEmail(estensione.nome)}, non al tuo account: coda e ordini partono come ${_nomeDaEmail(estensione.nome)}. Apri l'app, premi "Esci" e rientra con il tuo utente.`,
                    { tipo: 'errore', azione: { etichetta: "Apri l'app", fn: _mandaAperturaAppAEstensione } });
            } catch (e) {
                console.error('[estensione] controllo account:', e);
            }
        }

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') _controllaAccountEstensione();
        });

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
            if (panel.parentElement !== document.body) document.body.appendChild(panel);
            panel.style.display = 'block';
            _applicaMotiviTema();
        }

        function nascondiPannelloCardsync() {
            document.getElementById('cardsyncPanel').style.display = 'none';
        }

        let _adattamentoAccessoAttivo = false;
        let _adattamentoAccessoUltimaLarghezza = 0;

        function _adattaAccessoAlloSchermo() {
            const panel = document.getElementById('cardsyncPanel');
            const login = document.getElementById('statoBossFiero');
            const schermo = panel && panel.querySelector('.pdx-schermo');
            if (!login || !schermo || panel.style.display === 'none' || login.style.display === 'none') return;

            const sta = (z) => {
                login.style.zoom = String(z);
                return schermo.scrollHeight <= schermo.clientHeight;
            };
            if (sta(1)) { login.style.zoom = ''; return; }
            let basso = 0.15, alto = 1;
            for (let i = 0; i < 10; i++) {
                const medio = (basso + alto) / 2;
                if (sta(medio)) basso = medio; else alto = medio;
            }
            login.style.zoom = String(basso);
            for (let i = 0; i < 8 && schermo.scrollHeight > schermo.clientHeight; i++) {
                basso *= 0.98;
                login.style.zoom = String(basso);
            }
        }

        function _avviaAdattamentoAccesso() {
            if (_adattamentoAccessoAttivo) return;
            _adattamentoAccessoAttivo = true;
            _adattamentoAccessoUltimaLarghezza = window.innerWidth;

            let rafId = 0;
            const rimanda = () => {
                cancelAnimationFrame(rafId);
                rafId = requestAnimationFrame(_adattaAccessoAlloSchermo);
            };
            window.addEventListener('resize', () => {
                const el = document.activeElement;
                const tastiera = !!el && el.tagName === 'INPUT' && window.innerWidth === _adattamentoAccessoUltimaLarghezza;
                _adattamentoAccessoUltimaLarghezza = window.innerWidth;
                if (!tastiera) rimanda();
            });
            window.addEventListener('orientationchange', rimanda);
            const err = document.getElementById('authError');
            if (err) new MutationObserver(rimanda).observe(err, { attributes: true, childList: true, characterData: true, subtree: true });
            if (document.fonts && document.fonts.ready) document.fonts.ready.then(rimanda);
        }

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
                    await _mostraStatoNonWindows();
                    return;
                }

                if (!estensioneOk) {
                    document.getElementById('btnNonInstallare').style.display = versioneInstallata ? 'none' : 'flex';
                    document.getElementById('btnDisinstallare').style.display = versioneInstallata ? 'flex' : 'none';
                    document.getElementById('statoNonInstallataTitolo').textContent = versioneInstallata
                        ? 'La tua estensione non è aggiornata'
                        : "Non hai l'estensione installata";
                    document.getElementById('statoNonInstallataTesto').textContent = versioneInstallata
                        ? `Hai la versione ${versioneInstallata}, l'ultima è la ${ultimaVersione} — non è possibile usare versioni vecchie, sorry not sorry.`
                        : `Per usare Bindex su questo PC serve l'estensione, versione ${ultimaVersione} o successiva.`;
                    _apriPannelloCardsync();
                    _mostraSoloStato('statoNonInstallata');
                    return;
                }

                await _mostraStatoLoginOControllo();
            } catch (e) {
                console.error('[ingresso] controllo estensione/login fallito:', e);
            }
        }

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

            document.getElementById('btnDisinstallaDaAccesso').style.display = nonWindows ? 'none' : 'flex';

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
            }
            _avviaAdattamentoAccesso();
            _adattaAccessoAlloSchermo();
            if (!sessione) authEmail.focus();
        }

        function mostraIstruzioniInstallazione() {
            _mostraSoloStato('statoIstruzioni');
            _applicaMotiviTema();

            const tipoOperazione = _versioneVecchiaRilevata ? 'aggiornamento' : 'installazione';
            document.getElementById('comandoAggiornaEstensione').textContent =
                `irm https://bindexxx.github.io/bindex/releases/aggiorna_cardsync.bat -OutFile "$env:TEMP\\aggiorna_cardsync.bat"; & "$env:TEMP\\aggiorna_cardsync.bat" ${tipoOperazione}`;

            const elPasso3 = document.getElementById('statoIstruzioniPasso3');
            if (_versioneVecchiaRilevata) {
                elPasso3.innerHTML = 'Scarica, controlla e installa da solo, poi riavvia Chrome riaprendo questo sito. Chrome conosce già questa estensione — nessun altro passo da fare.';
            } else {
                elPasso3.innerHTML = 'Scarica, controlla e installa da solo, poi riavvia Chrome riaprendo questo sito. <strong>Poi, un ultimo passo a mano</strong> (Chrome lo richiede per sicurezza, non è automatizzabile): vai su <code>chrome://extensions</code>, attiva <strong>"Modalità sviluppatore"</strong> in alto a destra se non è già attiva, poi clicca <strong>"Carica estensione non pacchettizzata"</strong> e seleziona la cartella che lo script ti indicherà.';
            }
        }

        async function _ricontrollaEChiudiIstruzioni() {
            const versioneInstallata = await _chiediVersioneEstensione();
            if (!_ultimaVersioneRichiesta || (versioneInstallata && !versioneMaggioreSito(_ultimaVersioneRichiesta, versioneInstallata))) {
                controlloIngressoCardsync();
                return;
            }
            _mostraSoloStato('statoBeccato');
        }

        async function _ricontrollaVersioneECambiaStato() {
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
