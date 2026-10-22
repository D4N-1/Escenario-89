import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Icon } from '../../shared/icon/icon';
import { ClientHeader } from '../../shared/client-header/client-header';
import { VideoCard } from '../../shared/video-card/video-card';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import { AppState } from '../../core/app-state';
import { Video } from '../../core/models';
import { SessionService } from '../../core/session.service';

@Component({
  selector: 'app-home',
  imports: [Icon, RouterLink, ClientHeader, VideoCard, ConfirmDialog],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  state = inject(AppState);
  router = inject(Router);
  session = inject(SessionService);
  seleccion = signal<Video | null>(null);
  errorMesa = signal('');

  constructor() {
    // El QR de cada mesa abre /?mesa=CODIGO (el código de 6 caracteres de la mesa)
    const mesa = inject(ActivatedRoute).snapshot.queryParamMap.get('mesa')?.trim();
    if (mesa) {
      this.session.entrarMesa(mesa).catch((e) => {
        this.errorMesa.set(e instanceof Error ? e.message : 'No reconocemos esa mesa. Escanea de nuevo el QR.');
      });
    }
  }

  irABuscar(texto: string) {
    const q = texto.trim();
    if (q) this.state.busqueda.set(q);
    this.router.navigate(['/buscar']);
  }
}