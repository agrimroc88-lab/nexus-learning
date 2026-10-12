-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 2 DE 4 · SEGURIDAD (RLS)
-- Ejecutar DESPUÉS del archivo 1.
-- Es seguro ejecutarlo más de una vez.
--
-- Quién puede hacer qué:
--   · Público (anon): ver cursos y lecciones PUBLICADOS. Nada más.
--     Las preguntas, intentos y certificados solo se usan a través de
--     funciones seguras (archivo 3), nunca directamente.
--   · Personal con sesión iniciada (authenticated): administrar todo.
--     Más adelante se puede limitar a un rol de administrador.
-- =====================================================================

alter table public.cap_cursos       enable row level security;
alter table public.cap_lecciones    enable row level security;
alter table public.cap_preguntas    enable row level security;
alter table public.cap_intentos     enable row level security;
alter table public.cap_certificados enable row level security;

-- ---------- CURSOS ----------
drop policy if exists "cap_cursos_publico_lee_publicados" on public.cap_cursos;
create policy "cap_cursos_publico_lee_publicados"
  on public.cap_cursos for select
  to anon
  using (publicado = true);

drop policy if exists "cap_cursos_personal_administra" on public.cap_cursos;
create policy "cap_cursos_personal_administra"
  on public.cap_cursos for all
  to authenticated
  using (true) with check (true);

-- ---------- LECCIONES ----------
drop policy if exists "cap_lecciones_publico_lee_publicadas" on public.cap_lecciones;
create policy "cap_lecciones_publico_lee_publicadas"
  on public.cap_lecciones for select
  to anon
  using (exists (
    select 1 from public.cap_cursos c
    where c.id = cap_lecciones.curso_id and c.publicado = true
  ));

drop policy if exists "cap_lecciones_personal_administra" on public.cap_lecciones;
create policy "cap_lecciones_personal_administra"
  on public.cap_lecciones for all
  to authenticated
  using (true) with check (true);

-- ---------- PREGUNTAS ----------
-- Sin política para anon: el público NO puede leer esta tabla
-- (así no ve la respuesta correcta). Usa la función cap_obtener_preguntas.
drop policy if exists "cap_preguntas_personal_administra" on public.cap_preguntas;
create policy "cap_preguntas_personal_administra"
  on public.cap_preguntas for all
  to authenticated
  using (true) with check (true);

-- ---------- INTENTOS ----------
-- Solo el personal los consulta (reportes). Se registran vía función.
drop policy if exists "cap_intentos_personal_lee" on public.cap_intentos;
create policy "cap_intentos_personal_lee"
  on public.cap_intentos for select
  to authenticated
  using (true);

-- ---------- CERTIFICADOS ----------
-- Solo el personal los consulta y puede anularlos (borrar).
-- Se emiten únicamente vía función, así no se pueden falsificar.
drop policy if exists "cap_certificados_personal_lee" on public.cap_certificados;
create policy "cap_certificados_personal_lee"
  on public.cap_certificados for select
  to authenticated
  using (true);

drop policy if exists "cap_certificados_personal_anula" on public.cap_certificados;
create policy "cap_certificados_personal_anula"
  on public.cap_certificados for delete
  to authenticated
  using (true);
