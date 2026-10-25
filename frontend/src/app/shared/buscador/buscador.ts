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

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.detenerVoz();
    });

    effect(() => {
      if (this.bloqueado()) {
        this.detenerVoz();
        this.abierto.set(false);
      }
    });
  }

  onInput(e: Event) { this.consulta.set((e.target as HTMLInputElement).value); }

  async buscar() {
    this.detenerVoz();
    if (this.bloqueado()) {
      this.error.set(this.state.estado() === 'cerrado'
        ? 'El local está cerrado. No se pueden pedir canciones.'
        : 'El local está cerrando. Solo se reproducen las canciones que ya están en cola.');
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
    this.abierto.set(false);
  }
}