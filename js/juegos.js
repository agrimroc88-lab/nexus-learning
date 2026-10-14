// =====================================================================
// NEXUS LEARNING · BIBLIOTECA DE JUEGOS (solo administradores)
// Carpeta: js/juegos.js
//
// Crea, edita, prueba y elimina juegos de cap_juegos. Cada juego se
// agrega luego a una lección (admin.html → Lecciones → Juego).
// Un juego en uso por alguna lección no se puede eliminar (la base lo
// impide); primero hay que quitarlo de esas lecciones.
// =====================================================================

const $j = (id) => document.getElementById(id);
const jg = { juegos: [], uso: {}, editando: null, tipo: null };

const AYUDA_TIPO = {
  numeros: "Busca los números (5S): demuestra cuánto tiempo se ahorra con orden y limpieza.",
  clasificar: "Clasifica: la persona decide entre dos opciones para cada tarjeta y ve la explicación.",
  ordenar: "Ordena los pasos: la persona toca los pasos de un procedimiento en el orden correcto."
};

(async function iniciar() {
  const usuario = await exigirAdministrador();
  if (!usuario) return;
  mostrarUsuario(usuario, "admin");
  $j("cargando").hidden = true;
  $j("panel").hidden = false;
  await cargar();
})();

$j("btn-salir").addEventListener("click", cerrarSesion);

function avisar(texto, tipo) {
  const a = $j("aviso");
  a.textContent = texto;
  a.className = "aviso " + (tipo || "ok");
  a.hidden = false;
  a.scrollIntoView({ behavior: "smooth", block: "nearest" });
  clearTimeout(avisar.t);
  avisar.t = setTimeout(function () { a.hidden = true; }, tipo === "error" ? 8000 : 3500);
}

// ---------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------
async function cargar() {
  const [r1, r2] = await Promise.all([
    nexusDb.from("cap_juegos").select("id, tipo, titulo, config").order("titulo"),
    nexusDb.from("cap_lecciones").select("juego_id").not("juego_id", "is", null)
  ]);
  if (r1.error) {
    console.error(r1.error);
    return avisar("No se pudieron cargar los juegos. Si es la primera vez, ejecuta en Supabase el archivo sql/capacitaciones_23_juegos.sql.", "error");
  }
  jg.juegos = r1.data || [];
  jg.uso = {};
  (r2.data || []).forEach(function (l) { jg.uso[l.juego_id] = (jg.uso[l.juego_id] || 0) + 1; });
  pintar();
}

function pintar() {
  const ol = $j("lista-juegos");
  ol.innerHTML = "";
  if (jg.juegos.length === 0) {
    const li = document.createElement("li");
    li.className = "vacio-lista";
    li.textContent = "Aún no hay juegos. Crea el primero con los botones de abajo.";
    ol.appendChild(li);
    return;
  }
  jg.juegos.forEach(function (j, i) {
    const li = document.createElement("li");
    li.className = "item";
    const num = document.createElement("span");
    num.className = "item-num";
    num.textContent = i + 1;
    const info = document.createElement("div");
    info.className = "item-info";
    const t = document.createElement("strong");
    t.textContent = j.titulo;
    const s = document.createElement("small");
    const n = jg.uso[j.id] || 0;
    s.textContent = (NexusJuegos.NOMBRES[j.tipo] || j.tipo) + " · " + resumenConfig(j) + " · " +
      (n ? "En " + n + (n === 1 ? " lección" : " lecciones") : "Sin usar");
    info.append(t, s);
    li.append(num, info,
      accion("Probar", "", function () { probar(j); }),
      accion("Editar", "", function () { editar(j); }),
      accion("Duplicar", "", function () { duplicar(j); }),
      accion("Eliminar", "rojo", function () { eliminar(j); }));
    ol.appendChild(li);
  });
}

function accion(texto, clase, fn) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "enlace-boton " + clase;
  b.textContent = texto;
  b.addEventListener("click", fn);
  return b;
}

function resumenConfig(j) {
  const c = j.config || {};
  if (j.tipo === "numeros") return (c.cantidad || 30) + " números, " + (c.segundos || 60) + " s por ronda";
  if (j.tipo === "clasificar") return (c.tarjetas || []).length + " tarjetas";
  if (j.tipo === "ordenar") return (c.pasos || []).length + " pasos";
  return "";
}

