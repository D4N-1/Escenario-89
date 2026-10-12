import { Injectable, signal } from '@angular/core';
import { Anuncio, AudioItem, Cancion, EstadoLocal, Video } from './models';
import { ANUNCIOS, AUDIOS, COLA, SONANDO } from './mock-data';

/** true = arranca con datos de ejemplo; false = todo vacío (producción) */
const USAR_MOCK = false;

@Injectable({ providedIn: 'root' })
export class AppState {
  nombreLocal = signal('Escenario 89');
  hora = signal('5:33 p. m.');
  estado = signal<EstadoLocal>('abierto');
  horaCierre = signal('3:00 am');

  // Reproductor
  sonando = signal<Cancion | null>(USAR_MOCK ? SONANDO : null);
  reproduciendo = signal(false);
  tiempoActual = signal('0:00');

  // Listas
  cola = signal<Cancion[]>(USAR_MOCK ? COLA : []);
  anuncios = signal<Anuncio[]>(USAR_MOCK ? ANUNCIOS : []);
  audios = signal<AudioItem[]>(USAR_MOCK ? AUDIOS : []);

  /** Agrega una canción elegida por un cliente al final de la cola. Devuelve su posición. */
   agregarACola(video: Video, mesa = 0): number {
    const nueva: Cancion = {
      id: Date.now(),
      titulo: video.titulo,
      artista: video.canal,
      duracion: video.duracion,
      mesa,
      tipo: video.tipo,
      videoId: video.id,
    };
    if (!this.sonando()) {
      this.sonando.set(nueva);
      return 0;
    }
    this.cola.update(lista => [...lista, nueva]);
    return this.cola().length;
  }
}