-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 47 · DESCARGAR CERTIFICADOS EN LOTE
-- Ejecutar en Supabase de NEXUS LEARNING → SQL Editor (después del 46).
-- Es seguro ejecutarlo más de una vez. No borra datos.
--
-- El administrador obtiene los datos de varios certificados a la vez
-- (los mismos que ve el participante) para descargarlos en un ZIP o en
-- un solo PDF desde la nómina o desde «Buscar trabajador».
-- =====================================================================

create or replace function public.cap_certificados_admin(p_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not cap_privado.es_admin() then
    raise exception 'Solo un administrador puede descargar certificados en lote.';
  end if;
  return coalesce((
    select jsonb_agg(cap_privado.certificado_json(c.id)
             || jsonb_build_object('alianza', coalesce(v.alianza_vitalwork, false)) order by c.nombres)
    from public.cap_certificados c
    left join public.cap_convocatorias v on v.id = c.convocatoria_id
    where c.id = any(p_ids)
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.cap_certificados_admin(uuid[]) from public, anon;
grant execute on function public.cap_certificados_admin(uuid[]) to authenticated;
