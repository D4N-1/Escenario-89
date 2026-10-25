import { AfterViewInit, Component, HostListener, inject, OnDestroy, OnInit } from '@angular/core';
import { AppState } from '../core/app-state';
import { BarService } from '../core/bar.service';
import { PlayerService } from '../core/player.service';
import { QueueService } from '../core/queue.service';

@Component({
  selector: 'app-pantalla',
  templateUrl: './pantalla.html',
  styleUrl: './pantalla.css',
})
export class Pantalla implements OnInit, AfterViewInit, OnDestroy {
  state = inject(AppState);
  bar = inject(BarService);
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
    this.bar.iniciarSincronizacion();
    this.queue.iniciarPolling();
  }

  ngAfterViewInit() {
    this.player.inicializar('tv-yt-player', 'pantalla', 'tv-player-container', undefined, true);
  }

  ngOnDestroy() {
    this.bar.detenerSincronizacion();
    this.queue.detenerPolling();
    this.player.destruir();
  }
}


