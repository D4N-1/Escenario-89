import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/icon/icon';
import { AppState } from '../../core/app-state';

@Component({
  selector: 'app-panel-cerrando',
  imports: [Icon, RouterLink],
  templateUrl: './panel-cerrando.html',
  styleUrl: './panel-cerrando.css',
})
export class PanelCerrando {
  state = inject(AppState);
}