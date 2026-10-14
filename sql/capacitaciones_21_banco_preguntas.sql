-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 21 · BANCO DE PREGUNTAS AL AZAR
-- Ejecutar en el proyecto nexus-learning, DESPUÉS de los archivos 1 a 20.
-- Es seguro ejecutarlo más de una vez. No borra datos.
--
-- Qué cambia:
--   · cap_cursos.preguntas_por_evaluacion: cuántas preguntas recibe cada
--     estudiante, elegidas AL AZAR del banco del programa.
--     Vacío = todas (como hasta ahora).
--   · cap_preguntas(): entrega esa cantidad, al azar en cada intento.
--   · cap_evaluar(): califica solo las preguntas que recibió la persona
--     (deben ser exactamente esa cantidad y del mismo programa).
--   · Lo demás no cambia: la respuesta correcta nunca sale de la base,
--     al reprobar no se dice la nota y hay 3 intentos cada 24 horas.
-- =====================================================================

alter table public.cap_cursos add column if not exists preguntas_por_evaluacion int;
do $$ begin
  alter table public.cap_cursos add constraint cap_cursos_preguntas_por_eval
    check (preguntas_por_evaluacion is null or preguntas_por_evaluacion between 1 and 200);
exception when duplicate_object then null; end $$;


-- =====================================================================
-- 1. PREGUNTAS PARA EL ESTUDIANTE (sin la respuesta correcta)
-- =====================================================================
create or replace function public.cap_preguntas(p_codigo text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r      record;
  v_cant int;
begin
  select * into r from cap_privado.buscar_acceso(p_codigo);
  if not found or not r.vigente then
    raise exception 'El código no es válido o ya venció.';
  end if;
  select preguntas_por_evaluacion into v_cant from public.cap_cursos where id = r.curso_id;

  return coalesce((
    select jsonb_agg(jsonb_build_object('id', q.id, 'orden', q.orden,
                                        'enunciado', q.enunciado, 'opciones', q.opciones))
    from (
      select * from public.cap_preguntas
      where curso_id = r.curso_id
      order by case when v_cant is null then orden end, random()
      limit v_cant                      -- null = sin límite (todas)
    ) q
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.cap_preguntas(text) from public;
grant execute on function public.cap_preguntas(text) to anon, authenticated;


-- =====================================================================
-- 2. CALIFICAR (reemplaza la versión del archivo 7)
-- =====================================================================
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
  v_banco     int;
  v_cant      int;
  v_esperadas int;
  v_total     int;
  v_correctas int;
  v_nota      numeric(5,2);
  v_aprobado  boolean;
  v_usados    int;
  c_maximo    constant int := 3;
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

  select count(*) into v_usados from public.cap_intentos
  where inscripcion_id = v_insc.id and creado_en > now() - interval '24 hours';
  if v_usados >= c_maximo then
    raise exception 'Alcanzaste el máximo de % intentos en 24 horas. Vuelve a intentarlo mañana.', c_maximo;
  end if;

  select count(*) into v_banco from public.cap_preguntas where curso_id = r.curso_id;
  if v_banco = 0 then raise exception 'La evaluación de este curso todavía no está lista.'; end if;
  select preguntas_por_evaluacion into v_cant from public.cap_cursos where id = r.curso_id;
  v_esperadas := least(coalesce(v_cant, v_banco), v_banco);

  -- Solo cuentan las preguntas respondidas que son de este programa
  select count(*),
         count(*) filter (where (p_respuestas ->> q.id::text) = q.respuesta_correcta::text)
    into v_total, v_correctas
  from public.cap_preguntas q
  where q.curso_id = r.curso_id and p_respuestas ? q.id::text;

  if v_total <> v_esperadas then
    raise exception 'Responde todas las preguntas de la evaluación (% preguntas).', v_esperadas;
  end if;

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
                              'certificado', cap_privado.certificado_json(v_cert));
  end if;

  return jsonb_build_object('aprobado', false,
                            'nota_minima', r.nota_minima,
                            'intentos_restantes', c_maximo - (v_usados + 1));
end;
$$;

revoke all on function public.cap_evaluar(text, text, jsonb) from public;
grant execute on function public.cap_evaluar(text, text, jsonb) to anon, authenticated;
