-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 13 · CATÁLOGO PÚBLICO Y PAPEL DEL USUARIO
-- Ejecutar en el proyecto nexus-learning, DESPUÉS de los archivos 1 a 12.
-- Es seguro ejecutarlo más de una vez. No borra datos.
--
-- Qué agrega:
--   · cap_catalogo(): lista PÚBLICA de programas activos (solo título,
--     descripción, horas, subtemas y número de lecciones). El contenido
--     de las lecciones y las preguntas siguen protegidos por clave.
--   · cap_mi_papel(): responde 'admin', 'docente' o null para la cuenta
--     que inició sesión. Lo usan login y el panel para mostrar a cada
--     quien lo suyo (la protección real sigue siendo RLS).
-- =====================================================================


-- =====================================================================
-- 1. CATÁLOGO PÚBLICO
-- =====================================================================
create or replace function public.cap_catalogo()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', k.id,
           'titulo', k.titulo,
           'descripcion', k.descripcion,
           'horas', k.horas,
           'subtemas', to_jsonb(k.subtemas),
           'lecciones', (select count(*) from public.cap_lecciones l where l.curso_id = k.id),
           'evaluacion', exists (select 1 from public.cap_preguntas q where q.curso_id = k.id)
         ) order by k.titulo), '[]'::jsonb)
  from public.cap_cursos k
  where k.publicado = true;
$$;

revoke all on function public.cap_catalogo() from public;
grant execute on function public.cap_catalogo() to anon, authenticated;


-- =====================================================================
-- 2. PAPEL DE QUIEN INICIÓ SESIÓN
-- =====================================================================
create or replace function public.cap_mi_papel()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when cap_privado.es_admin() then 'admin'
    when exists (
      select 1 from public.cap_docentes d
      where d.user_id = auth.uid()
        and d.activo
        and (d.vigente_hasta is null or d.vigente_hasta >= current_date)
    ) then 'docente'
    else null
  end;
$$;

revoke all on function public.cap_mi_papel() from public, anon;
grant execute on function public.cap_mi_papel() to authenticated;
