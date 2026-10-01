-- ═══════════════════════════════════════════════════════════════════════
-- 83_chat_etichetta_richiesta.sql — 2026-10-01 (Restyle Bindex, FASE 8e)
-- Rollback: 83_chat_etichetta_richiesta_ROLLBACK.sql
--
-- MESSAGGIO CHAT CON ETICHETTA DELLA RICHIESTA ("Scrivi a …" da una
-- richiesta di scambio). VERIFICATO sul DB live: messaggi(id, conversazione_id,
-- mittente_id, testo 1-2000, creato_il, letto_il) senza tipo; invia_messaggio
-- (uuid, text) SECURITY DEFINER, execute solo authenticated/service_role;
-- richieste_scambio(id, richiedente_id, proprietario_id, stato, creato_il);
-- richieste_scambio_righe(richiesta_id, ...). Nessun oggetto dipende da
-- invia_messaggio; gli INSERT su messaggi passano solo da questa funzione
-- (nessuna policy INSERT).
-- Novità: messaggi.richiesta_id (FK, SET NULL) + messaggi.richiesta_etichetta
-- (testo calcolato qui dentro, MAI dal client) e parametro opzionale
-- p_richiesta_id (default NULL → le chiamate a 2 argomenti restano valide).
-- La richiesta deve essere tra i due partecipanti della conversazione.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.messaggi
    ADD COLUMN IF NOT EXISTS richiesta_id uuid REFERENCES public.richieste_scambio(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS richiesta_etichetta text;
ALTER TABLE public.messaggi
    ADD CONSTRAINT messaggi_richiesta_etichetta_len CHECK (richiesta_etichetta IS NULL OR char_length(richiesta_etichetta) <= 120);

DROP FUNCTION IF EXISTS public.invia_messaggio(uuid, text);
CREATE FUNCTION public.invia_messaggio(p_conversazione_id uuid, p_testo text, p_richiesta_id uuid DEFAULT NULL)
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
    v_etichetta text := null;
    v_req record;
    v_n integer;
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

    -- NUOVO (sql/83): richiesta allegata — deve essere tra me e l'altro.
    if p_richiesta_id is not null then
        select * into v_req from richieste_scambio r
        where r.id = p_richiesta_id
          and ((r.richiedente_id = v_me and r.proprietario_id = v_altro)
            or (r.proprietario_id = v_me and r.richiedente_id = v_altro));
        if v_req is null then raise exception 'Richiesta non trovata'; end if;
        select count(*) into v_n from richieste_scambio_righe where richiesta_id = p_richiesta_id;
        v_etichetta := 'Richiesta del ' || to_char(v_req.creato_il at time zone 'Europe/Rome', 'DD/MM')
                       || ' · ' || v_n || case when v_n = 1 then ' oggetto' else ' oggetti' end;
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

    insert into messaggi (conversazione_id, mittente_id, testo, richiesta_id, richiesta_etichetta)
    values (p_conversazione_id, v_me, p_testo, p_richiesta_id, v_etichetta)
    returning id into v_id;
    return v_id;
end;
$function$;
REVOKE ALL ON FUNCTION public.invia_messaggio(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invia_messaggio(uuid, text, uuid) TO authenticated, service_role;
