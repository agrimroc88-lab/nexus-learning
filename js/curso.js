// =====================================================================
// NEXUS ACADEMY · CAPACITACIÓN (acceso con código)
// Carpeta: js/curso.js
//
// Flujo: código → registro → (lecciones) → (evaluación) → certificado
// Todo lo importante (validar el código, calificar, emitir el
// certificado) lo hace Supabase. Esta página solo muestra y envía datos.
// =====================================================================

const st = {
  codigo: normalizarCodigo(new URLSearchParams(location.search).get("codigo")),
  acceso: null,        // datos del código: empresa, curso, tipo, etc.
  jornada: null,       // si la clave es de una jornada: sus capacitaciones del día
  persona: null,       // { cedula, nombres, correo }
  lecciones: [],
  vistas: new Set(),
  preguntas: []
};

const $ = (id) => document.getElementById(id);
const CLAVE_SESION = "nexus_" + st.codigo;

// ---------------------------------------------------------------------
// Inicio
// ---------------------------------------------------------------------
(async function iniciar() {
  if (!st.codigo) {
    mostrarCodigoInvalido("Esta dirección no tiene un código de capacitación.", false);
    return;
  }

  const { data, error } = await nexusDb.rpc("cap_validar_acceso", { p_codigo: st.codigo });
  if (error) {
    console.error(error);
    $("estado").classList.add("error");
    $("estado").textContent = "No se pudo revisar el código. Comprueba tu conexión a internet y recarga la página.";
    return;
  }
  if (!data || !data.valido) {
    const motivo = (data && data.motivo) || "Ese código no es válido.";
    // ¿Es la clave de una jornada (varias capacitaciones el mismo día)?
    if (/^No encontramos/.test(motivo)) {
      const j = await nexusDb.rpc("cap_jornada", { p_codigo: st.codigo });
      if (!j.error && j.data) {
        if (j.data.valido) return iniciarJornada(j.data);
        return mostrarCodigoInvalido(j.data.motivo, false);
      }
    }
    mostrarCodigoInvalido(motivo, !/^No encontramos/.test(motivo));
    return;
  }

  st.acceso = data;
  pintarCabecera();
  $("estado").hidden = true;
  $("curso").hidden = false;

  // Si la persona ya se registró con este código en esta pestaña, continuar
  const guardado = leerSesion() || leerRecordado();
  if (guardado && guardado.persona) {
    st.vistas = new Set(guardado.vistas || []);
    await registrar(guardado.persona, true);
  } else {
    mostrarRegistro();
  }
})();

function pintarCabecera() {
  const a = st.acceso;
  document.title = a.curso + " · Nexus Academy";
  $("curso-empresa").textContent = a.empresa;
  $("curso-titulo").textContent = a.curso;

  const partes = [a.tipo === "presencial" ? "Capacitación presencial" : "Curso virtual", formatearHoras(a.horas)];
  if (a.tipo === "virtual" && a.lecciones > 0) partes.push(a.lecciones + (a.lecciones === 1 ? " lección" : " lecciones"));
  partes.push(a.requiere_evaluacion ? "Con evaluación" : "Sin evaluación");
  $("curso-datos").textContent = partes.join(" · ");
  pintarPortadaCurso($("curso-portada"), a.curso_id, a.curso);
}

// Portada del curso: primero la de color; si el curso tiene imagen, se cambia
async function pintarPortadaCurso(caja, cursoId, titulo) {
  pintarPortada(caja, titulo, null);
  if (!cursoId) return;
  const { data } = await nexusDb.rpc("cap_portada", { p_curso: cursoId });
  if (data) pintarPortada(caja, titulo, nexusDb.storage.from("portadas").getPublicUrl(data).data.publicUrl);
}

// ---------------------------------------------------------------------
// Código no válido (y recuperación de certificado)
// ---------------------------------------------------------------------
function mostrarCodigoInvalido(motivo, permitirRecuperar) {
  $("estado").hidden = true;
  $("codigo-motivo").textContent = motivo;
  $("form-recuperar").hidden = !permitirRecuperar;
  $("bloque-codigo").hidden = false;
}

$("form-otro-codigo").addEventListener("submit", function (ev) {
  ev.preventDefault();
  const codigo = normalizarCodigo($("otro-codigo").value);
  if (codigo.length >= 4) location.href = "curso.html?codigo=" + encodeURIComponent(codigo);
});

