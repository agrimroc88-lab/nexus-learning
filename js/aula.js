// =====================================================================
// NEXUS ACADEMY · CURSOS Y SALÓN DE CLASES (administradores y docentes)
// Carpeta: js/aula.js
//
// aula.html          → los cursos en tarjetas con su portada.
// aula.html?c=<id>   → Salón de clases de ese curso: todo el material
//                      en orden (video, PDF, enlaces, lecciones, juegos)
//                      para proyectar o compartir pantalla, y al final
//                      el QR y la clave de asistencia vigente.
// "Planificación y diseño del curso" lleva al editor (admin.html?curso=).
// Todo el texto de la base se pinta con textContent.
// =====================================================================

const $a = (id) => document.getElementById(id);
const au = { papel: null, cursos: [], curso: null, pasos: [], i: 0, claves: [] };

(async function iniciar() {
  const acceso = await exigirPersonal();
  if (!acceso) return;
  au.papel = acceso.papel;
  if (au.papel === "docente") {
    document.body.classList.add("modo-docente");
    $a("marca-texto").textContent = "Mis programas";
    $a("nav-cursos").textContent = "Mis programas";
    $a("aula-titulo").textContent = "Mis programas";
  }
  mostrarUsuario(acceso.usuario, acceso.papel);
  $a("cargando").hidden = true;

  const id = new URLSearchParams(location.search).get("c");
  if (id) await abrirSalon(id);
  else await listarCursos();
})();

$a("btn-salir").addEventListener("click", cerrarSesion);

function avisar(texto, tipo) {
  const a = $a("aviso");
  a.textContent = texto;
  a.className = "aviso " + (tipo || "ok");
  a.hidden = false;
}

function crear(etiqueta, clase, texto) {
  const e = document.createElement(etiqueta);
  if (clase) e.className = clase;
  if (texto !== undefined && texto !== null) e.textContent = texto;
  return e;
}

function urlPublica(espacio, ruta) {
  return nexusDb.storage.from(espacio).getPublicUrl(ruta).data.publicUrl;
}

// ---------------------------------------------------------------------
// 1. Lista de cursos (tarjetas con portada)
// ---------------------------------------------------------------------
async function listarCursos() {
  $a("panel").hidden = false;
  const { data, error } = await nexusDb
    .from("cap_cursos")
    .select("id, titulo, descripcion, imagen, publicado, cap_lecciones(count)")
    .order("titulo");
  if (error) {
    console.error(error);
    return avisar("No se pudieron cargar los cursos. Detalle: " + (error.message || "error desconocido"), "error");
  }
  au.cursos = data || [];
  pintarCursos();
}

$a("buscar-curso").addEventListener("input", pintarCursos);

