-- ROLLBACK di 155: correzioni_manuali_carte senza integrita_packaging e sigillata_originale.
-- ATTENZIONE: le carte con problemi in quel momento perdono integrità e spunta "Sigillata".
-- Rimette sposta_riga_in_correzione_manuale com'era prima di sql/155 (md5 di pg_get_functiondef
-- cf7f89048564f3d4f474a198640edfa3, a parte gli a capo). Prima del ROLLBACK riportare
-- ui/queue-correzioni.ui.js alla versione senza le due colonne (legge riga.integrita_packaging: senza
-- colonna vale undefined e la riga torna in coda come prima, quindi non si rompe).
-- Si lancia dall'SQL Editor (contiene DROP).

begin;

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
    insert into public.correzioni_manuali_carte (
        coda_carte_id_originale, owner_id, nome, lingua, condizione, qty,
        reverse, first_ed, nota, location, tipo, destinazione,
        prezzo_obiettivo, url_diretto, opzioni_disambiguazione, errore_msg, tentativi_falliti
    ) values (
        v_riga.id, v_riga.owner_id, v_riga.nome, v_riga.lingua, v_riga.condizione, v_riga.qty,
        v_riga.reverse, v_riga.first_ed, v_riga.nota,
        (select nullif(l.payload ->> 'location', '') from coda_lavoro l where l.id = p_riga_id),
        v_riga.tipo, v_riga.destinazione,
        v_riga.prezzo_obiettivo, v_riga.url_diretto, coalesce(p_opzioni, v_riga.opzioni_disambiguazione), p_errore_msg,
        v_riga.tentativi_falliti
    )
    returning id into v_nuovo_id;
    delete from public.coda_lavoro where id = p_riga_id;
    return v_nuovo_id;
end;
$function$;

alter table public.correzioni_manuali_carte
  drop column if exists integrita_packaging,
  drop column if exists sigillata_originale;

commit;

select (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'correzioni_manuali_carte'
          and column_name in ('integrita_packaging', 'sigillata_originale')) as colonne_rimaste,
       pg_get_functiondef(p.oid) like '%sql/155%' as con_sql155,
       p.proacl::text as permessi
  from pg_proc p
 where p.oid = 'public.sposta_riga_in_correzione_manuale(bigint,text,jsonb)'::regprocedure;
