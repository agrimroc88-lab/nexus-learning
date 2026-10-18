// =====================================================================
// NEXUS ACADEMY · EMPRESAS, CAPACITACIONES Y NÓMINAS
// Carpeta: js/empresas.js
// =====================================================================

const emp = {
  lista: [],
  actual: null,     // empresa seleccionada (null = nueva)
  cursos: [],
  convs: [],
  jornadas: [],
  nomina: null      // { conv, filas }
};

const el = (id) => document.getElementById(id);
const BASE_SITIO = location.origin + location.pathname.replace(/[^/]*$/, "");

// ---------------------------------------------------------------------
// Inicio
// ---------------------------------------------------------------------
(async function iniciar() {
  const usuario = await exigirAdministrador();
  if (!usuario) return;
  mostrarUsuario(usuario, "admin");
  el("cargando").hidden = true;
  el("panel").hidden = false;
  await Promise.all([cargarCursos(), cargarEmpresas()]);
})();

el("btn-salir").addEventListener("click", cerrarSesion);

function avisar(texto, tipo) {
  const aviso = el("aviso");
  aviso.textContent = texto;
  aviso.className = "aviso " + (tipo || "ok");
  aviso.hidden = false;
  aviso.scrollIntoView({ behavior: "smooth", block: "nearest" });
  clearTimeout(avisar.t);
  avisar.t = setTimeout(function () { aviso.hidden = true; }, tipo === "error" ? 9000 : 4000);
}

function errorSupabase(e, texto) {
  console.error(e);
  let detalle = e.message || "error desconocido";
  if (e.code === "23505") detalle = "ya existe un registro con ese dato (por ejemplo, el mismo RUC).";
  if (e.code === "23503") detalle = "tiene registros asociados (inscritos o certificados) y no se puede eliminar.";
  avisar(texto + " Motivo: " + detalle, "error");
}

// ---------------------------------------------------------------------
// Cursos activos (para crear capacitaciones)
// ---------------------------------------------------------------------
async function cargarCursos() {
  const { data, error } = await nexusDb
    .from("cap_cursos")
    .select("id, titulo, horas, publicado, cap_lecciones(count), cap_preguntas(count)")
    .order("titulo");
  if (error) return errorSupabase(error, "No se pudieron cargar los cursos.");
  emp.cursos = (data || []).map(function (c) {
    return {
      id: c.id, titulo: c.titulo, horas: c.horas, activo: c.publicado,
      lecciones: c.cap_lecciones[0] ? c.cap_lecciones[0].count : 0,
      preguntas: c.cap_preguntas[0] ? c.cap_preguntas[0].count : 0
    };
  });
}

// ---------------------------------------------------------------------
// Empresas
// ---------------------------------------------------------------------
async function cargarEmpresas(seleccionarId) {
  const { data, error } = await nexusDb.from("cap_empresas").select("*").order("nombre");
  if (error) return errorSupabase(error, "No se pudieron cargar las empresas.");
  emp.lista = data || [];
  pintarEmpresas();
  const id = seleccionarId || (emp.actual && emp.actual.id);
  if (id && emp.lista.some(function (e) { return e.id === id; })) seleccionarEmpresa(id);
}

el("buscar-empresa").addEventListener("input", pintarEmpresas);

function pintarEmpresas() {
  const filtro = el("buscar-empresa").value.trim().toLowerCase();
  const ul = el("empresas");
  ul.innerHTML = "";
  const visibles = emp.lista.filter(function (e) {
    return !filtro || e.nombre.toLowerCase().includes(filtro) || (e.ruc || "").includes(filtro);
  });
  if (visibles.length === 0) {
    const li = document.createElement("li");
    li.className = "vacio-lista";
    li.textContent = emp.lista.length ? "Ninguna empresa coincide." : "Aún no hay empresas registradas.";
    ul.appendChild(li);
    return;
  }
  visibles.forEach(function (e) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "item-curso" + (emp.actual && emp.actual.id === e.id ? " activo" : "");
    const t = document.createElement("span");
    t.textContent = e.nombre;
    const s = document.createElement("small");
    s.className = "detalle-empresa";
    s.textContent = e.ruc ? "RUC " + e.ruc : "Sin RUC";
    btn.append(t, s);
    if (!e.activa) {
      const b = document.createElement("span");
      b.className = "estado borrador";
      b.textContent = "Inactiva";
      btn.appendChild(b);
    }
    btn.addEventListener("click", function () { seleccionarEmpresa(e.id); });
    li.appendChild(btn);
    ul.appendChild(li);
  });
}

el("btn-nueva-empresa").addEventListener("click", function () {
  emp.actual = null;
  pintarEmpresas();
  mostrar("vista-empresa");
  el("empresa-nombre").textContent = "Nueva empresa";
  el("empresa-resumen").textContent = "";
  el("btn-editar-empresa").hidden = true;
  el("btn-informe").hidden = true;
  el("form-informe").hidden = true;
  llenarFormEmpresa({ nombre: "", ruc: "", contacto: "", correo: "", telefono: "", num_trabajadores: null, activa: true });
  el("form-empresa").hidden = false;
  el("form-conv").hidden = true;
  el("bloque-jornadas").hidden = true;
  document.querySelectorAll(".seccion-cabecera").forEach(function (s) { s.hidden = true; });
  el("lista-conv").innerHTML = "";
  el("e-nombre").focus();
});

async function seleccionarEmpresa(id) {
  emp.actual = emp.lista.find(function (e) { return e.id === id; });
  pintarEmpresas();
  mostrar("vista-empresa");
  pintarCabeceraEmpresa();
  el("btn-editar-empresa").hidden = false;
  el("btn-informe").hidden = false;
  el("form-informe").hidden = true;
  el("form-empresa").hidden = true;
  el("form-conv").hidden = true;
  el("form-jornada").hidden = true;
  el("bloque-jornadas").hidden = false;
  document.querySelectorAll(".seccion-cabecera").forEach(function (s) { s.hidden = false; });
  await Promise.all([cargarConvocatorias(), cargarJornadas()]);
}

function pintarCabeceraEmpresa() {
  const e = emp.actual;
  el("empresa-nombre").textContent = e.nombre;
  const partes = [];
  if (e.ruc) partes.push("RUC " + e.ruc);
  if (e.num_trabajadores !== null && e.num_trabajadores !== undefined) partes.push(e.num_trabajadores + " trabajadores");
  if (e.contacto) partes.push("Contacto: " + e.contacto);
  if (e.correo) partes.push(e.correo);
  if (e.telefono) partes.push(e.telefono);
  if (!e.activa) partes.push("EMPRESA INACTIVA: sus códigos no funcionan");
  el("empresa-resumen").textContent = partes.join(" · ");
}

function mostrar(vista) {
  el("editor-vacio").hidden = true;
  el("vista-empresa").hidden = vista !== "vista-empresa";
  el("vista-nomina").hidden = vista !== "vista-nomina";
}

// ---------------------------------------------------------------------
// Informe PDF de la empresa (js/reporte-empresa.js)
// ---------------------------------------------------------------------
el("btn-informe").addEventListener("click", function () {
  const f = el("form-informe");
  f.hidden = !f.hidden;
  if (!f.hidden) f.scrollIntoView({ behavior: "smooth", block: "nearest" });
});
el("btn-cancelar-informe").addEventListener("click", function () { el("form-informe").hidden = true; });
el("form-informe").addEventListener("submit", async function (ev) {
  ev.preventDefault();
  const desde = el("inf-desde").value, hasta = el("inf-hasta").value;
  if (desde && hasta && desde > hasta) return avisar("La fecha \"Desde\" no puede ser posterior a \"Hasta\".", "error");
  if (!window.jspdf) return avisar("No se pudo cargar el generador de PDF. Recarga la página.", "error");
  const boton = el("btn-generar-informe");
  boton.disabled = true;
  boton.textContent = "Preparando informe…";
  try {
    const t = await NexusReporte.generar(emp.actual, { desde: desde, hasta: hasta, sitio: BASE_SITIO });
    avisar("Informe descargado: " + t.capacitaciones + (t.capacitaciones === 1 ? " capacitación" : " capacitaciones") +
      ", " + t.personas + (t.personas === 1 ? " persona capacitada." : " personas capacitadas."));
    el("form-informe").hidden = true;
  } catch (e) {
    errorSupabase(e, "No se pudo generar el informe.");
  } finally {
    boton.disabled = false;
    boton.textContent = "Descargar informe";
  }
});

