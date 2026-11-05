// Navigazione principale: schede e menu.

function handleChangelogClick() {
            changelogClicks++;
            if (changelogClicks >= 3) {
                document.getElementById('bulbasaurModal').style.display = 'flex';
                changelogClicks = 0;
            }
        }

        function closeBulbasaurModal() {
            document.getElementById('bulbasaurModal').style.display = 'none';
        }

        function openDrawer() {
            document.getElementById('drawerOverlay').classList.add('open');
            document.getElementById('sidebar').classList.add('open');
        }

        function closeDrawer() {
            document.getElementById('drawerOverlay').classList.remove('open');
            document.getElementById('sidebar').classList.remove('open');
        }

        function _applicaStatoSidebarCompressa(compressa) {
            document.body.classList.toggle('sidebar-collapsed', compressa);
            const icona = document.getElementById('sidebarCollapseIcon');
            if (icona) icona.className = compressa ? 'fa-solid fa-angles-right' : 'fa-solid fa-angles-left';
        }

        function toggleSidebarCollapse() {
            const compressa = !document.body.classList.contains('sidebar-collapsed');
            _applicaStatoSidebarCompressa(compressa);
            prefSidebarCompressaSet(compressa);
        }
        _applicaStatoSidebarCompressa(prefSidebarCompressaGet());

        function switchTab(tabId, element) {
            currentMode = tabId;
            highlightedRowId = null;

            prefActiveTabSet(tabId);

            document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
            document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
            document.querySelectorAll('.drawer-item').forEach(item => item.classList.remove('active'));

            document.getElementById('visualizzazione').classList.add('active');

            if (typeof caricaProdottiSealedReali === 'function') {
                caricaProdottiSealedReali().then(() => { if (currentMode === tabId) filterTable(); }).catch(() => {});
            }

            if (element) element.classList.add('active');
            const mobileBtn = document.getElementById(`mNav-${tabId}`);
            if (mobileBtn) mobileBtn.classList.add('active');
            closeDrawer();

            document.getElementById('rigaToggleTipo').style.display = tabId === 'visualizzazione' ? 'flex' : 'none';

            const pannelloMatch = document.getElementById('pannelloMatch');
            if (tabId === 'scambio' || tabId === 'wishlist') {
                pannelloMatch.style.display = 'block';
                caricaMatch(tabId);
            } else {
                pannelloMatch.style.display = 'none';
            }

            const qrBtn = document.getElementById('btnShowQrCode');
            const locFilter = document.getElementById('filterLocation');

            if (tabId === 'scambio') {
                qrBtn.style.display = 'inline-flex';
                locFilter.value = '';
                locFilter.disabled = true;
                document.getElementById('statLabelCount').innerText = 'In Scambio';
            } else if (tabId === 'wishlist') {
                qrBtn.style.display = 'inline-flex';
                locFilter.value = '';
                locFilter.disabled = true;
                document.getElementById('statLabelCount').innerText = 'In Wishlist';
            } else if (tabId === 'sealed') {
                qrBtn.style.display = 'none';
                locFilter.value = '';
                locFilter.disabled = false;
                document.getElementById('statLabelCount').innerText = 'Sealed';
            } else {
                qrBtn.style.display = 'none';
                locFilter.value = '';
                locFilter.disabled = false;
                document.getElementById('statLabelCount').innerText = 'Carte Totali';
            }

            if (tabId === 'inserimento' || tabId === 'prezzi' || tabId === 'impostazioni' || tabId === 'binder' || tabId === 'home') {
                document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
                document.getElementById(tabId).classList.add('active');
                if (tabId === 'prezzi' && !_locationCaricate) caricaListaLocationCheckbox();
                if (tabId === 'prezzi' && typeof prezziCaricaControlli === 'function') prezziCaricaControlli();
                if (tabId === 'prezzi' && !_scaffaliSealedCaricati) caricaListaScaffaliCheckboxSealed();
                if (tabId === 'inserimento' && !_locationComuneCaricata) caricaSelectLocationComune();
                if (tabId === 'inserimento') caricaCarteConProblemi();
                if (tabId === 'binder') {   }
                if (tabId === 'home') { caricaAvvisiHome(); caricaUltimaSincronizzazioneHome(); caricaAttivitaRecentiHome(); renderBinderInPrimoPianoHome(); }
            } else {
                filterTable();
            }
        }
