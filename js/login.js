// =====================================================================
// NEXUS LEARNING · INICIO DE SESIÓN
// Carpeta: js/login.js
// =====================================================================

const mensajeLogin = document.getElementById("mensaje");

function mostrarMensaje(texto, tipo) {
  mensajeLogin.textContent = texto;
  mensajeLogin.className = "aviso " + (tipo || "error");
  mensajeLogin.hidden = false;
}

// Si llega desde "Iniciar sesión > Docente" en la página de inicio
if (new URLSearchParams(location.search).get("papel") === "docente") {
  document.title = "Ingreso de docentes · Nexus Learning";
  document.getElementById("login-titulo").textContent = "Ingreso de docentes";
  document.getElementById("login-intro").textContent = "Entra con tu cédula y la contraseña que te dio el administrador. Si trabajas en NEXUS, entra desde allí sin otra contraseña.";
}

// Mensaje si viene de una página protegida sin permiso
if (new URLSearchParams(location.search).get("motivo") === "sin-permiso") {
  mostrarMensaje("Tu cuenta no tiene permiso de administrador ni de docente vigente. Pide acceso al administrador de la plataforma.");
}

// Si ya hay una sesión activa, ir directo al panel
nexusDb.auth.getSession().then(function (r) {
  if (r.data && r.data.session && !location.search.includes("sin-permiso")) {
    location.replace("admin.html");
  }
});

document.getElementById("form-login").addEventListener("submit", async function (ev) {
  ev.preventDefault();
  mensajeLogin.hidden = true;

  const correo = nexusCorreoDeUsuario(document.getElementById("correo").value);
  const clave = document.getElementById("clave").value;

  if (!correo || !clave) {
    mostrarMensaje("Escribe tu cédula (o correo) y tu contraseña.");
    return;
  }

  const boton = document.getElementById("btn-ingresar");
  boton.disabled = true;
  boton.textContent = "Ingresando…";

  const { error } = await nexusDb.auth.signInWithPassword({ email: correo, password: clave });

  boton.disabled = false;
  boton.textContent = "Ingresar";

  if (error) {
    console.error(error);
    mostrarMensaje(
      error.status === 429
        ? "Demasiados intentos. Espera unos minutos y vuelve a intentarlo."
        : "Cédula, correo o contraseña incorrectos."
    );
    return;
  }

  location.replace("admin.html");
});
