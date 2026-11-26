-- 155: le carte con problemi tengono l'integrità dei sealed e la spunta "Sigillata" delle carte.
-- Prima, quando l'estensione spostava una riga della coda in correzioni_manuali_carte
-- (sposta_riga_in_correzione_manuale), integrita_packaging e sigillata_originale si perdevano:
-- rimessa in coda dalle Carte con problemi, un sealed tornava "Sigillato integro" e una carta
-- sigillata tornava normale. Il 26/11/2026 la tabella era vuota: niente da recuperare.
--
-- Cosa cambia:
--   correzioni_manuali_carte: colonne nuove integrita_packaging (text) e sigillata_originale
--     (boolean, default false), leggibili come le altre (stesse policy, owner)
--   sposta_riga_in_correzione_manuale: copia anche le due colonne dalla coda (stesso corpo di
--     prima, due colonne in più; permessi invariati: CREATE OR REPLACE li tiene)
-- Il sito (ui/queue-correzioni.ui.js) le rimette in coda; l'estensione non cambia.
-- Corpo della funzione prima di sql/155: md5(pg_get_functiondef) cf7f89048564f3d4f474a198640edfa3.

begin;

alter table public.correzioni_manuali_carte
  add column if not exists integrita_packaging text,
  add column if not exists sigillata_originale boolean default false;

CREATE OR REPLACE FUNCTION public.sposta_riga_in_correzione_manuale(p_riga_id bigint, p_errore_msg text, p_opzioni jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_riga     public.coda_carte%rowtype;
    v_nuovo_id uuid;
begin
    if auth.uid() is null then raise exception 'Utente non autenticato'; end if;
    perform 1 from coda_lavoro where id = p_riga_id for update;
    select * into v_riga from public.coda_carte where id = p_riga_id;
    if not found then
        raise exception 'Riga coda_carte % non trovata (già spostata o eliminata?)', p_riga_id;
    end if;
    if v_riga.stato = 'completato' then
        raise exception 'Riga coda_carte % già completata', p_riga_id;
    end if;
    -- sql/114: solo il proprietario o chi ha la riga in carico.
    if v_riga.owner_id is distinct from auth.uid()
       and v_riga.claimed_by is distinct from auth.uid()
       and not is_admin() then
        raise exception 'Riga coda_carte % non presa in carico da te', p_riga_id;
    end if;
    -- La vista nasconde la location delle righe altrui: per la correzione
    -- (che legge solo il proprietario) va presa dalla richiesta originale.
    -- sql/155: anche integrità della confezione (sealed) e spunta "Sigillata" (carte).
    insert into public.correzioni_manuali_carte (
        coda_carte_id_originale, owner_id, nome, lingua, condizione, qty,
        reverse, first_ed, nota, location, tipo, destinazione,
        prezzo_obiettivo, url_diretto, opzioni_disambiguazione, errore_msg, tentativi_falliti,
        integrita_packaging, sigillata_originale
    ) values (
        v_riga.id, v_riga.owner_id, v_riga.nome, v_riga.lingua, v_riga.condizione, v_riga.qty,
        v_riga.reverse, v_riga.first_ed, v_riga.nota,
        (select nullif(l.payload ->> 'location', '') from coda_lavoro l where l.id = p_riga_id),
        v_riga.tipo, v_riga.destinazione,
        v_riga.prezzo_obiettivo, v_riga.url_diretto, coalesce(p_opzioni, v_riga.opzioni_disambiguazione), p_errore_msg,
        v_riga.tentativi_falliti,
        v_riga.integrita_packaging, coalesce(v_riga.sigillata_originale, false)
    )
    returning id into v_nuovo_id;
    delete from public.coda_lavoro where id = p_riga_id;
    return v_nuovo_id;
end;
$function$;

commit;

-- Verifica: 2 colonne nuove, la funzione con la riga di sql/155 e i permessi di prima
-- ({postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}).
select (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'correzioni_manuali_carte'
          and column_name in ('integrita_packaging', 'sigillata_originale')) as colonne_nuove,
       pg_get_functiondef(p.oid) like '%sql/155%' as con_sql155,
       p.proacl::text as permessi
  from pg_proc p
 where p.oid = 'public.sposta_riga_in_correzione_manuale(bigint,text,jsonb)'::regprocedure;
