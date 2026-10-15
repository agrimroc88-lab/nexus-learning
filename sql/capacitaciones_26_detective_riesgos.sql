-- =====================================================================
-- MÓDULO CAPACITACIONES · ARCHIVO 26 · DETECTIVE DE RIESGOS
-- Ejecutar en el proyecto nexus-learning, DESPUÉS del archivo 25.
-- Es seguro ejecutarlo más de una vez: cada juego se crea solo si
-- todavía no existe uno con el mismo título. No borra datos.
--
-- Cinco juegos "Caza de riesgos" con ilustraciones (una por grupo):
-- el grupo toca cada peligro y decide si es un ACTO o una CONDICIÓN
-- subestándar. Las imágenes van en GitHub, carpeta img/juegos/
-- (riesgos-1.jpg … riesgos-5.jpg).
-- =====================================================================

insert into public.cap_juegos (tipo, titulo, config)
select 'riesgos', 'Detective de riesgos 1: planta de procesamiento', $j${
 "instruccion": "Busca los peligros en la imagen y tócalos. Al encontrar uno, decide si es un ACTO subestándar (lo que hace una persona) o una CONDICIÓN subestándar (cómo está el lugar, el equipo o el material).",
 "imagen": "img/juegos/riesgos-1.jpg",
 "peligros": [
  {
   "x": 8,
   "y": 9,
   "r": 4,
   "clase": "acto",
   "nombre": "Trabaja en altura sobre una escalera y manipula un equipo eléctrico",
   "explicacion": "Sube sin arnés ni ayudante y toca un equipo energizado: riesgo de caída y de choque eléctrico."
  },
  {
   "x": 35,
   "y": 10,
   "r": 6,
   "clase": "condicion",
   "nombre": "Ventana rota",
   "explicacion": "Los vidrios pueden caer y cortar. Hay que aislar el área y reemplazarla."
  },
  {
   "x": 63,
   "y": 4,
   "r": 4,
   "clase": "condicion",
   "nombre": "Equipo eléctrico colgando y chispeando",
   "explicacion": "Instalación eléctrica en mal estado: riesgo de incendio y electrocución."
  },
  {
   "x": 50,
   "y": 21,
   "r": 4,
   "clase": "acto",
   "nombre": "Sube la escalera con cajas que le tapan la vista",
   "explicacion": "No ve los escalones ni puede sujetarse del pasamanos."
  },
  {
   "x": 74.5,
   "y": 12,
   "r": 4,
   "clase": "condicion",
   "nombre": "Cajas apiladas al borde del entrepiso",
   "explicacion": "Apilamiento inestable en altura: pueden caer sobre las personas."
  },
  {
   "x": 2.5,
   "y": 34,
   "r": 3,
   "clase": "condicion",
   "nombre": "Pared agrietada",
   "explicacion": "Deterioro de la estructura del edificio."
  },
  {
   "x": 24,
   "y": 44,
   "r": 6,
   "clase": "acto",
   "nombre": "Circula con el montacargas y la carga elevada e inestable",
   "explicacion": "Llevar la carga alta reduce la estabilidad y la visibilidad."
  },
  {
   "x": 6,
   "y": 51,
   "r": 4,
   "clase": "condicion",
   "nombre": "Tanque volcado derramando líquido",
   "explicacion": "Derrame en el piso: riesgo de resbalón y contaminación."
  },
  {
   "x": 49.5,
   "y": 51,
   "r": 4,
   "clase": "acto",
   "nombre": "Fuma en el área de trabajo y lanza el cigarrillo",
   "explicacion": "Fumar donde está prohibido y lanzar colillas puede iniciar un incendio."
  },
  {
   "x": 33,
   "y": 60,
   "r": 4,
   "clase": "condicion",
   "nombre": "Mancha de aceite en el piso",
   "explicacion": "Piso resbaladizo: riesgo de caídas al mismo nivel."
  },
  {
   "x": 88,
   "y": 48,
   "r": 4,
   "clase": "acto",
   "nombre": "Carga demasiadas cajas y camina sobre el piso mojado",
   "explicacion": "Levanta más peso del debido sin ver por dónde camina."
  },
  {
   "x": 84,
   "y": 59,
   "r": 5,
   "clase": "condicion",
   "nombre": "Charco de agua con restos de pescado",
   "explicacion": "Piso mojado y resbaladizo en la zona de paso."
  },
  {
   "x": 77,
   "y": 39,
   "r": 3,
   "clase": "condicion",
   "nombre": "Gotera en el techo",
   "explicacion": "La filtración moja el piso y puede afectar las instalaciones eléctricas."
  },
  {
   "x": 82.5,
   "y": 40,
   "r": 3,
   "clase": "condicion",
   "nombre": "Extintor tirado en el piso",
   "explicacion": "Fuera de su lugar no estará disponible ni señalizado en una emergencia."
  },
  {
   "x": 93,
   "y": 25,
   "r": 4,
   "clase": "condicion",
   "nombre": "Botiquín abierto y desordenado",
   "explicacion": "Debe estar cerrado, completo y señalizado."
  },
  {
   "x": 18,
   "y": 77,
   "r": 5,
   "clase": "condicion",
   "nombre": "Cilindros en el pasillo",
   "explicacion": "Obstaculizan el paso y la evacuación."
  },
  {
   "x": 8.5,
   "y": 79,
   "r": 4,
   "clase": "acto",
   "nombre": "Transporta una pila de cajas que le tapa la vista",
   "explicacion": "Manipulación manual de cargas inadecuada."
  },
  {
   "x": 8,
   "y": 93,
   "r": 5,
   "clase": "condicion",
   "nombre": "Charco en la zona de paso",
   "explicacion": "Piso mojado sin señalizar."
  },
  {
   "x": 51,
   "y": 87,
   "r": 4,
   "clase": "acto",
   "nombre": "Se sienta mal en una silla con ruedas",
   "explicacion": "Postura insegura: puede caerse."
  },
  {
   "x": 36.3,
   "y": 69,
   "r": 3.5,
   "clase": "acto",
   "nombre": "Trabaja sin cofia",
   "explicacion": "No usa el equipo de protección e higiene requerido."
  }
 ]
}$j$::jsonb
where not exists (select 1 from public.cap_juegos where titulo = 'Detective de riesgos 1: planta de procesamiento');

