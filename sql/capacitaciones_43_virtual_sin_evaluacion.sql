-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 43 · VIRTUAL CON O SIN EVALUACIÓN
-- Ejecutar en Supabase de NEXUS LEARNING → SQL Editor, DESPUÉS del 41
-- (reemplaza el registro del 41 y lo conserva igual, más esta opción).
-- Es seguro ejecutarlo más de una vez. No borra datos.
--
-- · Cada capacitación elige si el acceso VIRTUAL pide evaluación (como
--   hasta ahora) o no. Sin evaluación: la persona se registra, estudia las
--   lecciones y al terminar obtiene su certificado de asistencia.
-- · Las capacitaciones que ya existen siguen CON evaluación.
-- =====================================================================

alter table public.cap_convocatorias
  add column if not exists evaluacion_virtual boolean not null default true;

-- Búsqueda de claves: ahora la evaluación depende del tipo de acceso
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
    case when a.tipo = 'virtual' then c.evaluacion_virtual else c.evaluacion_presencial end,
    a.valido_hasta
  from public.cap_accesos a
  join public.cap_convocatorias c on c.id = a.convocatoria_id
  join public.cap_empresas e on e.id = c.empresa_id
  join public.cap_cursos k on k.id = c.curso_id
  where replace(a.codigo, '-', '') =
        replace(upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g')), '-', '');
$$;
revoke all on function cap_privado.buscar_acceso(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Registro (igual que el 41, con el caso virtual sin evaluación)
-- ---------------------------------------------------------------------
create or replace function public.cap_inscribir(
  p_codigo text, p_cedula text, p_nombres text, p_correo text, p_acepta boolean,
  p_sexo text default null, p_fecha_nacimiento date default null, p_etnia text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r         record;
  v_insc    public.cap_inscripciones;
  v_cert    uuid;
  v_cedula  text := regexp_replace(coalesce(p_cedula, ''), '\s', '', 'g');
  v_nombres text := regexp_replace(btrim(coalesce(p_nombres, '')), '\s+', ' ', 'g');
  v_correo  text := nullif(btrim(coalesce(p_correo, '')), '');
  v_sexo    text := upper(btrim(coalesce(p_sexo, '')));
  v_etnia   text := lower(btrim(coalesce(p_etnia, '')));
begin
  select * into r from cap_privado.buscar_acceso(p_codigo);
  if not found then
    raise exception 'No encontramos esa clave. Revisa que esté bien escrita.';
  end if;

  if length(v_cedula) < 5 or length(v_cedula) > 20 then
    raise exception 'Ingresa un número de cédula o pasaporte válido.';
  end if;

  -- ¿Ya tiene certificado en esta convocatoria? (no exige los datos nuevos)
  select id into v_cert from public.cap_certificados
  where convocatoria_id = r.convocatoria_id and cedula = v_cedula;
  if found then
    return jsonb_build_object('estado', 'certificado', 'ya_emitido', true,
                              'certificado', cap_privado.certificado_json(v_cert));
  end if;

  if not r.vigente then raise exception '%', r.motivo; end if;
  if length(v_nombres) < 5 then raise exception 'Ingresa tus nombres y apellidos completos.'; end if;
  if v_sexo not in ('M', 'F') then raise exception 'Indica tu sexo (M o F).'; end if;
  if p_fecha_nacimiento is null
     or p_fecha_nacimiento < date '1930-01-01'
     or p_fecha_nacimiento > (current_date - interval '14 years') then
    raise exception 'Revisa tu fecha de nacimiento.';
  end if;
  if v_etnia not in ('mestizo', 'blanco', 'indigena', 'montubio', 'afroecuatoriano', 'otro', 'no_responde') then
    raise exception 'Indica tu autoidentificación étnica (o "Prefiero no responder").';
  end if;
  if coalesce(p_acepta, false) = false then
    raise exception 'Debes aceptar el tratamiento de tus datos para continuar.';
  end if;
  if r.requiere_evaluacion and not exists (select 1 from public.cap_preguntas where curso_id = r.curso_id) then
    raise exception 'La evaluación de este curso todavía no está lista. Avisa a tu empresa.';
  end if;

  insert into public.cap_inscripciones
    (convocatoria_id, acceso_id, modalidad, cedula, nombres, correo, acepta_privacidad, sexo, fecha_nacimiento, etnia)
  values
    (r.convocatoria_id, r.acceso_id, r.tipo, v_cedula, v_nombres, v_correo, true, v_sexo, p_fecha_nacimiento, v_etnia)
  on conflict (convocatoria_id, cedula) do update
    set acceso_id        = excluded.acceso_id,
        modalidad        = excluded.modalidad,
        nombres          = excluded.nombres,
        correo           = coalesce(excluded.correo, public.cap_inscripciones.correo),
        sexo             = excluded.sexo,
        fecha_nacimiento = excluded.fecha_nacimiento,
        etnia            = excluded.etnia
  returning * into v_insc;

  -- Cuestionario pendiente: primero el cuestionario
  if cap_privado.atd_pendiente(r.convocatoria_id, v_cedula) then
    return jsonb_build_object('estado', 'cuestionario', 'cuestionario', 'atd',
                              'nombres', v_insc.nombres, 'modalidad', v_insc.modalidad);
  end if;

  -- Virtual sin evaluación: primero estudia las lecciones; el certificado lo
  -- pide al terminar (cap_finalizar_sin_evaluacion)
  if r.tipo = 'virtual' and not r.requiere_evaluacion then
    return jsonb_build_object('estado', 'lecciones', 'nombres', v_insc.nombres, 'modalidad', v_insc.modalidad);
  end if;

  if not r.requiere_evaluacion then
    v_cert := cap_privado.emitir_certificado(v_insc, r.curso_id, r.empresa, r.horas, 'asistencia', null, null);
    return jsonb_build_object('estado', 'certificado', 'ya_emitido', false,
                              'certificado', cap_privado.certificado_json(v_cert));
  end if;

  return jsonb_build_object('estado', 'evaluacion', 'nombres', v_insc.nombres, 'modalidad', v_insc.modalidad);
end;
$$;
revoke all on function public.cap_inscribir(text, text, text, text, boolean, text, date, text) from public;
grant execute on function public.cap_inscribir(text, text, text, text, boolean, text, date, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Virtual sin evaluación: terminó las lecciones → certificado de asistencia
-- ---------------------------------------------------------------------
create or replace function public.cap_finalizar_sin_evaluacion(p_codigo text, p_cedula text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r        record;
  v_cedula text := regexp_replace(coalesce(p_cedula, ''), '\s', '', 'g');
  v_insc   public.cap_inscripciones;
  v_cert   uuid;
begin
  select * into r from cap_privado.buscar_acceso(p_codigo);
  if not found then raise exception 'No encontramos esa clave.'; end if;

  select id into v_cert from public.cap_certificados where convocatoria_id = r.convocatoria_id and cedula = v_cedula;
  if found then
    return jsonb_build_object('estado', 'certificado', 'ya_emitido', true, 'certificado', cap_privado.certificado_json(v_cert));
  end if;

  if not r.vigente then raise exception '%', r.motivo; end if;
  if r.requiere_evaluacion then raise exception 'Esta capacitación tiene evaluación.'; end if;

  select * into v_insc from public.cap_inscripciones where convocatoria_id = r.convocatoria_id and cedula = v_cedula;
  if not found then raise exception 'Primero regístrate en la capacitación.'; end if;

  if cap_privado.atd_pendiente(r.convocatoria_id, v_cedula) then
    return jsonb_build_object('estado', 'cuestionario', 'cuestionario', 'atd', 'nombres', v_insc.nombres);
  end if;

  v_cert := cap_privado.emitir_certificado(v_insc, r.curso_id, r.empresa, r.horas, 'asistencia', null, null);
  return jsonb_build_object('estado', 'certificado', 'ya_emitido', false, 'certificado', cap_privado.certificado_json(v_cert));
end;
$$;
revoke all on function public.cap_finalizar_sin_evaluacion(text, text) from public;
grant execute on function public.cap_finalizar_sin_evaluacion(text, text) to anon, authenticated;
