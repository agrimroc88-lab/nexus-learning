-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 9 · DOCENTES Y DIAPOSITIVAS
-- Ejecutar DESPUÉS de los archivos 1 a 8.
-- Es seguro ejecutarlo más de una vez. No borra datos existentes.
--
-- Qué agrega:
--   · cap_admin_cedulas: cédulas de quienes son ADMINISTRADORES.
--     El puente con NEXUS las usa para reconocerte.
--   · cap_docentes: personas que preparan contenido (de NEXUS o externas,
--     con fecha de vencimiento opcional).
--   · cap_docente_cursos: qué programas tiene cada docente.
--   · Reglas: un docente solo ve y edita lecciones y preguntas de SUS
--     programas. No ve empresas, códigos, nóminas ni certificados.
--   · Espacio "diapositivas" para subir PDF (máx. 20 MB c/u).
--
-- ⚠️ IMPORTANTE: desde ahora NO vuelvas a ejecutar el archivo 5.
--    Ese archivo convierte en administrador a TODAS las cuentas,
--    y ahora existirán cuentas de docentes.
-- =====================================================================


-- =====================================================================
-- 1. TABLAS
-- =====================================================================

create table if not exists public.cap_admin_cedulas (
  cedula     text primary key check (cedula ~ '^[0-9]{10}$'),
  nombres    text,
  creado_en  timestamptz not null default now()
);

create table if not exists public.cap_docentes (
  id             uuid primary key default gen_random_uuid(),
  cedula         text not null unique check (cedula ~ '^[0-9]{10}$'),
  nombres        text not null,
  correo         text,
  origen         text not null default 'nexus' check (origen in ('nexus', 'externo')),
  vigente_hasta  date,                         -- vacío = sin vencimiento
  activo         boolean not null default true,
  user_id        uuid unique references auth.users(id) on delete set null,
  creado_en      timestamptz not null default now()
);

create table if not exists public.cap_docente_cursos (
  docente_id  uuid not null references public.cap_docentes(id) on delete cascade,
  curso_id    uuid not null references public.cap_cursos(id) on delete cascade,
  creado_en   timestamptz not null default now(),
  primary key (docente_id, curso_id)
);

create index if not exists cap_docente_cursos_curso_idx on public.cap_docente_cursos (curso_id);

-- Diapositiva (PDF) de cada lección: ruta dentro del espacio "diapositivas"
alter table public.cap_lecciones add column if not exists archivo_pdf text;


-- =====================================================================
-- 2. FUNCIONES DE PERMISOS (esquema privado, no visible desde la web)
--    Las usan las reglas RLS para decidir quién puede qué.
-- =====================================================================
create schema if not exists cap_privado;

create or replace function cap_privado.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.cap_administradores where user_id = auth.uid());
$$;

create or replace function cap_privado.es_docente_de(p_curso uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.cap_docentes d
    join public.cap_docente_cursos dc on dc.docente_id = d.id
    where d.user_id = auth.uid()
      and d.activo
      and (d.vigente_hasta is null or d.vigente_hasta >= current_date)
      and dc.curso_id = p_curso
  );
$$;

-- Las reglas RLS se evalúan con el rol de quien consulta: necesita
-- poder USAR estas dos funciones (solo estas dos).
grant usage on schema cap_privado to authenticated;
revoke all on function cap_privado.es_admin() from public, anon;
revoke all on function cap_privado.es_docente_de(uuid) from public, anon;
grant execute on function cap_privado.es_admin() to authenticated;
grant execute on function cap_privado.es_docente_de(uuid) to authenticated;


-- =====================================================================
-- 3. SEGURIDAD (RLS)
-- =====================================================================
alter table public.cap_admin_cedulas  enable row level security;
alter table public.cap_docentes       enable row level security;
alter table public.cap_docente_cursos enable row level security;

-- Cédulas de administradores: solo administradores
drop policy if exists "cap_admin_cedulas_admin" on public.cap_admin_cedulas;
create policy "cap_admin_cedulas_admin" on public.cap_admin_cedulas for all to authenticated
  using (cap_privado.es_admin()) with check (cap_privado.es_admin());

