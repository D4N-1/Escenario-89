import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Icon } from '../../shared/icon/icon';
import { ClientHeader } from '../../shared/client-header/client-header';
import { VideoCard } from '../../shared/video-card/video-card';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import { AppState } from '../../core/app-state';
import { Video } from '../../core/models';
import { QueueService } from '../../core/queue.service';

@Component({
  selector: 'app-home',
  imports: [Icon, RouterLink, ClientHeader, VideoCard, ConfirmDialog],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  state = inject(AppState);
  router = inject(Router);
  queue = inject(QueueService);
  seleccion = signal<Video | null>(null);

  constructor() {
    // "Mis canciones" y sus posiciones salen de la cola del backend; se actualizan solas mientras esta pantalla está abierta
    this.queue.iniciarPollingMesa();
    inject(DestroyRef).onDestroy(() => this.queue.detenerPollingMesa());
  }

  irABuscar(texto: string) {
    const q = texto.trim();
    if (q) this.state.busqueda.set(q);
    this.router.navigate(['/buscar']);
  }
}