import { AfterViewInit, Component, HostListener, inject, OnDestroy } from '@angular/core';
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

  @HostListener('window:click')
  @HostListener('window:keydown')
  onInteraccionUsuario() {
    if (this.player.necesitaInteraccion()) {
      this.desbloquearAudio();
    }
  }

  ngAfterViewInit() {
    this.player.inicializar('tv-yt-player', 'pantalla', 'tv-player-container', undefined, false);
  }

  desbloquearAudio(event?: Event) {
    if (event) event.stopPropagation();
    this.player.desbloquearAudio();
  }

  ngOnDestroy() {
    this.player.destruir();
  }
}