-- Docentes: el administrador gestiona; cada docente ve solo su ficha
drop policy if exists "cap_docentes_admin" on public.cap_docentes;
create policy "cap_docentes_admin" on public.cap_docentes for all to authenticated
  using (cap_privado.es_admin()) with check (cap_privado.es_admin());

drop policy if exists "cap_docentes_ve_su_ficha" on public.cap_docentes;
create policy "cap_docentes_ve_su_ficha" on public.cap_docentes for select to authenticated
  using (user_id = (select auth.uid()));

-- Asignaciones: el administrador gestiona; el docente ve las suyas
drop policy if exists "cap_docente_cursos_admin" on public.cap_docente_cursos;
create policy "cap_docente_cursos_admin" on public.cap_docente_cursos for all to authenticated
  using (cap_privado.es_admin()) with check (cap_privado.es_admin());

drop policy if exists "cap_docente_cursos_propias" on public.cap_docente_cursos;
create policy "cap_docente_cursos_propias" on public.cap_docente_cursos for select to authenticated
  using (exists (select 1 from public.cap_docentes d
                 where d.id = docente_id and d.user_id = (select auth.uid())));

-- Cursos: el docente puede VER sus programas (no cambiar horas, nota ni estado)
drop policy if exists "cap_cursos_docente_ve" on public.cap_cursos;
create policy "cap_cursos_docente_ve" on public.cap_cursos for select to authenticated
  using (cap_privado.es_docente_de(id));

-- Lecciones y preguntas: el docente gestiona las de sus programas
drop policy if exists "cap_lecciones_docente" on public.cap_lecciones;
create policy "cap_lecciones_docente" on public.cap_lecciones for all to authenticated
  using (cap_privado.es_docente_de(curso_id)) with check (cap_privado.es_docente_de(curso_id));

drop policy if exists "cap_preguntas_docente" on public.cap_preguntas;
create policy "cap_preguntas_docente" on public.cap_preguntas for all to authenticated
  using (cap_privado.es_docente_de(curso_id)) with check (cap_privado.es_docente_de(curso_id));


-- =====================================================================
-- 4. ESPACIO DE ARCHIVOS "diapositivas"
--    · Lectura pública por enlace (el contenido de capacitación no es
--      confidencial; los nombres de archivo son aleatorios).
--    · Subir, reemplazar o borrar: el administrador, o el docente del
--      programa. Ruta obligatoria: <id-del-curso>/<archivo>.pdf
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('diapositivas', 'diapositivas', true, 20971520, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function cap_privado.puede_editar_archivo(p_nombre text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_carpeta text := split_part(coalesce(p_nombre, ''), '/', 1);
begin
  if v_carpeta !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return cap_privado.es_admin() or cap_privado.es_docente_de(v_carpeta::uuid);
end;
$$;

revoke all on function cap_privado.puede_editar_archivo(text) from public, anon;
grant execute on function cap_privado.puede_editar_archivo(text) to authenticated;

drop policy if exists "diapositivas_subir" on storage.objects;
create policy "diapositivas_subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'diapositivas' and cap_privado.puede_editar_archivo(name));

drop policy if exists "diapositivas_reemplazar" on storage.objects;
create policy "diapositivas_reemplazar" on storage.objects for update to authenticated
  using (bucket_id = 'diapositivas' and cap_privado.puede_editar_archivo(name))
  with check (bucket_id = 'diapositivas' and cap_privado.puede_editar_archivo(name));

drop policy if exists "diapositivas_borrar" on storage.objects;
create policy "diapositivas_borrar" on storage.objects for delete to authenticated
  using (bucket_id = 'diapositivas' and cap_privado.puede_editar_archivo(name));

drop policy if exists "diapositivas_listar" on storage.objects;
create policy "diapositivas_listar" on storage.objects for select to authenticated
  using (bucket_id = 'diapositivas' and cap_privado.puede_editar_archivo(name));


-- =====================================================================
-- 5. CONTENIDO PARA PARTICIPANTES: ahora incluye la diapositiva PDF
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
    from public.cap_lecciones l where l.curso_id = r.curso_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.cap_contenido(text) from public;
grant execute on function public.cap_contenido(text) to anon, authenticated;
