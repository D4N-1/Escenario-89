export type EstadoLocal = 'abierto' | 'cerrando' | 'cerrado';
export type TipoPista = 'karaoke' | 'sencillo';
export type EstadoAnuncio = 'En cola' | 'Programado' | 'Sin usar';

export function detectarTipoCancion(song?: { title?: string; type?: string; description?: string | null } | null): TipoPista {
  if (!song) return 'sencillo';
  const t = String(song.type || '').toUpperCase();
  if (t === 'KARAOKE') return 'karaoke';
  const title = song.title || '';
  const norm = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/(karaoke|kara\b|ktv|instrumental|backing\s*track|\bpistas?\b|playback|sing[\s-]*along)/i.test(norm)) return 'karaoke';
  if (song.description && /(karaoke|backing\s*track|\bpistas?\b)/i.test(song.description)) return 'karaoke';
  return 'sencillo';
}

export interface Cancion {
  id: number;
  titulo: string;
  artista: string;
  duracion: string;           
  mesa: number;               
  tipo: TipoPista | 'anuncio';
  videoId?: string;           
  uuid?: string;               
  miniatura?: string;          
  url?: string;
}

export interface Video {
  id: string;                  
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
  segundos?: number;          
  vistasNumero?: number;        
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

export interface AnuncioProgramadoItem {
  uuid: string;
  title: string;
  image?: string;
  url?: string;
  startTime?: string;
  endTime?: string;
  everySongs?: number | null;
  current?: number;
  remainingSongs?: number;
  inTimeRange?: boolean;
  type: 'manual' | 'auto';
}

export interface ContadorAnuncio {
  uuid: string;
  title: string;
  image?: string;
  url?: string;
  current: number;
  everySongs: number;
  remainingSongs: number;
  inTimeRange: boolean;
}

export interface ScheduledIntermissionState {
  manual: AnuncioProgramadoItem | null;
  upcomingAuto: AnuncioProgramadoItem | null;
  nextBreak: AnuncioProgramadoItem | null;
  counters: ContadorAnuncio[];
}

export interface MiCancion {
  video: Video;
  posicion: number;
}