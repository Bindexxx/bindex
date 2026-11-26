-- 154: proposte di scambio a due vie (decisioni di Claudio del 19/11/2026).
-- Una proposta dice cosa ricevi (dallo Scambio dell'altro), cosa dai (dal tuo Scambio) ed
-- eventualmente quanti euro dà una delle due parti: va bene anche per comprare (dai solo euro).
-- Nello scambio entra SOLO quello che uno ha messo nel suo Scambio (binder 'scambio' per le carte,
-- scaffale 'scambio' per i sealed), con le quantità offerte meno quelle già riservate.
--
-- Come va:
--   in_attesa  → chi la riceve accetta, rifiuta o la cambia (controproposta: la vecchia diventa
--                "superata"); chi l'ha mandata la può cambiare o ritirare; dopo 14 giorni scade
--   accettata  → tutto riservato da tutte e due le parti; ognuno preme "Fatto" dopo lo scambio vero;
--                al secondo "Fatto" gli oggetti passano insieme, in un colpo solo (nella location "?"
--                di chi li riceve, con i movimenti di valore per tutti e due); prima ognuno può
--                annullare con un motivo
--   conclusa / rifiutata / annullata / superata / scaduta → chiusa
-- Il pagamento in euro avviene fuori dall'app: qui si registra solo l'importo.
--
-- Dati: le tabelle di oggi. La testata (richieste_scambio) ha tipo 'proposta'; ogni riga
-- (richieste_scambio_righe) dice già chi dà (proprietario_id) e chi riceve (richiedente_id), così le
-- righe riservate ('accettata') contano subito nei Match e nelle pagine pubbliche. Nella testata di
-- una proposta richiedente_id = chi l'ha mandata, proprietario_id = chi l'ha ricevuta.
--
-- Cosa cambia:
--   richieste_scambio: tipo, stato_proposta, euro_da_richiedente, euro_da_proprietario,
--     fatto_richiedente_il, fatto_proprietario_il, sostituisce_id, motivo_chiusura, chiusa_da,
--     scade_il, aggiornato_il (le richieste di prima restano tipo 'richiesta', come sono)
--   funzioni nuove: proponi_scambio, rispondi_proposta, annulla_proposta, segna_fatto_proposta,
--     scadi_proposte, leggi_scambio_per_proposta; interne _scambio_disponibile,
--     _scambio_trasferisci_riga, _scadi_proposte
--   accetta/rifiuta/annulla/sblocca/concludi_riga_richiesta: una riga in più, una riga di una
--     proposta non si gestisce da sola (solo dalla proposta)
--   invia_messaggio: l'etichetta in chat dice "Proposta del …" per le proposte
-- Le funzioni di oggi si cambiano partendo dal loro testo sul DB (pg_get_functiondef + replace): se
-- la riga da cambiare non c'è esattamente una volta, si ferma tutto e non cambia niente.
-- Le richieste degli ospiti e quelle fatte dalle pagine pubbliche restano come oggi.
-- Si lancia dall'SQL Editor (contiene REVOKE), PRIMA di unire la PR del sito.

begin;

-- 1) testata delle proposte
alter table public.richieste_scambio
  add column if not exists tipo text not null default 'richiesta',
  add column if not exists stato_proposta text,
  add column if not exists euro_da_richiedente numeric(10,2) not null default 0,
  add column if not exists euro_da_proprietario numeric(10,2) not null default 0,
  add column if not exists fatto_richiedente_il timestamptz,
  add column if not exists fatto_proprietario_il timestamptz,
  add column if not exists sostituisce_id uuid references public.richieste_scambio(id) on delete set null,
  add column if not exists motivo_chiusura text,
  add column if not exists chiusa_da uuid,
  add column if not exists scade_il timestamptz,
  add column if not exists aggiornato_il timestamptz;

do $do$
begin
  if not exists (select 1 from pg_constraint where conname = 'richieste_scambio_tipo_check') then
    alter table public.richieste_scambio add constraint richieste_scambio_tipo_check
      check (tipo in ('richiesta', 'proposta'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'richieste_scambio_stato_proposta_check') then
    alter table public.richieste_scambio add constraint richieste_scambio_stato_proposta_check
      check ((tipo = 'proposta') = (stato_proposta is not null)
             and (stato_proposta is null or stato_proposta in ('in_attesa', 'accettata', 'conclusa', 'rifiutata', 'annullata', 'superata', 'scaduta')));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'richieste_scambio_euro_check') then
    alter table public.richieste_scambio add constraint richieste_scambio_euro_check
      check (euro_da_richiedente between 0 and 10000 and euro_da_proprietario between 0 and 10000
             and (euro_da_richiedente = 0 or euro_da_proprietario = 0));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'richieste_scambio_proposta_senza_ospite') then
    alter table public.richieste_scambio add constraint richieste_scambio_proposta_senza_ospite
      check (tipo = 'richiesta' or (codice_rq is null and richiedente_id is not null));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'richieste_scambio_motivo_chiusura_check') then
    alter table public.richieste_scambio add constraint richieste_scambio_motivo_chiusura_check
      check (motivo_chiusura is null or motivo_chiusura in ('ho_cambiato_idea', 'non_piu_disponibile', 'accordo_non_concluso',
             'errore_prenotazione', 'sostituito_altro_accordo', 'intervento_amministrativo', 'scaduta', 'bloccato'));
  end if;
