-- Ya aplicado en la base el 2026-09-08.
-- La línea base es el primer presupuesto distinto de cero: capturar el primer
-- monto no es un ajuste y no debe salir en la bitácora. (El cliente, al guardar
-- un concepto cuya base es cero, copia el nuevo presupuesto a base_presupuesto/base_iva.)
create or replace function public.log_ajuste_concepto() returns trigger
language plpgsql set search_path to 'public', 'pg_temp' as $$
declare antes numeric(14,2); ahora numeric(14,2);
begin
  antes := old.presupuesto + old.iva;
  ahora := new.presupuesto + new.iva;
  if antes > 0.005 and abs(ahora - antes) > 0.005 then
    insert into concepto_ajustes (concepto_id, anterior, nuevo, motivo)
    values (new.id, antes, ahora, coalesce(current_setting('app.motivo', true), ''));
  end if;
  return new;
end $$;
