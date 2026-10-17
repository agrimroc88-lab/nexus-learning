-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 29 · VIDEO Y PDF DEL CURSO
-- Ejecutar en Supabase de NEXUS LEARNING → SQL Editor, después del 28.
-- Es seguro ejecutarlo más de una vez. No borra datos.
--
-- Cada curso puede tener su propio video de YouTube y su PDF (en la
-- pestaña "Datos del curso"), además de los de cada lección.
-- El PDF se guarda en el espacio "diapositivas", en la carpeta del
-- curso, con las mismas reglas de las diapositivas de las lecciones.
-- Los participantes los ven como primer paso: "Material del curso".
-- =====================================================================

alter table public.cap_cursos add column if not exists video_url   text;
alter table public.cap_cursos add column if not exists archivo_pdf text;

create or replace function public.cap_contenido(p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r record;
  c record;
  v_material jsonb := '[]'::jsonb;
begin
  select * into r from cap_privado.buscar_acceso(p_codigo);
  if not found or not r.vigente then
    raise exception 'El código no es válido o ya venció.';
  end if;

  select video_url, archivo_pdf into c from public.cap_cursos where id = r.curso_id;
  if c.video_url is not null or c.archivo_pdf is not null then
    v_material := jsonb_build_array(jsonb_build_object(
      'orden', 0, 'titulo', 'Material del curso', 'contenido', '',
      'video_url', c.video_url, 'archivo_pdf', c.archivo_pdf));
  end if;

  return v_material || coalesce((
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

-- Verificación: debe mostrar las dos columnas nuevas
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'cap_cursos' and column_name in ('video_url', 'archivo_pdf');
