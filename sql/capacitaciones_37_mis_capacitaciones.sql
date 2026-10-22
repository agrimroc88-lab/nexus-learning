-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 37 · PRÓXIMAS CAPACITACIONES DEL DOCENTE
-- Ejecutar en Supabase de NEXUS LEARNING → SQL Editor, después del 36.
-- Es seguro ejecutarlo más de una vez. No borra datos.
--
-- En «Mis programas» el docente ve las capacitaciones programadas de
-- sus cursos (empresa, fecha, clave) con los botones «Unirse a la
-- reunión» y «Abrir salón». El administrador las ve todas.
-- =====================================================================

create or replace function public.cap_mis_capacitaciones()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('ahora', now(), 'lista', coalesce(jsonb_agg(x.fila order by x.orden), '[]'::jsonb))
  from (
    select
      coalesce(cv.reunion_inicio,
               (select min(a.valido_desde) from public.cap_accesos a where a.convocatoria_id = cv.id and not a.anulado),
               cv.fecha_capacitacion::timestamptz) as orden,
      jsonb_build_object(
        'convocatoria_id', cv.id, 'curso_id', k.id, 'curso', k.titulo, 'empresa', e.nombre,
        'modalidad', cv.modalidad, 'fecha', cv.fecha_capacitacion,
        'reunion_url', cv.reunion_url, 'reunion_inicio', cv.reunion_inicio, 'reunion_duracion', cv.reunion_duracion,
        'claves', coalesce((
          select jsonb_agg(jsonb_build_object('codigo', a.codigo, 'tipo', a.tipo,
                   'valido_desde', a.valido_desde, 'valido_hasta', a.valido_hasta) order by a.valido_desde)
          from public.cap_accesos a
          where a.convocatoria_id = cv.id and not a.anulado and now() <= a.valido_hasta), '[]'::jsonb)
      ) as fila
    from public.cap_convocatorias cv
    join public.cap_cursos k on k.id = cv.curso_id
    join public.cap_empresas e on e.id = cv.empresa_id
    where (cap_privado.es_admin() or cap_privado.es_docente_de(k.id))
      and e.activa
      and (
        exists (select 1 from public.cap_accesos a where a.convocatoria_id = cv.id and not a.anulado and now() <= a.valido_hasta)
        or (cv.reunion_inicio is not null and cv.reunion_inicio + make_interval(mins => cv.reunion_duracion) >= now())
        or cv.fecha_capacitacion >= (now() at time zone 'America/Guayaquil')::date
      )
  ) x;
$$;

revoke all on function public.cap_mis_capacitaciones() from public, anon;
grant execute on function public.cap_mis_capacitaciones() to authenticated;
