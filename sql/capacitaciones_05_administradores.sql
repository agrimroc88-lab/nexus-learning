-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 5 · LISTA DE ADMINISTRADORES
-- Ejecutar DESPUÉS de los archivos 1 a 4.
-- Es seguro ejecutarlo más de una vez.
--
-- Qué hace:
--   Antes: cualquier usuario con sesión iniciada podía administrar.
--   Ahora: solo los usuarios que estén en la tabla cap_administradores.
--
-- IMPORTANTE: al final agrega como administradores a TODOS los usuarios
-- que existen hoy en Authentication > Users. Ejecútalo cuando en esa
-- lista solo estén las personas de tu equipo.
-- =====================================================================

-- 1. Tabla de administradores
create table if not exists public.cap_administradores (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  creado_en  timestamptz not null default now()
);

alter table public.cap_administradores enable row level security;

-- Cada administrador solo puede ver su propia fila (para que la web sepa
-- si quien inició sesión es administrador). Nadie puede agregarse solo:
-- las altas se hacen únicamente desde el SQL Editor.
drop policy if exists "cap_admin_ve_su_fila" on public.cap_administradores;
create policy "cap_admin_ve_su_fila"
  on public.cap_administradores for select
  to authenticated
  using (user_id = (select auth.uid()));


-- 2. Reemplazar las políticas abiertas por políticas solo para administradores

-- CURSOS
drop policy if exists "cap_cursos_personal_administra" on public.cap_cursos;
drop policy if exists "cap_cursos_admin_administra" on public.cap_cursos;
create policy "cap_cursos_admin_administra"
  on public.cap_cursos for all
  to authenticated
  using (exists (select 1 from public.cap_administradores a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.cap_administradores a where a.user_id = (select auth.uid())));

-- LECCIONES
drop policy if exists "cap_lecciones_personal_administra" on public.cap_lecciones;
drop policy if exists "cap_lecciones_admin_administra" on public.cap_lecciones;
create policy "cap_lecciones_admin_administra"
  on public.cap_lecciones for all
  to authenticated
  using (exists (select 1 from public.cap_administradores a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.cap_administradores a where a.user_id = (select auth.uid())));

-- PREGUNTAS
drop policy if exists "cap_preguntas_personal_administra" on public.cap_preguntas;
drop policy if exists "cap_preguntas_admin_administra" on public.cap_preguntas;
create policy "cap_preguntas_admin_administra"
  on public.cap_preguntas for all
  to authenticated
  using (exists (select 1 from public.cap_administradores a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.cap_administradores a where a.user_id = (select auth.uid())));

-- INTENTOS (solo lectura para reportes)
drop policy if exists "cap_intentos_personal_lee" on public.cap_intentos;
drop policy if exists "cap_intentos_admin_lee" on public.cap_intentos;
create policy "cap_intentos_admin_lee"
  on public.cap_intentos for select
  to authenticated
  using (exists (select 1 from public.cap_administradores a where a.user_id = (select auth.uid())));

-- CERTIFICADOS (lectura y anulación)
drop policy if exists "cap_certificados_personal_lee" on public.cap_certificados;
drop policy if exists "cap_certificados_admin_lee" on public.cap_certificados;
create policy "cap_certificados_admin_lee"
  on public.cap_certificados for select
  to authenticated
  using (exists (select 1 from public.cap_administradores a where a.user_id = (select auth.uid())));

drop policy if exists "cap_certificados_personal_anula" on public.cap_certificados;
drop policy if exists "cap_certificados_admin_anula" on public.cap_certificados;
create policy "cap_certificados_admin_anula"
  on public.cap_certificados for delete
  to authenticated
  using (exists (select 1 from public.cap_administradores a where a.user_id = (select auth.uid())));


-- 3. Agregar como administradores a los usuarios que existen hoy
insert into public.cap_administradores (user_id)
select id from auth.users
on conflict (user_id) do nothing;


-- 4. Mostrar quiénes quedaron como administradores
select u.email, a.creado_en
from public.cap_administradores a
join auth.users u on u.id = a.user_id;
