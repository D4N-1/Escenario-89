import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/icon/icon';

@Component({ selector: 'app-home', imports: [Icon, RouterLink], templateUrl: './home.html', styleUrl: './home.css' })
export class Home {
  popular = [1, 2, 3];
}