$("form-recuperar").addEventListener("submit", async function (ev) {
  ev.preventDefault();
  const cedula = $("recuperar-cedula").value.replace(/\s/g, "");
  $("e-recuperar").textContent = "";
  if (cedula.length < 5) {
    $("e-recuperar").textContent = "Escribe tu número de cédula o pasaporte.";
    return;
  }
  const { data, error } = await nexusDb.rpc("cap_inscribir", {
    p_codigo: st.codigo, p_cedula: cedula, p_nombres: "", p_correo: "", p_acepta: false
  });
  if (!error && data && data.estado === "certificado") {
    $("bloque-codigo").hidden = true;
    $("curso").hidden = false;
    $("curso-titulo").textContent = data.certificado.curso;
    $("curso-empresa").textContent = data.certificado.empresa || "";
    $("curso-datos").textContent = "";
    mostrarCertificado(data.certificado, true);
  } else {
    $("e-recuperar").textContent = "No encontramos un certificado con esa cédula para este código.";
  }
});

// ---------------------------------------------------------------------
// Registro
// ---------------------------------------------------------------------
function mostrarRegistro() {
  const a = st.acceso;
  if (a.tipo === "presencial" && !a.requiere_evaluacion) {
    $("registro-titulo").textContent = "Obtén tu certificado de asistencia";
    $("registro-intro").textContent = "Escribe tus datos tal como deben aparecer en el certificado.";
    $("btn-registro").textContent = "Obtener mi certificado";
  } else if (a.tipo === "presencial") {
    $("registro-titulo").textContent = "Regístrate para rendir la evaluación";
    $("registro-intro").textContent = "Escribe tus datos tal como deben aparecer en el certificado. Luego responderás una evaluación corta.";
  } else {
    $("registro-titulo").textContent = "Regístrate para comenzar";
    $("registro-intro").textContent = "Escribe tus datos tal como deben aparecer en el certificado. Luego podrás estudiar las lecciones y rendir la evaluación.";
  }
  $("vista-registro").hidden = false;
}

$("form-registro").addEventListener("submit", async function (ev) {
  ev.preventDefault();
  const sexoMarcado = document.querySelector('input[name="p-sexo"]:checked');
  const persona = {
    nombres: $("p-nombres").value.trim().replace(/\s+/g, " "),
    cedula: $("p-cedula").value.replace(/\s/g, ""),
    correo: $("p-correo").value.trim(),
    sexo: sexoMarcado ? sexoMarcado.value : "",
    nacimiento: $("p-nacimiento").value,
    etnia: $("p-etnia").value
  };
  const acepta = $("p-acepta").checked;
  let valido = true;

  ["e-nombres", "e-cedula", "e-acepta", "e-sexo", "e-nacimiento", "e-etnia"].forEach(function (id) { $(id).textContent = ""; });
  $("error-registro").hidden = true;

  if (persona.nombres.length < 5) { $("e-nombres").textContent = "Escribe tus nombres y apellidos completos."; valido = false; }
  if (persona.cedula.length < 5) { $("e-cedula").textContent = "Escribe tu número de cédula o pasaporte."; valido = false; }
  if (!persona.sexo) { $("e-sexo").textContent = "Elige M o F."; valido = false; }
  const anio = Number((persona.nacimiento || "").slice(0, 4));
  if (!persona.nacimiento || anio < 1930 || anio > new Date().getFullYear() - 14) {
    $("e-nacimiento").textContent = "Escribe tu fecha de nacimiento."; valido = false;
  }
  if (!persona.etnia) { $("e-etnia").textContent = "Elige una opción (puedes elegir \"Prefiero no responder\")."; valido = false; }
  if (!acepta) { $("e-acepta").textContent = "Debes aceptar el tratamiento de datos para continuar."; valido = false; }
  if (!valido) return;

  if (st.jornada) await registrarJornada(persona, false);
  else await registrar(persona, false);
});

async function registrar(persona, silencioso) {
  const boton = $("btn-registro");
  boton.disabled = true;

  const { data, error } = await nexusDb.rpc("cap_inscribir", {
    p_codigo: st.codigo,
    p_cedula: persona.cedula,
    p_nombres: persona.nombres,
    p_correo: persona.correo,
    p_acepta: true,
    p_sexo: persona.sexo || null,
    p_fecha_nacimiento: persona.nacimiento || null,
    p_etnia: persona.etnia || null
  });
  boton.disabled = false;

  if (error) {
    console.error(error);
    if (silencioso) {
      borrarSesion();
      mostrarRegistro();
      return;
    }
    $("error-registro").textContent = error.message || "No se pudo completar el registro. Inténtalo de nuevo.";
    $("error-registro").hidden = false;
    return;
  }

  st.persona = persona;
  guardarSesion();
  $("vista-registro").hidden = true;
  recordarPersona();
  mostrarReunion();

  if (data.estado === "certificado") {
    mostrarCertificado(data.certificado, data.ya_emitido);
    return;
  }

  // Requiere evaluación
  if (st.acceso.tipo === "virtual" && st.acceso.lecciones > 0) {
    await cargarLecciones();
  } else {
    prepararSinLecciones();
    await mostrarEvaluacion();
  }
}

