-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 6 · EMPRESAS, CONVOCATORIAS Y CÓDIGOS
-- Ejecutar DESPUÉS de los archivos 1 a 5.
-- Es seguro ejecutarlo más de una vez. No borra datos existentes.
--
-- Qué agrega:
--   · Empresas (carpetas)
--   · Convocatorias: un curso para una empresa (virtual, presencial o mixta)
--   · Accesos: códigos con fechas de validez (presencial y/o virtual)
--   · Inscripciones: la nómina de cada convocatoria
--   · Certificados de ASISTENCIA (sin evaluación) además de APROBACIÓN
--
-- Qué cambia:
--   · Los cursos ya no se ven públicamente: solo se accede con un código.
--   · Se reemplazan las funciones públicas anteriores por nuevas.
--     (La web mostrará errores hasta subir las páginas del paso 18.)
-- =====================================================================


-- =====================================================================
-- 1. TABLAS NUEVAS
-- =====================================================================

create table if not exists public.cap_empresas (
  id                uuid primary key default gen_random_uuid(),
  nombre            text not null,
  ruc               text unique,
  contacto          text,
  correo            text,
  telefono          text,
  num_trabajadores  int check (num_trabajadores is null or num_trabajadores >= 0),
  activa            boolean not null default true,
  creado_en         timestamptz not null default now()
);

create table if not exists public.cap_convocatorias (
  id                     uuid primary key default gen_random_uuid(),
  empresa_id             uuid not null references public.cap_empresas(id) on delete restrict,
  curso_id               uuid not null references public.cap_cursos(id) on delete restrict,
  modalidad              text not null check (modalidad in ('virtual', 'presencial', 'mixta')),
  evaluacion_presencial  boolean not null default false,  -- ¿el acceso presencial pide test?
  horas                  numeric(5,1) check (horas is null or horas > 0), -- vacío = horas del curso
  fecha_capacitacion     date,
  observaciones          text,
  creado_en              timestamptz not null default now()
);

create table if not exists public.cap_accesos (
  id               uuid primary key default gen_random_uuid(),
  convocatoria_id  uuid not null references public.cap_convocatorias(id) on delete cascade,
  tipo             text not null check (tipo in ('virtual', 'presencial')),
  codigo           text not null unique,         -- se genera solo, ej.: AND-7K4P9Q
  valido_desde     timestamptz not null default now(),
  valido_hasta     timestamptz not null,
  anulado          boolean not null default false,
  creado_en        timestamptz not null default now(),
  constraint cap_accesos_fechas check (valido_hasta > valido_desde)
);

create table if not exists public.cap_inscripciones (
  id                 uuid primary key default gen_random_uuid(),
  convocatoria_id    uuid not null references public.cap_convocatorias(id) on delete cascade,
  acceso_id          uuid references public.cap_accesos(id) on delete set null,
  modalidad          text not null check (modalidad in ('virtual', 'presencial')),
  cedula             text not null,
  nombres            text not null,
  correo             text,
  acepta_privacidad  boolean not null default false,
  creado_en          timestamptz not null default now(),
  constraint cap_inscripciones_unica unique (convocatoria_id, cedula)
);

create index if not exists cap_convocatorias_empresa_idx on public.cap_convocatorias (empresa_id);
create index if not exists cap_accesos_conv_idx         on public.cap_accesos (convocatoria_id);
create index if not exists cap_inscripciones_conv_idx   on public.cap_inscripciones (convocatoria_id);


-- =====================================================================
-- 2. CAMBIOS EN TABLAS EXISTENTES
-- =====================================================================

-- Intentos: ligarlos a la inscripción
alter table public.cap_intentos add column if not exists inscripcion_id  uuid references public.cap_inscripciones(id) on delete cascade;
alter table public.cap_intentos add column if not exists convocatoria_id uuid references public.cap_convocatorias(id) on delete cascade;

-- Certificados: pueden ser de asistencia (sin intento ni nota)
alter table public.cap_certificados alter column intento_id drop not null;
alter table public.cap_certificados alter column nota drop not null;
alter table public.cap_certificados add column if not exists tipo            text not null default 'aprobacion';
alter table public.cap_certificados add column if not exists modalidad       text;
alter table public.cap_certificados add column if not exists horas           numeric(5,1);
alter table public.cap_certificados add column if not exists convocatoria_id uuid references public.cap_convocatorias(id) on delete restrict;
alter table public.cap_certificados add column if not exists inscripcion_id  uuid references public.cap_inscripciones(id) on delete restrict;

