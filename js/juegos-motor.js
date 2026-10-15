// =====================================================================
// NEXUS LEARNING · MOTOR DE JUEGOS
// Carpeta: js/juegos-motor.js
//
// NexusJuegos.montar(caja, juego) dibuja un juego dentro de "caja".
//   juego = { tipo, titulo, config }
// Tipos:
//   numeros    → Busca los números (5S): 3 rondas (desorden, clasificar,
//                ordenar) y comparación de tiempos.
//   clasificar → Tarjetas con dos opciones y explicación.
//   ordenar    → Tocar los pasos en el orden correcto.
// Lo usan charla.html (el docente lo proyecta en la charla) y juegos.html (vista previa).
// Todo el texto se pinta con textContent (nunca HTML de la base).
// =====================================================================

const NexusJuegos = (function () {
  const NOMBRES = {
    numeros: "Busca los números", clasificar: "Clasifica", ordenar: "Ordena los pasos",
    riesgos: "Caza de riesgos", escenarios: "¿Qué harías?"
  };

  // ---------- utilidades ----------
  function crear(etiqueta, clase, texto) {
    const e = document.createElement(etiqueta);
    if (clase) e.className = clase;
    if (texto !== undefined && texto !== null) e.textContent = texto;
    return e;
  }
  function boton(texto, clase, accion) {
    const b = crear("button", clase || "boton", texto);
    b.type = "button";
    if (accion) b.addEventListener("click", accion);
    return b;
  }
  function mezclar(lista) {
    const a = lista.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function segundos(ms) {
    return (ms / 1000).toLocaleString("es-EC", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " s";
  }

  function montar(caja, juego) {
    caja.innerHTML = "";
    caja.classList.add("juego");
    const cfg = juego.config || {};
    const cab = crear("div", "juego-cabecera");
    cab.append(crear("span", "juego-tipo", "Juego · " + (NOMBRES[juego.tipo] || "Práctica")), crear("h3", "juego-titulo", juego.titulo));
    if (cfg.instruccion) cab.appendChild(crear("p", "juego-instruccion", cfg.instruccion));
    const cuerpo = crear("div", "juego-cuerpo");
    caja.append(cab, cuerpo);

    if (juego.tipo === "numeros") return numeros(cuerpo, cfg);
    if (juego.tipo === "clasificar") return clasificar(cuerpo, cfg);
    if (juego.tipo === "ordenar") return ordenar(cuerpo, cfg);
    if (juego.tipo === "riesgos") return riesgos(cuerpo, cfg);
    if (juego.tipo === "escenarios") return escenarios(cuerpo, cfg);
    cuerpo.textContent = "Este tipo de juego no está disponible.";
  }

  // ===================================================================
  // 1. BUSCA LOS NÚMEROS (5S)
  // ===================================================================
  const RONDAS = [
    { titulo: "Ronda 1 · Desorden", texto: "Así se ve un área de trabajo sin orden: hay cosas que no sirven, mezcladas, de todos los tamaños." },
    { titulo: "Ronda 2 · Clasificar (Seiri)", texto: "Quitamos lo que no sirve: solo quedan los números que necesitas, pero aún sin lugar fijo." },
    { titulo: "Ronda 3 · Ordenar (Seiton)", texto: "Cada cosa en su lugar: los números están ordenados y es fácil encontrarlos." }
  ];

  function numeros(cuerpo, cfg) {
    const N = Math.min(60, Math.max(10, parseInt(cfg.cantidad, 10) || 30));
    const LIMITE = Math.min(300, Math.max(20, parseInt(cfg.segundos, 10) || 60)) * 1000;
    const resultados = [];
    let reloj = null;

    function presentar(r) {
      cuerpo.innerHTML = "";
      const intro = crear("div", "juego-intro");
      intro.append(crear("h4", "", RONDAS[r].titulo), crear("p", "", RONDAS[r].texto),
        crear("p", "juego-nota", "Toca los números del 1 al " + N + " en orden. Tienes " + (LIMITE / 1000) + " segundos."),
        boton("Empezar ronda " + (r + 1), "boton", function () { jugar(r); }));
      cuerpo.appendChild(intro);
    }

    function jugar(r) {
      cuerpo.innerHTML = "";
      const barra = crear("div", "juego-barra");
      const busca = crear("strong", "", "Busca el 1");
      const tiempo = crear("span", "juego-reloj", "0,0 s");
      barra.append(crear("span", "", RONDAS[r].titulo), busca, tiempo);
      const tablero = crear("div", "tablero-numeros" + (r === 2 ? " ordenado" : ""));
      cuerpo.append(barra, tablero);

      // Elementos: en la ronda 1 se agregan números que "sobran"
      let items = [];
      for (let i = 1; i <= N; i++) items.push(i);
      if (r === 0) for (let i = N + 1; i <= N + Math.round(N * 0.6); i++) items.push(i);

      // En pantallas angostas (celular) se usan menos columnas y más filas
      const angosto = tablero.clientWidth < 520;
      const cols = Math.ceil(Math.sqrt(items.length * (angosto ? 0.6 : 1.4)));
      const filas = Math.ceil(items.length / cols);
      tablero.style.aspectRatio = cols + " / " + (filas * 0.9);
      const MX = 5, MY = 4;   // margen (%) para que ningún número quede cortado en el borde
      const celdas = r === 2 ? items.map(function (_, i) { return i; }) : mezclar(Array.from({ length: cols * filas }, function (_, i) { return i; })).slice(0, items.length);

      let siguiente = 1;
      const inicio = performance.now();
      items.forEach(function (n, i) {
        const c = celdas[i];
        const fila = Math.floor(c / cols), col = c % cols;
        const b = crear("button", "num", String(n));
        b.type = "button";
        const jx = r === 2 ? 0 : (Math.random() - 0.5) * 0.45, jy = r === 2 ? 0 : (Math.random() - 0.5) * 0.45;
        b.style.left = (MX + (col + 0.5 + jx) / cols * (100 - 2 * MX)) + "%";
        b.style.top = (MY + (fila + 0.5 + jy) / filas * (100 - 2 * MY)) + "%";
        if (r === 0) {
          b.style.fontSize = (13 + Math.random() * (angosto ? 8 : 13)).toFixed(0) + "px";
          b.style.transform = "translate(-50%, -50%) rotate(" + Math.round((Math.random() - 0.5) * 70) + "deg)";
          if (Math.random() < 0.35) b.classList.add("tenue");
        } else if (r === 1) {
          b.style.fontSize = (15 + Math.random() * 6).toFixed(0) + "px";
        }
        b.addEventListener("click", function () {
          if (n !== siguiente) {
            b.classList.remove("error"); void b.offsetWidth; b.classList.add("error");
            return;
          }
          b.classList.add("hecho");
          b.disabled = true;
          siguiente++;
          if (siguiente > N) return terminar(true);
          busca.textContent = "Busca el " + siguiente;
        });
        tablero.appendChild(b);
      });

      reloj = setInterval(function () {
        const t = performance.now() - inicio;
        tiempo.textContent = segundos(Math.min(t, LIMITE));
        if (t >= LIMITE) terminar(false);
      }, 100);

      function terminar(completo) {
        clearInterval(reloj);
        resultados[r] = { completo: completo, tiempo: Math.min(performance.now() - inicio, LIMITE), encontrados: siguiente - 1 };
        if (r < 2) {
          cuerpo.innerHTML = "";
          const fin = crear("div", "juego-intro");
          fin.append(crear("h4", "", completo ? "¡Terminaste en " + segundos(resultados[r].tiempo) + "!" : "Se acabó el tiempo"),
            crear("p", "", completo ? "Ahora veamos qué pasa si ordenamos." : "Encontraste " + resultados[r].encontrados + " de " + N + " números."),
            boton("Siguiente ronda", "boton", function () { presentar(r + 1); }));
          cuerpo.appendChild(fin);
        } else {
          final();
        }
      }
    }

    function final() {
      cuerpo.innerHTML = "";
      const fin = crear("div", "juego-final");
      fin.appendChild(crear("h4", "", "Resultado: el orden ahorra tiempo"));
      const max = Math.max.apply(null, resultados.map(function (x) { return x.tiempo; }));
      const lista = crear("div", "comparacion");
      resultados.forEach(function (x, i) {
        const fila = crear("div", "comparacion-fila");
        const barra = crear("div", "comparacion-barra");
        const relleno = crear("span", "");
        relleno.style.width = Math.max(4, Math.round(x.tiempo * 100 / max)) + "%";
        barra.appendChild(relleno);
        fila.append(crear("span", "", ["Desorden", "Clasificado", "Ordenado"][i]), barra,
          crear("strong", "", x.completo ? segundos(x.tiempo) : x.encontrados + " de " + N));
        lista.appendChild(fila);
      });
      fin.appendChild(lista);
      const a = resultados[0], c = resultados[2];
      let mensaje = "Con orden, cada cosa se encuentra al primer vistazo. Eso buscan las 5S: menos tiempo perdido, menos errores y menos riesgos.";
      if (a.completo && c.completo && c.tiempo > 0) {
        mensaje = "Con orden encontraste los números " + (a.tiempo / c.tiempo).toLocaleString("es-EC", { maximumFractionDigits: 1 }) +
          " veces más rápido. " + mensaje;
      }
      fin.append(crear("p", "", mensaje), boton("Jugar de nuevo", "boton secundario", function () { resultados.length = 0; presentar(0); }));
      cuerpo.appendChild(fin);
    }

    presentar(0);
  }

  // ===================================================================
  // 2. CLASIFICA (dos opciones, por ejemplo acto o condición)
  // ===================================================================
  function clasificar(cuerpo, cfg) {
    const tarjetas = (cfg.tarjetas || []).filter(function (t) { return t && t.texto; });
    const op = { a: cfg.opcion_a || "Opción A", b: cfg.opcion_b || "Opción B" };
    if (tarjetas.length === 0) { cuerpo.textContent = "Este juego todavía no tiene tarjetas."; return; }
    let orden, i, aciertos;

    function empezar() { orden = mezclar(tarjetas); i = 0; aciertos = 0; mostrar(); }

    function mostrar() {
      cuerpo.innerHTML = "";
      const t = orden[i];
      const progreso = crear("p", "juego-progreso", "Tarjeta " + (i + 1) + " de " + orden.length + " · Aciertos: " + aciertos);
      const tarjeta = crear("div", "tarjeta-juego", t.texto);
      const botones = crear("div", "opciones-juego");
      const responder = function (eleccion) {
        const bien = eleccion === t.respuesta;
        if (bien) aciertos++;
        botones.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
        botones.querySelector('[data-op="' + t.respuesta + '"]').classList.add("correcta");
        if (!bien) botones.querySelector('[data-op="' + eleccion + '"]').classList.add("incorrecta");
        const fb = crear("div", "retro " + (bien ? "bien" : "mal"));
        fb.append(crear("strong", "", bien ? "¡Correcto!" : "No es así: es " + op[t.respuesta].toLowerCase() + "."));
        if (t.explicacion) fb.append(crear("p", "", t.explicacion));
        fb.append(boton(i < orden.length - 1 ? "Siguiente" : "Ver resultado", "boton boton-chico", function () {
          i++;
          if (i < orden.length) mostrar(); else final();
        }));
        cuerpo.appendChild(fb);
      };
      ["a", "b"].forEach(function (k) {
        const b = boton(op[k], "opcion-juego", function () { responder(k); });
        b.dataset.op = k;
        botones.appendChild(b);
      });
      cuerpo.append(progreso, tarjeta, botones);
    }

    function final() {
      cuerpo.innerHTML = "";
      const fin = crear("div", "juego-final");
      const pct = Math.round(aciertos * 100 / orden.length);
      fin.append(crear("h4", "", "Acertaste " + aciertos + " de " + orden.length + " (" + pct + " %)"),
        crear("p", "", pct === 100 ? "¡Excelente! Distingues muy bien cada caso." : pct >= 70 ? "¡Muy bien! Repasa las que fallaste." : "Vuelve a intentarlo: lee con calma la explicación de cada tarjeta."),
        boton("Jugar de nuevo", "boton secundario", empezar));
      cuerpo.appendChild(fin);
    }

    empezar();
  }

  // ===================================================================
  // 3. ORDENA LOS PASOS
  // ===================================================================
  function ordenar(cuerpo, cfg) {
    const pasos = (cfg.pasos || []).map(function (p) { return String(p).trim(); }).filter(Boolean);
    if (pasos.length < 2) { cuerpo.textContent = "Este juego todavía no tiene pasos."; return; }

    function empezar() {
      const elegidos = [];
      const disponibles = mezclar(pasos.map(function (p, i) { return { texto: p, i: i }; }));
      pintar();

      function pintar() {
        cuerpo.innerHTML = "";
        const tuOrden = crear("ol", "orden-elegido");
        elegidos.forEach(function (p) { tuOrden.appendChild(crear("li", "", p.texto)); });
        const pendientes = crear("div", "pasos-disponibles");
        disponibles.forEach(function (p, k) {
          pendientes.appendChild(boton(p.texto, "paso-juego", function () {
            elegidos.push(disponibles.splice(k, 1)[0]);
            if (disponibles.length === 0) revisar(); else pintar();
          }));
        });
        cuerpo.append(crear("p", "juego-progreso", elegidos.length < pasos.length ? "Toca el paso " + (elegidos.length + 1) + " de " + pasos.length : ""),
          tuOrden, pendientes);
        if (elegidos.length) {
          cuerpo.appendChild(boton("Deshacer el último", "enlace-simple", function () {
            disponibles.push(elegidos.pop());
            pintar();
          }));
        }
      }

      function revisar() {
        cuerpo.innerHTML = "";
        let bien = 0;
        const lista = crear("ol", "orden-elegido revisado");
        elegidos.forEach(function (p, k) {
          const ok = p.i === k;
          if (ok) bien++;
          const li = crear("li", ok ? "bien" : "mal", p.texto);
          if (!ok) li.appendChild(crear("small", "", "Va en el paso " + (p.i + 1)));
          lista.appendChild(li);
        });
        const fin = crear("div", "juego-final");
        fin.append(crear("h4", "", bien === pasos.length ? "¡Perfecto! Todos los pasos en orden." : bien + " de " + pasos.length + " pasos en su lugar"), lista);
        if (bien < pasos.length) {
          const correcto = crear("ol", "orden-correcto");
          pasos.forEach(function (p) { correcto.appendChild(crear("li", "", p)); });
          fin.append(crear("p", "juego-nota", "Orden correcto:"), correcto);
        }
        fin.appendChild(boton("Jugar de nuevo", "boton secundario", empezar));
        cuerpo.appendChild(fin);
      }
    }

    empezar();
  }

  // ===================================================================
  // 4. CAZA DE RIESGOS: tocar los peligros sobre una foto o ilustración
  //    peligros: [{ x, y, r, nombre, explicacion, clase }]
  //      x, y, r en % del ancho/alto · clase: "acto" | "condicion" (opcional)
  //    Si el peligro tiene clase, al encontrarlo se pregunta si es un
  //    ACTO o una CONDICIÓN subestándar (modo "Detective de riesgos").
  // ===================================================================
  const CLASES = { acto: "Acto subestándar", condicion: "Condición subestándar" };

  function urlImagen(ruta) {
    if (!ruta) return "";
    if (/^(https?:|blob:|data:)/.test(ruta)) return ruta;
    if (/^img\//.test(ruta)) return ruta;                 // imágenes que vienen con el sitio
    if (typeof nexusDb !== "undefined") return nexusDb.storage.from("portadas").getPublicUrl(ruta).data.publicUrl;
    return ruta;
  }

  function riesgos(cuerpo, cfg) {
    const peligros = (cfg.peligros || []).filter(function (p) { return p && isFinite(p.x) && isFinite(p.y); });
    if (!cfg.imagen || peligros.length === 0) { cuerpo.textContent = "Este juego todavía no tiene foto o peligros marcados."; return; }
    const clasifica = peligros.some(function (p) { return CLASES[p.clase]; });

    function empezar() {
      const hallados = new Map();    // índice → true (bien clasificado) | false (mal) | null (sin clase)
      let fallos = 0, terminado = false, preguntando = false;
      cuerpo.innerHTML = "";
      const progreso = crear("p", "juego-progreso");
      const foto = crear("div", "foto-riesgos");
      const img = crear("img");
      img.src = urlImagen(cfg.imagen);
      img.alt = "Imagen para buscar los peligros";
      img.draggable = false;
      // Que la imagen completa quepa en la pantalla (útil al proyectar)
      img.addEventListener("load", function () {
        if (img.naturalWidth && img.naturalHeight) {
          foto.style.maxWidth = "min(100%, calc((100vh - 140px) * " + (img.naturalWidth / img.naturalHeight).toFixed(3) + "))";
          foto.style.marginInline = "auto";
        }
      });
      foto.appendChild(img);
      const retro = crear("div", "retro-riesgo");
      retro.hidden = true;
      const rendirse = boton("Ver los que faltan", "enlace-simple", function () { if (!preguntando) revelar(); });
      cuerpo.append(progreso, foto, retro, rendirse);
      actualizar();

      function bienClasificados() {
        let n = 0;
        hallados.forEach(function (v) { if (v === true) n++; });
        return n;
      }

      function actualizar() {
        progreso.textContent = "Encontrados: " + hallados.size + " de " + peligros.length +
          (clasifica ? " · Bien clasificados: " + bienClasificados() : "") + " · Toques fallidos: " + fallos;
      }

      function marca(p, i, clase) {
        const m = crear("span", "marca-riesgo " + clase, String(i + 1));
        m.style.left = p.x + "%";
        m.style.top = p.y + "%";
        m.style.width = m.style.height = (2 * (p.r || 6)) + "cqw";
        foto.appendChild(m);
        return m;
      }

      foto.addEventListener("click", function (ev) {
        if (terminado || preguntando) return;
        const caja = img.getBoundingClientRect();
        const px = ev.clientX - caja.left, py = ev.clientY - caja.top;
        if (px < 0 || py < 0 || px > caja.width || py > caja.height) return;
        // El más cercano que aún no se encontró, si el toque cae dentro de su zona (con un poco de tolerancia)
        let mejor = -1, distMejor = Infinity;
        peligros.forEach(function (p, i) {
          if (hallados.has(i)) return;
          const d = Math.hypot(px - p.x / 100 * caja.width, py - p.y / 100 * caja.height);
          const radio = (p.r || 6) / 100 * caja.width * 1.15;
          if (d <= radio && d < distMejor) { mejor = i; distMejor = d; }
        });
        if (mejor === -1) {
          fallos++;
          const x = crear("span", "marca-fallo", "×");
          x.style.left = (px / caja.width * 100) + "%";
          x.style.top = (py / caja.height * 100) + "%";
          foto.appendChild(x);
          setTimeout(function () { x.remove(); }, 900);
          actualizar();
          return;
        }
        const p = peligros[mejor];
        if (CLASES[p.clase]) preguntar(p, mejor);
        else registrar(p, mejor, null);
      });

      // Ventana sobre la imagen: ¿acto o condición?
      function preguntar(p, i) {
        preguntando = true;
        const pendiente = marca(p, i, "pendiente-clasificar");
        const capa = crear("div", "pregunta-riesgo");
        capa.addEventListener("click", function (ev) { ev.stopPropagation(); });   // no cuenta como toque en la imagen
        const tarjeta = crear("div", "pregunta-riesgo-caja");
        const zoom = crear("div", "zoom-riesgo");
        zoom.style.backgroundImage = "url(\"" + img.src + "\")";
        zoom.style.backgroundPosition = p.x + "% " + p.y + "%";
        const opciones = crear("div", "opciones-juego");
        ["acto", "condicion"].forEach(function (k) {
          const b = boton(CLASES[k], "opcion-juego", function () {
            capa.remove();
            pendiente.remove();
            preguntando = false;
            registrar(p, i, k === p.clase);
          });
          b.dataset.op = k;
          opciones.appendChild(b);
        });
        tarjeta.append(crear("strong", "pregunta-riesgo-titulo", "¡Encontraste un peligro! ¿Qué es?"), zoom, opciones);
        capa.appendChild(tarjeta);
        (cuerpo.closest(".juego") || cuerpo).appendChild(capa);   // ventana sobre toda la pantalla
      }

      function registrar(p, i, acierto) {
        hallados.set(i, acierto);
        marca(p, i, acierto === false ? "equivocado" : "encontrado");
        retro.hidden = false;
        retro.className = "retro-riesgo" + (acierto === false ? " mal" : "");
        retro.innerHTML = "";
        let titulo;
        if (acierto === null) titulo = "¡Bien! " + (p.nombre || "Peligro encontrado");
        else if (acierto) titulo = "¡Correcto! Es un" + (p.clase === "condicion" ? "a " : " ") + CLASES[p.clase].toLowerCase() + ": " + (p.nombre || "");
        else titulo = "Casi: es un" + (p.clase === "condicion" ? "a " : " ") + CLASES[p.clase].toLowerCase() + ". " + (p.nombre || "");
        retro.append(crear("strong", "", titulo));
        if (p.explicacion) retro.append(crear("p", "", p.explicacion));
        actualizar();
        if (hallados.size === peligros.length) final(false);
      }

      function revelar() {
        peligros.forEach(function (p, i) { if (!hallados.has(i)) marca(p, i, "pendiente"); });
        final(true);
      }

      function final(seRindio) {
        terminado = true;
        rendirse.remove();
        retro.hidden = true;
        const fin = crear("div", "juego-final");
        const n = hallados.size;
        let titulo = n === peligros.length ? "¡Encontraste los " + n + " peligros!" : "Encontraste " + n + " de " + peligros.length + " peligros";
        if (clasifica) titulo += " · " + bienClasificados() + " bien clasificados";
        fin.appendChild(crear("h4", "", titulo));
        if (fallos) fin.appendChild(crear("p", "juego-nota", fallos + (fallos === 1 ? " toque fallido." : " toques fallidos.")));
        if (seRindio) fin.appendChild(crear("p", "juego-nota", "En la imagen quedan marcados en rojo los que faltaban."));
        const lista = crear("ol", "lista-riesgos");
        peligros.forEach(function (p, i) {
          const estado = hallados.has(i) ? (hallados.get(i) === false ? "regular" : "bien") : "mal";
          const li = crear("li", estado);
          li.append(crear("strong", "", p.nombre || "Peligro " + (i + 1)));
          if (CLASES[p.clase]) li.append(crear("span", "etiqueta-clase " + p.clase, CLASES[p.clase]));
          if (p.explicacion) li.append(crear("span", "", " " + p.explicacion));
          lista.appendChild(li);
        });
        fin.append(lista, boton("Jugar de nuevo", "boton secundario", empezar));
        cuerpo.appendChild(fin);
      }
    }

    empezar();
  }

  // ===================================================================
  // 5. ¿QUÉ HARÍAS? Situaciones con varias respuestas
  //    escenarios: [{ situacion, opciones: [{ texto, correcta, explicacion }] }]
  // ===================================================================
  function escenarios(cuerpo, cfg) {
    const lista = (cfg.escenarios || []).filter(function (e) {
      return e && e.situacion && (e.opciones || []).length >= 2 && e.opciones.some(function (o) { return o.correcta; });
    });
    if (lista.length === 0) { cuerpo.textContent = "Este juego todavía no tiene situaciones."; return; }
    let orden, i, aciertos;

    function empezar() { orden = mezclar(lista); i = 0; aciertos = 0; mostrar(); }

    function mostrar() {
      cuerpo.innerHTML = "";
      const e = orden[i];
      const opciones = mezclar(e.opciones);
      const botones = crear("div", "opciones-escenario");
      opciones.forEach(function (o) {
        const b = boton(o.texto, "opcion-juego opcion-escenario", function () {
          botones.querySelectorAll("button").forEach(function (x) { x.disabled = true; });
          const correcta = opciones.find(function (x) { return x.correcta; });
          botones.children[opciones.indexOf(correcta)].classList.add("correcta");
          if (!o.correcta) b.classList.add("incorrecta"); else aciertos++;
          const fb = crear("div", "retro " + (o.correcta ? "bien" : "mal"));
          fb.append(crear("strong", "", o.correcta ? "¡Buena decisión!" : "No es lo más seguro."));
          if (o.explicacion) fb.append(crear("p", "", o.explicacion));
          if (!o.correcta && correcta.explicacion) fb.append(crear("p", "", "Lo correcto: " + correcta.explicacion));
          fb.append(boton(i < orden.length - 1 ? "Siguiente situación" : "Ver resultado", "boton boton-chico", function () {
            i++;
            if (i < orden.length) mostrar(); else final();
          }));
          cuerpo.appendChild(fb);
        });
        botones.appendChild(b);
      });
      cuerpo.append(crear("p", "juego-progreso", "Situación " + (i + 1) + " de " + orden.length + " · Aciertos: " + aciertos),
        crear("div", "tarjeta-juego", e.situacion), crear("p", "juego-nota pregunta-escenario", "¿Qué harías?"), botones);
    }

    function final() {
      cuerpo.innerHTML = "";
      const pct = Math.round(aciertos * 100 / orden.length);
      const fin = crear("div", "juego-final");
      fin.append(crear("h4", "", "Tomaste " + aciertos + " de " + orden.length + " decisiones seguras (" + pct + " %)"),
        crear("p", "", pct === 100 ? "¡Excelente criterio de seguridad!" : "Repasa las situaciones: en el trabajo, la decisión segura siempre va primero."),
        boton("Jugar de nuevo", "boton secundario", empezar));
      cuerpo.appendChild(fin);
    }

    empezar();
  }

  return { montar: montar, NOMBRES: NOMBRES, urlImagen: urlImagen };
})();
