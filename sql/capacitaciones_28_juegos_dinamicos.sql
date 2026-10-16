-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 28 · JUEGOS DINÁMICOS:
--   "Ruleta de preguntas" (por equipos), "Memoria de parejas" y
--   "Contra reloj" (verdadero o falso con cuenta regresiva).
-- Ejecutar en Supabase de NEXUS LEARNING → SQL Editor, después del 27.
-- Es seguro ejecutarlo más de una vez. No borra datos.
-- =====================================================================

-- 1. Nuevos tipos de juego
alter table public.cap_juegos drop constraint if exists cap_juegos_tipo_check;
alter table public.cap_juegos add constraint cap_juegos_tipo_check
  check (tipo in ('numeros', 'clasificar', 'ordenar', 'riesgos', 'escenarios', 'ruleta', 'memoria', 'reloj'));

-- 2. Ejemplos (solo si aún no existen)
insert into public.cap_juegos (tipo, titulo, config)
select 'ruleta', 'Ruleta de la seguridad', $j${
  "instruccion": "Cada equipo gira la ruleta y responde en voz alta. ¡Gana el equipo con más aciertos!",
  "equipos": ["Equipo Azul", "Equipo Dorado"],
  "preguntas": [
    {"pregunta": "¿Qué significa una señal de forma circular con borde y franja rojos?", "respuesta": "Prohibición: indica algo que no se debe hacer."},
    {"pregunta": "¿Qué indica una señal triangular amarilla con borde negro?", "respuesta": "Advertencia de un peligro."},
    {"pregunta": "¿Qué significa una señal circular azul?", "respuesta": "Obligación, por ejemplo usar casco o protector auditivo."},
    {"pregunta": "¿Qué indican las señales verdes?", "respuesta": "Condiciones seguras: salidas, rutas de evacuación y primeros auxilios."},
    {"pregunta": "¿A partir de qué altura se considera trabajo en altura?", "respuesta": "A partir de 1,80 m sobre el nivel del piso."},
    {"pregunta": "Nombra tres elementos del equipo de protección personal.", "respuesta": "Por ejemplo: casco, gafas, guantes, calzado de seguridad, protector auditivo."},
    {"pregunta": "¿Qué es un acto subestándar?", "respuesta": "Una acción insegura de la persona, como no usar el EPP o retirar una guarda."},
    {"pregunta": "¿Qué es una condición subestándar?", "respuesta": "Una situación insegura del entorno, como un piso mojado o un cable pelado."},
    {"pregunta": "¿Qué debes hacer primero al escuchar la alarma de evacuación?", "respuesta": "Dejar lo que estás haciendo y salir por la ruta señalizada al punto de encuentro."},
    {"pregunta": "¿Qué tipo de extintor sirve para fuegos de papel, madera y tela?", "respuesta": "Clase A, por ejemplo de polvo químico seco ABC o agua."},
    {"pregunta": "¿Por qué no se usa agua en un fuego eléctrico?", "respuesta": "Porque el agua conduce la electricidad y puede electrocutar a quien la usa."},
    {"pregunta": "¿Qué debes hacer si ves un incidente sin heridos?", "respuesta": "Reportarlo: los incidentes avisan de un accidente que puede ocurrir."}
  ]
}$j$::jsonb
where not exists (select 1 from public.cap_juegos where tipo = 'ruleta');

insert into public.cap_juegos (tipo, titulo, config)
select 'memoria', 'Memoria: peligro y protección', $j${
  "instruccion": "Voltea dos cartas por turno y une cada peligro con su protección.",
  "equipos": ["Equipo Azul", "Equipo Dorado"],
  "pares": [
    {"a": "Ruido fuerte", "b": "Protector auditivo"},
    {"a": "Caída de objetos", "b": "Casco de seguridad"},
    {"a": "Partículas en los ojos", "b": "Gafas de seguridad"},
    {"a": "Trabajo en altura", "b": "Arnés y línea de vida"},
    {"a": "Polvo en el aire", "b": "Mascarilla o respirador"},
    {"a": "Objetos cortantes", "b": "Guantes anticorte"},
    {"a": "Objetos pesados sobre el pie", "b": "Calzado con puntera"},
    {"a": "Químicos que salpican", "b": "Careta y guantes químicos"}
  ]
}$j$::jsonb
where not exists (select 1 from public.cap_juegos where tipo = 'memoria');

insert into public.cap_juegos (tipo, titulo, config)
select 'reloj', 'Contra reloj: mitos de seguridad', $j${
  "instruccion": "¿Verdadero o falso? Responde antes de que se acabe el tiempo.",
  "segundos": 10,
  "afirmaciones": [
    {"texto": "Si tengo experiencia, puedo trabajar sin el equipo de protección.", "verdadero": false, "explicacion": "La experiencia no reemplaza al EPP: los accidentes también les ocurren a los expertos."},
    {"texto": "Un incidente sin heridos también se debe reportar.", "verdadero": true, "explicacion": "Reportarlo permite corregir la causa antes de que haya un accidente."},
    {"texto": "En un fuego eléctrico se puede usar agua.", "verdadero": false, "explicacion": "El agua conduce la electricidad. Primero se corta la energía y se usa un extintor adecuado."},
    {"texto": "Para levantar una carga se doblan las rodillas y se mantiene la espalda recta.", "verdadero": true, "explicacion": "Así la fuerza la hacen las piernas y se protege la columna."},
    {"texto": "En una evacuación hay que usar el ascensor para salir más rápido.", "verdadero": false, "explicacion": "El ascensor puede quedarse atrapado o llevarte al fuego. Se usan las escaleras."},
    {"texto": "Retirar la guarda de una máquina para trabajar más rápido es un acto subestándar.", "verdadero": true, "explicacion": "La guarda protege de atrapamientos y cortes; quitarla es una acción insegura."},
    {"texto": "El casco se puede usar con la visera hacia atrás sin problema.", "verdadero": false, "explicacion": "Se usa como indica el fabricante; si no, el arnés interno deja de proteger bien."},
    {"texto": "Un piso mojado sin señalizar es una condición subestándar.", "verdadero": true, "explicacion": "Es una situación insegura del entorno: se debe secar y señalizar."},
    {"texto": "Los primeros auxilios reemplazan la atención médica.", "verdadero": false, "explicacion": "Son la atención inmediata mientras llega la ayuda profesional."},
    {"texto": "Las pausas activas ayudan a prevenir lesiones musculares.", "verdadero": true, "explicacion": "Estirar y cambiar de postura reduce la fatiga y las molestias."}
  ]
}$j$::jsonb
where not exists (select 1 from public.cap_juegos where tipo = 'reloj');

-- 3. Verificación
select tipo, titulo,
       coalesce(jsonb_array_length(config->'preguntas'), jsonb_array_length(config->'pares'), jsonb_array_length(config->'afirmaciones')) as elementos
from public.cap_juegos where tipo in ('ruleta', 'memoria', 'reloj') order by tipo;
