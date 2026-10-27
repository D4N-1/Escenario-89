import { Component, inject } from '@angular/core';
import { Icon } from '../../shared/icon/icon';
import { AppState } from '../../core/app-state';
import { PlayerService } from '../../core/player.service';

@Component({
  selector: 'app-panel-cerrado',
  imports: [Icon],
  templateUrl: './panel-cerrado.html',
  styleUrl: './panel-cerrado.css',
})
export class PanelCerrado {
  state = inject(AppState);
  player = inject(PlayerService);

  duplicarTv() {
    this.player.duplicarEnTv();
  }
}