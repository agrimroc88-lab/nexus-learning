// =====================================================================
// NEXUS LEARNING · ADMINISTRADORES QUE ENTRAN DESDE NEXUS
// Carpeta: js/administradores.js
//
// Edita la lista cap_admin_cedulas. El puente con NEXUS la consulta en
// cada ingreso: si la cédula está aquí y la persona es "admin" en NEXUS,
// entra como administrador. Las reglas RLS solo dejan editarla a un
// administrador.
// =====================================================================

const $a = (id) => document.getElementById(id);
let miCedula = "";

(async function iniciar() {
  const usuario = await exigirAdministrador();
  if (!usuario) return;
  $a("usuario-correo").textContent = nexusUsuarioVisible(usuario.email);
  const sufijo = "@" + NEXUS_CONFIG.dominioCedula;
  miCedula = usuario.email && usuario.email.endsWith(sufijo) ? usuario.email.slice(0, -sufijo.length) : "";
  $a("cargando").hidden = true;
  $a("panel").hidden = false;
  await cargar();
})();

$a("btn-salir").addEventListener("click", cerrarSesion);

function avisar(texto, tipo) {
  const a = $a("aviso");
  a.textContent = texto;
  a.className = "aviso " + (tipo || "ok");
  a.hidden = false;
  clearTimeout(avisar.t);
  avisar.t = setTimeout(function () { a.hidden = true; }, tipo === "error" ? 8000 : 3500);
}

async function cargar() {
  const { data, error } = await nexusDb.from("cap_admin_cedulas")
    .select("cedula, nombres, creado_en").order("nombres", { ascending: true });
  if (error) {
    console.error(error);
    return avisar("No se pudo cargar la lista. Detalle: " + (error.message || "error desconocido"), "error");
  }
  pintar(data || []);
}

function pintar(lista) {
  const ol = $a("lista-admins");
  ol.innerHTML = "";
  if (lista.length === 0) {
    const li = document.createElement("li");
    li.className = "vacio-lista";
    li.textContent = "Aún no hay administradores registrados por cédula.";
    ol.appendChild(li);
    return;
  }
  lista.forEach(function (a, i) {
    const li = document.createElement("li");
    li.className = "item";
    const num = document.createElement("span");
    num.className = "item-num";
    num.textContent = i + 1;
    const info = document.createElement("div");
    info.className = "item-info";
    const t = document.createElement("strong");
    t.textContent = a.nombres || "(sin nombre)";
    const s = document.createElement("small");
    s.textContent = "Cédula " + a.cedula + (a.cedula === miCedula ? " · eres tú" : "");
    info.append(t, s);
    const quitar = document.createElement("button");
    quitar.type = "button";
    quitar.className = "enlace-boton rojo";
    quitar.textContent = "Quitar";
    quitar.addEventListener("click", function () { quitarAdmin(a); });
    li.append(num, info, quitar);
    ol.appendChild(li);
  });
}

$a("form-admin").addEventListener("submit", async function (ev) {
  ev.preventDefault();
  const nombres = $a("a-nombres").value.trim().replace(/\s+/g, " ");
  const cedula = $a("a-cedula").value.replace(/\D/g, "");
  if (nombres.length < 5) return avisar("Escribe los nombres y apellidos.", "error");
  if (!/^[0-9]{10}$/.test(cedula)) return avisar("La cédula debe tener 10 dígitos.", "error");

  const boton = $a("btn-agregar");
  boton.disabled = true;
  const { error } = await nexusDb.from("cap_admin_cedulas").insert({ cedula: cedula, nombres: nombres });
  boton.disabled = false;
  if (error) {
    if (error.code === "23505") return avisar("Esa cédula ya está en la lista.", "error");
    console.error(error);
    return avisar("No se pudo agregar. Detalle: " + (error.message || "error desconocido"), "error");
  }
  $a("a-nombres").value = "";
  $a("a-cedula").value = "";
  avisar(nombres + " ya puede entrar desde NEXUS como administrador (si es admin en NEXUS).");
  await cargar();
});

async function quitarAdmin(a) {
  const propio = a.cedula === miCedula;
  const texto = propio
    ? "Vas a quitarte a ti mismo. La próxima vez que entres desde NEXUS ya no serás administrador. ¿Continuar?"
    : "¿Quitar a " + (a.nombres || a.cedula) + " de los administradores?";
  if (!confirm(texto)) return;
  const { error } = await nexusDb.from("cap_admin_cedulas").delete().eq("cedula", a.cedula);
  if (error) {
    console.error(error);
    return avisar("No se pudo quitar. Detalle: " + (error.message || "error desconocido"), "error");
  }
  avisar("Administrador quitado.");
  await cargar();
}