end
$do$;

-- 2) quante copie di un oggetto sono ancora libere nello Scambio del suo proprietario (offerte meno
--    quelle riservate). null = non è nello Scambio. Blocca la riga dell'offerta fino alla fine.
create or replace function public._scambio_disponibile(p_owner uuid, p_tipo text, p_oggetto uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_offerta integer;
  v_impegnate integer;
begin
  if p_tipo = 'carta' then
    select least(bc.quantita_offerta, coalesce(c.qty, 1)) into v_offerta
      from binder_carte bc
      join binders b on b.id = bc.binder_id and b.owner_id = p_owner and b.tipo = 'scambio'
      join carte c on c.id = bc.carta_id and c.owner_id = p_owner and c.stato = 'collezione'
     where bc.carta_id = p_oggetto
     order by bc.quantita_offerta desc
     limit 1
     for update of bc;
    select coalesce(sum(quantita_richiesta), 0) into v_impegnate
      from richieste_scambio_righe where carta_id = p_oggetto and stato_riga = 'accettata';
  elsif p_tipo = 'sealed' then
    select least(sp.quantita_offerta, coalesce(p.qty, 1)) into v_offerta
      from scaffale_prodotti sp
      join scaffali s on s.id = sp.scaffale_id and s.owner_id = p_owner and s.tipo = 'scambio'
      join prodotti_sealed p on p.id = sp.prodotto_id and p.owner_id = p_owner and p.stato = 'collezione'
     where sp.prodotto_id = p_oggetto
     order by sp.quantita_offerta desc
     limit 1
     for update of sp;
    select coalesce(sum(quantita_richiesta), 0) into v_impegnate
      from richieste_scambio_righe where prodotto_sealed_id = p_oggetto and stato_riga = 'accettata';
  else
    return null;
  end if;
  if v_offerta is null then return null; end if;
  return v_offerta - v_impegnate;
end;
$function$;

-- 3) lo Scambio mio e di un'altra persona, per preparare una proposta (solo le copie libere).
--    Dell'altra persona niente se ha nascosto il suo Scambio o se uno dei due ha bloccato l'altro.
create or replace function public.leggi_scambio_per_proposta(p_altro uuid)
returns table(owner_id uuid, tipo text, oggetto_id uuid, nome text, codice text, lingua text, condizione text,
              variante text, integrita text, immagine text, prezzo numeric, disponibili integer)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with io as (select auth.uid() as id),
  chi as (
    select io.id as owner_id from io where io.id is not null
    union
    select p_altro from io
     where io.id is not null and p_altro is not null and p_altro <> io.id
       and not exists (select 1 from preferenze_utente pu where pu.owner_id = p_altro and pu.nascondi_scambio_da_match)
       and not exists (select 1 from blocchi_chat bl
                        where (bl.blocca_id = io.id and bl.bloccato_id = p_altro) or (bl.blocca_id = p_altro and bl.bloccato_id = io.id))
  ),
  voci as (
    select c.owner_id, 'carta'::text as tipo, c.id as oggetto_id, c.nome, c.codice, c.lingua, c.condizione,
           c.variante, null::text as integrita, c.immagine, c.prezzo,
           (least(bc.quantita_offerta, coalesce(c.qty, 1)) - coalesce((select sum(r.quantita_richiesta) from richieste_scambio_righe r
              where r.carta_id = c.id and r.stato_riga = 'accettata'), 0))::integer as disponibili
      from chi
      join binders b on b.owner_id = chi.owner_id and b.tipo = 'scambio'
      join binder_carte bc on bc.binder_id = b.id and bc.quantita_offerta > 0
      join carte c on c.id = bc.carta_id and c.owner_id = chi.owner_id and c.stato = 'collezione'
    union all
    select p.owner_id, 'sealed'::text, p.id, p.nome, p.codice, p.lingua, null::text,
           null::text, p.integrita_packaging, p.immagine, p.prezzo,
           (least(sp.quantita_offerta, coalesce(p.qty, 1)) - coalesce((select sum(r.quantita_richiesta) from richieste_scambio_righe r
              where r.prodotto_sealed_id = p.id and r.stato_riga = 'accettata'), 0))::integer
      from chi
      join scaffali s on s.owner_id = chi.owner_id and s.tipo = 'scambio'
      join scaffale_prodotti sp on sp.scaffale_id = s.id and sp.quantita_offerta > 0
      join prodotti_sealed p on p.id = sp.prodotto_id and p.owner_id = chi.owner_id and p.stato = 'collezione'
  )
  select * from voci where disponibili > 0 order by owner_id, tipo, nome;
