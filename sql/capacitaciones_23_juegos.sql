-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 23 · BIBLIOTECA DE JUEGOS
-- Ejecutar en el proyecto nexus-learning, DESPUÉS de los archivos 1 a 22.
-- Es seguro ejecutarlo más de una vez. No borra datos.
--
-- Qué agrega:
--   · cap_juegos: biblioteca de juegos reutilizables. Tipos:
--       numeros    → "Busca los números" (5S / orden y limpieza)
--       clasificar → tarjetas con dos opciones (ej.: acto o condición)
--       ordenar    → poner pasos en el orden correcto
--   · cap_lecciones.juego_id: una lección puede ser un juego de la
--     biblioteca (se elige al crear o editar la lección).
--   · cap_contenido(): ahora entrega el juego de cada lección.
--   · Tres juegos de ejemplo, listos para usar o editar.
--   Los juegos son de PRÁCTICA: no cambian la nota de la evaluación.
-- =====================================================================

create table if not exists public.cap_juegos (
  id         uuid primary key default gen_random_uuid(),
  tipo       text not null check (tipo in ('numeros', 'clasificar', 'ordenar')),
  titulo     text not null check (length(titulo) between 3 and 150),
  config     jsonb not null default '{}'::jsonb,
  creado_en  timestamptz not null default now()
);

alter table public.cap_lecciones
  add column if not exists juego_id uuid references public.cap_juegos(id) on delete restrict;
create index if not exists cap_lecciones_juego_idx on public.cap_lecciones (juego_id);

-- Seguridad: el administrador gestiona; los docentes pueden verlos para
-- agregarlos a sus programas. El público los recibe por cap_contenido().
alter table public.cap_juegos enable row level security;

drop policy if exists "cap_juegos_admin" on public.cap_juegos;
create policy "cap_juegos_admin" on public.cap_juegos for all to authenticated
  using (cap_privado.es_admin()) with check (cap_privado.es_admin());

drop policy if exists "cap_juegos_docente_ve" on public.cap_juegos;
create policy "cap_juegos_docente_ve" on public.cap_juegos for select to authenticated
  using (exists (select 1 from public.cap_docentes d
                 where d.user_id = (select auth.uid()) and d.activo));

grant select, insert, update, delete on public.cap_juegos to authenticated;


-- =====================================================================
-- CONTENIDO PARA PARTICIPANTES: ahora incluye el juego de cada lección
-- (reemplaza la versión del archivo 9)
-- =====================================================================
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
                                        'contenido', l.contenido, 'video_url', l.video_url,
                                        'archivo_pdf', l.archivo_pdf,
                                        'juego', case when j.id is null then null else
                                          jsonb_build_object('tipo', j.tipo, 'titulo', j.titulo, 'config', j.config) end)
                     order by l.orden)
    from public.cap_lecciones l
    left join public.cap_juegos j on j.id = l.juego_id
    where l.curso_id = r.curso_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.cap_contenido(text) from public;
grant execute on function public.cap_contenido(text) to anon, authenticated;


-- =====================================================================
-- JUEGOS DE EJEMPLO (solo se crean si la biblioteca está vacía)
-- =====================================================================
insert into public.cap_juegos (tipo, titulo, config)
select * from (values
  ('numeros', 'Busca los números (Orden y limpieza 5S)', jsonb_build_object(
     'instruccion', 'Toca los números en orden, del 1 al 30, lo más rápido que puedas. Jugarás 3 rondas.',
     'cantidad', 30, 'segundos', 60)),
  ('clasificar', '¿Acto o condición subestándar?', jsonb_build_object(
     'instruccion', 'Lee cada situación y elige si es un acto subestándar (lo que hace una persona) o una condición subestándar (cómo está el lugar, el equipo o el ambiente).',
     'opcion_a', 'Acto subestándar', 'opcion_b', 'Condición subestándar',
     'tarjetas', jsonb_build_array(
       jsonb_build_object('texto', 'Un trabajador realiza tareas en altura sin arnés.', 'respuesta', 'a', 'explicacion', 'Es una decisión de la persona: no usar el equipo de protección.'),
       jsonb_build_object('texto', 'El piso del pasillo está mojado y no tiene señalización.', 'respuesta', 'b', 'explicacion', 'Es el estado del lugar de trabajo.'),
       jsonb_build_object('texto', 'Un operario retira la guarda de la máquina para trabajar más rápido.', 'respuesta', 'a', 'explicacion', 'Retirar la guarda es una acción de la persona.'),
       jsonb_build_object('texto', 'Una máquina funciona sin su guarda de protección.', 'respuesta', 'b', 'explicacion', 'Es el estado del equipo, sin importar quién la retiró.'),
       jsonb_build_object('texto', 'Hay cables eléctricos pelados en la bodega.', 'respuesta', 'b', 'explicacion', 'Es una condición insegura de la instalación.'),
       jsonb_build_object('texto', 'Un trabajador levanta una carga pesada doblando la espalda.', 'respuesta', 'a', 'explicacion', 'Es la forma en que la persona hace la tarea.'),
       jsonb_build_object('texto', 'El extintor está tapado con cajas.', 'respuesta', 'b', 'explicacion', 'Es el estado del lugar: el equipo de emergencia no está accesible.'),
       jsonb_build_object('texto', 'Dos compañeros juegan y se empujan cerca de la maquinaria.', 'respuesta', 'a', 'explicacion', 'Es un comportamiento de las personas.'),
       jsonb_build_object('texto', 'La iluminación del área de trabajo es insuficiente.', 'respuesta', 'b', 'explicacion', 'Es una condición del ambiente de trabajo.'),
       jsonb_build_object('texto', 'Un trabajador usa una herramienta que sabe que está dañada.', 'respuesta', 'a', 'explicacion', 'Elegir usarla es un acto; la herramienta dañada, por sí sola, sería una condición.')
     ))),
  ('ordenar', 'Uso del extintor: ordena los pasos', jsonb_build_object(
     'instruccion', 'Toca los pasos en el orden correcto para usar un extintor portátil.',
     'pasos', jsonb_build_array(
       'Dar la alarma y verificar que tienes una salida segura detrás de ti',
       'Tirar del pasador de seguridad',
       'Apuntar la boquilla a la base del fuego',
       'Apretar la manija',
       'Barrer de lado a lado sobre la base del fuego'
     )))
) as v(tipo, titulo, config)
where not exists (select 1 from public.cap_juegos);
