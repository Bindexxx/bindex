// ═══════════════════════════════════════════════════════════════════════
// NAVIGATION-TEMA.UI.JS — dark mode, temi, riduci animazioni (CardSync
// Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP separato dal piano "riduzione accoppiamento" concordato con Claudio
// il 2026-09-11. Estratto da ui/navigation.ui.js. NESSUNA riscrittura del
// codice esistente: solo spostamento, zero cambi di comportamento per
// l'utente finale.
//
// Contiene: toggleDarkMode, _animazioniRidotte, toggleRiduciAnimazioni,
// setSiteTheme.
//
// AGGIORNATO (STEP 1 restyle "cornice Pokédex", 2026-09-17): setSiteTheme
// (3 preset fissi) sostituita da applicaColoriTema/setColorePrincipale/
// setColoreSecondario (2 colori liberi, vedi utils/theme-colori.js).
// toggleDarkMode ora richiama anche applicaColoriTema() perché la
// derivazione dipende dal flag scuro/chiaro. setSiteTheme() resta
// definita più sotto per rollback ma non è più chiamata da nessuna parte.
//
// Nessuna istruzione qui gira a tempo di caricamento script — l'ordine
// tra i quattro file navigation-*.ui.js è indifferente, MA questo file
// deve caricarsi DOPO utils/theme-colori.js (già garantito in index.html).
// ───────────────────────────────────────────────────────────────────────

        function toggleDarkMode(isDark) {
            prefDarkModeSet(isDark);
            if (isDark) {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }
            applicaColoriTema();
        }

        // ── TEMA A 2 COLORI (STEP 1 restyle "cornice Pokédex", 2026-09-17) ──
        // Legge Principale/Secondario salvati (o i default), deriva le
        // variabili CSS (utils/theme-colori.js) e le scrive su :root.
        // Invalida anche la cache SVG delle sfere Poké Ball (colori diversi
        // => calotta/pancia diverse => renderWidgetHome va rifatto), SOLO
        // se il motore sfere è già caricato (questa funzione gira anche
        // primissima, prima che tutto il resto sia pronto).
        function applicaColoriTema() {
            const principale = prefColorePrincipaleGet() || TEMA_COLORE_PRINCIPALE_DEFAULT;
            const secondario = prefColoreSecondarioGet() || TEMA_COLORE_SECONDARIO_DEFAULT;
            const scuro = document.body.classList.contains('dark-mode');

            const variabili = derivaVariabiliTema(principale, secondario, scuro);
            Object.entries(variabili).forEach(([nome, valore]) => {
                document.documentElement.style.setProperty(nome, valore);
            });

            // Sincronizza i due color-picker in Impostazioni > Tema, se già
            // renderizzati (potrebbero non esserlo ancora al primissimo
            // avvio, prima che window.onload apra la pagina Impostazioni).
            const inputPrincipale = document.getElementById('temaColorePrincipale');
            const inputSecondario = document.getElementById('temaColoreSecondario');
            if (inputPrincipale) inputPrincipale.value = principale;
            if (inputSecondario) inputSecondario.value = secondario;

            // La cache SVG delle sfere si invalida da sola (la chiave include
            // già calotta/pancia correnti, vedi _ballSvgCache) — qui basta
            // rifare il render se il motore Home è già partito, altrimenti
            // initPhoneShell() ci penserà al primo giro.
            if (typeof renderWidgetHome === 'function' && typeof _layoutWidget !== 'undefined' && _layoutWidget) {
                renderWidgetHome();
            }
        }

        function setColorePrincipale(hex) {
            prefColorePrincipaleSet(hex);
            applicaColoriTema();
            _salvaColoreCorniceRemoto();
        }

        function setColoreSecondario(hex) {
            prefColoreSecondarioSet(hex);
            applicaColoriTema();
            _salvaColoreCorniceRemoto();
        }

        // ── SINCRONIZZAZIONE SUPABASE (STEP 6 restyle "cornice Pokédex",
        // 2026-09-17) — il colore cornice, a differenza del layout widget,
        // NON è più solo locale: deve essere visibile anche ai visitatori
        // anonimi dei link pubblici (vedi sql/63). localStorage resta come
        // cache veloce per il primo paint (evita un flash prima del giro di
        // rete); Supabase è la fonte di verità quando disponibile.

        // Scrittura: "fire and forget", non blocca l'interfaccia — se fallisce
        // (rete assente, non loggato) il colore resta comunque applicato in
        // locale su questo dispositivo, si ritenterà al prossimo cambio.
        async function _salvaColoreCorniceRemoto() {
            if (typeof authGetUserId !== 'function') return;
            const userId = await authGetUserId();
            if (!userId) return; // non loggato (non dovrebbe succedere in index.html, ma per sicurezza)
            const principale = prefColorePrincipaleGet() || TEMA_COLORE_PRINCIPALE_DEFAULT;
            const secondario = prefColoreSecondarioGet() || TEMA_COLORE_SECONDARIO_DEFAULT;
            try {
                await coloreCorniceProprioSet(principale, secondario);
            } catch (e) {
                console.error('[colore cornice] salvataggio remoto fallito, resta solo locale su questo dispositivo', e);
            }
        }

        // Lettura: chiamata UNA VOLTA all'avvio (vedi window.onload in
        // index.html). Se sul server c'è già un colore salvato (da questo
        // o da un altro dispositivo), sovrascrive il locale — coerente con
        // "il colore non è più per-dispositivo, è dell'utente". Se il
        // server non ha ancora nulla (prima volta), scrive lì il valore
        // locale corrente, così i link pubblici hanno subito qualcosa da
        // mostrare invece di restare sui default per sempre.
        async function sincronizzaColoriConSupabase() {
            if (typeof authGetUserId !== 'function' || typeof coloreCorniceProprioGet !== 'function') return;
            const userId = await authGetUserId();
            if (!userId) return;
            try {
                const { data, error } = await coloreCorniceProprioGet(userId);
                if (error) throw error;
                if (data && data.colore_principale && data.colore_secondario) {
                    prefColorePrincipaleSet(data.colore_principale);
                    prefColoreSecondarioSet(data.colore_secondario);
                    applicaColoriTema();
                } else {
                    // Prima volta per questo utente — semina il server col
                    // valore locale/default corrente.
                    await _salvaColoreCorniceRemoto();
                }
            } catch (e) {
                console.error('[colore cornice] sincronizzazione iniziale fallita, resta il valore locale', e);
            }
        }

        // ── DIAMETRO WIDGET (STEP 3 restyle "cornice Pokédex", 2026-09-17) ──
        const DIAMETRO_WIDGET_DEFAULT = 90;
        const DIAMETRO_WIDGET_MIN = 80;
        const DIAMETRO_WIDGET_MAX = 220;

        function applicaDiametroWidget() {
            const diametro = prefDiametroWidgetGet() || DIAMETRO_WIDGET_DEFAULT;
            document.documentElement.style.setProperty('--ball-misura', diametro + 'px');

            const input = document.getElementById('temaDiametroWidget');
            const valoreEl = document.getElementById('temaDiametroWidgetValore');
            if (input) input.value = diametro;
            if (valoreEl) valoreEl.textContent = diametro + ' px';

            // Cambiare il diametro cambia quante colonne/righe entrano nella
            // pagina (la griglia CSS è auto-fill su var(--ball-misura), vedi
            // index.html) — _misuraPaginaWidget() la rimisura da sola dal DOM
            // ad ogni renderWidgetHome(), quindi basta rifare il render.
            if (typeof renderWidgetHome === 'function' && typeof _layoutWidget !== 'undefined' && _layoutWidget) {
                renderWidgetHome();
            }
        }

        function setDiametroWidget(px) {
            const valore = Math.max(DIAMETRO_WIDGET_MIN, Math.min(DIAMETRO_WIDGET_MAX, parseInt(px, 10) || DIAMETRO_WIDGET_DEFAULT));
            prefDiametroWidgetSet(valore);
            applicaDiametroWidget();
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


