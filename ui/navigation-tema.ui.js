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
        }

        function setColoreSecondario(hex) {
            prefColoreSecondarioSet(hex);
            applicaColoriTema();
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


