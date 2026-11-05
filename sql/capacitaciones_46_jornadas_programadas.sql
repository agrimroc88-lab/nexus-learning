-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 46 · JORNADAS EN «CAPACITACIONES PROGRAMADAS»
-- Ejecutar en Supabase de NEXUS LEARNING → SQL Editor, DESPUÉS del 45.
-- Es seguro ejecutarlo más de una vez. No borra datos.
--
-- Cada capacitación indica si pertenece a una jornada (nombre, clave,
-- modalidad y enlace de la reunión), para mostrar UNA sola tarjeta por
-- jornada con «Unirse a la reunión» y «Entrar a la jornada».
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
      coalesce(
        (select min((e->>'inicio')::timestamptz) from jsonb_array_elements(cv.encuentros) e
          where (e->>'inicio')::timestamptz + make_interval(mins => coalesce((e->>'duracion')::int, 60)) >= now()),
        (select min(a.valido_desde) from public.cap_accesos a where a.convocatoria_id = cv.id and not a.anulado),
        cv.fecha_capacitacion::timestamptz) as orden,
      jsonb_build_object(
        'convocatoria_id', cv.id, 'curso_id', k.id, 'curso', k.titulo, 'empresa', e.nombre,
        'modalidad', cv.modalidad, 'fecha', cv.fecha_capacitacion,
        'encuentros', cv.encuentros,
        'jornada', case when j.id is null then null else jsonb_build_object(
          'id', j.id, 'nombre', j.nombre, 'codigo', j.codigo, 'fecha', j.fecha,
          'modalidad', j.modalidad, 'encuentros', coalesce(j.encuentros, '[]'::jsonb),
          'valido_hasta', j.valido_hasta) end,
        'orden_jornada', cv.orden_jornada,
        'claves', coalesce((
          select jsonb_agg(jsonb_build_object('codigo', a.codigo, 'tipo', a.tipo,
                   'valido_desde', a.valido_desde, 'valido_hasta', a.valido_hasta) order by a.valido_desde)
          from public.cap_accesos a
          where a.convocatoria_id = cv.id and not a.anulado and now() <= a.valido_hasta), '[]'::jsonb)
      ) as fila
    from public.cap_convocatorias cv
    join public.cap_cursos k on k.id = cv.curso_id
    join public.cap_empresas e on e.id = cv.empresa_id
    left join public.cap_jornadas j on j.id = cv.jornada_id and not j.anulado
    where (cap_privado.es_admin() or cap_privado.es_docente_de(k.id))
      and e.activa
      and (
        exists (select 1 from public.cap_accesos a where a.convocatoria_id = cv.id and not a.anulado and now() <= a.valido_hasta)
        or exists (select 1 from jsonb_array_elements(cv.encuentros) e
                   where (e->>'inicio')::timestamptz + make_interval(mins => coalesce((e->>'duracion')::int, 60)) >= now())
        or cv.fecha_capacitacion >= (now() at time zone 'America/Guayaquil')::date
        or exists (select 1 from jsonb_array_elements(coalesce(j.encuentros, '[]'::jsonb)) je
                   where (je->>'inicio')::timestamptz + make_interval(mins => coalesce((je->>'duracion')::int, 60)) >= now())
      )
  ) x;
$$;
revoke all on function public.cap_mis_capacitaciones() from public, anon;
grant execute on function public.cap_mis_capacitaciones() to authenticated;
