-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 31 · CLAVES DEL CURSO
-- Ejecutar en Supabase de NEXUS LEARNING → SQL Editor, después del 30.
-- Es seguro ejecutarlo más de una vez. No borra datos.
--
-- cap_salon_claves(curso) ahora devuelve las claves VIGENTES y las
-- PROGRAMADAS (aún no empiezan), con su estado y fechas, para verlas en
-- Planificación y diseño del curso (debajo del QR) y en el Salón de clases.
-- =====================================================================

create or replace function public.cap_salon_claves(p_curso uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (cap_privado.es_admin() or cap_privado.es_docente_de(p_curso)) then
    raise exception 'Sin permiso para este curso.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'codigo', a.codigo, 'tipo', a.tipo,
             'valido_desde', a.valido_desde, 'valido_hasta', a.valido_hasta,
             'estado', case when now() < a.valido_desde then 'programada' else 'vigente' end,
             'empresa', e.nombre, 'empresa_activa', e.activa, 'evaluacion', cv.evaluacion_presencial)
           order by a.valido_desde)
    from public.cap_accesos a
    join public.cap_convocatorias cv on cv.id = a.convocatoria_id
    join public.cap_empresas e on e.id = cv.empresa_id
    where cv.curso_id = p_curso
      and not a.anulado
      and now() <= a.valido_hasta
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.cap_salon_claves(uuid) from public, anon;
grant execute on function public.cap_salon_claves(uuid) to authenticated;
