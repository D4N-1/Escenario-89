import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/icon/icon';
import { Buscador } from '../../shared/buscador/buscador';
import { AppState } from '../../core/app-state';

@Component({
  selector: 'app-panel',
  imports: [Icon, RouterLink, Buscador],
  templateUrl: './panel.html',
  styleUrl: './panel.css',
})
export class Panel {
  state = inject(AppState);
}