el("btn-editar-empresa").addEventListener("click", function () {
  llenarFormEmpresa(emp.actual);
  el("form-empresa").hidden = !el("form-empresa").hidden;
});

el("btn-cancelar-empresa").addEventListener("click", function () {
  if (emp.actual) {
    el("form-empresa").hidden = true;
  } else {
    el("vista-empresa").hidden = true;
    el("editor-vacio").hidden = false;
  }
});

function llenarFormEmpresa(e) {
  el("e-nombre").value = e.nombre || "";
  el("e-ruc").value = e.ruc || "";
  el("e-contacto").value = e.contacto || "";
  el("e-correo").value = e.correo || "";
  el("e-telefono").value = e.telefono || "";
  el("e-trabajadores").value = (e.num_trabajadores === null || e.num_trabajadores === undefined) ? "" : e.num_trabajadores;
  el("e-activa").checked = e.activa !== false;
}

el("form-empresa").addEventListener("submit", async function (ev) {
  ev.preventDefault();
  const trabajadores = el("e-trabajadores").value.trim();
  const datos = {
    nombre: el("e-nombre").value.trim().replace(/\s+/g, " "),
    ruc: el("e-ruc").value.replace(/\D/g, "") || null,
    contacto: el("e-contacto").value.trim() || null,
    correo: el("e-correo").value.trim() || null,
    telefono: el("e-telefono").value.trim() || null,
    num_trabajadores: trabajadores === "" ? null : parseInt(trabajadores, 10),
    activa: el("e-activa").checked
  };
  if (datos.nombre.length < 3) return avisar("Escribe el nombre de la empresa.", "error");
  if (datos.ruc && datos.ruc.length !== 13) return avisar("El RUC debe tener 13 dígitos.", "error");
  if (datos.num_trabajadores !== null && !(datos.num_trabajadores >= 0)) return avisar("Revisa el número de trabajadores.", "error");

  const r = emp.actual
    ? await nexusDb.from("cap_empresas").update(datos).eq("id", emp.actual.id).select().single()
    : await nexusDb.from("cap_empresas").insert(datos).select().single();
  if (r.error) return errorSupabase(r.error, "No se pudo guardar la empresa.");

  const nueva = !emp.actual;
  emp.actual = r.data;
  await cargarEmpresas(r.data.id);
  avisar(nueva ? "Empresa registrada. Ahora puedes crear su primera capacitación." : "Datos de la empresa guardados.");
});

// ---------------------------------------------------------------------
// Capacitaciones (convocatorias) de la empresa
// ---------------------------------------------------------------------
async function cargarConvocatorias() {
  const cont = el("lista-conv");
  cont.innerHTML = "";
  const { data, error } = await nexusDb
    .from("cap_convocatorias")
    .select("id, modalidad, evaluacion_presencial, horas, fecha_capacitacion, observaciones, creado_en, " +
            "cap_cursos(id, titulo, horas, imagen), " +
            "cap_accesos(id, tipo, codigo, valido_desde, valido_hasta, anulado, creado_en), " +
            "cap_inscripciones(count), cap_certificados(count)")
    .eq("empresa_id", emp.actual.id)
    .order("creado_en", { ascending: false });
  if (error) return errorSupabase(error, "No se pudieron cargar las capacitaciones.");

  emp.convs = data || [];
  if (emp.convs.length === 0) {
    const p = document.createElement("p");
    p.className = "vacio-lista";
    p.textContent = "Esta empresa todavía no tiene capacitaciones. Crea la primera con el botón \"Nueva capacitación\".";
    cont.appendChild(p);
    return;
  }
  // Orden: por fecha de la charla, la más reciente primero (sin fecha: por creación)
  const fechaOrden = function (c) { return new Date(c.fecha_capacitacion ? c.fecha_capacitacion + "T12:00" : c.creado_en).getTime(); };
  emp.convs.sort(function (a, b) { return fechaOrden(b) - fechaOrden(a); });
  // Abierta por defecto: la que tiene una clave vigente o programada (o ninguna)
  if (!emp.abiertas || emp.abiertasEmpresa !== emp.actual.id) {
    emp.abiertasEmpresa = emp.actual.id;
    emp.abiertas = new Set();
    const activa = emp.convs.find(function (c) { return estadoConvocatoria(c).clase === "activa"; });
    if (activa) emp.abiertas.add(activa.id);
  }
  const ayuda = document.createElement("p");
  ayuda.className = "ayuda conv-ayuda";
  ayuda.textContent = emp.convs.length + (emp.convs.length === 1 ? " capacitación" : " capacitaciones") +
    ", de la más reciente a la más antigua. Toca una para ver sus claves, nómina y opciones.";
  cont.appendChild(ayuda);
  emp.convs.forEach(function (c) { cont.appendChild(tarjetaConvocatoria(c)); });
}

// Estado general de una capacitación para la miniatura
function estadoConvocatoria(c) {
  const estados = (c.cap_accesos || []).map(estadoAcceso).map(function (e) { return e.clase; });
  if (estados.indexOf("vigente") >= 0) return { clase: "activa", texto: "Clave vigente" };
  if (estados.indexOf("programado") >= 0) return { clase: "programada", texto: "Programada" };
  if (c.fecha_capacitacion && new Date(c.fecha_capacitacion + "T23:59") > new Date()) return { clase: "programada", texto: "Próxima" };
  return { clase: "finalizada", texto: "Finalizada" };
}

const NOMBRE_MODALIDAD = { presencial: "Presencial", virtual: "Virtual", mixta: "Mixta" };

