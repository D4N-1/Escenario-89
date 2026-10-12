import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Icon } from '../../shared/icon/icon';
import { AppState } from '../../core/app-state';
import { EstadoAnuncio } from '../../core/models';

@Component({ selector: 'app-anuncios', imports: [Icon, RouterLink], templateUrl: './anuncios.html', styleUrl: './anuncios.css' })
export class Anuncios {
  state = inject(AppState);
  /** true cuando la ruta es /admin/anuncios/nuevo (muestra el modal) */
  modal = !!inject(ActivatedRoute).snapshot.data['modal'];

  get enCola() { return this.state.anuncios().filter(a => a.estado === 'En cola').length; }
  get programados() { return this.state.anuncios().filter(a => a.estado === 'Programado').length; }

  chip(e: EstadoAnuncio) { return e === 'En cola' ? 'ok' : e === 'Programado' ? 'warn' : 'off'; }
}