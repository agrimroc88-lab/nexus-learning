/* ============================================
   NEXUS · seleccionar-empresa.js
   Lógica exclusiva de seleccionar-empresa.html

   Punto de paso obligatorio entre iniciar sesión y
   cualquier módulo: decide con qué empresa se va a
   trabajar durante toda la sesión.
    · 0 empresas asignadas → aviso, no deja continuar.
    · 1 empresa asignada   → se fija sola, ni se muestra
      esta pantalla (rebote inmediato al Panel).
    · 2+ empresas          → el usuario elige una tarjeta.

   Nexus Academy: si la persona es administradora o docente
   en Nexus Academy (lo responde el puente), a la izquierda
   aparece su cuadro, y la pantalla se muestra aunque tenga
   una sola empresa. Si Nexus Academy no responde, todo sigue
   funcionando como antes.
   ============================================ */

import { protegerPagina, empresasPermitidas, elegirEmpresaActiva, cerrarSesion }
  from './auth.js';
import { videoDeLogin } from './tema-temporada.js';
import { papelEnLearning, paseDeEntrada, irALearning, LEARNING } from './puente-learning.js?v=3';

const BASE = '/Nexus/';

const $video = document.getElementById('video-fondo');
if ($video) {
  const VIDEO_POR_DEFECTO = 'img/login-fondo.mp4';
  $video.src = VIDEO_POR_DEFECTO;
  $video.load();

  videoDeLogin().then((src) => {
    if (src !== VIDEO_POR_DEFECTO) {
      $video.src = src;
      $video.load();
    }
  });
}

const $lista = document.getElementById('sel-emp-lista');
const $mensaje = document.getElementById('mensaje');
const $btnCerrarSesion = document.getElementById('btn-cerrar-sesion');

if ($btnCerrarSesion) $btnCerrarSesion.addEventListener('click', cerrarSesion);

iniciar();

async function iniciar() {
  const perfil = await protegerPagina();
  if (!perfil) return;

  // Las dos consultas a la vez: empresas de NEXUS y papel en Nexus Academy
  const [permitidas, papel] = await Promise.all([
    empresasPermitidas(perfil),
    papelEnLearning()
  ]);

  if (papel) mostrarLearning(papel);

  if (permitidas.length === 0) {
    mostrarMensaje(papel
      ? 'No tienes empresas asignadas en NEXUS, pero puedes entrar a Nexus Academy.'
      : 'Tu usuario no tiene ninguna empresa asignada. Contacta al administrador.');
    return;
  }

  if (permitidas.length === 1 && !papel) {
    // Nada que elegir: se fija sola y sigue derecho al Panel.
    elegirEmpresaActiva(permitidas[0].id);
    window.location.href = BASE + 'dashboard.html';
    return;
  }

  pintarOpciones(permitidas);
}

function mostrarLearning(papel) {
  document.getElementById('tarjeta').classList.add('acceso-tarjeta-doble');
  const $lema = document.querySelector('.acceso-lema');
  if ($lema) $lema.textContent = '¿Dónde vas a trabajar hoy?';
  document.getElementById('sel-learning').hidden = false;
  document.getElementById('sel-emp-titulo').hidden = false;
  document.getElementById('sel-learning-papel').textContent =
    papel === 'admin' ? 'Administración de capacitaciones' : 'Mis programas como docente';

  // Entrada rápida: el pase se pide en segundo plano apenas aparece el cuadro
  // y la página de entrada de Learning se descarga por adelantado.
  ['entrar.html', papel === 'admin' ? 'admin.html' : 'charla.html'].forEach((pag) => {
    const l = document.createElement('link');
    l.rel = 'prefetch';
    l.href = LEARNING.sitio + pag;
    document.head.appendChild(l);
  });
  let pase = null;                       // { promesa, hora }
  const pedirPase = () => { pase = { promesa: paseDeEntrada(), hora: Date.now() }; return pase.promesa; };
  pedirPase();

  const $btn = document.getElementById('btn-learning');
  const $entrar = document.getElementById('sel-learning-entrar');
  $btn.addEventListener('click', async () => {
    $btn.disabled = true;
    $entrar.textContent = 'Conectando…';
    // El pase es de un solo uso y caduca: si tiene más de 10 minutos, se pide otro
    let r = await ((pase && Date.now() - pase.hora < 600000) ? pase.promesa : pedirPase());
    if (r.error || !r.token_hash) r = await pedirPase();     // un reintento
    if (r.error || !r.token_hash) {
      pase = null;
      $btn.disabled = false;
      $entrar.textContent = 'Entrar →';
      mostrarMensaje(r.error || 'No fue posible entrar a Nexus Academy.');
      return;
    }
    pase = null;
    irALearning(r.token_hash, r.rol);
  });
}

function pintarOpciones(empresas) {
  $lista.innerHTML = '';

  empresas.forEach((e) => {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'sel-emp-opcion';
    boton.innerHTML =
      `<span>${escapar(e.razon_social)}</span><span class="sel-emp-flecha">→</span>`;
    boton.addEventListener('click', () => elegir(e.id));
    $lista.appendChild(boton);
  });
}

function elegir(id) {
  elegirEmpresaActiva(id);
  window.location.href = BASE + 'dashboard.html';
}

function mostrarMensaje(texto) {
  $mensaje.textContent = texto;
  $mensaje.hidden = false;
}

/* Copia local mínima: este archivo no depende de utils.js
   para no arrastrar el resto de sus helpers en la pantalla
   más liviana de todo el sistema. */
function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}
