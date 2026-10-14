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
// Lo usan curso.html (estudiantes) y juegos.html (vista previa).
// Todo el texto se pinta con textContent (nunca HTML de la base).
// =====================================================================

const NexusJuegos = (function () {
  const NOMBRES = { numeros: "Busca los números", clasificar: "Clasifica", ordenar: "Ordena los pasos" };

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

  return { montar: montar, NOMBRES: NOMBRES };
})();
