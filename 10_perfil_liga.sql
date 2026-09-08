-- Ya aplicado en la base el 2026-09-08.
-- Perfil del usuario (nombre, despacho, logo) y liga pública de solo lectura del reporte.

-- ── perfil ──
create table if not exists perfiles (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  nombre    text default '',
  despacho  text default '',
  telefono  text default '',
  logo_ruta text default '',      -- objeto en el bucket público "logos": <user_id>/logo.<ext>
  updated_at timestamptz not null default now()
);
alter table perfiles enable row level security;
create policy pf_propio on perfiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- los miembros de un proyecto pueden ver el perfil de sus compañeros (para "preparado por")
create policy pf_companeros on perfiles for select using (
  exists (select 1 from proyectos p where p.owner_id = perfiles.user_id and app.puede_ver(p.id))
  or exists (select 1 from proyecto_miembros m where m.user_id = perfiles.user_id and app.puede_ver(m.proyecto_id))
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152, array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do nothing;
create policy "logos ver" on storage.objects for select using (bucket_id = 'logos');
create policy "logos subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "logos cambiar" on storage.objects for update to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "logos borrar" on storage.objects for delete to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── ligas públicas del reporte ──
create table if not exists ligas_reporte (
  token       text primary key,
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  creado_por  uuid default auth.uid() references auth.users(id) on delete set null,
  activa      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists ligas_reporte_proyecto on ligas_reporte (proyecto_id);
alter table ligas_reporte enable row level security;
create policy lr_ver on ligas_reporte for select using (app.puede_ver(proyecto_id));
create policy lr_esc on ligas_reporte for all using (app.puede_editar(proyecto_id)) with check (app.puede_editar(proyecto_id));

-- Crea (o reactiva) la liga del proyecto. Un token largo aleatorio.
create or replace function public.crear_liga_reporte(p uuid) returns text
language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if not app.puede_editar(p) then raise exception 'Sin permiso'; end if;
  select token into t from ligas_reporte where proyecto_id = p and activa limit 1;
  if t is not null then return t; end if;
  t := encode(gen_random_bytes(18), 'base64');
  t := translate(t, '+/=', '-_');
  insert into ligas_reporte (token, proyecto_id) values (t, p);
  return t;
end $$;
grant execute on function public.crear_liga_reporte(uuid) to authenticated;

-- Datos del reporte para quien tenga la liga: sin cuenta, sin CLABEs, sin adjuntos.
create or replace function public.reporte_publico(t text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid uuid; out jsonb;
begin
  select proyecto_id into pid from ligas_reporte where token = t and activa;
  if pid is null then return null; end if;
  select jsonb_build_object(
    'proyecto', (select to_jsonb(p) - 'owner_id' from proyectos p where p.id = pid),
    'perfil', (select jsonb_build_object('nombre', pf.nombre, 'despacho', pf.despacho, 'telefono', pf.telefono, 'logo_ruta', pf.logo_ruta)
               from proyectos p left join perfiles pf on pf.user_id = p.owner_id where p.id = pid),
    'proveedores', (select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'nombre', v.nombre)), '[]'::jsonb) from proveedores v where v.proyecto_id = pid),
    'partidas', (select coalesce(jsonb_agg(to_jsonb(pa) order by pa.orden), '[]'::jsonb) from partidas pa where pa.proyecto_id = pid),
    'conceptos', (select coalesce(jsonb_agg(to_jsonb(c) order by c.orden), '[]'::jsonb) from conceptos c join partidas pa on pa.id = c.partida_id where pa.proyecto_id = pid),
    'ajustes', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from concepto_ajustes a join conceptos c on c.id = a.concepto_id join partidas pa on pa.id = c.partida_id where pa.proyecto_id = pid),
    'relaciones', (select coalesce(jsonb_agg(to_jsonb(r) order by r.numero), '[]'::jsonb) from relaciones r where r.proyecto_id = pid),
    'pagos', (select coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb) from pagos g where g.proyecto_id = pid),
    'excedentes', (select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) from excedentes e where e.proyecto_id = pid),
    'traspasos', (select coalesce(jsonb_agg(to_jsonb(tr)), '[]'::jsonb) from traspasos tr where tr.proyecto_id = pid)
  ) into out;
  return out;
end $$;
grant execute on function public.reporte_publico(text) to anon, authenticated;
