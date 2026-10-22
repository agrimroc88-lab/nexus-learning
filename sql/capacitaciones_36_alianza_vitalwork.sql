-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 36 · CAPACITACIÓN EN ALIANZA CON VITALWORK
-- Ejecutar en Supabase de NEXUS LEARNING → SQL Editor, después del 35.
-- Es seguro ejecutarlo más de una vez. No borra datos.
--
-- En cada capacitación planificada se marca (o no) «En alianza con
-- VitalWork». Sus certificados salen con el logo de VitalWork y la
-- segunda firma de su representante (imágenes en la carpeta img).
-- =====================================================================

alter table public.cap_convocatorias
  add column if not exists alianza_vitalwork boolean not null default false;

-- ¿Este certificado es de una capacitación en alianza? (lo usa el PDF)
create or replace function public.cap_certificado_alianza(p_codigo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select v.alianza_vitalwork
    from public.cap_certificados c
    join public.cap_convocatorias v on v.id = c.convocatoria_id
    where upper(c.codigo) = upper(trim(coalesce(p_codigo, '')))
    limit 1), false);
$$;

revoke all on function public.cap_certificado_alianza(text) from public;
grant execute on function public.cap_certificado_alianza(text) to anon, authenticated;
