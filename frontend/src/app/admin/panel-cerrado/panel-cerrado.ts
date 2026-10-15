import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/icon/icon';
import { AppState } from '../../core/app-state';

@Component({
  selector: 'app-panel-cerrado',
  imports: [Icon, RouterLink],
  templateUrl: './panel-cerrado.html',
  styleUrl: './panel-cerrado.css',
})
export class PanelCerrado {
  state = inject(AppState);
}