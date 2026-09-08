-- ============================================================
-- Control de obra — esquema base
-- Aplicar en Supabase (SQL Editor o `supabase migration new`)
-- ============================================================

create extension if not exists "pgcrypto";

-- ── proyectos ────────────────────────────────────────────────
create table proyectos (
  id                uuid primary key default gen_random_uuid(),
  nombre            text not null,
  clientes          text default '',
  presupuesto_obra  numeric(14,2) not null default 0,
  pct_honorarios    numeric(5,2)  not null default 15,
  direccion_efectivo     text default '',
  contacto_efectivo      text default '',
  instrucciones_efectivo text default '',
  owner_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  archivado         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- quién puede ver/editar cada proyecto (tú, tu esposa, la arquitecta)
create table proyecto_miembros (
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  rol         text not null default 'editor' check (rol in ('propietario','editor','lector')),
  created_at  timestamptz not null default now(),
  primary key (proyecto_id, user_id)
);

-- ── catálogo ─────────────────────────────────────────────────
create table proveedores (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  nombre      text not null,
  razon       text default '',
  banco       text default '',
  clabe       text default '',
  tel         text default '',
  nota        text default '',
  created_at  timestamptz not null default now(),
  unique (proyecto_id, nombre)
);

create table partidas (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  nombre      text not null,
  candado     numeric(14,2) not null default 0,   -- candado original; los traspasos lo ajustan
  orden       int not null default 0,
  created_at  timestamptz not null default now()
);
create index on partidas (proyecto_id, orden);

create table conceptos (
  id            uuid primary key default gen_random_uuid(),
  partida_id    uuid not null references partidas(id) on delete cascade,
  proveedor_id  uuid references proveedores(id) on delete set null,
  nombre        text not null,
  presupuesto   numeric(14,2) not null default 0,
  iva           numeric(14,2) not null default 0,
  base_presupuesto numeric(14,2) not null default 0,  -- presupuesto original, para la bitácora
  base_iva         numeric(14,2) not null default 0,
  estado        text not null default 'pendiente' check (estado in ('pendiente','porCerrar','cerrado')),
  logistica     text not null default 'porComprar'
                check (logistica in ('porComprar','cotizado','comprado','transito','recibido','instalado')),
  pedido        text default '',
  eta           date,
  nota          text default '',
  orden         int not null default 0,
  created_at    timestamptz not null default now()
);
create index on conceptos (partida_id, orden);
create index on conceptos (proveedor_id);
create index on conceptos (logistica) where logistica <> 'instalado';

create table concepto_links (
  id          uuid primary key default gen_random_uuid(),
  concepto_id uuid not null references conceptos(id) on delete cascade,
  titulo      text default '',
  url         text not null,
  created_at  timestamptz not null default now()
);
create index on concepto_links (concepto_id);

create table concepto_ajustes (
  id          uuid primary key default gen_random_uuid(),
  concepto_id uuid not null references conceptos(id) on delete cascade,
  fecha       date not null default current_date,
  anterior    numeric(14,2) not null,
  nuevo       numeric(14,2) not null,
  motivo      text default '',
  user_id     uuid default auth.uid() references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index on concepto_ajustes (concepto_id);

create table traspasos (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  de_id       uuid not null references partidas(id) on delete cascade,
  a_id        uuid not null references partidas(id) on delete cascade,
  monto       numeric(14,2) not null check (monto > 0),
  fecha       date not null default current_date,
  motivo      text default '',
  user_id     uuid default auth.uid() references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  check (de_id <> a_id)
);

-- ── pagos ────────────────────────────────────────────────────
create table relaciones (
  id           uuid primary key default gen_random_uuid(),
  proyecto_id  uuid not null references proyectos(id) on delete cascade,
  numero       int not null,
  fecha        date,
  fecha_limite date,
  created_at   timestamptz not null default now(),
  unique (proyecto_id, numero)
);

create table pagos (
  id           uuid primary key default gen_random_uuid(),
  proyecto_id  uuid not null references proyectos(id) on delete cascade,
  relacion_id  uuid references relaciones(id) on delete set null,
  concepto_id  uuid references conceptos(id) on delete cascade,
  proveedor_id uuid references proveedores(id) on delete set null,
  tipo         text not null default 'obra' check (tipo in ('obra','honorarios')),
  fase         text default '',                    -- solo honorarios
  monto        numeric(14,2) not null check (monto > 0),
  fecha        date not null default current_date,
  forma        text not null default 'Transferencia' check (forma in ('Efectivo','Transferencia')),
  status       text not null default 'Anticipo',   -- Anticipo / Pago a cuenta / Finiquito / Pago total
  estado       text not null default 'solicitado' check (estado in ('solicitado','autorizado','pagado')),
  de_excedente boolean not null default false,
  nota         text default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check ((tipo = 'obra' and concepto_id is not null) or tipo = 'honorarios')
);
create index on pagos (proyecto_id, estado);
create index on pagos (concepto_id);
create index on pagos (relacion_id);
create index on pagos (proveedor_id);

create table excedentes (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  concepto    text not null,
  monto       numeric(14,2) not null,
  fecha       date not null default current_date,
  created_at  timestamptz not null default now()
);

-- ── updated_at automático ────────────────────────────────────
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger t_proyectos_touch before update on proyectos
  for each row execute function touch_updated_at();
create trigger t_pagos_touch before update on pagos
  for each row execute function touch_updated_at();

-- ── bitácora automática de cambios de presupuesto ────────────
create or replace function log_ajuste_concepto() returns trigger
language plpgsql as $$
declare antes numeric(14,2); ahora numeric(14,2);
begin
  antes := old.presupuesto + old.iva;
  ahora := new.presupuesto + new.iva;
  if abs(ahora - antes) > 0.005 then
    insert into concepto_ajustes (concepto_id, anterior, nuevo, motivo)
    values (new.id, antes, ahora, coalesce(current_setting('app.motivo', true), ''));
  end if;
  return new;
end $$;

create trigger t_conceptos_ajuste after update of presupuesto, iva on conceptos
  for each row execute function log_ajuste_concepto();
-- para dejar el motivo:  select set_config('app.motivo','aditiva por cambio de acabado', true);

-- ── vistas de cálculo ────────────────────────────────────────
create view v_conceptos as
select c.*,
       (c.presupuesto + c.iva) as total,
       coalesce(pg.pagado, 0)     as pagado,
       coalesce(pg.en_tramite, 0) as en_tramite,
       (c.presupuesto + c.iva) - coalesce(pg.pagado, 0) as saldo
from conceptos c
left join lateral (
  select sum(monto) filter (where estado = 'pagado')  as pagado,
         sum(monto) filter (where estado <> 'pagado') as en_tramite
  from pagos where concepto_id = c.id
) pg on true;

create view v_partidas as
select p.*,
       p.candado
         + coalesce((select sum(monto) from traspasos where a_id  = p.id), 0)
         - coalesce((select sum(monto) from traspasos where de_id = p.id), 0) as candado_vigente,
       coalesce(sum(c.total), 0)  as comprometido,
       coalesce(sum(c.pagado), 0) as pagado
from partidas p
left join v_conceptos c on c.partida_id = p.id
group by p.id;

create view v_proveedores as
select v.*,
       coalesce((select sum(c.total)  from v_conceptos c where c.proveedor_id = v.id), 0) as contratado,
       coalesce((select sum(pg.monto) from pagos pg
                 where pg.proveedor_id = v.id and pg.estado = 'pagado'), 0)               as pagado
from proveedores v;

-- ── RLS ──────────────────────────────────────────────────────
alter table proyectos         enable row level security;
alter table proyecto_miembros enable row level security;
alter table proveedores       enable row level security;
alter table partidas          enable row level security;
alter table conceptos         enable row level security;
alter table concepto_links    enable row level security;
alter table concepto_ajustes  enable row level security;
alter table traspasos         enable row level security;
alter table relaciones        enable row level security;
alter table pagos             enable row level security;
alter table excedentes        enable row level security;

-- security definer: evita recursión de RLS al consultar la membresía
create or replace function puede_ver(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from proyectos   where id = p and owner_id = auth.uid())
      or exists (select 1 from proyecto_miembros where proyecto_id = p and user_id = auth.uid());
$$;

create or replace function puede_editar(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from proyectos where id = p and owner_id = auth.uid())
      or exists (select 1 from proyecto_miembros
                 where proyecto_id = p and user_id = auth.uid() and rol in ('propietario','editor'));
$$;

create policy p_ver on proyectos for select using (puede_ver(id));
create policy p_ins on proyectos for insert with check (owner_id = auth.uid());
create policy p_upd on proyectos for update using (puede_editar(id));
create policy p_del on proyectos for delete using (owner_id = auth.uid());

create policy m_ver on proyecto_miembros for select using (puede_ver(proyecto_id));
create policy m_all on proyecto_miembros for all
  using (exists (select 1 from proyectos where id = proyecto_id and owner_id = auth.uid()));

-- tablas con proyecto_id directo
do $$
declare t text;
begin
  foreach t in array array['proveedores','partidas','traspasos','relaciones','pagos','excedentes'] loop
    execute format('create policy %I_ver on %I for select using (puede_ver(proyecto_id))', t, t);
    execute format('create policy %I_esc on %I for all    using (puede_editar(proyecto_id)) with check (puede_editar(proyecto_id))', t, t);
  end loop;
end $$;

-- tablas anidadas
create policy c_ver on conceptos for select
  using (exists (select 1 from partidas p where p.id = partida_id and puede_ver(p.proyecto_id)));
create policy c_esc on conceptos for all
  using (exists (select 1 from partidas p where p.id = partida_id and puede_editar(p.proyecto_id)));

create policy cl_ver on concepto_links for select
  using (exists (select 1 from conceptos c join partidas p on p.id = c.partida_id
                 where c.id = concepto_id and puede_ver(p.proyecto_id)));
create policy cl_esc on concepto_links for all
  using (exists (select 1 from conceptos c join partidas p on p.id = c.partida_id
                 where c.id = concepto_id and puede_editar(p.proyecto_id)));

create policy ca_ver on concepto_ajustes for select
  using (exists (select 1 from conceptos c join partidas p on p.id = c.partida_id
                 where c.id = concepto_id and puede_ver(p.proyecto_id)));
create policy ca_ins on concepto_ajustes for insert
  with check (exists (select 1 from conceptos c join partidas p on p.id = c.partida_id
                      where c.id = concepto_id and puede_editar(p.proyecto_id)));
