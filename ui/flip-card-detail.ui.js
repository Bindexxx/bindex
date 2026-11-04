// Dettaglio della carta a schermo intero (girata) e doppioni.

function apriFlipCardHome(id, opzioni = {}) {
            const card = carteReali.find(c => String(c.id) === String(id));
            if (!card) return;

            const _vecchia = (() => {
                if (!card.createdAt) return false;
                const d = new Date(card.createdAt);
                const oggi = new Date();
                return d.getFullYear() !== oggi.getFullYear() || d.getMonth() !== oggi.getMonth() || d.getDate() !== oggi.getDate();
            })();
            (async () => {
                try {
                    const userId = await authGetUserId();
                    if (userId) await missioniDettaglioCartaRegistra(userId, card.id, opzioni.origine, _vecchia);
                } catch (e) { console.error('[missioni] registrazione apertura dettaglio carta:', e); }
            })();

            document.getElementById('immagineModalContent').classList.add('modal-content-flip-fullscreen');
            document.body.style.overflow = 'hidden';
            document.getElementById('immagineErroreMsg').style.display = 'none';
            document.getElementById('immagineIngranditaImg').style.display = 'none';
            const scena = document.getElementById('flipCardScene');
            scena.style.display = 'flex';
            scena.style.marginTop = '0';

            const inner = document.getElementById('flipCardInner');
            inner.classList.remove('flipped');

            const frontImg = document.getElementById('flipCardFrontImg');
            frontImg.style.display = '';
            frontImg.src = card.immagine ? (_urlImmagineVisualizzabile(card.immagine, 300) || '') : '';
            if (!card.immagine) frontImg.style.display = 'none';

            document.getElementById('flipCardStats').innerHTML = `
                <div class="pg-testo">
                    <b>${escapeHtml(card.name || '')}</b>
                    <span><code style="background:none; color:inherit; padding:0;">${escapeHtml(String(card.code || '').replace(/\s+/g, ' ').trim())}</code> · ${escapeHtml(card.location || '—')}</span>
                </div>
            `;
            const prezzoTesto = formattaEuro(card.price);
            document.getElementById('flipCardStatBoxes').innerHTML = `
                <div><b>${prezzoTesto}</b><span>Prezzo</span></div>
                <div><b>${card.cond ? escapeHtml(card.cond) : '—'}</b><span>Condizione</span></div>
            `;
            const btnVaiAlBinder = document.getElementById('flipCardBinderBtn');
            btnVaiAlBinder.style.display = opzioni.nascondiVaiAlBinder ? 'none' : '';
            btnVaiAlBinder.onclick = (e) => { e.stopPropagation(); vaiAllaCartaNelBinder(card.id); };
            renderRetroCartaOwner(card, opzioni.binderId || null);
            if (typeof fotoRealiInFlipCard === 'function') fotoRealiInFlipCard(card).catch(e => console.warn('[foto] carta:', e));
            if (typeof shopApplicaAllaCarta === 'function') shopApplicaAllaCarta(card);

            const btnDoppione = document.getElementById('flipCardGestisciDoppioneBtn');
            const sceltaDoppione = document.getElementById('flipCardDoppioneScelta');
            sceltaDoppione.style.display = 'none';
            sceltaDoppione.innerHTML = '';
            btnDoppione.style.display = opzioni.doppione ? '' : 'none';
            btnDoppione.onclick = (e) => { e.stopPropagation(); _mostraSceltaGestisciDoppione(card.id); };

            document.getElementById('immagineModal').style.display = 'flex';
            _flipCardInCornice();

            if (_flipCardTimeout) clearTimeout(_flipCardTimeout);
            _flipCardTimeout = setTimeout(() => inner.classList.add('flipped'), 500);
        }

        function _mostraSceltaGestisciDoppione(cardId) {
            const btn = document.getElementById('flipCardGestisciDoppioneBtn');
            const scelta = document.getElementById('flipCardDoppioneScelta');
            btn.style.display = 'none';
            scelta.style.display = 'flex';
            scelta.innerHTML = `
                <button onclick="event.stopPropagation(); _doppioneSpostaInScambio('${cardId}')"><i class="fa-solid fa-right-left"></i> Sposta in Scambio</button>
                <button onclick="event.stopPropagation(); _doppioneApriModifica('${cardId}')"><i class="fa-solid fa-pen"></i> Modifica carta</button>
            `;
        }

        function _doppioneSpostaInScambio(cardId) {
            chiudiImmagineIngrandita();
            if (typeof apriModaleQuantitaScambio === 'function') apriModaleQuantitaScambio(cardId);
        }

        function _doppioneApriModifica(cardId) {
            chiudiImmagineIngrandita();
            if (typeof apriModificaCarta === 'function') apriModificaCarta(cardId);
        }

        function toggleFlipCard() {
            document.getElementById('flipCardInner').classList.toggle('flipped');
        }

        async function vaiAllaCartaNelBinder(cardId) {
            chiudiImmagineIngrandita();
            const card = carteReali.find(c => String(c.id) === String(cardId));
            if (!card) return;

            await apriDettaglioWidget('binder', null);

            const idBinder = _binderDiAppartenenzaSeNoto(card);
            if (!idBinder) return;

            await apriBinderDettaglio(idBinder);

            const layout = BINDER_LAYOUTS[_binderLayout] || BINDER_LAYOUTS['3x3'];
            const perPagina = layout.cols * layout.rows;
            const indice = _carteBinderAttivoCache.findIndex(c => String(c.id) === String(cardId));
            _binderPagina = indice >= 0 ? Math.floor(indice / perPagina) : 0;
            renderBinderContenuto();
        }

        function _flipCardInCornice() {
            const modale = document.getElementById('immagineModal');
            const contenuto = document.getElementById('immagineModalContent');
            const schermo = document.getElementById('phoneScreen');
            if (!modale || !contenuto || !schermo || window.innerWidth >= 700) return;
            const r = schermo.getBoundingClientRect();
            if (r.width < 200 || r.height < 300) return;
            const barra = document.querySelector('.csb-bar');
            const rb = barra ? barra.getBoundingClientRect() : null;
            const alto = rb && rb.height ? Math.max(r.top, rb.bottom) : r.top;
            const altezza = r.bottom - alto;
            Object.assign(modale.style, { top: alto + 'px', left: r.left + 'px', width: r.width + 'px', height: altezza + 'px', right: 'auto', bottom: 'auto' });
            modale.classList.add('flip-in-cornice');
            contenuto.style.setProperty('--fc-altezza', altezza + 'px');
        }
