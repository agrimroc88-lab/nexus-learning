-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 25 · LOS JUEGOS SON SOLO PARA LA CHARLA
-- Ejecutar en el proyecto nexus-learning, DESPUÉS del archivo 24.
-- Es seguro ejecutarlo más de una vez. No borra datos.
--
-- Los juegos los abre el docente (o el administrador) durante la charla,
-- desde charla.html. Los estudiantes ya no los reciben: cap_contenido()
-- vuelve a entregar solo el contenido de las lecciones.
-- Los juegos asignados a cada lección se conservan: sirven para que el
-- docente encuentre los juegos de cada programa.
-- (La tabla cap_juegos ya era solo para administradores y docentes.)
-- =====================================================================

create or replace function public.cap_contenido(p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r record;
begin
  select * into r from cap_privado.buscar_acceso(p_codigo);
  if not found or not r.vigente then
    raise exception 'El código no es válido o ya venció.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('orden', l.orden, 'titulo', l.titulo,
                                        'contenido', l.contenido, 'video_url', l.video_url,
                                        'archivo_pdf', l.archivo_pdf)
                     order by l.orden)
    from public.cap_lecciones l
    where l.curso_id = r.curso_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.cap_contenido(text) from public;
grant execute on function public.cap_contenido(text) to anon, authenticated;
