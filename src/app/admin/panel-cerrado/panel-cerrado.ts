import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/icon/icon';

@Component({
  selector: 'app-panel-cerrado',
  imports: [Icon, RouterLink],
  templateUrl: './panel-cerrado.html',
  styleUrl: './panel-cerrado.css',
})
export class PanelCerrado {}
