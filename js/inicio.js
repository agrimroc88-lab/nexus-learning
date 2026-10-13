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
  let c = String(texto || "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
  if (c.length === 9 && c.indexOf("-") === -1) c = c.slice(0, 3) + "-" + c.slice(3);
  return c;
}

campoAcceso.addEventListener("input", function () {
  errorAcceso.textContent = "";
});

formAcceso.addEventListener("submit", async function (ev) {
  ev.preventDefault();
  const codigo = normalizarCodigo(campoAcceso.value);
  campoAcceso.value = codigo;

  if (codigo.length < 8) {
    errorAcceso.textContent = "Escribe el código completo, por ejemplo AND-7K4P9Q.";
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
