// Lettura a pagine delle query di Supabase (oltre il limite di righe per richiesta).

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
