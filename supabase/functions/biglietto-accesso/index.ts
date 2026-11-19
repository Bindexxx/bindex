// biglietto-accesso — un solo accesso tra sito ed estensione (estensione 5.83).
// Chi è già dentro da una parte (sito o estensione) chiede un biglietto monouso con cui l'altra parte
// entra con una sessione SUA. Il token di refresh non passa mai da una parte all'altra (audit C3: due
// client che rinnovano lo stesso token si buttano fuori a vicenda).
// Il biglietto è un magic link generato senza mandare email (auth.admin.generateLink): vale una volta
// sola, al massimo un'ora, e ne vale solo l'ultimo creato; l'altra parte lo usa con
// verifyOtp({ token_hash, type }).
// Solo per l'account di chi chiama e solo se l'account è attivo (gli stessi controlli di auth_ui.js).
// verify_jwt acceso: senza una sessione valida la richiesta non arriva qui.
import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGINE_SITO = "https://bindexxx.github.io";
const URL_PROGETTO = Deno.env.get("SUPABASE_URL")!;
const CHIAVE_ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}").default;
const SENZA_SESSIONE = { persistSession: false, autoRefreshToken: false };

// service_role serve solo per Auth (getUser, generateLink): sulle tabelle di public non ha SELECT.
const admin = createClient(URL_PROGETTO, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: SENZA_SESSIONE });

// CORS per il sito; il service worker dell'estensione ha il permesso sull'indirizzo di Supabase.
function intestazioni(req: Request): Record<string, string> {
  const origine = req.headers.get("Origin") ?? "";
  const ammessa = origine === ORIGINE_SITO || origine.startsWith("chrome-extension://");
  return {
    "Access-Control-Allow-Origin": ammessa ? origine : ORIGINE_SITO,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
}

function risposta(req: Request, stato: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), { status: stato, headers: intestazioni(req) });
}

function sospeso(fino: string | null | undefined): boolean {
  return !!fino && new Date(fino) > new Date();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: intestazioni(req) });
  if (req.method !== "POST") return risposta(req, 405, { ok: false, errore: "solo POST" });

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return risposta(req, 401, { ok: false, errore: "accesso mancante" });

  // getUser chiede al server di Auth: firma, scadenza e sessione ancora aperta (una sessione chiusa
  // con "Esci" non chiede più biglietti anche se il suo token non è ancora scaduto).
  const { data: letto, error: errUtente } = await admin.auth.getUser(jwt);
  const utente = letto?.user;
  if (errUtente || !utente || !utente.email || utente.is_anonymous) {
    return risposta(req, 401, { ok: false, errore: "accesso non valido" });
  }
  if (sospeso(utente.banned_until)) return risposta(req, 403, { ok: false, errore: "account non attivo" });

  // il profilo si legge come l'utente (policy "utente vede il proprio profilo"), come fa auth_ui.js
  const comeUtente = createClient(URL_PROGETTO, CHIAVE_ANON, {
    auth: SENZA_SESSIONE,
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: profilo, error: errProfilo } = await comeUtente
    .from("profiles").select("banned_until, deleted_at").eq("id", utente.id).maybeSingle();
  if (errProfilo) {
    console.error("[biglietto-accesso] profilo:", errProfilo.message);
    return risposta(req, 500, { ok: false, errore: "profilo non letto" });
  }
  if (!profilo || profilo.deleted_at || sospeso(profilo.banned_until)) {
    return risposta(req, 403, { ok: false, errore: "account non attivo" });
  }

  const { data: link, error: errLink } = await admin.auth.admin.generateLink({ type: "magiclink", email: utente.email });
  const biglietto = link?.properties?.hashed_token;
  if (errLink || !biglietto) {
    console.error("[biglietto-accesso] generateLink:", errLink?.message ?? "nessun token");
    return risposta(req, 500, { ok: false, errore: "biglietto non creato" });
  }
  console.log("[biglietto-accesso] biglietto creato per", utente.id.slice(0, 8));
  return risposta(req, 200, {
    ok: true,
    biglietto,
    tipo: link.properties.verification_type || "magiclink",
    userId: utente.id,
  });
});
