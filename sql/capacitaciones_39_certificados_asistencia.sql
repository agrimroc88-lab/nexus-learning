-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 39 · CERTIFICADOS DE ASISTENCIA MANUALES
-- Ejecutar en Supabase de NEXUS LEARNING → SQL Editor, después del 38.
-- Es seguro ejecutarlo más de una vez. No borra datos.
--
-- Quien aprobó la evaluación ya tiene su certificado de aprobación.
-- Para quien se registró pero no rindió la prueba o no la aprobó, el
-- administrador emite (desde la nómina) el certificado de ASISTENCIA.
-- Quien ya tiene certificado no recibe otro.
-- =====================================================================

create or replace function public.cap_emitir_asistencia(p_inscripciones uuid[])
returns integer
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_insc public.cap_inscripciones;
  v_conv public.cap_convocatorias;
  v_curso public.cap_cursos;
  v_empresa text;
  v_total integer := 0;
begin
  if not cap_privado.es_admin() then
    raise exception 'Solo un administrador puede emitir certificados de asistencia.';
  end if;

  for v_insc in
    select i.* from public.cap_inscripciones i
    where i.id = any (coalesce(p_inscripciones, '{}'))
      and not exists (
        select 1 from public.cap_certificados c
        where c.inscripcion_id = i.id
           or (c.convocatoria_id = i.convocatoria_id and c.cedula = i.cedula))
  loop
    select * into v_conv from public.cap_convocatorias where id = v_insc.convocatoria_id;
    select * into v_curso from public.cap_cursos where id = v_conv.curso_id;
    select nombre into v_empresa from public.cap_empresas where id = v_conv.empresa_id;
    perform cap_privado.emitir_certificado(
      v_insc, v_curso.id, v_empresa, coalesce(v_conv.horas, v_curso.horas), 'asistencia', null, null);
    v_total := v_total + 1;
  end loop;
  return v_total;
end;
$$;

revoke all on function public.cap_emitir_asistencia(uuid[]) from public, anon;
grant execute on function public.cap_emitir_asistencia(uuid[]) to authenticated;
