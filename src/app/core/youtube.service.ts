import { Injectable } from '@angular/core';
import { Video } from './models';
import { YOUTUBE_API_KEY } from './config';

const API = 'https://www.googleapis.com/youtube/v3';

@Injectable({ providedIn: 'root' })
export class YoutubeService {
  /** false = resultados de demostración */
  readonly usaApiReal = !!YOUTUBE_API_KEY;

  async buscar(consulta: string): Promise<Video[]> {
    const q = consulta.trim();
    if (!q) return [];
    return this.usaApiReal ? this.buscarReal(q) : this.buscarMock(q);
  }

  // ---------- YouTube Data API v3 (search = 100 de cuota, videos = 1) ----------
  private async buscarReal(q: string): Promise<Video[]> {
    const s = await fetch(`${API}/search?part=snippet&type=video&videoEmbeddable=true&maxResults=8&q=${encodeURIComponent(q)}&key=${YOUTUBE_API_KEY}`);
    if (!s.ok) throw new Error(`No se pudo buscar en YouTube (error ${s.status})`);
    const ids = ((await s.json()).items ?? []).map((i: any) => i.id.videoId).join(',');
    if (!ids) return [];

    const d = await fetch(`${API}/videos?part=snippet,contentDetails,statistics&id=${ids}&key=${YOUTUBE_API_KEY}`);
    if (!d.ok) throw new Error(`No se pudieron leer los videos (error ${d.status})`);
    return ((await d.json()).items ?? []).map((v: any) => this.aVideo(v));
  }

  private aVideo(v: any): Video {
    const titulo: string = v.snippet.title;
    const canal: string = v.snippet.channelTitle;
    return {
      id: v.id,
      titulo,
      canal,
      vistas: this.formatearVistas(Number(v.statistics?.viewCount ?? 0)),
      antiguedad: this.hace(v.snippet.publishedAt),
      duracion: this.formatearDuracion(v.contentDetails.duration),
      tipo: /karaoke/i.test(titulo) ? 'karaoke' : 'sencillo',
      miniatura: v.snippet.thumbnails?.medium?.url ?? v.snippet.thumbnails?.default?.url,
      miniaturaTitulo: '',
      miniaturaSub: '',
      inicialesCanal: canal.slice(0, 2).toUpperCase(),
    };
  }

  /** "PT3M42S" -> "3:42" */
  private formatearDuracion(iso: string): string {
    const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso) ?? [];
    const h = Number(m[1] ?? 0), min = Number(m[2] ?? 0), s = Number(m[3] ?? 0);
    const ss = String(s).padStart(2, '0');
    return h ? `${h}:${String(min).padStart(2, '0')}:${ss}` : `${min}:${ss}`;
  }

  private formatearVistas(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + ' M';
    if (n >= 1_000) return Math.round(n / 1_000) + ' k';
    return String(n);
  }

  private hace(fecha: string): string {
    const dias = Math.floor((Date.now() - new Date(fecha).getTime()) / 86_400_000);
    if (dias < 30) return `hace ${Math.max(dias, 1)} d`;
    if (dias < 365) return `hace ${Math.floor(dias / 30)} m`;
    return `hace ${Math.floor(dias / 365)} a`;
  }

  // ---------- Modo demostración ----------
  private async buscarMock(q: string): Promise<Video[]> {
    await new Promise(r => setTimeout(r, 400)); // simula la espera de la red
    const base: Omit<Video, 'id' | 'titulo' | 'miniaturaTitulo' | 'miniaturaSub'>[] = [
      { canal: 'PARTY TYME KARAOKE EN ESPAÑOL', vistas: '636 k', antiguedad: 'hace 1 a', duracion: '3:42', tipo: 'karaoke', inicialesCanal: 'PT', fondo: 'linear-gradient(#ff9a0a,#f58a00)' },
      { canal: 'Estudio Norte', vistas: '5.1 M', antiguedad: 'hace 13 a', duracion: '4:51', tipo: 'karaoke', inicialesCanal: 'EN', fondo: 'linear-gradient(#c8641a,#e8a020)' },
      { canal: 'Fania Records', vistas: '48 M', antiguedad: 'hace 9 a', duracion: '7:23', tipo: 'sencillo', inicialesCanal: 'FA', fondo: 'linear-gradient(#5a2d82,#2a1a4a)' },
      { canal: 'Salsa Clásica HD', vistas: '12 M', antiguedad: 'hace 5 a', duracion: '5:10', tipo: 'sencillo', inicialesCanal: 'SC', fondo: 'linear-gradient(#0f6b5c,#0a3a33)' },
      { canal: 'Karaoke Latino Pro', vistas: '980 k', antiguedad: 'hace 3 a', duracion: '4:05', tipo: 'karaoke', inicialesCanal: 'KL', fondo: 'linear-gradient(#a3202f,#5a0f18)' },
      { canal: 'En Vivo Colombia', vistas: '2.3 M', antiguedad: 'hace 2 a', duracion: '6:18', tipo: 'sencillo', inicialesCanal: 'EV', fondo: 'linear-gradient(#34495e,#1c2833)' },
    ];
    const sufijos = ['(Versión Karaoke)', '- Karaoke con letra', '(Audio Oficial)', '(Video Oficial HD)', '- Pista Karaoke', '(En Vivo)'];
    return base.map((b, i) => ({
      ...b,
      id: `demo-${i}-${q}`,
      titulo: `${q} ${sufijos[i]}`,
      miniaturaTitulo: q.toUpperCase().slice(0, 18),
      miniaturaSub: b.canal.split(' ')[0],
    }));
  }
}