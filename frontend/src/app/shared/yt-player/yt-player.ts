import { AfterViewInit, Component, OnDestroy, effect, inject, signal } from '@angular/core';
import { AppState } from '../../core/app-state';
import { PlayerService } from '../../core/player.service';
import { Icon } from '../icon/icon';
import { PlayerSlot } from './yt-slot';

interface Caja { top: number; left: number; width: number; height: number; clip: string; }

/**
 * Contenedor del reproductor de YouTube del admin. Se monta una sola vez en el layout:
 * - En el panel principal se coloca encima del recuadro [ytSlot].
 * - En las demás páginas (Anuncios, Audios) queda como mini reproductor y la música no se corta.
 */
@Component({
  selector: 'app-yt-player',
  imports: [Icon],
  templateUrl: './yt-player.html',
  styleUrl: './yt-player.css',
})
export class YtPlayer implements AfterViewInit, OnDestroy {
  state = inject(AppState);
  player = inject(PlayerService);
  private slot = inject(PlayerSlot);

  caja = signal<Caja | null>(null);

  private observador = new ResizeObserver(() => this.medir());
  private observado: HTMLElement | null = null;
  private alMedir = () => this.medir();

  constructor() {
    effect(() => {
      const el = this.slot.elemento();
      if (this.observado) this.observador.unobserve(this.observado);
      this.observado = el;
      if (el) this.observador.observe(el);
      this.medir();
    });
    window.addEventListener('resize', this.alMedir);
    document.addEventListener('scroll', this.alMedir, { capture: true, passive: true });
  }

  ngAfterViewInit() {
    this.player.inicializar('admin-yt-player', 'admin', 'admin-yt-wrapper');
  }

  ngOnDestroy() {
    this.observador.disconnect();
    window.removeEventListener('resize', this.alMedir);
    document.removeEventListener('scroll', this.alMedir, { capture: true } as EventListenerOptions);
  }

  saltarAnuncio(event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.player.saltarIntermission();
  }

  /** Posición del recuadro; se recorta a la zona visible de .main para que no se salga al hacer scroll. */
  private medir() {
    const el = this.observado;
    if (!el) { this.caja.set(null); return; }
    const r = el.getBoundingClientRect();
    const zona = el.closest('.main')?.getBoundingClientRect();
    const arriba = zona ? Math.max(0, zona.top - r.top) : 0;
    const abajo = zona ? Math.max(0, r.bottom - zona.bottom) : 0;
    const izq = zona ? Math.max(0, zona.left - r.left) : 0;
    const der = zona ? Math.max(0, r.right - zona.right) : 0;
    this.caja.set({
      top: r.top, left: r.left, width: r.width, height: r.height,
      clip: `inset(${arriba}px ${der}px ${abajo}px ${izq}px round 12px)`,
    });
  }
}