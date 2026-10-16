// =====================================================================
// NEXUS ACADEMY · BIBLIOTECA DE JUEGOS (solo administradores)
// Carpeta: js/juegos.js
//
// Crea, edita, prueba y elimina juegos de cap_juegos. Cada juego se
// agrega luego a una lección (admin.html → Lecciones → Juego).
// Un juego en uso por alguna lección no se puede eliminar (la base lo
// impide); primero hay que quitarlo de esas lecciones.
// =====================================================================

const $j = (id) => document.getElementById(id);
const jg = {
  juegos: [], uso: {}, editando: null, tipo: null,
  foto: { ruta: null, archivo: null, url: null },   // Caza de riesgos
  peligros: []
};
const TAMANOS = [[4, "Pequeño"], [6, "Mediano"], [9, "Grande"], [13, "Muy grande"]];
const MAX_OPCIONES_ESC = 4;

const AYUDA_TIPO = {
  numeros: "Busca los números (5S): demuestra cuánto tiempo se ahorra con orden y limpieza.",
  clasificar: "Clasifica: la persona decide entre dos opciones para cada tarjeta y ve la explicación.",
  ordenar: "Ordena los pasos: la persona toca los pasos de un procedimiento en el orden correcto.",
  riesgos: "Caza de riesgos: el grupo busca y toca los peligros en una foto o ilustración. Si marcas cada peligro como acto o condición subestándar, al encontrarlo se pregunta cuál es (modo Detective de riesgos).",
  escenarios: "¿Qué harías?: situaciones reales con varias respuestas; al elegir se explica cuál es la decisión segura.",
  ruleta: "Ruleta de preguntas: los equipos giran la ruleta por turnos, responden en voz alta y el docente marca los puntos.",
  memoria: "Memoria de parejas: cartas boca abajo para unir, por ejemplo, cada peligro con su medida de control. Con equipos, quien acierta sigue jugando.",
  reloj: "Contra reloj: afirmaciones de verdadero o falso con cuenta regresiva. Más rapidez y respuestas seguidas dan más puntos."
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
      accion("Presentar", "", function () { location.href = "charla.html#" + encodeURIComponent(j.id); }),
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
  if (j.tipo === "riesgos") return (c.peligros || []).length + " peligros en la imagen" +
    ((c.peligros || []).some(function (p) { return p.clase; }) ? " · acto o condición" : "");
  if (j.tipo === "escenarios") return (c.escenarios || []).length + " situaciones";
  if (j.tipo === "ruleta") return (c.preguntas || []).length + " preguntas · " + (c.equipos || []).length + " equipos";
  if (j.tipo === "memoria") return (c.pares || []).length + " parejas" + ((c.equipos || []).length ? " · " + c.equipos.length + " equipos" : "");
  if (j.tipo === "reloj") return (c.afirmaciones || []).length + " afirmaciones · " + (c.segundos || 10) + " s cada una";
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
  document.querySelectorAll("[data-tipo]").forEach(function (d) { d.hidden = d.dataset.tipo.split(" ").indexOf(jg.tipo) < 0; });

  $j("j-titulo").value = juego ? juego.titulo : "";
  $j("j-instruccion").value = c.instruccion || "";
  $j("j-cantidad").value = c.cantidad || 30;
  $j("j-segundos").value = c.segundos || 60;
  $j("j-opcion-a").value = c.opcion_a || "";
  $j("j-opcion-b").value = c.opcion_b || "";
  $j("j-pasos").value = (c.pasos || []).join("\n");
  $j("j-equipos").value = (c.equipos || []).join(", ");
  $j("j-preguntas").value = (c.preguntas || []).map(function (p) { return p.pregunta + (p.respuesta ? " | " + p.respuesta : ""); }).join("\n");
  $j("j-pares").value = (c.pares || []).map(function (p) { return p.a + " | " + p.b; }).join("\n");
  $j("j-reloj-seg").value = c.segundos || 10;
  $j("j-afirmaciones").value = (c.afirmaciones || []).map(function (a) {
    return (a.verdadero ? "V" : "F") + " | " + a.texto + (a.explicacion ? " | " + a.explicacion : "");
  }).join("\n");
  $j("j-tarjetas").innerHTML = "";
  if (jg.tipo === "clasificar") {
    const tarjetas = c.tarjetas && c.tarjetas.length ? c.tarjetas : [{}, {}, {}];
    tarjetas.forEach(agregarTarjeta);
  }
  // Caza de riesgos
  $j("j-foto").value = "";
  jg.foto = { ruta: c.imagen || null, archivo: null, url: c.imagen ? NexusJuegos.urlImagen(c.imagen) : null };
  jg.peligros = (c.peligros || []).map(function (p) { return Object.assign({}, p); });
  pintarFotoEditor();
  // ¿Qué harías?
  $j("j-escenarios").innerHTML = "";
  if (jg.tipo === "escenarios") {
    const lista = c.escenarios && c.escenarios.length ? c.escenarios : [{}, {}];
    lista.forEach(agregarEscenario);
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

// ---------------------------------------------------------------------
// Editor de "Caza de riesgos": foto + círculos sobre cada peligro
// ---------------------------------------------------------------------
$j("j-foto").addEventListener("change", function () {
  const archivo = $j("j-foto").files[0];
  if (!archivo) return;
  if (!/^image\/(jpeg|png|webp)$/.test(archivo.type)) { $j("j-foto").value = ""; return avisar("La foto debe ser JPG, PNG o WEBP.", "error"); }
  if (archivo.size > 2 * 1024 * 1024) { $j("j-foto").value = ""; return avisar("La foto pesa más de 2 MB. Redúcela e inténtalo de nuevo.", "error"); }
  if (jg.foto.archivo && jg.foto.url) URL.revokeObjectURL(jg.foto.url);
  jg.foto.archivo = archivo;
  jg.foto.url = URL.createObjectURL(archivo);
  pintarFotoEditor();
});

function pintarFotoEditor() {
  const caja = $j("j-foto-caja");
  caja.hidden = !jg.foto.url;
  if (jg.foto.url && $j("j-foto-img").getAttribute("src") !== jg.foto.url) $j("j-foto-img").src = jg.foto.url;
  caja.querySelectorAll(".marca-riesgo").forEach(function (m) { m.remove(); });
  jg.peligros.forEach(function (p, i) {
    const m = document.createElement("span");
    m.className = "marca-riesgo";
    m.textContent = i + 1;
    m.style.left = p.x + "%";
    m.style.top = p.y + "%";
    m.style.width = m.style.height = (2 * p.r) + "cqw";
    caja.appendChild(m);
  });
  pintarListaPeligros();
}

$j("j-foto-caja").addEventListener("click", function (ev) {
  const r = $j("j-foto-img").getBoundingClientRect();
  const x = (ev.clientX - r.left) / r.width * 100, y = (ev.clientY - r.top) / r.height * 100;
  if (x < 0 || y < 0 || x > 100 || y > 100) return;
  if (jg.peligros.length >= 25) return avisar("Máximo 25 peligros por imagen.", "error");
  jg.peligros.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, r: 6, nombre: "", explicacion: "" });
  pintarFotoEditor();
  const nombres = $j("j-peligros").querySelectorAll(".p-nombre");
  nombres[nombres.length - 1].focus();
});

