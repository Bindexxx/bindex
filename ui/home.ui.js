// Home: statistiche, avvisi, attività recenti.

function aggiornaStatCardHome() {
            const collezione = carteReali.filter(c => c.stato === 'collezione');
            const totalQty = collezione.reduce((somma, c) => somma + (c.qty || 0), 0);
            const totalSum = collezione.filter(c => !c.esclusoValore).reduce((somma, c) => somma + (c.price || 0) * (c.qty || 0), 0);
            const elCount = document.getElementById('stat-count-home');
            const elValue = document.getElementById('stat-value-home');
            if (elCount) elCount.innerText = totalQty;
            if (elValue) elValue.innerText = formattaEuro(totalSum);
        }

        async function _ultimoControlloPerCarta(idsCollezione) {
            if (idsCollezione.length === 0) return {};
            const DIMENSIONE_BLOCCO = 500;
            const blocchi = [];
            for (let i = 0; i < idsCollezione.length; i += DIMENSIONE_BLOCCO) {
                blocchi.push(idsCollezione.slice(i, i + DIMENSIONE_BLOCCO));
            }

            const risultati = await Promise.all(blocchi.map(blocco =>
                storicoPrezziQuery('carte', blocco)
            ));

            const ultimoPerCarta = {};
            risultati.forEach(({ data, error }) => {
                if (error) { console.error('Errore lettura storico_prezzi:', error.message); return; }
                (data || []).forEach(r => {
                    if (!ultimoPerCarta[r.carta_id]) ultimoPerCarta[r.carta_id] = r.registrato_il;
                });
            });
            return ultimoPerCarta;
        }

        let _contaCodaErroriRecente = null;
        function _contaCodaErrori() {
            const adesso = Date.now();
            if (_contaCodaErroriRecente && adesso - _contaCodaErroriRecente.quando < 3000) return _contaCodaErroriRecente.promessa;
            const promessa = _contaCodaErroriDalDb();
            _contaCodaErroriRecente = { quando: adesso, promessa };
            return promessa;
        }

        async function _contaCodaErroriDalDb() {
            const userId = await authGetUserId();
            if (!userId) return 0;

            const { count, error } = await correzioniManualiConta(userId);

            if (error) { console.error('Errore conteggio coda con errori:', error.message); return 0; }
            return count || 0;
        }

        async function _dispositiviAttiviOra() {
            if (!(await authGetUserId())) return false;

            const { data, error } = await claimGruppoStato();

            if (error) { console.error('Errore lettura dispositivi attivi:', error.message); return false; }
            return (data || []).length > 0;
        }

        let _formatoDataAvvisiHomeCache = null;
        function _formatoDataAvvisiHome() {
            if (!_formatoDataAvvisiHomeCache) _formatoDataAvvisiHomeCache = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
            return _formatoDataAvvisiHomeCache;
        }

        let _avvisiHomeInCorso = null;
        let _avvisiHomeDaRifare = false;
        function caricaAvvisiHome() {
            if (_avvisiHomeInCorso) { _avvisiHomeDaRifare = true; return _avvisiHomeInCorso; }
            _avvisiHomeInCorso = (async () => {
                try {
                    do { _avvisiHomeDaRifare = false; await _caricaAvvisiHomeOra(); } while (_avvisiHomeDaRifare);
                } finally {
                    _avvisiHomeInCorso = null;
                }
            })();
            return _avvisiHomeInCorso;
        }

        async function _caricaAvvisiHomeOra() {
            const collezione = carteReali.filter(c => c.stato === 'collezione');
            const idsCollezione = collezione.map(c => c.id);

            const [ultimoPerCarta, codaErrori, qualcunoAlLavoro] = await Promise.all([
                _ultimoControlloPerCarta(idsCollezione),
                _contaCodaErrori(),
                _dispositiviAttiviOra(),
            ]);

            const sogliaMs = SOGLIA_GIORNI_PREZZO_SCADUTO * 24 * 60 * 60 * 1000;
            const adesso = Date.now();
            const carteDaAggiornare = collezione.filter(c => {
                const ultimo = ultimoPerCarta[c.id];
                if (!ultimo) return true;
                return (adesso - new Date(ultimo).getTime()) > sogliaMs;
            });

            _elencoPrezziScaduti = carteDaAggiornare.map(c => ({
                name: c.name,
                code: c.code,
                immagine: c.immagine,
                ultimoTesto: ultimoPerCarta[c.id]
                    ? _formatoDataAvvisiHome().format(new Date(ultimoPerCarta[c.id]))
                    : 'mai controllata',
            }));

            const wishlistSottoTarget = carteReali.filter(c =>
                c.tabella === 'wishlist' && c.prezzoObiettivo != null && c.price > 0 && c.price <= c.prezzoObiettivo
            );

            _renderAvvisiHome({ prezziScaduti: carteDaAggiornare.length, codaErrori, wishlistSottoTarget: wishlistSottoTarget.length, qualcunoAlLavoro });
        }

        function _renderAvvisiHome({ prezziScaduti, codaErrori, wishlistSottoTarget, qualcunoAlLavoro }) {
            const contenitore = document.getElementById('avvisiHomeLista');
            if (!contenitore) return;

            const voci = [];
            if (codaErrori > 0) {
                voci.push(`
                    <div style="display:flex; align-items:center; gap:0.7rem; padding:0.7rem 0; border-bottom:1px solid var(--border-color);">
                        <i class="fa-solid fa-circle-exclamation" style="color:var(--danger); font-size:1.1rem;"></i>
                        <span style="font-size:0.88rem;"><strong>${codaErrori}</strong> cart${codaErrori === 1 ? 'a' : 'e'} in coda ${codaErrori === 1 ? 'ha' : 'hanno'} dato errore durante l'inserimento — vai su Inserimento per correggerl${codaErrori === 1 ? 'a' : 'e'}</span>
                    </div>`);
            }
            if (wishlistSottoTarget > 0) {
                voci.push(`
                    <div style="display:flex; align-items:center; gap:0.7rem; padding:0.7rem 0; border-bottom:1px solid var(--border-color);">
                        <i class="fa-solid fa-bullseye" style="color:var(--success); font-size:1.1rem;"></i>
                        <span style="font-size:0.88rem;"><strong>${wishlistSottoTarget}</strong> cart${wishlistSottoTarget === 1 ? 'a' : 'e'} in wishlist ${wishlistSottoTarget === 1 ? 'è scesa' : 'sono scese'} sotto il prezzo obiettivo 🎯</span>
                    </div>`);
            }
            if (prezziScaduti > 0) {
                voci.push(`
                    <div style="display:flex; align-items:center; gap:0.7rem; padding:0.7rem 0; border-bottom:1px solid var(--border-color); cursor:pointer;" onclick="apriModalePrezziScaduti()" title="Clicca per vedere l'elenco">
                        <i class="fa-solid fa-clock-rotate-left" style="color:var(--danger); font-size:1.1rem;"></i>
                        <span style="font-size:0.88rem;"><strong>${prezziScaduti}</strong> cart${prezziScaduti === 1 ? 'a ha' : 'e hanno'} il prezzo da aggiornare (mai controllat${prezziScaduti === 1 ? 'a' : 'e'} o scadut${prezziScaduti === 1 ? 'o' : 'i'} da più di ${SOGLIA_GIORNI_PREZZO_SCADUTO} giorni)</span>
                        <i class="fa-solid fa-chevron-right" style="margin-left:auto; color:var(--text-muted); font-size:0.75rem;"></i>
                    </div>`);
            }
            if (qualcunoAlLavoro) {
                voci.push(`
                    <div style="display:flex; align-items:center; gap:0.7rem; padding:0.7rem 0; border-bottom:1px solid var(--border-color);">
                        <i class="fa-solid fa-desktop" style="color:var(--primary); font-size:1.1rem;"></i>
                        <span style="font-size:0.88rem;">👋 Ciao Bill! Un dispositivo del gruppo sta facendo i calcoli in questo momento.</span>
                    </div>`);
            }

            const sezione = document.getElementById('sezioneAvvisiHome');
            if (voci.length === 0) {
                sezione.style.display = 'none';
                return;
            }
            sezione.style.display = '';
            contenitore.innerHTML = voci.join('');
        }

        function toggleAttivitaRecentiHome(headerEl) {
            headerEl.closest('.home-activity-panel').classList.toggle('collassato');
        }

        async function _ultimiPrezziAggiornati(idsCollezione, limite) {
            if (idsCollezione.length === 0) return [];
            const DIMENSIONE_BLOCCO = 500;
            const blocchi = [];
            for (let i = 0; i < idsCollezione.length; i += DIMENSIONE_BLOCCO) {
                blocchi.push(idsCollezione.slice(i, i + DIMENSIONE_BLOCCO));
            }

            const risultati = await Promise.all(blocchi.map(blocco =>
                storicoPrezziQuery('carte', blocco, { limite })
            ));

            let tutte = [];
            risultati.forEach(({ data, error }) => {
                if (error) { console.error('Errore lettura ultimi prezzi aggiornati:', error.message); return; }
                tutte = tutte.concat(data || []);
            });

            return tutte
                .sort((a, b) => new Date(b.registrato_il) - new Date(a.registrato_il))
                .slice(0, limite);
        }

        let _attivitaHomeInCorso = null;
        let _attivitaHomeDaRifare = false;
        function caricaAttivitaRecentiHome() {
            if (_attivitaHomeInCorso) { _attivitaHomeDaRifare = true; return _attivitaHomeInCorso; }
            _attivitaHomeInCorso = (async () => {
                try {
                    do { _attivitaHomeDaRifare = false; await _caricaAttivitaRecentiHomeOra(); } while (_attivitaHomeDaRifare);
                } finally {
                    _attivitaHomeInCorso = null;
                }
            })();
            return _attivitaHomeInCorso;
        }

        async function _caricaAttivitaRecentiHomeOra() {
            const elAggiunte = document.getElementById('attivitaCarteAggiunteHome');
            const elPrezzi = document.getElementById('attivitaPrezziAggiornatiHome');
            if (!elAggiunte || !elPrezzi) return;

            const collezione = carteReali.filter(c => c.stato === 'collezione');
            const idsCollezione = collezione.map(c => c.id);

            const ultimeAggiunte = collezione
                .slice()
                .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
                .slice(0, NUMERO_ATTIVITA_RECENTI);

            elAggiunte.innerHTML = ultimeAggiunte.length === 0
                ? '<p style="text-align:center; color:var(--text-muted); font-size:0.8rem; padding:0.5rem 0;">Nessuna carta ancora.</p>'
                : ultimeAggiunte.map(c => `
                    <div class="home-activity-row" style="display:flex; justify-content:space-between; align-items:center; padding:0.4rem 0; border-bottom:1px solid var(--border-color); font-size:0.82rem;">
                        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(c.name)}</span>
                        <span style="color:var(--text-muted); font-size:0.72rem; flex-shrink:0; margin-left:0.5rem;">${c.createdAt ? new Date(c.createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) : '—'}</span>
                    </div>`).join('');

            const ultimiPrezzi = await _ultimiPrezziAggiornati(idsCollezione, NUMERO_ATTIVITA_RECENTI);
            const righePrezzi = ultimiPrezzi
                .map(r => ({ evento: r, card: collezione.find(c => String(c.id) === String(r.carta_id)) }))
                .filter(x => x.card);

            elPrezzi.innerHTML = righePrezzi.length === 0
                ? '<p style="text-align:center; color:var(--text-muted); font-size:0.8rem; padding:0.5rem 0;">Nessun controllo prezzi ancora.</p>'
                : righePrezzi.map(({ evento, card }) => `
                    <div class="home-activity-row" style="display:flex; justify-content:space-between; align-items:center; padding:0.4rem 0; border-bottom:1px solid var(--border-color); font-size:0.82rem;">
                        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(card.name)} <span style="color:var(--text-muted);">${escapeHtml(card.variation)}</span></span>
                        <span style="color:var(--text-muted); font-size:0.72rem; flex-shrink:0; margin-left:0.5rem;">${new Date(evento.registrato_il).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}</span>
                    </div>`).join('');
        }

        function renderBinderInPrimoPianoHome() {
            const container = document.getElementById('binderInPrimoPianoHome');
            if (!container) return;

            const carteSingole = carteReali.filter(c => c.stato === 'collezione' && c.tipo !== 'sealed');

            const perValore = carteSingole.slice().sort((a, b) => b.price - a.price).slice(0, 3);
            const conVariazione = carteSingole.filter(c => c.variazioneNumerica != null);
            const perOscillazionePositiva = conVariazione.filter(c => c.variazioneNumerica > 0).sort((a, b) => b.variazioneNumerica - a.variazioneNumerica).slice(0, 3);
            const perOscillazioneNegativa = conVariazione.filter(c => c.variazioneNumerica < 0).sort((a, b) => a.variazioneNumerica - b.variazioneNumerica).slice(0, 3);

            const renderMiniatura = (c) => `
                <div class="home-featured-thumb" onclick="apriFlipCardHome('${String(c.id).replace(/'/g, "\\'")}')" title="${(c.name || '').replace(/"/g, '&quot;')} — clicca per i dettagli" style="cursor:pointer; width:64px; flex-shrink:0;">
                    <div class="home-featured-thumb-box" style="width:64px; height:90px; border-radius:8px; overflow:hidden; background:var(--bg-color); display:flex; align-items:center; justify-content:center; border:1px solid var(--border-color);">
                        ${c.immagine ? `<img src="${_urlImmagineVisualizzabile(c.immagine, 128)}" alt="" style="width:100%; height:100%; object-fit:cover;" onerror="this.remove();">` : `<i class="fa-solid fa-image" style="color:var(--text-muted);"></i>`}
                    </div>
                </div>`;

            const renderGruppo = (titolo, icona, colore, carte) => `
                <div class="home-featured-group">
                    <div class="home-featured-title" style="font-size:0.78rem; font-weight:700; color:var(--text-muted); margin-bottom:0.5rem;"><i class="fa-solid ${icona}" style="color:${colore};"></i> ${titolo}</div>
                    ${carte.length === 0
                        ? '<p style="font-size:0.75rem; color:var(--text-muted);">— nessun dato ancora</p>'
                        : `<div class="home-featured-row" style="display:flex; gap:0.5rem;">${carte.map(renderMiniatura).join('')}</div>`}
                </div>`;

            container.innerHTML = `
                <div class="home-featured-grid" style="display:grid; grid-template-columns: repeat(3, 1fr); gap:1rem;">
                    ${renderGruppo('Valore più alto', 'fa-crown', '#d4a017', perValore)}
                    ${renderGruppo('Oscillazione +', 'fa-arrow-trend-up', 'var(--success)', perOscillazionePositiva)}
                    ${renderGruppo('Oscillazione -', 'fa-arrow-trend-down', 'var(--danger)', perOscillazioneNegativa)}
                </div>`;
        }
