-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 16 · APARIENCIA DEL SITIO
-- Ejecutar en el proyecto nexus-learning, DESPUÉS de los archivos 1 a 15.
-- Es seguro ejecutarlo más de una vez. No borra datos.
--
-- Una sola fila (id = 1) con los colores, la foto y los textos del
-- banner. La lee todo el público (no es información sensible) y solo
-- el ADMINISTRADOR la cambia, desde la página "Apariencia".
-- La foto del banner se guarda en el espacio "portadas" (archivo 14),
-- en la carpeta "sitio/".
-- Campo vacío = se usa el valor original del diseño.
-- =====================================================================

create table if not exists public.cap_apariencia (
  id               int primary key default 1 check (id = 1),
  color_principal  text check (color_principal is null or color_principal ~ '^#[0-9A-Fa-f]{6}$'),
  color_acento     text check (color_acento    is null or color_acento    ~ '^#[0-9A-Fa-f]{6}$'),
  color_fondo      text check (color_fondo     is null or color_fondo     ~ '^#[0-9A-Fa-f]{6}$'),
  banner_imagen    text,
  banner_etiqueta  text check (banner_etiqueta is null or length(banner_etiqueta) <= 80),
  banner_titulo    text check (banner_titulo   is null or length(banner_titulo)   <= 90),
  banner_texto     text check (banner_texto    is null or length(banner_texto)    <= 220),
  actualizado_en   timestamptz not null default now()
);

insert into public.cap_apariencia (id) values (1) on conflict (id) do nothing;

alter table public.cap_apariencia enable row level security;

drop policy if exists "cap_apariencia_lectura" on public.cap_apariencia;
create policy "cap_apariencia_lectura" on public.cap_apariencia for select
  to anon, authenticated using (true);

drop policy if exists "cap_apariencia_admin" on public.cap_apariencia;
create policy "cap_apariencia_admin" on public.cap_apariencia for update
  to authenticated
  using (cap_privado.es_admin()) with check (cap_privado.es_admin());

grant select on public.cap_apariencia to anon, authenticated;
grant update on public.cap_apariencia to authenticated;
