import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Icon } from '../../shared/icon/icon';
import { ADS } from '../../mock-data';

@Component({ selector: 'app-anuncios', imports: [Icon, RouterLink], templateUrl: './anuncios.html', styleUrl: './anuncios.css' })
export class Anuncios {
  ads = ADS;
  /** true cuando la ruta es /admin/anuncios/nuevo (muestra el modal) */
  modal = !!inject(ActivatedRoute).snapshot.data['modal'];
  chip(e: string) { return e === 'En cola' ? 'ok' : e === 'Programado' ? 'warn' : 'off'; }
}
