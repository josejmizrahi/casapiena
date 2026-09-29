-- Gastos compartidos entre los miembros del proyecto (estilo Splitwise).
-- Cada quien registra lo que pagó de su bolsa, se reparte entre los participantes
-- y la app calcula quién le debe a quién. Las liquidaciones registran lo que se
-- pagan entre ellos para quedar a mano. No tocan el presupuesto de la obra.

create table if not exists gastos (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  descripcion text not null,
  monto       numeric(14,2) not null check (monto > 0),
  fecha       date not null default current_date,
  pagado_por  uuid not null references auth.users(id) on delete cascade,
  reparto     text not null default 'igual' check (reparto in ('igual','montos')),
  nota        text default '',
  user_id     uuid default auth.uid() references auth.users(id) on delete set null,  -- quién lo capturó
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists gastos_proyecto on gastos (proyecto_id, fecha desc);

-- lo que le toca a cada participante de un gasto; la suma es el monto del gasto
create table if not exists gasto_partes (
  gasto_id uuid not null references gastos(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  monto    numeric(14,2) not null check (monto >= 0),
  primary key (gasto_id, user_id)
);
create index if not exists gasto_partes_user on gasto_partes (user_id);

-- pagos entre miembros para saldar cuentas: "de" le paga a "a"
create table if not exists liquidaciones (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  de_id       uuid not null references auth.users(id) on delete cascade,
  a_id        uuid not null references auth.users(id) on delete cascade,
  monto       numeric(14,2) not null check (monto > 0),
  fecha       date not null default current_date,
  nota        text default '',
  user_id     uuid default auth.uid() references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  check (de_id <> a_id)
);
create index if not exists liquidaciones_proyecto on liquidaciones (proyecto_id, fecha desc);

drop trigger if exists t_gastos_touch on gastos;
create trigger t_gastos_touch before update on gastos
  for each row execute function touch_updated_at();

-- ¿u es dueño o miembro del proyecto p?
create or replace function app.es_participante(p uuid, u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from proyectos where id = p and owner_id = u)
      or exists (select 1 from proyecto_miembros where proyecto_id = p and user_id = u);
$$;

-- Puede modificar un gasto o liquidación quien lo capturó, quien aparece en él, o un editor.
create or replace function app.puede_tocar_gasto(p uuid, capturo uuid, involucrados uuid[]) returns boolean
language sql stable security definer set search_path = public as $$
  select app.puede_ver(p) and (capturo = auth.uid() or auth.uid() = any(involucrados) or app.puede_editar(p));
$$;

alter table gastos        enable row level security;
alter table gasto_partes  enable row level security;
alter table liquidaciones enable row level security;

-- Todos los que ven el proyecto ven los gastos. Altas y cambios de gastos pasan
-- por guardar_gasto() para que el gasto y su reparto se guarden juntos.
create policy gs_ver on gastos for select using (app.puede_ver(proyecto_id));
create policy gs_del on gastos for delete using (app.puede_tocar_gasto(proyecto_id, user_id, array[pagado_por]));
create policy gp_ver on gasto_partes for select
  using (exists (select 1 from gastos g where g.id = gasto_id and app.puede_ver(g.proyecto_id)));

create policy lq_ver on liquidaciones for select using (app.puede_ver(proyecto_id));
create policy lq_ins on liquidaciones for insert with check (
  app.puede_ver(proyecto_id) and user_id = auth.uid()
  and app.es_participante(proyecto_id, de_id) and app.es_participante(proyecto_id, a_id)
);
create policy lq_del on liquidaciones for delete using (app.puede_tocar_gasto(proyecto_id, user_id, array[de_id, a_id]));

-- Participantes: dueño y miembros con cuenta (activos) más quien ya no está pero
-- aparece en algún gasto o liquidación, para que el historial conserve su nombre.
create or replace function app.participantes_gastos(p uuid)
returns table (user_id uuid, email text, nombre text, activo boolean)
language sql stable security definer set search_path = public as $$
  with ids as (
    select owner_id as id from proyectos where id = p
    union select m.user_id from proyecto_miembros m where m.proyecto_id = p
    union select g.pagado_por from gastos g where g.proyecto_id = p
    union select gp.user_id from gasto_partes gp join gastos g on g.id = gp.gasto_id where g.proyecto_id = p
    union select l.de_id from liquidaciones l where l.proyecto_id = p
    union select l.a_id from liquidaciones l where l.proyecto_id = p
  )
  select u.id, u.email::text, coalesce(pf.nombre, ''), app.es_participante(p, u.id)
  from ids join auth.users u on u.id = ids.id left join perfiles pf on pf.user_id = u.id
  where app.puede_ver(p)
  order by 4 desc, 2;
$$;

-- Alta o cambio de un gasto con su reparto, en una sola transacción.
-- d = { id?, proyecto_id, descripcion, monto, fecha, pagado_por, reparto, nota, partes: [{ user_id, monto }] }
create or replace function app.guardar_gasto(d jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  gid uuid := nullif(d->>'id', '')::uuid;
  pid uuid := (d->>'proyecto_id')::uuid;
  pagador uuid := (d->>'pagado_por')::uuid;
  total numeric(14,2) := round((d->>'monto')::numeric, 2);
  suma numeric(14,2);
  parte jsonb;
begin
  if pid is null or not app.puede_ver(pid) then raise exception 'Sin permiso en este proyecto'; end if;
  if coalesce(trim(d->>'descripcion'), '') = '' then raise exception 'Falta la descripción'; end if;
  if total is null or total <= 0 then raise exception 'El monto debe ser mayor a cero'; end if;
  if not app.es_participante(pid, pagador) then raise exception 'Quien pagó no es miembro del proyecto'; end if;
  if jsonb_typeof(d->'partes') <> 'array' or jsonb_array_length(d->'partes') = 0 then raise exception 'Elige entre quiénes se reparte'; end if;
  for parte in select * from jsonb_array_elements(d->'partes') loop
    if not app.es_participante(pid, (parte->>'user_id')::uuid) then raise exception 'Alguien del reparto no es miembro del proyecto'; end if;
    if (parte->>'monto')::numeric < 0 then raise exception 'Un monto del reparto es negativo'; end if;
  end loop;
  select coalesce(sum(round((x->>'monto')::numeric, 2)), 0) into suma from jsonb_array_elements(d->'partes') x;
  if abs(suma - total) > 0.009 then raise exception 'El reparto suma % y el gasto es de %', suma, total; end if;

  if gid is null then
    insert into gastos (proyecto_id, descripcion, monto, fecha, pagado_por, reparto, nota, user_id)
    values (pid, trim(d->>'descripcion'), total, coalesce(nullif(d->>'fecha', '')::date, current_date), pagador,
            coalesce(nullif(d->>'reparto', ''), 'igual'), coalesce(d->>'nota', ''), auth.uid())
    returning id into gid;
  else
    if not exists (select 1 from gastos g where g.id = gid and g.proyecto_id = pid
                   and app.puede_tocar_gasto(pid, g.user_id, array[g.pagado_por] || array(select user_id from gasto_partes where gasto_id = gid))) then
      raise exception 'No puedes cambiar este gasto';
    end if;
    update gastos set descripcion = trim(d->>'descripcion'), monto = total,
      fecha = coalesce(nullif(d->>'fecha', '')::date, fecha), pagado_por = pagador,
      reparto = coalesce(nullif(d->>'reparto', ''), 'igual'), nota = coalesce(d->>'nota', '')
    where id = gid;
    delete from gasto_partes where gasto_id = gid;
  end if;

  insert into gasto_partes (gasto_id, user_id, monto)
  select gid, (x->>'user_id')::uuid, round((x->>'monto')::numeric, 2) from jsonb_array_elements(d->'partes') x;
  return gid;
end $$;

-- Expuestas en public para llamarlas por RPC desde el cliente.
create or replace function public.participantes_gastos(p uuid) returns table (user_id uuid, email text, nombre text, activo boolean)
language sql stable security definer set search_path = public as $$ select * from app.participantes_gastos(p); $$;
create or replace function public.guardar_gasto(d jsonb) returns uuid
language sql security definer set search_path = public as $$ select app.guardar_gasto(d); $$;
revoke all on function public.participantes_gastos(uuid) from anon;
revoke all on function public.guardar_gasto(jsonb) from anon;
grant execute on function public.participantes_gastos(uuid) to authenticated;
grant execute on function public.guardar_gasto(jsonb) to authenticated;