function pintarListaPeligros() {
  const ol = $j("j-peligros");
  ol.innerHTML = "";
  jg.peligros.forEach(function (p, i) {
    const li = document.createElement("li");
    li.className = "peligro-editor";
    const num = document.createElement("span");
    num.className = "item-num";
    num.textContent = i + 1;
    const campos = document.createElement("div");
    campos.className = "campos";
    const nombre = document.createElement("input");
    nombre.className = "campo p-nombre";
    nombre.maxLength = 80;
    nombre.placeholder = "Nombre del peligro (ej.: Cables sueltos en el piso)";
    nombre.value = p.nombre || "";
    nombre.addEventListener("input", function () { p.nombre = nombre.value; });
    const exp = document.createElement("input");
    exp.className = "campo";
    exp.maxLength = 250;
    exp.placeholder = "Explicación (opcional): por qué es peligroso o cómo se controla";
    exp.value = p.explicacion || "";
    exp.addEventListener("input", function () { p.explicacion = exp.value; });
    const fila = document.createElement("div");
    fila.className = "peligro-fila";
    const etiqueta = document.createElement("label");
    etiqueta.textContent = "Tamaño del círculo: ";
    const tam = document.createElement("select");
    TAMANOS.forEach(function (t) {
      const o = document.createElement("option");
      o.value = t[0];
      o.textContent = t[1];
      tam.appendChild(o);
    });
    tam.value = String(TAMANOS.some(function (t) { return t[0] === p.r; }) ? p.r : 6);
    tam.addEventListener("change", function () { p.r = Number(tam.value); pintarFotoEditor(); });
    etiqueta.appendChild(tam);
    const etClase = document.createElement("label");
    etClase.textContent = "Tipo: ";
    const clase = document.createElement("select");
    [["", "Sin clasificar"], ["acto", "Acto subestándar"], ["condicion", "Condición subestándar"]].forEach(function (t) {
      const o = document.createElement("option");
      o.value = t[0];
      o.textContent = t[1];
      clase.appendChild(o);
    });
    clase.value = p.clase || "";
    clase.addEventListener("change", function () { p.clase = clase.value; });
    etClase.appendChild(clase);
    fila.append(etiqueta, etClase, accion("Quitar", "rojo", function () { jg.peligros.splice(i, 1); pintarFotoEditor(); }));
    campos.append(nombre, exp, fila);
    li.append(num, campos);
    ol.appendChild(li);
  });
}

