-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 35 · CLASE EN VIVO (Meet / Zoom / Teams)
-- Ejecutar en Supabase de NEXUS LEARNING → SQL Editor, después del 34.
-- Es seguro ejecutarlo más de una vez. No borra datos de capacitaciones.
--
-- La reunión se guarda en cada CAPACITACIÓN PLANIFICADA de una empresa
-- (Empresas → la empresa → Nueva capacitación), así varias empresas
-- pueden tener el mismo curso a la misma hora, cada una con su enlace.
-- Quien entra con una clave vigente y se registra ve el botón
-- «Unirse a la reunión» con la cuenta regresiva o «Reunión en curso».
-- =====================================================================

-- Si ejecutaste la primera versión de este archivo (reunión en el curso), se retira
alter table public.cap_cursos drop constraint if exists cap_cursos_reunion_url_chk;
alter table public.cap_cursos drop constraint if exists cap_cursos_reunion_duracion_chk;
alter table public.cap_cursos
  drop column if exists reunion_url,
  drop column if exists reunion_inicio,
  drop column if exists reunion_duracion;

alter table public.cap_convocatorias
  add column if not exists reunion_url      text,
  add column if not exists reunion_inicio   timestamptz,
  add column if not exists reunion_duracion integer not null default 60;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cap_conv_reunion_url_chk') then
    alter table public.cap_convocatorias add constraint cap_conv_reunion_url_chk
      check (reunion_url is null or reunion_url ~* '^https://');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cap_conv_reunion_duracion_chk') then
    alter table public.cap_convocatorias add constraint cap_conv_reunion_duracion_chk
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
  v_conv uuid;
  c public.cap_convocatorias;
begin
  select a.convocatoria_id into v_conv
  from cap_privado.buscar_acceso(p_codigo) a
  where a.vigente
  limit 1;
  if v_conv is null then return null; end if;

  select * into c from public.cap_convocatorias where id = v_conv;
  if c.reunion_url is null then return null; end if;

  return jsonb_build_object(
    'url', c.reunion_url,
    'inicio', c.reunion_inicio,
    'duracion', c.reunion_duracion,
    'ahora', now()
  );
end;
$$;

revoke all on function public.cap_reunion(text) from public;
grant execute on function public.cap_reunion(text) to anon, authenticated;
