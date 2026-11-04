// Collezione: filtro per tipo, ricerca, evidenziazione, animazione del prezzo.

function toggleFiltroTipo(tipo) {
            _filtriTipo[tipo] = !_filtriTipo[tipo];
            if (typeof prefFiltroPaginaSet === 'function') prefFiltroPaginaSet('collezione', 'tipo_' + tipo, _filtriTipo[tipo]);
            document.getElementById('toggleTipo' + tipo.charAt(0).toUpperCase() + tipo.slice(1))
                .classList.toggle('active', _filtriTipo[tipo]);
            filterTable();
        }

        function toggleRowHighlight(id) {
            highlightedRowId = (highlightedRowId === id) ? null : id;
            filterTable();
        }

        function filterTable() {
            const searchVal = document.getElementById('searchInput').value.toLowerCase();
            let locVal = document.getElementById('filterLocation').value;
            const langVal = document.getElementById('filterLang').value;

            const filtered = carteReali.filter(card => {
                const matchesSearch = card.name.toLowerCase().includes(searchVal) || card.code.toLowerCase().includes(searchVal);
                const matchesLang = langVal === "" || card.lang === langVal;
                if (!matchesSearch || !matchesLang) return false;

                if (currentMode === 'wishlist') return card.stato === 'wishlist';
                if (currentMode === 'scambio') {
                    return card.stato === 'collezione' && typeof _idsInScambio !== 'undefined' && _idsInScambio.has(String(card.id));
                }
                if (currentMode === 'sealed') {
                    if (card.stato !== 'collezione' || card.tipo !== 'sealed') return false;
                    return locVal === "" || card.location === locVal;
                }
                if (currentMode === 'visualizzazione') {
                    if (card.stato === 'wishlist') { if (!_filtriTipo.wishlist) return false; }
                    else if (card.tipo === 'sealed') { if (!_filtriTipo.sealed) return false; }
                    else { if (!_filtriTipo.carte) return false; }
                    return locVal === "" || card.location === locVal;
                }
                if (card.stato !== 'collezione') return false;
                return locVal === "" || card.location === locVal;
            });

            const mostraSealed = currentMode === 'sealed' ||
                (currentMode === 'visualizzazione' ? _filtriTipo.sealed : (currentMode !== 'wishlist' && currentMode !== 'scambio'));
            if (mostraSealed && typeof _collRigheSealed === 'function') {
                _collRigheSealed().forEach(card => {
                    if (!card.name.toLowerCase().includes(searchVal) && !card.code.toLowerCase().includes(searchVal)) return;
                    if (langVal !== '' && card.lang !== langVal) return;
                    if (locVal !== '') return;
                    filtered.push(card);
                });
            }

            renderViewTable(filtered);
        }

        function _animaPrezzoCarta(id, direzione) {
            if (!direzione || _animazioniRidotte()) return;
            const classe = direzione === 'su' ? 'prezzo-flash-su' : 'prezzo-flash-giu';
            ['prezzoCella-' + id, 'prezzoCellaCompatta-' + id].forEach(elId => {
                const el = document.getElementById(elId);
                if (!el) return;
                el.classList.remove('prezzo-flash-su', 'prezzo-flash-giu');
                void el.offsetWidth;
                el.classList.add(classe);
                el.addEventListener('animationend', () => el.classList.remove(classe), { once: true });
            });
        }
