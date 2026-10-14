-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 19 · "MIS CERTIFICADOS" (ESTUDIANTES)
-- Ejecutar en el proyecto nexus-learning, DESPUÉS de los archivos 1 a 18.
-- Es seguro ejecutarlo más de una vez. No borra datos.
--
-- Qué agrega:
--   · cap_mis_certificados(cédula, fecha de nacimiento): devuelve todos
--     los certificados vigentes de la persona, para volver a descargarlos.
--     Comprueba la identidad con la fecha de nacimiento que la persona
--     escribió al registrarse en alguna capacitación.
--     Responde { ok: true, certificados: [...] } o { ok: false, mensaje }.
--   · Freno contra intentos repetidos: máximo 5 consultas fallidas por
--     cédula cada hora (tabla cap_consultas_certificados, sin acceso web).
-- =====================================================================

create table if not exists public.cap_consultas_certificados (
  id         bigint generated always as identity primary key,
  cedula     text not null,
  exito      boolean not null,
  creado_en  timestamptz not null default now()
);
create index if not exists cap_consultas_cert_idx on public.cap_consultas_certificados (cedula, creado_en);

-- Sin políticas: nadie la lee ni la escribe desde la web (solo la función)
alter table public.cap_consultas_certificados enable row level security;

create or replace function public.cap_mis_certificados(p_cedula text, p_nacimiento date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_cedula text := regexp_replace(coalesce(p_cedula, ''), '\s', '', 'g');
begin
  if length(v_cedula) < 5 or length(v_cedula) > 20 or p_nacimiento is null then
    raise exception 'Escribe tu cédula y tu fecha de nacimiento.';
  end if;

  if (select count(*) from public.cap_consultas_certificados
      where cedula = v_cedula and not exito and creado_en > now() - interval '1 hour') >= 5 then
    return jsonb_build_object('ok', false, 'mensaje', 'Demasiados intentos. Espera una hora e inténtalo de nuevo.');
  end if;

  -- La identidad se confirma con la fecha de nacimiento registrada.
  -- (Se responde sin "raise" para que el intento fallido quede guardado.)
  if not exists (select 1 from public.cap_inscripciones
                 where cedula = v_cedula and fecha_nacimiento = p_nacimiento) then
    insert into public.cap_consultas_certificados (cedula, exito) values (v_cedula, false);
    delete from public.cap_consultas_certificados where creado_en < now() - interval '7 days';
    return jsonb_build_object('ok', false, 'mensaje',
      'No encontramos certificados con esos datos. Revisa la cédula y la fecha de nacimiento que usaste al registrarte.');
  end if;

  insert into public.cap_consultas_certificados (cedula, exito) values (v_cedula, true);

  return jsonb_build_object('ok', true, 'certificados', coalesce((
    select jsonb_agg(cap_privado.certificado_json(c.id) order by c.emitido_en desc)
    from public.cap_certificados c
    where c.cedula = v_cedula
  ), '[]'::jsonb));
end;
$$;

revoke all on function public.cap_mis_certificados(text, date) from public;
grant execute on function public.cap_mis_certificados(text, date) to anon, authenticated;