insert into public.cap_juegos (tipo, titulo, config)
select 'riesgos', 'Detective de riesgos 2: muelle pesquero', $j${
 "instruccion": "Busca los peligros en la imagen y tócalos. Al encontrar uno, decide si es un ACTO subestándar (lo que hace una persona) o una CONDICIÓN subestándar (cómo está el lugar, el equipo o el material).",
 "imagen": "img/juegos/riesgos-2.jpg",
 "peligros": [
  {
   "x": 51,
   "y": 37,
   "r": 4,
   "clase": "acto",
   "nombre": "Se para debajo de una carga suspendida",
   "explicacion": "Nunca se debe estar bajo una carga izada: si cae, puede ser mortal."
  },
  {
   "x": 55,
   "y": 48,
   "r": 6,
   "clase": "acto",
   "nombre": "Conduce el montacargas con una carga que le tapa la visión",
   "explicacion": "No ve hacia adelante y la carga puede caer."
  },
  {
   "x": 67,
   "y": 68,
   "r": 4,
   "clase": "acto",
   "nombre": "Carga mal asegurada que cae del montacargas",
   "explicacion": "No se aseguró la carga ni se limitó su altura."
  },
  {
   "x": 69,
   "y": 27,
   "r": 4,
   "clase": "acto",
   "nombre": "Viaja sentado sobre la carretilla",
   "explicacion": "Los equipos de carga no son para transportar personas."
  },
  {
   "x": 92,
   "y": 29,
   "r": 6,
   "clase": "condicion",
   "nombre": "Desperdicios acumulados en el piso",
   "explicacion": "Restos de pescado y hielo: piso resbaladizo y foco de contaminación."
  },
  {
   "x": 92,
   "y": 45,
   "r": 6,
   "clase": "condicion",
   "nombre": "Charco de agua",
   "explicacion": "Piso mojado en la zona de tránsito."
  },
  {
   "x": 82,
   "y": 57,
   "r": 4,
   "clase": "acto",
   "nombre": "Carga demasiadas cajas",
   "explicacion": "Sobreesfuerzo y la carga le tapa la vista."
  },
  {
   "x": 91,
   "y": 64,
   "r": 6,
   "clase": "condicion",
   "nombre": "Pallets tirados en el piso",
   "explicacion": "Obstáculo en la zona de paso: riesgo de tropiezo."
  },
  {
   "x": 5,
   "y": 80,
   "r": 4,
   "clase": "acto",
   "nombre": "Fuma y lanza el cigarrillo",
   "explicacion": "Riesgo de incendio en una zona con derrames."
  },
  {
   "x": 17,
   "y": 82,
   "r": 6,
   "clase": "condicion",
   "nombre": "Derrame de aceite",
   "explicacion": "Piso resbaladizo y riesgo de incendio."
  },
  {
   "x": 31,
   "y": 88,
   "r": 5,
   "clase": "acto",
   "nombre": "Usa una herramienta eléctrica sin protección junto al derrame",
   "explicacion": "Riesgo de electrocución y de chispa sobre material inflamable."
  },
  {
   "x": 7,
   "y": 93,
   "r": 4,
   "clase": "condicion",
   "nombre": "Cajas apiladas inestables",
   "explicacion": "Pueden caer al menor golpe."
  },
  {
   "x": 43,
   "y": 79,
   "r": 5,
   "clase": "condicion",
   "nombre": "Cajas tiradas en el pasillo",
   "explicacion": "Obstáculos que provocan tropiezos."
  },
  {
   "x": 71,
   "y": 81,
   "r": 4,
   "clase": "acto",
   "nombre": "Corre en la zona mojada",
   "explicacion": "Correr sobre piso resbaladizo provoca caídas."
  },
  {
   "x": 89,
   "y": 93,
   "r": 4,
   "clase": "condicion",
   "nombre": "Manguera atravesada en el piso",
   "explicacion": "Riesgo de tropiezo."
  },
  {
   "x": 33,
   "y": 57,
   "r": 4,
   "clase": "acto",
   "nombre": "Persona sin equipo de protección en la zona de carga",
   "explicacion": "Ingresa a una zona de operación sin EPP ni autorización."
  },
  {
   "x": 60,
   "y": 92,
   "r": 6,
   "clase": "condicion",
   "nombre": "Redes amontonadas en el piso",
   "explicacion": "Obstaculizan el paso y pueden enredar los pies."
  }
 ]
}$j$::jsonb
where not exists (select 1 from public.cap_juegos where titulo = 'Detective de riesgos 2: muelle pesquero');

