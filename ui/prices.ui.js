// ── ui/prices.ui.js ────────────────────────────────────────────────────
// Controllo prezzi (collezione e wishlist) via estensione: elenco location,
// creazione ordine, polling stato, grafico andamento prezzo di una carta.


        // ── ELENCO LOCATION (checkbox) — sezione Prezzi ──────────────────────────
        // Stessa tabella 'location' che l'estensione usa per la tendina Location
        // (azione 'elencaLocationTab' in supabase_adapter.js) — qui la leggiamo
        // direttamente, dato che il sito ha già il proprio client Supabase.

        async function caricaListaLocationCheckbox() {
            const userId = await authGetUserId();
            const wrap = document.getElementById('listaLocationCheckbox');
            if (!userId) { wrap.innerHTML = '<p style="font-size:0.78rem; color:var(--text-muted); margin:0;">Accedi per vedere le tue location.</p>'; return; }

            const { data, error } = await locationsList(userId);
            if (error) {
                wrap.innerHTML = `<p style="font-size:0.78rem; color:var(--danger); margin:0;">Errore: ${error.message}</p>`;
                return;
            }
            const location = (data || []).map(r => r.nome);
            if (location.length === 0) {
                wrap.innerHTML = '<p style="font-size:0.78rem; color:var(--text-muted); margin:0;">Nessuna location salvata ancora.</p>';
                return;
            }
            wrap.innerHTML = '';
            location.forEach(nome => {
                const label = document.createElement('label');
                label.style.cssText = 'display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; font-weight:600; cursor:pointer;';
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.value = nome;
                cb.className = 'checkboxLocationPrezzi';
                label.appendChild(cb);
                label.appendChild(document.createTextNode(nome));
                wrap.appendChild(label);
            });
            _locationCaricate = true;
        }


        function toggleTutteLocation() {
            const checkboxes = document.querySelectorAll('.checkboxLocationPrezzi');
            const tutteSpuntate = [...checkboxes].every(cb => cb.checked);
            checkboxes.forEach(cb => { cb.checked = !tutteSpuntate; });
            document.getElementById('btnToggleTutteLocation').textContent = tutteSpuntate ? 'Seleziona tutte' : 'Deseleziona tutte';
        }


        function _locationSelezionate() {
            return [...document.querySelectorAll('.checkboxLocationPrezzi:checked')].map(cb => cb.value);
        }


        // "Solo le mie" (default, più prevedibile per chi crea la
        // richiesta) oppure "tutto il gruppo" — prima questo era deciso a
        // caso dalla casella locale del dispositivo che eseguiva l'ordine,
        // non da chi lo creava. Ora la scelta fatta qui viaggia CON
        // l'ordine ed è quella che conta.
        function _impostaAmbitoControlloPrezzi(ambito) {
            _ambitoControlloPrezzi = ambito;
            document.getElementById('btnAmbitoSoloMie').classList.toggle('active', ambito === 'soloMie');
            document.getElementById('btnAmbitoGruppo').classList.toggle('active', ambito === 'gruppo');
        }


        // ── CONTROLLO PREZZI — collegato agli ordini reali ───────────────────────

        async function triggerExtensionPriceCheck() {
            const userId = await authGetUserId();
            if (!userId) {
                await assicuraLoginSupabase();
                return;
            }

            const btn = document.getElementById('btnControllaPrezzi');
            const sub = document.getElementById('prezziSubtext');
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creazione ordine...';

            const locations = _locationSelezionate();

            const { data: ordine, error } = await ordiniInsert({ tipo: 'controlla_prezzi', creato_da: userId, parametri: { locations, aiutaGruppo: _ambitoControlloPrezzi === 'gruppo' } });

            if (error) {
                sub.textContent = '❌ Errore: ' + error.message;
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Avvia Controllo Prezzi';
                return;
            }

            btn.innerHTML = '<i class="fa-solid fa-hourglass-half"></i> In attesa che un dispositivo lo prenda in carico...';
            sub.textContent = 'L\'ordine è stato creato — un dispositivo con l\'estensione aperta lo eseguirà a breve.';

            // Missione #90 "Collega il mondo" (2026-08-30): usare una
            // funzione reale attraverso l'estensione (qui: avviare il
            // controllo prezzi). Fire-and-forget, stesso pattern degli
            // altri hook missioni.
            (async () => {
                try {
                    await missioniEstensioneFunzioneUsataRegistra(userId);
                } catch (e) { console.error('[missioni] registrazione uso estensione:', e); }
            })();

            _pollOrdine(ordine.id, btn, sub);
        }


        function _pollOrdine(ordineId, btn, sub) {
            if (_pollOrdineInterval) clearInterval(_pollOrdineInterval);
            const INTERVALLO_MS = 3000;
            const MAX_TENTATIVI = 200; // ~10 minuti
            let tentativi = 0;

            _pollOrdineInterval = setInterval(async () => {
                tentativi++;
                const { data, error } = await ordiniLeggiStato(ordineId);

                if (error) {
                    clearInterval(_pollOrdineInterval);
                    _resetBottonePrezzi(btn, sub);
                    sub.textContent = '❌ Errore nel controllo dello stato: ' + error.message;
                    return;
                }

                if (data.stato === 'in_corso') {
                    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Controllo prezzi in corso...';
                    sub.textContent = 'Un dispositivo sta controllando le quotazioni su Cardmarket adesso.';
                } else if (data.stato === 'completato') {
                    clearInterval(_pollOrdineInterval);
                    const r = data.risultato || {};
                    _resetBottonePrezzi(btn, sub);
                    sub.innerHTML = `✅ Fatto! <span style="color:var(--success)">▲ ${r.salite ?? 0}</span> · <span style="color:var(--danger)">▼ ${r.scese ?? 0}</span> · ➖ ${r.invariate ?? 0} invariate`;
                } else if (data.stato === 'errore') {
                    clearInterval(_pollOrdineInterval);
                    _resetBottonePrezzi(btn, sub);
                    sub.textContent = '❌ ' + (data.errore_msg || 'Errore sconosciuto durante il controllo prezzi.');
                }

                if (tentativi >= MAX_TENTATIVI) {
                    clearInterval(_pollOrdineInterval);
                    _resetBottonePrezzi(btn, sub);
                    sub.textContent = '⏱️ Nessun dispositivo ha ancora eseguito l\'ordine. Controlla che qualcuno del gruppo abbia l\'estensione aperta e sia online.';
                }
            }, INTERVALLO_MS);
        }


        function _resetBottonePrezzi(btn, sub, testoDefault = '<i class="fa-solid fa-paper-plane"></i> Avvia Controllo Prezzi') {
            btn.disabled = false;
            btn.innerHTML = testoDefault;
        }


        // ── CONTROLLO PREZZI WISHLIST — stesso schema, ordine dedicato ───────────

        async function triggerExtensionPriceCheckWishlist() {
            const userId = await authGetUserId();
            if (!userId) {
                await assicuraLoginSupabase();
                return;
            }

            const btn = document.getElementById('btnControllaPrezziWishlist');
            const sub = document.getElementById('prezziWishlistSubtext');
            const testoDefault = '<i class="fa-solid fa-paper-plane"></i> Avvia Controllo Prezzi Wishlist';
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creazione ordine...';

            const { data: ordine, error } = await ordiniInsert({ tipo: 'controlla_prezzi_wishlist', creato_da: userId });

            if (error) {
                sub.textContent = '❌ Errore: ' + error.message;
                _resetBottonePrezzi(btn, sub, testoDefault);
                return;
            }

            btn.innerHTML = '<i class="fa-solid fa-hourglass-half"></i> In attesa che un dispositivo lo prenda in carico...';
            sub.textContent = 'L\'ordine è stato creato — un dispositivo con l\'estensione aperta lo eseguirà a breve.';

            // Missione #90 "Collega il mondo" (2026-08-30): stesso hook di
            // triggerExtensionPriceCheck() sopra — stessa funzione, stesso
            // concetto ("usa una funzione dell'estensione").
            (async () => {
                try {
                    await missioniEstensioneFunzioneUsataRegistra(userId);
                } catch (e) { console.error('[missioni] registrazione uso estensione:', e); }
            })();

            if (_pollOrdineWishlistInterval) clearInterval(_pollOrdineWishlistInterval);
            const INTERVALLO_MS = 3000;
            const MAX_TENTATIVI = 200; // ~10 minuti
            let tentativi = 0;

            _pollOrdineWishlistInterval = setInterval(async () => {
                tentativi++;
                const { data, error: errPoll } = await ordiniLeggiStato(ordine.id);

                if (errPoll) {
                    clearInterval(_pollOrdineWishlistInterval);
                    _resetBottonePrezzi(btn, sub, testoDefault);
                    sub.textContent = '❌ Errore nel controllo dello stato: ' + errPoll.message;
                    return;
                }

                if (data.stato === 'in_corso') {
                    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Controllo prezzi in corso...';
                    sub.textContent = 'Un dispositivo sta controllando le quotazioni della wishlist su Cardmarket adesso.';
                } else if (data.stato === 'completato') {
                    clearInterval(_pollOrdineWishlistInterval);
                    const r = data.risultato || {};
                    _resetBottonePrezzi(btn, sub, testoDefault);
                    sub.textContent = `✅ Fatto! ${r.aggiornate ?? 0} su ${r.totale ?? 0} carte aggiornate.`;
                } else if (data.stato === 'errore') {
                    clearInterval(_pollOrdineWishlistInterval);
                    _resetBottonePrezzi(btn, sub, testoDefault);
                    sub.textContent = '❌ ' + (data.errore_msg || 'Errore sconosciuto durante il controllo prezzi.');
                }

                if (tentativi >= MAX_TENTATIVI) {
                    clearInterval(_pollOrdineWishlistInterval);
                    _resetBottonePrezzi(btn, sub, testoDefault);
                    sub.textContent = '⏱️ Nessun dispositivo ha ancora eseguito l\'ordine. Controlla che qualcuno del gruppo abbia l\'estensione aperta e sia online.';
                }
            }, INTERVALLO_MS);
        }


        // Elenco dettagliato (non solo il numero) delle carte con prezzo da
        // aggiornare, usato dal modale cliccabile.

        function apriModalePrezziScaduti() {
            document.getElementById('prezziScadutiSottotitolo').textContent = `Mai controllate o con ultimo controllo più vecchio di ${SOGLIA_GIORNI_PREZZO_SCADUTO} giorni.`;
            const lista = document.getElementById('prezziScadutiLista');
            if (_elencoPrezziScaduti.length === 0) {
                lista.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:1rem 0;">Nessuna carta da aggiornare al momento.</p>';
            } else {
                lista.innerHTML = _elencoPrezziScaduti.map(c => `
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:0.6rem; padding:0.5rem 0; border-bottom:1px solid var(--border-color);">
                        <span style="font-size:0.85rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"><strong>${escapeHtml(c.name)}</strong> <code style="font-size:0.72rem;">${c.code}</code></span>
                        <span style="font-size:0.75rem; color:var(--text-muted); flex-shrink:0;">${c.ultimoTesto}</span>
                    </div>`).join('');
            }
            document.getElementById('prezziScadutiModal').style.display = 'flex';
        }


        function chiudiModalePrezziScaduti() {
            document.getElementById('prezziScadutiModal').style.display = 'none';
        }


        // ── A10 (Dashboard/Home) — "Ultima sincronizzazione" ────────────────────
        // Ultimo ordine con tipo='controlla_prezzi' e stato='completato',
        // filtrato su creato_da (solo i controlli avviati da questo
        // account, coerente con l'ownership usata in tutto il resto
        // dell'app) — SOLO collezione, esclusi i controlli sulla wishlist
        // (decisione confermata da Claudio).
        async function caricaUltimaSincronizzazioneHome() {
            const el = document.getElementById('ultimaSincronizzazioneHome');
            if (!el) return;

            const userId = await authGetUserId();
            if (!userId) return;

            const { data, error } = await ordiniUltimoCompletato(userId);

            if (error) { console.error('Errore lettura ultima sincronizzazione:', error.message); return; }

            if (!data || data.length === 0) {
                el.innerHTML = 'Nessun controllo prezzi completato finora.';
                return;
            }

            const r = data[0];
            const dataFmt = new Date(r.completato_il).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            const esito = r.risultato || {};
            el.innerHTML = `Ultimo controllo prezzi completato il <strong>${dataFmt}</strong> — <span style="color:var(--success);">▲ ${esito.salite ?? 0}</span> · <span style="color:var(--danger);">▼ ${esito.scese ?? 0}</span> · ➖ ${esito.invariate ?? 0} invariate`;
        }



        async function apriGraficoPrezzo(id, tabella, nome) {
            document.getElementById('graficoPrezzoNome').textContent = nome;
            document.getElementById('graficoModal').style.display = 'flex';

            const { data, error } = await storicoPrezziGrafico(id, tabella);

            const container = document.getElementById('graficoPrezzoContainer');
            if (error) {
                container.innerHTML = `<p style="color:var(--danger); font-size:0.85rem;">Errore: ${error.message}</p>`;
                return;
            }
            if (!data || data.length < 2) {
                container.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem; text-align:center;">Non ci sono ancora abbastanza dati per un grafico.<br>Il prezzo viene registrato ad ogni controllo prezzi — da qui in poi lo storico crescerà da solo.</p>`;
                return;
            }
            container.innerHTML = '<canvas id="graficoPrezzoCanvas"></canvas>';

            const etichette = data.map(r => new Date(r.registrato_il).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }));
            const valori = data.map(r => Number(r.prezzo));

            if (_graficoPrezzoChart) _graficoPrezzoChart.destroy();
            _graficoPrezzoChart = new Chart(document.getElementById('graficoPrezzoCanvas'), {
                type: 'line',
                data: {
                    labels: etichette,
                    datasets: [{
                        label: 'Prezzo (€)',
                        data: valori,
                        borderColor: '#7c4dff',
                        backgroundColor: 'rgba(124, 77, 255, 0.12)',
                        tension: 0.25,
                        fill: true,
                        pointRadius: 3,
                    }],
                },
                options: {
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: { y: { ticks: { callback: v => v.toFixed(2) + ' €' } } },
                },
            });
        }


        function chiudiGraficoPrezzo() {
            document.getElementById('graficoModal').style.display = 'none';
            if (_graficoPrezzoChart) { _graficoPrezzoChart.destroy(); _graficoPrezzoChart = null; }
        }
