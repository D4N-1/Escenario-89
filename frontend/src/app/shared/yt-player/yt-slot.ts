import { Directive, ElementRef, Injectable, OnDestroy, OnInit, inject, signal } from '@angular/core';

/** Recuadro del panel sobre el que se muestra el video. */
@Injectable({ providedIn: 'root' })
export class PlayerSlot {
  elemento = signal<HTMLElement | null>(null);
}

/**
 * Marca el recuadro de un panel donde debe verse el video.
 * Uso: <div class="video" ytSlot></div>
 * El reproductor vive en el layout (así la música no se corta al cambiar de página)
 * y se coloca encima de este recuadro.
 */
@Directive({ selector: '[ytSlot]' })
export class YtSlot implements OnInit, OnDestroy {
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private slot = inject(PlayerSlot);

  ngOnInit() { this.slot.elemento.set(this.el.nativeElement); }
  ngOnDestroy() { if (this.slot.elemento() === this.el.nativeElement) this.slot.elemento.set(null); }
}