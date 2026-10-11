import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/icon/icon';

@Component({ selector: 'app-results', imports: [Icon, RouterLink], templateUrl: './results.html', styleUrl: '../home/home.css' })
export class Results {}
