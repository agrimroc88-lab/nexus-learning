// =====================================================================
// NEXUS LEARNING · CONTROL DE SESIÓN (páginas de administración)
// Carpeta: js/sesion.js
//
// Revisa que haya una sesión iniciada y que el usuario esté en la lista
// de administradores. Si no, lo envía a login.html.
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

async function cerrarSesion() {
  await nexusDb.auth.signOut();
  location.replace("login.html");
}
