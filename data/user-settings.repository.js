// Impostazioni dell'account sul server (preferenze_utente), uguali su tutti i dispositivi.

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

async function userSettingsUpsertBinderModalita(userId, modalita) {
    return supabaseClient.from('preferenze_utente').upsert({
        owner_id: userId, binder_modalita_visualizzazione: modalita, aggiornato_il: new Date().toISOString(),
    });
}

async function userSettingsUpsertMatchNascosti(userId, chiaviNascoste) {
    return supabaseClient.from('preferenze_utente').upsert({
        owner_id: userId,
        match_nascosti: JSON.stringify(chiaviNascoste || []),
        aggiornato_il: new Date().toISOString(),
    });
}

async function userSettingsUpsertDaFareRisolti(userId, mappaRisolti) {
    return supabaseClient.from('preferenze_utente').upsert({
        owner_id: userId,
        dafare_risolti: JSON.stringify(mappaRisolti || {}),
        aggiornato_il: new Date().toISOString(),
    });
}

async function userSettingsUpsertAchievementVetrina(userId, ids) {
    return supabaseClient.from('preferenze_utente').upsert({
        owner_id: userId,
        achievement_vetrina: JSON.stringify(ids || []),
        aggiornato_il: new Date().toISOString(),
    });
}

async function preferenzeUtentePing() {
    return supabaseClient.from('preferenze_utente').select('owner_id', { count: 'exact', head: true });
}
