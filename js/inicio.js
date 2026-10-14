// =====================================================================
// NEXUS LEARNING · PÁGINA DE INICIO
// Carpeta: js/inicio.js
// Valida el código de capacitación y lleva al participante a su curso.
// Además: catálogo público de programas.
// =====================================================================

const formAcceso = document.getElementById("form-acceso");
const campoAcceso = document.getElementById("codigo-acceso");
const errorAcceso = document.getElementById("error-acceso");

// Ordena lo que escribe la persona: mayúsculas, sin espacios y con guion
function normalizarCodigo(texto) {
  return String(texto || "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

campoAcceso.addEventListener("input", function () {
  errorAcceso.textContent = "";
});

formAcceso.addEventListener("submit", async function (ev) {
  ev.preventDefault();
  const codigo = normalizarCodigo(campoAcceso.value);
  campoAcceso.value = codigo;

  if (codigo.length < 4) {
    errorAcceso.textContent = "Escribe la clave completa, por ejemplo AGR48213.";
    campoAcceso.focus();
    return;
  }

  const boton = document.getElementById("btn-acceso");
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
});

// =====================================================================
// CATÁLOGO PÚBLICO DE PROGRAMAS
// =====================================================================
(async function cargarCatalogo() {
  const estado = document.getElementById("cursos-estado");
  const lista = document.getElementById("lista-cursos");

  const { data, error } = await nexusDb.rpc("cap_catalogo");
  if (error) {
    console.error(error);
    estado.textContent = "No se pudieron cargar los programas. Recarga la página para intentarlo de nuevo.";
    estado.classList.add("error");
    return;
  }

  const cursos = Array.isArray(data) ? data : [];
  if (cursos.length === 0) {
    estado.textContent = "Pronto publicaremos nuestros programas. Escríbenos con lo que tu empresa necesita.";
    return;
  }

  cursos.forEach(function (c) { lista.appendChild(crearTarjetaCurso(c)); });
  estado.hidden = true;
  lista.hidden = false;
})();

function crearTarjetaCurso(c) {
  const li = document.createElement("li");
  li.className = "curso";

  const info = document.createElement("div");
  const h3 = document.createElement("h3");
  h3.textContent = c.titulo;
  info.appendChild(h3);

  if (c.descripcion) {
    const p = document.createElement("p");
    p.textContent = c.descripcion;
    info.appendChild(p);
  }

  const subtemas = Array.isArray(c.subtemas) ? c.subtemas : [];
  if (subtemas.length) {
    const s = document.createElement("p");
    s.className = "subtemas";
    s.textContent = "Incluye: " + subtemas.join(" · ");
    info.appendChild(s);
  }

  const datos = document.createElement("div");
  datos.className = "datos";
  const partes = [formatearHorasCatalogo(c.horas)];
  if (c.lecciones > 0) partes.push(c.lecciones + (c.lecciones === 1 ? " lección en línea" : " lecciones en línea"));
  if (c.evaluacion) partes.push("Con evaluación");
  partes.push("Certificado verificable");
  partes.forEach(function (t) {
    const span = document.createElement("span");
    span.textContent = t;
    datos.appendChild(span);
  });
  info.appendChild(datos);

  li.appendChild(info);
  return li;
}

function formatearHorasCatalogo(horas) {
  const n = Number(horas) || 0;
  const texto = Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
  return texto + (n === 1 ? " hora" : " horas");
}

