// ── data/user-settings.repository.js ─────────────────────────────────────
// Tabella 'preferenze_utente' — impostazioni account salvate lato server
// (notifiche, privacy match, tab predefinita), sincronizzate tra
// dispositivi. Da NON confondere con data/preferences.repository.js, che
// gestisce le preferenze locali per-dispositivo in localStorage (dark
// mode, layout Binder, ecc. — quelle non sincronizzano tra dispositivi).
//
// Dipende da: supabaseClient.

async function userSettingsGet(userId) {
    return supabaseClient.from('preferenze_utente').select('*').eq('owner_id', userId).maybeSingle();
}

async function userSettingsUpsertPrivacy(userId, { nascondiScambio, nascondiWishlist }) {
    return supabaseClient.from('preferenze_utente').upsert({
        owner_id: userId,
        nascondi_scambio_da_match: nascondiScambio,
        nascondi_wishlist_da_match: nascondiWishlist,
        aggiornato_il: new Date().toISOString(),
    });
}

async function userSettingsUpsertNotifiche(userId, { email, notificaChangelog, notificaPrezzi, sogliaPrezzi, notificaWishlist }) {
    return supabaseClient.from('preferenze_utente').upsert({
        owner_id: userId,
        email_notifiche: email || null,
        notifica_changelog: notificaChangelog,
        notifica_prezzi: notificaPrezzi,
        soglia_prezzi: sogliaPrezzi,
        notifica_wishlist: notificaWishlist,
        aggiornato_il: new Date().toISOString(),
    });
}

async function userSettingsUpsertTabPredefinita(userId, valore) {
    return supabaseClient.from('preferenze_utente').upsert({
        owner_id: userId, tab_predefinita: valore, aggiornato_il: new Date().toISOString(),
    });
}

// Multi-Binder (2026-08-25): 'immagini' o 'elenco', globale per utente —
// vedi 18_preferenza_binder_modalita.sql. Sincronizzata tra dispositivi,
// per questo vive qui e non in data/preferences.repository.js.
async function userSettingsUpsertBinderModalita(userId, modalita) {
    return supabaseClient.from('preferenze_utente').upsert({
        owner_id: userId, binder_modalita_visualizzazione: modalita, aggiornato_il: new Date().toISOString(),
    });
}

// Aggiunta 2026-08-28 (pagina Match, "nascondi persistente" per-utente —
// vedi migration 30_preferenze_match_nascosti.sql). match_nascosti è
// TEXT, non JSONB (stessa scelta di colonna delle altre in questo file):
// qui il client serializza l'array di chiavi con JSON.stringify, chi
// legge (userSettingsGet) lo riceve grezzo e lo fa JSON.parse da sé.
async function userSettingsUpsertMatchNascosti(userId, chiaviNascoste) {
    return supabaseClient.from('preferenze_utente').upsert({
        owner_id: userId,
        match_nascosti: JSON.stringify(chiaviNascoste || []),
        aggiornato_il: new Date().toISOString(),
    });
}
