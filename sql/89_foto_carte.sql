-- ═══════════════════════════════════════════════════════════════════════
-- 89_foto_carte.sql — 2026-10-01 (Restyle Bindex, FASE 8c)
-- Rollback: 89_foto_carte_ROLLBACK.sql
--
-- FOTO REALI DELLE CARTE (fronte, retro, fino a 4 difetti con etichetta).
-- Decisioni (tavole approvate + Claudio 2026-10-01): solo carte (non sealed);
-- foto visibili al proprietario e, per tutti gli altri (gruppo e anonimi),
-- SOLO per le carte che stanno in un binder pubblico; nessuna approvazione
-- admin; nulla di obbligatorio; missione "fotografa N carte" rimandata.
--
-- VERIFICATO sul DB live prima di scrivere (2026-10-01):
--  - foto_carte(id, carta_id NOT NULL senza FK, tabella default 'carte',
--    owner_id FK auth.users, storage_path, nota, creato_il); policy unica
--    "ALL owner_id = auth.uid()"; nessun trigger; 0 righe.
--  - bucket foto-carte pubblico, nessun limite; storage: lettura pubblica,
--    insert/delete solo nella cartella <uid>/.
--  - leggi_binder_pubblico: location → carte.location = location_valore;
--    extra → binder_carte; scambio → binder_carte con quantita_offerta > 0;
--    sempre carte.stato = 'collezione'.
--  - carte: trigger solo su update/insert (prezzi/updated_at), nessuno su delete.
-- Nota: la RLS chiedeva solo owner_id = auth.uid(), quindi si poteva
-- attaccare una foto a una carta altrui: il trigger qui sotto lo impedisce.
-- ═══════════════════════════════════════════════════════════════════════

-- 1) SCHEMA ---------------------------------------------------------------
ALTER TABLE public.foto_carte
    ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'difetto',
    ADD COLUMN IF NOT EXISTS etichetta text;
ALTER TABLE public.foto_carte
    ADD CONSTRAINT foto_carte_tipo_check CHECK (tipo IN ('fronte', 'retro', 'difetto')),
    ADD CONSTRAINT foto_carte_etichetta_check CHECK (etichetta IS NULL OR (tipo = 'difetto' AND etichetta IN ('angolo', 'bordo', 'graffio', 'centratura', 'stampa', 'altro'))),
    ADD CONSTRAINT foto_carte_tabella_check CHECK (tabella IN ('carte', 'prodotti_sealed'));
CREATE UNIQUE INDEX IF NOT EXISTS foto_carte_un_fronte_retro ON public.foto_carte (carta_id, tabella, tipo) WHERE tipo IN ('fronte', 'retro');
CREATE INDEX IF NOT EXISTS idx_foto_carte_carta ON public.foto_carte (carta_id);
CREATE INDEX IF NOT EXISTS idx_foto_carte_owner ON public.foto_carte (owner_id);

-- File da togliere dallo storage dopo la cancellazione di una carta (il DB
-- non può cancellare i file del bucket: lo fa il sito del proprietario).
CREATE TABLE IF NOT EXISTS public.foto_carte_da_pulire (
    storage_path text PRIMARY KEY,
    owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    creato_il timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.foto_carte_da_pulire ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proprietario legge i propri file da pulire" ON public.foto_carte_da_pulire
    FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "proprietario toglie i propri file da pulire" ON public.foto_carte_da_pulire
    FOR DELETE USING (auth.uid() = owner_id);

-- 2) CONTROLLI SU INSERT/UPDATE ------------------------------------------
CREATE OR REPLACE FUNCTION public._foto_carte_controlla()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_difetti integer;
begin
    if new.tabella = 'carte' then
        if not exists (select 1 from carte where id = new.carta_id and owner_id = new.owner_id) then
            raise exception 'Puoi fotografare solo le tue carte';
        end if;
    elsif new.tabella = 'prodotti_sealed' then
        if not exists (select 1 from prodotti_sealed where id = new.carta_id and owner_id = new.owner_id) then
            raise exception 'Puoi fotografare solo i tuoi prodotti';
        end if;
    end if;
    if split_part(new.storage_path, '/', 1) <> new.owner_id::text then
        raise exception 'Percorso del file non valido';
    end if;
    if new.tipo = 'difetto' and (tg_op = 'INSERT' or old.tipo <> 'difetto') then
        select count(*) into v_difetti from foto_carte
        where carta_id = new.carta_id and tabella = new.tabella and tipo = 'difetto' and id <> new.id;
        if v_difetti >= 4 then raise exception 'Al massimo 4 foto di difetti per carta'; end if;
    end if;
    return new;
