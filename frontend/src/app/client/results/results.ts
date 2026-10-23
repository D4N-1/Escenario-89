import { Component, computed, inject, signal } from '@angular/core';
import { Icon } from '../../shared/icon/icon';
import { ClientHeader } from '../../shared/client-header/client-header';
import { VideoCard } from '../../shared/video-card/video-card';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import { AppState } from '../../core/app-state';
import { YoutubeService } from '../../core/youtube.service';
import { Video } from '../../core/models';

@Component({
  selector: 'app-results',
  imports: [Icon, ClientHeader, VideoCard, ConfirmDialog],
  templateUrl: './results.html',
  styleUrl: '../home/home.css',
})
export class Results {
  state = inject(AppState);
  yt = inject(YoutubeService);

  seleccion = signal<Video | null>(null);
  resultados = signal<Video[]>([]);
  cargando = signal(false);
  error = signal('');
  filtro = signal<'todos' | 'karaoke'>('todos');
  busquedaRealizada = signal(false);

  private busquedaActual = 0; // para ignorar respuestas viejas si el cliente busca otra vez

  resultadosFiltrados = computed(() => {
    const lista = this.resultados();
    if (this.filtro() === 'karaoke') {
      return lista.filter(v => v.tipo === 'karaoke' || /karaoke/i.test(v.titulo));
    }
    return lista;
  });

  constructor() {
    const q = this.state.busqueda();
    if (q.trim()) {
      this.buscar(q);
    }
  }

  setFiltro(tipo: 'todos' | 'karaoke') {
    this.filtro.set(tipo);
    // Si filtró por karaoke y no hay ninguno en la lista actual, re-buscar con 'karaoke'
    if (tipo === 'karaoke' && this.state.busqueda().trim() && !this.resultadosFiltrados().length) {
      this.buscar(`${this.state.busqueda()} karaoke`);
    }
  }

  buscarRapido(termino: string) {
    this.buscar(termino);
  }

  async buscar(texto: string) {
    const q = texto.trim();
    if (!q) return;
    this.state.busqueda.set(q);
    this.busquedaRealizada.set(true);
    const n = ++this.busquedaActual;
    this.cargando.set(true);
    this.error.set('');
    try {
      const videos = await this.yt.buscar(q);
      if (n === this.busquedaActual) this.resultados.set(videos);
    } catch (e) {
      if (n === this.busquedaActual) {
        this.resultados.set([]);
        this.error.set(e instanceof Error ? e.message : 'No se pudo buscar. Intenta de nuevo.');
      }
    } finally {
      if (n === this.busquedaActual) this.cargando.set(false);
    }
  }
}