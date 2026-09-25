-- ═══════════════════════════════════════════════════════════════════════
-- 79_traguardo_il_tuo_telefono.sql — 2026-09-26
-- Rollback: 79_traguardo_il_tuo_telefono_ROLLBACK.sql
--
-- Decisione Claudio (2026-09-26): la missione una_tantum
-- m95_il_tuo_telefono (non più visibile da nessuna parte dopo la rimozione
-- della tab "Permanenti") diventa il TRAGUARDO t_il_tuo_telefono, visibile
-- nel widget Achievement. Stessa ricompensa (5 polvere).
--
-- Verificato sul DB live prima di scrivere:
--   - catalogo_ricompense.voce_id è PRIMARY KEY su tutta la tabella →
--     serve un id NUOVO (non si può riusare m95_il_tuo_telefono con
--     categoria 'traguardo'); categoria ammessa dal CHECK: 'traguardo'.
--   - riscatta_traguardo() legge la ricompensa da catalogo_ricompense
--     (voce_id + categoria='traguardo'): senza questa riga il traguardo si
--     sbloccherebbe senza premio.
--   - traguardi_riscossi ha UNIQUE (owner_id, traguardo_id).
--   - 4 utenti hanno già completato m95 (e ricevuto le 5 polvere): per loro
--     il traguardo viene segnato come già ottenuto, SENZA ricompensa, così
--     non la prendono due volte alla prossima modifica del layout.
-- La riga m95_il_tuo_telefono di catalogo_ricompense resta (storico delle
-- missioni già completate, innocua).
-- ═══════════════════════════════════════════════════════════════════════

insert into public.catalogo_ricompense (voce_id, categoria, tipo_ricompensa, quantita, riferimento)
values ('t_il_tuo_telefono', 'traguardo', 'polvere', 5, null)
on conflict (voce_id) do nothing;

insert into public.traguardi_riscossi (owner_id, traguardo_id, riscosso_il)
select mc.owner_id, 't_il_tuo_telefono', min(mc.completato_il)
from public.missioni_completate mc
where mc.missione_id = 'm95_il_tuo_telefono'
group by mc.owner_id
on conflict (owner_id, traguardo_id) do nothing;

-- VERIFICA (sola lettura). Attesi: ricompensa = 1, gia_ottenuto = numero
-- di utenti che avevano completato m95 (4 al 2026-09-26).
select
  (select count(*) from public.catalogo_ricompense where voce_id = 't_il_tuo_telefono' and categoria = 'traguardo') as ricompensa,
  (select count(*) from public.traguardi_riscossi where traguardo_id = 't_il_tuo_telefono') as gia_ottenuto,
  (select count(distinct owner_id) from public.missioni_completate where missione_id = 'm95_il_tuo_telefono') as utenti_m95;
