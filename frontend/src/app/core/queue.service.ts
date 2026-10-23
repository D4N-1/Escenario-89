import { Injectable, inject } from '@angular/core';
import { ApiService, Rol } from './api.service';
import { AppState } from './app-state';
import { SocketService } from './socket.service';
import { Cancion, MiCancion, Video } from './models';

/** Un elemento de la cola tal como lo devuelve el backend: GET /queue?include=song,table */
interface ColaItem {
    uuid: string;
    position: number | null;
    status: 'WAITING' | 'PLAYING' | 'FINISHED' | 'CANCELLED';
    song?: { id: string; title: string; author: string; timestamp: string; image?: string; views?: number; ago?: string | null };
    table?: { number: number; code: string } | null;
}

export interface ResultadoAgregar {
    posicion: number; // 0 = suena ahora
    estado: string;
}

function nuevoUuid(): string {
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** "3:42" -> 222 */
function aSegundos(duracion: string): number {
    return duracion.split(':').reduce((total, parte) => total * 60 + Number(parte), 0) || 0;
}

/** La cola de canciones vive en el backend; aquí se lee, se agrega y se avanza en tiempo real. */
@Injectable({ providedIn: 'root' })
export class QueueService {
    private api = inject(ApiService);
    private state = inject(AppState);
    private socket = inject(SocketService);

    private actualizando = false;
    private unsubscribeSocketAdmin?: () => void;

    private actualizandoMesa = false;
    private unsubscribeSocketMesa?: () => void;

    // ---------------------------------------------------------------- agregar

    /** Guarda la canción (si no existía) y la pone en la cola. rol 'mesa' = cliente, 'admin' = panel. */
    async agregar(video: Video, rol: Rol): Promise<ResultadoAgregar> {
        // 1) La canción debe existir en la base de datos. Si ya existía (la búsqueda también la guarda) o
        //    este intento falla, se sigue: el paso 2 avisa con su propio error si de verdad no existe.
        try {
            await this.api.pedir(rol, 'POST', '/song', {
                id: video.id,
                title: video.titulo,
                image: video.miniatura || `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`,
                seconds: video.segundos ?? aSegundos(video.duracion),
                timestamp: video.duracion,
                views: video.vistasNumero ?? 0,
                url: `https://youtube.com/watch?v=${video.id}`,
                ago: video.antiguedad || undefined,
                author: video.canal || 'Desconocido',
                description: '',
            });
        } catch { /* ya existía o se guardó al buscar */ }

        // 2) Entra a la cola. El backend emite la actualización en tiempo real por WebSocket a todos
        const r = await this.api.pedir<{ position: number; status: string }>(rol, 'POST', '/queue', {
            songId: video.id,
            uuid: nuevoUuid(),
        });

        return { posicion: r.position, estado: r.status };
    }

    
    async refrescar(): Promise<void> {
        if (this.actualizando) return;
        this.actualizando = true;
        try {
            const r = await this.api.pedir<{ data: ColaItem[] }>('admin', 'GET', '/queue?include=song,table&limit=0');
            this.procesarColaAdmin(r.data ?? []);
        } catch {
        } finally {
            this.actualizando = false;
        }
    }

    iniciarPolling() {
        this.detenerPolling();
        this.refrescar();

        this.socket.conectar('admin');
        this.unsubscribeSocketAdmin = this.socket.onQueue((items) => {
            this.procesarColaAdmin(items);
        });
    }

    detenerPolling() {
        if (this.unsubscribeSocketAdmin) {
            this.unsubscribeSocketAdmin();
            this.unsubscribeSocketAdmin = undefined;
        }
    }

    private procesarColaAdmin(rawItems: any[]) {
        const lista = (rawItems ?? []).filter(q => q && q.song);
        if (!lista.length && !this.state.cola().length && !this.state.sonando()) return;

        const enCurso = lista.find(q => q.status === 'PLAYING');
        const espera = lista
            .filter(q => q !== enCurso && q.status === 'WAITING')
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

        if ((enCurso?.uuid ?? null) !== (this.state.sonando()?.uuid ?? null)) {
            this.state.sonando.set(enCurso ? this.aCancion(enCurso) : null);
        }

        const actual = this.state.cola();
        const igual = espera.length === actual.length && espera.every((q, i) => q.uuid === actual[i].uuid);
        if (!igual) this.state.cola.set(espera.map(q => this.aCancion(q)));
    }


    async refrescarMisCanciones(): Promise<void> {
        if (this.actualizandoMesa) return;
        this.actualizandoMesa = true;
        try {
            const r = await this.api.pedir<{ data: ColaItem[] }>('mesa', 'GET', '/queue?include=song,table&limit=0');
            this.procesarColaMesa(r.data ?? []);
        } catch {
        } finally {
            this.actualizandoMesa = false;
        }
    }

    private procesarColaMesa(rawItems: any[]) {
        const items = (rawItems ?? []).filter(q => q && q.song);
        const mesa = this.state.mesa();
        const mias = items
            .filter(q => (!q.table || q.table?.number === mesa) && (q.status === 'PLAYING' || q.status === 'WAITING'))
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
            .map((q): MiCancion => ({ video: this.aVideo(q), posicion: q.position ?? 0 }));

        const clave = (l: MiCancion[]) => l.map(m => `${m.video.id}:${m.posicion}`).join('|');
        if (clave(mias) !== clave(this.state.misCanciones())) {
            this.state.misCanciones.set(mias);
        }

       
        const enCurso = items.find(q => q.status === 'PLAYING');
        if (enCurso) {
            const cancionActual = this.aCancion(enCurso);
            if (this.state.sonando()?.uuid !== cancionActual.uuid) {
                this.state.sonando.set(cancionActual);
            }
        } else if (items.length > 0 && !items.some(q => q.status === 'PLAYING')) {
            if (this.state.sonando() !== null) this.state.sonando.set(null);
        }
    }

    iniciarPollingMesa() {
        this.detenerPollingMesa();
        this.refrescarMisCanciones();

        this.socket.conectar('mesa');
        this.unsubscribeSocketMesa = this.socket.onQueue((items) => {
            this.procesarColaMesa(items);
        });
    }

    detenerPollingMesa() {
        if (this.unsubscribeSocketMesa) {
            this.unsubscribeSocketMesa();
            this.unsubscribeSocketMesa = undefined;
        }
    }

    
    async finalizar(uuid: string): Promise<void> {
        await this.api.pedir('admin', 'PATCH', '/queue', { uuid, status: 'FINISHED' });
    }

   
    async reproducirAhora(uuid: string): Promise<void> {
        await this.api.pedir('admin', 'PATCH', '/queue', { uuid, position: 0 });
    }

    async mover(uuid: string, indiceDestino: number): Promise<void> {
        const lista = [...this.state.cola()];
        const desde = lista.findIndex(c => c.uuid === uuid);
        const hasta = Math.max(0, Math.min(indiceDestino, lista.length - 1));
        if (desde === -1 || desde === hasta) return;

        const [movida] = lista.splice(desde, 1);
        lista.splice(hasta, 0, movida);
        this.state.cola.set(lista);

        const posicion = hasta + (this.state.sonando() ? 1 : 0);
        await this.api.pedir('admin', 'PATCH', '/queue', { uuid, position: posicion });
    }
    async quitar(uuid: string): Promise<void> {
        this.state.cola.update(lista => lista.filter(c => c.uuid !== uuid));
        await this.api.pedir('admin', 'PATCH', '/queue', { uuid, status: 'CANCELLED' });
    }

    async cargarMasEscuchadas(): Promise<Video[]> {
        try {
           
            const r = await this.api.pedir<{ data: any[] }>('mesa', 'GET', '/song/popular');
            let lista = r?.data ?? [];

            if (!lista.length) {
                const rAll = await this.api.pedir<{ data: any[] }>('mesa', 'GET', '/song?limit=15');
                lista = rAll?.data ?? [];
            }

            const formateadas = lista.map(s => this.songEntityAVideo(s));
            this.state.populares.set(formateadas);
            return formateadas;
        } catch {
            return [];
        }
    }

    private songEntityAVideo(s: any): Video {
        const canal = (s.author ?? 'Artista').replace(/\s+and\s+\d+\s+more$/i, '').trim();
        const views = Number(s.views) || 0;
        let vistas = '';
        if (views >= 1000000) vistas = (views / 1000000).toFixed(1).replace('.0', '') + ' M';
        else if (views >= 1000) vistas = Math.round(views / 1000) + ' k';
        else if (views > 0) vistas = String(views);

        return {
            id: s.id,
            titulo: s.title,
            canal,
            vistas,
            antiguedad: s.ago ?? '',
            duracion: s.timestamp || '0:00',
            tipo: (s.type === 'KARAOKE' || /karaoke/i.test(s.title)) ? 'karaoke' : 'sencillo',
            miniatura: s.image || (s.id ? `https://i.ytimg.com/vi/${s.id}/mqdefault.jpg` : undefined),
            miniaturaTitulo: '',
            miniaturaSub: '',
            inicialesCanal: canal.slice(0, 2).toUpperCase() || 'YT',
            segundos: s.seconds,
            vistasNumero: views,
        };
    }

    


    private aCancion(q: ColaItem): Cancion {
        const s = q.song!;
        return {
            id: parseInt(q.uuid.replace(/-/g, '').slice(0, 8), 16),
            uuid: q.uuid,
            titulo: s.title,
            artista: s.author,
            duracion: s.timestamp,
            mesa: q.table?.number ?? 0,
            tipo: /karaoke/i.test(s.title) ? 'karaoke' : 'sencillo',
            videoId: s.id,
            miniatura: s.image || `https://i.ytimg.com/vi/${s.id}/mqdefault.jpg`,
        };
    }

    private aVideo(q: ColaItem): Video {
        const s = q.song!;
        return {
            id: s.id,
            titulo: s.title,
            canal: s.author,
            vistas: String(s.views ?? ''),
            antiguedad: s.ago ?? '',
            duracion: s.timestamp,
            tipo: /karaoke/i.test(s.title) ? 'karaoke' : 'sencillo',
            miniatura: s.image || `https://i.ytimg.com/vi/${s.id}/mqdefault.jpg`,
            miniaturaTitulo: '',
            miniaturaSub: '',
            inicialesCanal: s.author.slice(0, 2).toUpperCase(),
        };
    }
}