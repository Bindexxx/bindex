// ── utils/foto-reali.js ──────────────────────────────────────────────────
// RESTYLE BINDEX FASE 8c (2026-10-01): funzioni pure per le "foto reali" delle
// carte (fronte, retro, difetti — sql/89). Condivise tra il sito privato
// (index.html: pagina Foto carte e carta a tutto schermo) e il binder
// pubblico (binder-pubblico.html). Nessuna chiamata a Supabase qui: solo URL
// del bucket pubblico, HTML della striscia, visore e compressione.
//
// Dipende da: SUPABASE_URL (config/supabase.js), escapeHtml (utils/comuni.js).

const FOTO_ETICHETTE = {
    angolo: 'Angolo', bordo: 'Bordo', graffio: 'Graffio',
    centratura: 'Centratura', stampa: 'Stampa', altro: 'Altro',
};

// URL pubblico di un file del bucket foto-carte (bucket pubblico, sql/89).
function fotoRealeUrl(storagePath) {
    if (!storagePath) return '';
    const percorso = String(storagePath).split('/').map(encodeURIComponent).join('/');
    return `${SUPABASE_URL}/storage/v1/object/public/foto-carte/${percorso}`;
}

// Nome mostrato sotto la miniatura: Fronte / Retro / etichetta del difetto.
function fotoRealeNome(f) {
    if (!f) return '';
    if (f.tipo === 'fronte') return 'Fronte';
    if (f.tipo === 'retro') return 'Retro';
    return FOTO_ETICHETTE[f.etichetta] || 'Dettaglio';
}

// Ordine fisso: fronte, retro, poi i difetti in ordine di caricamento.
function fotoRealiOrdina(foto) {
    const peso = { fronte: 0, retro: 1, difetto: 2 };
    return (foto || []).slice().sort((a, b) =>
        (peso[a.tipo] ?? 3) - (peso[b.tipo] ?? 3) || String(a.creato_il || '').localeCompare(String(b.creato_il || '')));
}

// Sezione "Foto reali di questa copia · N" (vuota se non ci sono foto).
function fotoRealiStripHtml(foto) {
    const lista = fotoRealiOrdina(foto);
    if (!lista.length) return '';
    const miniature = lista.map(f => {
        const url = fotoRealeUrl(f.storage_path);
        const nome = fotoRealeNome(f);
        return `<button type="button" class="fr-mini" onclick="event.stopPropagation(); apriFotoRealeGrande('${escapeHtml(url)}', '${escapeHtml(nome)}')" aria-label="Apri la foto: ${escapeHtml(nome)}">
            <img src="${escapeHtml(url)}" alt="" loading="lazy" onerror="this.parentNode.classList.add('fr-mini-rotta')">
            <span>${escapeHtml(nome)}</span></button>`;
    }).join('');
    return `<div class="fr-sezione">
        <div class="fr-titolo"><i class="fa-solid fa-camera"></i> Foto reali di questa copia · ${lista.length}</div>
        <div class="fr-striscia">${miniature}</div></div>`;
}

// Visore a tutto schermo per una foto (sopra la carta a tutto schermo).
function apriFotoRealeGrande(url, titolo) {
    chiudiFotoRealeGrande();
    const velo = document.createElement('div');
    velo.id = 'frVisore';
    velo.className = 'fr-visore';
    velo.innerHTML = `<div class="fr-visore-testa"><span>${escapeHtml(titolo || '')}</span>
        <button type="button" onclick="chiudiFotoRealeGrande()" aria-label="Chiudi"><i class="fa-solid fa-xmark"></i></button></div>
        <img src="${escapeHtml(url)}" alt="${escapeHtml(titolo || 'Foto')}">`;
    velo.addEventListener('click', (e) => { if (e.target === velo) chiudiFotoRealeGrande(); });
    document.addEventListener('keydown', _frSuTasto);
    document.body.appendChild(velo); // position:fixed, sopra a tutto (anche alla carta a tutto schermo)
}
function _frSuTasto(e) { if (e.key === 'Escape') chiudiFotoRealeGrande(); }
function chiudiFotoRealeGrande() {
    const v = document.getElementById('frVisore');
    if (v) v.remove();
    document.removeEventListener('keydown', _frSuTasto);
}

// Riduce una foto (File/Blob o canvas) a JPEG leggero: lato lungo max 1600px.
async function fotoComprimi(sorgente, latoMax = 1600, qualita = 0.85) {
    let disegnabile, w, h, daChiudere = null;
    if (sorgente instanceof HTMLCanvasElement) {
        disegnabile = sorgente; w = sorgente.width; h = sorgente.height;
    } else {
        if (window.createImageBitmap) {
            try {
                disegnabile = await createImageBitmap(sorgente, { imageOrientation: 'from-image' });
            } catch (_) { disegnabile = null; }
        }
        if (!disegnabile) {
            const url = URL.createObjectURL(sorgente);
            disegnabile = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
            daChiudere = url;
        }
        w = disegnabile.width || disegnabile.naturalWidth; h = disegnabile.height || disegnabile.naturalHeight;
    }
    const scala = Math.min(1, latoMax / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * scala)); c.height = Math.max(1, Math.round(h * scala));
    c.getContext('2d').drawImage(disegnabile, 0, 0, c.width, c.height);
    if (daChiudere) URL.revokeObjectURL(daChiudere);
    if (disegnabile.close) try { disegnabile.close(); } catch (_) { /* niente */ }
    return new Promise((ok, ko) => c.toBlob(b => b ? ok(b) : ko(new Error('Compressione non riuscita')), 'image/jpeg', qualita));
}
