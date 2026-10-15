-- ============================================================================
-- 104 — CHIUSURA DEI 6 ORDINI "IN CORSO" ORFANI (una tantum)
-- Letto sul DB LIVE il 2026-10-15: in public.ordini ci sono esattamente 6
-- ordini 'controlla_prezzi' fermi in stato 'in_corso' dal 23/08 al 30/08/2026,
-- tutti presi in carico dallo stesso utente e mai chiusi (la pagina
-- dell'estensione si era chiusa o ricaricata a metà sessione — il bug corretto
-- nella 5.17). Nessun trigger su ordini; nessun CHECK sulla colonna stato.
--
-- EFFETTO: passano a 'errore' con un messaggio chiaro e completato_il = now().
-- Tocca SOLO questi 6 id e SOLO se sono ancora 'in_corso' (rieseguibile, non
-- tocca nulla se nel frattempo sono cambiati). Dalla 5.17 in poi l'estensione
-- chiude da sola i propri ordini rimasti 'in_corso' da più di 6 ore, quindi
-- questo script serve solo per pulire i vecchi.
--
-- Da eseguire nell'SQL editor di Supabase (o via connettore: è un UPDATE).
-- PER ANNULLARE: sql/104_chiudi_ordini_orfani_ROLLBACK.sql
-- ============================================================================
update public.ordini
set stato = 'errore',
    errore_msg = 'Interrotto: la pagina dell''estensione si è chiusa o è stata ricaricata prima della fine.',
    completato_il = now()
where id in (
  'ee166908-e426-4e49-b982-51e80ea9a085',
  'af45ad8b-ad75-43f0-9b33-07586046280d',
  'b468edb1-3cfe-4f05-9a97-e9276d884922',
  '3008262d-b8dc-430c-9840-d161532e248d',
  '1f5e21be-af8b-4979-9a71-6b8e03444eaa',
  '273dcee4-0378-43be-ae48-9c5f5974d740'
)
and stato = 'in_corso';

-- Verifica: deve restituire 0 righe.
select id, tipo, stato, preso_in_carico_il
from public.ordini
where stato = 'in_corso';
