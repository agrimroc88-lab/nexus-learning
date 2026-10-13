-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 10 · QR POR PROGRAMA Y CLAVES PROPIAS
-- Ejecutar en el proyecto nexus-learning, DESPUÉS de los archivos 1 a 9.
-- Es seguro ejecutarlo más de una vez. No borra datos.
--
-- Qué cambia:
--   · El administrador puede ESCRIBIR la clave de acceso (ej.: AGR48213).
--     Si la deja vacía, se genera sola con el mismo estilo:
--     3 letras de la empresa + 5 números sin orden.
--   · Cada clave es única en toda la historia (no se reutiliza).
--     Para dar más tiempo, se EXTIENDE su vigencia desde el panel.
--   · Las claves se reconocen con o sin guion y en minúsculas
--     (las claves antiguas tipo AGR-7K4P9Q siguen funcionando).
--   · Nueva función pública cap_programa: muestra título, descripción y
--     horas de un programa para la página del QR. El contenido sigue
--     protegido hasta escribir una clave válida.
-- =====================================================================


-- =====================================================================
-- 1. CLAVES: escritas por el administrador o generadas
-- =====================================================================
create or replace function public.cap_antes_de_guardar_acceso()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_modalidad text;
  v_prefijo   text;
  v_codigo    text;
  v_numero    int;
begin
  select c.modalidad,
         upper(substr(regexp_replace(translate(e.nombre, 'áéíóúÁÉÍÓÚñÑüÜ', 'aeiouAEIOUnNuU'), '[^A-Za-z]', '', 'g'), 1, 3))
    into v_modalidad, v_prefijo
  from public.cap_convocatorias c
  join public.cap_empresas e on e.id = c.empresa_id
  where c.id = new.convocatoria_id;

  -- El tipo de acceso debe corresponder a la modalidad de la convocatoria
  if v_modalidad = 'virtual' and new.tipo <> 'virtual' then
    raise exception 'Una convocatoria virtual solo puede tener claves virtuales.';
  end if;
  if v_modalidad = 'presencial' and new.tipo <> 'presencial' then
    raise exception 'Una convocatoria presencial solo puede tener claves presenciales.';
  end if;

  if tg_op = 'INSERT' then
    if new.codigo is not null and btrim(new.codigo) <> '' then
      -- Clave escrita por el administrador
      v_codigo := upper(regexp_replace(new.codigo, '\s', '', 'g'));
      if v_codigo !~ '^[A-Z0-9][A-Z0-9-]{2,10}[A-Z0-9]$' then
        raise exception 'La clave debe tener de 4 a 12 letras o números, sin espacios ni símbolos.';
      end if;
      if exists (select 1 from public.cap_accesos
                 where replace(codigo, '-', '') = replace(v_codigo, '-', '')) then
        raise exception 'La clave % ya fue usada. Elija otra.', v_codigo;
      end if;
    else
      -- Clave automática: prefijo + 5 números al azar (10000 a 99999)
      v_prefijo := rpad(coalesce(v_prefijo, ''), 3, 'X');
      loop
        v_numero := 10000 + ((get_byte(gen_random_bytes(1), 0) * 65536
                              + get_byte(gen_random_bytes(1), 0) * 256
                              + get_byte(gen_random_bytes(1), 0)) % 90000);
        v_codigo := v_prefijo || v_numero::text;
        exit when not exists (select 1 from public.cap_accesos
                              where replace(codigo, '-', '') = v_codigo);
      end loop;
    end if;
    new.codigo := v_codigo;
  else
    new.codigo := old.codigo;   -- la clave no cambia nunca después de creada
  end if;

  return new;
end;
$$;

revoke all on function public.cap_antes_de_guardar_acceso() from public, anon, authenticated;

create index if not exists cap_accesos_codigo_normal_idx on public.cap_accesos (replace(codigo, '-', ''));


