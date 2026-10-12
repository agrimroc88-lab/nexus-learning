-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 7 · NO REVELAR RESULTADOS AL REPROBAR
-- Ejecutar DESPUÉS del archivo 6.
-- Es seguro ejecutarlo más de una vez.
--
-- Qué cambia:
--   Al reprobar, la base de datos ya NO devuelve la nota ni cuántas
--   respuestas fueron correctas. Solo indica que no aprobó y cuántos
--   intentos le quedan hoy. Así nadie puede deducir las respuestas
--   cambiando una opción en cada intento.
--   Al aprobar, sí devuelve la nota (aparece en el certificado).
--   Nunca se indica cuáles preguntas estaban bien o mal.
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

  select count(*),
         count(*) filter (where (p_respuestas ->> q.id::text) = q.respuesta_correcta::text)
    into v_total, v_correctas
  from public.cap_preguntas q where q.curso_id = r.curso_id;

  if v_total = 0 then raise exception 'La evaluación de este curso todavía no está lista.'; end if;

  v_nota     := round(v_correctas * 100.0 / v_total, 2);
  v_aprobado := v_nota >= r.nota_minima;

  -- La nota se guarda siempre (el administrador la ve en la nómina)
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

  -- Reprobó: sin nota ni conteo de aciertos
  return jsonb_build_object('aprobado', false,
                            'nota_minima', r.nota_minima,
                            'intentos_restantes', c_maximo - (v_usados + 1));
end;
$$;

revoke all on function public.cap_evaluar(text, text, jsonb) from public;
grant execute on function public.cap_evaluar(text, text, jsonb) to anon, authenticated;
