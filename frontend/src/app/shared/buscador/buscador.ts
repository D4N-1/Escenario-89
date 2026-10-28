import { Component, DestroyRef, HostListener, computed, effect, inject, signal } from '@angular/core';
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
  private destroyRef = inject(DestroyRef);

  consulta = signal('');
  ultima = signal('');
  resultados = signal<Video[]>([]);
  cargando = signal(false);
  error = signal('');
  abierto = signal(false);
  escuchandoVoz = signal(false);

  bloqueado = computed(() => this.state.estado() === 'cerrado' || this.state.estado() === 'cerrando');

  private recognition: any = null;
  private debounceTimer: any = null;
  private requestId = 0;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.detenerVoz();
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
    });

    effect(() => {
      if (this.bloqueado()) {
        this.detenerVoz();
        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer);
          this.debounceTimer = null;
        }
        this.abierto.set(false);
      }
    });
  }

  onInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    this.consulta.set(val);

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    const q = val.trim();
    if (!q) {
      this.abierto.set(false);
      this.cargando.set(false);
      this.resultados.set([]);
      this.error.set('');
      return;
    }

    // Apenas empieza a escribir: mostrar modal de resultados vacío por feedback inmediato
    this.abierto.set(true);
    this.cargando.set(true);
    this.error.set('');

    if (this.ultima() !== q) {
      this.resultados.set([]);
    }

    // Debounce: realizar la búsqueda GET automáticamente tras 380ms de pausa al escribir
    this.debounceTimer = setTimeout(() => {
      this.ejecutarBusqueda(q);
    }, 380);
  }

  async buscar() {
    this.detenerVoz();
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    const q = this.consulta().trim();
    if (!q) return;
    await this.ejecutarBusqueda(q);
  }

  private async ejecutarBusqueda(q: string) {
    if (this.bloqueado()) {
      this.error.set(this.state.estado() === 'cerrado'
        ? 'El local está cerrado. No se pueden pedir canciones.'
        : 'El local está cerrando. Solo se reproducen las canciones que ya están en cola.');
      return;
    }

    const currentReq = ++this.requestId;
    this.abierto.set(true);
    this.cargando.set(true);
    this.error.set('');

    try {
      const res = await this.yt.buscar(q);
      if (currentReq !== this.requestId || !this.abierto()) return;
      this.resultados.set(res);
      this.ultima.set(q);
    } catch (e) {
      if (currentReq !== this.requestId || !this.abierto()) return;
      this.resultados.set([]);
      this.error.set(e instanceof Error ? e.message : 'Error al buscar');
    } finally {
      if (currentReq === this.requestId) {
        this.cargando.set(false);
      }
    }
  }

  buscarPorVoz() {
    if (this.bloqueado()) return;

    if (this.escuchandoVoz()) {
      this.detenerVoz();
      return;
    }

    if (typeof window === 'undefined') return;

    const SpeechRec = (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition
      || (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRec) {
      this.error.set('Tu navegador no es compatible con la búsqueda por voz (usa Google Chrome o Microsoft Edge).');
      this.abierto.set(true);
      return;
    }

    try {
      this.detenerVoz();
      const rec = new SpeechRec();
      rec.lang = 'es-ES';
      rec.interimResults = false;
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        this.escuchandoVoz.set(true);
      };

      rec.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        this.escuchandoVoz.set(false);
        if (transcript) {
          this.consulta.set(transcript);
          this.buscar();
        }
      };

      rec.onerror = (event: any) => {
        this.escuchandoVoz.set(false);
        const err = event.error;
        if (err === 'not-allowed') {
          this.error.set('Permiso de micrófono denegado. Permite el acceso al micrófono en tu navegador.');
          this.abierto.set(true);
        } else if (err === 'audio-capture') {
          this.error.set('No se detectó ningún micrófono en tu dispositivo.');
          this.abierto.set(true);
        } else if (err === 'network') {
          this.error.set('Error de red al procesar el reconocimiento de voz.');
          this.abierto.set(true);
        }
      };

      rec.onend = () => {
        this.escuchandoVoz.set(false);
        this.recognition = null;
      };

      this.recognition = rec;
      rec.start();
    } catch {
      this.escuchandoVoz.set(false);
      this.recognition = null;
      this.error.set('No se pudo iniciar el reconocimiento de voz.');
      this.abierto.set(true);
    }
  }

  detenerVoz() {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {}
      this.recognition = null;
    }
    this.escuchandoVoz.set(false);
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
  cerrar() {
    this.detenerVoz();
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.abierto.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.abierto()) return;
    const target = event.target as HTMLElement;
    if (!target.closest('app-buscador')) {
      this.cerrar();
    }
  }
}