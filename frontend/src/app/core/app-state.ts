import { Injectable, signal } from '@angular/core';
import { Anuncio, AudioItem, Cancion, EstadoLocal, MiCancion, Video } from './models';
import { ANUNCIOS, AUDIOS, COLA, SONANDO, VIDEOS } from './mock-data';

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

  // ---- Cliente (móvil) ----
  mesa = signal(0);                                   // viene del QR: /?mesa=5
  busqueda = signal('El gran varon');
  resultados = signal<Video[]>(VIDEOS.slice(0, 2));   // se reemplaza con la búsqueda de YouTube
  populares = signal<Video[]>(VIDEOS);
  misCanciones = signal<MiCancion[]>(
    USAR_MOCK ? [{ video: VIDEOS[0], posicion: 1 }, { video: VIDEOS[2], posicion: 5 }] : [],
  );
  cancionSeleccionada = signal<Video>(VIDEOS[0]);
  posicionEnCola = signal(1);

  /**
   * Agrega una canción elegida por un cliente.
   * Si no hay nada sonando, pasa directo a "sonando". Devuelve su posición (0 = suena ahora).
   */
  agregarACola(video: Video, mesa = 0): number {
    const nueva: Cancion = {
      id: Date.now(),
      titulo: video.titulo,
      artista: video.canal,
      duracion: video.duracion,
      mesa,
      tipo: video.tipo,
      videoId: video.id,
      miniatura: video.miniatura || (video.id ? `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg` : undefined),
    };
    if (!this.sonando()) {
      this.sonando.set(nueva);
      return 0;
    }
    this.cola.update(lista => [...lista, nueva]);
    return this.cola().length;
  }
}