function tarjetaConvocatoria(c) {
  const art = document.createElement("article");
  art.className = "conv conv-plegable" + (emp.abiertas.has(c.id) ? " abierta" : "");

  // Miniatura (siempre visible): título, fecha, estado y avance. Al tocarla se abre el detalle.
  const inscritosMini = c.cap_inscripciones[0] ? c.cap_inscripciones[0].count : 0;
  const certMini = c.cap_certificados[0] ? c.cap_certificados[0].count : 0;
  const est = estadoConvocatoria(c);
  const mini = document.createElement("button");
  mini.type = "button";
  mini.className = "conv-mini";
  mini.setAttribute("aria-expanded", emp.abiertas.has(c.id) ? "true" : "false");
  const fecha = document.createElement("span");
  fecha.className = "conv-mini-fecha";
  // Con portada del curso: la imagen en miniatura con la fecha encima
  if (c.cap_cursos.imagen) {
    fecha.classList.add("con-imagen");
    fecha.style.backgroundImage = "url(\"" + nexusDb.storage.from("portadas").getPublicUrl(c.cap_cursos.imagen).data.publicUrl + "\")";
  }
  const f = new Date(c.fecha_capacitacion ? c.fecha_capacitacion + "T12:00" : c.creado_en);
  const dia = document.createElement("strong");
  dia.textContent = f.getDate();
  const mes = document.createElement("small");
  mes.textContent = f.toLocaleDateString("es-EC", { month: "short", year: "numeric" }).replace(".", "");
  fecha.append(dia, mes);
  const cuerpoMini = document.createElement("span");
  cuerpoMini.className = "conv-mini-cuerpo";
  const tituloMini = document.createElement("span");
  tituloMini.className = "conv-mini-titulo";
  tituloMini.textContent = c.cap_cursos.titulo;
  const datosMini = document.createElement("span");
  datosMini.className = "conv-mini-datos";
  datosMini.textContent = NOMBRE_MODALIDAD[c.modalidad] + " · " + inscritosMini + (inscritosMini === 1 ? " inscrito" : " inscritos") +
    " · " + certMini + (certMini === 1 ? " certificado" : " certificados") + (c.fecha_capacitacion ? "" : " · sin fecha de charla");
  cuerpoMini.append(tituloMini, datosMini);
  const estado = document.createElement("span");
  estado.className = "conv-mini-estado " + est.clase;
  estado.textContent = est.texto;
  const flecha = document.createElement("span");
  flecha.className = "conv-mini-flecha";
  flecha.setAttribute("aria-hidden", "true");
  flecha.textContent = "▾";
  mini.append(fecha, cuerpoMini, estado, flecha);
  mini.addEventListener("click", function () {
    const abrir = !art.classList.contains("abierta");
    art.classList.toggle("abierta", abrir);
    mini.setAttribute("aria-expanded", abrir ? "true" : "false");
    if (abrir) emp.abiertas.add(c.id); else emp.abiertas.delete(c.id);
  });
  const detalle = document.createElement("div");
  detalle.className = "conv-detalle";

  // Encabezado
  const cab = document.createElement("div");
  cab.className = "conv-cabecera";
  const h3 = document.createElement("h3");
  h3.textContent = c.cap_cursos.titulo;
  const chips = document.createElement("div");
  chips.className = "chips";
  const horas = c.horas || c.cap_cursos.horas;
  [
    NOMBRE_MODALIDAD[c.modalidad],
    formatearHoras(horas),
    c.fecha_capacitacion ? "Charla: " + fechaCorta(c.fecha_capacitacion + "T12:00") : null,
    c.modalidad !== "virtual" ? (c.evaluacion_presencial ? "QR con evaluación" : "QR sin evaluación") : null,
    c.observaciones
  ].filter(Boolean).forEach(function (t) {
    const s = document.createElement("span");
    s.className = "chip";
    s.textContent = t;
    chips.appendChild(s);
  });
  cab.append(h3, chips);

  // Avance
  const inscritos = c.cap_inscripciones[0] ? c.cap_inscripciones[0].count : 0;
  const certificados = c.cap_certificados[0] ? c.cap_certificados[0].count : 0;
  const avance = document.createElement("div");
  avance.className = "avance";
  const texto = document.createElement("p");
  const total = emp.actual.num_trabajadores;
  let linea = inscritos + (inscritos === 1 ? " inscrito" : " inscritos") + " · " +
              certificados + (certificados === 1 ? " certificado" : " certificados");
  if (total) linea += " · Avance: " + certificados + " de " + total + " trabajadores (" + Math.min(100, Math.round(certificados * 100 / total)) + " %)";
  texto.textContent = linea;
  avance.appendChild(texto);
  if (total) {
    const barra = document.createElement("div");
    barra.className = "barra-progreso";
    const relleno = document.createElement("span");
    relleno.style.width = Math.min(100, Math.round(certificados * 100 / total)) + "%";
    barra.appendChild(relleno);
    avance.appendChild(barra);
  }

  // Códigos
  const lista = document.createElement("div");
  lista.className = "accesos";
  c.cap_accesos
    .slice()
    .sort(function (a, b) { return new Date(b.creado_en) - new Date(a.creado_en); })
    .forEach(function (a) { lista.appendChild(filaAcceso(a, c)); });

  // Acciones
  const acciones = document.createElement("div");
  acciones.className = "conv-acciones";
  acciones.appendChild(boton("Ver nómina", "boton boton-chico", function () { abrirNomina(c); }));
  if (c.modalidad !== "presencial") {
    acciones.appendChild(boton("Nueva clave virtual", "boton secundario boton-chico", function () { formNuevoCodigo(art, c, "virtual"); }));
  }
  if (c.modalidad !== "virtual") {
    acciones.appendChild(boton("Nueva clave presencial", "boton secundario boton-chico", function () { formNuevoCodigo(art, c, "presencial"); }));
  }
  acciones.appendChild(boton("Ver certificado de ejemplo", "boton secundario boton-chico", function () { certificadoEjemplo(c); }));
  acciones.appendChild(boton("Eliminar capacitación", "enlace-boton rojo", function () { eliminarConvocatoria(c, inscritos, certificados); }));

  detalle.append(cab, avance, lista, acciones);
  art.append(mini, detalle);
  return art;
}

function estadoAcceso(a) {
  const ahora = new Date();
  if (a.anulado) return { clase: "anulado", texto: "Anulado" };
  if (ahora < new Date(a.valido_desde)) return { clase: "programado", texto: "Programado" };
  if (ahora > new Date(a.valido_hasta)) return { clase: "vencido", texto: "Vencido" };
  return { clase: "vigente", texto: "Vigente" };
}

function filaAcceso(a, c) {
  const fila = document.createElement("div");
  fila.className = "acceso";
  const est = estadoAcceso(a);

  const info = document.createElement("div");
  const tipo = document.createElement("small");
  tipo.textContent = a.tipo === "presencial" ? "Clave presencial" : "Clave virtual";
  const codigo = document.createElement("strong");
  codigo.className = "codigo-acceso";
  codigo.textContent = a.codigo;
  const estado = document.createElement("span");
  estado.className = "estado-acceso " + est.clase;
  estado.textContent = est.texto;
  const validez = document.createElement("small");
  validez.className = "validez";
  validez.textContent = "Del " + fechaHora(a.valido_desde) + " al " + fechaHora(a.valido_hasta);
  info.append(tipo, codigo, estado, validez);

  const botones = document.createElement("div");
  botones.className = "acceso-botones";
  if (est.clase === "vigente" || est.clase === "programado") {
    botones.appendChild(boton("Cartel QR con clave", "enlace-boton", function () { descargarCartel(a, c); }));
    botones.appendChild(boton("Copiar enlace", "enlace-boton", function () { copiar(enlacePrograma(c), "Enlace permanente del programa copiado (el mismo del QR). La clave se envía aparte."); }));
    botones.appendChild(boton("Enviar por WhatsApp", "enlace-boton", function () { enviarWhatsApp(mensajeAcceso(a, c)); }));
    botones.appendChild(boton("Copiar mensaje", "enlace-boton", function () { copiar(mensajeAcceso(a, c), "Mensaje copiado. Pégalo en WhatsApp o en un correo para la empresa."); }));
  }
  if (est.clase !== "anulado") {
    botones.appendChild(boton("Extender vigencia", "enlace-boton", function () { formExtender(fila, a); }));
  }
  if (est.clase === "vigente" || est.clase === "programado") {
    botones.appendChild(boton("Anular", "enlace-boton rojo", function () { anularAcceso(a); }));
  }
  fila.append(info, botones);
  return fila;
}

// Extender la vigencia de una clave (aunque ya haya vencido).
// La lista de la empresa se conserva: los que ya se certificaron siguen ahí.
function formExtender(fila, a) {
  const previo = fila.querySelector(".mini-form");
  if (previo) { previo.remove(); return; }

  const f = document.createElement("form");
  f.className = "mini-form";
  f.noValidate = true;
  const titulo = document.createElement("strong");
  titulo.textContent = "Extender la vigencia de " + a.codigo;
  f.appendChild(titulo);

  // Propuesta: 7 días más desde hoy o desde el fin actual (lo que sea mayor)
  const base = new Date(Math.max(Date.now(), new Date(a.valido_hasta).getTime()));
  base.setDate(base.getDate() + 7);
  const fechaPropuesta = base.getFullYear() + "-" + dos(base.getMonth() + 1) + "-" + dos(base.getDate());

  const fila2 = document.createElement("div");
  fila2.className = "fila-dos";
  const campos = [["Nueva fecha de fin", "date", fechaPropuesta], ["Hora de fin", "time", "23:59"]];
  const inputs = campos.map(function (cfg) {
    const div = document.createElement("div");
    const lab = document.createElement("label");
    lab.className = "etiqueta";
    lab.textContent = cfg[0];
    const inp = document.createElement("input");
    inp.className = "campo";
    inp.type = cfg[1];
    inp.value = cfg[2];
    lab.appendChild(inp);
    div.appendChild(lab);
    fila2.appendChild(div);
    return inp;
  });
  f.appendChild(fila2);

  const acciones = document.createElement("div");
  acciones.className = "acciones-form";
  const guardar = boton("Extender", "boton boton-chico", function () {});
  guardar.type = "submit";
  acciones.append(boton("Cancelar", "boton secundario boton-chico", function () { f.remove(); }), guardar);
  f.appendChild(acciones);

  f.addEventListener("submit", async function (ev) {
    ev.preventDefault();
    if (!inputs[0].value || !inputs[1].value) return avisar("Completa la fecha y la hora de fin.", "error");
    const hasta = new Date(inputs[0].value + "T" + inputs[1].value);
    if (!(hasta > new Date())) return avisar("La nueva fecha de fin debe ser posterior a este momento.", "error");
    if (!(hasta > new Date(a.valido_desde))) return avisar("La fecha de fin debe ser posterior al inicio de la clave.", "error");

    guardar.disabled = true;
    const r = await nexusDb.from("cap_accesos").update({ valido_hasta: hasta.toISOString() }).eq("id", a.id);
    guardar.disabled = false;
    if (r.error) return errorSupabase(r.error, "No se pudo extender la vigencia.");
    avisar("Vigencia extendida: la clave " + a.codigo + " funciona hasta el " + fechaHora(hasta.toISOString()));
    await cargarConvocatorias();
  });

  fila.appendChild(f);
  inputs[0].focus();
}

