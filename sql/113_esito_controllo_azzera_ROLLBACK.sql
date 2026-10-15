-- ============================================================================
-- ROLLBACK di sql/113: aggiorna_nota_controllo_gruppo torna IDENTICA a
-- sql/111 (con nota null azzera l'esito ma scrive comunque la data).
-- Solo CREATE OR REPLACE: eseguibile anche via connettore.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.aggiorna_nota_controllo_gruppo(p_id uuid, p_nota text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- sql/111 (punto 27): la diagnosi va in esito_controllo, mai in note; solo
  -- su carte prenotate da chi chiama o proprie.
  update carte
  set esito_controllo = p_nota,
      esito_controllo_il = now()
  where id = p_id
    and stato = 'collezione'
    and (claimed_by = auth.uid() or owner_id = auth.uid());
$function$;
