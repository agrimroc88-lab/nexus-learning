// =====================================================================
// NEXUS LEARNING · PÁGINA DE INICIO
// Carpeta: js/inicio.js
// Valida el código de capacitación y lleva al participante a su curso.
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
