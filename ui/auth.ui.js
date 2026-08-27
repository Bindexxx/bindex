// ── ui/auth.ui.js ──────────────────────────────────────────────────────
// Login/logout, recupero accesso (reset password), cambio username. Legge
// il DOM e coordina il flusso, chiamando i repository data/auth.repository.js
// e data/moderation.repository.js per l'accesso a Supabase.

        // Storage di default (localStorage) va benissimo qui: è un sito web
        // normale, non un'estensione — nessun bisogno di chrome.storage.local.

        // ── LOGIN / LOGOUT ────────────────────────────────────────────────────────
        // I campi authEmail/authPassword/authError/authSubmit ora vivono
        // dentro il nuovo pannello a schermo intero (stato "Il boss è fiero
        // di te"), non più in un overlay separato — stessa logica di prima,
        // solo spostata.

        // Ricava il nome dall'email (irene@cardsyncpro.local → "Irene") —
        // stessa convenzione già usata per gli account del gruppo.
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
                if (!confirm('Uscire da CardSync Pro (' + email + ')?')) return;
                await authLogout();
                location.reload();
            };
        }


        function toggleMenuProfilo() {
            const menu = document.getElementById('profiloMenu');
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        }

        // TEMPORANEO (26/08/2026): secondo punto d'accesso allo stesso
        // identico logout già presente in mostraUtenteLoggato() sopra
        // (bottone #profiloMenuLogout nel menu Profilo/avatar). Aggiunto
        // perché quel menu risulta non raggiungibile/visibile nella
        // visualizzazione attuale — causa non ancora diagnosticata in
        // questa sessione (richiede di guardare come #profiloAvatar/
        // #profiloMenu vengono mostrati nel layout "smartphone simulato").
        // DA RIMUOVERE quando quel problema sarà risolto: a quel punto il
        // logout torna ad avere un solo punto d'accesso, come prima.
        async function logoutDaImpostazioni() {
            const email = document.getElementById('profiloMenuEmail')?.textContent || '';
            if (!confirm('Uscire da CardSync Pro' + (email ? ' (' + email + ')' : '') + '?')) return;
            await authLogout();
            // Azzera la tab ricordata (per-dispositivo) — dispositivo
            // condiviso tra il gruppo, il prossimo login non deve
            // ritrovarsi nella stessa schermata di chi ha appena fatto
            // logout. Vedi data/preferences.repository.js.
            prefActiveTabClear();
            location.reload();
        }

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.profilo-container')) {
                const menu = document.getElementById('profiloMenu');
                if (menu) menu.style.display = 'none';
            }
        });

        // Se "mantieni acceso" è disattivato, la sessione viene chiusa alla
        // chiusura della scheda/finestra — altrimenti (default) resta come
        // sempre stata: persistente tra un utilizzo e l'altro.
        window.addEventListener('beforeunload', () => {
            if (prefMantieniAccessoGet() === 'no') {
                authLogout();
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
            // Chi digita solo il nome ("irene") lo trasformiamo in email
            // completa dietro le quinte — Supabase Auth richiede comunque
            // un'email valida, ma l'utente non deve più saperlo né
            // digitarla per intero. Se qualcuno incolla già l'email
            // completa (abitudine precedente), la usiamo così com'è.
            const email = inputUtente.includes('@') ? inputUtente : `${inputUtente.toLowerCase()}@cardsyncpro.local`;
            authSubmit.disabled = true;
            authSubmit.textContent = 'Accesso in corso…';
            authError.style.display = 'none';

            const { data, error } = await authLogin(email, password);
            if (error) {
                authError.textContent = '❌ ' + (error.message === 'Invalid login credentials' ? 'Nome utente o password errati.' : error.message);
                authError.style.display = 'block';
                authSubmit.disabled = false;
                authSubmit.textContent = 'Accedi';
                return;
            }
            prefMantieniAccessoSet(mantieniAccessoToggle.checked ? 'si' : 'no');
            mostraUtenteLoggato(data.session.user.email);
            nascondiPannelloCardsync();
            await _avviaSitoDopoAccesso();
        }

        authSubmit.addEventListener('click', tentaLogin);
        [authEmail, authPassword].forEach((el) => {
            el.addEventListener('keydown', (e) => { if (e.key === 'Enter') tentaLogin(); });
        });


        // ── RECUPERO ACCESSO (reset password) ──────────────────────
        // Entry point pubblico: nessun login richiesto, l'utente non può
        // accedere. Chiama la RPC request_password_reset (SECURITY
        // DEFINER, rate limit 3/ora lato DB). Il messaggio di esito è
        // SEMPRE lo stesso, anche se lo username non esiste, per non
        // rivelare quali username sono validi.
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
                // Unico caso di errore visibile: rate limit superato
                // (3 richieste/ora per lo stesso username) — tutto il
                // resto (anche username inesistente) risponde sempre ok.
                errEl.textContent = '❌ ' + (error.message || 'Errore imprevisto, riprova più tardi.');
                errEl.style.display = 'block';
                return;
            }

            esitoEl.style.display = 'block';
            btn.style.display = 'none';
            document.getElementById('resetPasswordUsername').disabled = true;
        }


        // ── CAMBIO USERNAME (Fase 2b) ───────────────────────────────
        // Entry point per utente già loggato (menu Profilo). Insert
        // diretto in pending_requests: nessuna RPC dedicata, secondo il
        // file di stato la policy RLS esistente su insert per utenti
        // loggati dovrebbe bastare — MA questo insert diretto non è
        // ancora stato testato dal vivo in questa sessione. Se fallisce
        // per RLS, va verificata/creata una policy INSERT dedicata
        // (verifica diretta sul DB, mai a scatola chiusa). Il cambio
        // reale avviene solo quando un admin approva, tramite
        // admin_process_pending_request (Fase 3, non ancora collegata
        // in admin.html).
        // Validazione lato client: 3-20 caratteri, solo a-z0-9_ —
        // assunzione presa in sessione, da correggere se Claudio vuole
        // regole diverse.

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


        // Ora ritorna solo lo stato della sessione — è compitoVersioneECardsyncPanel
        // (vedi più sotto) decidere se e come mostrare il pannello.
        async function assicuraLoginSupabase() {
            const sessione = await authGetSession();
            if (sessione) mostraUtenteLoggato(sessione.user.email);
            return sessione;
        }


        // Tutto quello che serve DOPO che l'estensione è a posto E l'utente
        // è loggato — richiamata sia al primo avvio (se già tutto ok), sia
        // subito dopo un login riuscito, sia cliccando "Continua come...".
        async function _avviaSitoDopoAccesso() {
            await caricaCarteReali();
            await _avviaRealtimeCarte();

            const prefUtente = await caricaPreferenzeUtente();
            aggiornaBadgeMatch();
            caricaCarteConProblemi();

            // Ripristina l'ultima scheda visitata; se non c'è (prima visita
            // su questo dispositivo, o storage svuotato), usa la sezione
            // predefinita scelta nelle Impostazioni.
            // FIX: prima "ricorda l'ultima tab visitata" (salvato ad ogni
            // navigazione) aveva SEMPRE la precedenza sulla preferenza
            // esplicita "Sezione all'apertura" — quindi quest'ultima non
            // aveva mai effetto reale, dato che dopo la prima visita
            // qualunque restava sempre salvato qualcosa in activeTab. Una
            // scelta fatta apposta nelle Impostazioni deve vincere sempre
            // su un comportamento "di comodo" automatico.
            const savedTab = prefUtente?.tab_predefinita || prefActiveTabGet() || 'home';
            const navBtn = document.querySelector(`nav .nav-item[onclick*="'${savedTab}'"]`);
            switchTab(savedTab, navBtn);

            _aggiornaControlliApriApp();
        }
