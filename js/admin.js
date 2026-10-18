// =====================================================================
// NEXUS ACADEMY · PANEL DE ADMINISTRACIÓN DE CURSOS
// Carpeta: js/admin.js
// Crear y editar cursos, lecciones (con diapositivas PDF), preguntas y
// docentes. La misma página sirve a dos papeles:
//   · admin:   todo.
//   · docente: solo lecciones y preguntas de SUS programas (RLS filtra
//              los cursos; aquí solo se oculta lo que no le corresponde).
// =====================================================================

const adm = {
  papel: "admin",
  cursos: [],
  docentes: [],         // todos los docentes (solo admin)
  asignados: [],        // ids de docentes del curso seleccionado
  curso: null,          // curso seleccionado (null = nuevo)
  lecciones: [],
  preguntas: [],
  editandoLeccion: null,
  editandoPregunta: null,
  juegos: [],           // biblioteca de juegos (para el selector de la lección)
  pestana: "datos"
};

const el = (id) => document.getElementById(id);
const NUM_OPCIONES = 4;

// ---------------------------------------------------------------------
// Inicio
// ---------------------------------------------------------------------
(async function iniciar() {
  const acceso = await exigirPersonal();
  if (!acceso) return;
  adm.papel = acceso.papel;
  if (esDocente()) prepararModoDocente();

  mostrarUsuario(acceso.usuario, acceso.papel);
  el("cargando").hidden = true;
  el("panel").hidden = false;

  construirOpcionesPregunta();
  cargarJuegos();
  // admin.html?curso=<id> abre ese curso (viene del Salón de clases)
  const pedido = new URLSearchParams(location.search).get("curso");
  await cargarCursos(pedido || undefined);
})();

el("btn-salir").addEventListener("click", cerrarSesion);
el("btn-abrir-salon").addEventListener("click", function () {
  if (adm.curso) location.href = "aula.html?c=" + encodeURIComponent(adm.curso.id);
});

function esDocente() { return adm.papel === "docente"; }

// El docente ve sus programas en solo lectura y edita lecciones y preguntas
function prepararModoDocente() {
  document.body.classList.add("modo-docente");
  document.title = "Mis programas · Nexus Academy";
  el("marca-texto").textContent = "Mis programas";
  ["btn-nuevo-curso", "btn-eliminar-curso", "bloque-qr", "btn-guardar-curso"].forEach(function (id) {
    el(id).setAttribute("data-solo-admin", "");
  });
  el("form-curso").querySelectorAll("input, textarea").forEach(function (c) { c.disabled = true; });
  el("editor-vacio").querySelector("h2").textContent = "Elige uno de tus programas";
  el("editor-vacio").querySelector("p").textContent = "Puedes editar sus lecciones, diapositivas y preguntas.";
  adm.pestana = "lecciones";
}

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
  const CAMPOS = "id, titulo, descripcion, subtemas, horas, nota_minima, publicado, imagen, preguntas_por_evaluacion, creado_en";
  let { data, error } = await nexusDb
    .from("cap_cursos")
    .select(CAMPOS + ", video_url, archivo_pdf, enlaces")
    .order("creado_en", { ascending: true });
  adm.sinEnlaces = false;
  if (error && /enlaces/i.test(error.message || "")) {
    // Falta el SQL 30: todo funciona, menos los enlaces adicionales
    adm.sinEnlaces = true;
    ({ data, error } = await nexusDb.from("cap_cursos").select(CAMPOS + ", video_url, archivo_pdf").order("creado_en", { ascending: true }));
  }
  if (error && /video_url|archivo_pdf|column/i.test(error.message || "")) {
    // Aún no se ejecutó el SQL 29: el curso funciona sin video ni PDF propios
    adm.sinMaterialCurso = true;
    ({ data, error } = await nexusDb.from("cap_cursos").select(CAMPOS).order("creado_en", { ascending: true }));
  }
  if (error) return errorSupabase(error, "No se pudieron cargar los cursos.");

  adm.cursos = data || [];
  pintarListaCursos();

  // Docente con un solo programa: abrirlo directamente
  const unico = esDocente() && adm.cursos.length === 1 ? adm.cursos[0].id : null;
  const id = seleccionarId || (adm.curso && adm.curso.id) || unico;
  const curso = adm.cursos.find(function (c) { return c.id === id; });
  if (curso) seleccionarCurso(curso.id);
}