do $$ begin
  alter table public.cap_certificados add constraint cap_certificados_tipo check (tipo in ('aprobacion', 'asistencia'));
exception when duplicate_object then null; end $$;

-- Un solo certificado por persona en cada convocatoria
create unique index if not exists cap_certificados_conv_cedula_uq
  on public.cap_certificados (convocatoria_id, cedula) where convocatoria_id is not null;


-- =====================================================================
-- 3. GENERACIÓN AUTOMÁTICA DE CÓDIGOS
--    Formato: 3 letras de la empresa + guion + 6 caracteres. Ej.: AND-7K4P9Q
--    Sin letras confusas (I, L, O, 0, 1).
-- =====================================================================
create or replace function public.cap_antes_de_guardar_acceso()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare
  v_modalidad text;
  v_prefijo   text;
  v_alfabeto  text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_codigo    text;
  i           int;
begin
  select c.modalidad,
         upper(substr(regexp_replace(translate(e.nombre, 'áéíóúÁÉÍÓÚñÑüÜ', 'aeiouAEIOUnNuU'), '[^A-Za-z]', '', 'g'), 1, 3))
    into v_modalidad, v_prefijo
  from public.cap_convocatorias c
  join public.cap_empresas e on e.id = c.empresa_id
  where c.id = new.convocatoria_id;

  -- El tipo de acceso debe corresponder a la modalidad de la convocatoria
  if v_modalidad = 'virtual' and new.tipo <> 'virtual' then
    raise exception 'Una convocatoria virtual solo puede tener códigos virtuales.';
  end if;
  if v_modalidad = 'presencial' and new.tipo <> 'presencial' then
    raise exception 'Una convocatoria presencial solo puede tener códigos presenciales.';
  end if;

  -- Generar el código solo al crear (no se cambia después)
  if tg_op = 'INSERT' then
    v_prefijo := rpad(coalesce(v_prefijo, ''), 3, 'X');
    loop
      v_codigo := v_prefijo || '-';
      for i in 1..6 loop
        v_codigo := v_codigo || substr(v_alfabeto, 1 + (get_byte(gen_random_bytes(1), 0) % length(v_alfabeto)), 1);
      end loop;
      exit when not exists (select 1 from public.cap_accesos where codigo = v_codigo);
    end loop;
    new.codigo := v_codigo;
  else
    new.codigo := old.codigo;
  end if;

  return new;
end;
$$;

drop trigger if exists cap_accesos_antes_guardar on public.cap_accesos;
create trigger cap_accesos_antes_guardar
  before insert or update on public.cap_accesos
  for each row execute function public.cap_antes_de_guardar_acceso();

revoke all on function public.cap_antes_de_guardar_acceso() from public, anon;


-- =====================================================================
-- 4. SEGURIDAD (RLS): las tablas nuevas solo las ven administradores
-- =====================================================================
alter table public.cap_empresas      enable row level security;
alter table public.cap_convocatorias enable row level security;
alter table public.cap_accesos       enable row level security;
alter table public.cap_inscripciones enable row level security;

drop policy if exists "cap_empresas_admin" on public.cap_empresas;
create policy "cap_empresas_admin" on public.cap_empresas for all to authenticated
  using (exists (select 1 from public.cap_administradores a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.cap_administradores a where a.user_id = (select auth.uid())));

drop policy if exists "cap_convocatorias_admin" on public.cap_convocatorias;
create policy "cap_convocatorias_admin" on public.cap_convocatorias for all to authenticated
  using (exists (select 1 from public.cap_administradores a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.cap_administradores a where a.user_id = (select auth.uid())));

drop policy if exists "cap_accesos_admin" on public.cap_accesos;
create policy "cap_accesos_admin" on public.cap_accesos for all to authenticated
  using (exists (select 1 from public.cap_administradores a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.cap_administradores a where a.user_id = (select auth.uid())));

drop policy if exists "cap_inscripciones_admin" on public.cap_inscripciones;
create policy "cap_inscripciones_admin" on public.cap_inscripciones for all to authenticated
  using (exists (select 1 from public.cap_administradores a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.cap_administradores a where a.user_id = (select auth.uid())));

