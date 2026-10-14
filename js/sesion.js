// =====================================================================
// NEXUS LEARNING · CONTROL DE SESIÓN (páginas de administración)
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

// Al cerrar sesión se vuelve a la página de inicio pública
async function cerrarSesion() {
  await nexusDb.auth.signOut();
  location.replace("index.html");
}
