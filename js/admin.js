// =====================================================================
// NEXUS LEARNING · PANEL DE ADMINISTRACIÓN DE CURSOS
// Carpeta: js/admin.js
// Crear y editar cursos, lecciones y preguntas.
// =====================================================================

const adm = {
  cursos: [],
  curso: null,          // curso seleccionado (null = nuevo)
  lecciones: [],
  preguntas: [],
  editandoLeccion: null,
  editandoPregunta: null,
  pestana: "datos"
};

const el = (id) => document.getElementById(id);
const NUM_OPCIONES = 4;

// ---------------------------------------------------------------------
// Inicio
// ---------------------------------------------------------------------
(async function iniciar() {
  const usuario = await exigirAdministrador();
  if (!usuario) return;

  el("usuario-correo").textContent = nexusUsuarioVisible(usuario.email);
  el("cargando").hidden = true;
  el("panel").hidden = false;

  construirOpcionesPregunta();
  await cargarCursos();
})();

el("btn-salir").addEventListener("click", cerrarSesion);

function avisar(texto, tipo) {
  const aviso = el("aviso");
  aviso.textContent = texto;
  aviso.className = "aviso " + (tipo || "ok");
  aviso.hidden = false;
  clearTimeout(avisar.t);
  avisar.t = setTimeout(function () { aviso.hidden = true; }, tipo === "error" ? 8000 : 3500);
}

function errorSupabase(e, texto) {
  console.error(e);
  avisar(texto + " Detalle: " + (e.message || "error desconocido"), "error");
}

// ---------------------------------------------------------------------
// Lista de cursos
// ---------------------------------------------------------------------
async function cargarCursos(seleccionarId) {
  const { data, error } = await nexusDb
    .from("cap_cursos")
    .select("id, titulo, descripcion, horas, nota_minima, publicado, creado_en")
    .order("creado_en", { ascending: true });
  if (error) return errorSupabase(error, "No se pudieron cargar los cursos.");

  adm.cursos = data || [];
  pintarListaCursos();

  const id = seleccionarId || (adm.curso && adm.curso.id);
  const curso = adm.cursos.find(function (c) { return c.id === id; });
  if (curso) seleccionarCurso(curso.id);
}

function pintarListaCursos() {
  const ul = el("cursos");
  ul.innerHTML = "";
  if (adm.cursos.length === 0) {
    const li = document.createElement("li");
    li.className = "vacio-lista";
    li.textContent = "Aún no hay cursos.";
    ul.appendChild(li);
    return;
  }
  adm.cursos.forEach(function (c) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "item-curso" + (adm.curso && adm.curso.id === c.id ? " activo" : "");
    const t = document.createElement("span");
    t.textContent = c.titulo;
    const estado = document.createElement("span");
    estado.className = "estado " + (c.publicado ? "publicado" : "borrador");
    estado.textContent = c.publicado ? "Activo" : "Inactivo";
    btn.append(t, estado);
    btn.addEventListener("click", function () { seleccionarCurso(c.id); });
    li.appendChild(btn);
    ul.appendChild(li);
  });
}

el("btn-nuevo-curso").addEventListener("click", function () {
  adm.curso = null;
  adm.lecciones = [];
  adm.preguntas = [];
  pintarListaCursos();
  el("editor-vacio").hidden = true;
  el("editor-curso").hidden = false;
  el("editor-titulo").textContent = "Nuevo curso";
  llenarFormularioCurso({ titulo: "", descripcion: "", horas: 1, nota_minima: 70, publicado: true });
  el("btn-eliminar-curso").hidden = true;
  el("bloque-qr").hidden = true;
  cambiarPestana("datos");
  actualizarPestanas();
  el("c-titulo").focus();
});

async function seleccionarCurso(id) {
  adm.curso = adm.cursos.find(function (c) { return c.id === id; });
  if (!adm.curso) return;
  pintarListaCursos();

  el("editor-vacio").hidden = true;
  el("editor-curso").hidden = false;
  el("editor-titulo").textContent = adm.curso.titulo;
  el("btn-eliminar-curso").hidden = false;
  el("bloque-qr").hidden = false;
  llenarFormularioCurso(adm.curso);

  await Promise.all([cargarLecciones(), cargarPreguntas()]);
  actualizarPestanas();
  cambiarPestana(adm.pestana);
}

// ---------------------------------------------------------------------
// Pestañas
// ---------------------------------------------------------------------
document.querySelectorAll(".pestana").forEach(function (btn) {
  btn.addEventListener("click", function () {
    if (!btn.disabled) cambiarPestana(btn.dataset.pestana);
  });
});

