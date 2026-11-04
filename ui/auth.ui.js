// Accesso, uscita, recupero password, cambio nome utente.

function _nomeDaEmail(email) {
            const utente = (email || '').split('@')[0] || '?';
            return utente.charAt(0).toUpperCase() + utente.slice(1);
        }

        function mostraUtenteLoggato(email) {
            const nome = _nomeDaEmail(email);
            document.getElementById('profiloAvatar').textContent = nome.charAt(0).toUpperCase();
            document.getElementById('profiloAvatar').title = nome;
            document.getElementById('profiloMenuNome').textContent = nome;
            document.getElementById('profiloMenuEmail').textContent = email;

            const btnLogout = document.getElementById('profiloMenuLogout');
            btnLogout.onclick = async (e) => {
                e.stopPropagation();
                if (!(await chiediConferma({ titolo: 'Uscire da Bindex?', testo: email, conferma: 'Esci' }))) return;
                await authLogout();
                if (typeof cacheCarteSvuota === 'function') cacheCarteSvuota();
                prefActiveTabClear();
                location.reload();
            };
        }

        function toggleMenuProfilo() {
            const menu = document.getElementById('profiloMenu');
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        }

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.profilo-container')) {
                const menu = document.getElementById('profiloMenu');
                if (menu) menu.style.display = 'none';
            }
        });

        async function tentaLogin() {
            const inputUtente = authEmail.value.trim();
            const password = authPassword.value;
            if (!inputUtente || !password) {
                authError.textContent = 'Inserisci nome utente e password.';
                authError.style.display = 'block';
                return;
            }
            // AMBIENTE DI TEST: il nome da solo si completa con @test.local. In produzione
            // '@cardsyncpro.local', insieme agli altri punti marcati così (sito ed estensione)
            // e a sql/110_..._ROLLBACK.sql.
            const email = inputUtente.includes('@') ? inputUtente : `${inputUtente.toLowerCase()}@test.local`;
            authSubmit.disabled = true;
            authSubmit.textContent = 'Accesso in corso…';
            authError.style.display = 'none';

            prefMantieniAccessoSet(mantieniAccessoToggle.checked ? 'si' : 'no');

            const { data, error } = await authLogin(email, password);
            if (error) {
                authError.textContent = '❌ ' + (error.message === 'Invalid login credentials' ? 'Nome utente o password errati.' : error.message);
                authError.style.display = 'block';
                authSubmit.disabled = false;
                authSubmit.textContent = 'Accedi';
                return;
            }
            mostraUtenteLoggato(data.session.user.email);
            nascondiPannelloCardsync();
            await _avviaSitoDopoAccesso();
        }

        authSubmit.addEventListener('click', tentaLogin);
        [authEmail, authPassword].forEach((el) => {
            el.addEventListener('keydown', (e) => { if (e.key === 'Enter') tentaLogin(); });
        });

        function apriModaleResetPassword() {
            document.getElementById('resetPasswordUsername').value = '';
            document.getElementById('resetPasswordError').style.display = 'none';
            document.getElementById('resetPasswordEsito').style.display = 'none';
            document.getElementById('resetPasswordSubmit').style.display = 'block';
            document.getElementById('resetPasswordUsername').disabled = false;
            document.getElementById('resetPasswordModal').style.display = 'flex';
        }

        function chiudiModaleResetPassword() {
            document.getElementById('resetPasswordModal').style.display = 'none';
        }

        async function inviaRichiestaResetPassword() {
            const username = document.getElementById('resetPasswordUsername').value.trim();
            const errEl = document.getElementById('resetPasswordError');
            const esitoEl = document.getElementById('resetPasswordEsito');
            const btn = document.getElementById('resetPasswordSubmit');
            errEl.style.display = 'none';

            if (!username) {
                errEl.textContent = 'Inserisci il tuo nome utente.';
                errEl.style.display = 'block';
                return;
            }

            btn.disabled = true;
            btn.textContent = 'Invio in corso…';

            const { error } = await authRequestPasswordReset(username);

            btn.disabled = false;
            btn.textContent = 'Invia richiesta';

            if (error) {
                errEl.textContent = '❌ ' + (error.message || 'Errore imprevisto, riprova più tardi.');
                errEl.style.display = 'block';
                return;
            }

            esitoEl.style.display = 'block';
            btn.style.display = 'none';
            document.getElementById('resetPasswordUsername').disabled = true;
        }

        function apriModaleCambioUsername() {
            document.getElementById('cambioUsernameNuovo').value = '';
            document.getElementById('cambioUsernameError').style.display = 'none';
            document.getElementById('cambioUsernameEsito').style.display = 'none';
            document.getElementById('cambioUsernameSubmit').style.display = 'block';
            document.getElementById('cambioUsernameNuovo').disabled = false;
            document.getElementById('profiloMenu').style.display = 'none';
            document.getElementById('cambioUsernameModal').style.display = 'flex';
        }

        function chiudiModaleCambioUsername() {
            document.getElementById('cambioUsernameModal').style.display = 'none';
        }

        async function inviaRichiestaCambioUsername() {
            const nuovoUsername = document.getElementById('cambioUsernameNuovo').value.trim().toLowerCase();
            const errEl = document.getElementById('cambioUsernameError');
            const esitoEl = document.getElementById('cambioUsernameEsito');
            const btn = document.getElementById('cambioUsernameSubmit');
            errEl.style.display = 'none';

            if (!REGEX_USERNAME.test(nuovoUsername)) {
                errEl.textContent = 'Username non valido: 3-20 caratteri, solo minuscole, numeri e underscore.';
                errEl.style.display = 'block';
                return;
            }

            const userId = await authGetUserId();
            if (!userId) {
                errEl.textContent = 'Sessione non valida, ricarica la pagina e riprova.';
                errEl.style.display = 'block';
                return;
            }

            btn.disabled = true;
            btn.textContent = 'Invio in corso…';

            const { error } = await authRequestUsernameChange(userId, nuovoUsername);

            btn.disabled = false;
            btn.textContent = 'Invia richiesta';

            if (error) {
                errEl.textContent = '❌ ' + (error.message || 'Errore imprevisto, riprova più tardi.');
                errEl.style.display = 'block';
                return;
            }

            esitoEl.style.display = 'block';
            btn.style.display = 'none';
            document.getElementById('cambioUsernameNuovo').disabled = true;
        }

        async function assicuraLoginSupabase() {
            const sessione = await authGetSession();
            if (sessione) mostraUtenteLoggato(sessione.user.email);
            return sessione;
        }

        async function _avviaSitoDopoAccesso() {
            if (!_layoutWidgetUserId) {
                await _caricaLayoutWidget();
                await renderWidgetHome();
            }

            const _sealedInArrivo = (typeof caricaProdottiSealedReali === 'function')
                ? caricaProdottiSealedReali().catch(e => console.error('Errore caricamento prodotti sealed:', e))
                : null;
            await caricaCarteReali();
            if (_sealedInArrivo) await _sealedInArrivo;
            await _avviaRealtimeCarte();

            const prefUtente = await caricaPreferenzeUtente();
            aggiornaBadgeMatch();
            caricaCarteConProblemi();

            if (typeof _caricaSaldoEEffettiStatusBar === 'function' && !_saldoEEffettiStatusBarCaricati) {
                _caricaSaldoEEffettiStatusBar();
            }

            (async () => {
                try {
                    const userId = await authGetUserId();
                    if (userId) await missioniAccessoRegistraOggi(userId);
                } catch (e) { console.error('[missioni] registrazione accesso:', e); }
            })();

            (async () => {
                try {
                    if (typeof primoPianoCaricaBaseline === 'function') await primoPianoCaricaBaseline();
                } catch (e) { console.error('[primo piano] avvio baseline:', e); }
            })();

            const savedTab = prefActiveTabGet() || 'home';
            const navBtn = document.querySelector(`nav .nav-item[onclick*="'${savedTab}'"]`);
            switchTab(savedTab, navBtn);

            _aggiornaControlliApriApp();
            if (typeof fotoApriDaLinkSeRichiesto === 'function') fotoApriDaLinkSeRichiesto();
            if (typeof fotoProfiloAggiornaBarra === 'function') setTimeout(fotoProfiloAggiornaBarra, 1500);
        }

function authMostraNascondiPassword(btn) {
    const input = document.getElementById('authPassword');
    if (!input) return;
    const mostra = input.type === 'password';
    input.type = mostra ? 'text' : 'password';
    input.classList.toggle('auth-pw-visibile', mostra);
    btn.setAttribute('aria-pressed', mostra ? 'true' : 'false');
    const ico = btn.querySelector('i');
    if (ico) ico.className = mostra ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
}
