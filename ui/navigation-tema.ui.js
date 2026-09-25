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

        // AGGIORNATO (STEP 11/12 fix, 2026-09-17): il ridisegno vero della
        // Home rigenera SVG animati per ogni widget — su schermi con molti
        // widget farlo ad ogni singolo pixel di trascinamento scatta
        // (Claudio: "concordo col ritardo"). Testo/variabile CSS restano
        // istantanei — solo renderWidgetHome() (pesante) ha questo
        // ritardo, azzerato ad ogni nuovo movimento dello slider. La
        // trasparenza del pannello (Step 12, vedi sotto) resta accesa
        // per tutta la durata del trascinamento + questo stesso ritardo,
        // così l'utente vede la Home vera aggiornarsi prima che il
        // pannello ridiventi opaco.
        let _ritardoRenderDiametro = null;
        const RITARDO_RENDER_DIAMETRO_MS = 150;
        const RITARDO_OPACO_DIAMETRO_MS = 500; // un po' più lungo del render, per dare tempo di vedere il risultato

        // Stima colonne/righe SENZA aspettare il ridisegno vero — calcolata
        // dallo spazio reale di #phoneScreen con la stessa formula
        // dell'auto-fill CSS (spazio disponibile ÷ diametro), non letta dal
        // DOM: deve restare accurata anche quando la griglia vera non si è
        // ancora ridisegnata (per via del ritardo qui sopra) o quando
        // il pannello Impostazioni la copre (trasparente o no).
        function _colonneRigheStimate(diametro) {
            const schermo = document.getElementById('phoneScreen');
            if (!schermo || !schermo.clientWidth) return { colonne: 0, righe: 0 };
            const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
            const gapPx = 0.7 * remPx; // gap: 0.7rem in .widget-griglia
            // Stima del padding di .widget-pagina (0.9rem lati, 1.1rem sopra,
            // 4.5rem sotto per il tasto fisico — vedi CSS) — approssimata,
            // questo è un numero indicativo per l'utente, non un valore
            // preciso al pixel.
            const larghezzaDisponibile = schermo.clientWidth - (1.8 * remPx);
            const altezzaDisponibile = schermo.clientHeight - (5.6 * remPx);
            const colonne = Math.max(1, Math.floor((larghezzaDisponibile + gapPx) / (diametro + gapPx)));
            const righe = Math.max(1, Math.floor((altezzaDisponibile + gapPx) / (diametro + gapPx)));
            return { colonne, righe };
        }

        let _ritardoOpacoDiametro = null;

        function applicaDiametroWidget() {
            const diametro = prefDiametroWidgetGet() || DIAMETRO_WIDGET_DEFAULT;
            document.documentElement.style.setProperty('--ball-misura', diametro + 'px');

            const input = document.getElementById('temaDiametroWidget');
            const valoreEl = document.getElementById('temaDiametroWidgetValore');
            if (input) input.value = diametro;
            if (valoreEl) valoreEl.textContent = diametro + ' px';

            // Testo: SEMPRE istantaneo, mai il ritardo qui sotto.
            const testo = document.getElementById('temaDiametroAnteprimaTesto');
            if (testo) {
                const { colonne, righe } = _colonneRigheStimate(diametro);
                testo.textContent = `Con questa dimensione, per questo dispositivo, ci saranno ${colonne} colonne e ${righe} righe`;
            }

            // STEP 12: rende trasparente il pannello Impostazioni per far
            // vedere la VERA Home (sempre montata sotto, vedi
            // apriDettaglioWidget) aggiornarsi dal vivo — meglio di un
            // cerchio di anteprima disegnato a mano, che Claudio non si
            // fidava rispecchiasse davvero la resa reale.
            const pannello = document.querySelector('.container.container-visibile');
            if (pannello) {
                pannello.classList.add('container-trasparente-diametro');
                clearTimeout(_ritardoOpacoDiametro);
                _ritardoOpacoDiametro = setTimeout(() => {
                    pannello.classList.remove('container-trasparente-diametro');
                }, RITARDO_OPACO_DIAMETRO_MS);
            }

            // Cambiare il diametro cambia quante colonne/righe entrano nella
            // pagina (la griglia CSS è auto-fill su var(--ball-misura), vedi
            // index.html) — _misuraPaginaWidget() la rimisura da sola dal DOM
            // ad ogni renderWidgetHome(). QUESTA chiamata (pesante, rigenera
            // gli SVG di ogni widget) ha il piccolo ritardo di cui sopra.
            clearTimeout(_ritardoRenderDiametro);
            _ritardoRenderDiametro = setTimeout(() => {
                if (typeof renderWidgetHome === 'function' && typeof _layoutWidget !== 'undefined' && _layoutWidget) {
                    renderWidgetHome();
                }
            }, RITARDO_RENDER_DIAMETRO_MS);
        }

        function setDiametroWidget(px) {
            const valore = Math.max(DIAMETRO_WIDGET_MIN, Math.min(DIAMETRO_WIDGET_MAX, parseInt(px, 10) || DIAMETRO_WIDGET_DEFAULT));
            prefDiametroWidgetSet(valore);
            applicaDiametroWidget();
        }


        // ── DIAMETRO BINDER/SCAFFALI + DIAMETRO ACHIEVEMENT (2026-09-18) ────
        // Claudio: "le anteprime dei binder sono troppo piccole" — scollegati
        // da --ball-misura (che resta SOLO quella dei widget Home, invariata
        // sopra — è anche "1 unità" di resize dei widget, non va toccata).
        // Due nuove CSS var isolate: --ball-misura-binder (Binder + Scaffali,
        // Claudio: "uno per binder/scaffali" — un solo slider per entrambi,
        // stessa classe CSS condivisa .binders-contenitori-grid) e
        // --ball-misura-achievement.
        //
        // SEMPLIFICATO rispetto al diametro Widget qui sopra — niente
        // ritardo/trasparenza pannello: quel trucco funziona SOLO per il
        // diametro Widget perché sotto Impostazioni c'è sempre la Home vera
        // montata (apriDettaglioWidget mette ogni pagina, Impostazioni
        // inclusa, in .container SOPRA la Home fissa). Binder/Scaffali/
        // Achievement non sono MAI montati sotto Impostazioni allo stesso
        // tempo, quindi la trasparenza non mostrerebbe nulla di utile.
        // Buona notizia: le loro griglie leggono --ball-misura-binder/
        // -achievement PURAMENTE da CSS (nessun redraw JS pesante, a
        // differenza di renderWidgetHome() che rigenera SVG) — il cambio è
        // già istantaneo appena l'utente apre quella pagina, senza bisogno
        // di nessun trucco (verificato: nuovo+achievement.txt, "colonne
        // dinamiche... zero JS necessario").
        //
        // Persistenza: stesso principio "preferenza per-dispositivo" del
        // diametro Widget, MA scritta qui direttamente via localStorage con
        // chiavi dedicate — non ho letto il file che definisce
        // prefDiametroWidgetGet/Set (probabile wrapper generico pref*) e non
        // volevo aggiungerci funzioni alla cieca senza vederne la struttura
        // (Regola d'Oro #4). Se preferisci che siano centralizzate lì con le
        // altre preferenze, dimmi in che file vivono e le sposto in un giro
        // a sé — funzionalmente identico, cambia solo dove vive il dato.
        const DIAMETRO_BINDER_DEFAULT = 90;
        const DIAMETRO_BINDER_MIN = 80;
        const DIAMETRO_BINDER_MAX = 440;
        const DIAMETRO_ACHIEVEMENT_DEFAULT = 90;
        const DIAMETRO_ACHIEVEMENT_MIN = 80;
        const DIAMETRO_ACHIEVEMENT_MAX = 440;

        const LS_CHIAVE_DIAMETRO_BINDER = 'cardsync_diametro_binder';
        const LS_CHIAVE_DIAMETRO_ACHIEVEMENT = 'cardsync_diametro_achievement';

        function _diametroBinderGet() {
            const v = parseInt(localStorage.getItem(LS_CHIAVE_DIAMETRO_BINDER), 10);
            return Number.isFinite(v) ? v : null;
        }
        function _diametroBinderSet(v) { localStorage.setItem(LS_CHIAVE_DIAMETRO_BINDER, String(v)); }

        function _diametroAchievementGet() {
            const v = parseInt(localStorage.getItem(LS_CHIAVE_DIAMETRO_ACHIEVEMENT), 10);
            return Number.isFinite(v) ? v : null;
        }
        function _diametroAchievementSet(v) { localStorage.setItem(LS_CHIAVE_DIAMETRO_ACHIEVEMENT, String(v)); }

        // Stima SOLO colonne per Binder/Scaffali (niente "righe": a
        // differenza di .widget-griglia/.achievement-grid, .binders-
        // contenitori-grid NON ha grid-auto-rows fisso legato al diametro —
        // l'altezza di ogni tessera segue il contenuto (copertina+nome+
        // conteggio), non una cella quadrata — darei un numero di righe
        // indicativo ma potenzialmente fuorviante, meglio ometterlo che
        // inventarlo).
        function _colonneStimateBinder(diametro) {
            const schermo = document.getElementById('phoneScreen');
            if (!schermo || !schermo.clientWidth) return 0;
            const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
            const gapPx = 1 * remPx; // gap: 1rem in .binders-contenitori-grid
            // Stima del padding di .container (1rem lati — stesso
            // contenitore di Binder/Scaffali E di questo stesso pannello
            // Impostazioni), come per il diametro Widget qui sopra.
            const larghezzaDisponibile = schermo.clientWidth - (2 * remPx);
            return Math.max(1, Math.floor((larghezzaDisponibile + gapPx) / (diametro + gapPx)));
        }

        // Stima colonne E righe per Achievement — QUESTA griglia ha
        // grid-auto-rows fisso al diametro (come i widget Home), quindi qui
        // il conteggio righe è affidabile quanto quello del diametro Widget.
        function _colonneRigheStimateAchievement(diametro) {
            const schermo = document.getElementById('phoneScreen');
            if (!schermo || !schermo.clientWidth) return { colonne: 0, righe: 0 };
            const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
            const gapPx = 0.7 * remPx; // gap: 0.7rem in .achievement-grid
            // Stima del padding di .container (1rem lati, 2.6rem+safe-area
            // sopra, 1rem sotto — stesso contenitore di Achievement E di
            // questo stesso pannello Impostazioni).
            const larghezzaDisponibile = schermo.clientWidth - (2 * remPx);
            const altezzaDisponibile = schermo.clientHeight - (4.6 * remPx);
            const colonne = Math.max(1, Math.floor((larghezzaDisponibile + gapPx) / (diametro + gapPx)));
            const righe = Math.max(1, Math.floor((altezzaDisponibile + gapPx) / (diametro + gapPx)));
            return { colonne, righe };
        }

        function applicaDiametroBinder() {
            const diametro = _diametroBinderGet() || DIAMETRO_BINDER_DEFAULT;
            document.documentElement.style.setProperty('--ball-misura-binder', diametro + 'px');

            const input = document.getElementById('temaDiametroBinder');
            const valoreEl = document.getElementById('temaDiametroBinderValore');
            if (input) input.value = diametro;
            if (valoreEl) valoreEl.textContent = diametro + ' px';

            const testo = document.getElementById('temaDiametroBinderAnteprimaTesto');
            if (testo) {
                const colonne = _colonneStimateBinder(diametro);
                testo.textContent = `Con questa dimensione, per questo dispositivo, ci saranno ${colonne} colonne`;
            }
            // Nessun redraw JS/trasparenza necessario — vedi commento sopra.
        }

        function setDiametroBinder(px) {
            const valore = Math.max(DIAMETRO_BINDER_MIN, Math.min(DIAMETRO_BINDER_MAX, parseInt(px, 10) || DIAMETRO_BINDER_DEFAULT));
            _diametroBinderSet(valore);
            applicaDiametroBinder();
        }

        function applicaDiametroAchievement() {
            const diametro = _diametroAchievementGet() || DIAMETRO_ACHIEVEMENT_DEFAULT;
            document.documentElement.style.setProperty('--ball-misura-achievement', diametro + 'px');

            const input = document.getElementById('temaDiametroAchievement');
            const valoreEl = document.getElementById('temaDiametroAchievementValore');
            if (input) input.value = diametro;
            if (valoreEl) valoreEl.textContent = diametro + ' px';

            const testo = document.getElementById('temaDiametroAchievementAnteprimaTesto');
            if (testo) {
                const { colonne, righe } = _colonneRigheStimateAchievement(diametro);
                testo.textContent = `Con questa dimensione, per questo dispositivo, ci saranno ${colonne} colonne e ${righe} righe`;
            }
            // Nessun redraw JS/trasparenza necessario — vedi commento sopra.
        }

        function setDiametroAchievement(px) {
            const valore = Math.max(DIAMETRO_ACHIEVEMENT_MIN, Math.min(DIAMETRO_ACHIEVEMENT_MAX, parseInt(px, 10) || DIAMETRO_ACHIEVEMENT_DEFAULT));
            _diametroAchievementSet(valore);
            applicaDiametroAchievement();
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
                document.getElementById('themeBtn-verde')?.classList.add('active'); // ?. : bottone rimosso col restyle Pokédex (audit 2026-09-25, B2)
            } else if (themeName === 'pokemon') {
                document.body.classList.add('theme-pokemon');
                document.getElementById('themeBtn-pokemon')?.classList.add('active'); // ?. : bottone rimosso col restyle Pokédex (audit 2026-09-25, B2)
            } else {
                document.getElementById('themeBtn-viola')?.classList.add('active'); // ?. : bottone rimosso col restyle Pokédex (audit 2026-09-25, B2)
            }
        }


