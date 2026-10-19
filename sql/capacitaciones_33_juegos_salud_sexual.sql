-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 33 · JUEGOS: SALUD SEXUAL Y REPRODUCTIVA
-- Ejecutar en Supabase de NEXUS LEARNING → SQL Editor, después del 28.
-- Es seguro ejecutarlo más de una vez: si el juego ya existe (mismo
-- título), no lo duplica. No borra datos.
--
-- Crea 2 juegos en la biblioteca "Juegos":
--   1. "¿Mito o realidad? Salud sexual"  (Contra reloj, botones REALIDAD / MITO)
--   2. "Ruleta de la salud"               (Ruleta por equipos)
-- Después: Cursos → Salud sexual y reproductiva → Lecciones → elige el
-- juego en la lección donde quieras jugarlo.
-- =====================================================================

-- 1. ¿Mito o realidad? (para abrir con energía)
insert into public.cap_juegos (tipo, titulo, config)
select 'reloj', '¿Mito o realidad? Salud sexual', $j${
  "instruccion": "Lee la frase y decide en equipo: ¿es REALIDAD o es MITO? ¡Antes de que se acabe el tiempo!",
  "segundos": 15,
  "etiqueta_verdadero": "REALIDAD",
  "etiqueta_falso": "MITO",
  "equipos": ["Equipo Azul", "Equipo Dorado"],
  "afirmaciones": [
    {"texto": "La salud sexual es solo no tener enfermedades.", "verdadero": false, "explicacion": "Es el bienestar físico, emocional, mental y social relacionado con la sexualidad, con respeto y seguridad."},
    {"texto": "La píldora anticonceptiva también protege contra el VIH.", "verdadero": false, "explicacion": "La píldora previene embarazos, pero no protege contra las ITS ni el VIH."},
    {"texto": "No todos los métodos anticonceptivos protegen contra las ITS.", "verdadero": true, "explicacion": "Solo los métodos de barrera, como el preservativo, reducen el riesgo de muchas ITS."},
    {"texto": "La doble protección es usar preservativo más otro método anticonceptivo.", "verdadero": true, "explicacion": "El preservativo reduce el riesgo de ITS y el otro método ayuda a prevenir embarazos."},
    {"texto": "Si no tengo síntomas, no puedo tener una ITS.", "verdadero": false, "explicacion": "Muchas ITS, como la clamidia, no presentan síntomas. Por eso son importantes las pruebas."},
    {"texto": "El VIH se transmite por dar la mano, abrazar o compartir la oficina.", "verdadero": false, "explicacion": "La convivencia diaria no transmite el VIH. Las personas con VIH merecen respeto y no discriminación."},
    {"texto": "VIH y sida son exactamente lo mismo.", "verdadero": false, "explicacion": "El VIH es el virus; el sida es una etapa avanzada de la infección cuando no se trata."},
    {"texto": "Indetectable = intransmisible: con tratamiento eficaz sostenido, el VIH no se transmite por vía sexual.", "verdadero": true, "explicacion": "Una carga viral indetectable mantenida con tratamiento impide la transmisión sexual."},
    {"texto": "Ante una posible exposición al VIH, se puede esperar a tener síntomas para consultar.", "verdadero": false, "explicacion": "Hay que buscar atención urgente: la PEP debe valorarse e iniciarse dentro de las primeras 72 horas."},
    {"texto": "La sífilis, la gonorrea y la clamidia son infecciones bacterianas.", "verdadero": true, "explicacion": "Se diagnostican con pruebas médicas y tienen tratamiento. ¡No se automedique!"},
    {"texto": "Si creo que tengo una ITS, lo mejor es tomar antibióticos que tenga en casa.", "verdadero": false, "explicacion": "La automedicación es peligrosa. Lo correcto es acudir a valoración y hacerse pruebas."},
    {"texto": "Existe una vacuna contra el VPH y otra contra la hepatitis B.", "verdadero": true, "explicacion": "Las dos vacunas ayudan a prevenir estas infecciones."},
    {"texto": "El cáncer de mama solo afecta a las mujeres.", "verdadero": false, "explicacion": "Es mucho más frecuente en mujeres, pero también puede afectar a hombres."},
    {"texto": "Un bulto nuevo en la mama o en la axila es una señal de alerta.", "verdadero": true, "explicacion": "Ante cualquier señal de alerta hay que consultar a un profesional de la salud."},
    {"texto": "El cáncer de próstata siempre da dolor desde el inicio.", "verdadero": false, "explicacion": "Puede no presentar síntomas en sus etapas iniciales. La consulta médica oportuna es clave."},
    {"texto": "Se recomienda lactancia materna exclusiva durante los primeros seis meses, cuando sea posible.", "verdadero": true, "explicacion": "Luego puede continuar con alimentación complementaria hasta los 2 años o más."},
    {"texto": "La sala de lactancia puede estar dentro del baño para ahorrar espacio.", "verdadero": false, "explicacion": "Debe ser un espacio privado, limpio e higiénico, con asiento cómodo y conservación segura de la leche."},
    {"texto": "La información de salud de un trabajador debe ser confidencial.", "verdadero": true, "explicacion": "Respetar la privacidad es un derecho y genera confianza en el equipo."}
  ]
}$j$::jsonb
where not exists (select 1 from public.cap_juegos where titulo = '¿Mito o realidad? Salud sexual');

