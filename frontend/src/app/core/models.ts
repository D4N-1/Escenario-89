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
  uuid?: string;               // identificador del elemento en la cola del backend
  miniatura?: string;          // imagen de portada / miniatura de YouTube
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
  segundos?: number;           // duración en segundos (para guardarla en el backend)
  vistasNumero?: number;       // vistas sin formatear (para guardarlas en el backend)
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
  uuid?: string;
  titulo: string;
  detalle: string;
  duracion: string;
  sonando: boolean;
  url?: string;
}

export interface AudioEntity {
  id?: number;
  uuid: string;
  title: string;
  description?: string | null;
  url: string;
  createdAt?: string;
  updatedAt?: string;
}


export interface IntermissionItem {
  id?: number;
  uuid: string;
  title: string;
  description?: string;
  image: string;
  url: string;
  active: boolean;
  startTime: string;
  endTime: string;
  everySongs?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Canción que el cliente ya pidió y su posición en la cola */
export interface MiCancion {
  video: Video;
  posicion: number;
}