import { Component, inject } from '@angular/core';
import { Icon } from '../../shared/icon/icon';
import { AppState } from '../../core/app-state';
import { PlayerService } from '../../core/player.service';

@Component({
  selector: 'app-panel-cerrando',
  imports: [Icon],
  templateUrl: './panel-cerrando.html',
  styleUrl: './panel-cerrando.css',
})
export class PanelCerrando {
  state = inject(AppState);
  player = inject(PlayerService);

  duplicarTv() {
    this.player.duplicarEnTv();
  }
}