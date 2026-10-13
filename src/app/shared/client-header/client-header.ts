import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../icon/icon';
import { AppState } from '../../core/app-state';

/** Cabecera de las vistas móviles del cliente. `atras` = ruta a la que vuelve (si no hay, no muestra botones). */
@Component({
    selector: 'app-client-header',
    imports: [Icon, RouterLink],
    templateUrl: './client-header.html',
    styleUrl: './client-header.css',
})
export class ClientHeader {
    state = inject(AppState);
    atras = input<string | null>(null);
}