-- Ya aplicado en la base el 2026-09-08.
-- Compartir proyectos por correo: el dueño agrega miembros sin conocer su uuid,
-- y la app lista los miembros con su correo (auth.users no es visible al cliente).

create or replace function app.miembros_de(p uuid)
returns table (user_id uuid, email text, rol text)
language sql stable security definer set search_path = public as $$
  select m.user_id, u.email::text, m.rol
  from proyecto_miembros m join auth.users u on u.id = m.user_id
  where m.proyecto_id = p and app.puede_ver(p)
  order by u.email;
$$;

create or replace function app.agregar_miembro(p uuid, correo text, r text)
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not exists (select 1 from proyectos where id = p and owner_id = auth.uid()) then
    raise exception 'Solo el dueño del proyecto puede agregar miembros';
  end if;
  if r not in ('editor','lector') then raise exception 'Rol inválido'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(correo));
  if uid is null then raise exception 'No hay ningún usuario con el correo %. Pídele que entre primero a la app.', correo; end if;
  if uid = auth.uid() then raise exception 'Ya eres el dueño del proyecto'; end if;
  insert into proyecto_miembros (proyecto_id, user_id, rol) values (p, uid, r)
  on conflict (proyecto_id, user_id) do update set rol = excluded.rol;
end $$;

-- Expuestas en public para llamarlas por RPC desde el cliente.
create or replace function public.miembros_de(p uuid) returns table (user_id uuid, email text, rol text)
language sql stable security definer set search_path = public as $$ select * from app.miembros_de(p); $$;
create or replace function public.agregar_miembro(p uuid, correo text, r text) returns void
language sql security definer set search_path = public as $$ select app.agregar_miembro(p, correo, r); $$;

revoke all on function public.miembros_de(uuid) from anon;
revoke all on function public.agregar_miembro(uuid, text, text) from anon;
grant execute on function public.miembros_de(uuid) to authenticated;
grant execute on function public.agregar_miembro(uuid, text, text) to authenticated;
