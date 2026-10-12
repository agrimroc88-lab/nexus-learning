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
  empresa: "VitalWork S.A.S."
};

// Crea la conexión que usarán todas las páginas.
// Requiere que el HTML cargue antes la librería de Supabase.
if (!window.supabase) {
  console.error("Nexus Learning: falta cargar la librería de Supabase antes de config.js");
}
const nexusDb = window.supabase.createClient(NEXUS_CONFIG.supabaseUrl, NEXUS_CONFIG.supabaseKey);