// ---------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------
document.querySelectorAll("[data-nuevo]").forEach(function (b) {
  b.addEventListener("click", function () { abrirEditor(null, b.dataset.nuevo); });
});

function abrirEditor(juego, tipo) {
  jg.editando = juego;
  jg.tipo = juego ? juego.tipo : tipo;
  const c = (juego && juego.config) || {};
  $j("j-form-titulo").textContent = (juego ? "Editar juego · " : "Nuevo juego · ") + NexusJuegos.NOMBRES[jg.tipo];
  $j("j-tipo-ayuda").textContent = AYUDA_TIPO[jg.tipo];
  document.querySelectorAll("[data-tipo]").forEach(function (d) { d.hidden = d.dataset.tipo !== jg.tipo; });

  $j("j-titulo").value = juego ? juego.titulo : "";
  $j("j-instruccion").value = c.instruccion || "";
  $j("j-cantidad").value = c.cantidad || 30;
  $j("j-segundos").value = c.segundos || 60;
  $j("j-opcion-a").value = c.opcion_a || "";
  $j("j-opcion-b").value = c.opcion_b || "";
  $j("j-pasos").value = (c.pasos || []).join("\n");
  $j("j-tarjetas").innerHTML = "";
  if (jg.tipo === "clasificar") {
    const tarjetas = c.tarjetas && c.tarjetas.length ? c.tarjetas : [{}, {}, {}];
    tarjetas.forEach(agregarTarjeta);
  }

  $j("vista-juego").hidden = true;
  $j("editor-juego").hidden = false;
  $j("editor-juego").scrollIntoView({ behavior: "smooth", block: "start" });
  $j("j-titulo").focus();
}

function etiquetaOpcion(k) {
  return $j(k === "a" ? "j-opcion-a" : "j-opcion-b").value.trim() || (k === "a" ? "Opción A" : "Opción B");
}

function agregarTarjeta(t) {
  t = t || {};
  const li = document.createElement("li");
  li.className = "tarjeta-editor";
  const texto = document.createElement("textarea");
  texto.className = "campo area t-texto";
  texto.rows = 2;
  texto.maxLength = 300;
  texto.placeholder = "Situación (ej.: Trabajador sin casco en zona de obra)";
  texto.value = t.texto || "";
  const fila = document.createElement("div");
  fila.className = "tarjeta-fila";
  const sel = document.createElement("select");
  sel.className = "campo t-respuesta";
  ["a", "b"].forEach(function (k) {
    const o = document.createElement("option");
    o.value = k;
    o.textContent = "Respuesta: " + etiquetaOpcion(k);
    sel.appendChild(o);
  });
  sel.value = t.respuesta === "b" ? "b" : "a";
  const quitar = accion("Quitar", "rojo", function () { li.remove(); });
  fila.append(sel, quitar);
  const exp = document.createElement("input");
  exp.className = "campo t-explicacion";
  exp.maxLength = 300;
  exp.placeholder = "Explicación (opcional): por qué es esa respuesta";
  exp.value = t.explicacion || "";
  li.append(texto, fila, exp);
  $j("j-tarjetas").appendChild(li);
}

$j("btn-agregar-tarjeta").addEventListener("click", function () {
  agregarTarjeta({});
  const ultimas = $j("j-tarjetas").querySelectorAll(".t-texto");
  ultimas[ultimas.length - 1].focus();
});

// Al cambiar el nombre de las opciones, se actualizan los selectores
["j-opcion-a", "j-opcion-b"].forEach(function (id) {
  $j(id).addEventListener("input", function () {
    $j("j-tarjetas").querySelectorAll(".t-respuesta").forEach(function (sel) {
      sel.options[0].textContent = "Respuesta: " + etiquetaOpcion("a");
      sel.options[1].textContent = "Respuesta: " + etiquetaOpcion("b");
    });
  });
});

$j("btn-cancelar-juego").addEventListener("click", function () {
  $j("editor-juego").hidden = true;
  jg.editando = null;
});