insert into public.cap_juegos (tipo, titulo, config)
select 'riesgos', 'Detective de riesgos 3: mercado y locales comerciales', $j${
 "instruccion": "Busca los peligros en la imagen y tócalos. Al encontrar uno, decide si es un ACTO subestándar (lo que hace una persona) o una CONDICIÓN subestándar (cómo está el lugar, el equipo o el material).",
 "imagen": "img/juegos/riesgos-3.jpg",
 "peligros": [
  {
   "x": 12,
   "y": 24,
   "r": 4,
   "clase": "acto",
   "nombre": "Perfora la pared sin verificar las instalaciones",
   "explicacion": "Puede tocar cables eléctricos ocultos y no usa protección visual."
  },
  {
   "x": 7,
   "y": 38,
   "r": 4,
   "clase": "condicion",
   "nombre": "Cable de la herramienta atravesado en el piso",
   "explicacion": "Riesgo de tropiezo y de daño al cable."
  },
  {
   "x": 38,
   "y": 13,
   "r": 4,
   "clase": "acto",
   "nombre": "Corta con el cuchillo hacia su mano",
   "explicacion": "Técnica de corte insegura y sin guante anticorte."
  },
  {
   "x": 30,
   "y": 37,
   "r": 5,
   "clase": "condicion",
   "nombre": "Charco de agua y botella en el piso",
   "explicacion": "Piso resbaladizo en la zona de paso."
  },
  {
   "x": 53,
   "y": 15,
   "r": 4,
   "clase": "acto",
   "nombre": "Sube a una escalera mal apoyada",
   "explicacion": "La escalera no está asegurada ni tiene quien la sostenga."
  },
  {
   "x": 70,
   "y": 8,
   "r": 4,
   "clase": "acto",
   "nombre": "Trabaja en el borde del techo sin arnés",
   "explicacion": "Riesgo de caída de altura."
  },
  {
   "x": 82,
   "y": 12,
   "r": 6,
   "clase": "condicion",
   "nombre": "Tablón suelto sobre el techo",
   "explicacion": "Puede caer sobre las personas que pasan."
  },
  {
   "x": 51,
   "y": 40,
   "r": 6,
   "clase": "acto",
   "nombre": "Conduce el montacargas con una carga que le tapa la visión",
   "explicacion": "Circula sin ver hacia adelante, entre peatones."
  },
  {
   "x": 66,
   "y": 40,
   "r": 4,
   "clase": "condicion",
   "nombre": "Tablas apoyadas sin asegurar",
   "explicacion": "Pueden caer sobre quien pase."
  },
  {
   "x": 86,
   "y": 39,
   "r": 4,
   "clase": "acto",
   "nombre": "Corta madera sin protección",
   "explicacion": "No usa guantes ni gafas y el material no está asegurado."
  },
  {
   "x": 25,
   "y": 51,
   "r": 4,
   "clase": "condicion",
   "nombre": "Cajas tiradas en el pasillo",
   "explicacion": "Obstáculos en la zona de circulación."
  },
  {
   "x": 13,
   "y": 52,
   "r": 4,
   "clase": "acto",
   "nombre": "Carga una caja que le tapa la vista",
   "explicacion": "Puede tropezar o chocar."
  },
  {
   "x": 58,
   "y": 64,
   "r": 6,
   "clase": "acto",
   "nombre": "Transportan un vidrio sin guantes ni equipo",
   "explicacion": "Riesgo de cortes graves si se rompe."
  },
  {
   "x": 58,
   "y": 83,
   "r": 4,
   "clase": "condicion",
   "nombre": "Fruta y caja caídas en el piso",
   "explicacion": "Riesgo de resbalón y tropiezo."
  },
  {
   "x": 28,
   "y": 82,
   "r": 4,
   "clase": "condicion",
   "nombre": "Escoba y balde en la zona de paso",
   "explicacion": "Herramientas fuera de su lugar."
  },
  {
   "x": 86,
   "y": 89,
   "r": 5,
   "clase": "acto",
   "nombre": "Pone los pies sobre el mostrador",
   "explicacion": "Postura insegura y descuido en el puesto de trabajo."
  },
  {
   "x": 34,
   "y": 93,
   "r": 4,
   "clase": "condicion",
   "nombre": "Cajas mal apiladas",
   "explicacion": "Apilamiento inestable."
  }
 ]
}$j$::jsonb
where not exists (select 1 from public.cap_juegos where titulo = 'Detective de riesgos 3: mercado y locales comerciales');

