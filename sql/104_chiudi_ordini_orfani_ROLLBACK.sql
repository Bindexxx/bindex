-- ============================================================================
-- 104 ROLLBACK — riporta i 6 ordini orfani a 'in_corso' come prima di 104.
-- Prima di 104 avevano errore_msg e completato_il entrambi NULL (letto sul DB
-- LIVE il 2026-10-15). Tocca solo i 6 id e solo se sono ancora nello stato
-- scritto da 104 (stesso messaggio), così non annulla un'eventuale chiusura
-- fatta da altro.
-- Da eseguire nell'SQL editor di Supabase.
-- ============================================================================
update public.ordini
set stato = 'in_corso',
    errore_msg = null,
    completato_il = null
where id in (
  'ee166908-e426-4e49-b982-51e80ea9a085',
  'af45ad8b-ad75-43f0-9b33-07586046280d',
  'b468edb1-3cfe-4f05-9a97-e9276d884922',
  '3008262d-b8dc-430c-9840-d161532e248d',
  '1f5e21be-af8b-4979-9a71-6b8e03444eaa',
  '273dcee4-0378-43be-ae48-9c5f5974d740'
)
and stato = 'errore'
and errore_msg = 'Interrotto: la pagina dell''estensione si è chiusa o è stata ricaricata prima della fine.';

-- Verifica: deve restituire 6 righe in_corso.
select id, tipo, stato, preso_in_carico_il
from public.ordini
where stato = 'in_corso';