$function$;

-- 4) scadenza: una proposta senza risposta dopo 14 giorni si chiude da sola
create or replace function public._scadi_proposte()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update richieste_scambio_righe r
     set stato_riga = 'annullata', motivo_chiusura = 'scaduta', aggiornato_il = now()
    from richieste_scambio p
   where p.id = r.richiesta_id and p.tipo = 'proposta' and p.stato_proposta = 'in_attesa'
     and p.scade_il < now() and r.stato_riga = 'in_attesa';
  update richieste_scambio
     set stato_proposta = 'scaduta', stato = 'chiusa', motivo_chiusura = 'scaduta', aggiornato_il = now()
   where tipo = 'proposta' and stato_proposta = 'in_attesa' and scade_il < now();
end;
$function$;

create or replace function public.scadi_proposte()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then raise exception 'Non autenticato'; end if;
  perform _scadi_proposte();
end;
$function$;

-- 5) manda una proposta (o una controproposta, con p_sostituisce)
--    p_ricevo: oggetti dallo Scambio di p_destinatario; p_do: oggetti dal mio Scambio;
--    voci [{ tipo: 'carta'|'sealed', oggetto_id, quantita }]; euro da una parte sola.
create or replace function public.proponi_scambio(
  p_destinatario uuid, p_ricevo jsonb, p_do jsonb,
  p_euro_do numeric default 0, p_euro_ricevo numeric default 0, p_sostituisce uuid default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_io uuid := auth.uid();
  v_id uuid;
  v_vecchia record;
  v_lato text;
  v_voci jsonb;
  v_voce jsonb;
  v_tipo text;
  v_oggetto uuid;
  v_quantita integer;
  v_da uuid;
  v_a uuid;
  v_carta record;
  v_prodotto record;
  v_disp integer;
  v_prezzo numeric;
  v_snapshot jsonb;
  v_visti text[] := '{}';
  v_euro_do numeric := round(coalesce(p_euro_do, 0), 2);
  v_euro_ricevo numeric := round(coalesce(p_euro_ricevo, 0), 2);
  v_n_ricevo integer := case when jsonb_typeof(p_ricevo) = 'array' then jsonb_array_length(p_ricevo) else 0 end;
  v_n_do integer := case when jsonb_typeof(p_do) = 'array' then jsonb_array_length(p_do) else 0 end;
begin
  if v_io is null then raise exception 'Non autenticato'; end if;
  if p_destinatario is null or p_destinatario = v_io then raise exception 'Scegli con chi fare lo scambio'; end if;
  if not exists (select 1 from profiles where id = p_destinatario and deleted_at is null
                   and (banned_until is null or banned_until <= now())) then
    raise exception 'Questa persona non può ricevere proposte';
  end if;
  if exists (select 1 from blocchi_chat where (blocca_id = v_io and bloccato_id = p_destinatario)
                                           or (blocca_id = p_destinatario and bloccato_id = v_io)) then
    raise exception 'Contatto non disponibile';
  end if;
  if v_n_ricevo + v_n_do = 0 then raise exception 'Metti almeno un oggetto nella proposta'; end if;
  if v_n_ricevo > 40 or v_n_do > 40 then raise exception 'Al massimo 40 oggetti per parte'; end if;
  if v_euro_do < 0 or v_euro_ricevo < 0 or v_euro_do > 10000 or v_euro_ricevo > 10000 then
    raise exception 'Importo non valido';
  end if;
  if v_euro_do > 0 and v_euro_ricevo > 0 then raise exception 'Gli euro li mette una parte sola'; end if;
  if v_n_ricevo > 0 and exists (select 1 from preferenze_utente where owner_id = p_destinatario and nascondi_scambio_da_match) then
    raise exception 'Lo Scambio di questa persona non è visibile';
  end if;

  perform _scadi_proposte();

  if p_sostituisce is not null then
    select * into v_vecchia from richieste_scambio where id = p_sostituisce for update;
    if v_vecchia is null or v_vecchia.tipo <> 'proposta' or v_vecchia.stato_proposta <> 'in_attesa'
       or not ((v_vecchia.richiedente_id = v_io and v_vecchia.proprietario_id = p_destinatario)
            or (v_vecchia.proprietario_id = v_io and v_vecchia.richiedente_id = p_destinatario)) then
      raise exception 'La proposta da cambiare non è più in attesa';
    end if;
    update richieste_scambio_righe
       set stato_riga = 'annullata', motivo_chiusura = 'sostituito_altro_accordo', aggiornato_il = now()
     where richiesta_id = p_sostituisce and stato_riga = 'in_attesa';
    update richieste_scambio
       set stato_proposta = 'superata', stato = 'chiusa', motivo_chiusura = 'sostituito_altro_accordo',
           chiusa_da = v_io, aggiornato_il = now()
     where id = p_sostituisce;
  end if;

  insert into richieste_scambio (richiedente_id, proprietario_id, tipo, stato, stato_proposta,
                                 euro_da_richiedente, euro_da_proprietario, sostituisce_id, scade_il, aggiornato_il)
  values (v_io, p_destinatario, 'proposta', 'aperta', 'in_attesa',
          v_euro_do, v_euro_ricevo, p_sostituisce, now() + interval '14 days', now())
  returning id into v_id;

  foreach v_lato in array array['ricevo', 'do'] loop
    v_voci := case when v_lato = 'ricevo' then p_ricevo else p_do end;
    if v_voci is null or jsonb_typeof(v_voci) <> 'array' then continue; end if;
    v_da := case when v_lato = 'ricevo' then p_destinatario else v_io end;   -- chi dà
    v_a  := case when v_lato = 'ricevo' then v_io else p_destinatario end;   -- chi riceve
    for v_voce in select * from jsonb_array_elements(v_voci) loop
      v_tipo := v_voce->>'tipo';
      v_oggetto := (v_voce->>'oggetto_id')::uuid;
      v_quantita := coalesce((v_voce->>'quantita')::integer, 1);
      if v_quantita < 1 then raise exception 'Quantità non valida'; end if;
      if (coalesce(v_tipo, '') || ':' || v_oggetto::text) = any(v_visti) then
        raise exception 'Lo stesso oggetto è due volte nella proposta';
      end if;
      v_visti := v_visti || (coalesce(v_tipo, '') || ':' || v_oggetto::text);
      v_disp := _scambio_disponibile(v_da, v_tipo, v_oggetto);

      if v_tipo = 'carta' then
        select * into v_carta from carte where id = v_oggetto and owner_id = v_da and stato = 'collezione';
        if v_carta is null or v_disp is null then raise exception 'Una carta della proposta non è più nello Scambio'; end if;
        if v_disp < v_quantita then
          raise exception '%: nello Scambio ne restano %', coalesce(v_carta.nome, v_carta.codice, 'una carta'), greatest(v_disp, 0);
        end if;
        v_prezzo := v_carta.prezzo;
        v_snapshot := jsonb_build_object(
          'nome', v_carta.nome, 'codice', v_carta.codice, 'lingua', v_carta.lingua,
          'condizione', v_carta.condizione, 'reverse_holo', v_carta.reverse_holo,
          'first_ed', v_carta.first_ed, 'url', v_carta.url, 'immagine', v_carta.immagine,
          'sigillata_originale', v_carta.sigillata_originale, 'note', v_carta.note,
          'variante', v_carta.variante, 'prezzo', v_prezzo, 'quantita', v_quantita,
          'richiedente_id', v_a, 'proprietario_id', v_da, 'data', now());
        insert into richieste_scambio_righe
          (richiesta_id, richiedente_id, proprietario_id, carta_id, quantita_richiesta, prezzo_congelato, snapshot)
        values (v_id, v_a, v_da, v_oggetto, v_quantita, v_prezzo, v_snapshot);

      elsif v_tipo = 'sealed' then
        select * into v_prodotto from prodotti_sealed where id = v_oggetto and owner_id = v_da and stato = 'collezione';
        if v_prodotto is null or v_disp is null then raise exception 'Un prodotto della proposta non è più nello Scambio'; end if;
        if v_disp < v_quantita then
          raise exception '%: nello Scambio ne restano %', coalesce(v_prodotto.nome, v_prodotto.codice, 'un prodotto'), greatest(v_disp, 0);
        end if;
        v_prezzo := v_prodotto.prezzo;
        v_snapshot := jsonb_build_object(
          'nome', v_prodotto.nome, 'codice', v_prodotto.codice, 'set_espansione', v_prodotto.set_espansione,
          'lingua', v_prodotto.lingua, 'integrita_packaging', v_prodotto.integrita_packaging,
          'immagine', v_prodotto.immagine, 'note', v_prodotto.note, 'prezzo', v_prezzo, 'quantita', v_quantita,
          'richiedente_id', v_a, 'proprietario_id', v_da, 'data', now());
        insert into richieste_scambio_righe
          (richiesta_id, richiedente_id, proprietario_id, prodotto_sealed_id, quantita_richiesta, prezzo_congelato, snapshot)
        values (v_id, v_a, v_da, v_oggetto, v_quantita, v_prezzo, v_snapshot);

      else
        raise exception 'Tipo oggetto non riconosciuto';
      end if;
    end loop;
  end loop;

  insert into activity_log (user_id, source, action, details)
  values (p_destinatario, 'sito', 'proposta_scambio_ricevuta', jsonb_build_object('richiesta_id', v_id, 'da', v_io));
  return v_id;
end;
$function$;

-- 6) chi l'ha ricevuta accetta (tutto diventa riservato) o rifiuta
create or replace function public.rispondi_proposta(p_richiesta_id uuid, p_accetta boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_io uuid := auth.uid();
  v_p record;
  v_r record;
  v_disp integer;
begin
  if v_io is null then raise exception 'Non autenticato'; end if;
  perform _scadi_proposte();
  select * into v_p from richieste_scambio where id = p_richiesta_id for update;
  if v_p is null or v_p.tipo <> 'proposta' or v_io not in (v_p.richiedente_id, v_p.proprietario_id) then
    raise exception 'Proposta non trovata';
  end if;
  if v_p.stato_proposta <> 'in_attesa' then raise exception 'La proposta non è più in attesa'; end if;
  if v_p.proprietario_id <> v_io then raise exception 'Risponde chi ha ricevuto la proposta'; end if;

  if p_accetta then
    for v_r in select * from richieste_scambio_righe where richiesta_id = p_richiesta_id order by creato_il, id loop
      v_disp := _scambio_disponibile(v_r.proprietario_id,
                  case when v_r.carta_id is not null then 'carta' when v_r.prodotto_sealed_id is not null then 'sealed' end,
                  coalesce(v_r.carta_id, v_r.prodotto_sealed_id));
      if v_disp is null or v_disp < v_r.quantita_richiesta then
        raise exception '%: non è più libero nello Scambio', coalesce(v_r.snapshot->>'nome', v_r.snapshot->>'codice', 'un oggetto');
      end if;
    end loop;
    update richieste_scambio_righe set stato_riga = 'accettata', aggiornato_il = now()
     where richiesta_id = p_richiesta_id and stato_riga = 'in_attesa';
    update richieste_scambio set stato_proposta = 'accettata', aggiornato_il = now() where id = p_richiesta_id;
    insert into activity_log (user_id, source, action, details)
    values (v_p.richiedente_id, 'sito', 'proposta_scambio_accettata', jsonb_build_object('richiesta_id', p_richiesta_id));
  else
    update richieste_scambio_righe set stato_riga = 'rifiutata', aggiornato_il = now()
     where richiesta_id = p_richiesta_id and stato_riga = 'in_attesa';
    update richieste_scambio set stato_proposta = 'rifiutata', stato = 'chiusa', chiusa_da = v_io, aggiornato_il = now()
     where id = p_richiesta_id;
    insert into activity_log (user_id, source, action, details)
    values (v_p.richiedente_id, 'sito', 'proposta_scambio_rifiutata', jsonb_build_object('richiesta_id', p_richiesta_id));
  end if;
end;
$function$;

-- 7) annullare: in attesa la ritira chi l'ha mandata; accettata la annulla uno dei due, con un motivo
create or replace function public.annulla_proposta(p_richiesta_id uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_io uuid := auth.uid();
  v_p record;
  v_motivo text := nullif(p_motivo, '');
begin
  if v_io is null then raise exception 'Non autenticato'; end if;
  select * into v_p from richieste_scambio where id = p_richiesta_id for update;
  if v_p is null or v_p.tipo <> 'proposta' or v_io not in (v_p.richiedente_id, v_p.proprietario_id) then
    raise exception 'Proposta non trovata';
  end if;
  if v_p.stato_proposta = 'in_attesa' then
    if v_io <> v_p.richiedente_id then raise exception 'Una proposta ricevuta si rifiuta'; end if;
    v_motivo := coalesce(v_motivo, 'ho_cambiato_idea');
  elsif v_p.stato_proposta = 'accettata' then
    if v_motivo is null then raise exception 'Scegli un motivo'; end if;
  else
    raise exception 'La proposta è già chiusa';
  end if;
  if v_motivo not in ('ho_cambiato_idea', 'non_piu_disponibile', 'accordo_non_concluso', 'errore_prenotazione', 'sostituito_altro_accordo') then
    raise exception 'Motivo non valido';
  end if;

  update richieste_scambio_righe set stato_riga = 'annullata', motivo_chiusura = v_motivo, aggiornato_il = now()
   where richiesta_id = p_richiesta_id and stato_riga in ('in_attesa', 'accettata');
  update richieste_scambio
     set stato_proposta = 'annullata', stato = 'chiusa', motivo_chiusura = v_motivo, chiusa_da = v_io, aggiornato_il = now()
   where id = p_richiesta_id;
  insert into activity_log (user_id, source, action, details)
  values (case when v_io = v_p.richiedente_id then v_p.proprietario_id else v_p.richiedente_id end,
          'sito', 'proposta_scambio_annullata', jsonb_build_object('richiesta_id', p_richiesta_id, 'motivo', v_motivo, 'da', v_io));
end;
$function$;

-- 8) passaggio di una riga riservata: stesso passaggio di concludi_riga_richiesta (sql/57, sql/88)
--    senza i casi degli ospiti. SE CAMBIA UNO, VA CAMBIATO ANCHE L'ALTRO.
create or replace function public._scambio_trasferisci_riga(p_riga_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_riga record;
  v_carta record;
  v_prodotto record;
  v_snap jsonb;
  v_nuovo_id uuid;
begin
  select * into v_riga from richieste_scambio_righe where id = p_riga_id for update;
  if v_riga is null or v_riga.stato_riga <> 'accettata' then raise exception 'Riga non riservata'; end if;
  v_snap := v_riga.snapshot;

  if v_riga.carta_id is not null then
    select * into v_carta from carte where id = v_riga.carta_id and owner_id = v_riga.proprietario_id for update;
    if v_carta is null then
      raise exception '%: la carta non c''è più nella collezione di chi la dà', coalesce(v_snap->>'nome', 'una carta');
    end if;
    if coalesce(v_carta.qty, 1) < v_riga.quantita_richiesta then
      raise exception '%: le copie sono meno di quelle dello scambio', coalesce(v_carta.nome, 'una carta');
    end if;
    if coalesce(v_carta.qty, 1) = v_riga.quantita_richiesta then
      delete from carte where id = v_carta.id;
    else
      update carte set qty = qty - v_riga.quantita_richiesta, updated_at = now() where id = v_carta.id;
      update binder_carte set quantita_offerta = greatest(0, quantita_offerta - v_riga.quantita_richiesta)
       where carta_id = v_carta.id
         and binder_id in (select id from binders where owner_id = v_riga.proprietario_id and tipo = 'scambio')
         and not exists (select 1 from location l where l.owner_id = v_carta.owner_id and l.tipo = 'carta'
                                                    and l.nome = v_carta.location and l.scambio_automatico);
    end if;
    insert into carte (owner_id, tipo, nome, codice, location, qty, lingua, condizione, reverse_holo, first_ed,
                       url, prezzo, note, immagine, sigillata_originale, variante, stato)
    values (v_riga.richiedente_id, 'carta', v_snap->>'nome', v_snap->>'codice', '?', v_riga.quantita_richiesta,
            v_snap->>'lingua', v_snap->>'condizione',
            coalesce((v_snap->>'reverse_holo')::boolean, false), coalesce((v_snap->>'first_ed')::boolean, false),
            v_snap->>'url', v_riga.prezzo_congelato, v_snap->>'note', v_snap->>'immagine',
            coalesce((v_snap->>'sigillata_originale')::boolean, false), v_snap->>'variante', 'collezione')
    returning id into v_nuovo_id;
    if v_riga.prezzo_congelato is not null then
      insert into movimenti_collezione
        (owner_id, tipo_evento, oggetto_tipo, oggetto_id, nome_snapshot, quantita_delta, prezzo_unitario, valore_delta, fonte)
      values
        (v_riga.proprietario_id, 'vendita_scambio', 'carta', v_carta.id, coalesce(v_snap->>'nome', '—'),
         -v_riga.quantita_richiesta, v_riga.prezzo_congelato, -(v_riga.prezzo_congelato * v_riga.quantita_richiesta), 'rpc'),
        (v_riga.richiedente_id, 'vendita_scambio', 'carta', v_nuovo_id, coalesce(v_snap->>'nome', '—'),
         v_riga.quantita_richiesta, v_riga.prezzo_congelato, (v_riga.prezzo_congelato * v_riga.quantita_richiesta), 'rpc');
    end if;

  elsif v_riga.prodotto_sealed_id is not null then
    select * into v_prodotto from prodotti_sealed where id = v_riga.prodotto_sealed_id and owner_id = v_riga.proprietario_id for update;
    if v_prodotto is null then
      raise exception '%: il prodotto non c''è più nella collezione di chi lo dà', coalesce(v_snap->>'nome', 'un prodotto');
    end if;
    if coalesce(v_prodotto.qty, 1) < v_riga.quantita_richiesta then
      raise exception '%: le copie sono meno di quelle dello scambio', coalesce(v_prodotto.nome, 'un prodotto');
    end if;
    if coalesce(v_prodotto.qty, 1) = v_riga.quantita_richiesta then
      delete from prodotti_sealed where id = v_prodotto.id;
    else
      update prodotti_sealed set qty = qty - v_riga.quantita_richiesta where id = v_prodotto.id;
      update scaffale_prodotti set quantita_offerta = greatest(0, quantita_offerta - v_riga.quantita_richiesta)
       where prodotto_id = v_prodotto.id
         and scaffale_id in (select id from scaffali where owner_id = v_riga.proprietario_id and tipo = 'scambio');
    end if;
    insert into prodotti_sealed (owner_id, nome, codice, set_espansione, qty, lingua, integrita_packaging, prezzo, note, immagine, stato)
    values (v_riga.richiedente_id, v_snap->>'nome', v_snap->>'codice', v_snap->>'set_espansione', v_riga.quantita_richiesta,
            v_snap->>'lingua', v_snap->>'integrita_packaging', v_riga.prezzo_congelato, v_snap->>'note', v_snap->>'immagine', 'collezione')
    returning id into v_nuovo_id;
    if v_riga.prezzo_congelato is not null then
      insert into movimenti_collezione
        (owner_id, tipo_evento, oggetto_tipo, oggetto_id, nome_snapshot, quantita_delta, prezzo_unitario, valore_delta, fonte)
      values
        (v_riga.proprietario_id, 'vendita_scambio', 'sealed', v_prodotto.id, coalesce(v_snap->>'nome', '—'),
         -v_riga.quantita_richiesta, v_riga.prezzo_congelato, -(v_riga.prezzo_congelato * v_riga.quantita_richiesta), 'rpc'),
        (v_riga.richiedente_id, 'vendita_scambio', 'sealed', v_nuovo_id, coalesce(v_snap->>'nome', '—'),
         v_riga.quantita_richiesta, v_riga.prezzo_congelato, (v_riga.prezzo_congelato * v_riga.quantita_richiesta), 'rpc');
    end if;

  else
    raise exception '%: l''oggetto non esiste più', coalesce(v_snap->>'nome', 'un oggetto');
  end if;

  update richieste_scambio_righe set stato_riga = 'conclusa', location_scelta = '?', aggiornato_il = now() where id = p_riga_id;
end;
$function$;

-- 9) "Fatto": al secondo, tutto passa insieme (se un passaggio non riesce, non passa niente)
create or replace function public.segna_fatto_proposta(p_richiesta_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_io uuid := auth.uid();
  v_p record;
  v_r record;
  v_altro uuid;
begin
  if v_io is null then raise exception 'Non autenticato'; end if;
  select * into v_p from richieste_scambio where id = p_richiesta_id for update;
  if v_p is null or v_p.tipo <> 'proposta' or v_io not in (v_p.richiedente_id, v_p.proprietario_id) then
    raise exception 'Proposta non trovata';
  end if;
  if v_p.stato_proposta <> 'accettata' then raise exception 'La proposta non è accettata'; end if;
  v_altro := case when v_io = v_p.richiedente_id then v_p.proprietario_id else v_p.richiedente_id end;

  if v_io = v_p.richiedente_id then
    update richieste_scambio set fatto_richiedente_il = coalesce(fatto_richiedente_il, now()), aggiornato_il = now()
     where id = p_richiesta_id returning * into v_p;
  else
    update richieste_scambio set fatto_proprietario_il = coalesce(fatto_proprietario_il, now()), aggiornato_il = now()
     where id = p_richiesta_id returning * into v_p;
  end if;

  if v_p.fatto_richiedente_il is null or v_p.fatto_proprietario_il is null then
    insert into activity_log (user_id, source, action, details)
    values (v_altro, 'sito', 'proposta_scambio_fatto', jsonb_build_object('richiesta_id', p_richiesta_id, 'da', v_io));
    return 'aspetta_altro';
  end if;

  for v_r in select id from richieste_scambio_righe where richiesta_id = p_richiesta_id and stato_riga = 'accettata' order by creato_il, id loop
    perform _scambio_trasferisci_riga(v_r.id);
  end loop;
  update richieste_scambio set stato_proposta = 'conclusa', stato = 'chiusa', aggiornato_il = now() where id = p_richiesta_id;
  insert into activity_log (user_id, source, action, details)
  values (v_p.richiedente_id, 'sito', 'scambio_concluso', jsonb_build_object('richiesta_id', p_richiesta_id)),
         (v_p.proprietario_id, 'sito', 'scambio_concluso', jsonb_build_object('richiesta_id', p_richiesta_id));
  return 'conclusa';
end;
$function$;

-- 10) permessi: le interne solo dal DB, le altre a chi ha fatto l'accesso
revoke execute on function public._scambio_disponibile(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public._scambio_trasferisci_riga(uuid) from public, anon, authenticated;
revoke execute on function public._scadi_proposte() from public, anon, authenticated;
revoke execute on function public.scadi_proposte() from public, anon;
revoke execute on function public.leggi_scambio_per_proposta(uuid) from public, anon;
revoke execute on function public.proponi_scambio(uuid, jsonb, jsonb, numeric, numeric, uuid) from public, anon;
revoke execute on function public.rispondi_proposta(uuid, boolean) from public, anon;
revoke execute on function public.annulla_proposta(uuid, text) from public, anon;
revoke execute on function public.segna_fatto_proposta(uuid) from public, anon;
grant execute on function public.scadi_proposte() to authenticated, service_role;
grant execute on function public.leggi_scambio_per_proposta(uuid) to authenticated, service_role;
grant execute on function public.proponi_scambio(uuid, jsonb, jsonb, numeric, numeric, uuid) to authenticated, service_role;
grant execute on function public.rispondi_proposta(uuid, boolean) to authenticated, service_role;
grant execute on function public.annulla_proposta(uuid, text) to authenticated, service_role;
grant execute on function public.segna_fatto_proposta(uuid) to authenticated, service_role;

-- 11) le funzioni di riga di oggi non toccano le righe di una proposta; etichetta chat per le proposte
do $do$
declare
  v_nome text;
  v_firma text;
  v_def text;
  v_vecchia text := 'if v_riga is null then raise exception ''Riga non trovata''; end if;';
  v_nuova text := 'if v_riga is null then raise exception ''Riga non trovata''; end if;'
               || chr(10) || '    if exists (select 1 from richieste_scambio p where p.id = v_riga.richiesta_id and p.tipo = ''proposta'') then'
               || ' raise exception ''Fa parte di una proposta di scambio: si gestisce dalla proposta''; end if; -- sql/154';
