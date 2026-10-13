// =====================================================================
// NEXUS LEARNING · CARTEL QR (A4 vertical, para imprimir o proyectar)
// Carpeta: js/cartel.js
// Para cambiar el diseño del cartel, solo se edita este archivo.
// Requiere: jsPDF y qrcode-generator (se cargan en empresas.html).
// =====================================================================

const NexusCartel = (function () {
  const PINO = [15, 61, 62];
  const PINO_CLARO = [28, 92, 93];
  const SENAL = [242, 193, 78];
  const TINTA = [23, 34, 32];
  const GRIS = [86, 101, 95];

  function color(doc, c, tipo) {
    if (tipo === "texto") doc.setTextColor(c[0], c[1], c[2]);
    else if (tipo === "relleno") doc.setFillColor(c[0], c[1], c[2]);
    else doc.setDrawColor(c[0], c[1], c[2]);
  }

  function texto(doc, contenido, x, y, o) {
    o = Object.assign({ tam: 12, color: TINTA, estilo: "normal", alinear: "center" }, o);
    doc.setFont("helvetica", o.estilo);
    doc.setFontSize(o.tam);
    color(doc, o.color, "texto");
    doc.text(contenido, x, y, { align: o.alinear });
  }

  function dibujarQR(doc, contenido, x, y, tamano) {
    const qr = qrcode(0, "M");
    qr.addData(contenido);
    qr.make();
    const n = qr.getModuleCount();
    const celda = tamano / n;
    color(doc, TINTA, "relleno");
    for (let f = 0; f < n; f++) {
      for (let c = 0; c < n; c++) {
        if (qr.isDark(f, c)) doc.rect(x + c * celda, y + f * celda, celda + 0.03, celda + 0.03, "F");
      }
    }
  }

  function fechaLarga(iso) {
    return new Date(iso).toLocaleString("es-EC", {
      day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
  }

  function generar(d) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210, CX = W / 2;
    const esPresencial = d.tipo === "presencial";

    // --- Franja superior ---
    color(doc, PINO, "relleno");
    doc.rect(0, 0, W, 78, "F");

    // Marca
    color(doc, SENAL, "relleno");
    doc.circle(CX - 24, 16, 2.6, "F");
    color(doc, SENAL, "borde");
    doc.setLineWidth(1.1);
    doc.circle(CX - 18, 16, 2.6, "S");
    doc.line(CX - 21.4, 16, CX - 20.6, 16);
    texto(doc, "Nexus Learning", CX - 13, 17.4, { tam: 12, estilo: "bold", color: [255, 255, 255], alinear: "left" });

    texto(doc, String(d.empresa || "").toUpperCase(), CX, 33, { tam: 13, estilo: "bold", color: SENAL });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    const lineasCurso = doc.splitTextToSize(String(d.curso || ""), 175).slice(0, 2);
    doc.setTextColor(255, 255, 255);
    doc.text(lineasCurso, CX, 47, { align: "center" });

    texto(doc, esPresencial ? "Certificado de la capacitación presencial" : "Curso virtual con certificado",
      CX, lineasCurso.length > 1 ? 68 : 60, { tam: 12, color: [207, 224, 218] });

    // --- Instrucción y QR ---
    texto(doc, "Escanea con la cámara de tu celular", CX, 90, { tam: 18, estilo: "bold", color: PINO });

    const lado = 100, xQR = CX - lado / 2, yQR = 106;
    color(doc, SENAL, "borde");
    doc.setLineWidth(1.6);
    doc.roundedRect(xQR - 7, yQR - 7, lado + 14, lado + 14, 5, 5, "S");
    dibujarQR(doc, d.url, xQR, yQR, lado);

    // --- Código escrito ---
    texto(doc, "¿No puedes escanear? Entra a la página e ingresa el código:", CX, yQR + lado + 19, { tam: 11, color: GRIS });
    texto(doc, d.sitio.replace(/^https?:\/\//, "").replace(/\/$/, ""), CX, yQR + lado + 26, { tam: 11, estilo: "bold", color: PINO_CLARO });
    texto(doc, d.codigo, CX, yQR + lado + 42, { tam: 34, estilo: "bold", color: TINTA });

    // --- Pasos ---
    const pasos = esPresencial
      ? (d.requiere_evaluacion
          ? ["Escanea el código", "Escribe tus datos", "Responde el test y descarga tu certificado"]
          : ["Escanea el código", "Escribe tus nombres y cédula", "Descarga tu certificado"])
      : ["Ingresa con el código", "Estudia las lecciones", "Aprueba el test y descarga tu certificado"];
    const yPasos = 262, ancho = 56;
    pasos.forEach(function (p, i) {
      const x = 22 + i * (ancho + 6);
      color(doc, SENAL, "relleno");
      doc.circle(x + 5, yPasos, 5, "F");
      texto(doc, String(i + 1), x + 5, yPasos + 1.8, { tam: 12, estilo: "bold", color: PINO });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      color(doc, TINTA, "texto");
      doc.text(doc.splitTextToSize(p, ancho - 14), x + 13, yPasos - 1.5);
    });

    // --- Validez ---
    color(doc, PINO, "relleno");
    doc.rect(0, 280, W, 17, "F");
    texto(doc, "Válido hasta el " + fechaLarga(d.valido_hasta), CX, 290.5, { tam: 12, estilo: "bold", color: [255, 255, 255] });

    doc.save("Cartel_" + d.codigo + ".pdf");
  }

  // -------------------------------------------------------------------
  // Cartel PERMANENTE del programa: un solo QR para todas las empresas.
  // Debajo, un recuadro en blanco para escribir la clave de cada empresa.
  // -------------------------------------------------------------------
  function generarPrograma(d) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210, CX = W / 2;

    // Franja superior
    color(doc, PINO, "relleno");
    doc.rect(0, 0, W, 72, "F");
    color(doc, SENAL, "relleno");
    doc.circle(CX - 24, 16, 2.6, "F");
    color(doc, SENAL, "borde");
    doc.setLineWidth(1.1);
    doc.circle(CX - 18, 16, 2.6, "S");
    doc.line(CX - 21.4, 16, CX - 20.6, 16);
    texto(doc, "Nexus Learning", CX - 13, 17.4, { tam: 12, estilo: "bold", color: [255, 255, 255], alinear: "left" });
    texto(doc, "PROGRAMA DE CAPACITACIÓN", CX, 32, { tam: 12, estilo: "bold", color: SENAL });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    const lineas = doc.splitTextToSize(String(d.curso || ""), 175).slice(0, 2);
    doc.setTextColor(255, 255, 255);
    doc.text(lineas, CX, 46, { align: "center" });
    const horas = Number(d.horas);
    texto(doc, (horas === 1 ? "1 hora" : horas.toLocaleString("es-EC") + " horas") + " · Certificado con código verificable",
      CX, lineas.length > 1 ? 64 : 57, { tam: 11, color: [207, 224, 218] });

    // QR
    texto(doc, "Escanea con la cámara de tu celular", CX, 88, { tam: 18, estilo: "bold", color: PINO });
    const lado = 92, xQR = CX - lado / 2, yQR = 98;
    color(doc, SENAL, "borde");
    doc.setLineWidth(1.6);
    doc.roundedRect(xQR - 7, yQR - 7, lado + 14, lado + 14, 5, 5, "S");
    dibujarQR(doc, d.url, xQR, yQR, lado);

    // Recuadro para escribir la clave de la empresa
    const yClave = yQR + lado + 16;
    texto(doc, "Clave de acceso de tu empresa", CX, yClave, { tam: 13, estilo: "bold", color: TINTA });
    color(doc, PINO, "borde");
    doc.setLineWidth(0.8);
    doc.setLineDashPattern([2.5, 2], 0);
    doc.roundedRect(CX - 55, yClave + 4, 110, 22, 4, 4, "S");
    doc.setLineDashPattern([], 0);
    if (d.clave) texto(doc, d.clave, CX, yClave + 19, { tam: 26, estilo: "bold", color: TINTA });

    // Pasos
    const pasos = ["Escanea el código QR", "Escribe la clave que te dio tu empresa", "Completa la capacitación y descarga tu certificado"];
    const yPasos = 252, ancho = 56;
    pasos.forEach(function (p, i) {
      const x = 22 + i * (ancho + 6);
      color(doc, SENAL, "relleno");
      doc.circle(x + 5, yPasos, 5, "F");
      texto(doc, String(i + 1), x + 5, yPasos + 1.8, { tam: 12, estilo: "bold", color: PINO });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      color(doc, TINTA, "texto");
      doc.text(doc.splitTextToSize(p, ancho - 14), x + 13, yPasos - 1.5);
    });

    // Pie
    color(doc, PINO, "relleno");
    doc.rect(0, 280, W, 17, "F");
    const pie = d.valido_hasta
      ? "Clave válida hasta el " + fechaLarga(d.valido_hasta)
      : d.sitio.replace(/^https?:\/\//, "").replace(/\/$/, "");
    texto(doc, pie, CX, 290.5, { tam: 11, estilo: "bold", color: [255, 255, 255] });

    const nombre = String(d.curso || "programa").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "_").slice(0, 60);
    doc.save("QR_Programa_" + nombre + (d.clave ? "_" + d.clave : "") + ".pdf");
  }

  return { generar: generar, generarPrograma: generarPrograma };
})();