function cambiarPestana(nombre) {
  if (!adm.curso && nombre !== "datos") nombre = "datos";
  adm.pestana = nombre;
  document.querySelectorAll(".pestana").forEach(function (b) {
    const activa = b.dataset.pestana === nombre;
    b.classList.toggle("activa", activa);
    b.setAttribute("aria-selected", activa ? "true" : "false");
  });
  document.querySelectorAll(".hoja").forEach(function (h) {
    h.hidden = h.dataset.hoja !== nombre;
  });
}

function actualizarPestanas() {
  const hayCurso = Boolean(adm.curso);
  document.querySelectorAll('.pestana[data-pestana="lecciones"], .pestana[data-pestana="preguntas"]').forEach(function (b) {
    b.disabled = !hayCurso;
    b.title = hayCurso ? "" : "Guarda primero el curso";
  });
  el("n-lecciones").textContent = hayCurso ? "(" + adm.lecciones.length + ")" : "";
  el("n-preguntas").textContent = hayCurso ? "(" + adm.preguntas.length + ")" : "";
}

// ---------------------------------------------------------------------
// Datos del curso
// ---------------------------------------------------------------------
function llenarFormularioCurso(c) {
  el("c-titulo").value = c.titulo || "";
  el("c-descripcion").value = c.descripcion || "";
  el("c-horas").value = c.horas;
  el("c-nota").value = c.nota_minima;
  el("c-publicado").checked = Boolean(c.publicado);
}

el("form-curso").addEventListener("submit", async function (ev) {
  ev.preventDefault();
  const datos = {
    titulo: el("c-titulo").value.trim(),
    descripcion: el("c-descripcion").value.trim(),
    horas: Number(el("c-horas").value),
    nota_minima: Number(el("c-nota").value),
    publicado: el("c-publicado").checked
  };

  if (datos.titulo.length < 5) return avisar("Escribe un título de al menos 5 caracteres.", "error");
  if (!(datos.horas > 0)) return avisar("Las horas deben ser mayores que 0.", "error");
  if (!(datos.nota_minima >= 1 && datos.nota_minima <= 100)) return avisar("La nota mínima debe estar entre 1 y 100.", "error");

  const boton = el("btn-guardar-curso");
  boton.disabled = true;

  let resp;
  if (adm.curso) {
    resp = await nexusDb.from("cap_cursos").update(datos).eq("id", adm.curso.id).select().single();
  } else {
    resp = await nexusDb.from("cap_cursos").insert(datos).select().single();
  }
  boton.disabled = false;

  if (resp.error) return errorSupabase(resp.error, "No se pudo guardar el curso.");

  const nuevo = !adm.curso;
  adm.curso = resp.data;
  await cargarCursos(resp.data.id);
  avisar(nuevo
    ? "Curso creado. Si lo usarás de forma virtual o con evaluación, agrega lecciones y preguntas."
    : "Curso guardado.");
  if (nuevo) cambiarPestana("lecciones");
});

el("btn-eliminar-curso").addEventListener("click", async function () {
  if (!adm.curso) return;

  // Proteger certificados ya emitidos
  const { count, error } = await nexusDb
    .from("cap_certificados")
    .select("id", { count: "exact", head: true })
    .eq("curso_id", adm.curso.id);
  if (error) return errorSupabase(error, "No se pudo revisar el curso.");

  if (count > 0) {
    return avisar("Este curso ya emitió " + count + " certificado(s). Para no invalidarlos, no se puede eliminar: desmarca \"Activo\" para que no se use en nuevas capacitaciones.", "error");
  }

  const ok = confirm("¿Eliminar el curso \"" + adm.curso.titulo + "\" con todas sus lecciones y preguntas? Esta acción no se puede deshacer.");
  if (!ok) return;

  const r = await nexusDb.from("cap_cursos").delete().eq("id", adm.curso.id);
  if (r.error) return errorSupabase(r.error, "No se pudo eliminar el curso.");

  adm.curso = null;
  el("editor-curso").hidden = true;
  el("editor-vacio").hidden = false;
  await cargarCursos();
  avisar("Curso eliminado.");
});

// ---------------------------------------------------------------------
// QR permanente del programa
// ---------------------------------------------------------------------
const BASE_SITIO = location.origin + location.pathname.replace(/[^/]*$/, "");

function enlacePrograma() {
  return BASE_SITIO + "programa.html?p=" + encodeURIComponent(adm.curso.id);
}

el("btn-cartel-programa").addEventListener("click", function () {
  if (!adm.curso) return;
  if (!adm.curso.publicado) {
    avisar("Este programa está inactivo: quien escanee el QR verá \"no disponible\" hasta que lo actives.", "error");
  }
  try {
    NexusCartel.generarPrograma({
      curso: adm.curso.titulo,
      horas: adm.curso.horas,
      url: enlacePrograma(),
      sitio: BASE_SITIO
    });
  } catch (e) {
    console.error(e);
    avisar("No se pudo generar el cartel. Recarga la página e inténtalo de nuevo.", "error");
  }
});

