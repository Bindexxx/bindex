// Tema chiaro/scuro, colori, riduci animazioni.

function toggleDarkMode(isDark) {
            prefDarkModeSet(isDark);
            if (isDark) {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }
            applicaColoriTema();
            mandaTemaScuroAEstensione(isDark);
        }

        function applicaColoriTema() {
            const principale = prefColorePrincipaleGet() || TEMA_COLORE_PRINCIPALE_DEFAULT;
            const secondario = prefColoreSecondarioGet() || TEMA_COLORE_SECONDARIO_DEFAULT;
            const scuro = document.body.classList.contains('dark-mode');

            const variabili = derivaVariabiliTema(principale, secondario, scuro);
            Object.entries(variabili).forEach(([nome, valore]) => {
                document.documentElement.style.setProperty(nome, valore);
            });

            const inputPrincipale = document.getElementById('temaColorePrincipale');
            const inputSecondario = document.getElementById('temaColoreSecondario');
            if (inputPrincipale) inputPrincipale.value = principale;
            if (inputSecondario) inputSecondario.value = secondario;

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

        async function _salvaColoreCorniceRemoto() {
            if (typeof authGetUserId !== 'function') return;
            const userId = await authGetUserId();
            if (!userId) return;
            const principale = prefColorePrincipaleGet() || TEMA_COLORE_PRINCIPALE_DEFAULT;
            const secondario = prefColoreSecondarioGet() || TEMA_COLORE_SECONDARIO_DEFAULT;
            try {
                await coloreCorniceProprioSet(principale, secondario);
            } catch (e) {
                console.error('[colore cornice] salvataggio remoto fallito, resta solo locale su questo dispositivo', e);
            }
        }

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
                    await _salvaColoreCorniceRemoto();
                }
            } catch (e) {
                console.error('[colore cornice] sincronizzazione iniziale fallita, resta il valore locale', e);
            }
        }

        const DIAMETRO_WIDGET_DEFAULT = 90;
        const DIAMETRO_WIDGET_MIN = 80;
        const DIAMETRO_WIDGET_MAX = 220;

        let _ritardoRenderDiametro = null;
        const RITARDO_RENDER_DIAMETRO_MS = 150;

        function _colonneRigheStimate(diametro) {
            const schermo = document.getElementById('phoneScreen');
            if (!schermo || !schermo.clientWidth) return { colonne: 0, righe: 0 };
            const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
            const gapPx = 0.7 * remPx;
            const larghezzaDisponibile = schermo.clientWidth - (1.8 * remPx);
            const altezzaDisponibile = schermo.clientHeight - (5.6 * remPx);
            const colonne = Math.max(1, Math.floor((larghezzaDisponibile + gapPx) / (diametro + gapPx)));
            const righe = Math.max(1, Math.floor((altezzaDisponibile + gapPx) / (diametro + gapPx)));
            return { colonne, righe };
        }

        function applicaDiametroWidget() {
            const diametro = prefDiametroWidgetGet() || DIAMETRO_WIDGET_DEFAULT;
            document.documentElement.style.setProperty('--ball-misura', diametro + 'px');

            const input = document.getElementById('temaDiametroWidget');
            const valoreEl = document.getElementById('temaDiametroWidgetValore');
            if (input) input.value = diametro;
            if (valoreEl) valoreEl.textContent = diametro + ' px';

            const testo = document.getElementById('temaDiametroAnteprimaTesto');
            if (testo) {
                const { colonne, righe } = _colonneRigheStimate(diametro);
                testo.textContent = `Con questa dimensione, per questo dispositivo, ci saranno ${colonne} colonne e ${righe} righe`;
            }

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

        function _colonneStimateBinder(diametro) {
            const schermo = document.getElementById('phoneScreen');
            if (!schermo || !schermo.clientWidth) return 0;
            const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
            const gapPx = 1 * remPx;
            const larghezzaDisponibile = schermo.clientWidth - (2 * remPx);
            return Math.max(1, Math.floor((larghezzaDisponibile + gapPx) / (diametro + gapPx)));
        }

        function _colonneRigheStimateAchievement(diametro) {
            const schermo = document.getElementById('phoneScreen');
            if (!schermo || !schermo.clientWidth) return { colonne: 0, righe: 0 };
            const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
            const gapPx = 0.7 * remPx;
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
        }

        function setDiametroAchievement(px) {
            const valore = Math.max(DIAMETRO_ACHIEVEMENT_MIN, Math.min(DIAMETRO_ACHIEVEMENT_MAX, parseInt(px, 10) || DIAMETRO_ACHIEVEMENT_DEFAULT));
            _diametroAchievementSet(valore);
            applicaDiametroAchievement();
        }

        function _animazioniRidotte() {
            return prefRiduciAnimazioniGet();
        }

        function toggleRiduciAnimazioni(ridotte) {
            prefRiduciAnimazioniSet(ridotte);
            if (typeof _ballApplicaClasseAnimazioni === 'function') _ballApplicaClasseAnimazioni();
            if (typeof renderWidgetHome === 'function' && typeof _layoutWidget !== 'undefined' && _layoutWidget) renderWidgetHome();
        }

        function setSiteTheme(themeName) {
            prefSiteThemeSet(themeName);
            document.body.classList.remove('theme-verde', 'theme-pokemon');
            ['themeBtn-viola', 'themeBtn-verde', 'themeBtn-pokemon'].forEach(id => document.getElementById(id)?.classList.remove('active'));

            if (themeName === 'verde') {
                document.body.classList.add('theme-verde');
                document.getElementById('themeBtn-verde')?.classList.add('active');
            } else if (themeName === 'pokemon') {
                document.body.classList.add('theme-pokemon');
                document.getElementById('themeBtn-pokemon')?.classList.add('active');
            } else {
                document.getElementById('themeBtn-viola')?.classList.add('active');
            }
        }
