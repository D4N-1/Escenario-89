import { Component, input } from '@angular/core';
import { Video } from '../../core/models';

/** Tarjeta de video estilo YouTube. `compact` = versión pequeña para el carrusel "Mis canciones". */
@Component({
  selector: 'app-video-card',
  templateUrl: './video-card.html',
  styleUrl: './video-card.css',
})
export class VideoCard {
  video = input.required<Video>();
  compact = input(false);
  posicion = input<number | null>(null);
  /** true = solo se muestra, no se puede tocar */
  inactiva = input(false);
}