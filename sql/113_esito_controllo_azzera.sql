-- ============================================================================
-- 113 — ESITO DEL CONTROLLO PREZZI: AZZERAMENTO PULITO
--
-- Dalla 5.21 l'estensione chiama aggiorna_nota_controllo_gruppo(p_id, null)
-- quando trova il prezzo di una carta, per togliere la diagnosi di un giro
-- precedente ("Prezzo non trovato..."). Con la funzione di sql/111 questo già
-- funziona (esito_controllo = null), ma esito_controllo_il resterebbe con la
-- data della chiamata: una data senza esito. Qui, con nota null, si azzerano
-- tutte e due.
--
-- Stessa firma: solo CREATE OR REPLACE (permessi invariati). Stessi controlli
-- di sql/111 (solo carte in collezione, prenotate da chi chiama o proprie).
-- Compatibile con l'estensione 5.18–5.21: NON è necessaria per la 5.21, la
-- rende solo più ordinata.
--
-- NON ANCORA ESEGUITO. PER ANNULLARE: sql/113_esito_controllo_azzera_ROLLBACK.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION public.aggiorna_nota_controllo_gruppo(p_id uuid, p_nota text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- sql/111 (punto 27): la diagnosi va in esito_controllo, mai in note; solo
  -- su carte prenotate da chi chiama o proprie.
  -- sql/113: nota null = prezzo trovato → esito e data tolti insieme.
  update carte
  set esito_controllo = p_nota,
      esito_controllo_il = case when p_nota is null then null else now() end
  where id = p_id
    and stato = 'collezione'
    and (claimed_by = auth.uid() or owner_id = auth.uid());
$function$;

-- ── VERIFICA ───────────────────────────────────────────────────────────────
-- attesa: 1 (la funzione contiene "sql/113")
select count(*) as funzione_aggiornata
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'aggiorna_nota_controllo_gruppo'
  and pg_get_functiondef(p.oid) like '%sql/113%';