-- 2. Ruleta de la salud (para cerrar compitiendo)
insert into public.cap_juegos (tipo, titulo, config)
select 'ruleta', 'Ruleta de la salud', $j${
  "instruccion": "Cada equipo gira la ruleta y responde en voz alta. ¡Gana el equipo con más aciertos!",
  "equipos": ["Equipo Azul", "Equipo Dorado"],
  "preguntas": [
    {"pregunta": "¿Qué abarca la salud reproductiva?", "respuesta": "El bienestar del sistema reproductivo: fertilidad, anticoncepción, embarazo y decisiones informadas."},
    {"pregunta": "Nombra dos derechos sexuales y reproductivos.", "respuesta": "Por ejemplo: información confiable, privacidad y confidencialidad, decisiones libres, acceso a servicios de salud, vida libre de violencia, no discriminación."},
    {"pregunta": "Nombra un método anticonceptivo de barrera.", "respuesta": "El preservativo externo o interno."},
    {"pregunta": "Nombra dos métodos anticonceptivos hormonales.", "respuesta": "Píldoras, inyecciones, implantes o parches."},
    {"pregunta": "¿Qué significa ITS?", "respuesta": "Infecciones de transmisión sexual."},
    {"pregunta": "Nombra tres infecciones de transmisión sexual.", "respuesta": "Por ejemplo: sífilis, gonorrea, clamidia, VIH, VPH, herpes genital, hepatitis B."},
    {"pregunta": "¿Qué significa VIH?", "respuesta": "Virus de la inmunodeficiencia humana."},
    {"pregunta": "¿Qué es la PEP y en cuánto tiempo debe iniciarse?", "respuesta": "La profilaxis posexposición al VIH: debe valorarse con urgencia e iniciarse dentro de las primeras 72 horas."},
    {"pregunta": "¿Qué órgano afecta principalmente la hepatitis B?", "respuesta": "El hígado. La vacunación ayuda a prevenirla."},
    {"pregunta": "¿Con qué infección se relaciona el cáncer de cuello uterino?", "respuesta": "Con una infección persistente por VPH de alto riesgo."},
    {"pregunta": "Nombra dos medidas para prevenir el cáncer de cuello uterino.", "respuesta": "Vacunación contra el VPH y tamizaje cervical (además del seguimiento oportuno)."},
    {"pregunta": "Nombra tres señales de alerta del cáncer de mama.", "respuesta": "Bulto nuevo en mama o axila, cambios de tamaño o forma, alteraciones de la piel, retracción del pezón o secreción con sangre."},
    {"pregunta": "Nombra dos factores de riesgo del cáncer de próstata.", "respuesta": "Edad avanzada y antecedentes familiares."},
    {"pregunta": "Nombra tres condiciones que debe tener una sala de lactancia.", "respuesta": "Privacidad, limpieza e higiene, asiento cómodo, superficie de apoyo, lavado de manos, conservación segura de la leche, acceso adecuado."},
    {"pregunta": "Nombra dos acciones de la empresa que favorecen la salud sexual y reproductiva.", "respuesta": "Educación preventiva, controles oportunos, respeto y privacidad de la información de salud, apoyo a la lactancia."},
    {"pregunta": "Menciona tres medidas para prevenir las ITS.", "respuesta": "Usar correctamente el preservativo, vacunarse contra VPH y hepatitis B, hacerse pruebas, no compartir agujas, no automedicarse y consultar a tiempo."}
  ]
}$j$::jsonb
where not exists (select 1 from public.cap_juegos where titulo = 'Ruleta de la salud');

-- 3. Verificación
select tipo, titulo,
       coalesce(jsonb_array_length(config->'preguntas'), jsonb_array_length(config->'afirmaciones')) as elementos
from public.cap_juegos
where titulo in ('¿Mito o realidad? Salud sexual', 'Ruleta de la salud');
