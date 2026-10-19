-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 34 · RESPALDOS DE CURSOS
-- Ejecutar en Supabase de NEXUS LEARNING → SQL Editor, después del 33.
-- Es seguro ejecutarlo más de una vez. No borra datos.
--
-- "Guardar versión definitiva": el administrador congela una copia
-- completa del curso (datos, lecciones, preguntas, juegos usados y
-- docentes asignados). Si después alguien borra o cambia algo por
-- error, el administrador la RESTAURA tal cual estaba, incluso si el
-- curso fue eliminado.
-- Los archivos (portada y PDF) que usa una versión guardada quedan
-- protegidos: la plataforma ya no los borra del almacenamiento.
-- =====================================================================

-- 1. Tabla de respaldos (sin llave foránea: sobrevive al borrado del curso)
create table if not exists public.cap_respaldos (
  id         uuid primary key default gen_random_uuid(),
  curso_id   uuid not null,
  titulo     text not null,
  nota       text,
  contenido  jsonb not null,
  archivos   text[] not null default '{}',
  creado_por uuid default auth.uid(),
  creado_en  timestamptz not null default now()
);
create index if not exists cap_respaldos_curso_idx on public.cap_respaldos (curso_id, creado_en desc);

alter table public.cap_respaldos enable row level security;
drop policy if exists "cap_respaldos_admin_lee" on public.cap_respaldos;
create policy "cap_respaldos_admin_lee" on public.cap_respaldos for select to authenticated
  using (cap_privado.es_admin());
drop policy if exists "cap_respaldos_admin_borra" on public.cap_respaldos;
create policy "cap_respaldos_admin_borra" on public.cap_respaldos for delete to authenticated
  using (cap_privado.es_admin());
-- (insertar y restaurar solo por las funciones de abajo)

-- 2. Guardar versión definitiva de un curso
create or replace function public.cap_guardar_respaldo(p_curso uuid, p_nota text default null)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_curso public.cap_cursos;
  v_cont  jsonb;
  v_arch  text[];
  v_id    uuid;
begin
  if not cap_privado.es_admin() then
    raise exception 'Solo un administrador puede guardar versiones definitivas.';
  end if;
  select * into v_curso from public.cap_cursos where id = p_curso;
  if not found then raise exception 'El curso no existe.'; end if;

  v_cont := jsonb_build_object(
    'curso', to_jsonb(v_curso),
    'lecciones', coalesce((select jsonb_agg(to_jsonb(l) order by l.orden) from public.cap_lecciones l where l.curso_id = p_curso), '[]'::jsonb),
    'preguntas', coalesce((select jsonb_agg(to_jsonb(q) order by q.orden) from public.cap_preguntas q where q.curso_id = p_curso), '[]'::jsonb),
    'juegos', coalesce((select jsonb_agg(to_jsonb(j)) from public.cap_juegos j
                        where j.id in (select juego_id from public.cap_lecciones where curso_id = p_curso and juego_id is not null)), '[]'::jsonb),
    'docentes', coalesce((select jsonb_agg(dc.docente_id) from public.cap_docente_cursos dc where dc.curso_id = p_curso), '[]'::jsonb)
  );

  select coalesce(array_agg(distinct a) filter (where a is not null and a <> ''), '{}') into v_arch
  from (
    select v_curso.imagen as a
    union all select v_curso.archivo_pdf
    union all select archivo_pdf from public.cap_lecciones where curso_id = p_curso
  ) t;

  insert into public.cap_respaldos (curso_id, titulo, nota, contenido, archivos)
  values (p_curso, v_curso.titulo, nullif(trim(coalesce(p_nota, '')), ''), v_cont, v_arch)
  returning id into v_id;
  return v_id;
end;
$$;

-- 3. Restaurar una versión: el curso queda exactamente como se guardó
create or replace function public.cap_restaurar_respaldo(p_respaldo uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_r  public.cap_respaldos;
  v_c  jsonb;
  v_id uuid;
begin
  if not cap_privado.es_admin() then
    raise exception 'Solo un administrador puede restaurar versiones.';
  end if;
  select * into v_r from public.cap_respaldos where id = p_respaldo;
  if not found then raise exception 'La versión ya no existe.'; end if;
  v_c  := v_r.contenido->'curso';
  v_id := v_r.curso_id;

  -- Curso: se recrea si fue eliminado; si existe, vuelve a sus datos guardados
  insert into public.cap_cursos
  select * from jsonb_populate_record(null::public.cap_cursos, v_c)
  on conflict (id) do nothing;
  update public.cap_cursos c set
    titulo = r.titulo, descripcion = r.descripcion, horas = r.horas, nota_minima = r.nota_minima,
    publicado = r.publicado, subtemas = r.subtemas, imagen = r.imagen,
    preguntas_por_evaluacion = r.preguntas_por_evaluacion, video_url = r.video_url,
    archivo_pdf = r.archivo_pdf, enlaces = coalesce(r.enlaces, '[]'::jsonb)
  from jsonb_populate_record(null::public.cap_cursos, v_c) r
  where c.id = v_id;

  -- Juegos que usan sus lecciones (si alguien los borró)
  insert into public.cap_juegos
  select * from jsonb_populate_recordset(null::public.cap_juegos, coalesce(v_r.contenido->'juegos', '[]'::jsonb))
  on conflict (id) do nothing;

  -- Lecciones y preguntas: se reemplazan por las guardadas
  delete from public.cap_lecciones where curso_id = v_id;
  delete from public.cap_preguntas where curso_id = v_id;
  insert into public.cap_lecciones
  select * from jsonb_populate_recordset(null::public.cap_lecciones, coalesce(v_r.contenido->'lecciones', '[]'::jsonb));
  insert into public.cap_preguntas
  select * from jsonb_populate_recordset(null::public.cap_preguntas, coalesce(v_r.contenido->'preguntas', '[]'::jsonb));

  -- Docentes asignados (solo los que aún existen)
  insert into public.cap_docente_cursos (docente_id, curso_id)
  select d.id, v_id
  from public.cap_docentes d
  where d.id in (select (x #>> '{}')::uuid from jsonb_array_elements(coalesce(v_r.contenido->'docentes', '[]'::jsonb)) x)
    and not exists (select 1 from public.cap_docente_cursos dc where dc.docente_id = d.id and dc.curso_id = v_id);

  return v_id;
end;
$$;

-- 4. ¿Este archivo lo usa alguna versión guardada? (entonces no se borra)
create or replace function public.cap_archivo_protegido(p_ruta text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.cap_respaldos where p_ruta = any (archivos));
$$;

revoke all on function public.cap_guardar_respaldo(uuid, text) from public, anon;
revoke all on function public.cap_restaurar_respaldo(uuid) from public, anon;
revoke all on function public.cap_archivo_protegido(text) from public, anon;
grant execute on function public.cap_guardar_respaldo(uuid, text) to authenticated;
grant execute on function public.cap_restaurar_respaldo(uuid) to authenticated;
grant execute on function public.cap_archivo_protegido(text) to authenticated;
