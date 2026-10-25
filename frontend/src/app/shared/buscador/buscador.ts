import { Component, HostListener, inject, signal } from '@angular/core';
import { Icon } from '../icon/icon';
import { AppState } from '../../core/app-state';
import { YoutubeService } from '../../core/youtube.service';
import { Video } from '../../core/models';
import { QueueService } from '../../core/queue.service';

/** Buscador de canciones estilo YouTube (lista de varios resultados) */
@Component({
  selector: 'app-buscador',
  imports: [Icon],
  templateUrl: './buscador.html',
  styleUrl: './buscador.css',
})
export class Buscador {
  state = inject(AppState);
  yt = inject(YoutubeService);
  queue = inject(QueueService);

  consulta = signal('');
  ultima = signal('');
  resultados = signal<Video[]>([]);
  cargando = signal(false);
  error = signal('');
  abierto = signal(false);

  onInput(e: Event) { this.consulta.set((e.target as HTMLInputElement).value); }

  async buscar() {
    if (this.state.estado() === 'cerrado') {
      this.error.set('El local está cerrado. No se pueden pedir canciones.');
      return;
    }
    const q = this.consulta().trim();
    if (!q) return;
    this.ultima.set(q);
    this.abierto.set(true);
    this.cargando.set(true);
    this.error.set('');
    try {
      this.resultados.set(await this.yt.buscar(q));
    } catch (e) {
      this.resultados.set([]);
      this.error.set(e instanceof Error ? e.message : 'Error al buscar');
    } finally {
      this.cargando.set(false);
    }
  }

  /** El admin agrega la canción a la cola del backend */
  async agregar(v: Video) {
    if (this.state.estado() === 'cerrado') {
      this.error.set('El local está cerrado. No se pueden pedir canciones.');
      return;
    }
    if (this.state.estado() === 'cerrando') {
      this.error.set('El local está cerrando. Solo se reproducen las canciones que ya están en cola.');
      return;
    }
    try {
      await this.queue.agregar(v, 'admin');
      this.cerrar();
      this.consulta.set('');
    } catch (e) {
      this.resultados.set([]);
      this.error.set(e instanceof Error ? e.message : 'No se pudo agregar la canción.');
    }
  }

  @HostListener('document:keydown.escape')
  cerrar() { this.abierto.set(false); }
}