import { Injectable, computed, signal } from '@angular/core';
import { Anuncio, AudioItem, Cancion, EstadoLocal, MiCancion, Video } from './models';
import { ANUNCIOS, AUDIOS, COLA, SONANDO, VIDEOS } from './mock-data';

function leerStorage<T>(clave: string, def: T): T {
  try {
    const v = localStorage.getItem(clave);
    return v ? (JSON.parse(v) as T) : def;
  } catch {
    return def;
  }
}

function guardarStorage(clave: string, valor: any) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {}
}

function obtenerHoraActual(): string {
  try {
    return new Date().toLocaleTimeString('es', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    const d = new Date();
    let h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'p. m.' : 'a. m.';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  }
}

/** true = arranca con datos de ejemplo; false = todo vacío (producción) */
const USAR_MOCK = false;

@Injectable({ providedIn: 'root' })
export class AppState {
  nombreLocal = signal('Escenario 89');
  hora = signal(obtenerHoraActual());
  horaPartes = computed(() => {
    const raw = this.hora();
    const match = raw.match(/^(\d{1,2}):(\d{2})(.*)$/);
    if (!match) return { hora: raw, minuto: '', ampm: '' };
    return {
      hora: match[1],
      minuto: match[2],
      ampm: match[3]?.trim() || '',
    };
  });
  estado = signal<EstadoLocal>(leerStorage<EstadoLocal>('e89_estado_local', 'abierto'));
  horaCierre = signal<string>(leerStorage<string>('e89_hora_cierre', '3:00 am'));

  constructor() {
    if (typeof window !== 'undefined') {
      const ahora = new Date();
      // Milisegundos exactos que faltan para el segundo :00 del siguiente minuto
      const msHastaSiguienteMinuto = (60 - ahora.getSeconds()) * 1000 - ahora.getMilliseconds();

      setInterval(() => {
        const nueva = obtenerHoraActual();
        if (nueva !== this.hora()) {
          this.hora.set(nueva);
        }
      }, 1000);
    }
  }

  setEstado(nuevo: EstadoLocal) {
    this.estado.set(nuevo);
    guardarStorage('e89_estado_local', nuevo);
  }

  setHoraCierre(nueva: string) {
    this.horaCierre.set(nueva);
    guardarStorage('e89_hora_cierre', nueva);
  }

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
  busqueda = signal('');
  resultados = signal<Video[]>([]);                   // se llena con la búsqueda de YouTube
  populares = signal<Video[]>([]);
  misCanciones = signal<MiCancion[]>([]);
  cancionSeleccionada = signal<Video | null>(null);
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