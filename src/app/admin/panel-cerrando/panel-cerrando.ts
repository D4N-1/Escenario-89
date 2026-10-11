import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/icon/icon';

@Component({
  selector: 'app-panel-cerrando',
  imports: [Icon, RouterLink],
  templateUrl: './panel-cerrando.html',
  styleUrl: './panel-cerrando.css',
})
export class PanelCerrando {}
