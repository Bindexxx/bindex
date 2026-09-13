-- ============================================================================
-- CardSync Pro — 45: Fase 3, Step 1 — Fondazioni DB per Scambio (Binder
-- Scambio carte + Scaffale Scambio sealed), sostituisce location='SCAMBIO'
--
-- Verificato dal vivo prima di scrivere (Regola d'Oro #3):
--  - Un solo utente ha oggi un binder tipo='location'/location_valore=
--    'SCAMBIO' (pubblico, layout 4x4) — raggio di migrazione piccolo.
--  - binder_carte non ha colonne quantità.
--  - carte.location è testo libero, nessun FK/CHECK — '?' è già un valore
--    in uso (Centro Operativo, oggetti non ancora collocati).
--  - Il trigger _binders_forza_condivisione (creato live, non versionato
--    prima d'ora — letto per intero via pg_get_functiondef) forza SEMPRE
--    pubblico per tipo='wishlist' o (tipo='location' AND location_valore=
--    'SCAMBIO') — va esteso per il nuovo tipo='scambio', altrimenti un
--    binder Scambio nuovo nascerebbe privato per errore.
--  - leggi_binder_pubblico(p_binder_id) branch solo su tipo='location'/
--    'extra' — 'scambio' andrebbe silenzioso (nessuna riga, mai un errore
--    visibile, ma sbagliato). Aggiunto un terzo branch, STESSA firma di
--    ritorno (riuso lo slot 'qty' per portare quantita_offerta — niente
--    DROP+CREATE, la firma non cambia).
--
-- Migrazione dell'unico binder Scambio esistente: RIUSO lo stesso binder
-- (stesso id → stesso link pubblico/QR continua a funzionare, stesso
-- layout 4x4) — cambio solo tipo e azzero location_valore, non ne creo uno
-- nuovo. Le carte con location='SCAMBIO' di quell'utente: quantita_offerta
-- parte da 0 (decisione esplicita di Claudio: l'utente la imposta a mano),
-- location riportata a '?' (Centro Operativo — la location fisica
-- originale è persa, sovrascritta da 'SCAMBIO' a suo tempo).
-- ============================================================================

-- ── 1. CHECK: nuovo tipo 'scambio' su binders e scaffali ──────────────────
ALTER TABLE public.binders DROP CONSTRAINT binders_tipo_check;
ALTER TABLE public.binders ADD CONSTRAINT binders_tipo_check
  CHECK (tipo = ANY (ARRAY['location'::text, 'wishlist'::text, 'extra'::text, 'scambio'::text]));

ALTER TABLE public.scaffali DROP CONSTRAINT scaffali_tipo_check;
ALTER TABLE public.scaffali ADD CONSTRAINT scaffali_tipo_check
  CHECK (tipo = ANY (ARRAY['libero'::text, 'vetrina'::text, 'scambio'::text]));


-- ── 2. Colonne quantità offerta ────────────────────────────────────────────
ALTER TABLE public.binder_carte ADD COLUMN quantita_offerta integer NOT NULL DEFAULT 0;
ALTER TABLE public.scaffale_prodotti ADD COLUMN quantita_offerta integer NOT NULL DEFAULT 0;


-- ── 3. Trigger pubblicazione forzata: esteso per tipo='scambio' ───────────
CREATE OR REPLACE FUNCTION public._binders_forza_condivisione()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
    if new.tipo = 'wishlist'
       or new.tipo = 'scambio'
       or (new.tipo = 'location' and new.location_valore = 'SCAMBIO') then
        -- Wishlist e Scambio: sempre pubblici, l'utente non può renderli
        -- privati — qualunque valore arrivi dal client viene sovrascritto.
        -- Il ramo location='SCAMBIO' resta per compatibilità storica (non
        -- dovrebbe più esistere nessuna riga così dopo il blocco 5 sotto,
        -- ma non c'è motivo di romperlo se qualcosa sfuggisse).
        new.condivisibile := true;
        new.stato_pubblicazione := 'pubblico';
    end if;
    return new;
end;
$function$;


-- ── 4. leggi_binder_pubblico: nuovo ramo 'scambio' ────────────────────────
-- STESSA firma di ritorno di sql/22 — riuso lo slot 'qty' per portare
-- quantita_offerta, invece di aggiungere una colonna (eviterebbe DROP+CREATE
-- per un cambio di RETURNS TABLE). Il pubblico vede solo la quantità
-- offerta, mai la qty realmente posseduta né la location fisica.
CREATE OR REPLACE FUNCTION public.leggi_binder_pubblico(p_binder_id uuid)
returns table(
    id uuid, nome text, codice text, lingua text, condizione text,
    qty integer, prezzo numeric, note text, url text, immagine text
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
    v_binder record;
begin
    select * into v_binder from public.binders where id = p_binder_id and stato_pubblicazione = 'pubblico';
    if v_binder is null then
        return;
    end if;

    if v_binder.tipo = 'location' then
        return query
        select c.id, c.nome, c.codice, c.lingua, c.condizione, c.qty, c.prezzo, c.note, c.url, c.immagine
        from public.carte c
        where c.owner_id = v_binder.owner_id
          and c.location = v_binder.location_valore
          and c.stato = 'collezione'
        order by c.nome;
    elsif v_binder.tipo = 'extra' then
        return query
        select c.id, c.nome, c.codice, c.lingua, c.condizione, c.qty, c.prezzo, c.note, c.url, c.immagine
        from public.carte c
        join public.binder_carte bc on bc.carta_id = c.id
        where bc.binder_id = p_binder_id
          and bc.owner_id = v_binder.owner_id
          and c.owner_id = v_binder.owner_id
          and c.stato = 'collezione'
        order by c.nome;
    elsif v_binder.tipo = 'scambio' then
        -- Fase 3, Step 1 (2026-09-12): quantita_offerta al posto di qty —
        -- il pubblico vede quanto è offerto, non quanto è posseduto. Solo
        -- righe con quantita_offerta > 0 (offerta a 0 = non ancora messa
        -- in vendita, non deve comparire nella vetrina pubblica).
        return query
        select c.id, c.nome, c.codice, c.lingua, c.condizione, bc.quantita_offerta as qty, c.prezzo, c.note, c.url, c.immagine
        from public.carte c
        join public.binder_carte bc on bc.carta_id = c.id
        where bc.binder_id = p_binder_id
          and bc.owner_id = v_binder.owner_id
          and c.owner_id = v_binder.owner_id
          and c.stato = 'collezione'
          and bc.quantita_offerta > 0
        order by c.nome;
    end if;
    -- tipo 'wishlist': mai raggiunto da qui, vedi nota storica in sql/22.
end;
$$;


-- ── 5. Migrazione dell'unico binder Scambio esistente ─────────────────────
DO $$
DECLARE
    v_binder record;
BEGIN
    FOR v_binder IN
        SELECT id, owner_id FROM public.binders WHERE tipo = 'location' AND location_valore = 'SCAMBIO'
    LOOP
        -- Riuso lo stesso binder: stesso id, stesso layout, stesso link.
        UPDATE public.binders SET tipo = 'scambio', location_valore = NULL WHERE id = v_binder.id;

        -- Le carte offerte diventano righe binder_carte (quantita_offerta
        -- parte da 0, decisione esplicita di Claudio).
        INSERT INTO public.binder_carte (owner_id, carta_id, binder_id, quantita_offerta)
        SELECT c.owner_id, c.id, v_binder.id, 0
        FROM public.carte c
        WHERE c.owner_id = v_binder.owner_id AND c.location = 'SCAMBIO' AND c.stato = 'collezione'
        ON CONFLICT (owner_id, binder_id, carta_id) DO NOTHING;

        -- La location fittizia 'SCAMBIO' sparisce, le carte tornano al
        -- Centro Operativo ('?') — la location fisica originale è persa
        -- (sovrascritta da 'SCAMBIO' a suo tempo), decisione esplicita di
        -- Claudio.
        UPDATE public.carte SET location = '?' WHERE owner_id = v_binder.owner_id AND location = 'SCAMBIO' AND stato = 'collezione';
    END LOOP;
END $$;


-- ============================================================================
-- VERIFICA POST-ESECUZIONE
-- ============================================================================
-- select tipo, location_valore from binders where id = (
--   select id from binders where tipo = 'scambio' limit 1
-- );
-- -- tipo='scambio', location_valore=null
--
-- select count(*) from carte where location = 'SCAMBIO';
-- -- deve essere 0
--
-- select count(*) from binder_carte bc join binders b on b.id = bc.binder_id where b.tipo = 'scambio';
-- -- quante carte sono state migrate (atteso: quante carte aveva quell'utente in SCAMBIO)
--
-- select pg_get_functiondef(oid) from pg_proc where proname = 'leggi_binder_pubblico';
-- -- deve contenere il ramo elsif v_binder.tipo = 'scambio'
