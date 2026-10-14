// ═══════════════════════════════════════════════════════════════════════
// NAVIGATION-RICERCA.UI.JS — ricerca globale (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP separato dal piano "riduzione accoppiamento" concordato con Claudio
// il 2026-09-11. Estratto da ui/navigation.ui.js.
//
// (Q4 quality of life, 2026-10-12) Cerca ovunque:
//  - carte (collezione/Scambio), wishlist, sealed, binder e scaffali (prima
//    solo nome/codice delle carte, max 40 senza gruppi);
//  - senza accenti né maiuscole ("pokemon" trova "Pokémon"); più parole =
//    tutte devono comparire (es. "pikachu 25", "charizard ita");
//  - frecce ↑/↓ e Invio nell'elenco; su PC il tasto "/" apre la ricerca;
//  - il risultato si apre dove vive davvero: prima switchTab() attivava una
//    sezione della vecchia tabella nascosta e dalla home non succedeva nulla.
//    Carte e wishlist → pagina Collezione filtrata sul nome con la riga
//    aperta; sealed, binder e scaffali → la loro pagina, già sull'oggetto.
// Binder e scaffali si leggono una volta all'apertura (cache 1 minuto).
//
// Contiene: apriRicercaGlobale, chiudiRicercaGlobale, eseguiRicercaGlobale,
// vaiARisultatoRicerca (+ helper _ricerca*).
// ───────────────────────────────────────────────────────────────────────

        let _ricercaContenitori = { quando: 0, binder: [], scaffali: [] };
        let _ricercaRisultati = [];   // risultati mostrati, nell'ordine dell'elenco
        let _ricercaEvidenziato = 0;  // indice scelto con le frecce

        function _ricercaNormalizza(testo) {
            return String(testo == null ? '' : testo).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
        }

        async function _ricercaCaricaContenitori() {
            if (Date.now() - _ricercaContenitori.quando < 60000) return;
            try {
                const userId = await authGetUserId();
                if (!userId) return;
                const [rb, rs] = await Promise.all([bindersQueryTutti(userId), scaffaliList(userId)]);
                _ricercaContenitori = {
                    quando: Date.now(),
                    binder: rb.error ? [] : (rb.data || []),
                    scaffali: rs.error ? [] : (rs.data || []),
                };
            } catch (e) {
                console.error('[ricerca] binder/scaffali:', e);
            }
            // Arrivati mentre l'utente scriveva: si ricalcola l'elenco.
            const input = document.getElementById('ricercaGlobaleInput');
            const modale = document.getElementById('ricercaGlobaleModal');
            if (input && modale && modale.style.display === 'flex' && input.value.trim().length >= 2) eseguiRicercaGlobale(input.value);
        }

        function _ricercaMessaggio(testo) {
            const container = document.getElementById('ricercaGlobaleRisultati');
            if (container) container.innerHTML = '<p style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding:1rem 0;">' + escapeHtml(testo) + '</p>';
            _ricercaRisultati = [];
        }

        function apriRicercaGlobale() {
            closeDrawer(); // stesso pattern di switchTab(): su mobile il drawer si richiude dopo la scelta
            document.getElementById('ricercaGlobaleModal').style.display = 'flex';
            document.getElementById('ricercaGlobaleInput').value = '';
            _ricercaMessaggio('Carte, wishlist, sealed, binder e scaffali: scrivi almeno 2 lettere.');
            setTimeout(() => document.getElementById('ricercaGlobaleInput').focus(), 50);
            _ricercaCaricaContenitori();
        }


        function chiudiRicercaGlobale() {
            document.getElementById('ricercaGlobaleModal').style.display = 'none';
        }


        // Etichetta e colori della pill: wishlist, sealed, Scambio, collezione,
        // binder, scaffale. Fase 3, Step 2 (2026-09-12): appartenenza allo
        // Scambio via _idsInScambio (location 'SCAMBIO' ritirata, sql/45b).
        function _etichettaSezione(card) {
            if (card.tabella === 'wishlist') return { testo: 'Wishlist', bg: 'var(--bg-success)', colore: 'var(--success)' };
            if (card.tipo === 'sealed') return { testo: 'Sealed', bg: 'var(--primary-light)', colore: 'var(--primary)' };
            if (typeof _idsInScambio !== 'undefined' && _idsInScambio.has(String(card.id))) return { testo: 'Scambio', bg: 'var(--bg-accent, var(--primary-light))', colore: 'var(--primary)' };
            return { testo: 'Collezione', bg: 'var(--bg-color)', colore: 'var(--text-muted)' };
        }

        const _RICERCA_PILL = {
            sealed: { testo: 'Sealed', bg: 'var(--primary-light)', colore: 'var(--primary-text, var(--primary))' },
            binder: { testo: 'Binder', bg: 'var(--bg-color)', colore: 'var(--text-muted)' },
            scaffale: { testo: 'Scaffale', bg: 'var(--bg-color)', colore: 'var(--text-muted)' },
        };

        // Ogni parola cercata deve comparire nel testo dell'oggetto. Punteggio:
        // 0 = il nome inizia con la ricerca, 1 = il nome la contiene, 2 = altrove.
        function _ricercaPunteggio(parole, frase, nome, resto) {
            const n = _ricercaNormalizza(nome);
            const tutto = n + ' ' + _ricercaNormalizza(resto);
            if (!parole.every(p => tutto.includes(p))) return -1;
            if (n.startsWith(frase)) return 0;
            return n.includes(frase) ? 1 : 2;
        }

        function _ricercaFiltra(elenco, parole, frase, campi, limite) {
            return elenco
                .map(o => { const [nome, resto] = campi(o); return { o, nome, p: _ricercaPunteggio(parole, frase, nome, resto) }; })
                .filter(x => x.p >= 0)
                .sort((a, b) => a.p - b.p || String(a.nome).localeCompare(String(b.nome), 'it'))
                .slice(0, limite);
        }

        function eseguiRicercaGlobale(query) {
            const container = document.getElementById('ricercaGlobaleRisultati');
            const frase = _ricercaNormalizza(query).trim().replace(/\s+/g, ' ');
            if (frase.length < 2) { _ricercaMessaggio('Scrivi almeno 2 lettere.'); return; }
            const parole = frase.split(' ');

            const carte = typeof carteReali !== 'undefined' ? carteReali : [];
            const gruppi = [
                {
                    titolo: 'Carte', tipo: 'carta',
                    voci: _ricercaFiltra(carte.filter(c => c.tabella !== 'wishlist'), parole, frase, c => [c.name, [c.code, c.location, c.lang].join(' ')], 25)
                        .map(x => ({ tipo: 'carta', id: x.o.id, nome: x.o.name, dettaglio: x.o.code, pill: _etichettaSezione(x.o) })),
                },
                {
                    titolo: 'Wishlist', tipo: 'wishlist',
                    voci: _ricercaFiltra(carte.filter(c => c.tabella === 'wishlist'), parole, frase, c => [c.name, c.code], 10)
                        .map(x => ({ tipo: 'wishlist', id: x.o.id, nome: x.o.name, dettaglio: x.o.code, pill: _etichettaSezione(x.o) })),
                },
                {
                    titolo: 'Sealed', tipo: 'sealed',
                    voci: _ricercaFiltra(typeof prodottiSealedReali !== 'undefined' ? prodottiSealedReali : [], parole, frase, p => [p.name, [p.codice, p.setEspansione].join(' ')], 10)
                        .map(x => ({ tipo: 'sealed', id: x.o.id, nome: x.o.name, dettaglio: x.o.codice || x.o.setEspansione, pill: _RICERCA_PILL.sealed })),
                },
                {
                    titolo: 'Binder', tipo: 'binder',
                    voci: _ricercaFiltra(_ricercaContenitori.binder, parole, frase, b => [b.nome, ''], 8)
                        .map(x => ({ tipo: 'binder', id: x.o.id, nome: x.o.nome, dettaglio: '', pill: _RICERCA_PILL.binder })),
                },
                {
                    titolo: 'Scaffali', tipo: 'scaffale',
                    voci: _ricercaFiltra(_ricercaContenitori.scaffali, parole, frase, s => [s.nome, ''], 8)
                        .map(x => ({ tipo: 'scaffale', id: x.o.id, nome: x.o.nome, dettaglio: '', pill: _RICERCA_PILL.scaffale })),
                },
            ].filter(g => g.voci.length);

            if (!gruppi.length) { _ricercaMessaggio('Nessun risultato.'); return; }

            _ricercaRisultati = [];
            _ricercaEvidenziato = 0;
            let html = '';
            gruppi.forEach(g => {
                html += `<div class="ricerca-gruppo-titolo">${escapeHtml(g.titolo)} <span>${g.voci.length}</span></div>`;
                g.voci.forEach(v => {
                    const i = _ricercaRisultati.length;
                    _ricercaRisultati.push(v);
                    html += `
                    <div class="risultato-ricerca-globale${i === 0 ? ' evidenziato' : ''}" data-i="${i}" onclick="vaiARisultatoRicerca(${i})" onmousemove="_ricercaEvidenzia(${i}, false)">
                        <span class="risultato-ricerca-globale-nome">${escapeHtml(v.nome || '(senza nome)')}${v.dettaglio ? ` <span style="color:var(--text-muted); font-weight:600;">(${escapeHtml(v.dettaglio)})</span>` : ''}</span>
                        <span class="risultato-ricerca-globale-pill" style="background-color:${v.pill.bg}; color:${v.pill.colore};">${escapeHtml(v.pill.testo)}</span>
                    </div>`;
                });
            });
            container.innerHTML = html;
        }

        function _ricercaEvidenzia(i, scorri) {
            if (!_ricercaRisultati.length) return;
            _ricercaEvidenziato = Math.max(0, Math.min(_ricercaRisultati.length - 1, i));
            document.querySelectorAll('#ricercaGlobaleRisultati .risultato-ricerca-globale').forEach(el => {
                const on = Number(el.dataset.i) === _ricercaEvidenziato;
                el.classList.toggle('evidenziato', on);
                if (on && scorri) el.scrollIntoView({ block: 'nearest' });
            });
        }

        // Frecce e Invio nel campo di ricerca; Esc chiude. (Gli script sono in
        // fondo alla pagina: il campo esiste già.)
        document.getElementById('ricercaGlobaleInput')?.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); _ricercaEvidenzia(_ricercaEvidenziato + 1, true); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); _ricercaEvidenzia(_ricercaEvidenziato - 1, true); }
            else if (e.key === 'Enter') { e.preventDefault(); if (_ricercaRisultati.length) vaiARisultatoRicerca(_ricercaEvidenziato); }
            else if (e.key === 'Escape') { e.preventDefault(); chiudiRicercaGlobale(); }
        });

        // PC: "/" apre la ricerca (non mentre si scrive, né con una finestra aperta).
        document.addEventListener('keydown', (e) => {
            if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
            const el = document.activeElement;
            if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
            if (document.querySelector('.avviso-fondo')) return;
            const modale = document.getElementById('ricercaGlobaleModal');
            if (!modale || modale.style.display === 'flex') return;
            if (typeof _editModeWidget !== 'undefined' && _editModeWidget) return;
            e.preventDefault();
            apriRicercaGlobale();
        });


        // Aspetta (al massimo ~3 s) che una pagina appena aperta abbia i dati.
        async function _ricercaAspetta(condizione) {
            for (let i = 0; i < 30; i++) {
                try { if (condizione()) return true; } catch (_) { /* non ancora */ }
                await new Promise(r => setTimeout(r, 100));
            }
            return false;
        }

        async function vaiARisultatoRicerca(indice) {
            const v = _ricercaRisultati[indice];
            if (!v) return;
            chiudiRicercaGlobale();

            // Missioni/Traguardi Fase 2 — ricerche eseguite (2026-08-29).
            // Fire-and-forget: un fallimento qui non deve mai bloccare la
            // navigazione al risultato.
            (async () => {
                try {
                    const userId = await authGetUserId();
                    if (userId) await missioniRicercaRegistra(userId, v.nome);
                } catch (e) { console.error('[missioni] registrazione ricerca:', e); }
            })();

            if (v.tipo === 'carta' || v.tipo === 'wishlist') {
                const card = carteReali.find(c => String(c.id) === String(v.id));
                if (!card) return;
                // Pagina Collezione filtrata sul nome: niente filtri di location
                // o lingua che possano nasconderla, il suo tipo di riga acceso.
                const cerca = document.getElementById('searchInput');
                if (cerca) cerca.value = card.name || '';
                const azzeraFiltri = () => ['filterLocation', 'filterLang', 'collFiltroLoc', 'collFiltroLang'].forEach(id => { const s = document.getElementById(id); if (s) s.value = ''; });
                azzeraFiltri();
                const tipoRiga = card.tabella === 'wishlist' ? 'wishlist' : 'carte';
                if (!_filtriTipo[tipoRiga]) {
                    _filtriTipo[tipoRiga] = true;
                    document.getElementById('toggleTipo' + tipoRiga.charAt(0).toUpperCase() + tipoRiga.slice(1))?.classList.add('active');
                }
                await apriDettaglioWidget('visualizzazione', null);
                azzeraFiltri(); // anche la Location ricordata che l'apertura rimette (Q5): qui conta la carta
                filterTable();
                if (typeof collVaiACarta === 'function') setTimeout(() => collVaiACarta(card.id), 120);
                return;
            }

            if (v.tipo === 'sealed') {
                await apriDettaglioWidget('sealed', null);
                if (await _ricercaAspetta(() => document.getElementById('sealedVistaElenco') && prodottiSealedReali.some(p => String(p.id) === String(v.id)))) {
                    _sealedApriDettaglio(v.id);
                }
                return;
            }

            if (v.tipo === 'binder') {
                await apriDettaglioWidget('binder', null); // aspetta già il caricamento dei binder
                if (await _ricercaAspetta(() => _bindersElenco.some(b => String(b.id) === String(v.id)))) apriBinderDettaglio(v.id);
                return;
            }

            if (v.tipo === 'scaffale') {
                // apriPaginaScaffali (chiamata da apriDettaglioWidget) lo apre
                // da sé a fine caricamento, al posto del primo scaffale.
                _scaffaleDaAprire = v.id;
                await apriDettaglioWidget('scaffali', null);
            }
        }
