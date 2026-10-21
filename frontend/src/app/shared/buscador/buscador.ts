import { Component, HostListener, inject, signal } from '@angular/core';
import { Icon } from '../icon/icon';
import { AppState } from '../../core/app-state';
import { YoutubeService } from '../../core/youtube.service';
import { Video } from '../../core/models';
import { PlayerService } from '../../core/player.service';

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
  player = inject(PlayerService);

  consulta = signal('');
  ultima = signal('');
  resultados = signal<Video[]>([]);
  cargando = signal(false);
  error = signal('');
  abierto = signal(false);

  onInput(e: Event) { this.consulta.set((e.target as HTMLInputElement).value); }

  async buscar() {
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

  agregar(v: Video) {
    this.state.agregarACola(v);
    this.cerrar();
    this.consulta.set('');
  }

  @HostListener('document:keydown.escape')
  cerrar() { this.abierto.set(false); }
}