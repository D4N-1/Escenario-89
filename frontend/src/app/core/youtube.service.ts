import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService, ErrorApi, Rol } from './api.service';
import { SessionService } from './session.service';
import { Video } from './models';

/** Una canción tal como la devuelve el backend en GET /search?title=... */
interface ResultadoBusqueda {
  id: string;
  title: string;
  image?: string;
  seconds: number;
  timestamp: string;
  views?: number;
  ago?: string | null;
  author?: string;
}

/** Busca canciones en YouTube a través de nuestro backend (GET /search?title=...). Requiere sesión de mesa o de admin. */
@Injectable({ providedIn: 'root' })
export class YoutubeService {
  private api = inject(ApiService);
  private session = inject(SessionService);
  private router = inject(Router);

  async buscar(consulta: string): Promise<Video[]> {
    const q = consulta.trim();
    if (!q) return [];

    // En el panel de administración se usa el token del admin; en el celular, el de la mesa
    const enAdmin = this.router.url.startsWith('/admin');
    const rol: Rol = enAdmin || (!this.session.tokenMesa() && this.session.esAdmin()) ? 'admin' : 'mesa';

    let cuerpo: { data?: ResultadoBusqueda[] };
    try {
      cuerpo = await this.api.pedir(rol, 'GET', `/search?title=${encodeURIComponent(q)}`);
    } catch (e) {
      if (e instanceof ErrorApi && e.estado === 0) throw e;
      throw new Error(e instanceof Error ? `No se pudo buscar: ${e.message}` : 'No se pudo buscar. Intenta de nuevo.');
    }

    return (cuerpo?.data ?? [])
      .filter(v => v.id && v.seconds > 0) // sin transmisiones en vivo
      .slice(0, 10)
      .map(v => this.aVideo(v));
  }

  private aVideo(v: ResultadoBusqueda): Video {
    const canal = (v.author ?? '').replace(/\s+and\s+\d+\s+more$/i, '').trim(); // "Fulano and 3 more"
    return {
      id: v.id,
      titulo: v.title,
      canal,
      vistas: this.formatearVistas(v.views ?? 0),
      antiguedad: this.traducirAntiguedad(v.ago),
      duracion: v.timestamp,
      tipo: /karaoke/i.test(v.title) ? 'karaoke' : 'sencillo',
      miniatura: v.image,
      miniaturaTitulo: '',
      miniaturaSub: '',
      inicialesCanal: canal.slice(0, 2).toUpperCase(),
      segundos: v.seconds,
      vistasNumero: v.views ?? 0,
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