begin
  foreach v_firma in array array[
    'public.accetta_riga_richiesta(uuid)',
    'public.rifiuta_riga_richiesta(uuid)',
    'public.annulla_riga_richiesta(uuid,text)',
    'public.sblocca_riga_richiesta(uuid,text)',
    'public.concludi_riga_richiesta(uuid,text)'
  ] loop
    v_def := pg_get_functiondef(v_firma::regprocedure);
    if (length(v_def) - length(replace(v_def, v_vecchia, ''))) / length(v_vecchia) <> 1 then
      raise exception 'sql/154: in % la riga da cambiare non c''è una volta sola', v_firma;
    end if;
    execute replace(v_def, v_vecchia, v_nuova);
  end loop;

  v_def := pg_get_functiondef('public.invia_messaggio(uuid,text,uuid)'::regprocedure);
  v_vecchia := 'v_etichetta := ''Richiesta del ''';
  v_nuova := 'v_etichetta := case when v_req.tipo = ''proposta'' then ''Proposta del '' else ''Richiesta del '' end /* sql/154 */';
  if (length(v_def) - length(replace(v_def, v_vecchia, ''))) / length(v_vecchia) <> 1 then
    raise exception 'sql/154: in invia_messaggio la riga da cambiare non c''è una volta sola';
  end if;
  execute replace(v_def, v_vecchia, v_nuova);