insert into public.cap_juegos (tipo, titulo, config)
select 'riesgos', 'Detective de riesgos 4: taller en remodelación', $j${
 "instruccion": "Busca los peligros en la imagen y tócalos. Al encontrar uno, decide si es un ACTO subestándar (lo que hace una persona) o una CONDICIÓN subestándar (cómo está el lugar, el equipo o el material).",
 "imagen": "img/juegos/riesgos-4.jpg",
 "peligros": [
  {
   "x": 15,
   "y": 18,
   "r": 4,
   "clase": "acto",
   "nombre": "Manipula un tablero eléctrico sentado sobre la baranda",
   "explicacion": "Riesgo de caída de altura y de choque eléctrico."
  },
  {
   "x": 55,
   "y": 13,
   "r": 6,
   "clase": "condicion",
   "nombre": "Ventana rota",
   "explicacion": "Vidrios que pueden caer y cortar."
  },
  {
   "x": 50,
   "y": 27,
   "r": 5,
   "clase": "acto",
   "nombre": "Barre sobre tablas sueltas al borde del entrepiso",
   "explicacion": "Superficie inestable y sin protección contra caídas."
  },
  {
   "x": 86,
   "y": 22,
   "r": 4,
   "clase": "acto",
   "nombre": "Limpia la ventana parado al borde sin arnés",
   "explicacion": "Riesgo de caída de altura."
  },
  {
   "x": 90,
   "y": 34,
   "r": 5,
   "clase": "condicion",
   "nombre": "Escalera tirada y derrame en el entrepiso",
   "explicacion": "Obstáculo y piso resbaladizo en altura."
  },
  {
   "x": 65,
   "y": 37,
   "r": 4,
   "clase": "condicion",
   "nombre": "Tanque derramando líquido desde el entrepiso",
   "explicacion": "Gotea sobre la zona de trabajo de abajo."
  },
  {
   "x": 77,
   "y": 40,
   "r": 4,
   "clase": "condicion",
   "nombre": "Caja al borde del entrepiso",
   "explicacion": "Puede caer sobre las personas."
  },
  {
   "x": 36,
   "y": 58,
   "r": 4,
   "clase": "acto",
   "nombre": "Sube la escalera cargando un bulto",
   "explicacion": "No tiene las manos libres para sujetarse."
  },
  {
   "x": 40,
   "y": 66,
   "r": 4,
   "clase": "acto",
   "nombre": "Levanta una caja doblando la espalda",
   "explicacion": "Postura incorrecta para levantar cargas."
  },
  {
   "x": 51,
   "y": 59,
   "r": 5,
   "clase": "condicion",
   "nombre": "Cajas apiladas inestables",
   "explicacion": "Pueden caer en cualquier momento."
  },
  {
   "x": 44,
   "y": 82,
   "r": 6,
   "clase": "condicion",
   "nombre": "Abertura en el piso sin proteger",
   "explicacion": "Riesgo de caída a distinto nivel."
  },
  {
   "x": 63,
   "y": 86,
   "r": 6,
   "clase": "condicion",
   "nombre": "Charco con una herramienta eléctrica y su cable",
   "explicacion": "Riesgo de electrocución."
  },
  {
   "x": 93,
   "y": 62,
   "r": 4,
   "clase": "acto",
   "nombre": "Corre con papeles en la mano",
   "explicacion": "Correr en el trabajo provoca resbalones y choques."
  },
  {
   "x": 89,
   "y": 86,
   "r": 5,
   "clase": "acto",
   "nombre": "Usa la sierra sin guarda ni gafas",
   "explicacion": "Las partículas y el disco expuesto pueden causar lesiones graves."
  },
  {
   "x": 19,
   "y": 86,
   "r": 5,
   "clase": "acto",
   "nombre": "Corta un tubo en el piso sin protección",
   "explicacion": "Postura insegura, sin guantes ni gafas."
  },
  {
   "x": 10,
   "y": 92,
   "r": 4,
   "clase": "condicion",
   "nombre": "Herramientas tiradas en el piso",
   "explicacion": "Riesgo de tropiezo."
  },
  {
   "x": 38,
   "y": 92,
   "r": 5,
   "clase": "condicion",
   "nombre": "Vidrios en el piso",
   "explicacion": "Riesgo de cortes y tropiezos."
  },
  {
   "x": 4,
   "y": 78,
   "r": 3,
   "clase": "condicion",
   "nombre": "Pared agrietada",
   "explicacion": "Daño en la estructura."
  },
  {
   "x": 55,
   "y": 69,
   "r": 3,
   "clase": "condicion",
   "nombre": "Recipiente volcado en el piso",
   "explicacion": "Derrame y obstáculo."
  }
 ]
}$j$::jsonb
where not exists (select 1 from public.cap_juegos where titulo = 'Detective de riesgos 4: taller en remodelación');