// ---------------------------------------------------------------------
// Editor de "¿Qué harías?"
// ---------------------------------------------------------------------
let contadorEscenarios = 0;
function agregarEscenario(e) {
  e = e || {};
  const grupo = "esc-" + (++contadorEscenarios);
  const li = document.createElement("li");
  li.className = "escenario-editor";
  const sit = document.createElement("textarea");
  sit.className = "campo area e-situacion";
  sit.rows = 2;
  sit.maxLength = 400;
  sit.placeholder = "Situación (ej.: Ves a un compañero usando una escalera con un peldaño roto.)";
  sit.value = e.situacion || "";
  li.appendChild(sit);
  const opciones = e.opciones || [];
  for (let k = 0; k < MAX_OPCIONES_ESC; k++) {
    const o = opciones[k] || {};
    const fila = document.createElement("div");
    fila.className = "opcion-escenario-editor";
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = grupo;
    radio.className = "e-correcta";
    radio.checked = !!o.correcta;
    radio.setAttribute("aria-label", "Respuesta correcta");
    const texto = document.createElement("input");
    texto.className = "campo e-texto";
    texto.maxLength = 250;
    texto.placeholder = "Respuesta " + (k + 1) + (k >= 2 ? " (opcional)" : "");
    texto.value = o.texto || "";
    const exp = document.createElement("input");
    exp.className = "campo t-exp e-exp";
    exp.maxLength = 250;
    exp.placeholder = "Por qué (se muestra al elegirla)";
    exp.value = o.explicacion || "";
    fila.append(radio, texto, exp);
    li.appendChild(fila);
  }
  li.appendChild(accion("Quitar situación", "rojo", function () { li.remove(); }));
  $j("j-escenarios").appendChild(li);
}