-- Los cursos y lecciones dejan de ser públicos: solo se ven con un código válido
drop policy if exists "cap_cursos_publico_lee_publicados" on public.cap_cursos;
drop policy if exists "cap_lecciones_publico_lee_publicadas" on public.cap_lecciones;

-- Se retiran las funciones públicas anteriores (las reemplazan las de abajo)
drop function if exists public.cap_obtener_preguntas(uuid);
drop function if exists public.cap_enviar_evaluacion(uuid, text, text, text, text, boolean, jsonb);


-- =====================================================================
-- 5. FUNCIONES INTERNAS (esquema privado, no accesible desde la web)
-- =====================================================================
create schema if not exists cap_privado;
revoke all on schema cap_privado from public, anon, authenticated;

-- Busca un código y dice si está vigente y por qué no
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
      when a.anulado then 'Este código fue anulado. Pide un código nuevo a tu empresa.'
      when not e.activa then 'Este código ya no está disponible.'
      when now() < a.valido_desde then 'Este código estará activo desde el '
        || to_char(a.valido_desde at time zone 'America/Guayaquil', 'DD/MM/YYYY "a las" HH24:MI') || '.'
      when now() > a.valido_hasta then 'Este código venció el '
        || to_char(a.valido_hasta at time zone 'America/Guayaquil', 'DD/MM/YYYY "a las" HH24:MI') || '. Pide un código nuevo a tu empresa.'
    end,
    c.id, e.nombre, k.id, k.titulo, k.descripcion,
    coalesce(c.horas, k.horas), k.nota_minima,
    (a.tipo = 'virtual' or c.evaluacion_presencial),
    a.valido_hasta
  from public.cap_accesos a
  join public.cap_convocatorias c on c.id = a.convocatoria_id
  join public.cap_empresas e on e.id = c.empresa_id
  join public.cap_cursos k on k.id = c.curso_id
  where a.codigo = upper(btrim(coalesce(p_codigo, '')));
$$;

-- Datos completos de un certificado (para descargar el PDF)
create or replace function cap_privado.certificado_json(p_id uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'codigo', c.codigo, 'nombres', c.nombres, 'cedula', c.cedula, 'empresa', c.empresa,
    'curso', k.titulo, 'horas', coalesce(c.horas, k.horas), 'nota', c.nota,
    'tipo', c.tipo, 'modalidad', c.modalidad, 'emitido_en', c.emitido_en
  )
  from public.cap_certificados c
  join public.cap_cursos k on k.id = c.curso_id
  where c.id = p_id;
$$;

-- Emite un certificado
create or replace function cap_privado.emitir_certificado(
  p_insc public.cap_inscripciones, p_curso uuid, p_empresa text, p_horas numeric,
  p_tipo text, p_nota numeric, p_intento uuid
)
returns uuid
language plpgsql
set search_path = public, extensions
as $$
declare
  v_id uuid;
begin
  insert into public.cap_certificados
    (codigo, intento_id, curso_id, cedula, nombres, empresa, nota, tipo, modalidad, horas, convocatoria_id, inscripcion_id)
  values
    ('VW-' || to_char(now(), 'YYYY') || '-' || upper(encode(gen_random_bytes(4), 'hex')),
     p_intento, p_curso, p_insc.cedula, p_insc.nombres, p_empresa, p_nota, p_tipo,
     p_insc.modalidad, p_horas, p_insc.convocatoria_id, p_insc.id)
  returning id into v_id;
  return v_id;
end;
$$;


-- =====================================================================
-- 6. FUNCIONES PÚBLICAS (las usa la página web)
-- =====================================================================

-- 6.1 Validar un código: devuelve empresa, curso y si lleva evaluación
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
    return jsonb_build_object('valido', false, 'motivo', 'No encontramos ese código. Revisa que esté bien escrito, incluido el guion.');
  end if;
  if not r.vigente then
    return jsonb_build_object('valido', false, 'motivo', r.motivo);
  end if;
  return jsonb_build_object(
    'valido', true, 'tipo', r.tipo, 'empresa', r.empresa, 'curso', r.curso,
    'descripcion', r.descripcion, 'horas', r.horas, 'nota_minima', r.nota_minima,
    'requiere_evaluacion', r.requiere_evaluacion, 'valido_hasta', r.valido_hasta,
    'lecciones', (select count(*) from public.cap_lecciones where curso_id = r.curso_id),
    'preguntas', (select count(*) from public.cap_preguntas where curso_id = r.curso_id)
  );
end;
$$;

