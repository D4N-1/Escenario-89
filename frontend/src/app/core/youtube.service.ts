import { Injectable } from '@angular/core';
import { Video } from './models';

/** Un video tal como lo devuelve el backend en GET /search (librería yt-search) */
interface ResultadoYt {
  videoId: string;
  title: string;
  thumbnail?: string;
  image?: string;
  seconds: number;
  timestamp: string;
  views: number;
  ago?: string | null;
  author?: { name?: string };
}

/** Busca canciones en YouTube a través de nuestro backend (GET /search?video=...). */
@Injectable({ providedIn: 'root' })
export class YoutubeService {
  async buscar(consulta: string): Promise<Video[]> {
    const q = consulta.trim();
    if (!q) return [];

    let r: Response;
    try {
      r = await fetch(`/search?video=${encodeURIComponent(q)}`);
    } catch {
      throw new Error('No se pudo conectar con el servidor. ¿Está corriendo el backend? (npm run start:dev -w backend)');
    }
    if (!r.ok) throw new Error(`El servidor de búsqueda respondió con error ${r.status}`);

    const contentType = r.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      throw new Error('El backend no respondió en formato JSON. Asegúrate de reiniciar el frontend para activar el proxy hacia el backend (puerto 3000).');
    }

    const cuerpo = await r.json();
    const videos: ResultadoYt[] = cuerpo?.videos ?? [];
    return videos
      .filter(v => v.videoId && v.seconds > 0) // sin transmisiones en vivo
      .slice(0, 10)
      .map(v => this.aVideo(v));
  }

  private aVideo(v: ResultadoYt): Video {
    const canal = (v.author?.name ?? '').replace(/\s+and\s+\d+\s+more$/i, '').trim(); // "Fulano and 3 more"
    return {
      id: v.videoId,
      titulo: v.title,
      canal,
      vistas: this.formatearVistas(v.views ?? 0),
      antiguedad: this.traducirAntiguedad(v.ago),
      duracion: v.timestamp,
      tipo: /karaoke/i.test(v.title) ? 'karaoke' : 'sencillo',
      miniatura: v.thumbnail ?? v.image,
      miniaturaTitulo: '',
      miniaturaSub: '',
      inicialesCanal: canal.slice(0, 2).toUpperCase(),
    };
  }

  private formatearVistas(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + ' M';
    if (n >= 1_000) return Math.round(n / 1_000) + ' k';
    return String(n);
  }

  /** "11mo ago" / "3 weeks ago" -> "hace 11 meses" / "hace 3 semanas" */
  private traducirAntiguedad(ago?: string | null): string {
    const m = /(\d+)\s*([a-z]+)/i.exec(ago ?? '');
    if (!m) return '';
    const n = Number(m[1]);
    const u = m[2].toLowerCase();
    const unidad =
      /^(s|sec)/.test(u) ? ['segundo', 'segundos'] :
      /^min/.test(u)     ? ['minuto', 'minutos'] :
      /^h/.test(u)       ? ['hora', 'horas'] :
      /^d/.test(u)       ? ['día', 'días'] :
      /^w/.test(u)       ? ['semana', 'semanas'] :
      /^mo/.test(u)      ? ['mes', 'meses'] :
      /^y/.test(u)       ? ['año', 'años'] : null;
    return unidad ? `hace ${n} ${n === 1 ? unidad[0] : unidad[1]}` : '';
  }
}