function sinTildes(t) {
  return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function pintarCursos() {
  const q = sinTildes($a("buscar-curso").value.trim());
  const ul = $a("cursos-aula");
  ul.innerHTML = "";
  const lista = au.cursos.filter(function (c) { return !q || sinTildes(c.titulo).includes(q); });
  if (!lista.length) {
    ul.appendChild(crear("li", "vacio-lista", au.cursos.length
      ? "Ningún curso coincide con la búsqueda."
      : (au.papel === "docente" ? "Aún no tienes programas asignados." : "Aún no hay cursos. Créalos en Planificación y diseño.")));
    return;
  }
  lista.forEach(function (c) {
    const li = document.createElement("li");
    const a = crear("a", "tarjeta-aula");
    a.href = "aula.html?c=" + encodeURIComponent(c.id);
    const portada = crear("span", "tarjeta-aula-portada");
    if (c.imagen) portada.style.backgroundImage = "url(\"" + urlPublica("portadas", c.imagen) + "\")";
    else portada.appendChild(crear("span", "tarjeta-aula-inicial", (c.titulo || "?").trim().charAt(0)));
    const n = c.cap_lecciones && c.cap_lecciones[0] ? c.cap_lecciones[0].count : 0;
    const cuerpo = crear("span", "tarjeta-aula-cuerpo");
    cuerpo.append(crear("strong", "", c.titulo),
      crear("small", "", (n === 1 ? "1 lección" : n + " lecciones") + (c.publicado ? "" : " · Inactivo")));
    const entrar = crear("span", "tarjeta-aula-entrar", "Entrar al salón →");
    a.append(portada, cuerpo, entrar);
    li.appendChild(a);
    ul.appendChild(li);
  });
}

// ---------------------------------------------------------------------
// 2. Salón de clases
// ---------------------------------------------------------------------
async function abrirSalon(id) {
  document.body.classList.add("con-escenario");
  $a("salon").hidden = false;
  $a("salon-contenido").textContent = "Cargando el material del curso…";

  // Curso (los campos nuevos pueden no existir si falta un SQL)
  let rc = await nexusDb.from("cap_cursos")
    .select("id, titulo, descripcion, subtemas, imagen, horas, video_url, archivo_pdf, enlaces").eq("id", id).maybeSingle();
  if (rc.error && /enlaces/i.test(rc.error.message || "")) {
    rc = await nexusDb.from("cap_cursos").select("id, titulo, descripcion, subtemas, imagen, horas, video_url, archivo_pdf").eq("id", id).maybeSingle();
  }
  if (rc.error && /video_url|archivo_pdf/i.test(rc.error.message || "")) {
    rc = await nexusDb.from("cap_cursos").select("id, titulo, descripcion, subtemas, imagen, horas").eq("id", id).maybeSingle();
  }
  if (rc.error || !rc.data) {
    if (rc.error) console.error(rc.error);
    $a("salon-contenido").textContent = "No se encontró el curso o no tienes acceso a él.";
    return;
  }
  au.curso = rc.data;
  document.title = au.curso.titulo + " · Salón de clases";
  $a("salon-curso").textContent = au.curso.titulo;

  const [rl, rk] = await Promise.all([
    nexusDb.from("cap_lecciones").select("orden, titulo, contenido, video_url, archivo_pdf, juego_id").eq("curso_id", id).order("orden"),
    nexusDb.rpc("cap_salon_claves", { p_curso: id })
  ]);
  const lecciones = rl.data || [];
  au.claves = rk.error ? null : (rk.data || []);   // null = no se pudo consultar (falta el SQL 30)

  const ids = lecciones.map(function (l) { return l.juego_id; }).filter(Boolean);
  let juegos = {};
  if (ids.length) {
    const rj = await nexusDb.from("cap_juegos").select("id, tipo, titulo, config").in("id", ids);
    (rj.data || []).forEach(function (j) { juegos[j.id] = j; });
  }

  au.pasos = armarPasos(au.curso, lecciones, juegos);
  pintarRecorrido();
  const desdeEnlace = parseInt((location.hash.match(/^#paso-(\d+)$/) || [])[1], 10);
  irA(desdeEnlace >= 1 && desdeEnlace <= au.pasos.length ? desdeEnlace - 1 : 0);
}

function esYoutube(url) { return Boolean(idYoutube(url)); }

function idYoutube(url) {
  if (!url) return null;
  const m = String(url).match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

// El orden de la clase: inicio → material del curso → cada lección (texto,
// video, PDF, juego) → cierre con QR de asistencia.
function armarPasos(curso, lecciones, juegos) {
  const p = [{ tipo: "inicio", etiqueta: "Inicio", titulo: "Bienvenida" }];
  if (curso.video_url) p.push({ tipo: "video", etiqueta: "Video", titulo: "Video del curso", url: curso.video_url });
  if (curso.archivo_pdf) p.push({ tipo: "pdf", etiqueta: "PDF", titulo: "Material del curso", ruta: curso.archivo_pdf });
  (Array.isArray(curso.enlaces) ? curso.enlaces : []).forEach(function (e, k) {
    if (!e || !e.url) return;
    p.push({ tipo: esYoutube(e.url) ? "video" : "enlace", etiqueta: esYoutube(e.url) ? "Video" : "Enlace",
      titulo: e.titulo || "Enlace adicional " + (k + 1), url: e.url });
  });
  lecciones.forEach(function (l, n) {
    const nombre = l.titulo || "Lección " + (n + 1);
    if ((l.contenido || "").trim() || (!l.video_url && !l.archivo_pdf && !l.juego_id)) {
      p.push({ tipo: "leccion", etiqueta: "Lección " + (n + 1), titulo: nombre, leccion: l });
    }
    if (l.video_url) p.push({ tipo: "video", etiqueta: "Video", titulo: nombre, url: l.video_url });
    if (l.archivo_pdf) p.push({ tipo: "pdf", etiqueta: "PDF", titulo: nombre, ruta: l.archivo_pdf });
    if (l.juego_id && juegos[l.juego_id]) p.push({ tipo: "juego", etiqueta: "Juego", titulo: juegos[l.juego_id].titulo, juego: juegos[l.juego_id] });
  });
  p.push({ tipo: "cierre", etiqueta: "Cierre", titulo: "Asistencia y certificado" });
  return p;
}

function pintarRecorrido() {
  const ol = $a("lista-pasos");
  ol.innerHTML = "";
  au.pasos.forEach(function (paso, k) {
    const li = document.createElement("li");
    const b = crear("button", "paso-recorrido tipo-" + paso.tipo);
    b.type = "button";
    b.append(crear("span", "paso-etiqueta", paso.etiqueta), crear("span", "paso-titulo", paso.titulo));
    b.addEventListener("click", function () { irA(k); });
    li.appendChild(b);
    ol.appendChild(li);
  });
}

function irA(k) {
  au.i = Math.max(0, Math.min(au.pasos.length - 1, k));
  const paso = au.pasos[au.i];
  history.replaceState(null, "", location.pathname + location.search + "#paso-" + (au.i + 1));
  $a("lista-pasos").querySelectorAll(".paso-recorrido").forEach(function (b, n) {
    b.classList.toggle("activo", n === au.i);
    b.classList.toggle("visto", n < au.i);
    if (n === au.i) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
  });
  const activo = $a("lista-pasos").children[au.i];
  if (activo) activo.scrollIntoView({ block: "nearest" });
  $a("salon-paso").textContent = (au.i + 1) + " de " + au.pasos.length + " · " + paso.titulo;
  $a("btn-anterior").disabled = au.i === 0;
  $a("btn-siguiente").disabled = au.i === au.pasos.length - 1;
  pintarPaso(paso);
}

function pintarPaso(paso) {
  pdfActivo = null;
  const caja = $a("salon-contenido");
  caja.innerHTML = "";
  caja.className = "salon-contenido escena-" + paso.tipo;
  caja.scrollTop = 0;
  if (paso.tipo === "inicio") return escenaInicio(caja);
  if (paso.tipo === "video") return escenaVideo(caja, paso);
  if (paso.tipo === "pdf") return escenaPdf(caja, paso);
  if (paso.tipo === "enlace") return escenaEnlace(caja, paso);
  if (paso.tipo === "leccion") return escenaLeccion(caja, paso);
  if (paso.tipo === "juego") return escenaJuego(caja, paso);
  if (paso.tipo === "cierre") return escenaCierre(caja);
}

function escenaInicio(caja) {
  const c = au.curso;
  const portada = crear("div", "inicio-portada");
  if (c.imagen) portada.style.backgroundImage = "url(\"" + urlPublica("portadas", c.imagen) + "\")";
  const textos = crear("div", "inicio-textos");
  textos.append(crear("p", "inicio-eyebrow", "Nexus Academy · Capacitación"), crear("h2", "inicio-titulo", c.titulo));
  if (c.descripcion) textos.appendChild(crear("p", "inicio-descripcion", c.descripcion));
  const temas = (c.subtemas || []).filter(Boolean);
  if (temas.length) {
    textos.appendChild(crear("h3", "inicio-subtitulo", "Lo que veremos hoy"));
    const ul = crear("ul", "inicio-temas");
    temas.forEach(function (t) { ul.appendChild(crear("li", "", t)); });
    textos.appendChild(ul);
  }
  const resumen = au.pasos.reduce(function (r, p) { r[p.tipo] = (r[p.tipo] || 0) + 1; return r; }, {});
  const partes = [];
  if (resumen.video) partes.push(resumen.video + (resumen.video === 1 ? " video" : " videos"));
  if (resumen.pdf) partes.push(resumen.pdf + " PDF");
  if (resumen.leccion) partes.push(resumen.leccion + (resumen.leccion === 1 ? " lección" : " lecciones"));
  if (resumen.juego) partes.push(resumen.juego + (resumen.juego === 1 ? " juego" : " juegos"));
  if (partes.length) textos.appendChild(crear("p", "inicio-resumen", "Material de esta clase: " + partes.join(" · ")));
  caja.append(portada, textos);
}

function escenaVideo(caja, paso) {
  const id = idYoutube(paso.url);
  caja.appendChild(crear("h2", "escena-titulo", paso.titulo));
  if (!id) return escenaEnlace(caja, paso, true);
  const marco = crear("div", "video-marco");
  const iframe = document.createElement("iframe");
  iframe.src = "https://www.youtube-nocookie.com/embed/" + id + "?rel=0";
  iframe.title = "Video: " + paso.titulo;
  iframe.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen";
  iframe.allowFullscreen = true;
  marco.appendChild(iframe);
  const abrir = crear("a", "enlace-escena", "Abrir en YouTube");
  abrir.href = "https://www.youtube.com/watch?v=" + id;
  abrir.target = "_blank";
  abrir.rel = "noopener";
  caja.append(marco, abrir);
}

// ---------------------------------------------------------------------
// Diapositivas en PDF: visor propio (PDF.js) con Modo presentación.
// En el Salón: la diapositiva grande con Anterior/Siguiente.
// Modo presentación: pantalla completa en negro, sin barras; se avanza
// con → ↓ Espacio Enter PageDown o clic (también con presentadores
// inalámbricos), se retrocede con ← ↑ PageUp; Esc o el final la cierran.
// ---------------------------------------------------------------------
const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
let pdfActivo = null;   // { doc, pagina, total, dibujar, irPagina }

function cargarPdfJs() {
  if (window.pdfjsLib) return Promise.resolve();
  return new Promise(function (ok, falla) {
    const s = document.createElement("script");
    s.src = PDFJS + "pdf.min.js";
    s.onload = function () { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js"; ok(); };
    s.onerror = function () { s.remove(); falla(new Error("pdfjs")); };
    document.head.appendChild(s);
  });
}

function escenaPdf(caja, paso) {
  const url = urlPublica("diapositivas", paso.ruta);
  const cab = crear("div", "escena-cabecera");
  const herramientas = crear("div", "pdf-herramientas");
  const presentar = crear("button", "boton boton-chico pdf-presentar", "▶ Modo presentación");
  presentar.type = "button";
  presentar.title = "Pantalla completa, diapositiva por diapositiva (tecla P)";
  const abrir = crear("a", "enlace-escena pdf-abrir", "Abrir PDF");
  abrir.href = url;
  abrir.target = "_blank";
  abrir.rel = "noopener";
  herramientas.append(presentar, abrir);
  cab.append(crear("h2", "escena-titulo", paso.titulo), herramientas);

  const lienzoCaja = crear("div", "pdf-lienzo-caja");
  const lienzo = document.createElement("canvas");
  lienzo.className = "pdf-lienzo";
  lienzoCaja.appendChild(lienzo);
  const estado = crear("p", "pdf-estado", "Cargando diapositivas…");
  lienzoCaja.appendChild(estado);

  const barra = crear("div", "pdf-barra");
  const ant = crear("button", "boton secundario boton-chico", "◀");
  ant.type = "button"; ant.setAttribute("aria-label", "Diapositiva anterior");
  const sig = crear("button", "boton secundario boton-chico", "▶");
  sig.type = "button"; sig.setAttribute("aria-label", "Diapositiva siguiente");
  const contador = crear("span", "pdf-contador", "");
  barra.append(ant, contador, sig);
  caja.append(cab, lienzoCaja, barra);

  const visor = { doc: null, pagina: 1, total: 0, lienzo: lienzo, caja: lienzoCaja, tarea: null };
  pdfActivo = visor;

  visor.dibujar = async function (destino, contenedor) {
    if (!visor.doc) return;
    const pag = await visor.doc.getPage(visor.pagina);
    const base = pag.getViewport({ scale: 1 });
    const ancho = contenedor.clientWidth || 800, alto = contenedor.clientHeight || 450;
    const escala = Math.min(ancho / base.width, alto / base.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vista = pag.getViewport({ scale: escala * dpr });
    destino.width = Math.floor(vista.width);
    destino.height = Math.floor(vista.height);
    destino.style.width = Math.floor(vista.width / dpr) + "px";
    destino.style.height = Math.floor(vista.height / dpr) + "px";
    if (destino._tarea) { try { destino._tarea.cancel(); } catch (e) { /* nada */ } }
    destino._tarea = pag.render({ canvasContext: destino.getContext("2d"), viewport: vista });
    try { await destino._tarea.promise; } catch (e) { /* render cancelado */ }
  };
  visor.irPagina = function (n) {
    if (!visor.doc) return;
    visor.pagina = Math.max(1, Math.min(visor.total, n));
    contador.textContent = "Diapositiva " + visor.pagina + " de " + visor.total;
    ant.disabled = visor.pagina === 1;
    sig.disabled = visor.pagina === visor.total;
    visor.dibujar(lienzo, lienzoCaja);
    if (visor.presentacion) visor.presentacion.mostrar();
  };

  ant.addEventListener("click", function () { visor.irPagina(visor.pagina - 1); });
  sig.addEventListener("click", function () { visor.irPagina(visor.pagina + 1); });
  lienzo.addEventListener("click", function () { visor.irPagina(visor.pagina + 1); });
  presentar.addEventListener("click", function () { abrirPresentacion(visor); });

  cargarPdfJs()
    .then(function () { return window.pdfjsLib.getDocument({ url: url }).promise; })
    .then(function (doc) {
      if (pdfActivo !== visor) return;
      visor.doc = doc;
      visor.total = doc.numPages;
      estado.remove();
      visor.irPagina(1);
    })
    .catch(function (e) {
      console.error(e);
      estado.textContent = "No se pudieron mostrar las diapositivas aquí. Usa \"Abrir PDF\".";
      presentar.disabled = true;
    });
}

// Pantalla completa en negro con una diapositiva a la vez
function abrirPresentacion(visor) {
  if (!visor.doc) return;
  const capa = crear("div", "presentacion-pdf");
  capa.tabIndex = -1;
  const lienzo = document.createElement("canvas");
  const fin = crear("div", "presentacion-fin");
  fin.append(crear("p", "", "Fin de la presentación"), crear("small", "", "Presiona Esc o haz clic para salir"));
  fin.hidden = true;
  const pista = crear("div", "presentacion-pista", "← → para avanzar · Esc para salir");
  capa.append(lienzo, fin, pista);
  document.body.appendChild(capa);
  setTimeout(function () { pista.classList.add("oculta"); }, 2500);

  let alFinal = false;
  const pres = {
    mostrar: function () {
      alFinal = false;
      fin.hidden = true;
      lienzo.hidden = false;
      visor.dibujar(lienzo, capa);
    },
    siguiente: function () {
      if (alFinal) return cerrar();
      if (visor.pagina < visor.total) visor.irPagina(visor.pagina + 1);
      else { alFinal = true; lienzo.hidden = true; fin.hidden = false; }
    },
    anterior: function () {
      if (alFinal) return pres.mostrar();
      visor.irPagina(visor.pagina - 1);
    }
  };
  visor.presentacion = pres;

  function tecla(ev) {
    const k = ev.key;
    if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter", "n", "N"].indexOf(k) >= 0) { ev.preventDefault(); ev.stopImmediatePropagation(); pres.siguiente(); }
    else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace", "p", "P"].indexOf(k) >= 0) { ev.preventDefault(); ev.stopImmediatePropagation(); pres.anterior(); }
    else if (k === "Home") { ev.preventDefault(); ev.stopImmediatePropagation(); visor.irPagina(1); }
    else if (k === "End") { ev.preventDefault(); ev.stopImmediatePropagation(); visor.irPagina(visor.total); }
    else if (k === "Escape") { ev.preventDefault(); ev.stopImmediatePropagation(); cerrar(); }
    else if (k === "f" || k === "F") { ev.stopImmediatePropagation(); }
  }
  function redimensionar() { if (!alFinal) visor.dibujar(lienzo, capa); }
  function alSalirPantalla() { if (!document.fullscreenElement) cerrar(); }
  let cerrada = false;
  function cerrar() {
    if (cerrada) return;
    cerrada = true;
    document.removeEventListener("keydown", tecla, true);
    window.removeEventListener("resize", redimensionar);
    document.removeEventListener("fullscreenchange", alSalirPantalla);
    visor.presentacion = null;
    if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
    capa.remove();
    visor.dibujar(visor.lienzo, visor.caja);
  }

  capa.addEventListener("click", function (ev) {
    if (alFinal) return cerrar();
    // Clic en el tercio izquierdo: atrás; en el resto: adelante
    if (ev.clientX < window.innerWidth / 3) pres.anterior(); else pres.siguiente();
  });
  document.addEventListener("keydown", tecla, true);
  window.addEventListener("resize", redimensionar);

  const pedir = capa.requestFullscreen || capa.webkitRequestFullscreen;
  const empezar = function () { capa.focus(); pres.mostrar(); };
  if (pedir) {
    Promise.resolve(pedir.call(capa)).then(function () {
      document.addEventListener("fullscreenchange", alSalirPantalla);
      empezar();
    }).catch(empezar);   // sin pantalla completa del sistema: igual ocupa toda la ventana
  } else empezar();
}

function escenaEnlace(caja, paso, sinTitulo) {
  if (!sinTitulo) caja.appendChild(crear("h2", "escena-titulo", paso.titulo));
  const tarjeta = crear("div", "enlace-tarjeta");
  const a = crear("a", "boton", "Abrir enlace");
  a.href = paso.url;
  a.target = "_blank";
  a.rel = "noopener";
  tarjeta.append(crear("p", "enlace-url", paso.url), a,
    crear("p", "ayuda", "Se abre en una pestaña nueva. Si compartes una sola pestaña en Zoom o Meet, cambia a esa pestaña para mostrarla."));
  caja.appendChild(tarjeta);
}

function escenaLeccion(caja, paso) {
  caja.appendChild(crear("p", "inicio-eyebrow", paso.etiqueta));
  caja.appendChild(crear("h2", "escena-titulo grande", paso.titulo));
  const cuerpo = crear("div", "leccion-proyectada");
  pintarTexto(cuerpo, paso.leccion.contenido || "");
  if (!cuerpo.children.length) cuerpo.appendChild(crear("p", "ayuda", "Esta lección no tiene texto. Agrégalo en Planificación y diseño del curso → Lecciones."));
  caja.appendChild(cuerpo);
}

// Párrafos y listas, igual que en la página del participante
function pintarTexto(contenedor, texto) {
  const esLista = function (l) { return /^([-•]|\d+[.)])\s+/.test(l); };
  const lista = function (lineas) {
    const ul = document.createElement(/^\d/.test(lineas[0]) ? "ol" : "ul");
    lineas.forEach(function (l) { ul.appendChild(crear("li", "", l.replace(/^([-•]|\d+[.)])\s+/, ""))); });
    return ul;
  };
  texto.split(/\n\s*\n/).forEach(function (bloque) {
    const lineas = bloque.split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
    if (!lineas.length) return;
    if (lineas.every(esLista)) contenedor.appendChild(lista(lineas));
    else if (lineas.length > 1 && lineas.slice(1).every(esLista)) contenedor.append(crear("p", "", lineas[0]), lista(lineas.slice(1)));
    else contenedor.appendChild(crear("p", "", lineas.join("\n")));
  });
}

function escenaJuego(caja, paso) {
  const zona = document.createElement("div");
  caja.appendChild(zona);
  NexusJuegos.montar(zona, paso.juego);
}

// Cierre: QR permanente del programa + claves vigentes hoy
async function escenaCierre(caja) {
  const enlace = location.origin + location.pathname.replace(/[^/]*$/, "") + "programa.html?p=" + encodeURIComponent(au.curso.id);
  const cont = crear("div", "cierre");
  const qrCaja = crear("div", "cierre-qr", "Generando QR…");
  const textos = crear("div", "cierre-textos");
  textos.append(crear("p", "inicio-eyebrow", "Registro de asistencia"),
    crear("h2", "escena-titulo grande", "Escanea el código QR"),
    crear("p", "cierre-paso", "1. Abre la cámara del celular y escanea el código."),
    crear("p", "cierre-paso", "2. Escribe la clave de la capacitación."),
    crear("p", "cierre-paso", "3. Completa tus datos" + (au.claves && au.claves.some(function (k) { return k.evaluacion; }) ? ", responde la evaluación" : "") + " y descarga tu certificado."));

  const claves = crear("div", "cierre-claves");
  if (au.claves === null) {
    claves.appendChild(crear("p", "ayuda", "Para ver aquí la clave de hoy, el administrador debe ejecutar el SQL 30 en Supabase."));
  } else if (!au.claves.length) {
    claves.appendChild(crear("p", "cierre-sin-clave", au.papel === "admin"
      ? "No hay claves vigentes ahora para este curso. Créala en Empresas → la capacitación → Nueva clave."
      : "No hay claves vigentes ahora para este curso. Pide la clave al administrador."));
  } else {
    au.claves.forEach(function (k) {
      const f = crear("div", "clave-vigente");
      f.append(crear("span", "clave-empresa", k.empresa + (k.tipo === "virtual" ? " · virtual" : "")),
        crear("strong", "clave-codigo", k.codigo),
        crear("small", "", "Vigente hasta " + new Date(k.valido_hasta).toLocaleString("es-EC", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })));
      claves.appendChild(f);
    });
  }
  textos.appendChild(claves);
  cont.append(qrCaja, textos);
  caja.appendChild(cont);

  try {
    await cargarQr();
    const qr = qrcode(0, "M");
    qr.addData(enlace);
    qr.make();
    qrCaja.innerHTML = qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
  } catch (e) {
    qrCaja.textContent = "";
    qrCaja.appendChild(crear("p", "ayuda", "No se pudo generar el QR. Comparte este enlace: " + enlace));
  }
}

function cargarQr() {
  if (typeof qrcode !== "undefined") return Promise.resolve();
  return new Promise(function (ok, falla) {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
    s.onload = ok;
    s.onerror = function () { s.remove(); falla(new Error("qr")); };
    document.head.appendChild(s);
  });
}

// ---------------------------------------------------------------------
// Controles del salón
// ---------------------------------------------------------------------
$a("btn-anterior").addEventListener("click", function () { irA(au.i - 1); });
$a("btn-siguiente").addEventListener("click", function () { irA(au.i + 1); });
$a("btn-qr").addEventListener("click", function () { irA(au.pasos.length - 1); });
$a("btn-planificar").addEventListener("click", function () {
  location.href = "admin.html?curso=" + encodeURIComponent(au.curso ? au.curso.id : "");
});
$a("btn-cerrar-salon").addEventListener("click", function () {
  if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
  location.href = "aula.html";
});
$a("btn-recorrido").addEventListener("click", function () {
  const oculto = $a("salon").classList.toggle("sin-recorrido");
  $a("btn-recorrido").setAttribute("aria-pressed", oculto ? "false" : "true");
});

function alternarPantalla() {
  const salon = $a("salon");
  if (document.fullscreenElement) return document.exitFullscreen().catch(function () {});
  const pedir = salon.requestFullscreen || salon.webkitRequestFullscreen;
  if (!pedir) return avisarSalon("Tu navegador no permite pantalla completa aquí. Usa la tecla F11.");
  Promise.resolve(pedir.call(salon)).catch(function () { avisarSalon("No se pudo activar la pantalla completa. Usa la tecla F11."); });
}
$a("btn-pantalla").addEventListener("click", alternarPantalla);
document.addEventListener("fullscreenchange", function () {
  const activa = Boolean(document.fullscreenElement);
  $a("btn-pantalla").textContent = activa ? "Salir de pantalla completa" : "⛶ Pantalla completa";
  $a("salon").classList.toggle("en-pantalla-completa", activa);
});

function avisarSalon(texto) {
  const p = crear("p", "aviso error salon-aviso", texto);
  $a("salon-contenido").prepend(p);
  setTimeout(function () { p.remove(); }, 6000);
}

// Teclado: flechas para avanzar (fuera de campos de texto) y F para pantalla completa
document.addEventListener("keydown", function (ev) {
  if ($a("salon").hidden) return;
  const t = ev.target;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
  const pdf = pdfActivo && pdfActivo.doc ? pdfActivo : null;
  if (ev.key === "ArrowRight" || ev.key === "PageDown") {
    ev.preventDefault();
    if (pdf && pdf.pagina < pdf.total) pdf.irPagina(pdf.pagina + 1); else irA(au.i + 1);
  } else if (ev.key === "ArrowLeft" || ev.key === "PageUp") {
    ev.preventDefault();
    if (pdf && pdf.pagina > 1) pdf.irPagina(pdf.pagina - 1); else irA(au.i - 1);
  } else if ((ev.key === "p" || ev.key === "P") && pdf) { ev.preventDefault(); abrirPresentacion(pdf); }
  else if ((ev.key === "f" || ev.key === "F") && !ev.ctrlKey && !ev.metaKey) { alternarPantalla(); }
});

// Al cambiar el tamaño (o entrar/salir de pantalla completa) se vuelve a dibujar la diapositiva
let esperaRedibujo = null;
function redibujarPdf() {
  clearTimeout(esperaRedibujo);
  esperaRedibujo = setTimeout(function () {
    if (pdfActivo && pdfActivo.doc && !pdfActivo.presentacion) pdfActivo.dibujar(pdfActivo.lienzo, pdfActivo.caja);
  }, 150);
}
window.addEventListener("resize", redibujarPdf);
document.addEventListener("fullscreenchange", redibujarPdf);
