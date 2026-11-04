// Impostazioni dell'account: preferenze, esportazione dati, cambio password.

async function caricaPreferenzeUtente() {
            const userId = await authGetUserId();
            if (!userId) return null;

            const { data, error } = await userSettingsGet(userId);
            if (error) { console.error('Errore caricamento preferenze:', error.message); return null; }

            if (data) {
                document.getElementById('notificheEmailInput').value = data.email_notifiche || '';
                document.getElementById('notificaChangelogCheck').checked = !!data.notifica_changelog;
                document.getElementById('notificaPrezziCheck').checked = !!data.notifica_prezzi;
                document.getElementById('notificaPrezziSoglia').value = data.soglia_prezzi ?? 5;
                document.getElementById('notificaWishlistCheck').checked = !!data.notifica_wishlist;
                document.getElementById('nascondiScambioCheck').checked = !!data.nascondi_scambio_da_match;
                document.getElementById('nascondiWishlistCheck').checked = !!data.nascondi_wishlist_da_match;
            }
            return data;
        }

        async function salvaPreferenzePrivacy() {
            const userId = await authGetUserId();
            if (!userId) return;
            const { error } = await userSettingsUpsertPrivacy(userId, {
                nascondiScambio: document.getElementById('nascondiScambioCheck').checked,
                nascondiWishlist: document.getElementById('nascondiWishlistCheck').checked,
            });
            if (error) { mostraAvviso('❌ Errore nel salvare la preferenza: ' + error.message); return; }
        }

        async function salvaPreferenzeNotifiche() {
            const userId = await authGetUserId();
            if (!userId) return;

            const email = document.getElementById('notificheEmailInput').value.trim();
            const { error } = await userSettingsUpsertNotifiche(userId, {
                email,
                notificaChangelog: document.getElementById('notificaChangelogCheck').checked,
                notificaPrezzi: document.getElementById('notificaPrezziCheck').checked,
                sogliaPrezzi: parseFloat(document.getElementById('notificaPrezziSoglia').value) || 5,
                notificaWishlist: document.getElementById('notificaWishlistCheck').checked,
            });
            if (error) { mostraAvviso('❌ Errore nel salvare le preferenze: ' + error.message); return; }
            mostraAvviso('✅ Preferenze salvate! (le notifiche vere e proprie non sono ancora attive — questa è la lista d\'attesa)');
        }

        async function ripristinaDisposizioneHome() {
            if (!(await chiediConferma({ titolo: 'Ripristinare la home?', testo: 'Le tessere tornano come al primo accesso, su questo dispositivo.', conferma: 'Ripristina' }))) return;
            const userId = await authGetUserId();
            if (!userId) return;
            prefWidgetLayoutRemove(userId);
            if (typeof _paginaWidgetCorrente !== 'undefined') _paginaWidgetCorrente = 0;
            await _caricaLayoutWidget();
            if (typeof renderWidgetHome === 'function') await renderWidgetHome();
            mostraAvviso('✅ Home ripristinata.');
        }

        async function esportaDati(formato) {
            const userId = await authGetUserId();
            if (!userId) return;

            const [{ data: carte }, { data: wishlistData }] = await Promise.all([
                _selectTuttePagine(cardsQueryTutte(userId)),
                _selectTuttePagine(wishlistQueryTutte(userId)),
            ]);

            const tutto = [
                ...(carte || []).map(r => ({ ...r, _origine: 'carte' })),
                ...(wishlistData || []).map(r => ({ ...r, _origine: 'wishlist' })),
            ];
            tutto.forEach(r => { delete r.immagine; });

            let contenuto, mime, estensione;
            if (formato === 'json') {
                contenuto = JSON.stringify(tutto, null, 2);
                mime = 'application/json';
                estensione = 'json';
            } else {
                const colonne = [...new Set(tutto.flatMap(r => Object.keys(r)))];
                const escapeCsv = (v) => {
                    if (v === null || v === undefined) return '';
                    let testo = String(v);
                    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(testo)) testo = "'" + testo;
                    const s = testo.replace(/"/g, '""');
                    return /[",\n]/.test(s) ? `"${s}"` : s;
                };
                contenuto = [colonne.join(',')].concat(
                    tutto.map(r => colonne.map(c => escapeCsv(r[c])).join(','))
                ).join('\n');
                mime = 'text/csv';
                estensione = 'csv';
            }

            const blob = new Blob([contenuto], { type: mime + ';charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `cardsync-export-${new Date().toISOString().slice(0, 10)}.${estensione}`;
            a.click();
            URL.revokeObjectURL(url);
        }

        async function cambiaPassword() {
            const nuova = document.getElementById('nuovaPasswordInput').value;
            if (!nuova || nuova.length < 6) { mostraAvviso('La password deve avere almeno 6 caratteri.'); return; }
            if (!(await chiediConferma({ titolo: 'Cambiare la password?', conferma: 'Cambia password' }))) return;

            const { error } = await authUpdatePassword(nuova);
            if (error) { mostraAvviso('❌ Errore nel cambiare la password: ' + error.message); return; }
            document.getElementById('nuovaPasswordInput').value = '';
            mostraAvviso('✅ Password cambiata con successo!');
        }
