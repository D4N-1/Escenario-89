import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/icon/icon';

@Component({
  selector: 'app-panel',
  imports: [Icon, RouterLink],
  templateUrl: './panel.html',
  styleUrl: './panel.css',
})
export class Panel {}
