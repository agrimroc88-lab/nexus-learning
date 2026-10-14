-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 17 · CERTIFICADO MÁS COMPLETO
-- Ejecutar en el proyecto nexus-learning, DESPUÉS de los archivos 1 a 16.
-- Es seguro ejecutarlo más de una vez. No borra datos.
--
-- Los datos del certificado ahora incluyen:
--   · subtemas: los del programa; si no tiene, los títulos de sus lecciones.
--   · fecha_capacitacion: la fecha de la charla (si la capacitación la tiene).
-- Sirve también para los certificados ya emitidos: al descargarlos de
-- nuevo salen con el texto ampliado (el código no cambia).
-- =====================================================================

create or replace function cap_privado.certificado_json(p_id uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'codigo', c.codigo, 'nombres', c.nombres, 'cedula', c.cedula, 'empresa', c.empresa,
    'curso', k.titulo, 'horas', coalesce(c.horas, k.horas), 'nota', c.nota,
    'tipo', c.tipo, 'modalidad', c.modalidad, 'emitido_en', c.emitido_en,
    'fecha_capacitacion', v.fecha_capacitacion,
    'subtemas', case
      when coalesce(array_length(k.subtemas, 1), 0) > 0 then to_jsonb(k.subtemas)
      else coalesce((select jsonb_agg(l.titulo order by l.orden)
                     from public.cap_lecciones l where l.curso_id = k.id), '[]'::jsonb)
    end
  )
  from public.cap_certificados c
  join public.cap_cursos k on k.id = c.curso_id
  left join public.cap_convocatorias v on v.id = c.convocatoria_id
  where c.id = p_id;
$$;

revoke all on function cap_privado.certificado_json(uuid) from public, anon, authenticated;
