// ── ui/modals.ui.js ────────────────────────────────────────────────────
// Visualizzatore immagine generico (usato da più sezioni del sito).


        // A15: prima apriva solo l'immagine statica; ora richiama lo stesso
        // flip-modal di apriFlipCardHome, su richiesta di Claudio, così il
        // comportamento è identico ovunque nel sito (tabella, vista
        // compatta mobile, Binder, Home). Tutti i punti che chiamavano
        // questa funzione restano invariati, cambia solo cosa succede
        // dentro. Nota: se la carta non ha immagine, prima il click non
        // faceva nulla (guardia bloccante) — ora il modale si apre lo
        // stesso e mostra direttamente il retro con le statistiche, senza
        // fronte (comportamento più utile, non un difetto).
        function apriImmagineIngrandita(id) {
            apriFlipCardHome(id);
        }


        function chiudiImmagineIngrandita() {
            document.getElementById('immagineModal').style.display = 'none';
            // A10: azzera anche l'eventuale scena flip, per non lasciarla a
            // metà rotazione o con il timer di auto-flip ancora in corsa
            // la prossima volta che il modale si apre in modalità semplice.
            document.getElementById('flipCardScene').style.display = 'none';
            if (_flipCardTimeout) { clearTimeout(_flipCardTimeout); _flipCardTimeout = null; }
        }


        // Stesso modale di apriImmagineIngrandita, ma per un URL diretto
        // (usato dalla galleria foto dettaglio, che non ha bisogno di
        // cercare la carta in carteReali dato che ha già l'URL pronto).
        function apriUrlIngrandito(url) {
            document.getElementById('immagineErroreMsg').style.display = 'none';
            document.getElementById('flipCardScene').style.display = 'none'; // A10: mai insieme alla scena flip
            const img = document.getElementById('immagineIngranditaImg');
            img.style.display = '';
            img.src = url;
            document.getElementById('immagineModal').style.display = 'flex';
        }
