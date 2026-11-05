// Link pubblico e QR.

function _paginaPubblicaBinderAttivo() {
            const binder = (typeof _bindersElenco !== 'undefined' && Array.isArray(_bindersElenco))
                ? _bindersElenco.find(b => String(b.id) === String(_binderAttivo))
                : null;
            if (!binder) return null;
            if (binder.stato_pubblicazione === 'pubblico') return { pagina: 'binder-pubblico.html', binderId: binder.id, tipo: binder.tipo };
            return null;
        }

        function _paginaPubblicaScaffaleAttivo() {
            const scaffale = (typeof _scaffaliElenco !== 'undefined' && Array.isArray(_scaffaliElenco))
                ? _scaffaliElenco.find(s => String(s.id) === String(_scaffaleAttivo))
                : null;
            if (!scaffale) return null;
            if (scaffale.stato_pubblicazione === 'pubblico') return { pagina: 'scaffali-pubblico.html', scaffaleId: scaffale.id };
            return null;
        }

        async function _linkPubblicoCondivisione() {
            const sessione = await authGetSession();
            const userId = sessione?.user?.id;
            if (!userId) return null;
            let pagina, binderIdExtra, tipoBinderExtra, scaffaleIdExtra;
            if (currentMode === 'binder') {
                const target = _paginaPubblicaBinderAttivo();
                if (!target) return null;
                pagina = target.pagina;
                binderIdExtra = target.binderId;
                tipoBinderExtra = target.tipo;
            } else if (currentMode === 'scaffali') {
                const target = _paginaPubblicaScaffaleAttivo();
                if (!target) return null;
                pagina = target.pagina;
                scaffaleIdExtra = target.scaffaleId;
            } else if (currentMode === 'scambio') {
                if (!_binderScambioId) return null;
                pagina = 'binder-pubblico.html';
                binderIdExtra = _binderScambioId;
                tipoBinderExtra = 'scambio';
            } else {
                pagina = currentMode === 'wishlist' ? 'wishlist.html' : 'sealed.html';
            }
            const url = new URL(pagina + '?u=' + encodeURIComponent(userId), window.location.href);
            if (binderIdExtra) url.searchParams.set('binder', binderIdExtra);
            if (scaffaleIdExtra) url.searchParams.set('scaffale', scaffaleIdExtra);
            const temaSalvato = prefSiteThemeGet();
            if (temaSalvato) url.searchParams.set('tema', temaSalvato);
            if (prefDarkModeGet()) url.searchParams.set('scuro', '1');
            if ((pagina === 'wishlist.html' || tipoBinderExtra === 'wishlist') && sessione?.user?.id) {
                try {
                    const { data: pref } = await userSettingsGet(sessione.user.id);
                    const nick = pref && pref.nickname ? String(pref.nickname).trim() : '';
                    if (nick) url.searchParams.set('nome', nick);
                } catch (e) { console.error('[condivisione] nickname:', e); }
            }
            return url.href;
        }

        async function copyShareLink() {
            const link = await _linkPubblicoCondivisione();
            if (!link) { mostraAvviso('Devi essere loggato per generare il link.'); return; }
            try {
                await navigator.clipboard.writeText(link);
                mostraAvviso('Link copiato negli appunti!');
            } catch (e) {
                await chiediTesto({ titolo: 'Copia il link', testo: 'Selezionalo e copialo:', valore: link, conferma: 'Fatto', annulla: 'Chiudi' });
            }
        }

        async function openQrModal() {
            const link = await _linkPubblicoCondivisione();
            if (!link) { mostraAvviso('Devi essere loggato per generare il QR.'); return; }
            const modal = document.getElementById('qrModal');
            const container = document.getElementById('qrcodeContainer');
            container.innerHTML = '';
            new QRCode(container, {
                text: link,
                width: 180,
                height: 180,
                colorDark : "#2a2438",
                colorLight : "#ffffff"
            });
            document.getElementById('btnCondividiNativo').style.display = navigator.share ? 'flex' : 'none';
            modal.style.display = 'flex';
        }

        function closeQrModal() {
            document.getElementById('qrModal').style.display = 'none';
        }

        async function apriAnteprimaLinkCondiviso() {
            const link = await _linkPubblicoCondivisione();
            if (!link) { mostraAvviso('Devi essere loggato per generare l\'anteprima.'); return; }
            window.open(link, '_blank');
        }

        async function condividiLinkNativo() {
            const link = await _linkPubblicoCondivisione();
            if (!link) { mostraAvviso('Devi essere loggato per condividere il link.'); return; }
            try {
                await navigator.share({ title: 'Bindex', url: link });
            } catch (e) {
            }
        }
