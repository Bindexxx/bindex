-- 79_traguardo_il_tuo_telefono_ROLLBACK.sql — 2026-09-26
-- Toglie il traguardo t_il_tuo_telefono dal DB: la riga ricompensa e TUTTE
-- le righe traguardi_riscossi di quel traguardo (anche quelle sbloccate
-- dopo la 79). Le 5 polvere eventualmente già accreditate da allora in
-- inventario_ricompense (riferimento_id = 't_il_tuo_telefono') NON vengono
-- tolte: sono premi già dati. Da usare insieme al ripristino dei file JS
-- precedenti (missione m95 al posto del traguardo).

delete from public.traguardi_riscossi where traguardo_id = 't_il_tuo_telefono';
delete from public.catalogo_ricompense where voce_id = 't_il_tuo_telefono';