// ---------------------------------------------------------------------
// Lecciones
// ---------------------------------------------------------------------
async function cargarLecciones() {
  const { data, error } = await nexusDb.rpc("cap_contenido", { p_codigo: st.codigo });
  if (error) {
    console.error(error);
    $("estado").textContent = error.message || "No se pudieron cargar las lecciones.";
    $("estado").classList.add("error");
    $("estado").hidden = false;
    return;
  }
  st.lecciones = data || [];
  $("curso-cuerpo").hidden = false;
  construirTemario();

  const pendiente = st.lecciones.findIndex(function (_, i) { return !st.vistas.has(i); });
  if (pendiente === -1) mostrarEvaluacion();
  else mostrarLeccion(pendiente);
}

function prepararSinLecciones() {
  $("curso-cuerpo").hidden = false;
  $("curso-cuerpo").classList.add("sin-temario");
  $("temario-caja").hidden = true;
  $("btn-repasar").hidden = true;
}

function construirTemario() {
  const ol = $("temario");
  ol.innerHTML = "";
  st.lecciones.forEach(function (leccion, i) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = leccion.titulo;
    btn.addEventListener("click", function () { mostrarLeccion(i); });
    li.appendChild(btn);
    ol.appendChild(li);
  });
  const li = document.createElement("li");
  li.className = "evaluacion";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "btn-temario-evaluacion";
  btn.textContent = "Evaluación final";
  btn.addEventListener("click", mostrarEvaluacion);
  li.appendChild(btn);
  ol.appendChild(li);
  actualizarTemario();
}

function actualizarTemario(activa) {
  if (st.lecciones.length === 0) return;
  const botones = $("temario").querySelectorAll("button");
  const total = st.lecciones.length;
  botones.forEach(function (btn, i) {
    btn.classList.toggle("activa", i === activa);
    if (i < total) btn.classList.toggle("vista-hecha", st.vistas.has(i));
  });
  const listas = st.vistas.size >= total;
  $("btn-temario-evaluacion").disabled = !listas;
  $("btn-temario-evaluacion").title = listas ? "" : "Revisa todas las lecciones para habilitar la evaluación";
  $("progreso-texto").textContent = "Progreso: " + st.vistas.size + " de " + total + " lecciones";
  $("progreso-barra").style.width = Math.round((st.vistas.size / total) * 100) + "%";

  // Avance también en el encabezado del curso
  const porcentaje = Math.min(100, Math.round((st.vistas.size / total) * 100));
  $("cabecera-progreso").hidden = false;
  $("cabecera-progreso-texto").textContent = (porcentaje >= 100 ? "Lecciones completas" : "En progreso") + " (" + porcentaje + "% visto)";
  $("cabecera-progreso-barra").style.width = porcentaje + "%";
}

