-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 44 · JORNADAS PRESENCIALES, VIRTUALES O MIXTAS
-- Ejecutar en Supabase de NEXUS LEARNING → SQL Editor (después del 18 y
-- del último que hayas ejecutado). Es seguro ejecutarlo más de una vez.
--
-- · Cada jornada indica su modalidad: presencial, virtual o mixta.
-- · Puede llevar el enlace de la reunión (Meet, Zoom o Teams) con uno o
--   varios encuentros: la persona lo ve al registrarse con la clave.
-- · En una jornada VIRTUAL, la asistencia y el certificado quedan con
--   modalidad «virtual».
-- =====================================================================

alter table public.cap_jornadas add column if not exists modalidad text not null default 'presencial';
do $$ begin
  alter table public.cap_jornadas add constraint cap_jornadas_modalidad_chk
    check (modalidad in ('presencial', 'virtual', 'mixta'));
exception when duplicate_object then null; end $$;
alter table public.cap_jornadas add column if not exists encuentros jsonb not null default '[]'::jsonb;

-- Jornada virtual: la inscripción queda como virtual
create or replace function public.cap_inscripcion_modalidad_jornada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.cap_convocatorias c
             join public.cap_jornadas j on j.id = c.jornada_id
             where c.id = new.convocatoria_id and j.modalidad = 'virtual') then
    new.modalidad := 'virtual';
  end if;
  return new;
end;
$$;
revoke all on function public.cap_inscripcion_modalidad_jornada() from public, anon, authenticated;

drop trigger if exists cap_inscripciones_modalidad_jornada on public.cap_inscripciones;
create trigger cap_inscripciones_modalidad_jornada
  before insert or update on public.cap_inscripciones
  for each row execute function public.cap_inscripcion_modalidad_jornada();

-- Abrir una jornada con su clave: ahora con modalidad y encuentros en vivo
create or replace function public.cap_jornada(p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  j        record;
  v_motivo text;
begin
  select jo.*, e.nombre as empresa, e.activa
    into j
  from public.cap_jornadas jo
  join public.cap_empresas e on e.id = jo.empresa_id
  where replace(jo.codigo, '-', '') =
        replace(upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g')), '-', '');
  if not found then return null; end if;

  v_motivo := case
    when j.anulado then 'Esta clave fue anulada. Pide una clave nueva a tu empresa.'
    when not j.activa then 'Esta clave ya no está disponible.'
    when now() < j.valido_desde then 'Esta clave estará activa desde el '
      || to_char(j.valido_desde at time zone 'America/Guayaquil', 'DD/MM/YYYY "a las" HH24:MI') || '.'
    when now() > j.valido_hasta then 'Esta clave venció el '
      || to_char(j.valido_hasta at time zone 'America/Guayaquil', 'DD/MM/YYYY "a las" HH24:MI') || '.'
  end;
  if v_motivo is not null then
    return jsonb_build_object('valido', false, 'jornada', true, 'motivo', v_motivo);
  end if;

  return jsonb_build_object(
    'valido', true, 'jornada', true,
    'empresa', j.empresa, 'nombre', j.nombre, 'fecha', j.fecha, 'valido_hasta', j.valido_hasta,
    'modalidad', j.modalidad, 'encuentros', coalesce(j.encuentros, '[]'::jsonb), 'ahora', now(),
    'capacitaciones', coalesce((
      select jsonb_agg(jsonb_build_object(
               'convocatoria_id', c.id,
               'curso_id', k.id,
               'curso', k.titulo,
               'horas', coalesce(c.horas, k.horas),
               'requiere_evaluacion', c.evaluacion_presencial,
               'codigo', (select a.codigo from public.cap_accesos a
                          where a.convocatoria_id = c.id and a.tipo = 'presencial' and not a.anulado
                          order by (now() between a.valido_desde and a.valido_hasta) desc, a.creado_en desc
                          limit 1)
             ) order by c.creado_en)
      from public.cap_convocatorias c
      join public.cap_cursos k on k.id = c.curso_id
      where c.jornada_id = j.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.cap_jornada(text) from public;
grant execute on function public.cap_jornada(text) to anon, authenticated;
