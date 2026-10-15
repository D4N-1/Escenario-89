import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Icon } from '../../shared/icon/icon';
import { ClientHeader } from '../../shared/client-header/client-header';
import { VideoCard } from '../../shared/video-card/video-card';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import { AppState } from '../../core/app-state';
import { Video } from '../../core/models';

@Component({
  selector: 'app-home',
  imports: [Icon, RouterLink, ClientHeader, VideoCard, ConfirmDialog],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  state = inject(AppState);
  router = inject(Router);
  seleccion = signal<Video | null>(null);

  constructor() {
    // El QR de cada mesa abre /?mesa=5
    const mesa = Number(inject(ActivatedRoute).snapshot.queryParamMap.get('mesa'));
    if (mesa > 0) this.state.mesa.set(mesa);
  }

  irABuscar(texto: string) {
    const q = texto.trim();
    if (q) this.state.busqueda.set(q);
    this.router.navigate(['/buscar']);
  }
}