-- ROLLBACK di 154: toglie le proposte di scambio a due vie.
-- ATTENZIONE: cancella le proposte (testate tipo 'proposta' e le loro righe). Gli oggetti già passati
-- con uno scambio concluso restano dove sono. Le richieste di prima e quelle degli ospiti restano.
-- Rimette nelle 6 funzioni di oggi il testo di prima (stesso metodo: testo dal DB + replace, si ferma
-- se la riga di sql/154 non c'è esattamente una volta). Corpo delle funzioni prima di sql/154
-- (md5 di pg_get_functiondef, 19/11/2026):
--   accetta_riga_richiesta   a166ec78eaf5d601ac065c4a78f5cd4f
--   annulla_riga_richiesta   b994162db610b0bcfb6af6239bd0f74c
--   concludi_riga_richiesta  d6bec9c9ae16b1c7997551c6841913ba
--   invia_messaggio          5dc757f35771a027199a8597c9e1c635
--   rifiuta_riga_richiesta   f5e76e9f56758c087423da0631053c04
--   sblocca_riga_richiesta   e15eadb10f52f2a62b8e6fc8f658fe0a
-- Prima del ROLLBACK riportare il sito alla versione senza proposte (il sito nuovo chiama le funzioni
-- di sql/154). Si lancia dall'SQL Editor (contiene DROP e DELETE).

begin;

do $do$
declare
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
    if (length(v_def) - length(replace(v_def, v_nuova, ''))) / length(v_nuova) <> 1 then
      raise exception 'ROLLBACK 154: in % la riga di sql/154 non c''è una volta sola', v_firma;
    end if;
    execute replace(v_def, v_nuova, v_vecchia);
  end loop;

  v_def := pg_get_functiondef('public.invia_messaggio(uuid,text,uuid)'::regprocedure);
  v_nuova := 'v_etichetta := case when v_req.tipo = ''proposta'' then ''Proposta del '' else ''Richiesta del '' end /* sql/154 */';
  v_vecchia := 'v_etichetta := ''Richiesta del ''';
  if (length(v_def) - length(replace(v_def, v_nuova, ''))) / length(v_nuova) <> 1 then
    raise exception 'ROLLBACK 154: in invia_messaggio la riga di sql/154 non c''è una volta sola';
  end if;
  execute replace(v_def, v_nuova, v_vecchia);
end
$do$;

drop function if exists public.segna_fatto_proposta(uuid);
drop function if exists public._scambio_trasferisci_riga(uuid);
drop function if exists public.annulla_proposta(uuid, text);
drop function if exists public.rispondi_proposta(uuid, boolean);
drop function if exists public.proponi_scambio(uuid, jsonb, jsonb, numeric, numeric, uuid);
drop function if exists public.scadi_proposte();
drop function if exists public._scadi_proposte();
drop function if exists public.leggi_scambio_per_proposta(uuid);
drop function if exists public._scambio_disponibile(uuid, text, uuid);

-- i messaggi della chat che citavano una proposta restano, senza il collegamento
update public.messaggi set richiesta_id = null
 where richiesta_id in (select id from public.richieste_scambio where tipo = 'proposta');
delete from public.richieste_scambio where tipo = 'proposta';

alter table public.richieste_scambio
  drop constraint if exists richieste_scambio_motivo_chiusura_check,
  drop constraint if exists richieste_scambio_proposta_senza_ospite,
  drop constraint if exists richieste_scambio_euro_check,
  drop constraint if exists richieste_scambio_stato_proposta_check,
  drop constraint if exists richieste_scambio_tipo_check,
  drop column if exists aggiornato_il,
  drop column if exists scade_il,
  drop column if exists chiusa_da,
  drop column if exists motivo_chiusura,
  drop column if exists sostituisce_id,
  drop column if exists fatto_proprietario_il,
  drop column if exists fatto_richiedente_il,
  drop column if exists euro_da_proprietario,
  drop column if exists euro_da_richiedente,
  drop column if exists stato_proposta,
  drop column if exists tipo;

commit;

-- Verifica: md5 uguali a quelli in testa, funzioni nuove sparite (0), colonne sparite (0).
select p.proname, md5(pg_get_functiondef(p.oid)) as md5
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('accetta_riga_richiesta', 'rifiuta_riga_richiesta', 'annulla_riga_richiesta', 'sblocca_riga_richiesta',
                     'concludi_riga_richiesta', 'invia_messaggio')
 order by 1;
select (select count(*) from pg_proc where proname in ('_scambio_disponibile', 'leggi_scambio_per_proposta', '_scadi_proposte',
          'scadi_proposte', 'proponi_scambio', 'rispondi_proposta', 'annulla_proposta', '_scambio_trasferisci_riga',
          'segna_fatto_proposta')) as funzioni_nuove,
       (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'richieste_scambio'
          and column_name in ('tipo', 'stato_proposta', 'euro_da_richiedente', 'scade_il')) as colonne;
