-- ============================================================================
-- CardSync Pro — 52: Fase 6, Step 1 — Fondazioni DB Wishlist
-- (Riordinato dopo l'esecuzione live: gli helper _rank_* devono esistere
-- PRIMA delle funzioni di match che li usano, altrimenti CREATE FUNCTION
-- fallisce con "function does not exist". Contenuto identico a quanto
-- eseguito con successo su Supabase in questa sessione, solo riordinato.)
--
-- PARTE A — BUG TROVATO IN QUESTA SESSIONE: trova_match_scambio_wishlist e
-- trova_match_wishlist_scambio (sql/13) filtravano ancora su
-- c.location = 'SCAMBIO' — valore eliminato ovunque dalla migration Fase 3
-- (sql/45b, questa stessa sessione, tutte le carte migrate a location='?').
-- Da quel momento le due RPC non trovano più NESSUN match, sempre zero
-- righe — chiamate attivamente da ui/queue.ui.js (badge+pannello Match),
-- ui/widget-match.ui.js (widget Home), data/missioni.repository.js.
-- Corretto qui insieme al resto della Fase 6, sostituendo il filtro con
-- binder tipo='scambio' + quantita_offerta, stesso schema già in uso per
-- le RPC pubbliche (sql/45b/51).
--
-- ⚠ FIRMA LIVE DIVERSA DAL FILE STORICO sql/13: CREATE OR REPLACE su
-- trova_match_scambio_wishlist ha fallito live con "cannot change return
-- type of existing function" — la firma reale sul DB non combaciava con
-- quella scritta in sql/13 (ennesima conferma della lezione ricorrente:
-- mai fidarsi dei file sql/*.sql storici). Servito un DROP FUNCTION
-- esplicito prima del CREATE, come già fatto in sql/51 per lo stesso
-- motivo. I nomi di colonna restituiti sono stati verificati contro l'uso
-- REALE nel client (ui/queue.ui.js, ui/widget-match.ui.js) prima di
-- scrivere la nuova firma — combaciano.
--
-- PARTE B — Fase 6: match su identificatore stabile invece del solo nome.
-- 'codice' su carte/wishlist è già nel formato "SIGLA NUMERO" (es. "ASC
-- 123") — verificato in ui/set-libreria-sigle.ui.js. Confronto
-- case/trim-insensitive (upper(trim(...))).
--
-- PARTE C — Nessuna DDL sulla tabella 'wishlist' esistente: verificato dal
-- vivo (information_schema + pg_constraint) che lingua/condizione non hanno
-- NESSUN CHECK — si può ridefinire la SEMANTICA senza toccare lo schema:
--   - wishlist.condizione ora significa "condizione MINIMA accettata".
--   - wishlist.lingua: NULL o stringa vuota = "qualsiasi lingua".
-- Varianti/foil escluse dal match in questo giro (colonne di fatto morte
-- anche su carte, vedi compilato).
--
-- PARTE D — wishlist_sealed: tabella NUOVA, mirror di 'wishlist' (non di
-- 'prodotti_sealed', che ha colonne operative di inventario/claim senza
-- senso per una wishlist). Inserimento diretto dal client (stesso pattern
-- di sealedInsertRighe), MAI via coda_carte/completa_riga_coda_carte —
-- verificato dal vivo che quella funzione gestisce solo 'wishlist'/'carte'.
-- ============================================================================


-- ── Helper di ranking — usati dalle RPC di match sotto ───────────────────
CREATE OR REPLACE FUNCTION public._rank_condizione(p_condizione text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
    select case p_condizione
        when 'MT' then 7 when 'NM' then 6 when 'EX' then 5 when 'GD' then 4
        when 'LP' then 3 when 'PL' then 2 when 'PO' then 1
        else 0 -- valore ignoto/mancante: nessuna presunzione, in fondo alla scala
    end;
$$;

CREATE OR REPLACE FUNCTION public._rank_integrita(p_integrita text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
    select case p_integrita
        when 'sigillato_integro' then 4 when 'sigillo_danneggiato' then 3
        when 'confezione_danneggiata' then 2 when 'aperto_non_sealed' then 1
        else 0
    end;
$$;


-- ── wishlist_sealed ──────────────────────────────────────────────────────
CREATE TABLE public.wishlist_sealed (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id),
    nome text,
    codice text,
    set_espansione text,
    qty integer default 1,
    lingua text default 'IT', -- NULL o '' = qualsiasi lingua, stessa convenzione di wishlist.lingua
    integrita_minima text default 'sigillato_integro', -- confezione minima accettata
    prezzo_obiettivo numeric,
    note text,
    immagine text,
    created_at timestamptz default now()
);

ALTER TABLE public.wishlist_sealed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "utenti leggono la propria wishlist sealed" ON public.wishlist_sealed
    FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "utenti inseriscono nella propria wishlist sealed" ON public.wishlist_sealed
    FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "utenti aggiornano la propria wishlist sealed" ON public.wishlist_sealed
    FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "utenti eliminano dalla propria wishlist sealed" ON public.wishlist_sealed
    FOR DELETE USING (auth.uid() = owner_id);


-- ── trova_match_scambio_wishlist — RISCRITTA (DROP necessario, vedi nota
-- in cima al file: firma live diversa da sql/13) ────────────────────────
DROP FUNCTION IF EXISTS public.trova_match_scambio_wishlist(uuid);

CREATE FUNCTION public.trova_match_scambio_wishlist(p_owner_id uuid)
 RETURNS TABLE(mia_carta_id uuid, mio_nome text, mio_prezzo numeric, altro_owner_id uuid, altra_email text, altra_wishlist_id uuid, altro_prezzo_obiettivo numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select c.id, c.nome, c.prezzo, w.owner_id, u.email, w.id, w.prezzo_obiettivo
    from public.carte c
    join public.binder_carte bc on bc.carta_id = c.id
    join public.binders b on b.id = bc.binder_id and b.owner_id = c.owner_id and b.tipo = 'scambio'
    join public.wishlist w on upper(trim(w.codice)) = upper(trim(c.codice))
    join auth.users u on u.id = w.owner_id
    where c.owner_id = p_owner_id
      and c.stato = 'collezione'
      and c.codice is not null and trim(c.codice) <> ''
      and w.codice is not null and trim(w.codice) <> ''
      and (bc.quantita_offerta - coalesce((
            select sum(rsr.quantita_richiesta) from public.richieste_scambio_righe rsr
            where rsr.carta_id = c.id and rsr.stato_riga = 'accettata'
          ), 0)) > 0
      and w.owner_id != p_owner_id
      and (w.lingua is null or w.lingua = '' or w.lingua = c.lingua)
      and (w.prezzo_obiettivo is null or c.prezzo is null or c.prezzo <= w.prezzo_obiettivo)
      and public._rank_condizione(c.condizione) >= public._rank_condizione(w.condizione)
      and not exists (
        select 1 from preferenze_utente pu
        where pu.owner_id = w.owner_id and pu.nascondi_wishlist_da_match = true
      );
$function$;


-- ── trova_match_wishlist_scambio — RISCRITTA (DROP necessario) ──────────
DROP FUNCTION IF EXISTS public.trova_match_wishlist_scambio(uuid);

CREATE FUNCTION public.trova_match_wishlist_scambio(p_owner_id uuid)
 RETURNS TABLE(mia_wishlist_id uuid, mio_nome text, mio_prezzo_obiettivo numeric, altro_owner_id uuid, altra_email text, altra_carta_id uuid, altro_prezzo numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select w.id, w.nome, w.prezzo_obiettivo, c.owner_id, u.email, c.id, c.prezzo
    from public.wishlist w
    join public.carte c on upper(trim(c.codice)) = upper(trim(w.codice))
    join public.binder_carte bc on bc.carta_id = c.id
    join public.binders b on b.id = bc.binder_id and b.owner_id = c.owner_id and b.tipo = 'scambio'
    join auth.users u on u.id = c.owner_id
    where w.owner_id = p_owner_id
      and c.stato = 'collezione'
      and c.codice is not null and trim(c.codice) <> ''
      and w.codice is not null and trim(w.codice) <> ''
      and (bc.quantita_offerta - coalesce((
            select sum(rsr.quantita_richiesta) from public.richieste_scambio_righe rsr
            where rsr.carta_id = c.id and rsr.stato_riga = 'accettata'
          ), 0)) > 0
      and c.owner_id != p_owner_id
      and (w.lingua is null or w.lingua = '' or w.lingua = c.lingua)
      and (w.prezzo_obiettivo is null or c.prezzo is null or c.prezzo <= w.prezzo_obiettivo)
      and public._rank_condizione(c.condizione) >= public._rank_condizione(w.condizione)
      and not exists (
        select 1 from preferenze_utente pu
        where pu.owner_id = c.owner_id and pu.nascondi_scambio_da_match = true
      );
$function$;


-- ── trova_match_scambio_wishlist_sealed — NUOVA (nessuna firma precedente,
-- CREATE OR REPLACE basta) ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trova_match_scambio_wishlist_sealed(p_owner_id uuid)
 RETURNS TABLE(mio_prodotto_id uuid, mio_nome text, mio_prezzo numeric, altro_owner_id uuid, altra_email text, altra_wishlist_sealed_id uuid, altro_prezzo_obiettivo numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select p.id, p.nome, p.prezzo, ws.owner_id, u.email, ws.id, ws.prezzo_obiettivo
    from public.prodotti_sealed p
    join public.scaffale_prodotti sp on sp.prodotto_id = p.id
    join public.scaffali s on s.id = sp.scaffale_id and s.owner_id = p.owner_id and s.tipo = 'scambio'
    join public.wishlist_sealed ws on upper(trim(ws.codice)) = upper(trim(p.codice))
    join auth.users u on u.id = ws.owner_id
    where p.owner_id = p_owner_id
      and p.stato = 'collezione'
      and p.codice is not null and trim(p.codice) <> ''
      and ws.codice is not null and trim(ws.codice) <> ''
      and (sp.quantita_offerta - coalesce((
            select sum(rsr.quantita_richiesta) from public.richieste_scambio_righe rsr
            where rsr.prodotto_sealed_id = p.id and rsr.stato_riga = 'accettata'
          ), 0)) > 0
      and ws.owner_id != p_owner_id
      and (ws.lingua is null or ws.lingua = '' or ws.lingua = p.lingua)
      and (ws.prezzo_obiettivo is null or p.prezzo is null or p.prezzo <= ws.prezzo_obiettivo)
      and public._rank_integrita(p.integrita_packaging) >= public._rank_integrita(ws.integrita_minima)
      and not exists (
        select 1 from preferenze_utente pu
        where pu.owner_id = ws.owner_id and pu.nascondi_wishlist_da_match = true
      );
$function$;


-- ── trova_match_wishlist_scambio_sealed — NUOVA ──────────────────────────
CREATE OR REPLACE FUNCTION public.trova_match_wishlist_scambio_sealed(p_owner_id uuid)
 RETURNS TABLE(mia_wishlist_sealed_id uuid, mio_nome text, mio_prezzo_obiettivo numeric, altro_owner_id uuid, altra_email text, altro_prodotto_id uuid, altro_prezzo numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select ws.id, ws.nome, ws.prezzo_obiettivo, p.owner_id, u.email, p.id, p.prezzo
    from public.wishlist_sealed ws
    join public.prodotti_sealed p on upper(trim(p.codice)) = upper(trim(ws.codice))
    join public.scaffale_prodotti sp on sp.prodotto_id = p.id
    join public.scaffali s on s.id = sp.scaffale_id and s.owner_id = p.owner_id and s.tipo = 'scambio'
    join auth.users u on u.id = p.owner_id
    where ws.owner_id = p_owner_id
      and p.stato = 'collezione'
      and p.codice is not null and trim(p.codice) <> ''
      and ws.codice is not null and trim(ws.codice) <> ''
      and (sp.quantita_offerta - coalesce((
            select sum(rsr.quantita_richiesta) from public.richieste_scambio_righe rsr
            where rsr.prodotto_sealed_id = p.id and rsr.stato_riga = 'accettata'
          ), 0)) > 0
      and p.owner_id != p_owner_id
      and (ws.lingua is null or ws.lingua = '' or ws.lingua = p.lingua)
      and (ws.prezzo_obiettivo is null or p.prezzo is null or p.prezzo <= ws.prezzo_obiettivo)
      and public._rank_integrita(p.integrita_packaging) >= public._rank_integrita(ws.integrita_minima)
      and not exists (
        select 1 from preferenze_utente pu
        where pu.owner_id = p.owner_id and pu.nascondi_scambio_da_match = true
      );
$function$;


-- ============================================================================
-- STATO: ESEGUITO E VERIFICATO IN QUESTA SESSIONE (2026-09-13).
-- select proname from pg_proc where proname in (
--   'trova_match_scambio_wishlist','trova_match_wishlist_scambio',
--   'trova_match_scambio_wishlist_sealed','trova_match_wishlist_scambio_sealed',
--   '_rank_condizione','_rank_integrita'
-- ); -- ha confermato tutte e 6 presenti.
-- ============================================================================
