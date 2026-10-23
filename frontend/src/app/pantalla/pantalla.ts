import { AfterViewInit, Component, HostListener, inject, OnDestroy, OnInit } from '@angular/core';
import { AppState } from '../core/app-state';
import { PlayerService } from '../core/player.service';
import { QueueService } from '../core/queue.service';

@Component({
  selector: 'app-pantalla',
  templateUrl: './pantalla.html',
  styleUrl: './pantalla.css',
})
export class Pantalla implements OnInit, AfterViewInit, OnDestroy {
  state = inject(AppState);
  player = inject(PlayerService);
  private queue = inject(QueueService);

  @HostListener('dblclick')
  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  ngOnInit() {
    // Escucha en tiempo real la cola y la canción actual desde el backend / sockets
    this.queue.iniciarPolling();
  }

  ngAfterViewInit() {
    // Inicializado en modo 'pantalla' y silenciado al 100% (altavoces externos en el local)
    this.player.inicializar('tv-yt-player', 'pantalla', 'tv-player-container', undefined, true);
  }

  ngOnDestroy() {
    this.queue.detenerPolling();
    this.player.destruir();
  }
}


