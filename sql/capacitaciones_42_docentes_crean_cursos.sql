-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 42 · LOS DOCENTES CREAN SUS CURSOS
-- Ejecutar en Supabase de NEXUS LEARNING → SQL Editor (después del 41,
-- o del último que hayas ejecutado). Es seguro ejecutarlo más de una vez.
--
-- · Un docente activo puede crear un curso nuevo: queda asignado a él
--   automáticamente (el administrador lo ve y lo administra como siempre).
-- · Puede editar los datos de SUS cursos (título, descripción, horas, nota,
--   portada, video, PDF y enlaces), además de lecciones y preguntas.
-- · Eliminar cursos, el QR del programa, las versiones y la asignación de
--   docentes siguen siendo solo del administrador.
-- =====================================================================

-- ¿Quien llama es un docente activo? Devuelve su id.
create or replace function cap_privado.docente_actual()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select d.id from public.cap_docentes d
  where d.user_id = auth.uid() and d.activo
    and (d.vigente_hasta is null or d.vigente_hasta >= current_date)
  limit 1;
$$;
revoke all on function cap_privado.docente_actual() from public, anon, authenticated;

-- Crear un curso como docente (queda asignado a quien lo crea)
create or replace function public.cap_docente_crear_curso(
  p_titulo text, p_descripcion text, p_subtemas text[], p_horas numeric, p_nota_minima numeric,
  p_publicado boolean, p_preguntas_por_evaluacion int
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_docente uuid := cap_privado.docente_actual();
  v_id      uuid;
begin
  if v_docente is null and not cap_privado.es_admin() then
    raise exception 'Solo un docente activo o un administrador puede crear cursos.';
  end if;
  if length(btrim(coalesce(p_titulo, ''))) < 5 then raise exception 'Escribe un título de al menos 5 caracteres.'; end if;

  insert into public.cap_cursos (titulo, descripcion, subtemas, horas, nota_minima, publicado, preguntas_por_evaluacion)
  values (btrim(p_titulo), nullif(btrim(coalesce(p_descripcion, '')), ''), coalesce(p_subtemas, '{}'),
          p_horas, p_nota_minima, coalesce(p_publicado, true), p_preguntas_por_evaluacion)
  returning id into v_id;

  if v_docente is not null then
    insert into public.cap_docente_cursos (docente_id, curso_id) values (v_docente, v_id)
    on conflict do nothing;
  end if;
  return v_id;
end;
$$;
revoke all on function public.cap_docente_crear_curso(text, text, text[], numeric, numeric, boolean, int) from public, anon;
grant execute on function public.cap_docente_crear_curso(text, text, text[], numeric, numeric, boolean, int) to authenticated;

-- El docente edita los datos de SUS cursos (no puede eliminarlos)
drop policy if exists "cap_cursos_docente_edita" on public.cap_cursos;
create policy "cap_cursos_docente_edita" on public.cap_cursos for update to authenticated
  using (cap_privado.es_docente_de(id)) with check (cap_privado.es_docente_de(id));

-- Portadas: el docente sube la portada de sus cursos (<id-del-curso>/archivo)
drop policy if exists "portadas_docente_subir" on storage.objects;
create policy "portadas_docente_subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'portadas' and cap_privado.puede_editar_archivo(name));

drop policy if exists "portadas_docente_reemplazar" on storage.objects;
create policy "portadas_docente_reemplazar" on storage.objects for update to authenticated
  using (bucket_id = 'portadas' and cap_privado.puede_editar_archivo(name))
  with check (bucket_id = 'portadas' and cap_privado.puede_editar_archivo(name));

drop policy if exists "portadas_docente_borrar" on storage.objects;
create policy "portadas_docente_borrar" on storage.objects for delete to authenticated
  using (bucket_id = 'portadas' and cap_privado.puede_editar_archivo(name));

drop policy if exists "portadas_docente_listar" on storage.objects;
create policy "portadas_docente_listar" on storage.objects for select to authenticated
  using (bucket_id = 'portadas' and cap_privado.puede_editar_archivo(name));
