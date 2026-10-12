-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 1 DE 4 · TABLAS
-- Ejecutar en: Supabase > SQL Editor > New query > pegar > Run
-- Es seguro ejecutarlo más de una vez (no borra datos existentes).
-- No modifica ninguna tabla existente del sistema.
-- =====================================================================

-- 1. Cursos
create table if not exists public.cap_cursos (
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null,
  descripcion  text,
  horas        numeric(5,1) not null default 1,       -- horas que figuran en el certificado
  nota_minima  numeric(5,2) not null default 70,      -- porcentaje para aprobar
  publicado    boolean not null default false,        -- solo los publicados se ven en la web
  creado_en    timestamptz not null default now()
);

-- 2. Lecciones de cada curso
create table if not exists public.cap_lecciones (
  id         uuid primary key default gen_random_uuid(),
  curso_id   uuid not null references public.cap_cursos(id) on delete cascade,
  orden      int  not null default 1,
  titulo     text not null,
  contenido  text,                                   -- texto de la lección
  video_url  text,                                   -- enlace de YouTube (no listado)
  creado_en  timestamptz not null default now()
);

-- 3. Preguntas de la evaluación
--    La respuesta correcta NUNCA se envía al navegador (ver archivo 2 y 3).
create table if not exists public.cap_preguntas (
  id                  uuid primary key default gen_random_uuid(),
  curso_id            uuid not null references public.cap_cursos(id) on delete cascade,
  orden               int  not null default 1,
  enunciado           text not null,
  opciones            jsonb not null,                -- ejemplo: ["Opción A","Opción B","Opción C"]
  respuesta_correcta  int  not null                  -- posición de la correcta: 0 = primera
);

-- 4. Intentos de evaluación (aprobados y reprobados)
create table if not exists public.cap_intentos (
  id                 uuid primary key default gen_random_uuid(),
  curso_id           uuid not null references public.cap_cursos(id) on delete cascade,
  cedula             text not null,
  nombres            text not null,
  correo             text,
  empresa            text,
  acepta_privacidad  boolean not null default false,
  nota               numeric(5,2) not null,
  aprobado           boolean not null,
  creado_en          timestamptz not null default now()
);

-- 5. Certificados emitidos
create table if not exists public.cap_certificados (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null unique,                  -- ejemplo: VW-2026-A1B2C3D4
  intento_id  uuid not null references public.cap_intentos(id) on delete cascade,
  curso_id    uuid not null references public.cap_cursos(id) on delete cascade,
  cedula      text not null,
  nombres     text not null,
  empresa     text,
  nota        numeric(5,2) not null,
  emitido_en  timestamptz not null default now()
);

-- Índices para búsquedas rápidas
create index if not exists cap_lecciones_curso_idx    on public.cap_lecciones (curso_id, orden);
create index if not exists cap_preguntas_curso_idx    on public.cap_preguntas (curso_id, orden);
create index if not exists cap_intentos_cedula_idx    on public.cap_intentos (curso_id, cedula, creado_en);
create index if not exists cap_certificados_cedula_idx on public.cap_certificados (curso_id, cedula);
