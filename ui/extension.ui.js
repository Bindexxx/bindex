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

        // Dalla 5.74 dell'estensione "Aiuta il gruppo", "Lavora anche a estensione chiusa" e
        // "Apri l'app quando apri il sito" si cambiano solo nell'app (menu › Impostazioni).
        // Il sito apre l'app sulle Impostazioni; un'estensione più vecchia apre solo l'app.
        function apriImpostazioniEstensione() {
            if (!window.chrome || !chrome.runtime || !chrome.runtime.sendMessage) return Promise.resolve(false);
            return new Promise((resolve) => {
                const payload = { type: 'CARDSYNC_OPEN_APP', impostazioni: true, temaScuro: prefDarkModeGet() };
                try {
                    chrome.runtime.sendMessage(ID_ESTENSIONE_CARDSYNC, payload, (risposta) => {
                        resolve(!chrome.runtime.lastError && !!risposta && risposta.ok === true);
                    });
                } catch (_) { resolve(false); }
            });
        }

        // Il sito avvisa l'estensione che è stato aperto: l'app si apre se lì è acceso "Apri l'app quando
        // apri il sito". Il vecchio "Apri sempre l'app" del sito, se acceso, si passa una volta (migraApriSempre).
        function _avvisaEstensioneSitoAperto() {
            return new Promise((resolve) => {
                if (!window.chrome || !chrome.runtime || !chrome.runtime.sendMessage) { resolve(null); return; }
                const payload = { type: 'CARDSYNC_SITO_APERTO', temaScuro: prefDarkModeGet() };
                if (prefApriSempreAppGet()) payload.migraApriSempre = true;
                try {
                    chrome.runtime.sendMessage(ID_ESTENSIONE_CARDSYNC, payload, (risposta) => {
                        if (chrome.runtime.lastError) { resolve(null); return; }
                        resolve(risposta || null);
                    });
                } catch (_) { resolve(null); }
            });
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

            _avvisaEstensioneSitoAperto().then((risposta) => {
                if (risposta && risposta.ok) { prefApriSempreAppTogli(); return; }
                // estensione prima della 5.74 (non conosce il messaggio): vale ancora la scelta salvata sul sito
                if (prefApriSempreAppGet()) _mandaAperturaAppAEstensione();
            });

            _controllaAccountEstensione();
            // dentro (anche dopo un accesso a mano): l'estensione fuori entra con lo stesso account
            authGetSession().then((s) => { if (s) _accessoUnico(s); });
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

        // ── Un solo accesso con l'estensione (estensione 5.83) ──
        // Sito ed estensione hanno ognuno la sua sessione: chi entra da una parte fa entrare l'altra con
        // un biglietto monouso (funzione biglietto-accesso), mai con la propria sessione (audit C3: due
        // client che rinnovano lo stesso token si buttano fuori). "Esci" da una parte fa uscire anche
        // l'altra se è lo stesso account; dopo un "Esci" niente rientra da solo finché non si rifà
        // l'accesso a mano. Mai sopra un account già collegato: con due account diversi resta l'avviso
        // qui sopra. Decide il sito; l'estensione risponde solo alle pagine di /bindex/ e solo con
        // "Un solo accesso con il sito" acceso (menu Impostazioni dell'app). Le ore sono di questo PC.
        // Su un PC usato da più persone: da sola una parte entra solo con l'ultimo account entrato lì
        // (o se lì non è mai entrato nessuno), mai con quello di un altro.
        const PAUSA_DOPO_ERRORE_ACCESSO_UNICO_MS = 60 * 1000;
        let _accessoUnicoInCorso = null;
        let _portaAccessoInCorso = null;
        let _accessoUnicoErroreIl = 0;

        function _messaggioAccessoEstensione(payload) {
            return new Promise((resolve) => {
                if (!window.chrome || !chrome.runtime || !chrome.runtime.sendMessage) { resolve(null); return; }
                let risolto = false;
                const timeoutId = setTimeout(() => { if (!risolto) { risolto = true; resolve(null); } }, TIMEOUT_RISPOSTA_ESTENSIONE_MS);
                try {
                    chrome.runtime.sendMessage(ID_ESTENSIONE_CARDSYNC, payload, (risposta) => {
                        if (risolto) return;
                        risolto = true;
                        clearTimeout(timeoutId);
                        if (chrome.runtime.lastError || !risposta) { resolve(null); return; }
                        resolve(risposta);
                    });
                } catch (_) {
                    if (!risolto) { risolto = true; clearTimeout(timeoutId); resolve(null); }
                }
            });
        }

        // null con un'estensione vecchia, assente o con l'interruttore spento: allora niente di nuovo
        async function _statoAccessoEstensione() {
            const r = await _messaggioAccessoEstensione({ type: 'CARDSYNC_STATO_ACCESSO' });
            return r && r.ok === true && r.attivo === true ? r : null;
        }

        function _statoAccessoSito(sessione) {
            const userId = sessione && sessione.user ? sessione.user.id : null;
            if (userId) prefUltimoUtenteSitoSet(userId);
            const dal = prefAccessoSitoGet();
            return { userId, accessoDal: dal && dal.userId === userId ? dal.quando : 0, uscita: prefUscitaSitoGet(), ultimoUtente: prefUltimoUtenteSitoGet() };
        }

        // sito = _statoAccessoSito(), est = risposta di CARDSYNC_STATO_ACCESSO (o null).
        // Un "Esci" più recente dell'accesso dell'altra parte: stesso account → esce anche l'altra,
        // account diverso → niente (e niente rientra da solo). Si entra da soli solo con l'ultimo
        // account entrato da quella parte (o se lì non è mai entrato nessuno).
        function _decisioneAccessoUnico(sito, est) {
            if (!est || (sito.userId && est.userId)) return 'niente';
            if (sito.userId) {
                const u = est.uscita;
                if (u && u.quando > sito.accessoDal) return u.userId === sito.userId ? 'esci_dal_sito' : 'niente';
                return !est.ultimoUtente || est.ultimoUtente === sito.userId ? 'porta_accesso' : 'niente';
            }
            if (est.userId) {
                const u = sito.uscita;
                if (u && u.quando > (est.accessoDal || 0)) return u.userId === est.userId ? 'fai_uscire_estensione' : 'niente';
                return !sito.ultimoUtente || sito.ultimoUtente === est.userId ? 'prendi_accesso' : 'niente';
            }
            return 'niente';
        }

        async function _portaAccessoAllEstensione(userId) {
            const { data, error } = await authBigliettoPerEstensione();
            if (error || !data || data.ok !== true || !data.biglietto || data.userId !== userId) {
                throw new Error((data && data.errore) || (error && error.message) || 'biglietto non creato');
            }
            const r = await _messaggioAccessoEstensione({ type: 'CARDSYNC_ACCEDI_CON_BIGLIETTO', biglietto: data.biglietto, tipo: data.tipo, userId });
            if (!r || r.ok !== true) throw new Error((r && r.errore) || "l'estensione non risponde");
            avvisoFissoTogli(ID_AVVISO_ACCOUNT_ESTENSIONE);
        }

        async function _prendiAccessoDallEstensione(est) {
            const r = await _messaggioAccessoEstensione({ type: 'CARDSYNC_DAMMI_BIGLIETTO' });
            if (!r || r.ok !== true || !r.biglietto || r.userId !== est.userId) throw new Error((r && r.errore) || 'biglietto non arrivato');
            const { data, error } = await authAccediConBiglietto(r.biglietto, r.tipo);
            const sessione = data && data.session;
            if (error || !sessione || !sessione.user) throw new Error((error && error.message) || 'biglietto non accettato');
            if (sessione.user.id !== r.userId) { await authLogout(); throw new Error('account diverso'); }
            prefAccessoSitoSet(sessione.user.id);
            return sessione;
        }

        // Un passo: restituisce la sessione del sito dopo il passo (null se il sito è appena uscito).
        // L'accesso portato all'estensione non si aspetta: il sito va avanti intanto.
        function _accessoUnico(sessione) {
            if (_accessoUnicoInCorso) return _accessoUnicoInCorso;
            _accessoUnicoInCorso = (async () => {
                try {
                    if (Date.now() - _accessoUnicoErroreIl < PAUSA_DOPO_ERRORE_ACCESSO_UNICO_MS) return sessione;
                    const est = await _statoAccessoEstensione();
                    const decisione = _decisioneAccessoUnico(_statoAccessoSito(sessione), est);
                    if (decisione === 'porta_accesso') {
                        if (!_portaAccessoInCorso) {
                            _portaAccessoInCorso = _portaAccessoAllEstensione(sessione.user.id)
                                .catch((e) => { _accessoUnicoErroreIl = Date.now(); console.warn("[accesso unico] l'estensione non è entrata:", e && e.message); })
                                .finally(() => { _portaAccessoInCorso = null; });
                        }
                        return sessione;
                    }
                    if (decisione === 'prendi_accesso') return await _prendiAccessoDallEstensione(est);
                    if (decisione === 'esci_dal_sito') {
                        prefUscitaSitoSet(sessione.user.id);
                        await authLogout();
                        if (typeof cacheCarteSvuota === 'function') cacheCarteSvuota();
                        prefActiveTabClear();
                        return null;
                    }
                    if (decisione === 'fai_uscire_estensione') await _messaggioAccessoEstensione({ type: 'CARDSYNC_ESCI', userId: est.userId });
                    return sessione;
                } catch (e) {
                    _accessoUnicoErroreIl = Date.now();
                    console.warn('[accesso unico]', e && e.message);
                    return sessione;
                } finally {
                    _accessoUnicoInCorso = null;
                }
            })();
            return _accessoUnicoInCorso;
        }

        // "Esci" dal sito: l'uscita si ricorda (l'estensione non lo fa rientrare da sola) e, se
        // l'estensione è dentro con lo stesso account, esce anche lei.
        async function _accessoUnicoEsciAncheEstensione() {
            try {
                const userId = await authGetUserId();
                if (!userId) return;
                prefUscitaSitoSet(userId);
                if (_versioneVecchiaRilevata) await _messaggioAccessoEstensione({ type: 'CARDSYNC_ESCI', userId });
            } catch (e) {
                console.warn('[accesso unico] uscita:', e && e.message);
            }
        }

        function _moduloAccessoInVista() {
            const panel = document.getElementById('cardsyncPanel');
            const stato = document.getElementById('statoBossFiero');
            const modulo = document.getElementById('bossFieroLoginForm');
            return !!(panel && panel.style.display !== 'none' && stato && stato.style.display !== 'none'
                && modulo && modulo.style.display !== 'none');
        }

        // La scheda torna in vista: entrati o usciti dall'estensione nel frattempo.
        async function _accessoUnicoAlRitorno() {
            if (!_versioneVecchiaRilevata) return;
            const prima = await authGetSession();
            if (!prima && !_moduloAccessoInVista()) return;
            const dopo = await _accessoUnico(prima);
            if (prima && !dopo) { location.reload(); return; }
            if (!prima && dopo) await _mostraStatoLoginOControllo();
        }

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') _accessoUnicoAlRitorno();
        });
        window.addEventListener('focus', () => { _accessoUnicoAlRitorno(); });

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

        const ATTESA_INGRESSO_AUTOMATICO_MS = 2000;
        let _ingressoAutomaticoTimer = null;
        let _accessoInCorso = false;

        function _annullaIngressoAutomatico() {
            clearTimeout(_ingressoAutomaticoTimer);
            _ingressoAutomaticoTimer = null;
            const barra = document.getElementById('barraIngressoAutomatico');
            if (barra) barra.remove();
        }

        function _avviaIngressoAutomatico() {
            _annullaIngressoAutomatico();
            const btn = document.getElementById('btnContinuaComeUtente');
            if (btn) {
                btn.style.position = 'relative';
                btn.style.overflow = 'hidden';
                const barra = document.createElement('span');
                barra.id = 'barraIngressoAutomatico';
                barra.setAttribute('aria-hidden', 'true');
                barra.style.cssText = 'position:absolute; left:0; bottom:0; height:3px; width:0; background:rgba(255,255,255,0.6); transition:width ' + ATTESA_INGRESSO_AUTOMATICO_MS + 'ms linear; pointer-events:none;';
                btn.appendChild(barra);
                requestAnimationFrame(() => requestAnimationFrame(() => { barra.style.width = '100%'; }));
            }
            _ingressoAutomaticoTimer = setTimeout(() => {
                _ingressoAutomaticoTimer = null;
                const panel = document.getElementById('cardsyncPanel');
                const stato = document.getElementById('statoBossFiero');
                const giaLoggato = document.getElementById('bossFieroGiaLoggato');
                if (panel && panel.style.display !== 'none' && stato && stato.style.display !== 'none'
                    && giaLoggato && giaLoggato.style.display !== 'none') {
                    _continuaAlSito();
                }
            }, ATTESA_INGRESSO_AUTOMATICO_MS);
        }

        function _mostraSoloStato(idStato) {
            if (idStato !== 'statoBossFiero') _annullaIngressoAutomatico();
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
                    ? 'Hai l\'estensione installata e aggiornata all\'ultima versione — valuta di attivare la funzione "Aiuta il gruppo" (nell\'app dell\'estensione, menu › Impostazioni) per far sì che non sia solo il PC di Bill a fare i calcoli per gli altri. In questo modo l\'app sarà più veloce per tutti noi. Bill ringrazia. 🙏'
                    : 'Puoi usare il sito tranquillamente anche senza l\'estensione su questo dispositivo — accedi per continuare.';
            }

            document.getElementById('btnDisinstallaDaAccesso').style.display = nonWindows ? 'none' : 'flex';

            let sessione = await assicuraLoginSupabase();
            if (_versioneVecchiaRilevata) {
                // un solo accesso con l'estensione: dentro da lì → dentro anche qui; uscita da lì → fuori
                const prima = sessione;
                sessione = await _accessoUnico(sessione);
                if (sessione && !prima) mostraUtenteLoggato(sessione.user.email);
            }
            _apriPannelloCardsync();
            _mostraSoloStato('statoBossFiero');

            if (sessione) {
                document.getElementById('bossFieroLoginForm').style.display = 'none';
                document.getElementById('bossFieroGiaLoggato').style.display = 'block';
                document.getElementById('btnContinuaComeUtente').innerHTML =
                    `Continua come ${_nomeDaEmail(sessione.user.email)} <i class="fa-solid fa-arrow-right"></i>`;
                _avviaIngressoAutomatico();
            } else {
                _annullaIngressoAutomatico();
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
            _annullaIngressoAutomatico();
            if (_accessoInCorso) return;
            _accessoInCorso = true;
            try {
                nascondiPannelloCardsync();
                await _avviaSitoDopoAccesso();
            } finally {
                _accessoInCorso = false;
            }
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
