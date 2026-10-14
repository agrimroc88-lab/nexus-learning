// =====================================================================
// NEXUS LEARNING · ENTRADA DESDE NEXUS
// Carpeta: js/entrar.js
//
// NEXUS envía aquí a la persona con un pase de UN SOLO USO en la
// dirección (después de #, que nunca viaja a ningún servidor).
// Esta página lo canjea por una sesión de Nexus Learning y lleva a la
// persona a su espacio: administración o docente.
// =====================================================================

(async function entrar() {
  const datos = new URLSearchParams(location.hash.slice(1));
  const pase = datos.get("th");
  const rol = datos.get("rol");

  // Borrar el pase de la barra de direcciones y del historial de inmediato
  history.replaceState(null, "", location.pathname);

  if (!pase) {
    return fallar("Esta dirección no tiene un pase de entrada.");
  }

  // Canjear el pase por una sesión
  let resultado = await nexusDb.auth.verifyOtp({ token_hash: pase, type: "email" });
  if (resultado.error) {
    resultado = await nexusDb.auth.verifyOtp({ token_hash: pase, type: "magiclink" });
  }
  if (resultado.error || !resultado.data || !resultado.data.session) {
    console.error(resultado.error);
    return fallar("El pase de entrada venció o ya fue usado.");
  }

  document.getElementById("titulo").textContent = "¡Listo!";
  document.getElementById("detalle").textContent = "Llevándote a tu espacio…";
  // Docentes: panel de sus programas (admin.html se adapta al papel)
  location.replace(rol === "docente" ? "admin.html" : "empresas.html");
})();

function fallar(texto) {
  document.getElementById("titulo").textContent = "No pudimos abrir tu sesión";
  document.getElementById("detalle").hidden = true;
  const m = document.getElementById("mensaje");
  m.textContent = texto;
  m.hidden = false;
  document.getElementById("ayuda").hidden = false;
}
