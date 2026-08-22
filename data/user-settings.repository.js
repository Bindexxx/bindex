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
