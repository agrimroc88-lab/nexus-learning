-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 12 · SEXO, EDAD Y ETNIA DEL PARTICIPANTE
-- Ejecutar en el proyecto nexus-learning, DESPUÉS de los archivos 1 a 11.
-- Es seguro ejecutarlo más de una vez. No borra datos.
--
-- Qué agrega:
--   · Al registrarse, cada persona indica: sexo (M/F), fecha de nacimiento
--     (para calcular la edad) y autoidentificación étnica (mismas opciones
--     que el test ATD de NEXUS, más "Prefiero no responder").
--   · La etnia es un DATO SENSIBLE (LOPDP): la persona puede no declararla.
--   · Las inscripciones anteriores quedan sin estos datos (no se inventan).
--
-- ⚠️ Después de ejecutarlo, sube de inmediato curso.html y js/curso.js:
--    la página anterior no envía estos datos y el registro los exige.
-- =====================================================================

alter table public.cap_inscripciones add column if not exists sexo text;
alter table public.cap_inscripciones add column if not exists fecha_nacimiento date;
alter table public.cap_inscripciones add column if not exists etnia text;

do $$ begin
  alter table public.cap_inscripciones add constraint cap_inscripciones_sexo
    check (sexo is null or sexo in ('M', 'F'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cap_inscripciones add constraint cap_inscripciones_etnia
    check (etnia is null or etnia in ('mestizo', 'blanco', 'indigena', 'montubio', 'afroecuatoriano', 'otro', 'no_responde'));
exception when duplicate_object then null; end $$;


-- ---------------------------------------------------------------------
-- Registro con los datos nuevos.
-- Los tres parámetros nuevos tienen valor por defecto, así la búsqueda
-- de un certificado ya emitido (solo cédula) sigue funcionando.
-- ---------------------------------------------------------------------
drop function if exists public.cap_inscribir(text, text, text, text, boolean);

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
