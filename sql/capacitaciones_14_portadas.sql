-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 14 · IMAGEN DE PORTADA DE CADA PROGRAMA
-- Ejecutar en el proyecto nexus-learning, DESPUÉS de los archivos 1 a 13.
-- Es seguro ejecutarlo más de una vez. No borra datos.
--
-- Qué agrega:
--   · cap_cursos.imagen: ruta de la portada dentro del espacio "portadas".
--   · Espacio "portadas" (JPG, PNG o WEBP, máx. 2 MB): lectura pública;
--     subir, reemplazar o borrar solo el ADMINISTRADOR.
--     Ruta obligatoria: <id-del-curso>/<archivo>
--   · cap_catalogo(): ahora también devuelve la imagen.
-- =====================================================================

alter table public.cap_cursos add column if not exists imagen text;

comment on column public.cap_cursos.imagen is
  'Ruta de la imagen de portada en el espacio "portadas" (<id-del-curso>/<archivo>).';


-- =====================================================================
-- 1. ESPACIO DE ARCHIVOS "portadas"
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portadas', 'portadas', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "portadas_subir" on storage.objects;
create policy "portadas_subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'portadas' and cap_privado.es_admin());

drop policy if exists "portadas_reemplazar" on storage.objects;
create policy "portadas_reemplazar" on storage.objects for update to authenticated
  using (bucket_id = 'portadas' and cap_privado.es_admin())
  with check (bucket_id = 'portadas' and cap_privado.es_admin());

drop policy if exists "portadas_borrar" on storage.objects;
create policy "portadas_borrar" on storage.objects for delete to authenticated
  using (bucket_id = 'portadas' and cap_privado.es_admin());

drop policy if exists "portadas_listar" on storage.objects;
create policy "portadas_listar" on storage.objects for select to authenticated
  using (bucket_id = 'portadas' and cap_privado.es_admin());


-- =====================================================================
-- 2. CATÁLOGO PÚBLICO (reemplaza al del archivo 13: agrega la imagen)
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
           'imagen', k.imagen,
           'subtemas', to_jsonb(k.subtemas),
           'lecciones', (select count(*) from public.cap_lecciones l where l.curso_id = k.id),
           'evaluacion', exists (select 1 from public.cap_preguntas q where q.curso_id = k.id)
         ) order by k.titulo), '[]'::jsonb)
  from public.cap_cursos k
  where k.publicado = true;
$$;

revoke all on function public.cap_catalogo() from public;
grant execute on function public.cap_catalogo() to anon, authenticated;
