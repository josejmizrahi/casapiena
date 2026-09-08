-- Ya aplicado en la base el 2026-09-08.
-- Fase 3: catálogo de proveedores y plantillas por usuario, archivos adjuntos.

-- ── catálogo de proveedores (a nivel usuario, se reutiliza entre proyectos) ──
create table if not exists catalogo_proveedores (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre     text not null,
  razon      text default '',
  banco      text default '',
  clabe      text default '',
  tel        text default '',
  nota       text default '',
  updated_at timestamptz not null default now(),
  unique (user_id, nombre)
);
alter table catalogo_proveedores enable row level security;
create policy cp_todo on catalogo_proveedores for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── plantillas de proyecto (partidas y conceptos guardados por el usuario) ──
create table if not exists plantillas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre      text not null,
  descripcion text default '',
  -- [{ nombre, pct, contingencia, conceptos: [{ nombre, unidad, prioridad }] }]
  cuerpo      jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);
alter table plantillas enable row level security;
create policy pl_todo on plantillas for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── adjuntos (fotos, facturas, comprobantes) ligados a un concepto o a un pago ──
create table if not exists adjuntos (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  concepto_id uuid references conceptos(id) on delete cascade,
  pago_id     uuid references pagos(id) on delete cascade,
  nombre      text not null,
  ruta        text not null,          -- <proyecto_id>/<uuid>.<ext> dentro del bucket "adjuntos"
  tipo        text default '',
  tamano      integer default 0,
  user_id     uuid default auth.uid() references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  check (concepto_id is not null or pago_id is not null)
);
create index if not exists adjuntos_concepto on adjuntos (concepto_id);
create index if not exists adjuntos_pago on adjuntos (pago_id);
alter table adjuntos enable row level security;
create policy ad_ver on adjuntos for select using (app.puede_ver(proyecto_id));
create policy ad_esc on adjuntos for all using (app.puede_editar(proyecto_id)) with check (app.puede_editar(proyecto_id));

-- ── bucket privado; la carpeta raíz de cada objeto es el id del proyecto ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('adjuntos', 'adjuntos', false, 15728640, array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do nothing;

create policy "adjuntos ver" on storage.objects for select to authenticated
  using (bucket_id = 'adjuntos' and app.puede_ver(((storage.foldername(name))[1])::uuid));
create policy "adjuntos subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'adjuntos' and app.puede_editar(((storage.foldername(name))[1])::uuid));
create policy "adjuntos borrar" on storage.objects for delete to authenticated
  using (bucket_id = 'adjuntos' and app.puede_editar(((storage.foldername(name))[1])::uuid));
