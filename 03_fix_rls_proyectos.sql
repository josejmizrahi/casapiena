-- Ya aplicado en la base el 2026-09-08.
-- La política de lectura de proyectos dependía solo de puede_ver(id), que es STABLE
-- y consulta proyectos: dentro del mismo INSERT ... RETURNING no ve la fila recién creada,
-- así que Postgres rechazaba crear proyectos con
-- "new row violates row-level security policy for table proyectos".
-- Verificar el dueño directamente por columna no necesita subconsulta y sí pasa.
drop policy if exists p_ver on public.proyectos;
create policy p_ver on public.proyectos for select
  using (owner_id = auth.uid() or app.puede_ver(id));
