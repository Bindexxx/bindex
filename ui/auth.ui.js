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
                if (!confirm('Uscire da Bindex (' + email + ')?')) return;
                await authLogout();
                // Azzera la tab ricordata (per-dispositivo) — dispositivo
                // condiviso tra il gruppo, il prossimo login non deve
                // ritrovarsi nella stessa schermata di chi ha appena fatto
                // logout. Spostato qui (audit 2026-09-25) dal vecchio
                // logoutDaImpostazioni(), rimosso: era l'unico dei due
                // logout che lo faceva.
                prefActiveTabClear();
                location.reload();
            };
        }


        function toggleMenuProfilo() {
            const menu = document.getElementById('profiloMenu');
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        }

        // logoutDaImpostazioni() RIMOSSA (audit 2026-09-25, decisione
        // Claudio): era un secondo accesso TEMPORANEO (26/08) al logout,
        // aggiunto quando il menu Profilo non era raggiungibile. Il menu
        // Profilo funziona: il logout ha di nuovo un solo punto d'accesso
        // (mostraUtenteLoggato sopra), che ora azzera anche la tab ricordata.

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.profilo-container')) {
                const menu = document.getElementById('profiloMenu');
                if (menu) menu.style.display = 'none';
            }
        });

        // "Mantieni accesso" = no: il vecchio logout su 'beforeunload' è
        // stato RIMOSSO (audit 2026-09-25, A1). Scattava anche al refresh e
        // aprendo una pagina pubblica nella stessa scheda, era asincrono
        // durante lo scaricamento (esito casuale) e con signOut() globale
        // chiudeva la sessione su TUTTI i dispositivi. Ora la scelta decide
        // DOVE viene salvata la sessione (sessionStorage = muore da sola
        // alla chiusura della scheda): vedi AUTH_STORAGE_SESSIONE in
        // config/supabase.js e createClient in index.html.


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

            // Salvata PRIMA del login (audit 2026-09-25, A1): la sessione
            // appena creata viene scritta nello storage scelto da questa
            // preferenza (vedi AUTH_STORAGE_SESSIONE) — se la impostassimo
            // dopo, il token finirebbe nello storage della scelta precedente.
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
            // LAYOUT HOME dopo un login "fresco" (senza ricaricare la pagina).
            // initPhoneShell() carica il layout dei widget all'apertura della
            // pagina, quando chi sta facendo il login non è ancora autenticato:
            // _caricaLayoutWidget() non trova un userId, usa il layout di
            // default e lascia _layoutWidgetUserId = null. Senza questo
            // passaggio la home restava sul default (finché non si ricaricava)
            // e _salvaLayoutWidget() usciva subito senza scrivere, perdendo le
            // modifiche fatte dopo il login. Con la sessione già presente
            // all'apertura (refresh, "Continua come...") l'userId c'è già:
            // qui non si fa nulla.
            if (!_layoutWidgetUserId) {
                await _caricaLayoutWidget();
                await renderWidgetHome();
            }

            await caricaCarteReali();
            // FASE 1 (2026-09-12): prodotti sealed, array parallelo — non
            // blocca l'avvio se fallisce (stesso spirito già in uso qui
            // sotto per binder/preferenze), il widget mostrerà "nessun
            // prodotto" finché non si riprova.
            if (typeof caricaProdottiSealedReali === 'function') {
                await caricaProdottiSealedReali();
            }
            await _avviaRealtimeCarte();

            const prefUtente = await caricaPreferenzeUtente();
            aggiornaBadgeMatch();
            caricaCarteConProblemi();

            // Saldo polvere (barra di stato) ed effetti del negozio: all'apertura
            // della pagina non c'era ancora un utente (login fresco), quindi
            // initPhoneShell() li ha saltati. Se erano già stati caricati
            // (refresh con sessione) non si rifà nulla. Fire-and-forget.
            if (typeof _caricaSaldoEEffettiStatusBar === 'function' && !_saldoEEffettiStatusBarCaricati) {
                _caricaSaldoEEffettiStatusBar();
            }

            // Missioni/Traguardi Fase 2 — streak accessi (2026-08-29).
            // Fire-and-forget: un fallimento qui non deve mai bloccare
            // l'avvio del sito. Dedup a 1/giorno gestito dentro la
            // funzione stessa (vedi data/missioni.repository.js) — sicuro
            // chiamarla ad ogni reload, anche più volte nello stesso giorno.
            (async () => {
                try {
                    const userId = await authGetUserId();
                    if (userId) await missioniAccessoRegistraOggi(userId);
                } catch (e) { console.error('[missioni] registrazione accesso:', e); }
            })();

            // In primo piano (2026-09-19, sql/64): registra la visita e carica la
            // baseline dell'oscillazione "dall'ultimo accesso". Fire-and-forget:
            // se sql/64 non e' ancora stata eseguita o qualcosa fallisce, il
            // widget ripiega da solo sulla vecchia definizione. Funzione definita
            // in ui/widget-in-primo-piano.ui.js (risolta a runtime).
            (async () => {
                try {
                    if (typeof primoPianoCaricaBaseline === 'function') await primoPianoCaricaBaseline();
                } catch (e) { console.error('[primo piano] avvio baseline:', e); }
            })();


            // Ripristina l'ultima scheda visitata (o 'home'). L'impostazione
            // "Pagina all'apertura" e' stata tolta (2026-10-05): non c'e'
            // piu' una scheda predefinita scelta dall'utente.
            const savedTab = prefActiveTabGet() || 'home';
            const navBtn = document.querySelector(`nav .nav-item[onclick*="'${savedTab}'"]`);
            switchTab(savedTab, navBtn);

            _aggiornaControlliApriApp();
            // FASE 8c: link "?apri=foto" dal QR della pagina Foto carte su PC.
            if (typeof fotoApriDaLinkSeRichiesto === 'function') fotoApriDaLinkSeRichiesto();
            // Foto profilo nella barra in alto (sql/90), dopo che la barra è montata.
            if (typeof fotoProfiloAggiornaBarra === 'function') setTimeout(fotoProfiloAggiornaBarra, 1500);
        }

// RESTYLE BINDEX FASE 5: occhio sul campo password dell'accesso. Cambia solo
// il tipo del campo (password ↔ text): nessuna logica di login toccata.
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