function boton(texto, clase, accion) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = clase;
  b.textContent = texto;
  b.addEventListener("click", accion);
  return b;
}

function enlacePrograma(c) {
  return BASE_SITIO + "programa.html?p=" + encodeURIComponent(c.cap_cursos.id);
}

// Mensaje para WhatsApp o correo. El enlace es el PERMANENTE del programa
// (el mismo del QR: nunca cambia); lo que cambia en cada capacitación es la clave.
function mensajeAcceso(a, c) {
  const curso = c.cap_cursos.titulo;
  const intro = a.tipo === "virtual"
    ? "*Capacitación virtual: " + curso + "*"
    : "*Capacitación: " + curso + "*";
  const cierre = a.tipo === "virtual"
    ? "Revisa las lecciones, aprueba la evaluación y descarga tu certificado."
    : "Escribe tus datos y descarga tu certificado.";
  return intro + "\n" + emp.actual.nombre + "\n\n" +
    "1. Toca este enlace para ingresar:\n" + enlacePrograma(c) + "\n\n" +
    "2. Escribe la clave de acceso: *" + a.codigo + "*\n" +
    "(válida hasta el " + fechaHora(a.valido_hasta) + ")\n\n" +
    cierre;
}

// Abre WhatsApp (en el celular o en WhatsApp Web) con el mensaje ya escrito
function enviarWhatsApp(texto) {
  window.open("https://wa.me/?text=" + encodeURIComponent(texto), "_blank", "noopener");
}

async function copiar(texto, mensaje) {
  try {
    await navigator.clipboard.writeText(texto);
    avisar(mensaje);
  } catch (e) {
    window.prompt("Copia este texto:", texto);
  }
}

function descargarCartel(a, c) {
  try {
    NexusCartel.generarPrograma({
      curso: c.cap_cursos.titulo,
      horas: c.horas || c.cap_cursos.horas,
      url: enlacePrograma(c),
      sitio: BASE_SITIO,
      clave: a.codigo,
      valido_hasta: a.valido_hasta
    });
  } catch (e) {
    console.error(e);
    avisar("No se pudo generar el cartel. Recarga la página e inténtalo de nuevo.", "error");
  }
}

async function anularAcceso(a) {
  if (!confirm("¿Anular la clave " + a.codigo + "? Desde ahora nadie podrá usarla y no se podrá extender. Quienes ya obtuvieron su certificado lo conservan.")) return;
  const r = await nexusDb.from("cap_accesos").update({ anulado: true }).eq("id", a.id);
  if (r.error) return errorSupabase(r.error, "No se pudo anular el código.");
  avisar("Clave anulada.");
  await cargarConvocatorias();
}

async function eliminarConvocatoria(c, inscritos, certificados) {
  const titulo = c.cap_cursos.titulo;
  if (!inscritos) {
    if (!confirm("¿Eliminar la capacitación \"" + titulo + "\" y sus claves? Nadie se ha inscrito todavía.")) return;
  } else {
    const aviso = "¿Eliminar la capacitación \"" + titulo + "\"?\n\n" +
      "Se borrarán " + inscritos + (inscritos === 1 ? " inscrito" : " inscritos") +
      (certificados ? " y " + certificados + (certificados === 1 ? " certificado" : " certificados") + " (dejarán de ser válidos en la verificación)" : "") +
      ", con sus claves y notas. No se puede deshacer.\n\nSi la necesitas como respaldo, descarga antes el Excel de la nómina.\n\nPara confirmar escribe ELIMINAR:";
    const r = window.prompt(aviso, "");
    if (r === null) return;
    if (r.trim().toUpperCase() !== "ELIMINAR") return avisar("No se eliminó: no escribiste ELIMINAR.", "error");
  }
  let r = await nexusDb.rpc("cap_eliminar_capacitacion", { p_convocatoria: c.id });
  // Sin el SQL 32: solo se puede borrar si no tiene inscritos
  if (r.error && /cap_eliminar_capacitacion|function/i.test(r.error.message || "") && !inscritos) {
    r = await nexusDb.from("cap_convocatorias").delete().eq("id", c.id);
  }
  if (r.error) {
    if (/cap_eliminar_capacitacion|schema cache/i.test(r.error.message || "")) return avisar("Para eliminar capacitaciones con inscritos, ejecuta el SQL 32 en Supabase.", "error");
    return errorSupabase(r.error, "No se pudo eliminar la capacitación.");
  }
  avisar("Capacitación eliminada.");
  await cargarConvocatorias();
}

// Certificado de ejemplo con los datos reales de la capacitación (marca MUESTRA)
async function certificadoEjemplo(c) {
  if (!window.NexusCertificado) return avisar("Recarga la página para ver el certificado de ejemplo.", "error");
  const curso = await nexusDb.from("cap_cursos").select("subtemas").eq("id", c.cap_cursos.id).maybeSingle();
  const asistencia = c.modalidad === "presencial" && !c.evaluacion_presencial;
  NexusCertificado.muestra({
    tipo: asistencia ? "asistencia" : "evaluacion",
    curso: c.cap_cursos.titulo,
    empresa: emp.actual.nombre,
    modalidad: c.modalidad === "virtual" ? "virtual" : "presencial",
    fecha_capacitacion: c.fecha_capacitacion,
    horas: Number(c.horas || c.cap_cursos.horas),
    nota: asistencia ? null : 100,
    subtemas: curso.data ? curso.data.subtemas : [],
    emitido_en: new Date().toISOString()
  });
}

// Formulario corto para un código adicional (por ejemplo, para rezagados)
function formNuevoCodigo(tarjeta, c, tipo) {
  const previo = tarjeta.querySelector(".mini-form");
  if (previo) previo.remove();

  const f = document.createElement("form");
  f.className = "mini-form";
  f.noValidate = true;
  const titulo = document.createElement("strong");
  titulo.textContent = tipo === "virtual" ? "Nueva clave virtual" : "Nueva clave presencial";
  f.appendChild(titulo);

  const fila = document.createElement("div");
  fila.className = "fila-tres";
  const campos = tipo === "virtual"
    ? [["Desde", "date", hoyISO()], ["Hasta (inclusive)", "date", sumarDiasISO(15)], ["Clave (vacío = automática)", "text", sugerirClave()]]
    : [["Fecha", "date", hoyISO()], ["Desde", "time", horaActual()], ["Hasta", "time", horaMas(4)], ["Clave (vacío = automática)", "text", sugerirClave()]];
  const inputs = campos.map(function (cfg) {
    const div = document.createElement("div");
    const lab = document.createElement("label");
    lab.className = "etiqueta";
    lab.textContent = cfg[0];
    const inp = document.createElement("input");
    inp.className = "campo";
    inp.type = cfg[1];
    inp.value = cfg[2];
    lab.appendChild(inp);
    div.appendChild(lab);
    fila.appendChild(div);
    return inp;
  });
  f.appendChild(fila);

  const acciones = document.createElement("div");
  acciones.className = "acciones-form";
  acciones.append(
    boton("Cancelar", "boton secundario boton-chico", function () { f.remove(); }),
    (function () { const b = boton("Crear clave", "boton boton-chico", function () {}); b.type = "submit"; return b; })()
  );
  f.appendChild(acciones);

  f.addEventListener("submit", async function (ev) {
    ev.preventDefault();
    const rango = tipo === "virtual"
      ? rangoVirtual(inputs[0].value, inputs[1].value)
      : rangoPresencial(inputs[0].value, inputs[1].value, inputs[2].value);
    if (rango.error) return avisar(rango.error, "error");
    const clave = normalizarClave(inputs[inputs.length - 1].value);
    if (clave && !claveValida(clave)) return avisar("La clave debe tener de 4 a 12 letras o números, sin espacios ni símbolos.", "error");
    const r = await nexusDb.from("cap_accesos").insert(Object.assign({
      convocatoria_id: c.id, tipo: tipo, valido_desde: rango.desde, valido_hasta: rango.hasta
    }, clave ? { codigo: clave } : {}));
    if (r.error) return errorSupabase(r.error, "No se pudo crear la clave.");
    avisar("Clave creada.");
    await cargarConvocatorias();
  });

  tarjeta.querySelector(".conv-acciones").before(f);
  inputs[0].focus();
}

