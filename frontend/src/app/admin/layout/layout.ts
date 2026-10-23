import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { Icon } from '../../shared/icon/icon';
import { QueuePanel } from '../../shared/queue-panel/queue-panel';
import { AppState } from '../../core/app-state';
import { PlayerService } from '../../core/player.service';
import { QueueService } from '../../core/queue.service';
import { YtPlayer } from '../../shared/yt-player/yt-player';

@Component({ selector: 'app-layout', imports: [RouterOutlet, RouterLink, Icon, QueuePanel, YtPlayer], templateUrl: './layout.html', styleUrl: './layout.css' })
export class Layout implements OnInit, OnDestroy {
  router = inject(Router);
  state = inject(AppState);
  player = inject(PlayerService);
  queue = inject(QueueService);

  currentState: 'abierto' | 'cerrando' | 'cerrado' = 'abierto';
  estadoMenuOpen = false;

  selectedHour = '3:00 am';
  hourMenuOpen = false;
  hoursList = ['12:00 am', '1:00 am', '2:00 am', '3:00 am', '4:00 am', '5:00 am', '6:00 am'];

  ngOnInit() {
    this.currentState = this.state.estado();
    this.selectedHour = this.state.horaCierre();
    // La cola vive en el backend: sincronizada vía WebSockets
    this.queue.iniciarPolling();
  }

  ngOnDestroy() {
    this.queue.detenerPolling();
    this.player.destruir();
  }

  get path() { return this.router.url.split('?')[0]; }
  get isPanel() { return this.path === '/admin' || this.path === '/admin/cerrando' || this.path === '/admin/cerrado'; }
  get isAnuncios() { return this.path.startsWith('/admin/anuncios'); }
  get isAudios() { return this.path.startsWith('/admin/audios'); }

  get activeState(): 'abierto' | 'cerrando' | 'cerrado' {
    if (this.path === '/admin/cerrando') return 'cerrando';
    if (this.path === '/admin/cerrado') return 'cerrado';
    if (this.path === '/admin') return 'abierto';
    return this.currentState;
  }

  toggleEstadoMenu() {
    this.estadoMenuOpen = !this.estadoMenuOpen;
    if (this.estadoMenuOpen) {
      this.hourMenuOpen = false;
    }
  }

  selectState(state: 'abierto' | 'cerrando' | 'cerrado') {
    this.currentState = state;
    this.state.setEstado(state);
    this.estadoMenuOpen = false;
    if (state === 'abierto') {
      this.router.navigate(['/admin']);
    } else if (state === 'cerrando') {
      this.router.navigate(['/admin/cerrando']);
    } else if (state === 'cerrado') {
      this.router.navigate(['/admin/cerrado']);
    }
  }

  stateLabel(state: 'abierto' | 'cerrando' | 'cerrado'): string {
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

  selectHour(hour: string) {
    this.selectedHour = hour;
    this.state.setHoraCierre(hour);
    this.hourMenuOpen = false;
  }

  onSeek(event: MouseEvent) {
    const el = event.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
    this.player.seekPorcentaje(pct);
  }
}