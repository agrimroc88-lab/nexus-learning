// =====================================================================
// NEXUS ACADEMY · INICIO DE SESIÓN
// Carpeta: js/login.js
// =====================================================================

const mensajeLogin = document.getElementById("mensaje");

function mostrarMensaje(texto, tipo) {
  mensajeLogin.textContent = texto;
  mensajeLogin.className = "aviso " + (tipo || "error");
  mensajeLogin.hidden = false;
}

// Título según desde dónde llega (ventana "Iniciar sesión" de la página de inicio)
const papelLogin = new URLSearchParams(location.search).get("papel");
if (papelLogin === "admin") {
  document.title = "Ingreso de administradores · Nexus Academy";
  document.getElementById("login-titulo").textContent = "Ingreso de administradores";
  document.getElementById("login-intro").textContent = "Entra con tu cédula y tu contraseña de NEXUS. También puedes usar el correo de una cuenta de Nexus Academy.";
}
if (papelLogin === "docente") {
  document.title = "Ingreso de docentes · Nexus Academy";
  document.getElementById("login-titulo").textContent = "Ingreso de docentes";
  document.getElementById("login-intro").textContent = "Entra con tu cédula y la contraseña que te dio el administrador. Si trabajas en NEXUS, usa tu cédula y tu contraseña de NEXUS.";
}

// Mensaje si viene de una página protegida sin permiso
if (new URLSearchParams(location.search).get("motivo") === "sin-permiso") {
  mostrarMensaje("Tu cuenta no tiene permiso de administrador ni de docente vigente. Pide acceso al administrador de la plataforma.");
}

// Si ya hay una sesión activa, ir directo al panel
nexusDb.auth.getSession().then(function (r) {
  if (r.data && r.data.session && !location.search.includes("sin-permiso")) {
    location.replace("aula.html");
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

  // 1. Cuenta propia de Nexus Academy (correo, o cédula con contraseña creada aquí)
  const { error } = await nexusDb.auth.signInWithPassword({ email: correo, password: clave });
  if (!error) return location.replace("aula.html");

  if (error.status === 429) {
    terminar(boton);
    return mostrarMensaje("Demasiados intentos. Espera unos minutos y vuelve a intentarlo.");
  }

  // 2. Si escribió una cédula: probar con su usuario de NEXUS
  const cedula = document.getElementById("correo").value.replace(/\D/g, "");
  if (/^[0-9]{10}$/.test(cedula) && !document.getElementById("correo").value.includes("@")) {
    const r = await entrarConNexus(cedula, clave);
    if (r.ok) return location.replace("aula.html");
    terminar(boton);
    return mostrarMensaje(r.mensaje);
  }

  console.error(error);
  terminar(boton);
  mostrarMensaje("Cédula, correo o contraseña incorrectos.");
});

function terminar(boton) {
  boton.disabled = false;
  boton.textContent = "Ingresar";
}

// ---------------------------------------------------------------------
// Ingreso con el usuario de NEXUS
//  a) NEXUS valida cédula y contraseña (su propia función iniciar_sesion,
//     con su bloqueo por intentos fallidos) y entrega un pase de sesión.
//  b) El puente de Nexus Academy recibe ese pase, revisa el papel de la
//     persona (administrador o docente) y entrega un pase de un solo uso.
//  c) El pase de NEXUS se anula enseguida: no queda una sesión abierta allá.
// La contraseña nunca se guarda en Nexus Academy.
// ---------------------------------------------------------------------
async function entrarConNexus(cedula, clave) {
  const base = NEXUS_CONFIG.nexusSupabaseUrl + "/rest/v1/rpc/";
  const cabeceras = {
    "apikey": NEXUS_CONFIG.nexusSupabaseKey,
    "Authorization": "Bearer " + NEXUS_CONFIG.nexusSupabaseKey,
    "Content-Type": "application/json"
  };

  let nexus;
  try {
    const r = await fetch(base + "iniciar_sesion", {
      method: "POST", headers: cabeceras,
      body: JSON.stringify({ p_cedula: cedula, p_clave: clave })
    });
    nexus = await r.json();
  } catch (e) {
    console.error(e);
    return { ok: false, mensaje: "No fue posible conectar con NEXUS. Revisa tu conexión a internet." };
  }
  if (!nexus || !nexus.ok || !nexus.token) {
    return { ok: false, mensaje: (nexus && nexus.mensaje) || "Cédula o contraseña incorrectas." };
  }

  let pase = null;
  try {
    const r = await fetch(NEXUS_CONFIG.supabaseUrl + "/functions/v1/puente-nexus", {
      method: "POST",
      headers: { "apikey": NEXUS_CONFIG.supabaseKey, "Content-Type": "application/json", "x-sesion-nexus": nexus.token },
      body: JSON.stringify({ accion: "entrar" })
    });
    pase = await r.json().catch(function () { return {}; });
    if (!r.ok) pase = { error: pase.error || "No fue posible entrar a Nexus Academy." };
  } catch (e) {
    console.error(e);
    pase = { error: "No fue posible conectar con Nexus Academy. Revisa tu conexión a internet." };
  } finally {
    // Anular el pase de NEXUS (no se necesita más)
    fetch(base + "cerrar_sesion_app", {
      method: "POST", headers: Object.assign({ "x-sesion": nexus.token }, cabeceras), body: "{}"
    }).catch(function () { /* si falla, vence solo en 12 horas */ });
  }
  if (pase.error || !pase.token_hash) return { ok: false, mensaje: pase.error || "No fue posible entrar a Nexus Academy." };

  let v = await nexusDb.auth.verifyOtp({ token_hash: pase.token_hash, type: "email" });
  if (v.error) v = await nexusDb.auth.verifyOtp({ token_hash: pase.token_hash, type: "magiclink" });
  if (v.error || !v.data || !v.data.session) {
    console.error(v.error);
    return { ok: false, mensaje: "No se pudo abrir la sesión. Inténtalo de nuevo." };
  }
  return { ok: true };
}
