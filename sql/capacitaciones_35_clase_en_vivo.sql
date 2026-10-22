-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 35 · CLASE EN VIVO (Meet / Zoom / Teams)
-- Ejecutar en Supabase de NEXUS LEARNING → SQL Editor, después del 34.
-- Es seguro ejecutarlo más de una vez. No borra datos.
--
-- En Planificación del curso se guarda el enlace de la reunión, la
-- fecha y hora de inicio y la duración. Quien entra con una clave
-- vigente y se registra ve el botón «Unirse a la reunión» con la
-- cuenta regresiva o «Reunión en curso».
-- =====================================================================

alter table public.cap_cursos
  add column if not exists reunion_url      text,
  add column if not exists reunion_inicio   timestamptz,
  add column if not exists reunion_duracion integer not null default 60;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cap_cursos_reunion_url_chk') then
    alter table public.cap_cursos add constraint cap_cursos_reunion_url_chk
      check (reunion_url is null or reunion_url ~* '^https://');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cap_cursos_reunion_duracion_chk') then
    alter table public.cap_cursos add constraint cap_cursos_reunion_duracion_chk
      check (reunion_duracion between 10 and 600);
  end if;
end $$;

-- Datos de la reunión para quien tiene una clave vigente (sin sesión)
create or replace function public.cap_reunion(p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_curso uuid;
  k public.cap_cursos;
begin
  select a.curso_id into v_curso
  from cap_privado.buscar_acceso(p_codigo) a
  where a.vigente
  limit 1;
  if v_curso is null then return null; end if;

  select * into k from public.cap_cursos where id = v_curso;
  if k.reunion_url is null then return null; end if;

  return jsonb_build_object(
    'url', k.reunion_url,
    'inicio', k.reunion_inicio,
    'duracion', k.reunion_duracion,
    'ahora', now()
  );
end;
$$;

revoke all on function public.cap_reunion(text) from public;
grant execute on function public.cap_reunion(text) to anon, authenticated;
