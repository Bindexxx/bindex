-- ROLLBACK di 91_shop.sql — toglie lo Shop.
-- ATTENZIONE: le righe di polvere spesa/rimborsata ('shop:%', 'rimborso:%')
-- e le bustine/skip comprate restano in inventario_ricompense (sono storia
-- del saldo). Se si vuole ridare la polvere spesa, decommentare il blocco A
-- PRIMA di eseguire il resto.
begin;

-- A) (facoltativo) restituisce la polvere spesa e non già rimborsata
-- insert into public.inventario_ricompense (owner_id, tipo, riferimento_id, quantita)
-- select compratore_id, 'polvere', 'rimborso:' || id, prezzo
--   from public.shop_acquisti where rimborsato_il is null;

drop policy if exists "shop articoli: admin carica" on storage.objects;
drop policy if exists "shop articoli: admin aggiorna" on storage.objects;
drop policy if exists "shop articoli: admin cancella" on storage.objects;
-- Il bucket si cancella solo se vuoto (svuotarlo prima dalla dashboard):
delete from storage.buckets where id = 'shop-articoli'
   and not exists (select 1 from storage.objects where bucket_id = 'shop-articoli');

drop function if exists public.shop_admin_ritira(uuid);
drop function if exists public.shop_admin_salva(jsonb);
drop function if exists public.shop_destinatari_regalo();
drop function if exists public.shop_attiva(uuid, boolean);
drop function if exists public.shop_compra(uuid, uuid);
drop function if exists public._shop_attiva_esclusivo(uuid, uuid);
drop function if exists public._shop_gruppo(text, jsonb);
drop table if exists public.shop_possessi;
drop table if exists public.shop_acquisti;
drop table if exists public.shop_articoli;

commit;