// Lee el formulario. Devuelve { juego } o { error }
function leerFormulario() {
  const titulo = $j("j-titulo").value.trim();
  if (titulo.length < 3) return { error: "Escribe el título del juego." };
  const config = { instruccion: $j("j-instruccion").value.trim() };

  if (jg.tipo === "numeros") {
    const n = parseInt($j("j-cantidad").value, 10);
    const s = parseInt($j("j-segundos").value, 10);
    if (!(n >= 10 && n <= 60)) return { error: "La cantidad de números debe estar entre 10 y 60." };
    if (!(s >= 20 && s <= 300)) return { error: "El tiempo por ronda debe estar entre 20 y 300 segundos." };
    config.cantidad = n;
    config.segundos = s;
  } else if (jg.tipo === "clasificar") {
    config.opcion_a = $j("j-opcion-a").value.trim();
    config.opcion_b = $j("j-opcion-b").value.trim();
    if (!config.opcion_a || !config.opcion_b) return { error: "Escribe el nombre de las dos opciones." };
    config.tarjetas = [];
    $j("j-tarjetas").querySelectorAll(".tarjeta-editor").forEach(function (li) {
      const texto = li.querySelector(".t-texto").value.trim();
      if (!texto) return;
      const t = { texto: texto, respuesta: li.querySelector(".t-respuesta").value };
      const exp = li.querySelector(".t-explicacion").value.trim();
      if (exp) t.explicacion = exp;
      config.tarjetas.push(t);
    });
    if (config.tarjetas.length < 3) return { error: "Agrega al menos 3 tarjetas con texto." };
  } else if (jg.tipo === "ordenar") {
    config.pasos = $j("j-pasos").value.split("\n").map(function (p) { return p.trim().replace(/^\d+\s*[.)-]\s*/, ""); }).filter(Boolean);
    if (config.pasos.length < 3 || config.pasos.length > 10) return { error: "Escribe de 3 a 10 pasos, uno por línea." };
  }
  return { juego: { tipo: jg.tipo, titulo: titulo, config: config } };
}

$j("btn-probar-juego").addEventListener("click", function () {
  const r = leerFormulario();
  if (r.error) return avisar(r.error, "error");
  const vista = $j("vista-juego");
  vista.hidden = false;
  NexusJuegos.montar(vista, r.juego);
  vista.scrollIntoView({ behavior: "smooth", block: "start" });
});

$j("form-juego").addEventListener("submit", async function (ev) {
  ev.preventDefault();
  const r = leerFormulario();
  if (r.error) return avisar(r.error, "error");
  const boton = $j("btn-guardar-juego");
  boton.disabled = true;
  const res = jg.editando
    ? await nexusDb.from("cap_juegos").update({ titulo: r.juego.titulo, config: r.juego.config }).eq("id", jg.editando.id)
    : await nexusDb.from("cap_juegos").insert(r.juego);
  boton.disabled = false;
  if (res.error) {
    console.error(res.error);
    return avisar("No se pudo guardar el juego. Detalle: " + (res.error.message || "error desconocido"), "error");
  }
  avisar(jg.editando ? "Juego actualizado." : "Juego creado. Ya puedes agregarlo a una lección.");
  $j("editor-juego").hidden = true;
  jg.editando = null;
  await cargar();
});

// ---------------------------------------------------------------------
// Acciones de la lista
// ---------------------------------------------------------------------
function editar(j) { abrirEditor(j); }

function probar(j) {
  abrirEditor(j);
  $j("btn-probar-juego").click();
}

async function duplicar(j) {
  const { error } = await nexusDb.from("cap_juegos")
    .insert({ tipo: j.tipo, titulo: (j.titulo + " (copia)").slice(0, 120), config: j.config });
  if (error) return avisar("No se pudo duplicar el juego. Detalle: " + error.message, "error");
  avisar("Juego duplicado.");
  await cargar();
}

async function eliminar(j) {
  if (jg.uso[j.id]) {
    return avisar("Este juego está en " + jg.uso[j.id] + (jg.uso[j.id] === 1 ? " lección" : " lecciones") +
      ". Quítalo primero de esas lecciones (Cursos → Lecciones → Juego: Sin juego).", "error");
  }
  if (!confirm("¿Eliminar el juego \"" + j.titulo + "\"?")) return;
  const { error } = await nexusDb.from("cap_juegos").delete().eq("id", j.id);
  if (error) {
    const enUso = error.code === "23503";
    return avisar(enUso ? "Este juego está en uso en alguna lección. Quítalo primero de esa lección." :
      "No se pudo eliminar el juego. Detalle: " + error.message, "error");
  }
  if (jg.editando && jg.editando.id === j.id) $j("editor-juego").hidden = true;
  avisar("Juego eliminado.");
  await cargar();
}
