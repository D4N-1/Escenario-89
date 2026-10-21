import { Component, computed, inject, input } from '@angular/core';
import { Icon } from '../icon/icon';
import { AppState } from '../../core/app-state';
import { PlayerService } from '../../core/player.service';
import { Cancion } from '../../core/models';

@Component({
  selector: 'app-queue-panel',
  imports: [Icon],
  templateUrl: './queue-panel.html',
  styleUrl: './queue-panel.css',
})
export class QueuePanel {
  state = inject(AppState);
  player = inject(PlayerService);
  /** Muestra anuncios mezclados en la cola (vistas Anuncios / Audios) */
  showAds = input(false);

  items = computed(() => {
    const lista = [...this.state.cola()];
    if (this.showAds()) {
      const activos = this.state.anuncios().filter(a => a.estado === 'En cola');
      activos.forEach((a, i) => {
        lista.splice(i === 0 ? Math.min(4, lista.length) : lista.length, 0, {
          id: 1000 + a.id, titulo: a.titulo, artista: 'Anuncio',
          duracion: a.duracion, mesa: 0, tipo: 'anuncio',
        });
      });
    }
    return lista;
  });

  reproducirAhora(cancion: Cancion, index: number) {
    if (cancion.tipo === 'anuncio') return;
    this.state.cola.update(lista => lista.filter((_, i) => i !== index));
    this.state.sonando.set(cancion);
  }

  togglePlay() {
    this.player.togglePlay();
  }

  obtenerMiniatura(c: Cancion | null | undefined): string {
    if (!c) return '';
    if (c.miniatura) return c.miniatura;
    if (c.videoId) return `https://i.ytimg.com/vi/${c.videoId}/mqdefault.jpg`;
    return '';
  }
}