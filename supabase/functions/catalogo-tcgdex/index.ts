// catalogo-tcgdex — giro notturno del catalogo (sql/140). La chiama pg_cron ogni 20 minuti di notte.
// 1. una volta al giorno: elenco dei set di TCGdex → i set nuovi vanno "da confermare" (pagina admin);
// 2. a ogni giro: un set recente, al massimo MAX_CARTE carte → aggiunge solo quello che manca nel
//    catalogo (_catalogo_tcgdex_scrivi). Non cancella e non sovrascrive niente.
// Regola delle varianti: la stessa della prima importazione (rifatta su Buio Pesto, sql/139).
import { createClient } from "npm:@supabase/supabase-js@2";

const TCG = "https://api.tcgdex.net/v2";
const MAX_CARTE = 80;            // carte per giro (TCGdex si blocca con troppe richieste di fila)
const PAUSA_MS = 350;            // pausa tra una carta e l'altra
const LIMITE_MS = 100_000;       // il piano free chiude la funzione a 150 s
const TIMBRI_DEL_SET = new Set(["30th-anniversary"]);   // timbro su tutte le carte del set: non è una versione

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const dormi = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function tcg(percorso: string): Promise<any | null> {
  for (let tentativo = 0; tentativo < 3; tentativo++) {
    try {
      const r = await fetch(TCG + percorso, { signal: AbortSignal.timeout(15_000) });
      if (r.status === 404) return null;
      if (r.ok) return await r.json();
    } catch (_) { /* riprova */ }
    await dormi(3000);
  }
  throw new Error("TCGdex non risponde: " + percorso);
}

type Riga = { numero: number; variante: string; nome: string | null; rarita: string | null; immagine: string | null; cardmarket_id: number | null };

// Una carta di TCGdex → le sue righe del catalogo.
export function righeDiCarta(c: any, nomeIt: string | null): Riga[] {
  if (!/^\d+$/.test(String(c.localId ?? ""))) return [];
  const vd: any[] = Array.isArray(c.variants_detailed) ? c.variants_detailed : [];
  const haNormal = vd.some((v) => v.type === "normal");
  const per = new Map<string, number | null>();
  for (const v of vd) {
    const extra = ([] as string[]).concat(v.foil ?? [], v.stamp ?? []).filter((x) => !TIMBRI_DEL_SET.has(x));
    const ex = extra.length ? extra.join("-") : null;
    let k: string;
    if (v.type === "normal") k = ex ? "normale-" + ex : "normale";
    else if (v.type === "reverse") k = ex ? "reverse-" + ex : "reverse";
    else if (v.type === "holo") k = ex ? "holo-" + ex : (haNormal ? "holo" : "normale");
    else continue;
    const cm = v.thirdParty?.cardmarket ?? null;
    if (!per.has(k) || (per.get(k) == null && cm != null)) per.set(k, cm);
  }
  const rarita = c.rarity && c.rarity !== "None" ? String(c.rarity) : null;
  const immagine = c.image ? String(c.image) + "/low.webp" : null;
  return [...per.entries()].map(([variante, cm]) => ({
    numero: parseInt(c.localId, 10), variante, nome: nomeIt || c.name || null, rarita, immagine,
    cardmarket_id: typeof cm === "number" ? cm : null,
  }));
}

async function registra(tipo: string, esito: unknown) {
  await db.from("catalogo_giri").insert({ tipo, esito });
}

