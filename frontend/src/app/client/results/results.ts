import { Component, inject, OnDestroy, signal } from '@angular/core';
import { Icon } from '../../shared/icon/icon';
import { ClientHeader } from '../../shared/client-header/client-header';
import { VideoCard } from '../../shared/video-card/video-card';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import { ClientFooter } from '../../shared/client-footer/client-footer';
import { AppState } from '../../core/app-state';
import { YoutubeService } from '../../core/youtube.service';
import { Video } from '../../core/models';

@Component({
  selector: 'app-results',
  imports: [Icon, ClientHeader, VideoCard, ConfirmDialog, ClientFooter],
  templateUrl: './results.html',
  styleUrl: '../home/home.css',
})
export class Results implements OnDestroy {
  state = inject(AppState);
  yt = inject(YoutubeService);

  seleccion = signal<Video | null>(null);
  resultados = signal<Video[]>([]);
  cargando = signal(false);
  error = signal('');
  busquedaRealizada = signal(false);

  private busquedaActual = 0; // para ignorar respuestas viejas si el cliente busca otra vez
  private debounceTimer: any = null;

  constructor() {
    const q = this.state.busqueda();
    if (q.trim() && this.state.estado() !== 'cerrado' && this.state.estado() !== 'cerrando') {
      this.ejecutarBusqueda(q.trim());
    }
  }

  ngOnDestroy() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  seleccionar(v: Video) {
    if (this.state.estado() === 'cerrado') {
      this.error.set('El local está cerrado. No se pueden pedir canciones.');
      return;
    }
    if (this.state.estado() === 'cerrando') {
      this.error.set('El local está cerrando. Solo se reproducen las canciones que ya están en cola.');
      return;
    }
    this.seleccion.set(v);
  }

  buscarRapido(termino: string) {
    if (this.state.estado() === 'cerrado' || this.state.estado() === 'cerrando') return;
    this.buscar(termino);
  }

  onInput(e: Event) {
    if (this.state.estado() === 'cerrado' || this.state.estado() === 'cerrando') return;
    const input = e.target as HTMLInputElement;
    const val = input.value;
    this.state.busqueda.set(val);

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    const q = val.trim();
    if (!q) {
      this.busquedaRealizada.set(false);
      this.cargando.set(false);
      this.resultados.set([]);
      this.error.set('');
      return;
    }

    // Feedback inmediato: activar visualización de carga
    this.busquedaRealizada.set(true);
    this.cargando.set(true);
    this.error.set('');

    this.debounceTimer = setTimeout(() => {
      this.ejecutarBusqueda(q);
    }, 380);
  }

  async buscar(texto?: string) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    const q = (texto !== undefined ? texto : this.state.busqueda()).trim();
    if (!q) return;
    await this.ejecutarBusqueda(q);
  }

  private async ejecutarBusqueda(q: string) {
    if (this.state.estado() === 'cerrado' || this.state.estado() === 'cerrando') {
      this.error.set(this.state.estado() === 'cerrado'
        ? 'El local está cerrado. No se pueden pedir canciones.'
        : 'El local está cerrando. Solo se reproducen las canciones que ya están en cola.');
      this.cargando.set(false);
      return;
    }

    this.state.busqueda.set(q);
    this.busquedaRealizada.set(true);
    const n = ++this.busquedaActual;
    this.cargando.set(true);
    this.error.set('');

    try {
      const videos = await this.yt.buscar(q);
      if (n === this.busquedaActual) {
        this.resultados.set(videos);
      }
    } catch (e) {
      if (n === this.busquedaActual) {
        this.resultados.set([]);
        this.error.set(e instanceof Error ? e.message : 'No se pudo buscar. Intenta de nuevo.');
      }
    } finally {
      if (n === this.busquedaActual) {
        this.cargando.set(false);
      }
    }
  }

  limpiar(input: HTMLInputElement) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    input.value = '';
    this.state.busqueda.set('');
    this.busquedaRealizada.set(false);
    this.cargando.set(false);
    this.resultados.set([]);
    this.error.set('');
    input.focus();
  }
}
