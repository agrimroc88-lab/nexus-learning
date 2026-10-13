-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 8 · AJUSTE EN LA GENERACIÓN DE CÓDIGOS
-- Ejecutar DESPUÉS de los archivos 6 y 7.
-- Es seguro ejecutarlo más de una vez.
--
-- Qué corrige:
--   La función que genera los códigos (ej.: AND-7K4P9Q) usa el generador
--   de números aleatorios de Supabase. Cuando un administrador crea una
--   capacitación desde el panel, la función no tenía permiso para usarlo.
--   Ahora se ejecuta con los permisos del sistema, igual que las demás.
--   Nadie puede llamarla directamente: solo se activa al crear un código.
-- =====================================================================

alter function public.cap_antes_de_guardar_acceso() security definer;
alter function public.cap_antes_de_guardar_acceso() set search_path = public, extensions;

revoke all on function public.cap_antes_de_guardar_acceso() from public, anon, authenticated;
