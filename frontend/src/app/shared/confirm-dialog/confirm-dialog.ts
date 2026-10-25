import { Component, HostListener, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Icon } from '../icon/icon';
import { AppState } from '../../core/app-state';
import { Video } from '../../core/models';
import { QueueService } from '../../core/queue.service';

/** Popup móvil "¿Pedir canción?" — se muestra encima de la vista actual. */
@Component({
  selector: 'app-confirm-dialog',
  imports: [Icon],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.css',
})
export class ConfirmDialog {
  state = inject(AppState);
  queue = inject(QueueService);
  router = inject(Router);

  /** Canción elegida (null en la ruta /confirmar de ejemplo) */
  video = input<Video | null>(null);
  cerrar = output<void>();

  enviando = signal(false);
  error = signal('');

  async confirmar() {
    if (this.state.estado() === 'cerrado') {
      this.error.set('El local está cerrado. No se pueden pedir canciones.');
      return;
    }
    if (this.state.estado() === 'cerrando') {
      this.error.set('El local está cerrando. Solo se reproducen las canciones que ya están en cola.');
      return;
    }

    const v = this.video();
    if (!v) {
      this.router.navigate(['/agregado']);
      return;
    }

    this.enviando.set(true);
    this.error.set('');
    try {
      // La cola vive en el backend; el admin la ve y la reproduce desde su panel
      const { posicion } = await this.queue.agregar(v, 'mesa');
      this.state.cancionSeleccionada.set(v);
      this.state.posicionEnCola.set(posicion);
      this.state.misCanciones.update(lista => [{ video: v, posicion }, ...lista]);
      this.router.navigate(['/agregado']);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo pedir la canción. Intenta de nuevo.');
    } finally {
      this.enviando.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape() { this.cerrar.emit(); }
}