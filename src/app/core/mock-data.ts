// Datos de ejemplo SOLO para desarrollo. Se pueden borrar cuando haya backend.
import { Anuncio, AudioItem, Cancion, Video } from './models';

export const SONANDO: Cancion = {
  id: 0, titulo: 'El gran varón', artista: 'Willie Colón', duracion: '7:23', mesa: 2, tipo: 'sencillo',
};

export const COLA: Cancion[] = [
  { id: 1, titulo: 'Incomprendido', artista: 'Ismael Rivera', duracion: '2:57', mesa: 4, tipo: 'karaoke' },
  { id: 2, titulo: 'El Día De Mi Suerte', artista: 'Willie Colón · Héctor Lavoe', duracion: '5:27', mesa: 3, tipo: 'sencillo' },
  { id: 3, titulo: 'Amores Como el Nuestro', artista: 'Jerry Rivera', duracion: '5:04', mesa: 7, tipo: 'sencillo' },
  { id: 4, titulo: 'Llorarás (Visualizer)', artista: "Oscar D'León", duracion: '3:42', mesa: 9, tipo: 'sencillo' },
  { id: 5, titulo: 'Fabricando Fantasías', artista: 'Tito Nieves', duracion: '4:35', mesa: 1, tipo: 'sencillo' },
  { id: 6, titulo: 'Yo no sé mañana', artista: 'Luis Enrique', duracion: '4:26', mesa: 5, tipo: 'karaoke' },
  { id: 7, titulo: 'Oh Qué Será', artista: 'Willie Colón', duracion: '5:04', mesa: 6, tipo: 'sencillo' },
  { id: 8, titulo: 'Se acabó el amor', artista: "Adolescent's Orquesta", duracion: '4:05', mesa: 9, tipo: 'sencillo' },
  { id: 9, titulo: 'Gotas De Lluvia', artista: 'Grupo Niche', duracion: '5:37', mesa: 9, tipo: 'sencillo' },
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

export const VIDEOS: Video[] = [
  { id: 'v1', titulo: 'Willie Colon - El Gran Varon (Versión Karaoke)', canal: 'PARTY TYME KARAOKE EN ESPAÑOL', vistas: '636 k', antiguedad: 'hace 1 a', duracion: '3:42', tipo: 'karaoke', miniaturaTitulo: 'EL GRAN VARON', miniaturaSub: 'Willie Colon', inicialesCanal: 'CR' },
  { id: 'v2', titulo: 'Karaokanta - Willie Colón - El gran varón', canal: 'Estudio Norte', vistas: '5.1 M', antiguedad: 'hace 13 a', duracion: '4:51', tipo: 'karaoke', miniaturaTitulo: 'EL GRÁN VARÓN', miniaturaSub: 'Willie Colón', fondo: 'linear-gradient(#c8641a,#e8a020)', inicialesCanal: 'EN' },
  { id: 'v3', titulo: 'Hotline Bling - Billie Eilish (Español/Inglés)', canal: 'Cover Latino', vistas: '1.2 M', antiguedad: 'hace 2 a', duracion: '3:10', tipo: 'sencillo', miniaturaTitulo: 'HOTLINE BLING', miniaturaSub: 'Billie Eilish', fondo: 'linear-gradient(#444,#222)', inicialesCanal: 'CL' },
];