-- 6.2 Inscribirse con un código.
--     · Si ya tiene certificado en esa convocatoria, lo devuelve (aunque el código haya vencido).
--     · Si el acceso no pide evaluación, emite de inmediato el certificado de asistencia.
create or replace function public.cap_inscribir(
  p_codigo text, p_cedula text, p_nombres text, p_correo text, p_acepta boolean
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
begin
  select * into r from cap_privado.buscar_acceso(p_codigo);
  if not found then
    raise exception 'No encontramos ese código. Revisa que esté bien escrito, incluido el guion.';
  end if;

  if length(v_cedula) < 5 or length(v_cedula) > 20 then
    raise exception 'Ingresa un número de cédula o pasaporte válido.';
  end if;

  -- ¿Ya tiene certificado en esta convocatoria?
  select id into v_cert from public.cap_certificados
  where convocatoria_id = r.convocatoria_id and cedula = v_cedula;
  if found then
    return jsonb_build_object('estado', 'certificado', 'ya_emitido', true,
                              'certificado', cap_privado.certificado_json(v_cert));
  end if;

  if not r.vigente then raise exception '%', r.motivo; end if;
  if length(v_nombres) < 5 then raise exception 'Ingresa tus nombres y apellidos completos.'; end if;
  if coalesce(p_acepta, false) = false then
    raise exception 'Debes aceptar el tratamiento de tus datos para continuar.';
  end if;
  if r.requiere_evaluacion and not exists (select 1 from public.cap_preguntas where curso_id = r.curso_id) then
    raise exception 'La evaluación de este curso todavía no está lista. Avisa a tu empresa.';
  end if;

  -- Inscribir (o actualizar si ya estaba inscrito por la otra modalidad)
  insert into public.cap_inscripciones
    (convocatoria_id, acceso_id, modalidad, cedula, nombres, correo, acepta_privacidad)
  values
    (r.convocatoria_id, r.acceso_id, r.tipo, v_cedula, v_nombres, v_correo, true)
  on conflict (convocatoria_id, cedula) do update
    set acceso_id = excluded.acceso_id,
        modalidad = excluded.modalidad,
        nombres   = excluded.nombres,
        correo    = coalesce(excluded.correo, public.cap_inscripciones.correo)
  returning * into v_insc;

  -- Sin evaluación: certificado de asistencia inmediato
  if not r.requiere_evaluacion then
    v_cert := cap_privado.emitir_certificado(v_insc, r.curso_id, r.empresa, r.horas, 'asistencia', null, null);
    return jsonb_build_object('estado', 'certificado', 'ya_emitido', false,
                              'certificado', cap_privado.certificado_json(v_cert));
  end if;

  return jsonb_build_object('estado', 'evaluacion', 'nombres', v_insc.nombres, 'modalidad', v_insc.modalidad);
end;
$$;

-- 6.3 Lecciones del curso (solo con un código vigente)
create or replace function public.cap_contenido(p_codigo text)
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
  if not found or not r.vigente then
    raise exception 'El código no es válido o ya venció.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('orden', l.orden, 'titulo', l.titulo,
                                        'contenido', l.contenido, 'video_url', l.video_url)
                     order by l.orden)
    from public.cap_lecciones l where l.curso_id = r.curso_id
  ), '[]'::jsonb);
end;
$$;

-- 6.4 Preguntas SIN la respuesta correcta (solo con un código vigente)
create or replace function public.cap_preguntas(p_codigo text)
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
  if not found or not r.vigente then
    raise exception 'El código no es válido o ya venció.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', q.id, 'orden', q.orden,
                                        'enunciado', q.enunciado, 'opciones', q.opciones)
                     order by q.orden)
    from public.cap_preguntas q where q.curso_id = r.curso_id
  ), '[]'::jsonb);
end;
$$;

