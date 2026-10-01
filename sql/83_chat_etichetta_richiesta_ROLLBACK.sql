-- Rollback di sql/83: ripristina invia_messaggio(uuid, text) com'era e toglie le colonne.
DROP FUNCTION IF EXISTS public.invia_messaggio(uuid, text, uuid);
CREATE FUNCTION public.invia_messaggio(p_conversazione_id uuid, p_testo text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_me uuid := auth.uid();
    v_conv record;
    v_altro uuid;
    v_ultimo timestamptz;
    v_conta_10min integer;
    v_id uuid;
begin
    if v_me is null then raise exception 'Non autenticato'; end if;

    select * into v_conv from conversazioni where id = p_conversazione_id;
    if v_conv is null or v_me not in (v_conv.owner_a, v_conv.owner_b) then
        raise exception 'Conversazione non trovata';
    end if;
    v_altro := case when v_conv.owner_a = v_me then v_conv.owner_b else v_conv.owner_a end;

    if _chat_utente_vietato(v_me) or _chat_utente_vietato(v_altro) then
        raise exception 'Chat non disponibile per questo account';
    end if;

    if exists (select 1 from blocchi_chat where (blocca_id = v_me and bloccato_id = v_altro)
                                              or (blocca_id = v_altro and bloccato_id = v_me)) then
        raise exception 'Contatto non disponibile';
    end if;

    if _chat_ha_parolacce(p_testo) then
        raise exception 'Messaggio non consentito: contiene linguaggio non ammesso';
    end if;
    if _chat_ha_link_esterno(p_testo) then
        raise exception 'Messaggio non consentito: sono ammessi solo link interni a Bindex';
    end if;

    select max(creato_il) into v_ultimo from messaggi
    where conversazione_id = p_conversazione_id and mittente_id = v_me;
    if v_ultimo is not null and v_ultimo > now() - interval '1 second' then
        raise exception 'Troppo veloce, riprova tra un attimo';
    end if;

    select count(*) into v_conta_10min from messaggi
    where conversazione_id = p_conversazione_id and mittente_id = v_me and creato_il > now() - interval '10 minutes';
    if v_conta_10min >= 60 then
        raise exception 'Troppi messaggi in poco tempo, rallenta';
    end if;

    insert into messaggi (conversazione_id, mittente_id, testo)
    values (p_conversazione_id, v_me, p_testo)
    returning id into v_id;
    return v_id;
end;
$function$;
REVOKE ALL ON FUNCTION public.invia_messaggio(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invia_messaggio(uuid, text) TO authenticated, service_role;
ALTER TABLE public.messaggi DROP CONSTRAINT IF EXISTS messaggi_richiesta_etichetta_len;
ALTER TABLE public.messaggi DROP COLUMN IF EXISTS richiesta_etichetta, DROP COLUMN IF EXISTS richiesta_id;