// 1. set nuovi su TCGdex, una volta al giorno
async function controllaElenco() {
  const oggi = new Date().toISOString().slice(0, 10);
  const { data: fatto } = await db.from("catalogo_giri").select("id").eq("tipo", "elenco").gte("il", oggi).limit(1);
  if (fatto && fatto.length) return null;
  const elenco: any[] = (await tcg("/en/sets")) ?? [];
  const { data: noti } = await db.from("catalogo_tcgdex").select("tcgdex_id");
  const visti = new Set((noti ?? []).map((x: any) => x.tcgdex_id));
  const nuovi: string[] = [];
  let tutti = true;
  for (const s of elenco) {
    if (!s?.id || visti.has(s.id)) continue;
    if (nuovi.length >= 10) { tutti = false; break; }   // tanti set nuovi insieme: il resto al giro dopo
    const d = await tcg("/en/sets/" + encodeURIComponent(s.id));
    await dormi(PAUSA_MS);
    const it = await tcg("/it/sets/" + encodeURIComponent(s.id)).catch(() => null);
    await dormi(PAUSA_MS);
    const pocket = d?.serie?.id === "tcgp" || /^(?:[AB]\d+[a-z]?|P-[A-Z])$/.test(s.id);
    await db.from("catalogo_tcgdex").insert({
      tcgdex_id: s.id,
      stato: pocket ? "ignorato" : "da_confermare",
      nome_en: d?.name ?? s.name ?? null,
      nome_it: it?.name ?? null,
      sigla_proposta: d?.abbreviation?.official ?? null,
      serie: d?.serie?.id ?? null,
      data_uscita: d?.releaseDate ?? null,
      carte_base: d?.cardCount?.official ?? null,
      carte_totali: d?.cardCount?.total ?? null,
      nota: pocket ? "TCG Pocket (gioco digitale)" : null,
    });
    nuovi.push(s.id + (pocket ? " (Pocket)" : ""));
  }
  const esito = { set_su_tcgdex: elenco.length, nuovi };
  if (tutti) await registra("elenco", esito);   // segnato fatto per oggi solo se ha visto tutti i set
  return esito;
}

// 2. un set recente, un pezzo per giro
async function aggiornaUnSet(inizio: number) {
  const { data: prossimi, error } = await db.rpc("_catalogo_prossimo_set");
  if (error) throw new Error(error.message);
  const p = prossimi?.[0];
  if (!p) return { set: null };
  const set = await tcg("/en/sets/" + encodeURIComponent(p.tcgdex_id));
  if (!set) {
    await db.rpc("_catalogo_segna", { p_sigla: p.sigla, p_cursore: 0, p_finito: true, p_esito: "set non trovato su TCGdex" });
    return { set: p.sigla, errore: "non trovato su TCGdex" };
  }
  const it = await tcg("/it/sets/" + encodeURIComponent(p.tcgdex_id)).catch(() => null);
  const nomiIt = new Map<string, string>((it?.cards ?? []).map((c: any) => [c.localId, c.name]));
  const carte: any[] = set.cards ?? [];
  const da = Math.min(p.cursore ?? 0, carte.length);
  const righe: Riga[] = [];
  let i = da;
  for (; i < carte.length && i < da + MAX_CARTE && Date.now() - inizio < LIMITE_MS; i++) {
    const c = await tcg("/en/cards/" + encodeURIComponent(carte[i].id));
    if (c) righe.push(...righeDiCarta(c, nomiIt.get(c.localId) ?? null));
    await dormi(PAUSA_MS);
  }
  const { data: scritto, error: e2 } = await db.rpc("_catalogo_tcgdex_scrivi", { p_sigla: p.sigla, p_righe: righe });
  if (e2) throw new Error(e2.message);
  const finito = i >= carte.length;
  const esito = { set: p.sigla, carte: `${da + 1}-${i} di ${carte.length}`, ...scritto };
  await db.rpc("_catalogo_segna", { p_sigla: p.sigla, p_cursore: i, p_finito: finito, p_esito: JSON.stringify(esito) });
  return esito;
}

Deno.serve(async (req) => {
  const inizio = Date.now();
  const segreto = req.headers.get("x-bindex-segreto") ?? "";
  const { data: ok } = await db.rpc("_catalogo_cron_ok", { p_segreto: segreto });
  if (ok !== true) return new Response("no", { status: 401 });
  const risposta: Record<string, unknown> = {};
  try {
    risposta.elenco = await controllaElenco();
    risposta.set = await aggiornaUnSet(inizio);
    await registra("set", risposta.set);
  } catch (e) {
    risposta.errore = String((e as Error)?.message ?? e);
    await registra("errore", risposta).catch(() => {});
  }
  return new Response(JSON.stringify(risposta), { headers: { "content-type": "application/json" } });
});