// ---------------------------------------------------------------------
// JORNADAS: varias capacitaciones el mismo día con una sola clave.
// Se crea la jornada (con su clave) y, por cada programa elegido, una
// capacitación presencial normal con su propia clave. Así cada una
// conserva su nómina, sus certificados y su registro de asistencia.
// ---------------------------------------------------------------------
async function cargarJornadas() {
  const cont = el("lista-jornadas");
  cont.innerHTML = "";
  const { data, error } = await nexusDb
    .from("cap_jornadas")
    .select("id, nombre, fecha, codigo, valido_desde, valido_hasta, anulado, creado_en, " +
            "cap_convocatorias(id, cap_cursos(titulo), cap_accesos(id, tipo, anulado), cap_certificados(count))")
    .eq("empresa_id", emp.actual.id)
    .order("fecha", { ascending: false });
  if (error) {
    // Si aún no se ejecutó el SQL 18, la sección queda oculta sin romper el resto
    console.warn("Jornadas no disponibles", error);
    el("bloque-jornadas").hidden = true;
    return;
  }
  emp.jornadas = data || [];
  emp.jornadas.forEach(function (j) { cont.appendChild(tarjetaJornada(j)); });
}

function tarjetaJornada(j) {
  const art = document.createElement("article");
  art.className = "conv conv-jornada";

  const cab = document.createElement("div");
  cab.className = "conv-cabecera";
  const h3 = document.createElement("h3");
  h3.textContent = j.nombre;
  const chips = document.createElement("div");
  chips.className = "chips";
  const certificados = j.cap_convocatorias.reduce(function (n, c) { return n + (c.cap_certificados[0] ? c.cap_certificados[0].count : 0); }, 0);
  ["Jornada", fechaCorta(j.fecha + "T12:00"), j.cap_convocatorias.length + " capacitaciones", certificados + " certificados emitidos"]
    .forEach(function (t) {
      const s = document.createElement("span");
      s.className = "chip";
      s.textContent = t;
      chips.appendChild(s);
    });
  cab.append(h3, chips);

  const temas = document.createElement("ul");
  temas.className = "temas-jornada";
  j.cap_convocatorias.forEach(function (c) {
    const li = document.createElement("li");
    li.textContent = c.cap_cursos.titulo;
    temas.appendChild(li);
  });

  // Clave de la jornada (mismo aspecto que las claves de capacitación)
  const fila = document.createElement("div");
  fila.className = "acceso";
  const est = estadoAcceso(j);
  const info = document.createElement("div");
  const tipo = document.createElement("small");
  tipo.textContent = "Clave de la jornada";
  const codigo = document.createElement("strong");
  codigo.className = "codigo-acceso";
  codigo.textContent = j.codigo;
  const estado = document.createElement("span");
  estado.className = "estado-acceso " + est.clase;
  estado.textContent = est.texto;
  const validez = document.createElement("small");
  validez.className = "validez";
  validez.textContent = "Del " + fechaHora(j.valido_desde) + " al " + fechaHora(j.valido_hasta);
  info.append(tipo, codigo, estado, validez);

  const botones = document.createElement("div");
  botones.className = "acceso-botones";
  if (est.clase === "vigente" || est.clase === "programado") {
    botones.appendChild(boton("Cartel QR con clave", "enlace-boton", function () { cartelJornada(j); }));
    botones.appendChild(boton("Enviar por WhatsApp", "enlace-boton", function () { enviarWhatsApp(mensajeJornada(j)); }));
    botones.appendChild(boton("Copiar mensaje", "enlace-boton", function () { copiar(mensajeJornada(j), "Mensaje copiado. Pégalo en WhatsApp o en un correo para la empresa."); }));
    botones.appendChild(boton("Copiar enlace", "enlace-boton", function () { copiar(ENLACE_INGRESO, "Enlace copiado."); }));
  }
  if (est.clase !== "anulado") {
    botones.appendChild(boton("Extender vigencia", "enlace-boton", function () { extenderJornada(j); }));
    botones.appendChild(boton("Anular", "enlace-boton rojo", function () { anularJornada(j); }));
  }
  fila.append(info, botones);

  const nota = document.createElement("p");
  nota.className = "ayuda";
  nota.textContent = "La nómina y el registro de asistencia de cada capacitación están abajo, en Capacitaciones.";

  art.append(cab, temas, fila, nota);
  return art;
}

// Enlace PERMANENTE de ingreso (el mismo para todas las jornadas y el
// mismo del QR de las jornadas): la página de inicio con la clave a la vista.
const ENLACE_INGRESO = BASE_SITIO + "index.html#clave";

function mensajeJornada(j) {
  return "*" + j.nombre + "*\n" + emp.actual.nombre + " · " + fechaCorta(j.fecha + "T12:00") + "\n" +
    j.cap_convocatorias.map(function (c) { return "• " + c.cap_cursos.titulo; }).join("\n") + "\n\n" +
    "1. Toca este enlace para ingresar:\n" + ENLACE_INGRESO + "\n\n" +
    "2. Escribe la clave de acceso: *" + j.codigo + "*\n" +
    "(válida hasta el " + fechaHora(j.valido_hasta) + ")\n\n" +
    "Regístrate una sola vez y descarga un certificado por cada capacitación.";
}

function cartelJornada(j) {
  try {
    NexusCartel.generarJornada({
      empresa: emp.actual.nombre,
      nombre: j.nombre,
      fecha: j.fecha,
      cursos: j.cap_convocatorias.map(function (c) { return c.cap_cursos.titulo; }),
      url: ENLACE_INGRESO,          // QR permanente: la clave se escribe aparte
      sitio: BASE_SITIO,
      codigo: j.codigo,
      valido_hasta: j.valido_hasta
    });
  } catch (e) {
    console.error(e);
    avisar("No se pudo generar el cartel. Recarga la página e inténtalo de nuevo.", "error");
  }
}

// Extiende la jornada y, con ella, las claves presenciales de sus capacitaciones
async function extenderJornada(j) {
  const propuesta = new Date(Math.max(Date.now(), new Date(j.valido_hasta).getTime()) + 2 * 3600 * 1000);
  const texto = prompt("Nueva fecha y hora de fin (AAAA-MM-DD HH:MM):",
    propuesta.getFullYear() + "-" + dos(propuesta.getMonth() + 1) + "-" + dos(propuesta.getDate()) + " " +
    dos(propuesta.getHours()) + ":" + dos(propuesta.getMinutes()));
  if (texto === null) return;
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})$/.exec(texto.trim());
  if (!m) return avisar("Escribe la fecha y hora así: 2026-10-14 18:00", "error");
  const hasta = new Date(m[1] + "T" + m[2]);
  if (!(hasta > new Date()) || !(hasta > new Date(j.valido_desde))) return avisar("La nueva hora de fin debe ser posterior a este momento.", "error");

  const r = await nexusDb.from("cap_jornadas").update({ valido_hasta: hasta.toISOString() }).eq("id", j.id);
  if (r.error) return errorSupabase(r.error, "No se pudo extender la jornada.");
  const ids = [];
  j.cap_convocatorias.forEach(function (c) {
    c.cap_accesos.forEach(function (a) { if (a.tipo === "presencial" && !a.anulado) ids.push(a.id); });
  });
  if (ids.length) {
    const a = await nexusDb.from("cap_accesos").update({ valido_hasta: hasta.toISOString() }).in("id", ids);
    if (a.error) return errorSupabase(a.error, "La jornada se extendió, pero no las claves de sus capacitaciones.");
  }
  avisar("Jornada extendida hasta el " + fechaHora(hasta.toISOString()) + ", junto con sus capacitaciones.");
  await Promise.all([cargarJornadas(), cargarConvocatorias()]);
}