-- =====================================================================
-- 2. BÚSQUEDA DE CLAVES: con o sin guion, en minúsculas o mayúsculas
-- =====================================================================
create or replace function cap_privado.buscar_acceso(p_codigo text)
returns table (
  acceso_id uuid, tipo text, vigente boolean, motivo text,
  convocatoria_id uuid, empresa text, curso_id uuid, curso text, descripcion text,
  horas numeric, nota_minima numeric, requiere_evaluacion boolean, valido_hasta timestamptz
)
language sql
stable
set search_path = public
as $$
  select
    a.id, a.tipo,
    (not a.anulado and e.activa and now() between a.valido_desde and a.valido_hasta),
    case
      when a.anulado then 'Esta clave fue anulada. Pide una clave nueva a tu empresa.'
      when not e.activa then 'Esta clave ya no está disponible.'
      when now() < a.valido_desde then 'Esta clave estará activa desde el '
        || to_char(a.valido_desde at time zone 'America/Guayaquil', 'DD/MM/YYYY "a las" HH24:MI') || '.'
      when now() > a.valido_hasta then 'Esta clave venció el '
        || to_char(a.valido_hasta at time zone 'America/Guayaquil', 'DD/MM/YYYY "a las" HH24:MI') || '. Pide a tu empresa que solicite una extensión.'
    end,
    c.id, e.nombre, k.id, k.titulo, k.descripcion,
    coalesce(c.horas, k.horas), k.nota_minima,
    (a.tipo = 'virtual' or c.evaluacion_presencial),
    a.valido_hasta
  from public.cap_accesos a
  join public.cap_convocatorias c on c.id = a.convocatoria_id
  join public.cap_empresas e on e.id = c.empresa_id
  join public.cap_cursos k on k.id = c.curso_id
  where replace(a.codigo, '-', '') =
        replace(upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g')), '-', '');
$$;

revoke all on function cap_privado.buscar_acceso(text) from public, anon, authenticated;


-- =====================================================================
-- 3. VALIDAR CLAVE: ahora también indica a qué programa pertenece
-- =====================================================================
create or replace function public.cap_validar_acceso(p_codigo text)
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
  if not found then
    return jsonb_build_object('valido', false, 'motivo', 'No encontramos esa clave. Revisa que esté bien escrita.');
  end if;
  if not r.vigente then
    return jsonb_build_object('valido', false, 'motivo', r.motivo, 'curso_id', r.curso_id);
  end if;
  return jsonb_build_object(
    'valido', true, 'tipo', r.tipo, 'empresa', r.empresa, 'curso_id', r.curso_id, 'curso', r.curso,
    'descripcion', r.descripcion, 'horas', r.horas, 'nota_minima', r.nota_minima,
    'requiere_evaluacion', r.requiere_evaluacion, 'valido_hasta', r.valido_hasta,
    'lecciones', (select count(*) from public.cap_lecciones where curso_id = r.curso_id),
    'preguntas', (select count(*) from public.cap_preguntas where curso_id = r.curso_id)
  );
end;
$$;

revoke all on function public.cap_validar_acceso(text) from public;
grant execute on function public.cap_validar_acceso(text) to anon, authenticated;


-- =====================================================================
-- 4. PRESENTACIÓN DEL PROGRAMA (para la página del QR permanente)
--    Solo título, descripción, horas y número de lecciones.
--    Solo programas ACTIVOS. El contenido sigue protegido por clave.
-- =====================================================================
create or replace function public.cap_programa(p_curso uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', k.id, 'titulo', k.titulo, 'descripcion', k.descripcion, 'horas', k.horas,
    'lecciones', (select count(*) from public.cap_lecciones l where l.curso_id = k.id)
  )
  from public.cap_cursos k
  where k.id = p_curso and k.publicado = true;
$$;

revoke all on function public.cap_programa(uuid) from public;
grant execute on function public.cap_programa(uuid) to anon, authenticated;
