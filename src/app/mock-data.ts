// Datos de ejemplo SOLO para maquetar. Se reemplazan cuando haya funcionalidad.
export interface QueueItem { title: string; artist: string; dur: string; mesa: number; karaoke?: boolean; ad?: boolean; }

export const NOW_PLAYING: QueueItem = { title: 'El gran varón', artist: 'Willie Colón', dur: '7:23', mesa: 2 };

export const QUEUE: QueueItem[] = [
  { title: 'Incomprendido', karaoke: true, artist: 'Ismael Rivera', dur: '2:57', mesa: 4 },
  { title: 'El Día De Mi Suerte', artist: 'Willie Colón · Héctor Lavoe', dur: '5:27', mesa: 3 },
  { title: 'Amores Como el Nuestro', artist: 'Jerry Rivera', dur: '5:04', mesa: 7 },
  { title: 'Llorarás (Visualizer)', artist: "Oscar D'León", dur: '3:42', mesa: 9 },
  { title: 'Fabricando Fantasías', artist: 'Tito Nieves', dur: '4:35', mesa: 1 },
  { title: 'Yo no sé mañana', karaoke: true, artist: 'Luis Enrique', dur: '4:26', mesa: 5 },
  { title: 'Oh Qué Será', artist: 'Willie Colón', dur: '5:04', mesa: 6 },
  { title: 'Se acabó el amor', artist: "Adolescent's Orquesta", dur: '4:05', mesa: 9 },
  { title: 'Gotas De Lluvia', artist: 'Grupo Niche', dur: '5:37', mesa: 9 },
];

export interface Ad { title: string; sub: string; estado: 'En cola' | 'Programado' | 'Sin usar'; prog: string; dur: string; }
export const ADS: Ad[] = [
  { title: 'La hora del brindis', sub: 'Promoción · Cocteles 2×1', estado: 'En cola', prog: 'Todos los días · 18:00–20:00', dur: '15 s' },
  { title: 'Viernes de salsa en vivo', sub: 'Evento · Orquesta invitada', estado: 'Programado', prog: 'Vie · 19:00–23:00', dur: '20 s · Cada 5 canciones' },
  { title: 'Tu canción, tu escenario', sub: 'Mensaje · Pide desde tu mesa', estado: 'En cola', prog: 'Durante el horario del local', dur: '10 s' },
  { title: 'Noche de karaoke', sub: 'Evento · Jueves de grandes voces', estado: 'Sin usar', prog: 'Sin programación', dur: '10 s' },
  { title: 'Bienvenidos a Escenario 89', sub: 'Mensaje · Disfruta la música', estado: 'Sin usar', prog: 'Durante el horario del local', dur: '12 s' },
];

export const AUDIOS = [
  { title: 'La hora del brindis', sub: 'Promoción · Cocteles 2×1', dur: '7 s', playing: true },
  { title: 'Viernes de salsa en vivo', sub: 'Evento · Orquesta invitada', dur: '10 s', playing: false },
  { title: 'Tu canción, tu escenario', sub: 'Mensaje · Pide desde tu mesa', dur: '3 s', playing: false },
];
