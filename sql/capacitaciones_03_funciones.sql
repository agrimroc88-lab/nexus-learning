-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 3 DE 4 · FUNCIONES SEGURAS
-- Ejecutar DESPUÉS del archivo 2.
-- Es seguro ejecutarlo más de una vez.
--
-- Estas funciones corren dentro de Supabase. La página web solo les
-- envía datos y recibe el resultado: la calificación y el código del
-- certificado nunca se generan en el navegador.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Entregar las preguntas SIN la respuesta correcta
-- ---------------------------------------------------------------------
create or replace function public.cap_obtener_preguntas(p_curso uuid)
returns table (id uuid, orden int, enunciado text, opciones jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select q.id, q.orden, q.enunciado, q.opciones
  from public.cap_preguntas q
  join public.cap_cursos c on c.id = q.curso_id
  where q.curso_id = p_curso
    and c.publicado = true
  order by q.orden;
$$;


-- ---------------------------------------------------------------------
-- 2. Calificar la evaluación y, si aprueba, emitir el certificado
--    p_respuestas llega así: {"id-de-pregunta": 2, "otro-id": 0, ...}
-- ---------------------------------------------------------------------
create or replace function public.cap_enviar_evaluacion(
  p_curso      uuid,
  p_cedula     text,
  p_nombres    text,
  p_correo     text,
  p_empresa    text,
  p_acepta     boolean,
  p_respuestas jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_curso      public.cap_cursos%rowtype;
  v_cert       public.cap_certificados%rowtype;
  v_cedula     text := regexp_replace(coalesce(p_cedula, ''), '\s', '', 'g');
  v_nombres    text := btrim(coalesce(p_nombres, ''));
  v_empresa    text := nullif(btrim(coalesce(p_empresa, '')), '');
  v_correo     text := nullif(btrim(coalesce(p_correo, '')), '');
  v_total      int;
  v_correctas  int;
  v_nota       numeric(5,2);
  v_aprobado   boolean;
  v_intento    uuid;
  v_codigo     text;
begin
  -- Validaciones
  select * into v_curso from public.cap_cursos where id = p_curso and publicado = true;
  if not found then
    raise exception 'El curso no existe o no está publicado.';
  end if;
  if coalesce(p_acepta, false) = false then
    raise exception 'Debe aceptar el aviso de privacidad para continuar.';
  end if;
  if length(v_cedula) < 5 or length(v_cedula) > 20 then
    raise exception 'Ingrese un número de cédula o pasaporte válido.';
  end if;
  if length(v_nombres) < 5 then
    raise exception 'Ingrese sus nombres y apellidos completos.';
  end if;
  if jsonb_typeof(p_respuestas) is distinct from 'object' then
    raise exception 'Las respuestas no tienen un formato válido.';
  end if;

  -- Si la persona ya aprobó este curso, devolver su certificado existente
  select * into v_cert
  from public.cap_certificados
  where curso_id = p_curso and cedula = v_cedula
  order by emitido_en
  limit 1;

  if found then
    return jsonb_build_object(
      'aprobado', true, 'ya_emitido', true,
      'nota', v_cert.nota, 'codigo', v_cert.codigo, 'nombres', v_cert.nombres,
      'empresa', v_cert.empresa, 'curso', v_curso.titulo, 'horas', v_curso.horas,
      'emitido_en', v_cert.emitido_en
    );
  end if;

  -- Máximo 3 intentos por persona y curso en 24 horas
  if (select count(*) from public.cap_intentos
      where curso_id = p_curso and cedula = v_cedula
        and creado_en > now() - interval '24 hours') >= 3 then
    raise exception 'Alcanzó el máximo de 3 intentos en 24 horas. Vuelva a intentarlo mañana.';
  end if;

  -- Calificar
  select count(*),
         count(*) filter (where (p_respuestas ->> q.id::text) = q.respuesta_correcta::text)
    into v_total, v_correctas
  from public.cap_preguntas q
  where q.curso_id = p_curso;

  if v_total = 0 then
    raise exception 'Este curso todavía no tiene preguntas de evaluación.';
  end if;

  v_nota     := round(v_correctas * 100.0 / v_total, 2);
  v_aprobado := v_nota >= v_curso.nota_minima;

  -- Registrar el intento
  insert into public.cap_intentos
    (curso_id, cedula, nombres, correo, empresa, acepta_privacidad, nota, aprobado)
  values
    (p_curso, v_cedula, v_nombres, v_correo, v_empresa, true, v_nota, v_aprobado)
  returning id into v_intento;

  -- Emitir certificado si aprobó
  if v_aprobado then
    v_codigo := 'VW-' || to_char(now(), 'YYYY') || '-' || upper(encode(gen_random_bytes(4), 'hex'));
    insert into public.cap_certificados
      (codigo, intento_id, curso_id, cedula, nombres, empresa, nota)
    values
      (v_codigo, v_intento, p_curso, v_cedula, v_nombres, v_empresa, v_nota)
    returning * into v_cert;
  end if;

  return jsonb_build_object(
    'aprobado', v_aprobado, 'ya_emitido', false,
    'nota', v_nota, 'nota_minima', v_curso.nota_minima,
    'correctas', v_correctas, 'total', v_total,
    'codigo', v_cert.codigo, 'nombres', v_nombres, 'empresa', v_empresa,
    'curso', v_curso.titulo, 'horas', v_curso.horas, 'emitido_en', v_cert.emitido_en
  );
end;
$$;


-- ---------------------------------------------------------------------
-- 3. Verificar un certificado por su código (página pública)
--    Devuelve la cédula parcialmente oculta. Si no existe, devuelve null.
-- ---------------------------------------------------------------------
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
    'horas', k.horas,
    'nota', c.nota,
    'emitido_en', c.emitido_en
  )
  from public.cap_certificados c
  join public.cap_cursos k on k.id = c.curso_id
  where c.codigo = upper(btrim(p_codigo));
$$;


-- ---------------------------------------------------------------------
-- Permisos: la web (anon) solo puede EJECUTAR estas tres funciones
-- ---------------------------------------------------------------------
revoke all on function public.cap_obtener_preguntas(uuid) from public;
revoke all on function public.cap_enviar_evaluacion(uuid, text, text, text, text, boolean, jsonb) from public;
revoke all on function public.cap_verificar_certificado(text) from public;

grant execute on function public.cap_obtener_preguntas(uuid) to anon, authenticated;
grant execute on function public.cap_enviar_evaluacion(uuid, text, text, text, text, boolean, jsonb) to anon, authenticated;
grant execute on function public.cap_verificar_certificado(text) to anon, authenticated;
