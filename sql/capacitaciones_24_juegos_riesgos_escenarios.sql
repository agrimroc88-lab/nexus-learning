-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 24 · JUEGOS NUEVOS:
--   "Caza de riesgos" (tocar los peligros sobre una foto) y
--   "¿Qué harías?" (situaciones con varias respuestas)
-- Ejecutar en el proyecto nexus-learning, DESPUÉS del archivo 23.
-- Es seguro ejecutarlo más de una vez. No borra datos.
--
-- Las fotos de "Caza de riesgos" se guardan en el depósito "portadas"
-- (carpeta juegos/), que ya existe desde el archivo 14: solo el
-- administrador sube fotos y cualquiera puede verlas.
-- =====================================================================

-- 1. Nuevos tipos de juego
alter table public.cap_juegos drop constraint if exists cap_juegos_tipo_check;
alter table public.cap_juegos add constraint cap_juegos_tipo_check
  check (tipo in ('numeros', 'clasificar', 'ordenar', 'riesgos', 'escenarios'));

-- 2. Ejemplo de "¿Qué harías?" (solo si aún no hay uno)
insert into public.cap_juegos (tipo, titulo, config)
select 'escenarios', '¿Qué harías? Situaciones en el trabajo', $j${
  "instruccion": "Lee cada situación y elige lo que harías. Después verás por qué.",
  "escenarios": [
    {
      "situacion": "Ves a un compañero usando una escalera con un peldaño roto.",
      "opciones": [
        {"texto": "Le pido que se baje con cuidado y reporto la escalera para que la retiren.", "correcta": true, "explicacion": "Detener el trabajo inseguro y reportar el equipo dañado evita una caída."},
        {"texto": "No digo nada, él tiene experiencia.", "correcta": false, "explicacion": "La experiencia no evita que un peldaño roto ceda. Callar también es un acto inseguro."},
        {"texto": "Le sostengo la escalera para que termine rápido.", "correcta": false, "explicacion": "Sostenerla no corrige el peligro: la escalera dañada no debe usarse."}
      ]
    },
    {
      "situacion": "Suena la alarma de evacuación mientras estás terminando un informe.",
      "opciones": [
        {"texto": "Guardo el archivo, apago la computadora y luego salgo.", "correcta": false, "explicacion": "Cada segundo cuenta: no te detengas por objetos ni por tareas."},
        {"texto": "Salgo de inmediato por la ruta señalizada hasta el punto de encuentro.", "correcta": true, "explicacion": "Así se evacúa: sin correr, sin regresar, por la ruta de evacuación."},
        {"texto": "Espero a ver si es un simulacro.", "correcta": false, "explicacion": "Toda alarma se atiende como real."}
      ]
    },
    {
      "situacion": "Te cae un líquido químico en los ojos.",
      "opciones": [
        {"texto": "Me froto los ojos con las manos.", "correcta": false, "explicacion": "Frotar extiende el químico y puede lesionar la córnea."},
        {"texto": "Voy al lavaojos y enjuago con agua abundante al menos 15 minutos; luego busco atención médica.", "correcta": true, "explicacion": "El enjuague inmediato y prolongado reduce el daño. Siempre se reporta y se busca atención."},
        {"texto": "Espero a que se pase la molestia.", "correcta": false, "explicacion": "Esperar aumenta la lesión: se actúa de inmediato."}
      ]
    }
  ]
}$j$::jsonb
where not exists (select 1 from public.cap_juegos where tipo = 'escenarios');
