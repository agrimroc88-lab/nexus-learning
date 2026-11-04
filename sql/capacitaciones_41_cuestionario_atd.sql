-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 41 · CUESTIONARIO A-T-D EN LA CAPACITACIÓN
-- Ejecutar en Supabase de NEXUS LEARNING → SQL Editor, después del 40.
-- Es seguro ejecutarlo más de una vez. No borra datos.
--
-- · Cada capacitación (convocatoria) puede llevar un cuestionario EN LÍNEA
--   (por ahora 'atd': diagnóstico inicial de consumo de alcohol, tabaco y
--   otras drogas, A.M. MDT-2024-196). Se elige al planificar la clase; si
--   se aplica en papel, se deja en «Ninguno».
-- · Se llena con el MISMO link y clave de la capacitación, UNA sola vez por
--   persona, tema (curso + empresa) y año. Reutiliza cédula, sexo, fecha de
--   nacimiento y etnia del registro.
-- · El certificado de la capacitación se entrega cuando el cuestionario
--   está guardado.
-- · Las respuestas las ve SOLO el administrador (confidencialidad).
-- · Logo por empresa, para la carátula y el membrete del informe.
-- =====================================================================

alter table public.cap_convocatorias add column if not exists cuestionario text;
do $$ begin
  alter table public.cap_convocatorias add constraint cap_conv_cuestionario_chk
    check (cuestionario is null or cuestionario in ('atd'));
exception when duplicate_object then null; end $$;

alter table public.cap_empresas add column if not exists logo text;   -- ruta en el espacio "portadas"

-- ---------------------------------------------------------------------
-- Respuestas (mismos nombres de campo que el Test A-T-D de NEXUS)
-- ---------------------------------------------------------------------
create table if not exists public.cap_test_atd (
  id                       uuid primary key default gen_random_uuid(),
  convocatoria_id          uuid not null references public.cap_convocatorias(id) on delete cascade,
  inscripcion_id           uuid references public.cap_inscripciones(id) on delete set null,
  curso_id                 uuid not null,
  empresa_id               uuid not null,
  anio                     int  not null,
  cedula                   text not null,
  nombres                  text,
  area_cargo               text not null,
  genero                   text not null,
  anio_nacimiento          int,
  afiliacion               text not null,
  estado_civil             text not null,
  nivel_instruccion        text not null,
  num_hijos                int,
  etnia                    text not null,
  discapacidad             text not null,
  pct_discapacidad         numeric(5,1),
  trabajador_sustituto     boolean not null default false,
  enfermedad_preexistente  text not null,
  droga_principal          text not null,
  droga_principal_otra     text,
  otra_droga               text,
  frecuencia_consumo       text not null,
  ultimo_consumo           text,
  reconoce_problema        text not null,
  factor_psicosocial       text not null,
  desea_tratamiento        boolean not null default false,
  telefono                 text,
  direccion                text,
  creado_en                timestamptz not null default now(),
  constraint cap_test_atd_unico unique (curso_id, empresa_id, cedula, anio)
);
create index if not exists cap_test_atd_conv_idx on public.cap_test_atd (convocatoria_id);

alter table public.cap_test_atd enable row level security;
drop policy if exists "cap_test_atd_admin" on public.cap_test_atd;
create policy "cap_test_atd_admin" on public.cap_test_atd for all to authenticated
  using (cap_privado.es_admin()) with check (cap_privado.es_admin());
revoke all on public.cap_test_atd from anon;

-- ¿Ya lo llenó esta persona (mismo tema y año)?
create or replace function cap_privado.atd_pendiente(p_convocatoria uuid, p_cedula text)
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(c.cuestionario = 'atd', false)
     and not exists (
       select 1 from public.cap_test_atd t
       where t.curso_id = c.curso_id and t.empresa_id = c.empresa_id
         and t.cedula = p_cedula and t.anio = extract(year from now())::int)
  from public.cap_convocatorias c
  where c.id = p_convocatoria;
$$;
revoke all on function cap_privado.atd_pendiente(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Validar clave: ahora dice también si la capacitación lleva cuestionario
-- ---------------------------------------------------------------------
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
    'preguntas', (select count(*) from public.cap_preguntas where curso_id = r.curso_id),
    'cuestionario', (select cuestionario from public.cap_convocatorias where id = r.convocatoria_id)
  );