async function anularJornada(j) {
  if (!confirm("¿Anular la clave de la jornada " + j.codigo + "? Ya nadie podrá entrar con ella. Las capacitaciones y los certificados emitidos se conservan.")) return;
  const r = await nexusDb.from("cap_jornadas").update({ anulado: true }).eq("id", j.id);
  if (r.error) return errorSupabase(r.error, "No se pudo anular la jornada.");
  avisar("Clave de la jornada anulada.");
  await cargarJornadas();
}

el("btn-nueva-jornada").addEventListener("click", function () {
  const activos = emp.cursos.filter(function (c) { return c.activo; });
  if (activos.length < 2) return avisar("Para una jornada se necesitan al menos 2 cursos activos. Revisa la sección Cursos.", "error");
  const cont = el("j-cursos");
  cont.innerHTML = "";
  activos.forEach(function (c) {
    const fila = document.createElement("div");
    fila.className = "curso-jornada";
    const lab = document.createElement("label");
    lab.className = "opcion-curso";
    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.value = c.id;
    chk.className = "j-curso";
    const t = document.createElement("span");
    t.textContent = c.titulo + " (" + formatearHoras(c.horas) + ")";
    lab.append(chk, t);
    const ev = document.createElement("label");
    ev.className = "opcion-evaluacion";
    const chkEv = document.createElement("input");
    chkEv.type = "checkbox";
    chkEv.className = "j-eval";
    chkEv.dataset.curso = c.id;
    chkEv.disabled = c.preguntas === 0;
    const te = document.createElement("span");
    te.textContent = c.preguntas === 0 ? "Sin preguntas" : "Pedir evaluación";
    ev.append(chkEv, te);
    fila.append(lab, ev);
    cont.appendChild(fila);
  });
  el("j-nombre").value = "";
  el("j-fecha").value = hoyISO();
  el("j-desde").value = horaActual();
  el("j-hasta").value = horaMas(6);
  el("j-clave").value = "";
  el("form-jornada").hidden = false;
  el("form-jornada").scrollIntoView({ behavior: "smooth", block: "start" });
});

el("btn-cancelar-jornada").addEventListener("click", function () { el("form-jornada").hidden = true; });

el("form-jornada").addEventListener("submit", async function (ev) {
  ev.preventDefault();
  const elegidos = Array.from(document.querySelectorAll(".j-curso:checked")).map(function (c) { return c.value; });
  if (elegidos.length < 2) return avisar("Elige al menos 2 capacitaciones para la jornada.", "error");
  const r = rangoPresencial(el("j-fecha").value, el("j-desde").value, el("j-hasta").value);
  if (r.error) return avisar(r.error, "error");
  const clave = normalizarClave(el("j-clave").value);
  if (clave && !claveValida(clave)) return avisar("La clave debe tener de 4 a 12 letras o números, sin espacios ni símbolos.", "error");

  const botonGuardar = el("btn-guardar-jornada");
  botonGuardar.disabled = true;

  const jr = await nexusDb.from("cap_jornadas").insert(Object.assign({
    empresa_id: emp.actual.id,
    nombre: el("j-nombre").value.trim() || "Jornada de capacitación",
    fecha: el("j-fecha").value,
    valido_desde: r.desde,
    valido_hasta: r.hasta
  }, clave ? { codigo: clave } : {})).select().single();
  if (jr.error) {
    botonGuardar.disabled = false;
    return errorSupabase(jr.error, "No se pudo crear la jornada.");
  }

  // Una capacitación presencial (con su clave) por cada programa elegido
  const creadas = [];
  let fallo = null;
  for (const cursoId of elegidos) {
    const conEval = document.querySelector('.j-eval[data-curso="' + cursoId + '"]').checked;
    const conv = await nexusDb.from("cap_convocatorias").insert({
      empresa_id: emp.actual.id, curso_id: cursoId, modalidad: "presencial",
      evaluacion_presencial: conEval, fecha_capacitacion: el("j-fecha").value,
      jornada_id: jr.data.id, observaciones: "Jornada " + jr.data.codigo
    }).select().single();
    if (conv.error) { fallo = conv.error; break; }
    creadas.push(conv.data.id);
    const acc = await nexusDb.from("cap_accesos").insert({
      convocatoria_id: conv.data.id, tipo: "presencial", valido_desde: r.desde, valido_hasta: r.hasta
    });
    if (acc.error) { fallo = acc.error; break; }
  }

  if (fallo) {
    // Deshacer todo lo creado (las claves se borran con su capacitación)
    if (creadas.length) await nexusDb.from("cap_convocatorias").delete().in("id", creadas);
    await nexusDb.from("cap_jornadas").delete().eq("id", jr.data.id);
    botonGuardar.disabled = false;
    return errorSupabase(fallo, "No se pudo crear la jornada. No se guardó nada.");
  }

  botonGuardar.disabled = false;
  el("form-jornada").hidden = true;
  avisar("Jornada creada con la clave " + jr.data.codigo + ". Descarga el cartel QR o copia el mensaje para la empresa.");
  await Promise.all([cargarJornadas(), cargarConvocatorias()]);
});

// ---------------------------------------------------------------------
// Nueva capacitación
// ---------------------------------------------------------------------
el("btn-nueva-conv").addEventListener("click", function () {
  const select = el("v-curso");
  select.innerHTML = "";
  const activos = emp.cursos.filter(function (c) { return c.activo; });
  if (activos.length === 0) {
    avisar("No hay cursos activos. Ve a la sección Cursos, crea uno y márcalo como activo.", "error");
    return;
  }
  activos.forEach(function (c) {
    const o = document.createElement("option");
    o.value = c.id;
    o.textContent = c.titulo + " (" + formatearHoras(c.horas) + (c.lecciones ? ", " + c.lecciones + " lecciones" : ", sin lecciones") + ")";
    select.appendChild(o);
  });

  document.querySelector('input[name="v-modalidad"][value="presencial"]').checked = true;
  el("v-fecha").value = hoyISO();
  el("v-hora-desde").value = horaActual();
  el("v-hora-hasta").value = horaMas(4);
  el("v-eval-presencial").checked = false;
  el("v-virtual-desde").value = hoyISO();
  el("v-virtual-hasta").value = sumarDiasISO(15);
  el("v-horas").value = "";
  el("v-observaciones").value = "";
  el("v-clave-presencial").value = "";
  el("v-clave-virtual").value = "";
  actualizarBloquesModalidad();

  el("form-conv").hidden = false;
  el("form-conv").scrollIntoView({ behavior: "smooth", block: "start" });
});

el("btn-cancelar-conv").addEventListener("click", function () { el("form-conv").hidden = true; });

document.querySelectorAll('input[name="v-modalidad"]').forEach(function (r) {
  r.addEventListener("change", actualizarBloquesModalidad);
});

function modalidadElegida() {
  return document.querySelector('input[name="v-modalidad"]:checked').value;
}

function actualizarBloquesModalidad() {
  const m = modalidadElegida();
  el("bloque-presencial").hidden = m === "virtual";
  el("bloque-virtual").hidden = m === "presencial";
}

