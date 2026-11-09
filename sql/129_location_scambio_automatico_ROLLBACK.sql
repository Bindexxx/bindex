-- ROLLBACK di 129. Le carte già messe in Scambio dalla spunta restano in Scambio (si tolgono a mano).
-- Prima concludi_riga_richiesta torna com'era (finché esiste la colonna), poi via il resto.
do $patch$
declare
    v_def text := pg_get_functiondef('public.concludi_riga_richiesta(uuid, text)'::regprocedure);
    v_da text := ' and not exists (select 1 from location l where l.owner_id = v_carta.owner_id and l.tipo = ''carta'' and l.nome = v_carta.location and l.scambio_automatico);';
begin
    if position(v_da in v_def) > 0 then
        execute replace(v_def, v_da, ';');
    end if;
end
$patch$;
drop trigger if exists trg_carte_scambio_automatico on public.carte;
drop function if exists public._carte_scambio_automatico();
drop function if exists public.imposta_location_scambio_automatico(text, boolean);
drop function if exists public._binder_scambio_di(uuid);
alter table public.location drop column if exists scambio_automatico;
