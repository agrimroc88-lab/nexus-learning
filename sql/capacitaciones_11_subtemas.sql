-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 11 · SUBTEMAS DE CADA PROGRAMA
-- Ejecutar en el proyecto nexus-learning, DESPUÉS de los archivos 1 a 10.
-- Es seguro ejecutarlo más de una vez. No borra datos.
--
-- Agrega a cada programa (cap_cursos) una lista de subtemas, que
-- aparecen en el Registro de asistencia. Si un programa no tiene
-- subtemas, el registro usa los títulos de sus lecciones.
-- Solo el administrador los edita (mismas reglas que el resto del curso).
-- =====================================================================

alter table public.cap_cursos
  add column if not exists subtemas text[] not null default '{}';

comment on column public.cap_cursos.subtemas is
  'Subtemas del programa (uno por elemento). Se muestran en el Registro de asistencia.';
