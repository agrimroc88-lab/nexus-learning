// =====================================================================
// NEXUS LEARNING · CAPACITACIÓN (acceso con código)
// Carpeta: js/curso.js
//
// Flujo: código → registro → (lecciones) → (evaluación) → certificado
// Todo lo importante (validar el código, calificar, emitir el
// certificado) lo hace Supabase. Esta página solo muestra y envía datos.
// =====================================================================

const st = {
  codigo: normalizarCodigo(new URLSearchParams(location.search).get("codigo")),
  acceso: null,        // datos del código: empresa, curso, tipo, etc.
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
    mostrarCodigoInvalido(motivo, !/^No encontramos/.test(motivo));
    return;
  }

  st.acceso = data;
  pintarCabecera();
  $("estado").hidden = true;
  $("curso").hidden = false;

  // Si la persona ya se registró con este código en esta pestaña, continuar
  const guardado = leerSesion();
  if (guardado && guardado.persona) {
    st.vistas = new Set(guardado.vistas || []);
    await registrar(guardado.persona, true);
  } else {
    mostrarRegistro();
  }
})();

function pintarCabecera() {
  const a = st.acceso;
  document.title = a.curso + " · Nexus Learning";
  $("curso-empresa").textContent = a.empresa;
  $("curso-titulo").textContent = a.curso;

  const partes = [a.tipo === "presencial" ? "Capacitación presencial" : "Curso virtual", formatearHoras(a.horas)];
  if (a.tipo === "virtual" && a.lecciones > 0) partes.push(a.lecciones + (a.lecciones === 1 ? " lección" : " lecciones"));
  partes.push(a.requiere_evaluacion ? "Con evaluación" : "Sin evaluación");
  $("curso-datos").textContent = partes.join(" · ");
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
  if (codigo.length >= 8) location.href = "curso.html?codigo=" + encodeURIComponent(codigo);
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
  const persona = {
    nombres: $("p-nombres").value.trim().replace(/\s+/g, " "),
    cedula: $("p-cedula").value.replace(/\s/g, ""),
    correo: $("p-correo").value.trim()
  };
  const acepta = $("p-acepta").checked;
  let valido = true;

  $("e-nombres").textContent = "";
  $("e-cedula").textContent = "";
  $("e-acepta").textContent = "";
  $("error-registro").hidden = true;

  if (persona.nombres.length < 5) { $("e-nombres").textContent = "Escribe tus nombres y apellidos completos."; valido = false; }
  if (persona.cedula.length < 5) { $("e-cedula").textContent = "Escribe tu número de cédula o pasaporte."; valido = false; }
  if (!acepta) { $("e-acepta").textContent = "Debes aceptar el tratamiento de datos para continuar."; valido = false; }
  if (!valido) return;

  await registrar(persona, false);
});

async function registrar(persona, silencioso) {
  const boton = $("btn-registro");
  boton.disabled = true;

  const { data, error } = await nexusDb.rpc("cap_inscribir", {
    p_codigo: st.codigo,
    p_cedula: persona.cedula,
    p_nombres: persona.nombres,
    p_correo: persona.correo,
    p_acepta: true
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
  const m = String(url).match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
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
}

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------
function normalizarCodigo(texto) {
  let c = String(texto || "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
  if (c.length === 9 && c.indexOf("-") === -1) c = c.slice(0, 3) + "-" + c.slice(3);
  return c;
}
function formatearHoras(horas) {
  const n = Number(horas);
  return n === 1 ? "1 hora" : n.toLocaleString("es-EC") + " horas";
}
function primerNombre(nombres) {
  const p = String(nombres || "").trim().split(/\s+/)[0] || "";
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
}
