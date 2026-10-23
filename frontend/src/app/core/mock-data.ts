// Datos de ejemplo SOLO para desarrollo. Se pueden borrar cuando haya backend.
import { Anuncio, AudioItem, Cancion, Video } from './models';

export const SONANDO: Cancion = {
  id: 0, titulo: 'El gran varón', artista: 'Willie Colón', duracion: '7:23', mesa: 2, tipo: 'sencillo', videoId: 'Var251O2AEM',
  miniatura: 'https://i.ytimg.com/vi/Var251O2AEM/mqdefault.jpg',
};

export const COLA: Cancion[] = [
  { id: 1, titulo: 'Incomprendido', artista: 'Ismael Rivera', duracion: '2:57', mesa: 4, tipo: 'karaoke', videoId: 'i_yD1G5Yh-s', miniatura: 'https://i.ytimg.com/vi/i_yD1G5Yh-s/mqdefault.jpg' },
  { id: 2, titulo: 'El Día De Mi Suerte', artista: 'Willie Colón · Héctor Lavoe', duracion: '5:27', mesa: 3, tipo: 'sencillo', videoId: 'iK0m0a51s2A', miniatura: 'https://i.ytimg.com/vi/iK0m0a51s2A/mqdefault.jpg' },
  { id: 3, titulo: 'Amores Como el Nuestro', artista: 'Jerry Rivera', duracion: '5:04', mesa: 7, tipo: 'sencillo', videoId: 'e2uE8rL8sEw', miniatura: 'https://i.ytimg.com/vi/e2uE8rL8sEw/mqdefault.jpg' },
  { id: 4, titulo: 'Llorarás (Visualizer)', artista: "Oscar D'León", duracion: '3:42', mesa: 9, tipo: 'sencillo', videoId: 'dQ_VlDkLzC8', miniatura: 'https://i.ytimg.com/vi/dQ_VlDkLzC8/mqdefault.jpg' },
  { id: 5, titulo: 'Fabricando Fantasías', artista: 'Tito Nieves', duracion: '4:35', mesa: 1, tipo: 'sencillo', videoId: 'zD0R3k7kC5M', miniatura: 'https://i.ytimg.com/vi/zD0R3k7kC5M/mqdefault.jpg' },
  { id: 6, titulo: 'Yo no sé mañana', artista: 'Luis Enrique', duracion: '4:26', mesa: 5, tipo: 'karaoke', videoId: 'b2G_7e93H2g', miniatura: 'https://i.ytimg.com/vi/b2G_7e93H2g/mqdefault.jpg' },
  { id: 7, titulo: 'Oh Qué Será', artista: 'Willie Colón', duracion: '5:04', mesa: 6, tipo: 'sencillo', videoId: '8YqHhI-642Y', miniatura: 'https://i.ytimg.com/vi/8YqHhI-642Y/mqdefault.jpg' },
  { id: 8, titulo: 'Se acabó el amor', artista: "Adolescent's Orquesta", duracion: '4:05', mesa: 9, tipo: 'sencillo', videoId: 'ZtI18j8sNfA', miniatura: 'https://i.ytimg.com/vi/ZtI18j8sNfA/mqdefault.jpg' },
  { id: 9, titulo: 'Gotas De Lluvia', artista: 'Grupo Niche', duracion: '5:37', mesa: 9, tipo: 'sencillo', videoId: '4p_bM-lXGkI', miniatura: 'https://i.ytimg.com/vi/4p_bM-lXGkI/mqdefault.jpg' },
];

export const ANUNCIOS: Anuncio[] = [
  { id: 1, titulo: 'La hora del brindis', detalle: 'Promoción · Cocteles 2×1', estado: 'En cola', programacion: 'Todos los días · 18:00–20:00', duracion: '15 s' },
  { id: 2, titulo: 'Viernes de salsa en vivo', detalle: 'Evento · Orquesta invitada', estado: 'Programado', programacion: 'Vie · 19:00–23:00', duracion: '20 s · Cada 5 canciones' },
  { id: 3, titulo: 'Tu canción, tu escenario', detalle: 'Mensaje · Pide desde tu mesa', estado: 'En cola', programacion: 'Durante el horario del local', duracion: '10 s' },
  { id: 4, titulo: 'Noche de karaoke', detalle: 'Evento · Jueves de grandes voces', estado: 'Sin usar', programacion: 'Sin programación', duracion: '10 s' },
  { id: 5, titulo: 'Bienvenidos a Escenario 89', detalle: 'Mensaje · Disfruta la música', estado: 'Sin usar', programacion: 'Durante el horario del local', duracion: '12 s' },
];

export const AUDIOS: AudioItem[] = [
  { id: 1, titulo: 'La hora del brindis', detalle: 'Promoción · Cocteles 2×1', duracion: '7 s', sonando: true },
  { id: 2, titulo: 'Viernes de salsa en vivo', detalle: 'Evento · Orquesta invitada', duracion: '10 s', sonando: false },
  { id: 3, titulo: 'Tu canción, tu escenario', detalle: 'Mensaje · Pide desde tu mesa', duracion: '3 s', sonando: false },
];

export const VIDEOS: Video[] = [];