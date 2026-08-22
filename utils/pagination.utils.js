// ── utils/pagination.utils.js ──────────────────────────────────────────
// Helper generico di paginazione per query Supabase (usato dai repository
// data/*.js che restituiscono un query builder non risolto). Nome diverso
// da 'utils/formatters.js' della struttura di riferimento perché non è
// una funzione di formattazione: pagina risultati, non formatta testo.


        // FIX (carte "sparite" dalla vista con collezioni grandi): Supabase
        // limita OGNI richiesta a 1000 righe di default, senza segnalare
        // errori — con 1300+ carte, quelle oltre la millesima (in base
        // all'ordinamento alfabetico) restavano fuori dalla risposta e
        // sparivano dalla vista senza alcun avviso. Pagina esplicitamente,
        // richiedendo blocchi da 1000 finché non ne riceve uno incompleto
        // (= fine dei dati) — stesso pattern già usato nell'estensione
        // (_selectTuttePagine).
        async function _selectTuttePagine(queryBuilder) {
            const DIMENSIONE_PAGINA = 1000;
            let tutte = [];
            let pagina = 0;
            while (true) {
                const { data, error } = await queryBuilder.range(pagina * DIMENSIONE_PAGINA, (pagina + 1) * DIMENSIONE_PAGINA - 1);
                if (error) return { data: null, error };
                tutte = tutte.concat(data || []);
                if (!data || data.length < DIMENSIONE_PAGINA) break;
                pagina++;
            }
            return { data: tutte, error: null };
        }