insert into public.cap_juegos (tipo, titulo, config)
select 'riesgos', 'Detective de riesgos 5: taller industrial', $j${
 "instruccion": "Busca los peligros en la imagen y tócalos. Al encontrar uno, decide si es un ACTO subestándar (lo que hace una persona) o una CONDICIÓN subestándar (cómo está el lugar, el equipo o el material).",
 "imagen": "img/juegos/riesgos-5.jpg",
 "peligros": [
  {
   "x": 20,
   "y": 13,
   "r": 4,
   "clase": "acto",
   "nombre": "Carga una caja que le tapa la vista",
   "explicacion": "No ve por dónde camina."
  },
  {
   "x": 17,
   "y": 28,
   "r": 5,
   "clase": "condicion",
   "nombre": "Cable eléctrico sobre un charco",
   "explicacion": "Riesgo de electrocución."
  },
  {
   "x": 31,
   "y": 18,
   "r": 4,
   "clase": "acto",
   "nombre": "Esmerila sin protección facial",
   "explicacion": "Las chispas y partículas pueden lesionar ojos y cara."
  },
  {
   "x": 37,
   "y": 40,
   "r": 5,
   "clase": "condicion",
   "nombre": "Carga suspendida sobre la zona de trabajo",
   "explicacion": "Si cae, puede golpear a los trabajadores."
  },
  {
   "x": 23,
   "y": 53,
   "r": 6,
   "clase": "acto",
   "nombre": "Conduce el montacargas con las horquillas elevadas",
   "explicacion": "Las horquillas deben ir abajo al circular."
  },
  {
   "x": 49,
   "y": 12,
   "r": 4,
   "clase": "acto",
   "nombre": "Manipula el tablero eléctrico sin protección",
   "explicacion": "Riesgo de choque eléctrico: requiere bloqueo y EPP."
  },
  {
   "x": 51,
   "y": 33,
   "r": 5,
   "clase": "condicion",
   "nombre": "Tablas tiradas en el piso",
   "explicacion": "Riesgo de tropiezo."
  },
  {
   "x": 59,
   "y": 37,
   "r": 4,
   "clase": "acto",
   "nombre": "Sube una escalera mal apoyada",
   "explicacion": "La escalera no está asegurada."
  },
  {
   "x": 88,
   "y": 10,
   "r": 5,
   "clase": "condicion",
   "nombre": "Horno emitiendo humo",
   "explicacion": "Falta de mantenimiento y extracción: riesgo de incendio e intoxicación."
  },
  {
   "x": 81,
   "y": 26,
   "r": 4,
   "clase": "acto",
   "nombre": "Trabaja junto al horno sin equipo de protección",
   "explicacion": "Riesgo de quemaduras."
  },
  {
   "x": 91,
   "y": 52,
   "r": 4,
   "clase": "acto",
   "nombre": "Usa el martillo neumático sin protección",
   "explicacion": "Sin protección auditiva ni visual."
  },
  {
   "x": 35,
   "y": 73,
   "r": 5,
   "clase": "condicion",
   "nombre": "Abertura en el piso sin protección",
   "explicacion": "Riesgo de caída a distinto nivel."
  },
  {
   "x": 8,
   "y": 86,
   "r": 4,
   "clase": "acto",
   "nombre": "Fuma y lanza el cigarrillo",
   "explicacion": "Cerca de material inflamable."
  },
  {
   "x": 20,
   "y": 85,
   "r": 5,
   "clase": "condicion",
   "nombre": "Tanque de material inflamable con fuego",
   "explicacion": "Riesgo de incendio y explosión."
  },
  {
   "x": 44,
   "y": 82,
   "r": 4,
   "clase": "acto",
   "nombre": "Usa la máquina sin guarda y con el cabello suelto",
   "explicacion": "Puede quedar atrapada por la máquina."
  },
  {
   "x": 74,
   "y": 76,
   "r": 6,
   "clase": "acto",
   "nombre": "Se arrastra sobre los vidrios",
   "explicacion": "Riesgo de cortes y de rotura del vidrio."
  },
  {
   "x": 88,
   "y": 93,
   "r": 3,
   "clase": "condicion",
   "nombre": "Botella rota en el piso",
   "explicacion": "Riesgo de cortes."
  },
  {
   "x": 51,
   "y": 57,
   "r": 3,
   "clase": "condicion",
   "nombre": "Herramientas tiradas en el piso",
   "explicacion": "Riesgo de tropiezo."
  }
 ]
}$j$::jsonb
where not exists (select 1 from public.cap_juegos where titulo = 'Detective de riesgos 5: taller industrial');


-- Verificación: deben aparecer los 5 juegos
select titulo, jsonb_array_length(config->'peligros') as peligros
from public.cap_juegos where titulo like 'Detective de riesgos%' order by titulo;