end
$do$;

commit;

-- Verifica: colonne (11), funzioni nuove (9), le 6 funzioni di oggi con la riga di sql/154 (true) e
-- i loro permessi rimasti; nessuna proposta ancora.
select (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'richieste_scambio'
          and column_name in ('tipo', 'stato_proposta', 'euro_da_richiedente', 'euro_da_proprietario', 'fatto_richiedente_il',
                              'fatto_proprietario_il', 'sostituisce_id', 'motivo_chiusura', 'chiusa_da', 'scade_il', 'aggiornato_il')) as colonne,
       (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
          and p.proname in ('_scambio_disponibile', 'leggi_scambio_per_proposta', '_scadi_proposte', 'scadi_proposte', 'proponi_scambio',
                            'rispondi_proposta', 'annulla_proposta', '_scambio_trasferisci_riga', 'segna_fatto_proposta')) as funzioni_nuove,
       (select count(*) from public.richieste_scambio where tipo = 'proposta') as proposte;
select p.proname, pg_get_functiondef(p.oid) like '%sql/154%' as con_sql154, p.proacl::text as permessi
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('accetta_riga_richiesta', 'rifiuta_riga_richiesta', 'annulla_riga_richiesta', 'sblocca_riga_richiesta',
                     'concludi_riga_richiesta', 'invia_messaggio')
 order by 1;
