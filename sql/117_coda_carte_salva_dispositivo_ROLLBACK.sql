-- ROLLBACK di sql/117: _coda_carte_view_update com'era sul DB live il
-- 2026-10-15 (letta con pg_get_functiondef), senza il salvataggio di
-- dispositivo.
CREATE OR REPLACE FUNCTION public._coda_carte_view_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_io uuid := auth.uid();
  v_proprietario boolean;
begin
  -- sql/114: chi può modificare una riga di coda. Una modifica non permessa
  -- non dà errore: la riga resta com'è (return null = riga non toccata).
  v_proprietario := old.owner_id = v_io or is_admin();
  if not v_proprietario then
    if v_io is null then
      return null;
    end if;
    if not (
         old.claimed_by = v_io                                   -- già in carico a me
      or (new.claimed_by = v_io and new.stato = 'in_corso'        -- la prendo in carico ora
          and (old.stato = 'pending'
               or (old.stato = 'in_corso' and old.claimed_at < now() - interval '10 minutes')))
    ) then
      return null;
    end if;
    -- nome e link della richiesta sono del proprietario
    if new.nome is distinct from old.nome or new.url_diretto is distinct from old.url_diretto then
      return null;
    end if;
    -- la presa in carico si può solo dare a sé stessi o togliere
    if new.claimed_by is distinct from old.claimed_by and new.claimed_by is not null and new.claimed_by <> v_io then
      return null;
    end if;
  end if;

  if not (new.url_diretto is null or new.url_diretto in ('', '#') or (new.url_diretto ~ '^https://(www\.)?cardmarket\.com/' and new.url_diretto !~ '[[:space:]"<>'']')) then
    raise exception 'Link non valido: e'' ammesso solo un indirizzo https://www.cardmarket.com/';
  end if;
  update coda_lavoro set
    stato          = coalesce(new.stato, stato),
    errore_msg     = new.errore_msg,
    claimed_by     = new.claimed_by,
    claimed_at     = new.claimed_at,
    completato_il  = new.completato_il,
    tentativi_falliti = coalesce(new.tentativi_falliti, tentativi_falliti),
    esito          = case when new.opzioni_disambiguazione is not null
                          then jsonb_build_object('opzioni_disambiguazione', new.opzioni_disambiguazione)
                          else esito end,
    payload        = payload || jsonb_strip_nulls(jsonb_build_object('nome', new.nome, 'url_diretto', new.url_diretto))
  where id = old.id;
  return new;
end;
$function$;
