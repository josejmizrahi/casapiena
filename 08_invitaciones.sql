-- Ya aplicado en la base el 2026-09-08.
-- Invitar por correo a personas sin cuenta: la invitación queda pendiente y se
-- convierte en membresía cuando esa persona crea su cuenta con el mismo correo.

create table if not exists invitaciones (
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  email       text not null,
  rol         text not null default 'editor' check (rol in ('editor','lector')),
  invitado_por uuid default auth.uid() references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (proyecto_id, email)
);
alter table invitaciones enable row level security;
create policy inv_ver on invitaciones for select using (app.puede_ver(proyecto_id));
create policy inv_del on invitaciones for delete
  using (exists (select 1 from proyectos where id = proyecto_id and owner_id = auth.uid()));

-- Cambian los tipos de retorno: se borran las versiones anteriores primero.
drop function if exists public.miembros_de(uuid);
drop function if exists public.agregar_miembro(uuid, text, text);
drop function if exists app.miembros_de(uuid);
drop function if exists app.agregar_miembro(uuid, text, text);

-- Agregar miembro: si el correo ya tiene cuenta, entra de inmediato; si no, queda invitado.
create function app.agregar_miembro(p uuid, correo text, r text)
returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid; c text := lower(trim(correo));
begin
  if not exists (select 1 from proyectos where id = p and owner_id = auth.uid()) then
    raise exception 'Solo el dueño del proyecto puede agregar miembros';
  end if;
  if r not in ('editor','lector') then raise exception 'Rol inválido'; end if;
  if c !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Correo inválido'; end if;
  select id into uid from auth.users where lower(email) = c;
  if uid = auth.uid() then raise exception 'Ya eres el dueño del proyecto'; end if;
  if uid is null then
    insert into invitaciones (proyecto_id, email, rol) values (p, c, r)
    on conflict (proyecto_id, email) do update set rol = excluded.rol;
    return 'invitado';
  end if;
  insert into proyecto_miembros (proyecto_id, user_id, rol) values (p, uid, r)
  on conflict (proyecto_id, user_id) do update set rol = excluded.rol;
  return 'agregado';
end $$;

-- Lista miembros e invitaciones pendientes.
create function app.miembros_de(p uuid)
returns table (user_id uuid, email text, rol text, pendiente boolean)
language sql stable security definer set search_path = public as $$
  select m.user_id, u.email::text, m.rol, false
  from proyecto_miembros m join auth.users u on u.id = m.user_id
  where m.proyecto_id = p and app.puede_ver(p)
  union all
  select null, i.email, i.rol, true from invitaciones i where i.proyecto_id = p and app.puede_ver(p)
  order by 4, 2;
$$;

create function public.miembros_de(p uuid) returns table (user_id uuid, email text, rol text, pendiente boolean)
language sql stable security definer set search_path = public as $$ select * from app.miembros_de(p); $$;
create function public.agregar_miembro(p uuid, correo text, r text) returns text
language sql security definer set search_path = public as $$ select app.agregar_miembro(p, correo, r); $$;
revoke all on function public.miembros_de(uuid) from anon;
revoke all on function public.agregar_miembro(uuid, text, text) from anon;
grant execute on function public.miembros_de(uuid) to authenticated;
grant execute on function public.agregar_miembro(uuid, text, text) to authenticated;

-- Al crearse una cuenta, sus invitaciones pendientes se vuelven membresías.
create or replace function app.aplicar_invitaciones() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into proyecto_miembros (proyecto_id, user_id, rol)
  select i.proyecto_id, new.id, i.rol from invitaciones i where lower(i.email) = lower(new.email)
  on conflict (proyecto_id, user_id) do update set rol = excluded.rol;
  delete from invitaciones where lower(email) = lower(new.email);
  return new;
end $$;
drop trigger if exists t_aplicar_invitaciones on auth.users;
create trigger t_aplicar_invitaciones after insert on auth.users
  for each row execute function app.aplicar_invitaciones();
