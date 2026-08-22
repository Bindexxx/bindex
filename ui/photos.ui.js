// ── ui/photos.ui.js ────────────────────────────────────────────────────
// Modale "Foto Dettaglio": galleria, caricamento, eliminazione foto di una
// singola carta.


        async function apriFotoDettaglio(id, tabella, nome) {
            _fotoDettaglioCartaId = id;
            _fotoDettaglioTabella = tabella;
            document.getElementById('fotoModalNome').textContent = nome;
            document.getElementById('fotoModal').style.display = 'flex';
            await _ricaricaGalleriaFoto();
        }


        function chiudiFotoDettaglio() {
            document.getElementById('fotoModal').style.display = 'none';
        }


        async function _ricaricaGalleriaFoto() {
            const galleria = document.getElementById('fotoGalleria');
            galleria.innerHTML = '<p style="grid-column:1/-1; color:var(--text-muted); font-size:0.8rem;">Caricamento...</p>';

            const { data, error } = await fotoCarteList(_fotoDettaglioCartaId, _fotoDettaglioTabella);

            if (error) { galleria.innerHTML = `<p style="grid-column:1/-1; color:var(--danger);">❌ ${error.message}</p>`; return; }
            if (!data || data.length === 0) { galleria.innerHTML = '<p style="grid-column:1/-1; color:var(--text-muted); font-size:0.8rem;">Nessuna foto ancora — scattane una con il pulsante sopra.</p>'; return; }

            galleria.innerHTML = data.map(f => {
                const { data: pub } = storageFotoCartePublicUrl(f.storage_path);
                const url = pub.publicUrl;
                return `
                    <div style="position:relative;">
                        <img src="${url}" style="width:100%; aspect-ratio:1; object-fit:cover; border-radius:8px; cursor:pointer;" onclick="apriUrlIngrandito('${url}')">
                        <button onclick="eliminaFotoDettaglio('${f.id}', '${f.storage_path}')" title="Elimina" style="position:absolute; top:2px; right:2px; background:rgba(0,0,0,0.65); color:white; border:none; border-radius:50%; width:22px; height:22px; cursor:pointer; font-size:0.7rem;">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>`;
            }).join('');
        }


        async function caricaFotoDettaglio(event) {
            const files = event.target.files;
            if (!files || files.length === 0) return;

            const userId = await authGetUserId();
            if (!userId) return;

            for (const file of files) {
                // Percorso con l'id utente come prima cartella: le policy di
                // storage.objects lo richiedono per verificare il proprietario.
                const path = `${userId}/${_fotoDettaglioCartaId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
                const { error: errUpload } = await storageFotoCarteUpload(path, file);
                if (errUpload) { alert('❌ Errore nel caricare la foto: ' + errUpload.message); continue; }

                const { error: errInsert } = await fotoCarteInsert({
                    carta_id: _fotoDettaglioCartaId, tabella: _fotoDettaglioTabella, owner_id: userId, storage_path: path,
                });
                if (errInsert) console.error('Foto caricata ma non registrata:', errInsert.message);
            }
            event.target.value = ''; // permette di ricaricare la stessa foto due volte se serve
            await _ricaricaGalleriaFoto();
        }


        async function eliminaFotoDettaglio(id, storagePath) {
            if (!confirm('Eliminare questa foto?')) return;
            await storageFotoCarteRemove(storagePath);
            const { error } = await fotoCarteDelete(id);
            if (error) { alert('❌ Errore nell\'eliminazione: ' + error.message); return; }
            await _ricaricaGalleriaFoto();
        }
