import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Icon } from '../../shared/icon/icon';
import { ClientHeader } from '../../shared/client-header/client-header';
import { VideoCard } from '../../shared/video-card/video-card';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import { AppState } from '../../core/app-state';
import { Video } from '../../core/models';
import { QueueService } from '../../core/queue.service';

@Component({
  selector: 'app-home',
  imports: [Icon, ClientHeader, VideoCard, ConfirmDialog],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  state = inject(AppState);
  router = inject(Router);
  queue = inject(QueueService);
  seleccion = signal<Video | null>(null);
  escuchandoVoz = signal(false);

  constructor() {
    // "Mis canciones" y sus posiciones salen de la cola del backend; se actualizan solas mientras esta pantalla está abierta
    this.queue.iniciarPollingMesa();
    inject(DestroyRef).onDestroy(() => this.queue.detenerPollingMesa());

    // Cargar canciones de la tabla song (las más pedidas/escuchadas en la base de datos)
    this.queue.cargarMasEscuchadas();
  }

  irABuscar(texto: string) {
    const q = texto.trim();
    if (q) this.state.busqueda.set(q);
    this.router.navigate(['/buscar']);
  }

  buscarPorVoz() {
    if (typeof window === 'undefined') return;
    const SpeechRec = (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition
      || (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRec) {
      this.router.navigate(['/buscar']);
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = 'es-ES';
      recognition.interimResults = false;
      this.escuchandoVoz.set(true);

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        this.escuchandoVoz.set(false);
        if (transcript) this.irABuscar(transcript);
      };

      recognition.onerror = () => {
        this.escuchandoVoz.set(false);
        this.router.navigate(['/buscar']);
      };

      recognition.onend = () => {
        this.escuchandoVoz.set(false);
      };

      recognition.start();
    } catch {
      this.escuchandoVoz.set(false);
      this.router.navigate(['/buscar']);
    }
  }
}