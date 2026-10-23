import { Component, computed, inject, input, signal } from '@angular/core';
import { Icon } from '../icon/icon';
import { AppState } from '../../core/app-state';
import { PlayerService } from '../../core/player.service';
import { QueueService } from '../../core/queue.service';
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
  queue = inject(QueueService);
  /** Muestra anuncios mezclados en la cola (vistas Anuncios / Audios) */
  showAds = input(false);

  /** uuid de la canción que se está arrastrando y de la fila sobre la que está */
  arrastrando = signal<string | null>(null);
  sobre = signal<string | null>(null);
  error = signal('');

  items = computed(() => this.state.cola());

  reproducirAhora(cancion: Cancion, index: number) {
    if (cancion.tipo === 'anuncio') return;
    this.state.cola.update(lista => lista.filter((_, i) => i !== index));
    this.state.sonando.set(cancion);
    if (cancion.uuid) {
      this.queue.reproducirAhora(cancion.uuid).catch(() => {});
    }
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

  indice(c: Cancion): number {
    return c.uuid ? this.state.cola().findIndex(x => x.uuid === c.uuid) : -1;
  }

  esUltima(c: Cancion): boolean {
    return this.indice(c) === this.state.cola().length - 1;
  }

  subir(c: Cancion, e: Event) {
    e.stopPropagation();
    const i = this.indice(c);
    if (i > 0) this.mover(c.uuid!, i - 1);
  }

  bajar(c: Cancion, e: Event) {
    e.stopPropagation();
    const i = this.indice(c);
    if (i >= 0 && i < this.state.cola().length - 1) this.mover(c.uuid!, i + 1);
  }

  quitar(c: Cancion, e: Event) {
    e.stopPropagation();
    if (!c.uuid) return;
    this.error.set('');
    this.queue.quitar(c.uuid).catch(err => this.fallo(err));
  }

  alArrastrar(c: Cancion, e: DragEvent) {
    if (!c.uuid) return;
    this.arrastrando.set(c.uuid);
    e.dataTransfer?.setData('text/plain', c.uuid);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }

  alPasarSobre(c: Cancion, e: DragEvent) {
    if (!this.arrastrando() || !c.uuid) return;
    e.preventDefault(); // permite soltar aquí
    if (this.sobre() !== c.uuid) this.sobre.set(c.uuid);
  }

  alSoltar(c: Cancion, e: DragEvent) {
    e.preventDefault();
    const origen = this.arrastrando();
    this.terminarArrastre();
    const destino = this.indice(c);
    if (origen && destino >= 0) this.mover(origen, destino);
  }

  terminarArrastre() {
    this.arrastrando.set(null);
    this.sobre.set(null);
  }

  private mover(uuid: string, indiceDestino: number) {
    this.error.set('');
    this.queue.mover(uuid, indiceDestino).catch(err => this.fallo(err));
  }

  private fallo(err: unknown) {
    this.error.set(err instanceof Error ? err.message : 'No se pudo cambiar la cola.');
  }
}