function pintarListaCursos() {
  const ul = el("cursos");
  ul.innerHTML = "";
  if (adm.cursos.length === 0) {
    const li = document.createElement("li");
    li.className = "vacio-lista";
    li.textContent = esDocente() ? "Aún no tienes programas asignados." : "Aún no hay cursos.";
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
  llenarFormularioCurso({ titulo: "", descripcion: "", subtemas: [], horas: 1, nota_minima: 70, publicado: true });
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
  if (!esDocente()) { cargarClavesCurso(adm.curso.id); cargarRegistrosCurso(adm.curso.id); }

  const cargas = [cargarLecciones(), cargarPreguntas()];
  if (!esDocente()) cargas.push(cargarDocentes());
  await Promise.all(cargas);
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
  document.querySelectorAll('.pestana[data-pestana="lecciones"], .pestana[data-pestana="preguntas"], .pestana[data-pestana="docentes"]').forEach(function (b) {
    b.disabled = !hayCurso;
    b.title = hayCurso ? "" : "Guarda primero el curso";
  });
  el("n-lecciones").textContent = hayCurso ? "(" + adm.lecciones.length + ")" : "";
  el("n-preguntas").textContent = hayCurso ? "(" + adm.preguntas.length + ")" : "";
  el("n-docentes").textContent = hayCurso && !esDocente() ? "(" + adm.asignados.length + ")" : "";
}

// ---------------------------------------------------------------------
// Enlaces de YouTube: acepta cualquier forma en que YouTube los comparte
// (youtube.com/watch, youtu.be, m.youtube.com, shorts, live, embed),
// con o sin https://. Devuelve el enlace limpio, "" si está vacío,
// o null si no es un video de YouTube válido.
// ---------------------------------------------------------------------
function normalizarYoutube(texto) {
  let t = String(texto || "").trim();
  if (!t) return "";
  if (!/^https?:\/\//i.test(t)) t = "https://" + t;
  let u;
  try { u = new URL(t); } catch (e) { return null; }
  const host = u.hostname.replace(/^(www|m|music)\./i, "").toLowerCase();
  let id = null;
  if (host === "youtu.be") id = u.pathname.slice(1, 12);
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = u.searchParams.get("v") || (u.pathname.match(/^\/(?:shorts|live|embed|v)\/([^/?#]{11})/) || [])[1] || null;
  }
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
  return "https://www.youtube.com/watch?v=" + id;
}

// ---------------------------------------------------------------------
// Datos del curso
// ---------------------------------------------------------------------
function llenarFormularioCurso(c) {
  el("c-titulo").value = c.titulo || "";
  el("c-descripcion").value = c.descripcion || "";
  el("c-subtemas").value = (c.subtemas || []).join("\n");
  el("c-horas").value = c.horas;
  el("c-nota").value = c.nota_minima;
  el("c-publicado").checked = Boolean(c.publicado);
  el("c-por-eval").value = c.preguntas_por_evaluacion || "";
  el("c-imagen").value = "";
  el("c-imagen-quitar").checked = false;
  el("c-imagen-quitar-caja").hidden = !c.imagen;
  el("c-video").value = c.video_url || "";
  el("c-enlaces").value = (Array.isArray(c.enlaces) ? c.enlaces : []).map(function (e) { return (e.titulo ? e.titulo + " | " : "") + e.url; }).join("\n");
  el("c-enlaces").disabled = Boolean(adm.sinMaterialCurso) || adm.sinEnlaces === true || esDocente();
  el("btn-abrir-salon").hidden = !c.id;
  mostrarPdfCurso(c.archivo_pdf || null);
  ["c-video", "c-pdf"].forEach(function (id) { el(id).disabled = Boolean(adm.sinMaterialCurso); });
  el("c-video-ayuda").textContent = adm.sinMaterialCurso
    ? "Para usar el video y el PDF del curso, primero ejecuta el SQL 29 en Supabase."
    : "Pega el enlace tal como lo copias de YouTube (botón Compartir). Lo verán los participantes al iniciar el curso.";
  pintarPortada(el("c-imagen-vista"), c.titulo || "Nuevo curso", c.imagen ? urlPortada(c.imagen) : null);
}

function mostrarPdfCurso(ruta) {
  el("c-pdf").value = "";
  el("c-pdf-quitar").checked = false;
  el("c-pdf-quitar-caja").hidden = !ruta;
  const actual = el("c-pdf-actual");
  actual.innerHTML = "";
  actual.hidden = !ruta;
  if (!ruta) return;
  const a = document.createElement("a");
  a.href = urlDiapositiva(ruta);
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = "Ver PDF actual";
  actual.append("Este curso ya tiene un PDF. ", a, ". Si eliges otro archivo, se reemplaza.");
}

// ---------------------------------------------------------------------
// Nueva clave desde el curso: elige empresa, fecha y horas; usa la
// capacitación (convocatoria) de esa empresa y ese día o la crea.
// ---------------------------------------------------------------------
const dosD = function (n) { return String(n).padStart(2, "0"); };
const fechaLocal = function (d) { return d.getFullYear() + "-" + dosD(d.getMonth() + 1) + "-" + dosD(d.getDate()); };
const horaLocal = function (d) { return dosD(d.getHours()) + ":" + dosD(d.getMinutes()); };

function modalidadClave() { return document.querySelector('input[name="k-modalidad"]:checked').value; }
function actualizarFormClave() {
  const v = modalidadClave() === "virtual";
  el("k-bloque-presencial").hidden = v;
  el("k-eval-caja").hidden = v;
  el("k-bloque-virtual").hidden = !v;
}
document.querySelectorAll('input[name="k-modalidad"]').forEach(function (r) { r.addEventListener("change", actualizarFormClave); });

function sugerirClaveEmpresa(nombre) {
  const letras = String(nombre || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z]/g, "");
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return (letras + "XXX").slice(0, 3) + String(10000 + (n[0] % 90000));
}

el("btn-nueva-clave-curso").addEventListener("click", async function () {
  const f = el("form-clave-curso");
  if (!f.hidden) { f.hidden = true; return; }
  const { data, error } = await nexusDb.from("cap_empresas").select("id, nombre, activa").order("nombre");
  if (error) return errorSupabase(error, "No se pudieron cargar las empresas.");
  const activas = (data || []).filter(function (e) { return e.activa !== false; });
  if (!activas.length) return avisar("No hay empresas activas. Créala primero en Empresas.", "error");
  const sel = el("k-empresa");
  sel.innerHTML = "";
  activas.forEach(function (e) {
    const o = document.createElement("option");
    o.value = e.id;
    o.textContent = e.nombre;
    sel.appendChild(o);
  });
  const ahora = new Date(), luego = new Date(Date.now() + 4 * 3600e3), quince = new Date(Date.now() + 15 * 864e5);
  el("k-fecha").value = fechaLocal(ahora);
  el("k-desde").value = horaLocal(ahora);
  el("k-hasta").value = luego.getDate() === ahora.getDate() ? horaLocal(luego) : "23:59";
  el("k-v-desde").value = fechaLocal(ahora);
  el("k-v-hasta").value = fechaLocal(quince);
  el("k-eval").checked = adm.preguntas.length > 0;
  el("k-clave").value = sugerirClaveEmpresa(activas[0].nombre);
  actualizarFormClave();
  f.hidden = false;
  sel.focus();
});
el("k-empresa").addEventListener("change", function () {
  el("k-clave").value = sugerirClaveEmpresa(el("k-empresa").selectedOptions[0].textContent);
});
el("btn-cancelar-clave-curso").addEventListener("click", function () { el("form-clave-curso").hidden = true; });

el("btn-crear-clave-curso").addEventListener("click", async function () {
  if (!adm.curso) return;
  const empresaId = el("k-empresa").value;
  const virtual = modalidadClave() === "virtual";
  const clave = String(el("k-clave").value || "").toUpperCase().replace(/\s/g, "");
  if (clave && !/^[A-Z0-9][A-Z0-9-]{2,10}[A-Z0-9]$/.test(clave)) return avisar("La clave debe tener de 4 a 12 letras o números, sin espacios ni símbolos.", "error");
  let desde, hasta, fecha = null;
  if (virtual) {
    if (!adm.lecciones.length || !adm.preguntas.length) return avisar("Para el acceso virtual el curso necesita lecciones y preguntas.", "error");
    desde = new Date(el("k-v-desde").value + "T00:00:00");
    hasta = new Date(el("k-v-hasta").value + "T23:59:59");
  } else {
    fecha = el("k-fecha").value;
    desde = new Date(fecha + "T" + el("k-desde").value);
    hasta = new Date(fecha + "T" + el("k-hasta").value);
    if (el("k-eval").checked && !adm.preguntas.length) return avisar("Este curso no tiene preguntas: desmarca la evaluación o agrega preguntas.", "error");
  }
  if (isNaN(desde) || isNaN(hasta) || !(hasta > desde)) return avisar("Revisa las fechas y horas: el final debe ser posterior al inicio.", "error");

  const boton = el("btn-crear-clave-curso");
  boton.disabled = true;
  try {
    // ¿Ya hay una capacitación de esta empresa con este curso para ese día (o virtual)?
    let q = nexusDb.from("cap_convocatorias").select("id, modalidad, fecha_capacitacion")
      .eq("empresa_id", empresaId).eq("curso_id", adm.curso.id).order("creado_en", { ascending: false });
    const { data: convs, error: e1 } = await q;
    if (e1) throw e1;
    let conv = (convs || []).find(function (c) {
      return virtual ? c.modalidad !== "presencial" : (c.modalidad !== "virtual" && c.fecha_capacitacion === fecha);
    });
    let creada = null;
    if (!conv) {
      const nueva = await nexusDb.from("cap_convocatorias").insert({
        empresa_id: empresaId, curso_id: adm.curso.id, modalidad: virtual ? "virtual" : "presencial",
        evaluacion_presencial: !virtual && el("k-eval").checked, fecha_capacitacion: fecha
      }).select().single();
      if (nueva.error) throw nueva.error;
      conv = creada = nueva.data;
    }
    const acc = await nexusDb.from("cap_accesos").insert(Object.assign({
      convocatoria_id: conv.id, tipo: virtual ? "virtual" : "presencial",
      valido_desde: desde.toISOString(), valido_hasta: hasta.toISOString()
    }, clave ? { codigo: clave } : {}));
    if (acc.error) {
      if (creada) await nexusDb.from("cap_convocatorias").delete().eq("id", creada.id);
      throw acc.error;
    }
    el("form-clave-curso").hidden = true;
    avisar("Clave creada" + (creada ? " (también se creó la capacitación en Empresas)." : "."));
    await cargarClavesCurso(adm.curso.id);
    cargarRegistrosCurso(adm.curso.id);
  } catch (e) {
    const msj = String(e.message || "");
    errorSupabase(e, /duplicate|unique|23505/i.test(msj + (e.code || "")) ? "Esa clave ya existe; escribe otra o deja el campo vacío." : "No se pudo crear la clave.");
  } finally {
    boton.disabled = false;
  }
});

// Claves vigentes y programadas del curso (debajo del QR permanente)
async function cargarClavesCurso(cursoId) {
  const ul = el("lista-claves-curso");
  ul.innerHTML = "";
  const cargando = document.createElement("li");
  cargando.className = "ayuda";
  cargando.textContent = "Buscando claves…";
  ul.appendChild(cargando);
  const { data, error } = await nexusDb.rpc("cap_salon_claves", { p_curso: cursoId });
  if (!adm.curso || adm.curso.id !== cursoId) return;
  ul.innerHTML = "";
  const nota = function (t) { const li = document.createElement("li"); li.className = "ayuda"; li.textContent = t; ul.appendChild(li); };
  if (error) return nota("Para ver aquí las claves, ejecuta los SQL 30 y 31 en Supabase.");
  if (!data || !data.length) return nota("Este curso no tiene claves vigentes ni programadas. Crea una con + Nueva clave.");
  data.forEach(function (k) {
    const li = document.createElement("li");
    li.className = "clave-curso " + k.estado + (k.empresa_activa === false ? " empresa-inactiva" : "");
    const codigo = document.createElement("strong");
    codigo.className = "clave-curso-codigo";
    codigo.textContent = k.codigo;
    const info = document.createElement("span");
    info.className = "clave-curso-info";
    const f = function (v) { return new Date(v).toLocaleString("es-EC", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); };
    info.textContent = k.empresa + " · " + (k.tipo === "virtual" ? "virtual" : "presencial") + " · del " + f(k.valido_desde) + " al " + f(k.valido_hasta);
    const estado = document.createElement("span");
    estado.className = "estado-clave " + k.estado;
    estado.textContent = k.empresa_activa === false ? "Empresa inactiva" : (k.estado === "vigente" ? "Vigente" : "Programada");
    const copiar = document.createElement("button");
    copiar.type = "button";
    copiar.className = "enlace-boton";
    copiar.textContent = "Copiar";
    copiar.addEventListener("click", function () {
      if (navigator.clipboard) navigator.clipboard.writeText(k.codigo).then(function () { avisar("Clave " + k.codigo + " copiada."); }, function () { window.prompt("Copia la clave:", k.codigo); });
      else window.prompt("Copia la clave:", k.codigo);
    });
    li.append(codigo, estado, info, copiar);
    ul.appendChild(li);
  });
}

// ---------------------------------------------------------------------
// Registro de asistencia del curso (todas las empresas o una capacitación)
// ---------------------------------------------------------------------
const MODALIDAD_CONV = { presencial: "Presencial", virtual: "Virtual", mixta: "Presencial y virtual" };
const ETNIAS_REG = {
  mestizo: "Mestizo", blanco: "Blanco", indigena: "Indígena", montubio: "Montubio",
  afroecuatoriano: "Afroecuatoriano", otro: "Otro", no_responde: "No declara"
};
adm.registros = { convs: [], filas: [] };

function fechaCorta(v) {
  if (!v) return "";
  const t = String(v);
  const d = t.length === 10 ? new Date(t + "T12:00:00") : new Date(t);
  return d.toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fechaHoraReg(v) {
  return v ? new Date(v).toLocaleString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
}
function edadReg(nac, fecha) {
  if (!nac) return "";
  const n = String(nac).slice(0, 10).split("-").map(Number);
  const f = new Date(fecha || Date.now());
  let e = f.getFullYear() - n[0];
  if (f.getMonth() + 1 < n[1] || (f.getMonth() + 1 === n[1] && f.getDate() < n[2])) e--;
  return e >= 0 && e < 120 ? e : "";
}

async function cargarRegistrosCurso(cursoId) {
  const sel = el("r-conv");
  sel.innerHTML = "<option>Cargando…</option>";
  el("r-filas").innerHTML = "";
  el("r-cifras").innerHTML = "";
  const { data, error } = await nexusDb.from("cap_convocatorias")
    .select("id, modalidad, horas, fecha_capacitacion, creado_en, cap_empresas(nombre, ruc)")
    .eq("curso_id", cursoId)
    .order("fecha_capacitacion", { ascending: false, nullsFirst: false });
  if (!adm.curso || adm.curso.id !== cursoId) return;
  sel.innerHTML = "";
  if (error) { sel.innerHTML = "<option>No se pudo cargar</option>"; return errorSupabase(error, "No se pudo cargar el registro de asistencia."); }
  adm.registros.convs = data || [];
  const opt = function (v, t) { const o = document.createElement("option"); o.value = v; o.textContent = t; sel.appendChild(o); };
  if (!adm.registros.convs.length) {
    opt("", "Este curso aún no tiene capacitaciones");
    pintarRegistros();
    return;
  }
  opt("todas", "Todas las capacitaciones (" + adm.registros.convs.length + ")");
  adm.registros.convs.forEach(function (c) {
    const emp = c.cap_empresas ? c.cap_empresas.nombre : "Empresa";
    opt(c.id, emp + " · " + (c.fecha_capacitacion ? fechaCorta(c.fecha_capacitacion) : "sin fecha") + " · " + (MODALIDAD_CONV[c.modalidad] || c.modalidad));
  });
  // Por defecto la capacitación más reciente
  sel.value = adm.registros.convs[0].id;
  await cargarFilasRegistro();
}

async function cargarFilasRegistro() {
  const v = el("r-conv").value;
  const convs = v === "todas" ? adm.registros.convs : adm.registros.convs.filter(function (c) { return c.id === v; });
  adm.registros.filas = [];
  if (!convs.length) return pintarRegistros();
  el("r-filas").innerHTML = '<tr><td colspan="8" class="vacio-lista">Cargando…</td></tr>';
  const ids = convs.map(function (c) { return c.id; });
  const [insc, certs, intentos] = await Promise.all([
    nexusDb.from("cap_inscripciones").select("id, convocatoria_id, cedula, nombres, correo, modalidad, creado_en, sexo, fecha_nacimiento, etnia").in("convocatoria_id", ids).order("nombres"),
    nexusDb.from("cap_certificados").select("id, codigo, cedula, inscripcion_id, convocatoria_id, tipo, nota, emitido_en").in("convocatoria_id", ids),
    nexusDb.from("cap_intentos").select("inscripcion_id, nota").in("convocatoria_id", ids)
  ]);
  if (el("r-conv").value !== v) return;
  const fallo = insc.error || certs.error || intentos.error;
  if (fallo) { el("r-filas").innerHTML = ""; return errorSupabase(fallo, "No se pudo cargar el registro de asistencia."); }
  const porConv = {};
  convs.forEach(function (c) { porConv[c.id] = c; });
  adm.registros.filas = insc.data.map(function (i) {
    const c = porConv[i.convocatoria_id] || {};
    const cert = certs.data.find(function (x) { return x.inscripcion_id === i.id || (x.cedula === i.cedula && x.convocatoria_id === i.convocatoria_id); });
    const suyos = intentos.data.filter(function (x) { return x.inscripcion_id === i.id; });
    const mejor = suyos.reduce(function (m, x) { return Math.max(m, Number(x.nota)); }, -1);
    let estado, clase;
    if (cert) { estado = cert.tipo === "asistencia" ? "Asistencia certificada" : "Aprobado"; clase = "vigente"; }
    else if (suyos.length) { estado = "No aprobado (" + suyos.length + (suyos.length === 1 ? " intento)" : " intentos)"); clase = "anulado"; }
    else { estado = "Pendiente"; clase = "programado"; }
    return {
      nombres: i.nombres, cedula: i.cedula, correo: i.correo || "",
      sexo: i.sexo || "", edad: edadReg(i.fecha_nacimiento, i.creado_en), etnia: ETNIAS_REG[i.etnia] || "",
      empresa: c.cap_empresas ? c.cap_empresas.nombre : "", ruc: c.cap_empresas ? (c.cap_empresas.ruc || "") : "",
      fecha: c.fecha_capacitacion || "", horas: c.horas || adm.curso.horas || "",
      modalidad: i.modalidad === "presencial" ? "Presencial" : "Virtual",
      registro: i.creado_en, estado: estado, clase: clase,
      nota: cert && cert.nota !== null ? Number(cert.nota) : (mejor >= 0 ? mejor : null),
      intentos: suyos.length, certificado: cert ? cert.codigo : "", emitido: cert ? cert.emitido_en : null
    };
  });
  pintarRegistros();
}

function pintarRegistros() {
  const filas = adm.registros.filas;
  const cif = el("r-cifras");
  cif.innerHTML = "";
  const cert = filas.filter(function (f) { return f.certificado; }).length;
  [["Registrados", filas.length], ["Con certificado", cert], ["Hombres", filas.filter(function (f) { return f.sexo === "M"; }).length],
   ["Mujeres", filas.filter(function (f) { return f.sexo === "F"; }).length], ["Pendientes o no aprobados", filas.length - cert]]
    .forEach(function (d) {
      const div = document.createElement("div");
      div.className = "r-cifra";
      const n = document.createElement("strong"); n.textContent = d[1];
      const t = document.createElement("span"); t.textContent = d[0];
      div.append(n, t);
      cif.appendChild(div);
    });

  const tbody = el("r-filas");
  tbody.innerHTML = "";
  const q = el("r-buscar").value.trim().toLowerCase();
  const vis = filas.filter(function (f) { return !q || f.nombres.toLowerCase().includes(q) || f.cedula.includes(q); });
  if (!vis.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 8; td.className = "vacio-lista";
    td.textContent = filas.length ? "Nadie coincide con la búsqueda." : "Todavía nadie se ha registrado.";
    tr.appendChild(td); tbody.appendChild(tr);
    return;
  }
  vis.forEach(function (f) {
    const tr = document.createElement("tr");
    [f.nombres, f.cedula, f.empresa, f.fecha ? fechaCorta(f.fecha) : "—", f.modalidad, null,
     f.nota === null ? "—" : (Math.round(f.nota * 10) / 10) + " %", f.certificado || "—"].forEach(function (v, i) {
      const td = document.createElement("td");
      if (i === 5) { const s = document.createElement("span"); s.className = "estado-clave " + f.clase; s.textContent = f.estado; td.appendChild(s); }
      else td.textContent = v;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

el("r-conv").addEventListener("change", cargarFilasRegistro);
el("r-buscar").addEventListener("input", pintarRegistros);

el("btn-registros-excel").addEventListener("click", async function () {
  if (!adm.registros.filas.length) return avisar("No hay registros para descargar.", "error");
  try { await cargarXLSX(); } catch (e) { return avisar("No se pudo cargar el generador de Excel. Revisa tu conexión.", "error"); }
  const todas = el("r-conv").value === "todas";
  const filas = adm.registros.filas.map(function (f, n) {
    return {
      "N°": n + 1, "Nombres": f.nombres, "Cédula": f.cedula, "Correo": f.correo, "Sexo": f.sexo, "Edad": f.edad,
      "Autoidentificación étnica": f.etnia, "Empresa": f.empresa, "RUC": f.ruc,
      "Fecha de la capacitación": f.fecha ? fechaCorta(f.fecha) : "", "Horas": Number(f.horas) || "",
      "Modalidad": f.modalidad, "Fecha de registro": fechaHoraReg(f.registro), "Estado": f.estado,
      "Nota (%)": f.nota === null ? "" : f.nota, "Intentos": f.intentos,
      "Código de certificado": f.certificado, "Fecha del certificado": fechaHoraReg(f.emitido), "Firma": ""
    };
  });
  const cert = adm.registros.filas.filter(function (f) { return f.certificado; }).length;
  const resumen = [
    ["Curso", adm.curso.titulo],
    ["Capacitación", el("r-conv").selectedOptions[0].textContent],
    ["Registrados", adm.registros.filas.length],
    ["Con certificado", cert],
    ["Hombres", adm.registros.filas.filter(function (f) { return f.sexo === "M"; }).length],
    ["Mujeres", adm.registros.filas.filter(function (f) { return f.sexo === "F"; }).length],
    ["Generado el", fechaHoraReg(new Date().toISOString())]
  ];
  const libro = XLSX.utils.book_new();
  const hoja = XLSX.utils.json_to_sheet(filas);
  hoja["!cols"] = [{ wch: 4 }, { wch: 34 }, { wch: 13 }, { wch: 26 }, { wch: 5 }, { wch: 5 }, { wch: 16 }, { wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 6 }, { wch: 11 }, { wch: 17 }, { wch: 22 }, { wch: 8 }, { wch: 8 }, { wch: 20 }, { wch: 17 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(libro, hoja, "Asistencia");
  const hojaRes = XLSX.utils.aoa_to_sheet(resumen);
  hojaRes["!cols"] = [{ wch: 18 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(libro, hojaRes, "Resumen");
  const etiqueta = todas ? "Todas" : el("r-conv").selectedOptions[0].textContent;
  const nombre = ("Asistencia_" + adm.curso.titulo + "_" + etiqueta)
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").slice(0, 90);
  XLSX.writeFile(libro, nombre + ".xlsx");
});

function urlPortada(ruta) {
  return nexusDb.storage.from("portadas").getPublicUrl(ruta).data.publicUrl;
}

// Sube la portada a <id-del-curso>/<aleatorio>.<ext> y devuelve la ruta
async function subirPortada(cursoId, archivo) {
  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[archivo.type] || "jpg";
  const id = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now());
  const ruta = cursoId + "/" + id + "." + ext;
  const { error } = await nexusDb.storage.from("portadas").upload(ruta, archivo, { contentType: archivo.type, upsert: false });
  if (error) throw error;
  return ruta;
}

async function borrarPortada(ruta) {
  if (!ruta) return;
  const { error } = await nexusDb.storage.from("portadas").remove([ruta]);
  if (error) console.warn("No se pudo borrar la portada anterior", error);
}

el("c-imagen").addEventListener("change", function () {
  const archivo = el("c-imagen").files[0];
  if (archivo) pintarPortada(el("c-imagen-vista"), el("c-titulo").value || "Curso", URL.createObjectURL(archivo));
});

el("form-curso").addEventListener("submit", async function (ev) {
  ev.preventDefault();
  if (esDocente()) return;
  const datos = {
    titulo: el("c-titulo").value.trim(),
    descripcion: el("c-descripcion").value.trim(),
    subtemas: el("c-subtemas").value.split("\n").map(function (t) { return t.trim(); }).filter(Boolean).slice(0, 30),
    horas: Number(el("c-horas").value),
    nota_minima: Number(el("c-nota").value),
    publicado: el("c-publicado").checked,
    preguntas_por_evaluacion: el("c-por-eval").value ? parseInt(el("c-por-eval").value, 10) : null
  };

  if (datos.titulo.length < 5) return avisar("Escribe un título de al menos 5 caracteres.", "error");
  if (!(datos.horas > 0)) return avisar("Las horas deben ser mayores que 0.", "error");
  if (!(datos.nota_minima >= 1 && datos.nota_minima <= 100)) return avisar("La nota mínima debe estar entre 1 y 100.", "error");
  if (datos.preguntas_por_evaluacion !== null && !(datos.preguntas_por_evaluacion >= 5 && datos.preguntas_por_evaluacion <= 8)) {
    return avisar("Las preguntas por evaluación deben ser de 5 a 8 (o vacío para usar 8).", "error");
  }

  const imagen = el("c-imagen").files[0] || null;
  if (imagen) {
    if (!/^image\/(jpeg|png|webp)$/.test(imagen.type)) return avisar("La portada debe ser JPG, PNG o WEBP.", "error");
    if (imagen.size > 2 * 1024 * 1024) return avisar("La portada pesa más de 2 MB. Redúcela e inténtalo de nuevo.", "error");
  }
  // Video y PDF del curso
  let pdfCurso = null;
  if (!adm.sinMaterialCurso) {
    const video = normalizarYoutube(el("c-video").value);
    if (video === null) return avisar("Ese enlace no es un video de YouTube. Cópialo desde YouTube con el botón Compartir, por ejemplo https://youtu.be/abc123XYZ00", "error");
    datos.video_url = video || null;
    el("c-video").value = video;
    if (!adm.sinEnlaces) {
      const enlaces = [];
      let malo = "";
      el("c-enlaces").value.split("\n").map(function (l) { return l.trim(); }).filter(Boolean).forEach(function (l, i) {
        const partes = l.split("|").map(function (x) { return x.trim(); });
        let url = partes.length > 1 ? partes.slice(1).join("|").trim() : partes[0];
        const titulo = partes.length > 1 ? partes[0] : "";
        if (!/^https?:\/\//i.test(url)) url = "https://" + url;
        try { new URL(url); } catch (e) { malo = malo || "La línea " + (i + 1) + " de los enlaces adicionales no es una dirección válida."; return; }
        enlaces.push({ titulo: titulo.slice(0, 120), url: url.slice(0, 500) });
      });
      if (malo) return avisar(malo, "error");
      if (enlaces.length > 15) return avisar("Puedes agregar hasta 15 enlaces adicionales.", "error");
      datos.enlaces = enlaces;
    }
    pdfCurso = el("c-pdf").files[0] || null;
    if (pdfCurso) {
      if (pdfCurso.type !== "application/pdf" && !/\.pdf$/i.test(pdfCurso.name)) return avisar("El material debe ser un archivo PDF.", "error");
      if (pdfCurso.size > 20 * 1024 * 1024) return avisar("El PDF pesa más de 20 MB. Redúcelo (por ejemplo, guardándolo con menor calidad) e inténtalo de nuevo.", "error");
    }
    if (!pdfCurso && adm.curso && adm.curso.archivo_pdf && el("c-pdf-quitar").checked) datos.archivo_pdf = null;
  }
  const pdfAnterior = adm.curso ? adm.curso.archivo_pdf : null;
  const portadaAnterior = adm.curso ? adm.curso.imagen : null;
  if (!imagen && portadaAnterior && el("c-imagen-quitar").checked) datos.imagen = null;

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

  // Portada: se sube cuando el curso ya tiene id
  if (imagen) {
    try {
      const ruta = await subirPortada(resp.data.id, imagen);
      const u = await nexusDb.from("cap_cursos").update({ imagen: ruta }).eq("id", resp.data.id).select().single();
      if (u.error) { await borrarPortada(ruta); throw u.error; }
      resp.data = u.data;
      await borrarPortada(portadaAnterior);
    } catch (e) {
      errorSupabase(e, "El curso se guardó, pero no se pudo subir la portada.");
    }
  } else if (portadaAnterior && datos.imagen === null) {
    await borrarPortada(portadaAnterior);
  }

  // PDF del curso: se sube cuando el curso ya tiene id (misma carpeta que las diapositivas)
  if (pdfCurso) {
    boton.disabled = true;
    boton.textContent = "Subiendo PDF…";
    let ruta = null;
    try {
      const id = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()) + Math.random().toString(16).slice(2);
      ruta = resp.data.id + "/curso-" + id + ".pdf";
      const sub = await nexusDb.storage.from("diapositivas").upload(ruta, pdfCurso, { contentType: "application/pdf", upsert: false });
      if (sub.error) throw sub.error;
      const u = await nexusDb.from("cap_cursos").update({ archivo_pdf: ruta }).eq("id", resp.data.id).select().single();
      if (u.error) throw u.error;
      resp.data = u.data;
      await borrarDiapositiva(pdfAnterior);
    } catch (e) {
      if (ruta) await borrarDiapositiva(ruta);
      errorSupabase(e, "El curso se guardó, pero no se pudo subir el PDF.");
    }
    boton.disabled = false;
    boton.textContent = "Guardar curso";
  } else if (pdfAnterior && datos.archivo_pdf === null) {
    await borrarDiapositiva(pdfAnterior);
  }

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
    .select("id, orden, titulo, contenido, video_url, archivo_pdf, juego_id")
    .eq("curso_id", adm.curso.id)
    .order("orden", { ascending: true });
  if (error) return errorSupabase(error, "No se pudieron cargar las lecciones.");
  adm.lecciones = data || [];
  pintarLecciones();
  limpiarFormLeccion();
}

function pintarLecciones() {
  pintarItems(el("lista-lecciones"), adm.lecciones, function (l) {
    const partes = [];
    if (l.video_url) partes.push("video");
    if (l.archivo_pdf) partes.push("diapositivas PDF");
    let detalle = partes.length ? "Con " + partes.join(" y ") : "Solo texto";
    if (l.juego_id) {
      const j = adm.juegos.find(function (x) { return x.id === l.juego_id; });
      detalle += " · Juego: " + (j ? j.titulo : "asignado");
    }
    return { titulo: l.titulo, detalle: detalle };
  }, editarLeccion, eliminarLeccion, "Este curso aún no tiene lecciones. Agrega la primera con el formulario.");
  actualizarPestanas();
}

function limpiarFormLeccion() {
  adm.editandoLeccion = null;
  el("leccion-form-titulo").textContent = "Agregar lección";
  el("l-titulo").value = "";
  el("l-video").value = "";
  el("l-extra").open = false;
  el("l-contenido").value = "";
  el("l-juego").value = "";
  el("l-orden").value = siguienteOrden(adm.lecciones);
  mostrarPdfActual(null);
}

// Diapositiva actual de la lección en edición
function mostrarPdfActual(ruta) {
  el("l-pdf").value = "";
  el("l-pdf-quitar").checked = false;
  el("l-pdf-quitar-caja").hidden = !ruta;
  const actual = el("l-pdf-actual");
  actual.innerHTML = "";
  actual.hidden = !ruta;
  if (!ruta) return;
  const a = document.createElement("a");
  a.href = urlDiapositiva(ruta);
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = "Ver diapositivas actuales";
  actual.append("Esta lección ya tiene diapositivas. ", a, ". Si eliges otro archivo, se reemplazan.");
}

function urlDiapositiva(ruta) {
  return nexusDb.storage.from("diapositivas").getPublicUrl(ruta).data.publicUrl;
}

// Sube el PDF a <id-del-curso>/<aleatorio>.pdf (ruta que exigen las reglas)
async function subirDiapositiva(archivo) {
  const id = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()) + Math.random().toString(16).slice(2);
  const ruta = adm.curso.id + "/" + id + ".pdf";
  const { error } = await nexusDb.storage.from("diapositivas")
    .upload(ruta, archivo, { contentType: "application/pdf", upsert: false });
  if (error) throw error;
  return ruta;
}

async function borrarDiapositiva(ruta) {
  if (!ruta) return;
  const { error } = await nexusDb.storage.from("diapositivas").remove([ruta]);
  if (error) console.warn("No se pudo borrar el PDF anterior", error);
}

function editarLeccion(l) {
  adm.editandoLeccion = l;
  el("leccion-form-titulo").textContent = "Editar lección";
  el("l-titulo").value = l.titulo;
  el("l-orden").value = l.orden;
  el("l-video").value = l.video_url || "";
  el("l-extra").open = Boolean(l.video_url || l.archivo_pdf);
  el("l-contenido").value = l.contenido || "";
  el("l-juego").value = l.juego_id || "";
  mostrarPdfActual(l.archivo_pdf);
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
    contenido: el("l-contenido").value.trim(),
    juego_id: el("l-juego").value || null
  };
  if (datos.titulo.length < 3) return avisar("Escribe el título de la lección.", "error");
  if (datos.video_url) {
    const v = normalizarYoutube(datos.video_url);
    if (v === null) return avisar("Ese enlace no es un video de YouTube. Cópialo desde YouTube con el botón Compartir, por ejemplo https://youtu.be/abc123XYZ00", "error");
    datos.video_url = v;
    el("l-video").value = v;
  }

  const archivo = el("l-pdf").files[0] || null;
  if (archivo) {
    if (archivo.type !== "application/pdf" && !/\.pdf$/i.test(archivo.name)) return avisar("Las diapositivas deben ser un archivo PDF.", "error");
    if (archivo.size > 20 * 1024 * 1024) return avisar("El PDF pesa más de 20 MB. Redúcelo (por ejemplo, exportándolo con calidad menor) e inténtalo de nuevo.", "error");
  }

  const boton = el("btn-guardar-leccion");
  boton.disabled = true;
  boton.textContent = archivo ? "Subiendo PDF…" : "Guardando…";

  const anterior = adm.editandoLeccion ? adm.editandoLeccion.archivo_pdf : null;
  let nuevaRuta = null;
  try {
    if (archivo) {
      nuevaRuta = await subirDiapositiva(archivo);
      datos.archivo_pdf = nuevaRuta;
    } else if (anterior && el("l-pdf-quitar").checked) {
      datos.archivo_pdf = null;
    }

    const r = adm.editandoLeccion
      ? await nexusDb.from("cap_lecciones").update(datos).eq("id", adm.editandoLeccion.id)
      : await nexusDb.from("cap_lecciones").insert(Object.assign({ curso_id: adm.curso.id }, datos));
    if (r.error) throw r.error;
  } catch (e) {
    if (nuevaRuta) await borrarDiapositiva(nuevaRuta);   // no dejar archivos huérfanos
    boton.disabled = false;
    boton.textContent = "Guardar lección";
    return errorSupabase(e, "No se pudo guardar la lección.");
  }

  // El PDF anterior ya no se usa: se borra
  if (anterior && "archivo_pdf" in datos) await borrarDiapositiva(anterior);

  boton.disabled = false;
  boton.textContent = "Guardar lección";
  avisar(adm.editandoLeccion ? "Lección actualizada." : "Lección agregada.");
  await cargarLecciones();
});

// Biblioteca de juegos para el selector "Juego (opcional)".
// Si aún no se ejecutó el archivo 23, el selector se oculta.
async function cargarJuegos() {
  const { data, error } = await nexusDb.from("cap_juegos").select("id, tipo, titulo").order("titulo");
  const sel = el("l-juego");
  if (error) {
    console.warn("Juegos no disponibles", error);
    [sel, sel.previousElementSibling, sel.nextElementSibling].forEach(function (x) { x.hidden = true; });
    return;
  }
  adm.juegos = data || [];
  sel.length = 1;
  adm.juegos.forEach(function (j) {
    const o = document.createElement("option");
    o.value = j.id;
    o.textContent = j.titulo + " (" + (NexusJuegos.NOMBRES[j.tipo] || j.tipo) + ")";
    sel.appendChild(o);
  });
  if (adm.curso) pintarLecciones();
}

async function eliminarLeccion(l) {
  if (!confirm("¿Eliminar la lección \"" + l.titulo + "\"?")) return;
  const r = await nexusDb.from("cap_lecciones").delete().eq("id", l.id);
  if (r.error) return errorSupabase(r.error, "No se pudo eliminar la lección.");
  await borrarDiapositiva(l.archivo_pdf);
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
  }, editarPregunta, eliminarPregunta, "Este curso aún no tiene preguntas. Agrégalas con el formulario o con \"Cargar varias preguntas\".");
  pintarResumenBanco();
  actualizarPestanas();
}

// "Banco: 20 preguntas · cada estudiante recibe 8 al azar (5 en jornadas)"
function pintarResumenBanco() {
  const n = adm.preguntas.length;
  const k = (adm.curso && adm.curso.preguntas_por_evaluacion) || 8;
  let texto = "Banco: " + n + (n === 1 ? " pregunta" : " preguntas") + " · ";
  if (n === 0) texto += "agrega preguntas para poder pedir evaluación.";
  else if (n <= 5) texto += "cada estudiante responde las " + n + ". Agrega más para que salgan al azar (recomendado: 15 o más).";
  else if (n <= k) texto += "cada estudiante responde las " + n + " (en jornadas, 5 al azar). Agrega más para que varíen.";
  else texto += "cada estudiante recibe " + k + " al azar en cada intento (en jornadas, 5).";
  el("banco-resumen").textContent = texto;
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
// Docentes del programa (solo administradores)
// ---------------------------------------------------------------------
async function cargarDocentes() {
  const [todos, propios] = await Promise.all([
    nexusDb.from("cap_docentes")
      .select("id, cedula, nombres, correo, origen, vigente_hasta, activo, user_id")
      .order("nombres", { ascending: true }),
    nexusDb.from("cap_docente_cursos").select("docente_id").eq("curso_id", adm.curso.id)
  ]);
  if (todos.error) return errorSupabase(todos.error, "No se pudieron cargar los docentes.");
  if (propios.error) return errorSupabase(propios.error, "No se pudieron cargar los docentes del programa.");
  adm.docentes = todos.data || [];
  adm.asignados = (propios.data || []).map(function (r) { return r.docente_id; });
  pintarDocentes();
}

function pintarDocentes() {
  const hoy = new Date().toISOString().slice(0, 10);
  const lista = adm.docentes
    .filter(function (d) { return adm.asignados.includes(d.id); })
    .map(function (d, i) { return Object.assign({ orden: i + 1 }, d); });

  pintarItems(el("lista-docentes"), lista, function (d) {
    const partes = ["Cédula " + d.cedula, d.origen === "nexus" ? "Equipo NEXUS" : "Externo"];
    if (!d.activo) partes.push("INACTIVO");
    else if (d.vigente_hasta && d.vigente_hasta < hoy) partes.push("acceso vencido el " + d.vigente_hasta);
    else if (d.vigente_hasta) partes.push("acceso hasta " + d.vigente_hasta);
    if (!d.user_id) partes.push("aún no ha ingresado");
    return { titulo: d.nombres, detalle: partes.join(" · ") };
  }, alternarDocente, quitarDocente, "Este programa aún no tiene docentes asignados.",
  {
    editar: function (d) { return d.activo ? "Desactivar" : "Activar"; },
    eliminar: "Quitar",
    // Docentes externos (sin NEXUS): contraseña para entrar con su cédula
    extra: { texto: "Contraseña", mostrar: function (d) { return d.origen === "externo"; }, accion: claveDocente }
  });

  // Opciones: docentes registrados que aún no están en este programa
  const sel = el("d-existente");
  sel.innerHTML = "";
  sel.appendChild(new Option("— Registrar un docente nuevo —", ""));
  adm.docentes.forEach(function (d) {
    if (!adm.asignados.includes(d.id)) sel.appendChild(new Option(d.nombres + " · " + d.cedula, d.id));
  });
  el("d-nuevo").hidden = false;
  ["d-nombres", "d-cedula", "d-correo", "d-vigencia"].forEach(function (id) { el(id).value = ""; });
  el("d-origen").value = "nexus";
  actualizarPestanas();
}

el("d-existente").addEventListener("change", function () {
  el("d-nuevo").hidden = Boolean(el("d-existente").value);
});

el("form-docente").addEventListener("submit", async function (ev) {
  ev.preventDefault();
  if (esDocente() || !adm.curso) return;
  let docenteId = el("d-existente").value;

  const boton = el("btn-guardar-docente");
  boton.disabled = true;
  try {
    if (!docenteId) {
      const nuevo = {
        nombres: el("d-nombres").value.trim().replace(/\s+/g, " "),
        cedula: el("d-cedula").value.replace(/\D/g, ""),
        correo: el("d-correo").value.trim() || null,
        origen: el("d-origen").value,
        vigente_hasta: el("d-vigencia").value || null
      };
      if (nuevo.nombres.length < 5) return avisar("Escribe los nombres y apellidos del docente.", "error");
      if (!/^[0-9]{10}$/.test(nuevo.cedula)) return avisar("La cédula debe tener 10 dígitos.", "error");
      const r = await nexusDb.from("cap_docentes").insert(nuevo).select("id").single();
      if (r.error) {
        if (r.error.code === "23505") return avisar("Ya existe un docente con esa cédula: elígelo en \"Docente registrado\".", "error");
        return errorSupabase(r.error, "No se pudo registrar el docente.");
      }
      docenteId = r.data.id;
    }
    const a = await nexusDb.from("cap_docente_cursos").insert({ docente_id: docenteId, curso_id: adm.curso.id });
    if (a.error && a.error.code !== "23505") return errorSupabase(a.error, "No se pudo asignar el docente.");
    avisar("Docente asignado al programa.");
    await cargarDocentes();
  } finally {
    boton.disabled = false;
  }
});

async function alternarDocente(d) {
  const texto = d.activo
    ? "¿Desactivar a " + d.nombres + "? Dejará de poder editar TODOS sus programas."
    : "¿Activar de nuevo a " + d.nombres + "?";
  if (!confirm(texto)) return;
  const r = await nexusDb.from("cap_docentes").update({ activo: !d.activo }).eq("id", d.id);
  if (r.error) return errorSupabase(r.error, "No se pudo cambiar el estado del docente.");
  avisar(d.activo ? "Docente desactivado." : "Docente activado.");
  await cargarDocentes();
}

// Crea o cambia la contraseña de un docente externo (lo hace el puente,
// que es el único que puede crear cuentas). Entra por login.html con su cédula.
async function claveDocente(d) {
  const clave = prompt("Nueva contraseña para " + d.nombres + " (mínimo 8 caracteres).\nEntrará en \"Iniciar sesión > Docente\" con su cédula " + d.cedula + " y esta contraseña.");
  if (clave === null) return;
  if (clave.length < 8) return avisar("La contraseña debe tener al menos 8 caracteres.", "error");
  const { data, error } = await nexusDb.functions.invoke("puente-nexus", {
    body: { accion: "cuenta_docente", cedula: d.cedula, clave: clave }
  });
  if (error) {
    let detalle = error.message;
    try { detalle = (await error.context.json()).error || detalle; } catch (e) { /* sin detalle */ }
    return avisar("No se pudo guardar la contraseña. " + detalle, "error");
  }
  if (!data || !data.ok) return avisar("No se pudo guardar la contraseña.", "error");
  avisar("Contraseña guardada. " + d.nombres + " ya puede entrar con su cédula.");
  await cargarDocentes();
}

async function quitarDocente(d) {
  if (!confirm("¿Quitar a " + d.nombres + " de este programa? Seguirá registrado y conservará sus otros programas.")) return;
  const r = await nexusDb.from("cap_docente_cursos").delete()
    .eq("docente_id", d.id).eq("curso_id", adm.curso.id);
  if (r.error) return errorSupabase(r.error, "No se pudo quitar el docente.");
  avisar("Docente quitado del programa.");
  await cargarDocentes();
}

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------
// etiquetas (opcional): { editar: texto o función(item), eliminar: texto,
//                         extra: { texto, mostrar(item), accion(item) } }
function pintarItems(ol, items, describir, alEditar, alEliminar, textoVacio, etiquetas) {
  etiquetas = etiquetas || {};
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
    editar.textContent = typeof etiquetas.editar === "function" ? etiquetas.editar(item) : (etiquetas.editar || "Editar");
    editar.addEventListener("click", function () { alEditar(item); });

    const borrar = document.createElement("button");
    borrar.type = "button";
    borrar.className = "enlace-boton rojo";
    borrar.textContent = etiquetas.eliminar || "Eliminar";
    borrar.addEventListener("click", function () { alEliminar(item); });

    li.append(num, info);
    if (etiquetas.extra && etiquetas.extra.mostrar(item)) {
      const extra = document.createElement("button");
      extra.type = "button";
      extra.className = "enlace-boton";
      extra.textContent = etiquetas.extra.texto;
      extra.addEventListener("click", function () { etiquetas.extra.accion(item); });
      li.appendChild(extra);
    }
    li.append(editar, borrar);
    ol.appendChild(li);
  });
}

function siguienteOrden(lista) {
  return lista.reduce(function (m, x) { return Math.max(m, x.orden || 0); }, 0) + 1;
}

// Enter dentro del formulario de la clave crea la clave (no guarda el curso)
el("form-clave-curso").addEventListener("keydown", function (ev) {
  if (ev.key === "Enter" && ev.target.tagName === "INPUT") {
    ev.preventDefault();
    el("btn-crear-clave-curso").click();
  }
});
