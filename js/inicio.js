// =====================================================================
// NEXUS LEARNING · PÁGINA DE INICIO
// Carpeta: js/inicio.js
// Valida el código de capacitación y lleva al participante a su curso.
// Además: ventana "Iniciar sesión" (docente / estudiante) y catálogo.
// =====================================================================

// Ordena lo que escribe la persona: mayúsculas, sin espacios y con guion
function normalizarCodigo(texto) {
  return String(texto || "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

// Conecta un formulario de clave (portada o ventana) con la validación
function conectarAcceso(idForm, idCampo, idError, idBoton) {
  const campoAcceso = document.getElementById(idCampo);
  const errorAcceso = document.getElementById(idError);
  campoAcceso.addEventListener("input", function () { errorAcceso.textContent = ""; });
  document.getElementById(idForm).addEventListener("submit", function (ev) {
    ev.preventDefault();
    entrarConClave(campoAcceso, errorAcceso, document.getElementById(idBoton));
  });
}

async function entrarConClave(campoAcceso, errorAcceso, boton) {
  const codigo = normalizarCodigo(campoAcceso.value);
  campoAcceso.value = codigo;

  if (codigo.length < 4) {
    errorAcceso.textContent = "Escribe la clave completa, por ejemplo AGR48213.";
    campoAcceso.focus();
    return;
  }

  boton.disabled = true;
  boton.textContent = "Revisando…";

  const { data, error } = await nexusDb.rpc("cap_validar_acceso", { p_codigo: codigo });

  boton.disabled = false;
  boton.textContent = "Ingresar";

  if (error) {
    console.error(error);
    errorAcceso.textContent = "No se pudo revisar el código. Comprueba tu conexión a internet e inténtalo de nuevo.";
    return;
  }
  if (!data || !data.valido) {
    errorAcceso.textContent = (data && data.motivo) || "Ese código no es válido.";
    return;
  }

  location.href = "curso.html?codigo=" + encodeURIComponent(codigo);
}

conectarAcceso("form-acceso", "codigo-acceso", "error-acceso", "btn-acceso");
conectarAcceso("paso-estudiante", "clave-ventana", "error-clave-ventana", "btn-clave-ventana");

// =====================================================================
// VENTANA "INICIAR SESIÓN": DOCENTE O ESTUDIANTE
// =====================================================================
const ventana = document.getElementById("ventana-sesion");

function mostrarPaso(estudiante) {
  document.getElementById("paso-elegir").hidden = estudiante;
  document.getElementById("paso-estudiante").hidden = !estudiante;
  document.getElementById("error-clave-ventana").textContent = "";
  if (estudiante) document.getElementById("clave-ventana").focus();
}

document.getElementById("btn-sesion").addEventListener("click", function () {
  mostrarPaso(false);
  ventana.showModal();
});
document.getElementById("btn-estudiante").addEventListener("click", function () { mostrarPaso(true); });
document.getElementById("btn-volver-sesion").addEventListener("click", function () { mostrarPaso(false); });
document.getElementById("btn-cerrar-sesion").addEventListener("click", function () { ventana.close(); });
// Clic fuera del cuadro: cerrar
ventana.addEventListener("click", function (ev) { if (ev.target === ventana) ventana.close(); });

// =====================================================================
// CATÁLOGO PÚBLICO DE PROGRAMAS (tarjetas, filtros y búsqueda)
// =====================================================================
const catalogo = { cursos: [], filtro: "todos" };

// Foto del banner (opcional, ver config.js)
if (NEXUS_CONFIG.imagenPortada) {
  document.getElementById("banner").style.setProperty("--foto-banner", "url(\"" + NEXUS_CONFIG.imagenPortada + "\")");
  document.getElementById("banner").classList.add("con-foto");
}

(async function cargarCatalogo() {
  const estado = document.getElementById("cursos-estado");

  const { data, error } = await nexusDb.rpc("cap_catalogo");
  if (error) {
    console.error(error);
    estado.textContent = "No se pudieron cargar los programas. Recarga la página para intentarlo de nuevo.";
    estado.classList.add("error");
    return;
  }

  catalogo.cursos = Array.isArray(data) ? data : [];
  if (catalogo.cursos.length === 0) {
    estado.textContent = "Pronto publicaremos nuestros programas.";
    return;
  }

  const lista = document.getElementById("lista-cursos");
  catalogo.cursos.forEach(function (c) {
    c.tarjeta = crearTarjetaCurso(c);
    c.texto = simplificar([c.titulo, c.descripcion].concat(c.subtemas || []).join(" "));
    lista.appendChild(c.tarjeta);
  });
  contarFiltros();
  estado.hidden = true;
  lista.hidden = false;
})();

const FILTROS = {
  todos: function () { return true; },
  linea: function (c) { return c.lecciones > 0; },
  evaluacion: function (c) { return Boolean(c.evaluacion); }
};

function contarFiltros() {
  document.querySelectorAll(".filtro").forEach(function (b) {
    const n = catalogo.cursos.filter(FILTROS[b.dataset.filtro]).length;
    b.querySelector("span").textContent = "(" + n + ")";
  });
}

function aplicarFiltros() {
  const q = simplificar(document.getElementById("buscar-curso").value);
  let visibles = 0;
  catalogo.cursos.forEach(function (c) {
    const ver = FILTROS[catalogo.filtro](c) && (!q || c.texto.includes(q));
    c.tarjeta.hidden = !ver;
    if (ver) visibles++;
  });
  document.getElementById("cursos-vacio").hidden = visibles > 0 || catalogo.cursos.length === 0;
}

document.querySelectorAll(".filtro").forEach(function (b) {
  b.addEventListener("click", function () {
    catalogo.filtro = b.dataset.filtro;
    document.querySelectorAll(".filtro").forEach(function (x) {
      x.classList.toggle("activo", x === b);
      x.setAttribute("aria-selected", x === b ? "true" : "false");
    });
    aplicarFiltros();
  });
});
document.getElementById("buscar-curso").addEventListener("input", aplicarFiltros);

// Minúsculas y sin tildes, para buscar "prevencion" y encontrar "Prevención"
function simplificar(texto) {
  return String(texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function crearTarjetaCurso(c) {
  const li = document.createElement("li");
  li.className = "tarjeta-curso";

  const portada = document.createElement("div");
  const url = c.imagen ? nexusDb.storage.from("portadas").getPublicUrl(c.imagen).data.publicUrl : null;
  pintarPortada(portada, c.titulo, url);

  const cuerpo = document.createElement("div");
  cuerpo.className = "tarjeta-cuerpo";
  const h3 = document.createElement("h3");
  h3.textContent = c.titulo;
  cuerpo.appendChild(h3);

  const partes = [formatearHorasCatalogo(c.horas)];
  if (c.lecciones > 0) partes.push(c.lecciones + (c.lecciones === 1 ? " lección" : " lecciones"));
  partes.push("Certificado verificable");
  const meta = document.createElement("p");
  meta.className = "tarjeta-meta";
  meta.textContent = partes.join(" • ");
  cuerpo.appendChild(meta);

  if (c.descripcion) {
    const p = document.createElement("p");
    p.className = "tarjeta-descripcion";
    p.textContent = c.descripcion;
    cuerpo.appendChild(p);
  }
  const subtemas = Array.isArray(c.subtemas) ? c.subtemas : [];
  if (subtemas.length) {
    const s = document.createElement("p");
    s.className = "tarjeta-subtemas";
    s.textContent = "Incluye: " + subtemas.join(" · ");
    cuerpo.appendChild(s);
  }

  const lado = document.createElement("div");
  lado.className = "tarjeta-lado";
  lado.appendChild(crearChip(c.lecciones > 0 ? "Presencial o en línea" : "Presencial"));
  if (c.evaluacion) lado.appendChild(crearChip("Con evaluación", true));

  li.append(portada, cuerpo, lado);
  return li;
}

function crearChip(texto, destacado) {
  const span = document.createElement("span");
  span.className = "chip" + (destacado ? " chip-destacado" : "");
  span.textContent = texto;
  return span;
}

function formatearHorasCatalogo(horas) {
  const n = Number(horas) || 0;
  const texto = Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
  return texto + (n === 1 ? " hora" : " horas");
}
