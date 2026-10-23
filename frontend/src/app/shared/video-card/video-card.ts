import { Component, input } from '@angular/core';
import { Video } from '../../core/models';
import { Icon } from '../icon/icon';

/** Tarjeta de video estilo YouTube. `compact` = versión pequeña para el carrusel "Mis canciones". */
@Component({
  selector: 'app-video-card',
  imports: [Icon],
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