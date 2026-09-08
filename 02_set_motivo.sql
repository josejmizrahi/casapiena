-- Complemento del schema: permite mandar el motivo del cambio de presupuesto
-- desde el cliente antes de actualizar un concepto.
create or replace function public.set_motivo(texto text)
returns void language sql volatile as $$
  select set_config('app.motivo', coalesce(texto, ''), true);
$$;
grant execute on function public.set_motivo(text) to authenticated;
