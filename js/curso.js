// =====================================================================
// NEXUS LEARNING · PÁGINA DEL CURSO
// Carpeta: js/curso.js
// Muestra las lecciones, la evaluación y el resultado.
// La calificación y el certificado los genera Supabase (no el navegador).
// =====================================================================

const estadoCurso = {
  id: new URLSearchParams(location.search).get("id"),
  curso: null,
  lecciones: [],
  actual: 0,
  vistas: new Set(),
  preguntas: [],
  cedula: ""
};

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------
// Inicio
// ---------------------------------------------------------------------
(async function iniciar() {
  const formatoId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!estadoCurso.id || !formatoId.test(estadoCurso.id)) {
    mostrarError("No encontramos este curso. Vuelve a la página de inicio y elige uno de la lista.");
    return;
  }

  try {
    const { data: curso, error: e1 } = await nexusDb
      .from("cap_cursos")
      .select("id, titulo, descripcion, horas, nota_minima")
      .eq("id", estadoCurso.id)
      .eq("publicado", true)
      .maybeSingle();
    if (e1) throw e1;
    if (!curso) {
      mostrarError("Este curso no existe o ya no está disponible.");
      return;
    }

    const { data: lecciones, error: e2 } = await nexusDb
      .from("cap_lecciones")
      .select("id, orden, titulo, contenido, video_url")
      .eq("curso_id", estadoCurso.id)
      .order("orden", { ascending: true });
    if (e2) throw e2;

    estadoCurso.curso = curso;
    estadoCurso.lecciones = lecciones || [];

    document.title = curso.titulo + " · Nexus Learning";
    $("curso-titulo").textContent = curso.titulo;
    $("curso-datos").textContent =
      formatearHoras(curso.horas) + " · " + estadoCurso.lecciones.length + " lecciones · Nota mínima para aprobar: " + Number(curso.nota_minima) + " %";

    construirTemario();
    $("estado").hidden = true;
    $("curso").hidden = false;

    if (estadoCurso.lecciones.length > 0) {
      mostrarLeccion(0);
    } else {
      mostrarEvaluacion();
    }
  } catch (e) {
    console.error(e);
    mostrarError("No se pudo cargar el curso. Revisa tu conexión a internet y recarga la página.");
  }
})();

function mostrarError(texto) {
  const estado = $("estado");
  estado.classList.add("error");
  estado.textContent = texto;
  estado.hidden = false;
}

