-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 30 · SALÓN DE CLASES
-- Ejecutar en Supabase de NEXUS LEARNING → SQL Editor, después del 29.
-- Es seguro ejecutarlo más de una vez. No borra datos.
--
-- 1. Enlaces adicionales del curso (videos u otras páginas), opcionales:
--    lista de { "titulo": "...", "url": "https://..." }.
-- 2. cap_salon_claves(curso): las claves vigentes hoy de ese curso, con
--    el nombre de la empresa, para mostrarlas en el Salón de clases.
--    Solo la usan el administrador y los docentes de ese curso
--    (las tablas de empresas siguen siendo solo del administrador).
-- =====================================================================

alter table public.cap_cursos add column if not exists enlaces jsonb not null default '[]'::jsonb;

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
             'codigo', a.codigo, 'tipo', a.tipo, 'valido_hasta', a.valido_hasta,
             'empresa', e.nombre, 'evaluacion', cv.evaluacion_presencial)
           order by a.valido_hasta)
    from public.cap_accesos a
    join public.cap_convocatorias cv on cv.id = a.convocatoria_id
    join public.cap_empresas e on e.id = cv.empresa_id
    where cv.curso_id = p_curso
      and not a.anulado
      and now() between a.valido_desde and a.valido_hasta
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.cap_salon_claves(uuid) from public, anon;
grant execute on function public.cap_salon_claves(uuid) to authenticated;

-- Verificación
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'cap_cursos' and column_name = 'enlaces';
