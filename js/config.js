// =====================================================================
// NEXUS LEARNING · CONFIGURACIÓN Y CONEXIÓN A SUPABASE
// Carpeta: js/config.js
//
// Estos dos datos son PÚBLICOS por diseño: la seguridad real la dan las
// reglas (RLS) y funciones configuradas en Supabase.
// ⚠️ NUNCA pongas aquí la "secret key" ni la "service_role key".
// =====================================================================

const NEXUS_CONFIG = {
  supabaseUrl: "https://yfmefiytswvxsqmnmrvg.supabase.co",
  supabaseKey: "sb_publishable_F3cIyhfFGoPurU4D0sNVWQ_jLugMPCO",
  nombrePlataforma: "Nexus Learning",
  empresa: "VitalWork S.A.S.",
  // Los administradores pueden ingresar con su cédula. Por dentro, su
  // cuenta en Supabase es "CEDULA@" + este dominio (no recibe correos).
  dominioCedula: "nexuslearning.local"
};

// Convierte lo que escribe la persona (cédula o correo) en el correo de la cuenta
function nexusCorreoDeUsuario(texto) {
  const t = String(texto || "").trim().toLowerCase();
  if (t.includes("@")) return t;
  const cedula = t.replace(/\D/g, "");
  return cedula ? cedula + "@" + NEXUS_CONFIG.dominioCedula : "";
}

// Lo que se muestra en pantalla: la cédula si la cuenta es por cédula
function nexusUsuarioVisible(correo) {
  const sufijo = "@" + NEXUS_CONFIG.dominioCedula;
  return correo && correo.endsWith(sufijo) ? "Cédula " + correo.slice(0, -sufijo.length) : correo;
}

// Crea la conexión que usarán todas las páginas.
// Requiere que el HTML cargue antes la librería de Supabase.
if (!window.supabase) {
  console.error("Nexus Learning: falta cargar la librería de Supabase antes de config.js");
}
const nexusDb = window.supabase.createClient(NEXUS_CONFIG.supabaseUrl, NEXUS_CONFIG.supabaseKey);
