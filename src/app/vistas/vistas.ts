import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { QueueMenu } from '../shared/queue-menu/queue-menu';

@Component({ selector: 'app-vistas', imports: [RouterLink, QueueMenu], templateUrl: './vistas.html', styleUrl: './vistas.css' })
export class Vistas {
  grupos = [
    { t: 'Cliente (móvil)', l: [['/', 'Inicio'], ['/buscar', 'Resultados de búsqueda'], ['/confirmar', 'Popup ¿Pedir canción?'], ['/agregado', 'Añadido a la cola']] },
    { t: 'Administración', l: [
      ['/splash', 'Splash'],
      ['/admin/login', 'Login'],
      ['/admin', 'Panel principal (Abierto)'],
      ['/admin/cerrando', 'Panel principal (Cerrando)'],
      ['/admin/cerrado', 'Panel principal (Cerrado)'],
      ['/admin/anuncios', 'Anuncios'],
      ['/admin/anuncios/nuevo', 'Crear anuncio (modal)'],
      ['/admin/audios', 'Audios'],
    ] },
    { t: 'Pantalla secundaria', l: [['/pantalla', 'TV / Proyector']] },
  ];
  colores = [
    ['Bordes oscuros', '#7a5a1f'],
    ['Bordes', '#d4aa43'],
    ['Acciones doradas', '#f2ce64'],
    ['Destellos', '#fee69a'],
    ['Estado Abierto', '#15803d'],
    ['Estado Cerrando', '#d97706'],
    ['Estado Cerrado', '#b91c1c'],
    ['Contraste', '#000000'],
    ['Fondo', '#09090b'],
    ['Secciones', '#141417'],
    ['Buscador', '#202024'],
    ['Iconos y bordes', '#7d7d88'],
    ['Texto secundario', '#b4b4bf'],
    ['Títulos', '#ffffff'],
    ['Subtexto', '#737380'],
  ];
}
