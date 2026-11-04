// Visualizzatore di immagini (apre la carta girata a schermo intero).

function apriImmagineIngrandita(id) {
            apriFlipCardHome(id);
        }

        function chiudiImmagineIngrandita() {
            document.getElementById('immagineModal').style.display = 'none';
            document.getElementById('flipCardScene').style.display = 'none';
            if (_flipCardTimeout) { clearTimeout(_flipCardTimeout); _flipCardTimeout = null; }
            document.getElementById('immagineModalContent').classList.remove('modal-content-flip-fullscreen');
            document.body.style.overflow = '';
            const _m = document.getElementById('immagineModal');
            if (_m && _m.classList.contains('flip-in-cornice')) {
                _m.classList.remove('flip-in-cornice');
                ['top', 'left', 'width', 'height', 'right', 'bottom'].forEach(k => { _m.style[k] = ''; });
            }
        }

        const _cacheSleeveBinder = new Map();
        const _TTL_SLEEVE_MS = 50 * 60 * 1000;

        async function _sleeveDelBinder(userId, binderId) {
            const inCache = _cacheSleeveBinder.get(binderId);
            if (inCache && inCache.scadenza > Date.now()) return inCache;

            const { data: media, error } = await userMediaGet(userId, binderId, 'card_back');
            if (error || !media) {
                const vuota = { url: null, metadata: null, scadenza: Date.now() + _TTL_SLEEVE_MS };
                _cacheSleeveBinder.set(binderId, vuota);
                return vuota;
            }

            let url = null;
            if (media.source === 'default') {
                const { data: pub } = storageDefaultAssetPublicUrl(media.storage_path);
                url = pub?.publicUrl || null;
            } else {
                const { data: signed } = await storageSignedUrlUserMedia(media.storage_path);
                url = signed?.signedUrl || null;
            }

            const risolta = { url, metadata: media.metadata || null, scadenza: Date.now() + _TTL_SLEEVE_MS };
            _cacheSleeveBinder.set(binderId, risolta);
            return risolta;
        }

        function _binderDiAppartenenzaSeNoto(card) {
            if (!Array.isArray(_bindersElenco) || _bindersElenco.length === 0) return null;
            if (card.stato === 'wishlist') {
                const wl = _bindersElenco.find(b => b.tipo === 'wishlist');
                return wl ? wl.id : null;
            }
            if (!card.location) return null;
            const loc = _bindersElenco.find(b => b.tipo === 'location' && b.location_valore === card.location);
            return loc ? loc.id : null;
        }

        function _cbdScriviTesto(chiave, testo) {
            const el = document.getElementById('cbdText-' + chiave);
            if (el) el.textContent = testo;
        }

        function _cbdAdattaScala() {
            const wrap = document.getElementById('cbdWrap');
            const stage = document.getElementById('cbdStage');
            if (!wrap || !stage || wrap.clientWidth === 0) return;
            stage.style.transform = `scale(${wrap.clientWidth / CARD_BACK_W})`;
        }

        window.addEventListener('resize', () => {
            const wrap = document.getElementById('cbdWrap');
            if (wrap && wrap.style.display !== 'none') _cbdAdattaScala();
        });

        async function renderRetroCartaOwner(card, binderId) {
            const wrap = document.getElementById('cbdWrap');
            const infoWrap = document.getElementById('flipCardInfoWrap');
            if (!wrap || !card) return;

            wrap.style.display = 'none';
            if (infoWrap) infoWrap.style.display = 'flex';

            const idBinder = binderId || _binderDiAppartenenzaSeNoto(card);
            if (!idBinder) return;

            const userId = await authGetUserId();
            if (!userId) return;

            const sleeve = await _sleeveDelBinder(userId, idBinder);
            if (!sleeve.url) return;

            document.getElementById('cbdBgImg').src = sleeve.url;

            _cbdScriviTesto('pokemon', card.name || '');
            _cbdScriviTesto('condition', card.cond || '');
            _cbdScriviTesto('variazione', card.variation || '—');
            _cbdScriviTesto('price', formattaEuro(card.price));

            const posizioni = (sleeve.metadata && typeof sleeve.metadata === 'object') ? sleeve.metadata : DEFAULT_STATE_CARD_BACK;
            Object.keys(DEFAULT_STATE_CARD_BACK).forEach(chiave => {
                const campo = document.getElementById('cbdField-' + chiave);
                if (!campo) return;
                const s = posizioni[chiave] || DEFAULT_STATE_CARD_BACK[chiave];
                campo.style.left = s.left + '%';
                campo.style.top = s.top + '%';
                const contenuto = campo.querySelector('.cbd-field-content');
                if (contenuto) contenuto.style.transform = `scale(${s.scale != null ? s.scale : 1})`;
            });

            wrap.style.display = 'block';
            if (infoWrap) infoWrap.style.display = 'none';
            _cbdAdattaScala();
            requestAnimationFrame(_cbdAdattaScala);
        }

        function apriUrlIngrandito(url) {
            document.getElementById('immagineErroreMsg').style.display = 'none';
            document.getElementById('flipCardScene').style.display = 'none';
            document.getElementById('immagineModalContent').classList.remove('modal-content-flip-fullscreen');
            document.body.style.overflow = '';
            const img = document.getElementById('immagineIngranditaImg');
            img.style.display = '';
            img.src = url;
            document.getElementById('immagineModal').style.display = 'flex';
        }
