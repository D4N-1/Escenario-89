import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/icon/icon';
import { AppState } from '../../core/app-state';

@Component({ selector: 'app-audios', imports: [Icon, RouterLink], templateUrl: './audios.html', styleUrl: '../anuncios/anuncios.css' })
export class Audios {
    state = inject(AppState);
}