$j("btn-agregar-escenario").addEventListener("click", function () {
  agregarEscenario({});
  const s = $j("j-escenarios").querySelectorAll(".e-situacion");
  s[s.length - 1].focus();
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
  } else if (jg.tipo === "riesgos") {
    if (!jg.foto.url) return { error: "Elige la foto del juego." };
    if (jg.peligros.length === 0) return { error: "Toca la foto para marcar al menos un peligro." };
    if (jg.peligros.some(function (p) { return !String(p.nombre || "").trim(); })) return { error: "Escribe el nombre de cada peligro marcado." };
    config.imagen = jg.foto.archivo ? jg.foto.url : jg.foto.ruta;   // al guardar se reemplaza por la ruta subida
    config.peligros = jg.peligros.map(function (p) {
      const x = { x: p.x, y: p.y, r: p.r, nombre: p.nombre.trim() };
      if (String(p.explicacion || "").trim()) x.explicacion = p.explicacion.trim();
      if (p.clase === "acto" || p.clase === "condicion") x.clase = p.clase;
      return x;
    });
  } else if (jg.tipo === "escenarios") {
    config.escenarios = [];
    let error = null;
    $j("j-escenarios").querySelectorAll(".escenario-editor").forEach(function (li, n) {
      if (error) return;
      const situacion = li.querySelector(".e-situacion").value.trim();
      const opciones = [];
      li.querySelectorAll(".opcion-escenario-editor").forEach(function (f) {
        const texto = f.querySelector(".e-texto").value.trim();
        if (!texto) return;
        const o = { texto: texto, correcta: f.querySelector(".e-correcta").checked };
        const exp = f.querySelector(".e-exp").value.trim();
        if (exp) o.explicacion = exp;
        opciones.push(o);
      });
      if (!situacion && opciones.length === 0) return;   // bloque vacío: se ignora
      if (!situacion) error = "Escribe el texto de la situación " + (n + 1) + ".";
      else if (opciones.length < 2) error = "La situación " + (n + 1) + " necesita al menos 2 respuestas.";
      else if (opciones.filter(function (o) { return o.correcta; }).length !== 1) error = "Marca la respuesta correcta de la situación " + (n + 1) + ".";
      else config.escenarios.push({ situacion: situacion, opciones: opciones });
    });
    if (error) return { error: error };
    if (config.escenarios.length < 2) return { error: "Agrega al menos 2 situaciones completas." };
  } else if (jg.tipo === "ruleta" || jg.tipo === "memoria" || jg.tipo === "reloj") {
    const equipos = $j("j-equipos").value.split(",").map(function (e) { return e.trim(); }).filter(Boolean);
    if (equipos.length === 1 || equipos.length > 6) return { error: "Escribe de 2 a 6 equipos separados por coma" + (jg.tipo === "ruleta" ? "." : ", o deja el campo vacío.") };
    if (jg.tipo === "ruleta" && equipos.length < 2) return { error: "La ruleta necesita al menos 2 equipos, separados por coma." };
    if (equipos.length) config.equipos = equipos;
    const lineas = function (id) {
      return $j(id).value.split("\n").map(function (l) { return l.split("|").map(function (x) { return x.trim(); }); })
        .filter(function (p) { return p.join("").length; });
    };
    if (jg.tipo === "ruleta") {
      config.preguntas = lineas("j-preguntas").map(function (p) { return { pregunta: p[0], respuesta: p[1] || "" }; })
        .filter(function (p) { return p.pregunta; });
      if (config.preguntas.length < 4 || config.preguntas.length > 16) return { error: "Escribe de 4 a 16 preguntas, una por línea." };
    } else if (jg.tipo === "memoria") {
      const pares = lineas("j-pares");
      const malo = pares.findIndex(function (p) { return !p[0] || !p[1]; });
      if (malo >= 0) return { error: "La línea " + (malo + 1) + " de las parejas necesita las dos cartas separadas por |." };
      config.pares = pares.map(function (p) { return { a: p[0], b: p[1] }; });
      if (config.pares.length < 3 || config.pares.length > 12) return { error: "Escribe de 3 a 12 parejas, una por línea." };
    } else {
      const seg = parseInt($j("j-reloj-seg").value, 10);
      if (!(seg >= 5 && seg <= 60)) return { error: "Los segundos por afirmación deben estar entre 5 y 60." };
      config.segundos = seg;
      const filas = lineas("j-afirmaciones");
      const malo = filas.findIndex(function (p) { return !/^(v|f|verdadero|falso)$/i.test(p[0]) || !p[1]; });
      if (malo >= 0) return { error: "La línea " + (malo + 1) + " de las afirmaciones debe empezar con V o F, luego | y la afirmación." };
      config.afirmaciones = filas.map(function (p) {
        const a = { texto: p[1], verdadero: /^v/i.test(p[0]) };
        if (p[2]) a.explicacion = p.slice(2).join(" | ");
        return a;
      });
      if (config.afirmaciones.length < 4 || config.afirmaciones.length > 30) return { error: "Escribe de 4 a 30 afirmaciones, una por línea." };
    }
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

  // Caza de riesgos: primero se sube la foto nueva (carpeta juegos/ del depósito "portadas")
  let fotoNueva = null;
  const fotoAnterior = jg.editando && jg.editando.tipo === "riesgos" ? (jg.editando.config || {}).imagen : null;
  if (jg.tipo === "riesgos" && jg.foto.archivo) {
    boton.textContent = "Subiendo foto…";
    const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[jg.foto.archivo.type];
    fotoNueva = "juegos/" + ((crypto.randomUUID && crypto.randomUUID()) || Date.now()) + "." + ext;
    const subida = await nexusDb.storage.from("portadas").upload(fotoNueva, jg.foto.archivo, { contentType: jg.foto.archivo.type, upsert: false });
    if (subida.error) {
      boton.disabled = false;
      boton.textContent = "Guardar juego";
      console.error(subida.error);
      return avisar("No se pudo subir la foto. Detalle: " + (subida.error.message || "error desconocido"), "error");
    }
    r.juego.config.imagen = fotoNueva;
  }

  const res = jg.editando
    ? await nexusDb.from("cap_juegos").update({ titulo: r.juego.titulo, config: r.juego.config }).eq("id", jg.editando.id)
    : await nexusDb.from("cap_juegos").insert(r.juego);
  boton.disabled = false;
  boton.textContent = "Guardar juego";
  if (res.error) {
    console.error(res.error);
    if (fotoNueva) await nexusDb.storage.from("portadas").remove([fotoNueva]);   // no dejar fotos huérfanas
    return avisar("No se pudo guardar el juego. Detalle: " + (res.error.message || "error desconocido"), "error");
  }
  if (fotoNueva && fotoAnterior) await borrarFotoSiNoSeUsa(fotoAnterior, jg.editando.id);
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
  if (j.tipo === "riesgos" && (j.config || {}).imagen) await borrarFotoSiNoSeUsa(j.config.imagen, j.id);
  avisar("Juego eliminado.");
  await cargar();
}

// Borra la foto de un juego, salvo que otro juego (por ejemplo, una copia) la siga usando
async function borrarFotoSiNoSeUsa(ruta, idJuego) {
  if (!ruta || /^(https?:|blob:|data:|img\/)/.test(ruta)) return;   // las de img/ vienen con el sitio
  const enUso = jg.juegos.some(function (x) { return x.id !== idJuego && x.config && x.config.imagen === ruta; });
  if (enUso) return;
  const { error } = await nexusDb.storage.from("portadas").remove([ruta]);
  if (error) console.warn("No se pudo borrar la foto anterior", error);
}
