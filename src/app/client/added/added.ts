import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/icon/icon';

@Component({ selector: 'app-added', imports: [Icon, RouterLink], templateUrl: './added.html', styleUrl: '../home/home.css' })
export class Added {}
