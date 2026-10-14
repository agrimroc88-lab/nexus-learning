-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 15 · PORTADA EN LA PÁGINA DEL CURSO
-- Ejecutar en el proyecto nexus-learning, DESPUÉS de los archivos 1 a 14.
-- Es seguro ejecutarlo más de una vez. No borra datos.
--
-- cap_portada(id): devuelve solo la ruta de la imagen de portada de un
-- programa (o null). Las portadas ya son públicas; esta función no
-- expone nada más del curso. La usan curso.html y programa.html.
-- =====================================================================

create or replace function public.cap_portada(p_curso uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select imagen from public.cap_cursos where id = p_curso;
$$;

revoke all on function public.cap_portada(uuid) from public;
grant execute on function public.cap_portada(uuid) to anon, authenticated;
