export type EstadoLocal = 'abierto' | 'cerrando' | 'cerrado';
export type TipoPista = 'karaoke' | 'sencillo';
export type EstadoAnuncio = 'En cola' | 'Programado' | 'Sin usar';

export interface Cancion {
  id: number;
  titulo: string;
  artista: string;
  duracion: string;            // "5:27"
  mesa: number;                // 0 = no viene de una mesa (anuncio)
  tipo: TipoPista | 'anuncio';
  videoId?: string;            // para reproducirla en el iframe de YouTube
}

/** Resultado de búsqueda de YouTube */
export interface Video {
  id: string;                  // videoId de YouTube
  titulo: string;
  canal: string;
  vistas: string;
  antiguedad: string;
  duracion: string;
  tipo: TipoPista;
  miniatura?: string;
  miniaturaTitulo: string;
  miniaturaSub: string;
  fondo?: string;
  inicialesCanal: string;
}

export interface Anuncio {
  id: number;
  titulo: string;
  detalle: string;
  estado: EstadoAnuncio;
  programacion: string;
  duracion: string;
}

export interface AudioItem {
  id: number;
  titulo: string;
  detalle: string;
  duracion: string;
  sonando: boolean;
}

/** Canción que el cliente ya pidió y su posición en la cola */
export interface MiCancion {
  video: Video;
  posicion: number;
}