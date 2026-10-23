import { AfterViewInit, Component, inject, OnDestroy } from '@angular/core';
import { AppState } from '../core/app-state';
import { PlayerService } from '../core/player.service';

@Component({
  selector: 'app-pantalla',
  templateUrl: './pantalla.html',
  styleUrl: './pantalla.css',
})
export class Pantalla implements AfterViewInit, OnDestroy {
  state = inject(AppState);
  player = inject(PlayerService);

  ngAfterViewInit() {
    this.player.inicializar('tv-yt-player', 'pantalla', 'tv-player-container', undefined, false);
  }

  ngOnDestroy() {
    this.player.destruir();
  }
}

