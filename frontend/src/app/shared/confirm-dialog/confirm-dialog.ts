import { Component, HostListener, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import { Icon } from '../icon/icon';
import { AppState } from '../../core/app-state';
import { Video } from '../../core/models';

/** Popup móvil "¿Pedir canción?" — se muestra encima de la vista actual. */
@Component({
  selector: 'app-confirm-dialog',
  imports: [Icon],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.css',
})
export class ConfirmDialog {
  state = inject(AppState);
  router = inject(Router);

  /** Canción elegida (null en la ruta /confirmar de ejemplo) */
  video = input<Video | null>(null);
  cerrar = output<void>();

  confirmar() {
    const v = this.video();
    if (v) {
      const posicion = this.state.agregarACola(v, this.state.mesa());
      this.state.cancionSeleccionada.set(v);
      this.state.posicionEnCola.set(posicion);
      this.state.misCanciones.update(lista => [{ video: v, posicion }, ...lista]);
    }
    this.router.navigate(['/agregado']);
  }

  @HostListener('document:keydown.escape')
  onEscape() { this.cerrar.emit(); }
}