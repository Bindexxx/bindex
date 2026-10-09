-- ROLLBACK di sql/94: ripristina RPC e funzione insert allo stato live del 2026-10-09
-- e toglie la colonna integrita_packaging dalla vista (che va ricreata: i trigger
-- INSTEAD OF si perdono col DROP VIEW e vengono ricreati qui sotto).
begin;

create or replace function public.completa_riga_coda_carte(
    p_riga_coda_id bigint, p_nome text, p_codice text, p_location text, p_qty integer,
    p_lingua text, p_condizione text, p_url text, p_prezzo numeric, p_note text,
    p_immagine text default null::text, p_tipo text default null::text,
    p_destinazione text default 'collezione'::text, p_prezzo_obiettivo numeric default null::numeric,
    p_sigillata_originale boolean default false)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
    v_riga     coda_lavoro%rowtype;
    v_nuovo_id uuid;
begin
    if auth.uid() is null then raise exception 'Utente non autenticato'; end if;
    select * into v_riga from coda_lavoro
     where id = p_riga_coda_id and tipo in ('aggiungi_carta', 'aggiungi_wishlist')
     for update;
    if not found then
        raise exception 'Riga coda_carte % non trovata — impossibile determinare il proprietario', p_riga_coda_id;
    end if;
    if v_riga.stato = 'completato' then
        raise exception 'Riga coda_carte % già completata', p_riga_coda_id;
    end if;
    if p_destinazione = 'wishlist' then
        insert into wishlist (owner_id, nome, codice, location, qty, lingua, condizione, url, prezzo, note, immagine, tipo, prezzo_obiettivo)
        values (v_riga.creato_da, p_nome, p_codice, p_location, p_qty, p_lingua, p_condizione, p_url, p_prezzo, p_note, p_immagine, p_tipo, p_prezzo_obiettivo)
        returning id into v_nuovo_id;
    else
        insert into carte (owner_id, nome, codice, location, qty, lingua, condizione, url, prezzo, note, immagine, tipo, stato, sigillata_originale)
        values (v_riga.creato_da, p_nome, p_codice, p_location, p_qty, p_lingua, p_condizione, p_url, p_prezzo, p_note, p_immagine, p_tipo, 'collezione', coalesce(p_sigillata_originale, false))
        returning id into v_nuovo_id;
        insert into public.movimenti_collezione
            (owner_id, tipo_evento, oggetto_tipo, oggetto_id, nome_snapshot, quantita_delta, prezzo_unitario, valore_delta, fonte)
        values
            (v_riga.creato_da, 'aggiunta', 'carta', v_nuovo_id, p_nome, p_qty,
             p_prezzo, case when p_prezzo is not null then p_prezzo * p_qty else null end, 'rpc');
    end if;
    update coda_lavoro set stato = 'completato', completato_il = now() where id = p_riga_coda_id;
    return v_nuovo_id;
end;
$function$;

drop view public.coda_carte;
create view public.coda_carte as
 SELECT id,
    payload ->> 'nome'::text AS nome,
    COALESCE(payload ->> 'lingua'::text, 'IT'::text) AS lingua,
    COALESCE(payload ->> 'condizione'::text, 'NM'::text) AS condizione,
    COALESCE((payload ->> 'qty'::text)::integer, 1) AS qty,
    COALESCE((payload ->> 'reverse'::text)::boolean, false) AS reverse,
    COALESCE((payload ->> 'first_ed'::text)::boolean, false) AS first_ed,
    payload ->> 'nota'::text AS nota,
    payload ->> 'location'::text AS location,
    payload ->> 'url_diretto'::text AS url_diretto,
    payload ->> 'tipo_prodotto'::text AS tipo,
    COALESCE(payload ->> 'destinazione'::text, 'collezione'::text) AS destinazione,
    NULLIF(payload ->> 'prezzo_obiettivo'::text, ''::text)::numeric AS prezzo_obiettivo,
    stato,
    creato_da AS owner_id,
    creato_il,
    claimed_by,
    claimed_at,
    dispositivo,
    errore_msg,
    completato_il,
    esito -> 'opzioni_disambiguazione'::text AS opzioni_disambiguazione,
    tentativi_falliti,
    COALESCE((payload ->> 'sigillata_originale'::text)::boolean, false) AS sigillata_originale
   FROM coda_lavoro
  WHERE tipo = ANY (ARRAY['aggiungi_carta'::text, 'aggiungi_wishlist'::text]);

-- GRANT: come live il 2026-10-09 (authenticated: tutti i privilegi; service_role: nessuno di lettura/scrittura)
grant all on public.coda_carte to authenticated;

create or replace function public._coda_carte_view_insert()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.owner_id is distinct from auth.uid() then
    raise exception 'owner_id deve corrispondere all''utente autenticato';
  end if;
  insert into coda_lavoro (tipo, creato_da, payload)
  values (
    case when coalesce(new.destinazione, 'collezione') = 'wishlist' then 'aggiungi_wishlist' else 'aggiungi_carta' end,
    new.owner_id,
    jsonb_strip_nulls(jsonb_build_object(
      'nome', new.nome, 'lingua', coalesce(new.lingua, 'IT'), 'condizione', coalesce(new.condizione, 'NM'),
      'qty', coalesce(new.qty, 1), 'reverse', coalesce(new.reverse, false), 'first_ed', coalesce(new.first_ed, false),
      'nota', new.nota, 'location', new.location, 'url_diretto', new.url_diretto,
      'tipo_prodotto', new.tipo, 'destinazione', coalesce(new.destinazione, 'collezione'),
      'prezzo_obiettivo', new.prezzo_obiettivo,
      'sigillata_originale', coalesce(new.sigillata_originale, false)
    ))
  );
  return new;
end;
$function$;

create trigger coda_carte_instead_insert instead of insert on public.coda_carte
  for each row execute function public._coda_carte_view_insert();
create trigger coda_carte_instead_update instead of update on public.coda_carte
  for each row execute function public._coda_carte_view_update();
create trigger coda_carte_instead_delete instead of delete on public.coda_carte
  for each row execute function public._coda_carte_view_delete();

commit;
