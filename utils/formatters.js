// Funzioni di formattazione (niente DOM, niente dati).

function _mappaVariazione(r) {
            let variation = '—';
            if (r.prezzo_precedente != null && r.prezzo != null) {
                const diff = Number(r.prezzo) - Number(r.prezzo_precedente);
                if (Math.abs(diff) >= 0.005) {
                    const segno = diff > 0 ? '▲' : '▼';
                    variation = `${segno} ${diff > 0 ? '+' : '−'}${formattaEuro(Math.abs(diff))}`;
                }
            }
            return variation;
        }

        function versioneMaggioreSito(a, b) {
            const pa = String(a).split('.').map(Number);
            const pb = String(b).split('.').map(Number);
            for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
                const na = pa[i] || 0, nb = pb[i] || 0;
                if (na > nb) return true;
                if (na < nb) return false;
            }
            return false;
        }
