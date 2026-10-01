-- Rollback di sql/89 (foto carte). Le foto già caricate restano nel bucket.
UPDATE storage.buckets SET file_size_limit = NULL, allowed_mime_types = NULL WHERE id = 'foto-carte';
DROP FUNCTION IF EXISTS public.leggi_foto_carte(uuid[]);
DROP FUNCTION IF EXISTS public._carta_in_binder_pubblico(uuid);
DROP TRIGGER IF EXISTS trg_carte_pulisci_foto ON public.carte;
DROP TRIGGER IF EXISTS trg_prodotti_sealed_pulisci_foto ON public.prodotti_sealed;
DROP FUNCTION IF EXISTS public._foto_carte_pulisci_oggetto();
DROP TRIGGER IF EXISTS trg_foto_carte_controlla ON public.foto_carte;
DROP FUNCTION IF EXISTS public._foto_carte_controlla();
DROP TABLE IF EXISTS public.foto_carte_da_pulire;
DROP INDEX IF EXISTS public.idx_foto_carte_owner;
DROP INDEX IF EXISTS public.idx_foto_carte_carta;
DROP INDEX IF EXISTS public.foto_carte_un_fronte_retro;
ALTER TABLE public.foto_carte
    DROP CONSTRAINT IF EXISTS foto_carte_tabella_check,
    DROP CONSTRAINT IF EXISTS foto_carte_etichetta_check,
    DROP CONSTRAINT IF EXISTS foto_carte_tipo_check;
ALTER TABLE public.foto_carte DROP COLUMN IF EXISTS etichetta, DROP COLUMN IF EXISTS tipo;
