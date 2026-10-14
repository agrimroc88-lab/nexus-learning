-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 20 · RESUMEN PARA EL ADMINISTRADOR
-- Ejecutar en el proyecto nexus-learning, DESPUÉS de los archivos 1 a 19.
-- Es seguro ejecutarlo más de una vez. No borra datos.
--
-- cap_resumen(): cifras de la página "Resumen" (solo administradores).
-- Se calculan en la base para no descargar miles de filas al navegador.
-- Los meses se cuentan con la hora de Ecuador.
-- =====================================================================

create or replace function public.cap_resumen()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_mes date := date_trunc('month', (now() at time zone 'America/Guayaquil'))::date;
begin
  if not cap_privado.es_admin() then
    raise exception 'Solo los administradores pueden ver el resumen.';
  end if;

  return jsonb_build_object(
    'totales', jsonb_build_object(
      'certificados', (select count(*) from public.cap_certificados),
      'certificados_mes', (select count(*) from public.cap_certificados
                           where (emitido_en at time zone 'America/Guayaquil')::date >= v_mes),
      'personas', (select count(distinct cedula) from public.cap_certificados),
      'empresas', (select count(*) from public.cap_empresas where activa),
      'claves_vigentes', (select count(*) from public.cap_accesos
                          where not anulado and now() between valido_desde and valido_hasta),
      'nota_promedio', (select round(avg(nota), 1) from public.cap_certificados
                        where tipo = 'aprobacion' and nota is not null)
    ),
    -- Certificados emitidos en cada uno de los últimos 12 meses
    'por_mes', (
      select jsonb_agg(jsonb_build_object('mes', to_char(m, 'YYYY-MM'), 'total', coalesce(t.total, 0)) order by m)
      from generate_series(v_mes - interval '11 months', v_mes, interval '1 month') m
      left join (
        select date_trunc('month', emitido_en at time zone 'America/Guayaquil') as mes, count(*) as total
        from public.cap_certificados group by 1
      ) t on t.mes = m
    ),
    -- Avance por empresa
    'por_empresa', coalesce((
      select jsonb_agg(x order by x->>'nombre')
      from (
        select jsonb_build_object(
          'id', e.id, 'nombre', e.nombre, 'activa', e.activa,
          'trabajadores', e.num_trabajadores,
          'capacitaciones', (select count(*) from public.cap_convocatorias c where c.empresa_id = e.id),
          'certificados', (select count(*) from public.cap_certificados ce
                           join public.cap_convocatorias c on c.id = ce.convocatoria_id
                           where c.empresa_id = e.id),
          'personas', (select count(distinct ce.cedula) from public.cap_certificados ce
                       join public.cap_convocatorias c on c.id = ce.convocatoria_id
                       where c.empresa_id = e.id),
          'ultima', (select max(ce.emitido_en) from public.cap_certificados ce
                     join public.cap_convocatorias c on c.id = ce.convocatoria_id
                     where c.empresa_id = e.id)
        ) as x
        from public.cap_empresas e
      ) s
    ), '[]'::jsonb),
    -- Programas con más certificados
    'por_programa', coalesce((
      select jsonb_agg(jsonb_build_object('titulo', k.titulo, 'total', t.total) order by t.total desc, k.titulo)
      from (select curso_id, count(*) as total from public.cap_certificados group by curso_id
            order by count(*) desc limit 8) t
      join public.cap_cursos k on k.id = t.curso_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.cap_resumen() from public, anon;
grant execute on function public.cap_resumen() to authenticated;