-- 6.5 Calificar la evaluación y, si aprueba, emitir el certificado de aprobación
create or replace function public.cap_evaluar(p_codigo text, p_cedula text, p_respuestas jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r           record;
  v_insc      public.cap_inscripciones;
  v_cert      uuid;
  v_intento   uuid;
  v_cedula    text := regexp_replace(coalesce(p_cedula, ''), '\s', '', 'g');
  v_total     int;
  v_correctas int;
  v_nota      numeric(5,2);
  v_aprobado  boolean;
begin
  select * into r from cap_privado.buscar_acceso(p_codigo);
  if not found then raise exception 'No encontramos ese código.'; end if;

  select id into v_cert from public.cap_certificados
  where convocatoria_id = r.convocatoria_id and cedula = v_cedula;
  if found then
    return jsonb_build_object('aprobado', true, 'ya_emitido', true,
                              'certificado', cap_privado.certificado_json(v_cert));
  end if;

  if not r.vigente then raise exception '%', r.motivo; end if;
  if not r.requiere_evaluacion then raise exception 'Este código no requiere evaluación.'; end if;
  if jsonb_typeof(p_respuestas) is distinct from 'object' then
    raise exception 'Las respuestas no tienen un formato válido.';
  end if;

  select * into v_insc from public.cap_inscripciones
  where convocatoria_id = r.convocatoria_id and cedula = v_cedula;
  if not found then raise exception 'Primero debes registrarte con este código.'; end if;

  if (select count(*) from public.cap_intentos
      where inscripcion_id = v_insc.id and creado_en > now() - interval '24 hours') >= 3 then
    raise exception 'Alcanzaste el máximo de 3 intentos en 24 horas. Vuelve a intentarlo mañana.';
  end if;

  select count(*),
         count(*) filter (where (p_respuestas ->> q.id::text) = q.respuesta_correcta::text)
    into v_total, v_correctas
  from public.cap_preguntas q where q.curso_id = r.curso_id;

  if v_total = 0 then raise exception 'La evaluación de este curso todavía no está lista.'; end if;

  v_nota     := round(v_correctas * 100.0 / v_total, 2);
  v_aprobado := v_nota >= r.nota_minima;

  insert into public.cap_intentos
    (curso_id, cedula, nombres, correo, empresa, acepta_privacidad, nota, aprobado, inscripcion_id, convocatoria_id)
  values
    (r.curso_id, v_insc.cedula, v_insc.nombres, v_insc.correo, r.empresa, true, v_nota, v_aprobado, v_insc.id, r.convocatoria_id)
  returning id into v_intento;

  if v_aprobado then
    v_cert := cap_privado.emitir_certificado(v_insc, r.curso_id, r.empresa, r.horas, 'aprobacion', v_nota, v_intento);
    return jsonb_build_object('aprobado', true, 'ya_emitido', false, 'nota', v_nota,
                              'correctas', v_correctas, 'total', v_total,
                              'certificado', cap_privado.certificado_json(v_cert));
  end if;

  return jsonb_build_object('aprobado', false, 'nota', v_nota, 'nota_minima', r.nota_minima,
                            'correctas', v_correctas, 'total', v_total);
end;
$$;

-- 6.6 Verificación pública (actualizada: tipo, modalidad y horas)
create or replace function public.cap_verificar_certificado(p_codigo text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'valido', true,
    'codigo', c.codigo,
    'nombres', c.nombres,
    'cedula', repeat('*', greatest(length(c.cedula) - 4, 0)) || right(c.cedula, 4),
    'empresa', c.empresa,
    'curso', k.titulo,
    'horas', coalesce(c.horas, k.horas),
    'nota', c.nota,
    'tipo', c.tipo,
    'modalidad', c.modalidad,
    'emitido_en', c.emitido_en
  )
  from public.cap_certificados c
  join public.cap_cursos k on k.id = c.curso_id
  where c.codigo = upper(btrim(p_codigo));
$$;


-- =====================================================================
-- 7. PERMISOS: la web solo puede ejecutar estas funciones
-- =====================================================================
revoke all on all functions in schema cap_privado from public, anon, authenticated;

revoke all on function public.cap_validar_acceso(text) from public;
revoke all on function public.cap_inscribir(text, text, text, text, boolean) from public;
revoke all on function public.cap_contenido(text) from public;
revoke all on function public.cap_preguntas(text) from public;
revoke all on function public.cap_evaluar(text, text, jsonb) from public;
revoke all on function public.cap_verificar_certificado(text) from public;

grant execute on function public.cap_validar_acceso(text) to anon, authenticated;
grant execute on function public.cap_inscribir(text, text, text, text, boolean) to anon, authenticated;
grant execute on function public.cap_contenido(text) to anon, authenticated;
grant execute on function public.cap_preguntas(text) to anon, authenticated;
grant execute on function public.cap_evaluar(text, text, jsonb) to anon, authenticated;
grant execute on function public.cap_verificar_certificado(text) to anon, authenticated;