end;
$$;
revoke all on function public.cap_validar_acceso(text) from public;
grant execute on function public.cap_validar_acceso(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Registro: igual que el archivo 12, pero si falta el cuestionario no
-- entrega todavía el certificado ni pasa a la evaluación.
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
-- Estado del cuestionario para una persona (y sus datos ya conocidos)
-- ---------------------------------------------------------------------
create or replace function public.cap_atd_estado(p_codigo text, p_cedula text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r        record;
  v_cedula text := regexp_replace(coalesce(p_cedula, ''), '\s', '', 'g');
  v_conv   public.cap_convocatorias;
  v_insc   public.cap_inscripciones;
begin
  select * into r from cap_privado.buscar_acceso(p_codigo);
  if not found then return jsonb_build_object('requiere', false); end if;
  select * into v_conv from public.cap_convocatorias where id = r.convocatoria_id;
  if coalesce(v_conv.cuestionario, '') <> 'atd' then
    return jsonb_build_object('requiere', false);
  end if;

  select i.* into v_insc
  from public.cap_inscripciones i
  join public.cap_convocatorias c on c.id = i.convocatoria_id
  where i.cedula = v_cedula and c.empresa_id = v_conv.empresa_id and c.curso_id = v_conv.curso_id
  order by (i.convocatoria_id = r.convocatoria_id) desc, i.creado_en desc
  limit 1;

  return jsonb_build_object(
    'requiere', true,
    'enviado', not cap_privado.atd_pendiente(r.convocatoria_id, v_cedula),
    'sexo', v_insc.sexo,
    'anio_nacimiento', extract(year from v_insc.fecha_nacimiento)::int,
    'etnia', v_insc.etnia,
    'nombres', v_insc.nombres);
end;
$$;
revoke all on function public.cap_atd_estado(text, text) from public;
grant execute on function public.cap_atd_estado(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Guardar el cuestionario (una sola vez)
-- ---------------------------------------------------------------------
create or replace function public.cap_atd_guardar(p_codigo text, p_cedula text, p_datos jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r        record;
  v_cedula text := regexp_replace(coalesce(p_cedula, ''), '\s', '', 'g');
  v_conv   public.cap_convocatorias;
  v_insc   public.cap_inscripciones;
  d        jsonb := coalesce(p_datos, '{}'::jsonb);
  v_no     boolean;
  v_trat   boolean := coalesce((d->>'desea_tratamiento')::boolean, false);
  falta    text;
begin
  select * into r from cap_privado.buscar_acceso(p_codigo);
  if not found then raise exception 'No encontramos esa clave.'; end if;
  if not r.vigente then raise exception '%', r.motivo; end if;
  select * into v_conv from public.cap_convocatorias where id = r.convocatoria_id;
  if coalesce(v_conv.cuestionario, '') <> 'atd' then
    raise exception 'Esta capacitación no tiene cuestionario.';
  end if;

  select i.* into v_insc
  from public.cap_inscripciones i
  join public.cap_convocatorias c on c.id = i.convocatoria_id
  where i.cedula = v_cedula and c.empresa_id = v_conv.empresa_id and c.curso_id = v_conv.curso_id
  order by (i.convocatoria_id = r.convocatoria_id) desc, i.creado_en desc
  limit 1;
  if not found then raise exception 'Primero regístrate en la capacitación.'; end if;

  if not cap_privado.atd_pendiente(r.convocatoria_id, v_cedula) then
    raise exception 'Ya enviaste este cuestionario. Solo se puede llenar una vez.';
  end if;

  select string_agg(k, ', ') into falta
  from unnest(array['area_cargo','genero','afiliacion','estado_civil','nivel_instruccion','discapacidad',
                    'enfermedad_preexistente','droga_principal']) k
  where coalesce(btrim(d->>k), '') = '';
  if falta is not null then raise exception 'Faltan respuestas: %', falta; end if;

  v_no := d->>'droga_principal' = 'no_consume';
  if not v_no and (coalesce(d->>'frecuencia_consumo', '') = '' or coalesce(d->>'reconoce_problema', '') = ''
                   or coalesce(d->>'factor_psicosocial', '') = '') then
    raise exception 'Responde la frecuencia, si reconoces un problema y el factor asociado.';
  end if;

  insert into public.cap_test_atd (
    convocatoria_id, inscripcion_id, curso_id, empresa_id, anio, cedula, nombres,
    area_cargo, genero, anio_nacimiento, afiliacion, estado_civil, nivel_instruccion, num_hijos, etnia,
    discapacidad, pct_discapacidad, trabajador_sustituto, enfermedad_preexistente,
    droga_principal, droga_principal_otra, otra_droga, frecuencia_consumo, ultimo_consumo,
    reconoce_problema, factor_psicosocial, desea_tratamiento, telefono, direccion)
  values (
    r.convocatoria_id, v_insc.id, v_conv.curso_id, v_conv.empresa_id, extract(year from now())::int, v_cedula, v_insc.nombres,
    upper(btrim(d->>'area_cargo')), d->>'genero',
    coalesce(nullif(d->>'anio_nacimiento', '')::int, extract(year from v_insc.fecha_nacimiento)::int),
    d->>'afiliacion', d->>'estado_civil', d->>'nivel_instruccion', nullif(d->>'num_hijos', '')::int,
    coalesce(nullif(d->>'etnia', ''), case when v_insc.etnia = 'no_responde' then 'otro' else v_insc.etnia end),
    d->>'discapacidad',
    case when d->>'discapacidad' = 'no_aplica' then null else nullif(d->>'pct_discapacidad', '')::numeric end,
    coalesce((d->>'trabajador_sustituto')::boolean, false), d->>'enfermedad_preexistente',
    d->>'droga_principal',
    case when d->>'droga_principal' = 'otra' then nullif(btrim(d->>'droga_principal_otra'), '') end,
    coalesce(nullif(d->>'otra_droga', ''), 'no_consume'),
    case when v_no then 'no_consume' else d->>'frecuencia_consumo' end,
    case when v_no then null else nullif(btrim(d->>'ultimo_consumo'), '') end,
    case when v_no then 'no_aplica' else d->>'reconoce_problema' end,
    case when v_no then 'no_aplica' else d->>'factor_psicosocial' end,
    v_trat,
    case when v_trat then nullif(btrim(d->>'telefono'), '') end,
    case when v_trat then nullif(btrim(d->>'direccion'), '') end);

  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.cap_atd_guardar(text, text, jsonb) from public;
grant execute on function public.cap_atd_guardar(text, text, jsonb) to anon, authenticated;