el("form-conv").addEventListener("submit", async function (ev) {
  ev.preventDefault();
  const modalidad = modalidadElegida();
  const curso = emp.cursos.find(function (c) { return c.id === el("v-curso").value; });
  const evalPresencial = el("v-eval-presencial").checked;
  const horasTexto = el("v-horas").value.trim();
  const horas = horasTexto === "" ? null : Number(horasTexto);

  // Validaciones según la modalidad
  if (!curso) return avisar("Elige un curso.", "error");
  if (modalidad !== "presencial" && (curso.lecciones === 0 || curso.preguntas === 0)) {
    return avisar("Para el acceso virtual, el curso necesita lecciones y preguntas. Agrégalas en la sección Cursos.", "error");
  }
  if (modalidad !== "virtual" && evalPresencial && curso.preguntas === 0) {
    return avisar("Este curso no tiene preguntas, así que el QR no puede pedir evaluación. Desmarca esa opción o agrega preguntas.", "error");
  }
  if (horas !== null && !(horas > 0)) return avisar("Las horas deben ser mayores que 0.", "error");

  const accesos = [];
  if (modalidad !== "virtual") {
    const r = rangoPresencial(el("v-fecha").value, el("v-hora-desde").value, el("v-hora-hasta").value);
    if (r.error) return avisar(r.error, "error");
    const clave = normalizarClave(el("v-clave-presencial").value);
    if (clave && !claveValida(clave)) return avisar("La clave presencial debe tener de 4 a 12 letras o números, sin espacios ni símbolos.", "error");
    accesos.push(Object.assign({ tipo: "presencial", valido_desde: r.desde, valido_hasta: r.hasta }, clave ? { codigo: clave } : {}));
  }
  if (modalidad !== "presencial") {
    const r = rangoVirtual(el("v-virtual-desde").value, el("v-virtual-hasta").value);
    if (r.error) return avisar(r.error, "error");
    const clave = normalizarClave(el("v-clave-virtual").value);
    if (clave && !claveValida(clave)) return avisar("La clave virtual debe tener de 4 a 12 letras o números, sin espacios ni símbolos.", "error");
    accesos.push(Object.assign({ tipo: "virtual", valido_desde: r.desde, valido_hasta: r.hasta }, clave ? { codigo: clave } : {}));
  }
  if (accesos.length === 2 && accesos[0].codigo && accesos[0].codigo === accesos[1].codigo) {
    return avisar("La clave presencial y la virtual deben ser distintas.", "error");
  }

  const botonGuardar = el("btn-guardar-conv");
  botonGuardar.disabled = true;

  const conv = await nexusDb.from("cap_convocatorias").insert({
    empresa_id: emp.actual.id,
    curso_id: curso.id,
    modalidad: modalidad,
    evaluacion_presencial: modalidad !== "virtual" && evalPresencial,
    horas: horas,
    fecha_capacitacion: modalidad !== "virtual" ? el("v-fecha").value : null,
    observaciones: el("v-observaciones").value.trim() || null
  }).select().single();

  if (conv.error) {
    botonGuardar.disabled = false;
    return errorSupabase(conv.error, "No se pudo crear la capacitación.");
  }

  const acc = await nexusDb.from("cap_accesos").insert(accesos.map(function (a) {
    return Object.assign({ convocatoria_id: conv.data.id }, a);
  }));
  botonGuardar.disabled = false;

  if (acc.error) {
    await nexusDb.from("cap_convocatorias").delete().eq("id", conv.data.id);
    return errorSupabase(acc.error, "No se pudieron crear las claves. No se guardó la capacitación.");
  }

  el("form-conv").hidden = true;
  avisar("Capacitación creada. Descarga el cartel QR con la clave o copia el mensaje para la empresa.");
  await cargarConvocatorias();
});

// Claves: normalizar, validar y sugerir (3 letras de la empresa + 5 números al azar)
function normalizarClave(texto) {
  return String(texto || "").toUpperCase().replace(/\s/g, "");
}
function claveValida(clave) {
  return /^[A-Z0-9][A-Z0-9-]{2,10}[A-Z0-9]$/.test(clave);
}
function sugerirClave() {
  const letras = (emp.actual ? emp.actual.nombre : "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z]/g, "");
  const prefijo = (letras + "XXX").slice(0, 3);
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return prefijo + String(10000 + (n[0] % 90000));
}

document.querySelectorAll("[data-sugerir]").forEach(function (b) {
  b.addEventListener("click", function () { el(b.dataset.sugerir).value = sugerirClave(); });
});
document.querySelectorAll(".campo-clave").forEach(function (i) {
  i.addEventListener("input", function () { i.value = normalizarClave(i.value); });
});

// Rangos de fechas (se interpretan en la hora local de tu computadora)
function rangoPresencial(fecha, desde, hasta) {
  if (!fecha || !desde || !hasta) return { error: "Completa la fecha y las horas del QR presencial." };
  const d = new Date(fecha + "T" + desde);
  const h = new Date(fecha + "T" + hasta);
  if (!(h > d)) return { error: "La hora final del QR debe ser posterior a la hora inicial." };
  return { desde: d.toISOString(), hasta: h.toISOString() };
}

function rangoVirtual(desde, hasta) {
  if (!desde || !hasta) return { error: "Completa las fechas del acceso virtual." };
  const d = new Date(desde + "T00:00:00");
  const h = new Date(hasta + "T23:59:59");
  if (!(h > d)) return { error: "La fecha final del acceso virtual debe ser igual o posterior a la inicial." };
  return { desde: d.toISOString(), hasta: h.toISOString() };
}

// ---------------------------------------------------------------------
// Nómina
// ---------------------------------------------------------------------
async function abrirNomina(c) {
  mostrar("vista-nomina");
  el("nomina-titulo").textContent = c.cap_cursos.titulo;
  el("nomina-sub").textContent = emp.actual.nombre + " · " + NOMBRE_MODALIDAD[c.modalidad] + " · " + formatearHoras(c.horas || c.cap_cursos.horas);
  el("nomina-filas").innerHTML = "";
  el("nomina-cifras").innerHTML = "";
  el("buscar-nomina").value = "";
  window.scrollTo({ top: 0, behavior: "smooth" });

  const [insc, certs, intentos] = await Promise.all([
    nexusDb.from("cap_inscripciones").select("id, cedula, nombres, correo, modalidad, creado_en, sexo, fecha_nacimiento, etnia").eq("convocatoria_id", c.id).order("nombres"),
    nexusDb.from("cap_certificados").select("id, codigo, cedula, inscripcion_id, tipo, nota, emitido_en").eq("convocatoria_id", c.id),
    nexusDb.from("cap_intentos").select("inscripcion_id, nota, aprobado").eq("convocatoria_id", c.id)
  ]);
  const fallo = insc.error || certs.error || intentos.error;
  if (fallo) return errorSupabase(fallo, "No se pudo cargar la nómina.");

  const filas = insc.data.map(function (i) {
    const cert = certs.data.find(function (x) { return x.inscripcion_id === i.id || x.cedula === i.cedula; });
    const suyos = intentos.data.filter(function (x) { return x.inscripcion_id === i.id; });
    const mejor = suyos.reduce(function (m, x) { return Math.max(m, Number(x.nota)); }, -1);
    let estado, clase;
    if (cert) {
      estado = cert.tipo === "asistencia" ? "Asistencia certificada" : "Aprobado";
      clase = "vigente";
    } else if (suyos.length) {
      estado = "No aprobado (" + suyos.length + (suyos.length === 1 ? " intento)" : " intentos)");
      clase = "anulado";
    } else {
      estado = "Pendiente";
      clase = "programado";
    }
    return {
      id: i.id, nombres: i.nombres, cedula: i.cedula, correo: i.correo || "",
      sexo: i.sexo || "", edad: i.fecha_nacimiento ? edadEn(i.fecha_nacimiento, i.creado_en) : null,
      etnia: ETNIAS[i.etnia] || "",
      modalidad: i.modalidad === "presencial" ? "Presencial" : "Virtual",
      registro: i.creado_en, estado: estado, clase: clase,
      nota: cert && cert.nota !== null ? Number(cert.nota) : (mejor >= 0 ? mejor : null),
      intentos: suyos.length,
      certId: cert ? cert.id : null,
      certificado: cert ? cert.codigo : "",
      emitido: cert ? cert.emitido_en : null
    };
  });

  emp.nomina = { conv: c, filas: filas };
  pintarCifras(filas, c);
  pintarFilasNomina();
}

function pintarCifras(filas, c) {
  const total = emp.actual.num_trabajadores;
  const certificados = filas.filter(function (f) { return f.certificado; }).length;
  const hombres = filas.filter(function (f) { return f.sexo === "M"; }).length;
  const mujeres = filas.filter(function (f) { return f.sexo === "F"; }).length;
  const datos = [
    ["Inscritos", filas.length],
    ["Con certificado", certificados],
    ["Hombres", hombres],
    ["Mujeres", mujeres],
    ["Pendientes o no aprobados", filas.length - certificados]
  ];
  if (total) datos.push(["Avance de la empresa", Math.min(100, Math.round(certificados * 100 / total)) + " %", certificados + " de " + total + " trabajadores · faltan " + Math.max(0, total - certificados)]);
  const cont = el("nomina-cifras");
  datos.forEach(function (d) {
    const div = document.createElement("div");
    div.className = "cifra";
    const n = document.createElement("strong");
    n.textContent = d[1];
    const t = document.createElement("span");
    t.textContent = d[0];
    div.append(n, t);
    if (d[2]) {
      const s = document.createElement("small");
      s.textContent = d[2];
      div.appendChild(s);
    }
    cont.appendChild(div);
  });
}

el("buscar-nomina").addEventListener("input", pintarFilasNomina);

function pintarFilasNomina() {
  const tbody = el("nomina-filas");
  tbody.innerHTML = "";
  const filtro = el("buscar-nomina").value.trim().toLowerCase();
  const filas = emp.nomina.filas.filter(function (f) {
    return !filtro || f.nombres.toLowerCase().includes(filtro) || f.cedula.includes(filtro);
  });

  if (filas.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 10;
    td.className = "vacio-lista";
    td.textContent = emp.nomina.filas.length ? "Nadie coincide con la búsqueda." : "Todavía nadie se ha registrado en esta capacitación.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  filas.forEach(function (f) {
    const tr = document.createElement("tr");
    const celdas = [f.nombres, f.cedula, f.sexo || "—", f.edad ?? "—", f.etnia || "—", f.modalidad, null, f.nota === null ? "—" : formatearNota(f.nota) + " %", f.certificado || "—"];
    celdas.forEach(function (valor, i) {
      const td = document.createElement("td");
      if (i === 6) {
        const s = document.createElement("span");
        s.className = "estado-acceso " + f.clase;
        s.textContent = f.estado;
        td.appendChild(s);
      } else {
        td.textContent = valor;
      }
      tr.appendChild(td);
    });
    const tdAcc = document.createElement("td");
    if (f.certId) tdAcc.appendChild(boton("Anular certificado", "enlace-boton rojo", function () { anularCertificado(f); }));
    tr.appendChild(tdAcc);
    tbody.appendChild(tr);
  });
}

