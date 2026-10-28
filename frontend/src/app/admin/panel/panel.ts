import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/icon/icon';
import { Buscador } from '../../shared/buscador/buscador';
import { AppState } from '../../core/app-state';
import { PlayerService } from '../../core/player.service';
import { YtSlot } from '../../shared/yt-player/yt-slot';

@Component({
  selector: 'app-panel',
  imports: [Icon, RouterLink, Buscador, YtSlot],
  templateUrl: './panel.html',
  styleUrl: './panel.css',
})
export class Panel {
  state = inject(AppState);
  player = inject(PlayerService);

  stateLabel(s: 'abierto' | 'cerrando' | 'cerrado'): string {
    switch (s) {
      case 'abierto': return 'Abierto';
      case 'cerrando': return 'Cerrando';
      case 'cerrado': return 'Cerrado';
    }
  }

  onStageClick(event: MouseEvent) {
    if (this.state.estado() === 'cerrado' || this.player.intermissionActual() || this.player.karaokeIntroActivo()) return;
    const target = event.target as HTMLElement;
    if (target.closest('.stage-top-actions, button, a, app-buscador')) {
      return;
    }
    if (this.player.necesitaInteraccion()) {
      this.player.desbloquearAudio();
      return;
    }
    this.player.togglePlay();
  }
}
