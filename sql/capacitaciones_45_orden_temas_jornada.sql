-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 45 · ORDEN DE LOS TEMAS DE UNA JORNADA
-- Ejecutar en Supabase de NEXUS LEARNING → SQL Editor, DESPUÉS del 44.
-- Es seguro ejecutarlo más de una vez. No borra datos.
--
-- El orden se cambia arrastrando los temas en la tarjeta de la jornada.
-- Lo usan la página del participante y el Salón de clases (presentación).
-- =====================================================================

alter table public.cap_convocatorias add column if not exists orden_jornada int;

-- Abrir una jornada con su clave: los temas en el orden elegido
create or replace function public.cap_jornada(p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  j        record;
  v_motivo text;
begin
  select jo.*, e.nombre as empresa, e.activa
    into j
  from public.cap_jornadas jo
  join public.cap_empresas e on e.id = jo.empresa_id
  where replace(jo.codigo, '-', '') =
        replace(upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g')), '-', '');
  if not found then return null; end if;

  v_motivo := case
    when j.anulado then 'Esta clave fue anulada. Pide una clave nueva a tu empresa.'
    when not j.activa then 'Esta clave ya no está disponible.'
    when now() < j.valido_desde then 'Esta clave estará activa desde el '
      || to_char(j.valido_desde at time zone 'America/Guayaquil', 'DD/MM/YYYY "a las" HH24:MI') || '.'
    when now() > j.valido_hasta then 'Esta clave venció el '
      || to_char(j.valido_hasta at time zone 'America/Guayaquil', 'DD/MM/YYYY "a las" HH24:MI') || '.'
  end;
  if v_motivo is not null then
    return jsonb_build_object('valido', false, 'jornada', true, 'motivo', v_motivo);
  end if;

  return jsonb_build_object(
    'valido', true, 'jornada', true,
    'empresa', j.empresa, 'nombre', j.nombre, 'fecha', j.fecha, 'valido_hasta', j.valido_hasta,
    'modalidad', j.modalidad, 'encuentros', coalesce(j.encuentros, '[]'::jsonb), 'ahora', now(),
    'capacitaciones', coalesce((
      select jsonb_agg(jsonb_build_object(
               'convocatoria_id', c.id,
               'curso_id', k.id,
               'curso', k.titulo,
               'horas', coalesce(c.horas, k.horas),
               'requiere_evaluacion', c.evaluacion_presencial,
               'codigo', (select a.codigo from public.cap_accesos a
                          where a.convocatoria_id = c.id and a.tipo = 'presencial' and not a.anulado
                          order by (now() between a.valido_desde and a.valido_hasta) desc, a.creado_en desc
                          limit 1)
             ) order by c.orden_jornada nulls last, c.creado_en)
      from public.cap_convocatorias c
      join public.cap_cursos k on k.id = c.curso_id
      where c.jornada_id = j.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.cap_jornada(text) from public;
grant execute on function public.cap_jornada(text) to anon, authenticated;
