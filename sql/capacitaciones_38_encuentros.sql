-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 38 · VARIOS ENCUENTROS EN VIVO
-- Ejecutar en Supabase de NEXUS LEARNING → SQL Editor, después del 37.
-- Es seguro ejecutarlo más de una vez. No borra datos.
--
-- Una capacitación (una sola clave y un solo QR) puede tener varios
-- encuentros en vivo, cada uno con su fecha, hora, duración y enlace
-- de Meet/Zoom/Teams. Todos los participantes quedan en la misma nómina.
--   encuentros = [{"inicio": "2026-10-23T20:00:00Z", "duracion": 60, "url": "https://meet..."}]
-- La reunión única del SQL 35 pasa a ser el encuentro 1.
-- =====================================================================

alter table public.cap_convocatorias
  add column if not exists encuentros jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cap_conv_encuentros_chk') then
    alter table public.cap_convocatorias add constraint cap_conv_encuentros_chk
      check (jsonb_typeof(encuentros) = 'array' and jsonb_array_length(encuentros) <= 20);
  end if;
end $$;

-- La reunión que ya existía pasa a ser el primer encuentro
update public.cap_convocatorias
set encuentros = jsonb_build_array(jsonb_build_object(
      'inicio', reunion_inicio, 'duracion', reunion_duracion, 'url', reunion_url))
where reunion_url is not null and encuentros = '[]'::jsonb;

-- Página del participante: todos los encuentros de su capacitación
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
  if jsonb_array_length(c.encuentros) = 0 then return null; end if;

  return jsonb_build_object('encuentros', c.encuentros, 'ahora', now());
end;
$$;
revoke all on function public.cap_reunion(text) from public;
grant execute on function public.cap_reunion(text) to anon, authenticated;

-- Mis programas (docente): ahora con todos los encuentros
create or replace function public.cap_mis_capacitaciones()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('ahora', now(), 'lista', coalesce(jsonb_agg(x.fila order by x.orden), '[]'::jsonb))
  from (
    select
      coalesce(
        (select min((e->>'inicio')::timestamptz) from jsonb_array_elements(cv.encuentros) e
          where (e->>'inicio')::timestamptz + make_interval(mins => coalesce((e->>'duracion')::int, 60)) >= now()),
        (select min(a.valido_desde) from public.cap_accesos a where a.convocatoria_id = cv.id and not a.anulado),
        cv.fecha_capacitacion::timestamptz) as orden,
      jsonb_build_object(
        'convocatoria_id', cv.id, 'curso_id', k.id, 'curso', k.titulo, 'empresa', e.nombre,
        'modalidad', cv.modalidad, 'fecha', cv.fecha_capacitacion,
        'encuentros', cv.encuentros,
        'claves', coalesce((
          select jsonb_agg(jsonb_build_object('codigo', a.codigo, 'tipo', a.tipo,
                   'valido_desde', a.valido_desde, 'valido_hasta', a.valido_hasta) order by a.valido_desde)
          from public.cap_accesos a
          where a.convocatoria_id = cv.id and not a.anulado and now() <= a.valido_hasta), '[]'::jsonb)
      ) as fila
    from public.cap_convocatorias cv
    join public.cap_cursos k on k.id = cv.curso_id
    join public.cap_empresas e on e.id = cv.empresa_id
    where (cap_privado.es_admin() or cap_privado.es_docente_de(k.id))
      and e.activa
      and (
        exists (select 1 from public.cap_accesos a where a.convocatoria_id = cv.id and not a.anulado and now() <= a.valido_hasta)
        or exists (select 1 from jsonb_array_elements(cv.encuentros) e
                   where (e->>'inicio')::timestamptz + make_interval(mins => coalesce((e->>'duracion')::int, 60)) >= now())
        or cv.fecha_capacitacion >= (now() at time zone 'America/Guayaquil')::date
      )
  ) x;
$$;
revoke all on function public.cap_mis_capacitaciones() from public, anon;
grant execute on function public.cap_mis_capacitaciones() to authenticated;
