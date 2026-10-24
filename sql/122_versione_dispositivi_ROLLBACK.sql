-- ============================================================================
-- 122 ROLLBACK — da eseguire a mano (DROP). Prima rimettere sui PC
-- un'estensione < 5.40 (la 5.40 chiama segnala_dispositivo; senza la funzione
-- la chiamata fallisce in silenzio, il resto funziona).
-- ============================================================================
drop function if exists public.segnala_dispositivo(text, text);
drop table if exists public.dispositivi_estensione;
