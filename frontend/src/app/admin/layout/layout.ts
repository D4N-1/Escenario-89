import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { Icon } from '../../shared/icon/icon';
import { QueuePanel } from '../../shared/queue-panel/queue-panel';
import { AppState } from '../../core/app-state';
import { BarService } from '../../core/bar.service';
import { EstadoLocal } from '../../core/models';
import { PlayerService } from '../../core/player.service';
import { QueueService } from '../../core/queue.service';
import { YtPlayer } from '../../shared/yt-player/yt-player';

@Component({ selector: 'app-layout', imports: [RouterOutlet, RouterLink, Icon, QueuePanel, YtPlayer], templateUrl: './layout.html', styleUrl: './layout.css' })
export class Layout implements OnInit, OnDestroy {
  router = inject(Router);
  state = inject(AppState);
  bar = inject(BarService);
  player = inject(PlayerService);
  queue = inject(QueueService);

  estadoMenuOpen = false;
  hourMenuOpen = false;
  hoursList = ['12:00 am', '1:00 am', '2:00 am', '3:00 am', '4:00 am', '5:00 am', '6:00 am', '10:00 pm', '11:00 pm'];

  ngOnInit() {
    // Sincronizar estado del bar y hora de cierre desde el backend y sockets
    this.bar.iniciarSincronizacion();
    // La cola vive en el backend: sincronizada vía WebSockets
    this.queue.iniciarPolling();
  }

  ngOnDestroy() {
    this.bar.detenerSincronizacion();
    this.queue.detenerPolling();
    this.player.destruir();
  }

  get path() { return this.router.url.split('?')[0]; }
  get isPanel() { return this.path === '/admin' || this.path === '/admin/cerrando' || this.path === '/admin/cerrado'; }
  get isAnuncios() { return this.path.startsWith('/admin/anuncios'); }
  get isAudios() { return this.path.startsWith('/admin/audios'); }

  get activeState(): EstadoLocal {
    return this.state.estado();
  }

  toggleEstadoMenu() {
    this.estadoMenuOpen = !this.estadoMenuOpen;
    if (this.estadoMenuOpen) {
      this.hourMenuOpen = false;
    }
  }

  async selectState(state: EstadoLocal) {
    this.estadoMenuOpen = false;
    try {
      await this.bar.cambiarEstado(state);
    } catch (e) {
      console.error('Error al cambiar estado:', e);
    }
  }

  stateLabel(state: EstadoLocal): string {
    switch (state) {
      case 'abierto': return 'Abierto';
      case 'cerrando': return 'Cerrando';
      case 'cerrado': return 'Cerrado';
    }
  }

  toggleHourMenu() {
    this.hourMenuOpen = !this.hourMenuOpen;
    if (this.hourMenuOpen) {
      this.estadoMenuOpen = false;
    }
  }

  async selectHour(hour: string) {
    this.hourMenuOpen = false;
    try {
      await this.bar.cambiarHoraCierre(hour);
    } catch (e) {
      console.error('Error al cambiar hora de cierre:', e);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.estado-selector')) {
      this.estadoMenuOpen = false;
    }
    if (!target.closest('.hour-selector')) {
      this.hourMenuOpen = false;
    }
  }

  onSeek(event: MouseEvent) {
    if (this.state.estado() === 'cerrado') return;
    const el = event.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
    this.player.seekPorcentaje(pct);
  }
}