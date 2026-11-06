-- Liga un gasto compartido a un concepto de la obra (opcional). Si se liga, lo que
-- un miembro pagó de su bolsa cuenta como pagado de ese concepto en Obra y Resumen,
-- sin tener que capturarlo además como pago a proveedor.
-- Se puede correr más de una vez.

alter table gastos add column if not exists concepto_id uuid references conceptos(id) on delete set null;
create index if not exists gastos_concepto on gastos (concepto_id) where concepto_id is not null;

-- Alta o cambio de un gasto con su reparto, en una sola transacción.
-- d = { id?, proyecto_id, descripcion, monto, fecha, pagado_por, reparto, nota, concepto_id?, partes: [{ user_id, monto }] }
create or replace function app.guardar_gasto(d jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  gid uuid := nullif(d->>'id', '')::uuid;
  pid uuid := (d->>'proyecto_id')::uuid;
  pagador uuid := (d->>'pagado_por')::uuid;
  cid uuid := nullif(d->>'concepto_id', '')::uuid;
  total numeric(14,2) := round((d->>'monto')::numeric, 2);
  suma numeric(14,2);
  parte jsonb;
begin
  if pid is null or not app.puede_ver(pid) then raise exception 'Sin permiso en este proyecto'; end if;
  if coalesce(trim(d->>'descripcion'), '') = '' then raise exception 'Falta la descripción'; end if;
  if total is null or total <= 0 then raise exception 'El monto debe ser mayor a cero'; end if;
  if not app.es_participante(pid, pagador) then raise exception 'Quien pagó no es miembro del proyecto'; end if;
  if cid is not null and not exists (select 1 from conceptos c join partidas pa on pa.id = c.partida_id where c.id = cid and pa.proyecto_id = pid) then
    raise exception 'El concepto no es de este proyecto';
  end if;
  if jsonb_typeof(d->'partes') <> 'array' or jsonb_array_length(d->'partes') = 0 then raise exception 'Elige entre quiénes se reparte'; end if;
  for parte in select * from jsonb_array_elements(d->'partes') loop
    if not app.es_participante(pid, (parte->>'user_id')::uuid) then raise exception 'Alguien del reparto no es miembro del proyecto'; end if;
    if (parte->>'monto')::numeric < 0 then raise exception 'Un monto del reparto es negativo'; end if;
  end loop;
  select coalesce(sum(round((x->>'monto')::numeric, 2)), 0) into suma from jsonb_array_elements(d->'partes') x;
  if abs(suma - total) > 0.009 then raise exception 'El reparto suma % y el gasto es de %', suma, total; end if;

  if gid is null then
    insert into gastos (proyecto_id, descripcion, monto, fecha, pagado_por, reparto, nota, concepto_id, user_id)
    values (pid, trim(d->>'descripcion'), total, coalesce(nullif(d->>'fecha', '')::date, current_date), pagador,
            coalesce(nullif(d->>'reparto', ''), 'igual'), coalesce(d->>'nota', ''), cid, auth.uid())
    returning id into gid;
  else
    if not exists (select 1 from gastos g where g.id = gid and g.proyecto_id = pid
                   and app.puede_tocar_gasto(pid, g.user_id, array[g.pagado_por] || array(select user_id from gasto_partes where gasto_id = gid))) then
      raise exception 'No puedes cambiar este gasto';
    end if;
    update gastos set descripcion = trim(d->>'descripcion'), monto = total,
      fecha = coalesce(nullif(d->>'fecha', '')::date, fecha), pagado_por = pagador,
      reparto = coalesce(nullif(d->>'reparto', ''), 'igual'), nota = coalesce(d->>'nota', ''), concepto_id = cid
    where id = gid;
    delete from gasto_partes where gasto_id = gid;
  end if;

  insert into gasto_partes (gasto_id, user_id, monto)
  select gid, (x->>'user_id')::uuid, round((x->>'monto')::numeric, 2) from jsonb_array_elements(d->'partes') x;
  return gid;
end $$;
