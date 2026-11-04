/* =====================================================================
   NEXUS LEARNING · cuestionario-atd.js
   Cuestionario de diagnóstico inicial de consumo de alcohol, tabaco y
   otras drogas (A.M. MDT-2024-196), dentro de la capacitación.

   · Usa el mismo link y clave de la capacitación (curso.html).
   · Se llena UNA sola vez (por persona, tema y año): «Guardar cuestionario».
   · No vuelve a preguntar lo que ya dio al registrarse (cédula, año de
     nacimiento, etnia; el género se propone desde el sexo).
   · Los códigos de cada respuesta son los mismos del Test A-T-D de NEXUS,
     para que el informe salga igual.
   Requiere el SQL 41.
   ===================================================================== */
(function () {
  "use strict";

  const OPC = {
    afiliacion: [["publica", "Pública"], ["privada", "Privada"]],
    estado_civil: [["soltero", "Soltero/a"], ["casado", "Casado/a"], ["divorciado", "Divorciado/a"], ["viudo", "Viudo/a"], ["union_hecho", "Unión de hecho"]],
    genero: [["masculino", "Masculino"], ["femenino", "Femenino"], ["lgbtiq+", "LGBTIQ+"]],
    nivel_instruccion: [["educacion_basica", "Educación básica"], ["bachiller", "Bachiller"],
      ["tercer_nivel", "Tercer nivel (técnico superior, tecnólogo, licenciado, ingeniero, etc.)"],
      ["cuarto_nivel", "Cuarto nivel (especialización, maestría, posgrado, PhD, etc.)"]],
    etnia: [["mestizo", "Mestizo"], ["blanco", "Blanco"], ["indigena", "Indígena"], ["montubio", "Montubio"], ["afroecuatoriano", "Afroecuatoriano"], ["otro", "Otro"]],
    discapacidad: [["no_aplica", "No aplica (no tengo carnet del CONADIS)"], ["auditiva", "Auditiva"], ["fisica", "Física"], ["intelectual", "Intelectual"], ["lenguaje", "Lenguaje"], ["psicosocial", "Psicosocial"], ["visual", "Visual"]],
    enfermedad_preexistente: [
      ["catastrofica", "Catastrófica (malformaciones, cáncer, tumor, insuficiencia renal, secuelas de quemaduras, etc.)"],
      ["cronica_no_transmisible", "Crónica no transmisible (diabetes, hipertensión, artritis)"],
      ["cronica_transmisible", "Crónica transmisible (enfermedades venéreas, tuberculosis, etc.)"],
      ["aguda", "Aguda (gastritis, cirrosis, migraña, etc.)"],
      ["no_diagnosticada", "Ninguna / no diagnosticada"]],
    droga: [["no_consume", "No consume"], ["alcohol", "Alcohol"], ["tabaco", "Tabaco"], ["cannabis", "Cannabis (marihuana, hachís, THC)"],
      ["cocaina", "Cocaína"], ["base_cocaina", "Base de cocaína"], ["anfetaminas", "Anfetaminas"],
      ["drogas_sintesis", "Drogas de síntesis (éxtasis, MDMA, ketamina)"], ["hongos", "Hongos"],
      ["inhalantes", "Inhalantes (aerosoles, pegamentos, disolventes, éter)"], ["lsd", "LSD"], ["mezcalina", "Mezcalina"],
      ["opiaceos", "Opiáceos (heroína, morfina, metadona)"], ["psilocibina", "Psilocibina"], ["otra", "Otra"]],
    frecuencia_consumo: [["5_a_7_semana", "De 5 a 7 días a la semana"], ["2_a_4_semana", "De 2 a 4 veces a la semana"],
      ["2_a_7_semana", "De 2 a 7 veces a la semana"], ["al_menos_1_semana", "Al menos una vez a la semana"],
      ["2_a_12_anio", "De 2 a 12 veces al año"], ["1_anio", "Una vez al año"]],
    reconoce_problema: [["si", "Sí"], ["no", "No"]],
    factor_psicosocial: [
      ["agobio_tension_trabajo", "Agobio y tensión en el trabajo"], ["acoso_laboral", "Acoso laboral"],
      ["cansancio_intenso", "Cansancio intenso, agobio"], ["companeros_consumidores", "Compañeros consumidores"],
      ["contratos_precarios", "Contratos precarios (precariedad contractual)"], ["curiosidad_efectos", "Curiosidad sobre los efectos de las drogas"],
      ["dificultad_resolucion_problemas", "Dificultad en la resolución de problemas"], ["elevados_niveles_tension_estres", "Elevados niveles de tensión y estrés laboral"],
      ["expendio_drogas_trabajo", "Existencia de expendio de drogas en el lugar de trabajo"], ["familiares_consumidores", "Familiares consumidores"],
      ["insatisfaccion_tipo_trabajo", "Insatisfacción con el tipo de trabajo que se realiza"],
      ["insatisfaccion_trato_recibido", "Insatisfacción con el trato que se recibe de los superiores y/o compañeros"],
      ["inseguridad_futuro_laboral", "Inseguridad en cuanto al futuro laboral"], ["largas_ausencias_hogar", "Largas ausencias del hogar por motivos laborales"],
      ["mala_situacion_economica", "Mala situación económica en la familia"], ["peligrosidad_tarea", "Peligrosidad en el desempeño de la tarea"],
      ["problemas_conciliacion", "Problemas de conciliación entre el trabajo y las tareas domésticas"],
      ["sentimiento_poco_capacitado", "Sentimiento de estar poco capacitado o sin formación para el trabajo"],
      ["sindrome_burnout", "Síndrome de «burnout» (estrés laboral crónico)"], ["tareas_rutinarias", "Tareas rutinarias o monótonas"],
      ["trabajos_nocturnos", "Trabajos nocturnos, a destajo o con objetivos de alto rendimiento"], ["turnos_rotativos", "Turnos rotatorios y cambiantes"],
      ["otro_evento_social", "Otro (eventos sociales, reuniones, etc.)"]],
    si_no: [["si", "Sí"], ["no", "No"]]
  };

  function h(tag, attrs, hijos) {
    const e = document.createElement(tag);
    Object.entries(attrs || {}).forEach(function (kv) {
      if (kv[0] === "texto") e.textContent = kv[1];
      else if (kv[0] === "clase") e.className = kv[1];
      else e.setAttribute(kv[0], kv[1]);
    });
    (hijos || []).forEach(function (x) { if (x) e.appendChild(x); });
    return e;
  }

  // Pregunta de opción única (botones grandes, como el resto de la página)
  function radios(nombre, titulo, opciones, valor) {
    const fs = h("fieldset", { clase: "pregunta", "data-p": nombre });
    fs.appendChild(h("legend", { texto: titulo }));
    opciones.forEach(function (o) {
      const input = h("input", { type: "radio", name: "atd-" + nombre, value: o[0] });
      if (valor === o[0]) input.checked = true;
      fs.appendChild(h("label", { clase: "opcion" }, [input, h("span", { texto: o[1] })]));
    });
    fs.appendChild(h("p", { clase: "error-campo" }));
    return fs;
  }

  function texto(nombre, titulo, tipo, ayuda) {
    const div = h("div", { clase: "pregunta", "data-p": nombre });
    div.appendChild(h("label", { clase: "etiqueta atd-etiqueta", for: "atd-" + nombre, texto: titulo }));
    const i = h("input", { clase: "campo", id: "atd-" + nombre, type: tipo || "text", maxlength: "120", autocomplete: "off" });
    if (tipo === "number") { i.setAttribute("min", "0"); i.setAttribute("max", nombre === "pct_discapacidad" ? "100" : "30"); i.setAttribute("inputmode", "numeric"); }
    div.appendChild(i);
    if (ayuda) div.appendChild(h("p", { clase: "atd-ayuda", texto: ayuda }));
    div.appendChild(h("p", { clase: "error-campo" }));
    return div;
  }

  function bloque(titulo, hijos) {
    return h("section", { clase: "atd-bloque" }, [h("h3", { clase: "atd-bloque-titulo", texto: titulo })].concat(hijos));
  }

  /**
   * Muestra el cuestionario en `caja`.
   * op = { db, codigo, cedula, caja, alTerminar() }
   */
  async function mostrar(op) {
    const caja = op.caja;
    caja.innerHTML = "";
    caja.hidden = false;
    const est = await op.db.rpc("cap_atd_estado", { p_codigo: op.codigo, p_cedula: op.cedula });
    if (est.error || !est.data || !est.data.requiere || est.data.enviado) { caja.hidden = true; return op.alTerminar(); }
    const d = est.data;
    const generoSugerido = d.sexo === "M" ? "masculino" : d.sexo === "F" ? "femenino" : "";
    const etniaConocida = d.etnia && d.etnia !== "no_responde";

    caja.append(
      h("p", { clase: "vista-paso", texto: "Cuestionario obligatorio · confidencial" }),
      h("h2", { texto: "Diagnóstico de alcohol, tabaco y otras drogas" }),
      h("p", { clase: "nota-intro", texto: "Apreciado trabajador: toda la información que respondas es CONFIDENCIAL, no será de conocimiento público ni tendrá ninguna repercusión en tu puesto laboral. Elige solo una opción en cada pregunta. Solo se puede enviar una vez." })
    );

    const form = h("form", { id: "form-atd", novalidate: "" });
    form.append(
      bloque("1. Datos generales", [
        texto("area_cargo", "Cargo o puesto de trabajo", "text"),
        radios("afiliacion", "Tipo de afiliación a la seguridad social", OPC.afiliacion),
        radios("estado_civil", "Estado civil", OPC.estado_civil),
        radios("genero", "Género", OPC.genero, generoSugerido),
        radios("nivel_instruccion", "Nivel de instrucción", OPC.nivel_instruccion),
        texto("num_hijos", "Número de hijos", "number"),
        etniaConocida ? null : radios("etnia", "Autoidentificación étnica", OPC.etnia)
      ]),
      bloque("2. Salud", [
        radios("discapacidad", "Discapacidad (solo si tienes carnet del CONADIS)", OPC.discapacidad),
        texto("pct_discapacidad", "Porcentaje de discapacidad", "number"),
        radios("trabajador_sustituto", "¿Eres «trabajador sustituto»?", OPC.si_no),
        radios("enfermedad_preexistente", "Enfermedades pre-existentes", OPC.enfermedad_preexistente)
      ]),
      bloque("3. Consumo", [
        radios("droga_principal", "Principal droga que consumes (elige solo una, la principal)", OPC.droga),
        texto("droga_principal_otra", "¿Cuál otra droga?", "text"),
        radios("otra_droga", "Otra droga que consumes (sin contar la anterior)", OPC.droga),
        radios("frecuencia_consumo", "Frecuencia de consumo (de la droga principal)", OPC.frecuencia_consumo),
        texto("ultimo_consumo", "¿Cuándo fue la última vez que consumiste?", "text", "Por ejemplo: la semana pasada, hace un mes, en diciembre…"),
        radios("reconoce_problema", "¿Reconoces tener un problema de consumo?", OPC.reconoce_problema),
        radios("factor_psicosocial", "Factor psicosocial relacionado al consumo (elige solo uno)", OPC.factor_psicosocial)
      ]),
      bloque("4. Tratamiento", [
        radios("desea_tratamiento", "¿Deseas recibir tratamiento?", OPC.si_no),
        texto("telefono", "Número de teléfono", "tel"),
        texto("direccion", "Dirección", "text")
      ])
    );
    const error = h("p", { clase: "aviso error", role: "alert" });
    error.hidden = true;
    const boton = h("button", { type: "submit", clase: "boton atd-guardar", texto: "Guardar cuestionario" });
    form.append(error, boton);
    caja.appendChild(form);

    const valor = function (n) {
      const r = form.querySelector('input[name="atd-' + n + '"]:checked');
      if (r) return r.value;
      const t = form.querySelector("#atd-" + n);
      return t ? t.value.trim() : "";
    };
    const pregunta = function (n) { return form.querySelector('[data-p="' + n + '"]'); };

    // Preguntas que dependen de otras
    function actualizar() {
      const droga = valor("droga_principal");
      const consume = droga && droga !== "no_consume";
      pregunta("pct_discapacidad").hidden = !valor("discapacidad") || valor("discapacidad") === "no_aplica";
      pregunta("droga_principal_otra").hidden = droga !== "otra";
      ["frecuencia_consumo", "ultimo_consumo", "reconoce_problema", "factor_psicosocial"].forEach(function (n) {
        pregunta(n).hidden = !consume;
      });
      const trat = valor("desea_tratamiento") === "si";
      pregunta("telefono").hidden = !trat;
      pregunta("direccion").hidden = !trat;
    }
    form.addEventListener("change", actualizar);
    actualizar();

    form.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      error.hidden = true;
      form.querySelectorAll(".pregunta").forEach(function (p) {
        p.classList.remove("sin-responder");
        const e = p.querySelector(".error-campo");
        if (e) e.textContent = "";
      });

      const obligatorias = ["area_cargo", "afiliacion", "estado_civil", "genero", "nivel_instruccion", "num_hijos",
        "discapacidad", "trabajador_sustituto", "enfermedad_preexistente", "droga_principal", "otra_droga", "desea_tratamiento"];
      if (!etniaConocida) obligatorias.push("etnia");
      if (!pregunta("pct_discapacidad").hidden) obligatorias.push("pct_discapacidad");
      if (!pregunta("droga_principal_otra").hidden) obligatorias.push("droga_principal_otra");
      if (!pregunta("frecuencia_consumo").hidden) obligatorias.push("frecuencia_consumo", "reconoce_problema", "factor_psicosocial");
      if (!pregunta("telefono").hidden) obligatorias.push("telefono");

      const faltan = obligatorias.filter(function (n) { return !valor(n); });
      if (faltan.length) {
        faltan.forEach(function (n) {
          const p = pregunta(n);
          p.classList.add("sin-responder");
          const e = p.querySelector(".error-campo");
          if (e) e.textContent = "Responde esta pregunta.";
        });
        error.textContent = faltan.length === 1 ? "Falta 1 respuesta." : "Faltan " + faltan.length + " respuestas.";
        error.hidden = false;
        pregunta(faltan[0]).scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      if (!confirm("¿Guardar el cuestionario?\n\nRevisa tus respuestas: solo se puede enviar una vez.")) return;

      const datos = {
        area_cargo: valor("area_cargo"),
        genero: valor("genero"),
        anio_nacimiento: d.anio_nacimiento || null,
        afiliacion: valor("afiliacion"),
        estado_civil: valor("estado_civil"),
        nivel_instruccion: valor("nivel_instruccion"),
        num_hijos: valor("num_hijos"),
        etnia: etniaConocida ? d.etnia : valor("etnia"),
        discapacidad: valor("discapacidad"),
        pct_discapacidad: pregunta("pct_discapacidad").hidden ? "" : valor("pct_discapacidad"),
        trabajador_sustituto: valor("trabajador_sustituto") === "si",
        enfermedad_preexistente: valor("enfermedad_preexistente"),
        droga_principal: valor("droga_principal"),
        droga_principal_otra: valor("droga_principal_otra"),
        otra_droga: valor("otra_droga"),
        frecuencia_consumo: valor("frecuencia_consumo"),
        ultimo_consumo: valor("ultimo_consumo"),
        reconoce_problema: valor("reconoce_problema"),
        factor_psicosocial: valor("factor_psicosocial"),
        desea_tratamiento: valor("desea_tratamiento") === "si",
        telefono: valor("telefono"),
        direccion: valor("direccion")
      };

      boton.disabled = true;
      boton.textContent = "Guardando…";
      const r = await op.db.rpc("cap_atd_guardar", { p_codigo: op.codigo, p_cedula: op.cedula, p_datos: datos });
      boton.disabled = false;
      boton.textContent = "Guardar cuestionario";
      if (r.error && !/Ya enviaste/.test(r.error.message || "")) {
        error.textContent = r.error.message || "No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.";
        error.hidden = false;
        return;
      }
      caja.innerHTML = "";
      caja.append(
        h("p", { clase: "vista-paso", texto: "Cuestionario" }),
        h("h2", { texto: "✔ Cuestionario guardado" }),
        h("p", { texto: "Gracias. Tus respuestas quedaron registradas de forma confidencial." })
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
      op.alTerminar();
    });

    caja.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  window.NexusAtd = { mostrar: mostrar, opciones: OPC };
})();