end;
$function$;
DROP TRIGGER IF EXISTS trg_foto_carte_controlla ON public.foto_carte;
CREATE TRIGGER trg_foto_carte_controlla BEFORE INSERT OR UPDATE ON public.foto_carte
    FOR EACH ROW EXECUTE FUNCTION public._foto_carte_controlla();

-- 3) PULIZIA QUANDO LA CARTA SPARISCE ------------------------------------
CREATE OR REPLACE FUNCTION public._foto_carte_pulisci_oggetto()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_tabella text := tg_table_name;
begin
    insert into foto_carte_da_pulire (storage_path, owner_id)
    select f.storage_path, f.owner_id from foto_carte f
    where f.carta_id = old.id and f.tabella = v_tabella
    on conflict (storage_path) do nothing;
    delete from foto_carte where carta_id = old.id and tabella = v_tabella;
    return old;
end;
$function$;
DROP TRIGGER IF EXISTS trg_carte_pulisci_foto ON public.carte;
CREATE TRIGGER trg_carte_pulisci_foto AFTER DELETE ON public.carte
    FOR EACH ROW EXECUTE FUNCTION public._foto_carte_pulisci_oggetto();
DROP TRIGGER IF EXISTS trg_prodotti_sealed_pulisci_foto ON public.prodotti_sealed;
CREATE TRIGGER trg_prodotti_sealed_pulisci_foto AFTER DELETE ON public.prodotti_sealed
    FOR EACH ROW EXECUTE FUNCTION public._foto_carte_pulisci_oggetto();

-- 4) LETTURA (proprietario o carta in un binder pubblico) -----------------
CREATE OR REPLACE FUNCTION public._carta_in_binder_pubblico(p_carta_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select exists (
        select 1
        from carte c
        join binders b on b.owner_id = c.owner_id and b.stato_pubblicazione = 'pubblico'
        where c.id = p_carta_id and c.stato = 'collezione'
          and (
              (b.tipo = 'location' and c.location = b.location_valore)
           or (b.tipo in ('extra', 'scambio') and exists (
                  select 1 from binder_carte bc
                  where bc.binder_id = b.id and bc.carta_id = c.id and bc.owner_id = c.owner_id
                    and (b.tipo <> 'scambio' or bc.quantita_offerta > 0)))
          )
    );
$function$;
REVOKE ALL ON FUNCTION public._carta_in_binder_pubblico(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._foto_carte_controlla() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._foto_carte_pulisci_oggetto() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.leggi_foto_carte(p_carta_ids uuid[])
 RETURNS TABLE(carta_id uuid, tipo text, etichetta text, storage_path text, creato_il timestamptz)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select f.carta_id, f.tipo, f.etichetta, f.storage_path, f.creato_il
    from foto_carte f
    where f.tabella = 'carte'
      and f.carta_id = any(p_carta_ids)
      and coalesce(array_length(p_carta_ids, 1), 0) <= 200
      and (f.owner_id = auth.uid() or _carta_in_binder_pubblico(f.carta_id))
    order by f.carta_id,
             case f.tipo when 'fronte' then 0 when 'retro' then 1 else 2 end,
             f.creato_il;
$function$;
REVOKE ALL ON FUNCTION public.leggi_foto_carte(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leggi_foto_carte(uuid[]) TO anon, authenticated, service_role;

-- 5) BUCKET: solo immagini, al massimo 3 MB (il sito le riduce prima) -----
UPDATE storage.buckets
SET file_size_limit = 3145728, allowed_mime_types = ARRAY['image/jpeg', 'image/webp', 'image/png']
WHERE id = 'foto-carte';
