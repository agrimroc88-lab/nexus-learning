-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 40 · «YA ESTOY REGISTRADO» → UNIRSE
-- Ejecutar en Supabase de NEXUS LEARNING → SQL Editor, después del 39.
-- Es seguro ejecutarlo más de una vez. No borra ni cambia datos.
--
-- Quien ya se registró en el MISMO TEMA (mismo curso y misma empresa,
-- en esta convocatoria o en otro grupo/encuentro) no vuelve a llenar el
-- formulario: con su cédula aparece «Unirse». Así no queda duplicado
-- en la nómina de todos los grupos.
-- =====================================================================

create or replace function public.cap_ya_registrado(p_codigo text, p_cedula text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r          record;
  v_empresa  uuid;
  v_cedula   text := regexp_replace(coalesce(p_cedula, ''), '\s', '', 'g');
  v_insc     public.cap_inscripciones;
  v_cert     uuid;
  v_codigo   text;
  v_res      jsonb;
begin
  if length(v_cedula) < 5 then return jsonb_build_object('encontrado', false); end if;

  select * into r from cap_privado.buscar_acceso(p_codigo);
  if not found then return jsonb_build_object('encontrado', false); end if;

  select empresa_id into v_empresa from public.cap_convocatorias where id = r.convocatoria_id;

  -- Primero en esta misma convocatoria; si no, en otro grupo del mismo tema (el más reciente)
  select i.* into v_insc
  from public.cap_inscripciones i
  join public.cap_convocatorias c on c.id = i.convocatoria_id
  where i.cedula = v_cedula and c.empresa_id = v_empresa and c.curso_id = r.curso_id
  order by (i.convocatoria_id = r.convocatoria_id) desc, i.creado_en desc
  limit 1;
  if not found then return jsonb_build_object('encontrado', false); end if;

  -- ¿Ya tiene certificado del tema?
  select ct.id into v_cert
  from public.cap_certificados ct
  join public.cap_convocatorias c on c.id = ct.convocatoria_id
  where ct.cedula = v_cedula and c.empresa_id = v_empresa and c.curso_id = r.curso_id
  order by (ct.convocatoria_id = r.convocatoria_id) desc
  limit 1;

  if v_insc.convocatoria_id = r.convocatoria_id then
    if v_cert is not null then
      return jsonb_build_object('encontrado', true, 'misma', true, 'nombres', v_insc.nombres,
        'estado', 'certificado', 'certificado', cap_privado.certificado_json(v_cert));
    end if;
    -- Misma convocatoria sin certificado: se retoma con los datos que ya dio
    if r.vigente and v_insc.sexo is not null and v_insc.fecha_nacimiento is not null and v_insc.etnia is not null then
      begin
        v_res := public.cap_inscribir(p_codigo, v_cedula, v_insc.nombres, v_insc.correo, true,
                                      v_insc.sexo, v_insc.fecha_nacimiento, v_insc.etnia);
        return v_res || jsonb_build_object('encontrado', true, 'misma', true, 'nombres', v_insc.nombres);
      exception when others then null;
      end;
    end if;
    return jsonb_build_object('encontrado', true, 'misma', true, 'nombres', v_insc.nombres,
      'estado', case when r.requiere_evaluacion then 'evaluacion' else 'registrado' end);
  end if;

  -- Registrado en otro grupo del mismo tema: no se duplica la inscripción
  select a.codigo into v_codigo
  from public.cap_accesos a
  where a.convocatoria_id = v_insc.convocatoria_id and not a.anulado
    and now() between a.valido_desde and a.valido_hasta
  order by (a.tipo = r.tipo) desc, a.valido_hasta desc
  limit 1;

  return jsonb_build_object('encontrado', true, 'misma', false, 'nombres', v_insc.nombres,
    'estado', case when v_cert is not null then 'certificado' else 'otro_grupo' end,
    'certificado', case when v_cert is not null then cap_privado.certificado_json(v_cert) end,
    'codigo_original', v_codigo);
end;
$$;

revoke all on function public.cap_ya_registrado(text, text) from public;
grant execute on function public.cap_ya_registrado(text, text) to anon, authenticated;
