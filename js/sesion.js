// =====================================================================
// NEXUS ACADEMY · CONTROL DE SESIÓN (páginas de administración)
// Carpeta: js/sesion.js
//
// exigirAdministrador(): solo administradores (empresas).
// exigirPersonal(): administradores o docentes (cursos y contenido).
// Si no corresponde, envía a login.html.
//
// Nota: esto es solo para la navegación. La protección real de los datos
// la hacen las reglas RLS de Supabase: aunque alguien saltara esta
// revisión, la base de datos no le dejaría ver ni modificar nada.
// =====================================================================

async function exigirAdministrador() {
  const { data } = await nexusDb.auth.getSession();
  const sesion = data && data.session;

  if (!sesion) {
    location.replace("login.html");
    return null;
  }

  const { data: admin, error } = await nexusDb
    .from("cap_administradores")
    .select("user_id")
    .eq("user_id", sesion.user.id)
    .maybeSingle();

  if (error || !admin) {
    await nexusDb.auth.signOut();
    location.replace("login.html?motivo=sin-permiso");
    return null;
  }

  return sesion.user;
}

// Para páginas que usan administradores Y docentes (admin.html).
// Devuelve { usuario, papel: "admin" | "docente" } o null.
async function exigirPersonal() {
  const { data } = await nexusDb.auth.getSession();
  const sesion = data && data.session;
  if (!sesion) {
    location.replace("login.html");
    return null;
  }

  const { data: papel, error } = await nexusDb.rpc("cap_mi_papel");
  if (error || (papel !== "admin" && papel !== "docente")) {
    if (error) console.error(error);
    await nexusDb.auth.signOut();
    location.replace("login.html?motivo=sin-permiso");
    return null;
  }
  return { usuario: sesion.user, papel: papel };
}

// ---------------------------------------------------------------------
// Nombre y papel de quien inició sesión, en la barra superior.
// El nombre sale de: 1) la cuenta (el puente con NEXUS lo guarda al
// crearla), 2) la lista de docentes o de administradores por cédula.
// Si no hay nombre, se muestra la cédula o el correo.
// ---------------------------------------------------------------------
async function mostrarUsuario(usuario, papel) {
  const caja = document.getElementById("usuario-correo");
  if (!caja) return;
  const sufijo = "@" + NEXUS_CONFIG.dominioCedula;
  const cedula = usuario.email && usuario.email.endsWith(sufijo) ? usuario.email.slice(0, -sufijo.length) : "";

  let nombre = (usuario.user_metadata && usuario.user_metadata.nombres) || "";
  if (!nombre) {
    const r = papel === "docente"
      ? await nexusDb.from("cap_docentes").select("nombres").eq("user_id", usuario.id).maybeSingle()
      : cedula ? await nexusDb.from("cap_admin_cedulas").select("nombres").eq("cedula", cedula).maybeSingle() : { data: null };
    nombre = (r.data && r.data.nombres) || "";
  }
  nombre = nombreBonito(nombre);

  const etiqueta = papel === "docente" ? "Docente" : "Administrador";
  caja.innerHTML = "";
  caja.title = (nombre || nexusUsuarioVisible(usuario.email)) + " · " + etiqueta + (cedula ? " · Cédula " + cedula : "");
  const quien = document.createElement("strong");
  quien.className = "usuario-nombre";
  quien.textContent = nombre ? nombreCorto(nombre) : nexusUsuarioVisible(usuario.email);
  const papelTexto = document.createElement("span");
  papelTexto.className = "usuario-papel";
  papelTexto.textContent = etiqueta;
  caja.append(quien, papelTexto);
}

// "JORGE LEONARDO ARIAS ESPINOZA" → "Jorge Leonardo Arias Espinoza"
function nombreBonito(texto) {
  return String(texto || "").trim().toLowerCase().replace(/(^|\s)(\S)/g, function (m, e, l) { return e + l.toUpperCase(); });
}
// Nombre corto para la barra: primer nombre y primer apellido
// (con cuatro palabras: 1.ª y 3.ª; con menos, completo)
function nombreCorto(nombre) {
  const p = nombre.split(/\s+/);
  return p.length >= 4 ? p[0] + " " + p[2] : nombre;
}

// Al cerrar sesión se vuelve a la página de inicio pública
async function cerrarSesion() {
  await nexusDb.auth.signOut();
  location.replace("index.html");
}
