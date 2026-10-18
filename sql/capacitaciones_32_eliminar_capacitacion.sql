-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 32 · ELIMINAR CAPACITACIÓN
-- Ejecutar en Supabase de NEXUS LEARNING → SQL Editor, después del 31.
-- Es seguro ejecutarlo más de una vez. No borra datos por sí solo.
--
-- cap_eliminar_capacitacion(id) borra, en una sola operación, una
-- capacitación (convocatoria) con sus claves, inscritos, intentos y
-- certificados. Solo administradores. Si algo falla, no se borra nada.
-- Devuelve cuántos inscritos y certificados se eliminaron.
-- =====================================================================

create or replace function public.cap_eliminar_capacitacion(p_convocatoria uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_insc  int;
  v_cert  int;
begin
  if not cap_privado.es_admin() then
    raise exception 'Solo un administrador puede eliminar capacitaciones.';
  end if;
  if not exists (select 1 from public.cap_convocatorias where id = p_convocatoria) then
    raise exception 'La capacitación ya no existe.';
  end if;

  select count(*) into v_insc from public.cap_inscripciones where convocatoria_id = p_convocatoria;

  -- Los certificados impiden borrar (restrict): se eliminan primero
  delete from public.cap_certificados
   where convocatoria_id = p_convocatoria
      or inscripcion_id in (select id from public.cap_inscripciones where convocatoria_id = p_convocatoria);
  get diagnostics v_cert = row_count;

  -- Claves, inscritos e intentos se borran en cascada
  delete from public.cap_convocatorias where id = p_convocatoria;

  return jsonb_build_object('inscritos', v_insc, 'certificados', v_cert);
end;
$$;

revoke all on function public.cap_eliminar_capacitacion(uuid) from public, anon;
grant execute on function public.cap_eliminar_capacitacion(uuid) to authenticated;
