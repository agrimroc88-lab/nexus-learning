// =====================================================================
// NEXUS ACADEMY · PÁGINA DEL PROGRAMA (QR permanente)
// Carpeta: js/programa.js
//
// El QR impreso de cada programa abre:  programa.html?p=<id del programa>
// Aquí se muestra la presentación del programa y se pide la CLAVE de
// la empresa. Con una clave válida de ESTE programa, la persona pasa
// a curso.html y queda en la lista de su empresa.
// =====================================================================

const idPrograma = new URLSearchParams(location.search).get("p") || "";
const $ = (id) => document.getElementById(id);

(async function iniciar() {
  const formatoId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!formatoId.test(idPrograma)) return falla("Este código QR no corresponde a un programa válido.");

  const { data, error } = await nexusDb.rpc("cap_programa", { p_curso: idPrograma });
  if (error) {
    console.error(error);
    return falla("No se pudo cargar el programa. Revisa tu conexión a internet y recarga la página.");
  }
  if (!data) return falla("Este programa no está disponible en este momento.");

  document.title = data.titulo + " · Nexus Academy";
  $("p-titulo").textContent = data.titulo;
  const horas = Number(data.horas);
  const partes = [horas === 1 ? "1 hora" : horas.toLocaleString("es-EC") + " horas"];
  if (data.lecciones > 0) partes.push(data.lecciones + (data.lecciones === 1 ? " lección" : " lecciones"));
  partes.push("Certificado con código verificable");
  $("p-datos").textContent = partes.join(" · ");
  $("p-descripcion").textContent = data.descripcion || "";

  // Portada: la de color de inmediato; la imagen, si el programa tiene
  pintarPortada($("p-portada"), data.titulo, null);
  nexusDb.rpc("cap_portada", { p_curso: idPrograma }).then(function (r) {
    if (r.data) pintarPortada($("p-portada"), data.titulo, nexusDb.storage.from("portadas").getPublicUrl(r.data).data.publicUrl);
  });

  $("estado").hidden = true;
  $("programa").hidden = false;
  $("clave").focus();
})();

function falla(texto) {
  $("estado").classList.add("error");
  $("estado").textContent = texto;
}

$("clave").addEventListener("input", function () { $("error-clave").textContent = ""; });

$("form-clave").addEventListener("submit", async function (ev) {
  ev.preventDefault();
  const clave = $("clave").value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  $("clave").value = clave;

  if (clave.length < 4) {
    $("error-clave").textContent = "Escribe la clave completa que te dio tu empresa.";
    return;
  }

  const boton = $("btn-clave");
  boton.disabled = true;
  boton.textContent = "Revisando…";
  const { data, error } = await nexusDb.rpc("cap_validar_acceso", { p_codigo: clave });
  boton.disabled = false;
  boton.textContent = "Ingresar";

  if (error) {
    console.error(error);
    $("error-clave").textContent = "No se pudo revisar la clave. Comprueba tu conexión e inténtalo de nuevo.";
    return;
  }
  if (data && data.curso_id && data.curso_id !== idPrograma) {
    $("error-clave").textContent = "Esa clave corresponde a otra capacitación. Revisa que estés en el programa correcto.";
    return;
  }
  if (!data || !data.valido) {
    $("error-clave").textContent = (data && data.motivo) || "Esa clave no es válida.";
    return;
  }

  location.href = "curso.html?codigo=" + encodeURIComponent(clave);
});