el("btn-enlace-programa").addEventListener("click", async function () {
  if (!adm.curso) return;
  try {
    await navigator.clipboard.writeText(enlacePrograma());
    avisar("Enlace del programa copiado.");
  } catch (e) {
    window.prompt("Copia este enlace:", enlacePrograma());
  }
});

// ---------------------------------------------------------------------
// Lecciones
// ---------------------------------------------------------------------
async function cargarLecciones() {
  const { data, error } = await nexusDb
    .from("cap_lecciones")
    .select("id, orden, titulo, contenido, video_url")
    .eq("curso_id", adm.curso.id)
    .order("orden", { ascending: true });
  if (error) return errorSupabase(error, "No se pudieron cargar las lecciones.");
  adm.lecciones = data || [];
  pintarLecciones();
  limpiarFormLeccion();
}

function pintarLecciones() {
  pintarItems(el("lista-lecciones"), adm.lecciones, function (l) {
    return { titulo: l.titulo, detalle: l.video_url ? "Con video" : "Solo texto" };
  }, editarLeccion, eliminarLeccion, "Este curso aún no tiene lecciones. Agrega la primera con el formulario.");
  actualizarPestanas();
}

function limpiarFormLeccion() {
  adm.editandoLeccion = null;
  el("leccion-form-titulo").textContent = "Agregar lección";
  el("l-titulo").value = "";
  el("l-video").value = "";
  el("l-contenido").value = "";
  el("l-orden").value = siguienteOrden(adm.lecciones);
}

function editarLeccion(l) {
  adm.editandoLeccion = l;
  el("leccion-form-titulo").textContent = "Editar lección";
  el("l-titulo").value = l.titulo;
  el("l-orden").value = l.orden;
  el("l-video").value = l.video_url || "";
  el("l-contenido").value = l.contenido || "";
  el("form-leccion").scrollIntoView({ behavior: "smooth", block: "start" });
  el("l-titulo").focus();
}

el("btn-cancelar-leccion").addEventListener("click", limpiarFormLeccion);

el("form-leccion").addEventListener("submit", async function (ev) {
  ev.preventDefault();
  const datos = {
    titulo: el("l-titulo").value.trim(),
    orden: parseInt(el("l-orden").value, 10) || siguienteOrden(adm.lecciones),
    video_url: el("l-video").value.trim() || null,
    contenido: el("l-contenido").value.trim()
  };
  if (datos.titulo.length < 3) return avisar("Escribe el título de la lección.", "error");
  if (datos.video_url && !/^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(datos.video_url)) {
    return avisar("El enlace del video debe ser de YouTube y empezar con https://", "error");
  }

  const r = adm.editandoLeccion
    ? await nexusDb.from("cap_lecciones").update(datos).eq("id", adm.editandoLeccion.id)
    : await nexusDb.from("cap_lecciones").insert(Object.assign({ curso_id: adm.curso.id }, datos));
  if (r.error) return errorSupabase(r.error, "No se pudo guardar la lección.");

  avisar(adm.editandoLeccion ? "Lección actualizada." : "Lección agregada.");
  await cargarLecciones();
});

async function eliminarLeccion(l) {
  if (!confirm("¿Eliminar la lección \"" + l.titulo + "\"?")) return;
  const r = await nexusDb.from("cap_lecciones").delete().eq("id", l.id);
  if (r.error) return errorSupabase(r.error, "No se pudo eliminar la lección.");
  avisar("Lección eliminada.");
  await cargarLecciones();
}

// ---------------------------------------------------------------------
// Preguntas
// ---------------------------------------------------------------------
function construirOpcionesPregunta() {
  const cont = el("q-opciones");
  for (let i = 0; i < NUM_OPCIONES; i++) {
    const fila = document.createElement("div");
    fila.className = "fila-opcion";
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "q-correcta";
    radio.value = String(i);
    radio.id = "q-correcta-" + i;
    radio.setAttribute("aria-label", "Marcar opción " + (i + 1) + " como correcta");
    const texto = document.createElement("input");
    texto.className = "campo";
    texto.id = "q-op-" + i;
    texto.placeholder = "Opción " + (i + 1);
    texto.maxLength = 200;
    fila.append(radio, texto);
    cont.appendChild(fila);
  }
}

async function cargarPreguntas() {
  const { data, error } = await nexusDb
    .from("cap_preguntas")
    .select("id, orden, enunciado, opciones, respuesta_correcta")
    .eq("curso_id", adm.curso.id)
    .order("orden", { ascending: true });
  if (error) return errorSupabase(error, "No se pudieron cargar las preguntas.");
  adm.preguntas = data || [];
  pintarPreguntas();
  limpiarFormPregunta();
}

