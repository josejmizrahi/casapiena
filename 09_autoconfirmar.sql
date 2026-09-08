-- Ya aplicado en la base el 2026-09-08.
-- Equivalente a desactivar "Confirm email": toda cuenta nueva queda confirmada al
-- crearse, así entra de inmediato con su contraseña. (El ajuste real del panel de
-- Supabase, Authentication → Providers → Email, no es accesible por SQL.)
create or replace function app.autoconfirmar_correo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is null then new.email_confirmed_at := now(); end if;
  return new;
end $$;
drop trigger if exists t_autoconfirmar_correo on auth.users;
create trigger t_autoconfirmar_correo before insert on auth.users
  for each row execute function app.autoconfirmar_correo();
