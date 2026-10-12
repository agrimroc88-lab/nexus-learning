-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 4 DE 4 · CURSO INICIAL
-- Ejecutar DESPUÉS del archivo 3.
-- Crea el curso "Igualdad salarial entre mujeres y hombres" con
-- 5 lecciones y 8 preguntas. Si el curso ya existe, no hace nada.
-- =====================================================================

do $$
declare
  v_curso uuid;
begin
  if exists (select 1 from public.cap_cursos
             where titulo = 'Igualdad salarial entre mujeres y hombres') then
    raise notice 'El curso ya existe. No se insertó nada.';
    return;
  end if;

  insert into public.cap_cursos (titulo, descripcion, horas, nota_minima, publicado)
  values (
    'Igualdad salarial entre mujeres y hombres',
    'Principios de igual remuneración por trabajo de igual valor, brecha salarial y no discriminación, en el marco de la Ley Orgánica para la Igualdad Salarial entre Mujeres y Hombres y el Acuerdo Ministerial MDT-2025-006.',
    2, 70, true
  )
  returning id into v_curso;

  -- ---------------- LECCIONES ----------------
  insert into public.cap_lecciones (curso_id, orden, titulo, contenido) values
  (v_curso, 1, '¿Qué es la igualdad salarial?',
   'La igualdad salarial significa que a trabajo igual o de igual valor corresponde igual remuneración, sin importar si quien lo realiza es mujer u hombre.

No significa que todas las personas ganen lo mismo. Significa que las diferencias de salario deben responder a criterios objetivos y nunca al género.

Este principio está en la Constitución del Ecuador (art. 326, numeral 4), en el Código del Trabajo (art. 79) y en la Ley Orgánica para la Igualdad Salarial entre Mujeres y Hombres. El Acuerdo Ministerial MDT-2025-006, expedido por el Ministerio del Trabajo, reglamenta esa ley.'),

  (v_curso, 2, 'Trabajo de igual valor',
   'Dos puestos pueden tener nombres y funciones distintas y, aun así, tener el mismo valor para la organización.

Para compararlos se analizan cuatro factores:
- Conocimientos: formación y experiencia que exige el puesto.
- Responsabilidad: personas, recursos y decisiones a cargo.
- Esfuerzo: exigencia física y mental de las funciones.
- Condiciones de trabajo: entorno, riesgos y horarios.

Clave: se compara el valor del trabajo, no solo el nombre del cargo.'),

  (v_curso, 3, 'La brecha salarial',
   'La brecha salarial es la diferencia promedio entre lo que ganan los hombres y las mujeres.

Fórmula: Brecha % = (Promedio hombres − Promedio mujeres) ÷ Promedio hombres × 100.

Ejemplo: si los hombres ganan en promedio 800 dólares y las mujeres 720, la brecha es (800 − 720) ÷ 800 × 100 = 10 %.

Una brecha no significa automáticamente discriminación: hay que analizar su causa, comparando puestos equivalentes y revisando también bonos, comisiones y beneficios.'),

  (v_curso, 4, 'Igualdad de oportunidades y no discriminación',
   'Mujeres y hombres deben acceder en condiciones equitativas a empleo, capacitación, ascensos, cargos de liderazgo y beneficios.

Son ejemplos de discriminación:
- Decir que un cargo es "solo para hombres".
- Pagar menos por funciones equivalentes.
- Negar un ascenso por ser mujer.
- Excluir a una trabajadora embarazada de oportunidades profesionales.
- Asignar funciones según estereotipos de género.

Principio: las decisiones laborales se basan en criterios objetivos y profesionales.'),

  (v_curso, 5, 'Qué debe hacer la empresa',
   'Para cumplir y prevenir desigualdades, la empresa puede:
1. Hacer un diagnóstico de la nómina por cargo y sexo.
2. Describir y valorar los puestos con factores objetivos.
3. Documentar una política salarial con criterios para aumentos y ascensos.
4. Corregir las diferencias que no tengan justificación.
5. Revisar indicadores periódicamente y contar con un canal de denuncias.

Toda persona trabajadora puede reclamar ante la empresa o ante el Ministerio del Trabajo si considera que recibe un trato salarial discriminatorio.');

  -- ---------------- PREGUNTAS ----------------
  -- respuesta_correcta: 0 = primera opción, 1 = segunda, etc.
  insert into public.cap_preguntas (curso_id, orden, enunciado, opciones, respuesta_correcta) values
  (v_curso, 1, '¿Qué establece el principio de igualdad salarial?',
   '["Que todas las personas deben ganar exactamente lo mismo", "Igual remuneración por trabajo igual o de igual valor", "Que el salario depende solo de la antigüedad", "Que las mujeres deben ganar más que los hombres"]', 1),

  (v_curso, 2, '¿Qué factores se analizan para saber si dos puestos tienen igual valor?',
   '["El nombre del cargo y el área", "La edad y el estado civil", "Conocimientos, responsabilidad, esfuerzo y condiciones de trabajo", "El horario de entrada y salida"]', 2),

  (v_curso, 3, '¿Puede una empresa pagar salarios diferentes a dos personas?',
   '["Sí, si existe una razón objetiva y documentada", "No, nunca", "Sí, si una persona es mujer y la otra hombre", "Sí, si la gerencia así lo prefiere"]', 0),

  (v_curso, 4, 'Si los hombres ganan en promedio 800 dólares y las mujeres 720, ¿cuál es la brecha salarial?',
   '["8 %", "80 %", "12 %", "10 %"]', 3),

  (v_curso, 5, '¿Una brecha salarial significa automáticamente que hay discriminación?',
   '["Sí, siempre", "No; hay que analizar la causa de la diferencia", "Solo si es mayor al 5 %", "Solo en el sector público"]', 1),

  (v_curso, 6, '¿Cuál de estas situaciones es un ejemplo de discriminación?',
   '["Pagar más a quien tiene mayor responsabilidad comprobada", "Ofrecer capacitación a todo el personal", "Negar un ascenso a una trabajadora por ser mujer", "Usar una escala salarial documentada"]', 2),

  (v_curso, 7, '¿Qué entidad expidió el Acuerdo Ministerial MDT-2025-006?',
   '["El Ministerio del Trabajo", "La Asamblea Nacional", "El Servicio de Rentas Internas", "El IESS"]', 0),

  (v_curso, 8, 'Al comparar dos puestos, ¿qué es lo más importante?',
   '["Que tengan el mismo nombre", "El valor del trabajo, no solo el nombre del cargo", "Que estén en el mismo piso", "La antigüedad de la persona"]', 1);

  raise notice 'Curso creado correctamente con id: %', v_curso;
end $$;