function pintarPreguntas() {
  pintarItems(el("lista-preguntas"), adm.preguntas, function (q) {
    const ops = Array.isArray(q.opciones) ? q.opciones : [];
    return { titulo: q.enunciado, detalle: "Correcta: " + (ops[q.respuesta_correcta] || "sin definir") };
  }, editarPregunta, eliminarPregunta, "Este curso aún no tiene preguntas. Agrega la primera con el formulario.");
  actualizarPestanas();
}

function limpiarFormPregunta() {
  adm.editandoPregunta = null;
  el("pregunta-form-titulo").textContent = "Agregar pregunta";
  el("q-enunciado").value = "";
  el("q-orden").value = siguienteOrden(adm.preguntas);
  for (let i = 0; i < NUM_OPCIONES; i++) {
    el("q-op-" + i).value = "";
    el("q-correcta-" + i).checked = false;
  }
}

function editarPregunta(q) {
  adm.editandoPregunta = q;
  el("pregunta-form-titulo").textContent = "Editar pregunta";
  el("q-enunciado").value = q.enunciado;
  el("q-orden").value = q.orden;
  const ops = Array.isArray(q.opciones) ? q.opciones : [];
  for (let i = 0; i < NUM_OPCIONES; i++) {
    el("q-op-" + i).value = ops[i] || "";
    el("q-correcta-" + i).checked = i === q.respuesta_correcta;
  }
  el("form-pregunta").scrollIntoView({ behavior: "smooth", block: "start" });
  el("q-enunciado").focus();
}

el("btn-cancelar-pregunta").addEventListener("click", limpiarFormPregunta);

el("form-pregunta").addEventListener("submit", async function (ev) {
  ev.preventDefault();
  const enunciado = el("q-enunciado").value.trim();
  if (enunciado.length < 5) return avisar("Escribe la pregunta.", "error");

  // Tomar solo las opciones escritas y recalcular la posición de la correcta
  const opciones = [];
  let correcta = -1;
  for (let i = 0; i < NUM_OPCIONES; i++) {
    const texto = el("q-op-" + i).value.trim();
    if (!texto) continue;
    if (el("q-correcta-" + i).checked) correcta = opciones.length;
    opciones.push(texto);
  }
  if (opciones.length < 2) return avisar("Escribe al menos 2 opciones de respuesta.", "error");
  if (correcta < 0) return avisar("Marca cuál es la opción correcta (el círculo a la izquierda de la opción).", "error");

  const datos = {
    enunciado: enunciado,
    orden: parseInt(el("q-orden").value, 10) || siguienteOrden(adm.preguntas),
    opciones: opciones,
    respuesta_correcta: correcta
  };

  const r = adm.editandoPregunta
    ? await nexusDb.from("cap_preguntas").update(datos).eq("id", adm.editandoPregunta.id)
    : await nexusDb.from("cap_preguntas").insert(Object.assign({ curso_id: adm.curso.id }, datos));
  if (r.error) return errorSupabase(r.error, "No se pudo guardar la pregunta.");

  avisar(adm.editandoPregunta ? "Pregunta actualizada." : "Pregunta agregada.");
  await cargarPreguntas();
});

async function eliminarPregunta(q) {
  if (!confirm("¿Eliminar la pregunta \"" + q.enunciado + "\"?")) return;
  const r = await nexusDb.from("cap_preguntas").delete().eq("id", q.id);
  if (r.error) return errorSupabase(r.error, "No se pudo eliminar la pregunta.");
  avisar("Pregunta eliminada.");
  await cargarPreguntas();
}

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------
function pintarItems(ol, items, describir, alEditar, alEliminar, textoVacio) {
  ol.innerHTML = "";
  if (items.length === 0) {
    const li = document.createElement("li");
    li.className = "vacio-lista";
    li.textContent = textoVacio;
    ol.appendChild(li);
    return;
  }
  items.forEach(function (item) {
    const d = describir(item);
    const li = document.createElement("li");
    li.className = "item";

    const num = document.createElement("span");
    num.className = "item-num";
    num.textContent = item.orden;

    const info = document.createElement("div");
    info.className = "item-info";
    const t = document.createElement("strong");
    t.textContent = d.titulo;
    const s = document.createElement("small");
    s.textContent = d.detalle;
    info.append(t, s);

    const editar = document.createElement("button");
    editar.type = "button";
    editar.className = "enlace-boton";
    editar.textContent = "Editar";
    editar.addEventListener("click", function () { alEditar(item); });

    const borrar = document.createElement("button");
    borrar.type = "button";
    borrar.className = "enlace-boton rojo";
    borrar.textContent = "Eliminar";
    borrar.addEventListener("click", function () { alEliminar(item); });

    li.append(num, info, editar, borrar);
    ol.appendChild(li);
  });
}

function siguienteOrden(lista) {
  return lista.reduce(function (m, x) { return Math.max(m, x.orden || 0); }, 0) + 1;
}