// ---------------------------------------------------------------------
// Temario y progreso
// ---------------------------------------------------------------------
function construirTemario() {
  const ol = $("temario");
  ol.innerHTML = "";

  estadoCurso.lecciones.forEach(function (leccion, i) {
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
  const botones = $("temario").querySelectorAll("button");
  const total = estadoCurso.lecciones.length;

  botones.forEach(function (btn, i) {
    btn.classList.toggle("activa", i === activa);
    if (i < total) btn.classList.toggle("vista-hecha", estadoCurso.vistas.has(i));
  });

  const todasVistas = estadoCurso.vistas.size >= total;
  const btnEval = $("btn-temario-evaluacion");
  btnEval.disabled = !todasVistas;
  btnEval.title = todasVistas ? "" : "Revisa todas las lecciones para habilitar la evaluación";

  const porcentaje = total === 0 ? 100 : Math.round((estadoCurso.vistas.size / total) * 100);
  $("progreso-texto").textContent = "Progreso: " + estadoCurso.vistas.size + " de " + total + " lecciones";
  $("progreso-barra").style.width = porcentaje + "%";
}

function mostrarVista(nombre) {
  ["vista-leccion", "vista-evaluacion", "vista-resultado"].forEach(function (id) {
    $(id).hidden = id !== nombre;
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------------------------------------------------------------------
// Lecciones
// ---------------------------------------------------------------------
function mostrarLeccion(i) {
  const leccion = estadoCurso.lecciones[i];
  const total = estadoCurso.lecciones.length;
  estadoCurso.actual = i;
  estadoCurso.vistas.add(i);

  $("leccion-paso").textContent = "Lección " + (i + 1) + " de " + total;
  $("leccion-titulo").textContent = leccion.titulo;

  // Video (solo YouTube)
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

  // Texto
  pintarContenido($("leccion-contenido"), leccion.contenido || "");

  // Botones
  const anterior = $("btn-anterior");
  const siguiente = $("btn-siguiente");
  anterior.disabled = i === 0;
  anterior.onclick = function () { mostrarLeccion(i - 1); };

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

// Convierte el texto de la lección en párrafos y listas, sin usar innerHTML
// con datos de la base (evita que se inyecte código).
function pintarContenido(contenedor, texto) {
  contenedor.innerHTML = "";
  texto.split(/\n\s*\n/).forEach(function (bloque) {
    const lineas = bloque.split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
    if (lineas.length === 0) return;

    const esVineta = lineas.every(function (l) { return /^[-•]\s+/.test(l); });
    const esNumerada = lineas.every(function (l) { return /^\d+[.)]\s+/.test(l); });

    // Bloque con una frase de introducción seguida de una lista
    const introConLista = lineas.length > 1 && lineas.slice(1).every(function (l) { return /^([-•]|\d+[.)])\s+/.test(l); });

    if (esVineta || esNumerada) {
      contenedor.appendChild(crearLista(lineas, esNumerada));
    } else if (introConLista) {
      const p = document.createElement("p");
      p.textContent = lineas[0];
      contenedor.appendChild(p);
      contenedor.appendChild(crearLista(lineas.slice(1), /^\d/.test(lineas[1])));
    } else {
      const p = document.createElement("p");
      p.textContent = lineas.join("\n");
      contenedor.appendChild(p);
    }
  });
}

function crearLista(lineas, numerada) {
  const lista = document.createElement(numerada ? "ol" : "ul");
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
// Evaluación
// ---------------------------------------------------------------------
async function mostrarEvaluacion() {
  if (estadoCurso.vistas.size < estadoCurso.lecciones.length) return;

  actualizarTemario(estadoCurso.lecciones.length);
  mostrarVista("vista-evaluacion");
  $("evaluacion-intro").textContent =
    "Responde todas las preguntas. Necesitas al menos " + Number(estadoCurso.curso.nota_minima) +
    " % para aprobar. Tienes hasta 3 intentos cada 24 horas.";

  if (estadoCurso.preguntas.length > 0) return;

  const contenedor = $("preguntas");
  contenedor.innerHTML = "";
  const cargando = document.createElement("p");
  cargando.className = "aviso";
  cargando.textContent = "Cargando preguntas…";
  contenedor.appendChild(cargando);

  const { data, error } = await nexusDb.rpc("cap_obtener_preguntas", { p_curso: estadoCurso.id });
  if (error || !data || data.length === 0) {
    console.error(error);
    cargando.classList.add("error");
    cargando.textContent = "No se pudieron cargar las preguntas. Recarga la página para intentarlo de nuevo.";
    return;
  }

  estadoCurso.preguntas = data;
  contenedor.innerHTML = "";
  data.forEach(function (pregunta, i) {
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

  const opciones = Array.isArray(pregunta.opciones) ? pregunta.opciones : [];
  opciones.forEach(function (texto, j) {
    const label = document.createElement("label");
    label.className = "opcion";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "q_" + pregunta.id;
    input.value = String(j);
    input.addEventListener("change", function () { fs.classList.remove("sin-responder"); });
    const span = document.createElement("span");
    span.textContent = texto;
    label.append(input, span);
    fs.appendChild(label);
  });

  return fs;
}

$("btn-repasar").addEventListener("click", function () { mostrarLeccion(0); });

$("form-evaluacion").addEventListener("submit", async function (ev) {
  ev.preventDefault();
  const errorEnvio = $("error-envio");
  errorEnvio.hidden = true;

  // --- Validar datos ---
  const nombres = $("p-nombres").value.trim();
  const cedula = $("p-cedula").value.replace(/\s/g, "");
  const acepta = $("p-acepta").checked;
  let valido = true;

  $("e-nombres").textContent = "";
  $("e-cedula").textContent = "";
  $("e-acepta").textContent = "";

  if (nombres.length < 5) { $("e-nombres").textContent = "Escribe tus nombres y apellidos completos."; valido = false; }
  if (cedula.length < 5) { $("e-cedula").textContent = "Escribe tu número de cédula o pasaporte."; valido = false; }
  if (!acepta) { $("e-acepta").textContent = "Debes aceptar el tratamiento de datos para recibir el certificado."; valido = false; }

  // --- Validar respuestas ---
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

  if (!valido) {
    $("p-nombres").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  if (primeraSinResponder) {
    errorEnvio.textContent = "Responde todas las preguntas antes de enviar. Las que faltan están marcadas en rojo.";
    errorEnvio.hidden = false;
    primeraSinResponder.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  // --- Enviar a Supabase ---
  const boton = $("btn-enviar");
  boton.disabled = true;
  boton.textContent = "Enviando…";

  const { data, error } = await nexusDb.rpc("cap_enviar_evaluacion", {
    p_curso: estadoCurso.id,
    p_cedula: cedula,
    p_nombres: nombres,
    p_correo: $("p-correo").value.trim(),
    p_empresa: $("p-empresa").value.trim(),
    p_acepta: acepta,
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

  estadoCurso.cedula = cedula;
  mostrarResultado(data);
});

// ---------------------------------------------------------------------
// Resultado
// ---------------------------------------------------------------------
function mostrarResultado(r) {
  const cont = $("resultado");
  cont.innerHTML = "";
  const nota = Number(r.nota);

  const paso = document.createElement("p");
  paso.className = "vista-paso";
  paso.textContent = "Resultado de la evaluación";

  const titulo = document.createElement("h2");
  const cifra = document.createElement("p");
  cifra.className = "resultado-nota " + (r.aprobado ? "aprobado" : "reprobado");
  cifra.textContent = formatearNota(nota) + " %";

  const detalle = document.createElement("p");
  const acciones = document.createElement("div");
  acciones.className = "acciones";

  if (r.aprobado) {
    titulo.textContent = r.ya_emitido ? "Ya habías aprobado este curso" : "¡Aprobaste el curso!";
    detalle.textContent = r.ya_emitido
      ? "Aquí tienes tu certificado. Este es el código con el que cualquier empresa puede verificarlo:"
      : "Tu certificado está listo. Este es el código con el que cualquier empresa puede verificarlo:";

    const codigo = document.createElement("div");
    codigo.className = "codigo-certificado";
    codigo.textContent = r.codigo;

    const descargar = document.createElement("button");
    descargar.type = "button";
    descargar.className = "boton";
    descargar.textContent = "Descargar certificado en PDF";
    descargar.addEventListener("click", function () {
      try {
        NexusCertificado.generar({
          nombres: r.nombres,
          cedula: estadoCurso.cedula,
          empresa: r.empresa,
          curso: r.curso,
          horas: r.horas,
          nota: r.nota,
          codigo: r.codigo,
          fecha: r.emitido_en
        });
      } catch (e) {
        console.error(e);
        alert("No se pudo generar el PDF. Recarga la página e inténtalo de nuevo.");
      }
    });

    const verificar = document.createElement("a");
    verificar.className = "boton secundario";
    verificar.href = "verificar.html?codigo=" + encodeURIComponent(r.codigo);
    verificar.textContent = "Ver página de verificación";

    acciones.append(descargar, verificar);
    cont.append(paso, titulo, cifra, detalle, codigo, acciones);
  } else {
    titulo.textContent = "Todavía no alcanzas la nota mínima";
    detalle.textContent =
      "Respondiste bien " + r.correctas + " de " + r.total + " preguntas. Necesitas " +
      Number(r.nota_minima) + " % para aprobar. Repasa las lecciones e inténtalo de nuevo: tienes hasta 3 intentos cada 24 horas.";

    const repasar = document.createElement("button");
    repasar.type = "button";
    repasar.className = "boton secundario";
    repasar.textContent = "Repasar lecciones";
    repasar.addEventListener("click", function () { mostrarLeccion(0); });

    const otra = document.createElement("button");
    otra.type = "button";
    otra.className = "boton";
    otra.textContent = "Intentar de nuevo";
    otra.addEventListener("click", function () {
      document.querySelectorAll(".pregunta input:checked").forEach(function (i) { i.checked = false; });
      mostrarEvaluacion();
    });

    acciones.append(repasar, otra);
    cont.append(paso, titulo, cifra, detalle, acciones);
  }

  mostrarVista("vista-resultado");
}

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------
function formatearHoras(horas) {
  const n = Number(horas);
  return n === 1 ? "1 hora" : n.toLocaleString("es-EC") + " horas";
}

function formatearNota(n) {
  return Number(n).toLocaleString("es-EC", { maximumFractionDigits: 1 });
}