function mostrarVista(nombre) {
  ["vista-leccion", "vista-evaluacion", "vista-resultado"].forEach(function (id) {
    $(id).hidden = id !== nombre;
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function mostrarLeccion(i) {
  const leccion = st.lecciones[i];
  const total = st.lecciones.length;
  st.vistas.add(i);
  guardarSesion();

  $("leccion-paso").textContent = "Lección " + (i + 1) + " de " + total;
  $("leccion-titulo").textContent = leccion.titulo;

  const video = $("leccion-video");
  video.innerHTML = "";
  const idVideo = obtenerIdYoutube(leccion.video_url);
  if (idVideo) {
    const iframe = document.createElement("iframe");
    iframe.src = "https://www.youtube-nocookie.com/embed/" + idVideo;
    iframe.title = "Video: " + leccion.titulo;
    iframe.allow = "accelerometer; encrypted-media; gyroscope; picture-in-picture";
    iframe.allowFullscreen = true;
    iframe.loading = "lazy";
    video.appendChild(iframe);
    video.hidden = false;
  } else {
    video.hidden = true;
  }

  pintarDiapositivas(leccion);
  pintarContenido($("leccion-contenido"), leccion.contenido || "");

  $("btn-anterior").disabled = i === 0;
  $("btn-anterior").onclick = function () { mostrarLeccion(i - 1); };
  const siguiente = $("btn-siguiente");
  if (i < total - 1) {
    siguiente.textContent = "Siguiente lección";
    siguiente.onclick = function () { mostrarLeccion(i + 1); };
  } else {
    siguiente.textContent = "Ir a la evaluación";
    siguiente.onclick = mostrarEvaluacion;
  }

  actualizarTemario(i);
  mostrarVista("vista-leccion");
}

// Diapositivas PDF de la lección (espacio público "diapositivas")
function pintarDiapositivas(leccion) {
  const caja = $("leccion-pdf");
  caja.innerHTML = "";
  const ruta = leccion.archivo_pdf;
  if (!ruta) { caja.hidden = true; return; }

  const url = nexusDb.storage.from("diapositivas").getPublicUrl(ruta).data.publicUrl;

  const visor = document.createElement("iframe");
  visor.src = url + "#view=FitH";
  visor.title = "Diapositivas: " + leccion.titulo;
  visor.loading = "lazy";

  // En celulares el PDF no siempre se muestra incrustado: botón para abrirlo
  const abrir = document.createElement("a");
  abrir.className = "boton secundario";
  abrir.href = url;
  abrir.target = "_blank";
  abrir.rel = "noopener";
  abrir.textContent = "Abrir diapositivas en PDF";

  caja.append(visor, abrir);
  caja.hidden = false;
}

// Texto de la lección en párrafos y listas (sin innerHTML con datos de la base)
function pintarContenido(contenedor, texto) {
  contenedor.innerHTML = "";
  const esLista = function (l) { return /^([-•]|\d+[.)])\s+/.test(l); };
  texto.split(/\n\s*\n/).forEach(function (bloque) {
    const lineas = bloque.split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
    if (lineas.length === 0) return;
    if (lineas.every(esLista)) {
      contenedor.appendChild(crearLista(lineas));
    } else if (lineas.length > 1 && lineas.slice(1).every(esLista)) {
      const p = document.createElement("p");
      p.textContent = lineas[0];
      contenedor.append(p, crearLista(lineas.slice(1)));
    } else {
      const p = document.createElement("p");
      p.textContent = lineas.join("\n");
      contenedor.appendChild(p);
    }
  });
}

function crearLista(lineas) {
  const lista = document.createElement(/^\d/.test(lineas[0]) ? "ol" : "ul");
  lineas.forEach(function (l) {
    const li = document.createElement("li");
    li.textContent = l.replace(/^([-•]|\d+[.)])\s+/, "");
    lista.appendChild(li);
  });
  return lista;
}

function obtenerIdYoutube(url) {
  if (!url) return null;
  const m = String(url).match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------
// Evaluación (preguntas y opciones en orden aleatorio en cada intento)
// ---------------------------------------------------------------------
async function mostrarEvaluacion() {
  if (st.lecciones.length > 0 && st.vistas.size < st.lecciones.length) return;

  actualizarTemario(st.lecciones.length);
  mostrarVista("vista-evaluacion");
  $("persona-nombre").textContent = st.persona.nombres;
  $("evaluacion-intro").textContent =
    "Responde todas las preguntas. Necesitas al menos " + Number(st.acceso.nota_minima) +
    " % para aprobar. Tienes hasta 3 intentos cada 24 horas.";
  $("error-envio").hidden = true;

  const contenedor = $("preguntas");

  if (st.preguntas.length === 0) {
    contenedor.innerHTML = "";
    const cargando = document.createElement("p");
    cargando.className = "aviso";
    cargando.textContent = "Cargando preguntas…";
    contenedor.appendChild(cargando);

    const { data, error } = await nexusDb.rpc("cap_preguntas", { p_codigo: st.codigo });
    if (error || !data || data.length === 0) {
      console.error(error);
      cargando.classList.add("error");
      cargando.textContent = (error && error.message) || "No se pudieron cargar las preguntas. Recarga la página.";
      return;
    }
    st.preguntas = data;
  }

  contenedor.innerHTML = "";
  mezclar(st.preguntas.slice()).forEach(function (pregunta, i) {
    contenedor.appendChild(crearPregunta(pregunta, i));
  });
}

function crearPregunta(pregunta, i) {
  const fs = document.createElement("fieldset");
  fs.className = "pregunta";
  fs.dataset.id = pregunta.id;

  const legend = document.createElement("legend");
  const num = document.createElement("span");
  num.textContent = (i + 1) + ".";
  legend.append(num, document.createTextNode(pregunta.enunciado));
  fs.appendChild(legend);

  // Cada opción guarda su posición ORIGINAL, que es la que califica Supabase
  const opciones = (Array.isArray(pregunta.opciones) ? pregunta.opciones : [])
    .map(function (texto, original) { return { texto: texto, original: original }; });

  mezclar(opciones).forEach(function (op) {
    const label = document.createElement("label");
    label.className = "opcion";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "q_" + pregunta.id;
    input.value = String(op.original);
    input.addEventListener("change", function () { fs.classList.remove("sin-responder"); });
    const span = document.createElement("span");
    span.textContent = op.texto;
    label.append(input, span);
    fs.appendChild(label);
  });
  return fs;
}

// Mezcla una lista al azar (Fisher-Yates con números aleatorios seguros)
function mezclar(lista) {
  for (let i = lista.length - 1; i > 0; i--) {
    const r = new Uint32Array(1);
    crypto.getRandomValues(r);
    const j = r[0] % (i + 1);
    const t = lista[i]; lista[i] = lista[j]; lista[j] = t;
  }
  return lista;
}

$("btn-repasar").addEventListener("click", function () { if (st.lecciones.length) mostrarLeccion(0); });

$("btn-no-soy").addEventListener("click", function () {
  borrarSesion();
  location.reload();
});

$("form-evaluacion").addEventListener("submit", async function (ev) {
  ev.preventDefault();
  const errorEnvio = $("error-envio");
  errorEnvio.hidden = true;

  const respuestas = {};
  let primeraSinResponder = null;
  document.querySelectorAll(".pregunta").forEach(function (fs) {
    const marcada = fs.querySelector("input:checked");
    if (marcada) {
      respuestas[fs.dataset.id] = Number(marcada.value);
    } else {
      fs.classList.add("sin-responder");
      if (!primeraSinResponder) primeraSinResponder = fs;
    }
  });

  if (primeraSinResponder) {
    errorEnvio.textContent = "Responde todas las preguntas antes de enviar. Las que faltan están marcadas en rojo.";
    errorEnvio.hidden = false;
    primeraSinResponder.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const boton = $("btn-enviar");
  boton.disabled = true;
  boton.textContent = "Enviando…";

  const { data, error } = await nexusDb.rpc("cap_evaluar", {
    p_codigo: st.codigo,
    p_cedula: st.persona.cedula,
    p_respuestas: respuestas
  });

  boton.disabled = false;
  boton.textContent = "Enviar evaluación";

  if (error) {
    console.error(error);
    errorEnvio.textContent = error.message || "No se pudo enviar la evaluación. Inténtalo de nuevo.";
    errorEnvio.hidden = false;
    return;
  }

  if (data.aprobado) {
    mostrarCertificado(data.certificado, data.ya_emitido);
  } else {
    mostrarReprobado(data);
  }
});

// ---------------------------------------------------------------------
// Resultados
// ---------------------------------------------------------------------
function mostrarReprobado(r) {
  st.preguntas = [];   // en el próximo intento se piden preguntas nuevas (pueden salir otras al azar)
  $("curso-cuerpo").hidden = false;
  const cont = $("resultado");
  cont.innerHTML = "";

  const paso = document.createElement("p");
  paso.className = "vista-paso";
  paso.textContent = "Resultado de la evaluación";

  const titulo = document.createElement("h2");
  titulo.textContent = "Todavía no alcanzas la nota mínima";

  const detalle = document.createElement("p");
  const restantes = Number(r.intentos_restantes);
  detalle.textContent = "Necesitas al menos " + Number(r.nota_minima) + " % para aprobar. " +
    (restantes > 0
      ? "Repasa el contenido e inténtalo de nuevo: te " + (restantes === 1 ? "queda 1 intento" : "quedan " + restantes + " intentos") + " hoy."
      : "Usaste tus 3 intentos de hoy. Podrás intentarlo de nuevo dentro de 24 horas.");

  const acciones = document.createElement("div");
  acciones.className = "acciones";

  if (st.lecciones.length > 0) {
    const repasar = document.createElement("button");
    repasar.type = "button";
    repasar.className = "boton secundario";
    repasar.textContent = "Repasar lecciones";
    repasar.addEventListener("click", function () { mostrarLeccion(0); });
    acciones.appendChild(repasar);
  }
  if (restantes > 0) {
    const otra = document.createElement("button");
    otra.type = "button";
    otra.className = "boton";
    otra.textContent = "Intentar de nuevo";
    otra.addEventListener("click", mostrarEvaluacion);
    acciones.appendChild(otra);
  }
  agregarVolverJornada(acciones);

  cont.append(paso, titulo, detalle, acciones);
  mostrarVista("vista-resultado");
}

function mostrarCertificado(cert, yaEmitido) {
  $("curso-cuerpo").hidden = false;
  $("curso-cuerpo").classList.add("sin-temario");
  $("temario-caja").hidden = true;

  const cont = $("resultado");
  cont.innerHTML = "";
  const esAprobacion = cert.tipo !== "asistencia";

  const paso = document.createElement("p");
  paso.className = "vista-paso";
  paso.textContent = esAprobacion ? "Certificado de aprobación" : "Certificado de asistencia";

  const titulo = document.createElement("h2");
  if (yaEmitido) titulo.textContent = "Ya tienes tu certificado de esta capacitación";
  else titulo.textContent = esAprobacion ? "¡Aprobaste!" : "¡Listo, " + primerNombre(cert.nombres) + "!";
  cont.append(paso, titulo);

  if (esAprobacion && cert.nota !== null && cert.nota !== undefined) {
    const cifra = document.createElement("p");
    cifra.className = "resultado-nota aprobado";
    cifra.textContent = Number(cert.nota).toLocaleString("es-EC", { maximumFractionDigits: 1 }) + " %";
    cont.appendChild(cifra);
  }

  const detalle = document.createElement("p");
  detalle.textContent = "Tu certificado está listo. Este es el código con el que cualquier empresa puede verificarlo:";
  const codigo = document.createElement("div");
  codigo.className = "codigo-certificado";
  codigo.textContent = cert.codigo;

  const acciones = document.createElement("div");
  acciones.className = "acciones";
  const descargar = document.createElement("button");
  descargar.type = "button";
  descargar.className = "boton";
  descargar.textContent = "Descargar certificado en PDF";
  descargar.addEventListener("click", function () {
    try {
      NexusCertificado.generar(cert);
    } catch (e) {
      console.error(e);
      alert("No se pudo generar el PDF. Recarga la página e inténtalo de nuevo.");
    }
  });
  const verificar = document.createElement("a");
  verificar.className = "boton secundario";
  verificar.href = "verificar.html?codigo=" + encodeURIComponent(cert.codigo);
  verificar.textContent = "Ver página de verificación";
  acciones.append(descargar, verificar);
  agregarVolverJornada(acciones);

  cont.append(detalle, codigo, acciones);
  mostrarVista("vista-resultado");
}

// ---------------------------------------------------------------------
// Memoria de la pestaña (para no perder el avance si se recarga)
// Se borra al cerrar la pestaña.
// ---------------------------------------------------------------------
function guardarSesion() {
  try {
    sessionStorage.setItem(CLAVE_SESION, JSON.stringify({ persona: st.persona, vistas: Array.from(st.vistas) }));
  } catch (e) { /* sin memoria disponible: no pasa nada */ }
}
function leerSesion() {
  try { return JSON.parse(sessionStorage.getItem(CLAVE_SESION)); } catch (e) { return null; }
}
function borrarSesion() {
  try { sessionStorage.removeItem(CLAVE_SESION); } catch (e) { /* nada */ }
  try { localStorage.removeItem(CLAVE_RECORDAR); } catch (e) { /* nada */ }
}

// Recuerda en este teléfono a quien ya se registró con este código, para
// que al volver (por el QR o el enlace) no tenga que inscribirse de nuevo.
const CLAVE_RECORDAR = "nexus_reg_" + st.codigo;
function recordarPersona() {
  try { localStorage.setItem(CLAVE_RECORDAR, JSON.stringify({ persona: st.persona })); } catch (e) { /* nada */ }
}
function leerRecordado() {
  try { return JSON.parse(localStorage.getItem(CLAVE_RECORDAR)); } catch (e) { return null; }
}

// ---------------------------------------------------------------------
// CLASE EN VIVO: botón «Unirse a la reunión» con cuenta regresiva
// ---------------------------------------------------------------------
const reu = { datos: null, desfase: 0, reloj: null };

async function mostrarReunion() {
  if (reu.datos) return pintarReunion();
  const { data, error } = await nexusDb.rpc("cap_reunion", { p_codigo: st.codigo });
  if (error || !data) return; // sin SQL o sin encuentros: no se muestra nada
  // SQL 38: varios encuentros · SQL 35: una sola reunión
  const lista = Array.isArray(data.encuentros) ? data.encuentros
    : (data.url ? [{ url: data.url, inicio: data.inicio, duracion: data.duracion }] : []);
  reu.lista = lista.filter(function (e) { return e && e.url; })
    .sort(function (a, b) { return new Date(a.inicio || 0) - new Date(b.inicio || 0); });
  if (!reu.lista.length) return;
  reu.datos = data;
  if (data.ahora) reu.desfase = new Date(data.ahora).getTime() - Date.now();
  const nombre = (st.persona && st.persona.nombres || "").split(" ").slice(0, 2).join(" ");
  const p = $("reunion-persona");
  p.textContent = nombre ? "Registrado como " + nombre + ". " : "";
  const cambiar = document.createElement("button");
  cambiar.type = "button";
  cambiar.textContent = "¿No eres tú? Cambiar";
  cambiar.addEventListener("click", function () {
    borrarSesion();
    location.reload();
  });
  p.appendChild(cambiar);
  $("bloque-reunion").hidden = false;
  pintarReunion();
  clearInterval(reu.reloj);
  reu.reloj = setInterval(pintarReunion, 15000);
}

function fechaEncuentro(ms, ahora) {
  const f = new Date(ms);
  const hora = f.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });
  if (f.toDateString() === new Date(ahora).toDateString()) return "hoy a las " + hora;
  if (f.toDateString() === new Date(ahora + 86400000).toDateString()) return "mañana a las " + hora;
  return "el " + f.toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" }) + " a las " + hora;
}

function pintarReunion() {
  if (!reu.lista) return;
  const bloque = $("bloque-reunion");
  const ahora = Date.now() + reu.desfase;
  const tramos = reu.lista.map(function (e, i) {
    const ini = e.inicio ? new Date(e.inicio).getTime() : null;
    return { e: e, n: i + 1, ini: ini, fin: ini ? ini + (e.duracion || 60) * 60000 : null };
  });
  const varios = tramos.length > 1;
  const enCurso = tramos.find(function (t) { return t.ini && ahora >= t.ini && ahora < t.fin; });
  const proximo = tramos.find(function (t) { return t.ini && ahora < t.ini; });
  const sinHora = tramos.find(function (t) { return !t.ini; });
  const t = enCurso || proximo || sinHora || tramos[tramos.length - 1];
  const nombre = varios ? "El encuentro " + t.n : "La reunión";
  $("btn-reunion").href = t.e.url;
  bloque.classList.remove("en-curso", "terminada");

  if (!t.ini) {
    $("reunion-estado").textContent = "Clase en vivo";
    $("reunion-cuenta").textContent = "Toca el botón para entrar a la reunión.";
  } else if (t === enCurso) {
    bloque.classList.add("en-curso");
    $("reunion-estado").textContent = "🔴 " + (varios ? "Encuentro " + t.n + " en curso" : "Reunión en curso");
    $("reunion-cuenta").textContent = "Entra ahora, ya empezó.";
  } else if (t === proximo) {
    $("reunion-estado").textContent = nombre + " empezará " + fechaEncuentro(t.ini, ahora);
    $("reunion-cuenta").textContent = "(faltan " + textoFalta(t.ini - ahora) + ")";
  } else {
    bloque.classList.add("terminada");
    $("reunion-estado").textContent = varios ? "Los encuentros ya terminaron" : "La reunión ya terminó";
    $("reunion-cuenta").textContent = "Si todavía siguen conectados, puedes intentar entrar.";
  }

  // Con varios encuentros: la lista completa debajo del botón
  let lista = $("reunion-lista");
  if (!lista) {
    lista = document.createElement("ul");
    lista.id = "reunion-lista";
    lista.className = "reunion-lista";
    $("btn-reunion").after(lista);
  }
  lista.hidden = !varios;
  lista.innerHTML = "";
  if (varios) tramos.forEach(function (x) {
    const li = document.createElement("li");
    const estado = !x.ini ? "" : ahora >= x.fin ? " ✓" : (ahora >= x.ini ? " · en curso" : "");
    li.textContent = "Encuentro " + x.n + ": " + (x.ini ? fechaEncuentro(x.ini, ahora) : "sin hora") + estado;
    if (x === t) li.className = "actual";
    if (x.ini && ahora >= x.fin) li.classList.add("pasado");
    lista.appendChild(li);
  });
}

function textoFalta(ms) {
  const min = Math.max(1, Math.ceil(ms / 60000));
  const dias = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  const partes = [];
  if (dias) partes.push(dias + (dias === 1 ? " día" : " días"));
  if (h) partes.push(h + (h === 1 ? " hora" : " horas"));
  if (m && !dias) partes.push(m + (m === 1 ? " minuto" : " minutos"));
  return partes.join(" y ") || "menos de 1 minuto";
}

// ---------------------------------------------------------------------
// JORNADA: una clave para varias capacitaciones de la empresa en el día.
// La persona se registra una vez; se inscribe en cada capacitación con la
// clave presencial de cada una (cada una conserva su nómina, sus
// certificados y su registro de asistencia).
// ---------------------------------------------------------------------
const CLAVE_VOLVER_JORNADA = "nexus_jornada_volver";

function iniciarJornada(j) {
  st.jornada = j;
  document.title = j.nombre + " · Nexus Academy";
  $("curso-empresa").textContent = j.empresa;
  $("curso-titulo").textContent = j.nombre;
  const n = j.capacitaciones.length;
  $("curso-datos").textContent = n + (n === 1 ? " capacitación" : " capacitaciones") + " · " + fechaJornada(j.fecha);
  pintarPortada($("curso-portada"), j.nombre, null);
  $("estado").hidden = true;
  $("curso").hidden = false;

  const guardado = leerSesion();
  if (guardado && guardado.persona) return registrarJornada(guardado.persona, true);

  $("registro-titulo").textContent = "Regístrate una sola vez";
  $("registro-intro").textContent = "Con estos datos quedarás registrado en las " + n + " capacitaciones del día: " +
    j.capacitaciones.map(function (c) { return c.curso; }).join(", ") + ". Escríbelos tal como deben aparecer en tus certificados.";
  $("btn-registro").textContent = "Registrarme";
  $("vista-registro").hidden = false;
}

async function registrarJornada(persona, silencioso) {
  const boton = $("btn-registro");
  boton.disabled = true;
  boton.textContent = "Registrando…";

  const resultados = [];
  for (const c of st.jornada.capacitaciones) {
    if (!c.codigo) { resultados.push({ cap: c, error: "Esta capacitación no tiene una clave activa. Avisa al facilitador." }); continue; }
    const r = await nexusDb.rpc("cap_inscribir", {
      p_codigo: c.codigo, p_cedula: persona.cedula, p_nombres: persona.nombres, p_correo: persona.correo,
      p_acepta: true, p_sexo: persona.sexo || null, p_fecha_nacimiento: persona.nacimiento || null, p_etnia: persona.etnia || null
    });
    resultados.push({ cap: c, data: r.data, error: r.error ? (r.error.message || "No se pudo registrar.") : null });
  }

  boton.disabled = false;
  boton.textContent = "Registrarme";

  // Si ninguna funcionó, el problema está en los datos: mostrarlo en el formulario
  if (resultados.every(function (r) { return r.error; })) {
    if (silencioso) { borrarSesion(); return iniciarJornada(st.jornada); }
    $("error-registro").textContent = resultados[0].error;
    $("error-registro").hidden = false;
    return;
  }

  // Recordar a la persona aquí y en cada capacitación (para rendir el test sin volver a escribir sus datos)
  st.persona = persona;
  guardarSesion();
  try {
    resultados.forEach(function (r) {
      if (r.cap.codigo && !r.error) {
        sessionStorage.setItem("nexus_" + normalizarCodigo(r.cap.codigo), JSON.stringify({ persona: persona, vistas: [] }));
      }
    });
    sessionStorage.setItem(CLAVE_VOLVER_JORNADA, st.codigo);
  } catch (e) { /* sin memoria disponible */ }

  $("vista-registro").hidden = true;
  pintarJornada(resultados, persona);
}

function pintarJornada(resultados, persona) {
  $("jornada-saludo").textContent = "¡Listo, " + primerNombre(persona.nombres) + "! Tus capacitaciones de hoy";
  const ol = $("lista-jornada");
  ol.innerHTML = "";
  resultados.forEach(function (r) {
    const li = document.createElement("li");
    li.className = "item-jornada";
    const info = document.createElement("div");
    const t = document.createElement("strong");
    t.textContent = r.cap.curso;
    const d = document.createElement("small");
    d.textContent = formatearHoras(r.cap.horas) + (r.cap.requiere_evaluacion ? " · Con evaluación" : " · Certificado de asistencia");
    info.append(t, d);

    const accion = document.createElement("div");
    accion.className = "accion-jornada";
    const estado = document.createElement("span");
    if (r.error) {
      estado.className = "estado-jornada error";
      estado.textContent = r.error;
      accion.appendChild(estado);
    } else if (r.data && r.data.estado === "certificado") {
      estado.className = "estado-jornada ok";
      estado.textContent = "Certificado listo";
      const b = document.createElement("button");
      b.type = "button";
      b.className = "boton boton-chico";
      b.textContent = "Descargar";
      b.addEventListener("click", function () {
        try { NexusCertificado.generar(r.data.certificado); }
        catch (e) { console.error(e); alert("No se pudo generar el PDF. Recarga la página e inténtalo de nuevo."); }
      });
      accion.append(estado, b);
    } else {
      estado.className = "estado-jornada pendiente";
      estado.textContent = "Falta la evaluación";
      const a = document.createElement("a");
      a.className = "boton boton-chico";
      a.href = "curso.html?codigo=" + encodeURIComponent(r.cap.codigo);
      a.textContent = "Rendir evaluación";
      accion.append(estado, a);
    }
    li.append(info, accion);
    ol.appendChild(li);
  });
  $("vista-jornada").hidden = false;
}

// En una capacitación abierta desde la jornada: enlace para volver a la lista del día
function agregarVolverJornada(contenedor) {
  let volver = null;
  try { volver = sessionStorage.getItem(CLAVE_VOLVER_JORNADA); } catch (e) { /* nada */ }
  if (!volver || st.jornada || volver === st.codigo) return;
  const a = document.createElement("a");
  a.className = "boton secundario";
  a.href = "curso.html?codigo=" + encodeURIComponent(volver);
  a.textContent = "Volver a mis capacitaciones del día";
  contenedor.appendChild(a);
}

function fechaJornada(iso) {
  const p = String(iso || "").split("-");
  if (p.length !== 3) return "";
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]))
    .toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" });
}

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------
function normalizarCodigo(texto) {
  return String(texto || "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
}
function formatearHoras(horas) {
  const n = Number(horas);
  return n === 1 ? "1 hora" : n.toLocaleString("es-EC") + " horas";
}
function primerNombre(nombres) {
  const p = String(nombres || "").trim().split(/\s+/)[0] || "";
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
}
