import { AfterViewInit, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/icon/icon';
import { Buscador } from '../../shared/buscador/buscador';
import { AppState } from '../../core/app-state';
import { PlayerService } from '../../core/player.service';

@Component({
  selector: 'app-panel',
  imports: [Icon, RouterLink, Buscador],
  templateUrl: './panel.html',
  styleUrl: './panel.css',
})
export class Panel implements AfterViewInit {
  state = inject(AppState);
  player = inject(PlayerService);

  ngAfterViewInit() {
    this.player.inicializar('admin-yt-player', 'admin', 'admin-player-container');
  }

  toggleFullscreen() {
    const videoEl = document.querySelector('.video') as HTMLElement;
    if (!videoEl) return;
    if (!document.fullscreenElement) {
      videoEl.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  onStageClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.closest('.stage-top-actions, .stage-overlay, button, a, app-buscador')) {
      return;
    }
    this.player.togglePlay();
  }
}