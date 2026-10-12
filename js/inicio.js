// =====================================================================
// NEXUS LEARNING · PÁGINA DE INICIO
// Carpeta: js/inicio.js
// Carga los cursos publicados desde Supabase y los muestra en la lista.
// =====================================================================

(async function cargarCursos() {
  const estado = document.getElementById("estado-cursos");
  const lista = document.getElementById("lista-cursos");

  try {
    const { data, error } = await nexusDb
      .from("cap_cursos")
      .select("id, titulo, descripcion, horas, cap_lecciones(count)")
      .eq("publicado", true)
      .order("creado_en", { ascending: true });

    if (error) throw error;

    if (!data || data.length === 0) {
      estado.textContent = "Todavía no hay cursos publicados. Vuelve pronto.";
      return;
    }

    data.forEach(function (curso) {
      lista.appendChild(crearFilaCurso(curso));
    });

    estado.hidden = true;
    lista.hidden = false;
  } catch (e) {
    console.error("Error al cargar cursos:", e);
    estado.classList.add("error");
    estado.textContent = "No se pudieron cargar los cursos. Revisa tu conexión a internet y recarga la página.";
  }
})();

// Crea la fila de un curso. Usa textContent (no innerHTML) para que
// ningún texto guardado en la base de datos pueda inyectar código.
function crearFilaCurso(curso) {
  const li = document.createElement("li");
  li.className = "curso";

  const info = document.createElement("div");

  const titulo = document.createElement("h3");
  titulo.textContent = curso.titulo;

  const descripcion = document.createElement("p");
  descripcion.textContent = curso.descripcion || "";

  const lecciones = (curso.cap_lecciones && curso.cap_lecciones[0]) ? curso.cap_lecciones[0].count : 0;

  const datos = document.createElement("div");
  datos.className = "datos";
  [
    formatearHoras(curso.horas),
    lecciones + (lecciones === 1 ? " lección" : " lecciones"),
    "Certificado incluido"
  ].forEach(function (texto) {
    const span = document.createElement("span");
    span.textContent = texto;
    datos.appendChild(span);
  });

  info.append(titulo, descripcion, datos);

  const boton = document.createElement("a");
  boton.className = "boton";
  boton.href = "curso.html?id=" + encodeURIComponent(curso.id);
  boton.textContent = "Empezar curso";

  li.append(info, boton);
  return li;
}

function formatearHoras(horas) {
  const n = Number(horas);
  return n === 1 ? "1 hora" : n.toLocaleString("es-EC") + " horas";
}