async function anularCertificado(f) {
  if (!confirm("¿Anular el certificado " + f.certificado + " de " + f.nombres + "? Dejará de ser válido en la página de verificación. La persona podrá volver a obtenerlo solo con un código vigente.")) return;
  const r = await nexusDb.from("cap_certificados").delete().eq("id", f.certId);
  if (r.error) return errorSupabase(r.error, "No se pudo anular el certificado.");
  avisar("Certificado anulado.");
  await abrirNomina(emp.nomina.conv);
}

el("btn-volver").addEventListener("click", async function () {
  mostrar("vista-empresa");
  await cargarConvocatorias();
});

// Exportar a Excel (.xlsx) con dos hojas: Nómina y Resumen
// Lector/generador de Excel: se descarga solo cuando se usa (ahorra ~900 KB al abrir la página)
function cargarXLSX() {
  if (window.XLSX) return Promise.resolve();
  return new Promise(function (ok, falla) {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = ok;
    s.onerror = function () { s.remove(); falla(new Error("xlsx")); };
    document.head.appendChild(s);
  });
}

el("btn-excel").addEventListener("click", async function () {
  try { await cargarXLSX(); } catch (e) { return avisar("No se pudo cargar el generador de Excel. Revisa tu conexión.", "error"); }
  if (!emp.nomina) return;
  const c = emp.nomina.conv;
  const filas = emp.nomina.filas.map(function (f) {
    return {
      "Nombres": f.nombres,
      "Cédula": f.cedula,
      "Correo": f.correo,
      "Sexo": f.sexo,
      "Edad": f.edad ?? "",
      "Autoidentificación étnica": f.etnia,
      "Modalidad": f.modalidad,
      "Fecha de registro": fechaHora(f.registro),
      "Estado": f.estado,
      "Nota (%)": f.nota === null ? "" : f.nota,
      "Intentos": f.intentos,
      "Código de certificado": f.certificado,
      "Fecha del certificado": f.emitido ? fechaHora(f.emitido) : ""
    };
  });
  const certificados = emp.nomina.filas.filter(function (f) { return f.certificado; }).length;
  const total = emp.actual.num_trabajadores;
  const hombres = emp.nomina.filas.filter(function (f) { return f.sexo === "M"; }).length;
  const mujeres = emp.nomina.filas.filter(function (f) { return f.sexo === "F"; }).length;
  const resumen = [
    ["Empresa", emp.actual.nombre],
    ["RUC", emp.actual.ruc || ""],
    ["Capacitación", c.cap_cursos.titulo],
    ["Modalidad", NOMBRE_MODALIDAD[c.modalidad]],
    ["Horas", Number(c.horas || c.cap_cursos.horas)],
    ["Inscritos", emp.nomina.filas.length],
    ["Con certificado", certificados],
    ["Hombres", hombres],
    ["Mujeres", mujeres],
    ["Trabajadores de la empresa", total === null || total === undefined ? "No registrado" : total],
    ["Avance", total ? Math.min(100, Math.round(certificados * 100 / total)) + " %" : ""],
    ["Generado el", fechaHora(new Date().toISOString())]
  ];

  const libro = XLSX.utils.book_new();
  const hoja = XLSX.utils.json_to_sheet(filas.length ? filas : [{ "Nombres": "Sin registros" }]);
  hoja["!cols"] = [{ wch: 34 }, { wch: 14 }, { wch: 28 }, { wch: 6 }, { wch: 6 }, { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 24 }, { wch: 9 }, { wch: 9 }, { wch: 20 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(libro, hoja, "Nómina");
  const hojaRes = XLSX.utils.aoa_to_sheet(resumen);
  hojaRes["!cols"] = [{ wch: 28 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(libro, hojaRes, "Resumen");

  const nombre = ("Nomina_" + emp.actual.nombre + "_" + c.cap_cursos.titulo)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "_").slice(0, 80);
  XLSX.writeFile(libro, nombre + ".xlsx");
});

// Mismas opciones que el test ATD de NEXUS
const ETNIAS = {
  mestizo: "Mestizo", blanco: "Blanco", indigena: "Indígena", montubio: "Montubio",
  afroecuatoriano: "Afroecuatoriano", otro: "Otro", no_responde: "No declara"
};

// Edad cumplida a la fecha del registro
function edadEn(nacimiento, fecha) {
  const n = String(nacimiento).slice(0, 10).split("-").map(Number);
  const f = new Date(fecha);
  let edad = f.getFullYear() - n[0];
  if (f.getMonth() + 1 < n[1] || (f.getMonth() + 1 === n[1] && f.getDate() < n[2])) edad--;
  return edad >= 0 && edad < 120 ? edad : null;
}

// ---------------------------------------------------------------------
// Utilidades de fechas y formato
// ---------------------------------------------------------------------
function dos(n) { return String(n).padStart(2, "0"); }
function hoyISO() { const d = new Date(); return d.getFullYear() + "-" + dos(d.getMonth() + 1) + "-" + dos(d.getDate()); }
function sumarDiasISO(dias) { const d = new Date(); d.setDate(d.getDate() + dias); return d.getFullYear() + "-" + dos(d.getMonth() + 1) + "-" + dos(d.getDate()); }
function horaActual() { const d = new Date(); return dos(d.getHours()) + ":" + dos(d.getMinutes()); }
function horaMas(h) { const d = new Date(); d.setHours(Math.min(23, d.getHours() + h)); if (d.getHours() === 23) d.setMinutes(59); return dos(d.getHours()) + ":" + dos(d.getMinutes()); }
function fechaHora(iso) {
  return new Date(iso).toLocaleString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fechaCorta(iso) {
  return new Date(iso).toLocaleDateString("es-EC", { day: "numeric", month: "short", year: "numeric" });
}
function formatearHoras(horas) {
  const n = Number(horas);
  return n === 1 ? "1 hora" : n.toLocaleString("es-EC") + " horas";
}
function formatearNota(n) {
  return Number(n).toLocaleString("es-EC", { maximumFractionDigits: 1 });
}
