import { Injectable, inject } from '@angular/core';
import { ApiService, ErrorApi, Rol } from './api.service';
import { AppState } from './app-state';
import { SessionService } from './session.service';
import { Cancion, Video } from './models';

/** Un elemento de la cola tal como lo devuelve el backend: GET /queue?include=song,table */
interface ColaItem {
    uuid: string;
    position: number | null;
    status: 'WAITING' | 'PLAYING' | 'FINISHED' | 'CANCELLED';
    song?: { id: string; title: string; author: string; timestamp: string; image?: string };
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

/** La cola de canciones vive en el backend; aquí se lee, se agrega y se avanza. */
@Injectable({ providedIn: 'root' })
export class QueueService {
    private api = inject(ApiService);
    private state = inject(AppState);
    private session = inject(SessionService);

    private temporizador: ReturnType<typeof setInterval> | undefined;
    private actualizando = false;
    private codigoMesaAdmin: string | null = null;

    // ---------------------------------------------------------------- agregar

    /** Guarda la canción (si no existía) y la pone en la cola. rol 'mesa' = cliente, 'admin' = panel. */
    async agregar(video: Video, rol: Rol): Promise<ResultadoAgregar> {
        const tableCode = rol === 'admin' ? await this.obtenerCodigoMesaAdmin() : undefined;

        // 1) La canción debe existir en la base de datos (409 = ya existía, no es un problema)
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
            });
        } catch (e) {
            if (!(e instanceof ErrorApi && e.estado === 409)) throw e;
        }

        // 2) Entra a la cola. El uuid evita duplicados si el cliente toca dos veces.
        const r = await this.api.pedir<{ position: number; status: string }>(rol, 'POST', '/queue', {
            songId: video.id,
            tableCode: tableCode ?? this.session.codigoMesa() ?? '',
            uuid: nuevoUuid(),
        });

        if (rol === 'admin') await this.refrescar();
        return { posicion: r.position, estado: r.status };
    }

    // ------------------------------------------------------------ leer la cola

    /** Trae la cola del backend y actualiza state.sonando / state.cola (solo si algo cambió). */
    async refrescar(): Promise<void> {
        if (this.actualizando) return;
        this.actualizando = true;
        try {
            const r = await this.api.pedir<{ data: ColaItem[] }>('admin', 'GET', '/queue?include=song,table&limit=0');
            const lista = (r.data ?? []).filter(q => q.song);
            const enCurso = lista.find(q => q.status === 'PLAYING');
            const espera = lista
                .filter(q => q !== enCurso && q.status === 'WAITING')
                .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

            // Si sigue siendo la misma canción no se toca, para no reiniciar el video
            if ((enCurso?.uuid ?? null) !== (this.state.sonando()?.uuid ?? null)) {
                this.state.sonando.set(enCurso ? this.aCancion(enCurso) : null);
            }

            const actual = this.state.cola();
            const igual = espera.length === actual.length && espera.every((q, i) => q.uuid === actual[i].uuid);
            if (!igual) this.state.cola.set(espera.map(q => this.aCancion(q)));
        } catch {
            // Sin conexión por un momento: se conserva lo que ya se ve y se reintenta en el siguiente ciclo
        } finally {
            this.actualizando = false;
        }
    }

    iniciarPolling(cadaMs = 10000) {
        this.detenerPolling();
        this.refrescar();
        this.temporizador = setInterval(() => this.refrescar(), cadaMs);
    }

    detenerPolling() {
        clearInterval(this.temporizador);
        this.temporizador = undefined;
    }

    // ------------------------------------------------------------ administrar

    /** Marca la canción como terminada; el backend sube la siguiente a "sonando". */
    async finalizar(uuid: string): Promise<void> {
        await this.api.pedir('admin', 'PATCH', '/queue', { uuid, status: 'FINISHED' });
        await this.refrescar();
    }

    /** Pasa una canción de la espera al primer lugar ("reproducir ahora"). */
    async reproducirAhora(uuid: string, uuidAnterior?: string): Promise<void> {
        if (uuidAnterior && uuidAnterior !== uuid) {
            try {
                await this.api.pedir('admin', 'PATCH', '/queue', { uuid: uuidAnterior, status: 'FINISHED' });
            } catch { }
        }
        await this.api.pedir('admin', 'PATCH', '/queue', { uuid, position: 0, status: 'PLAYING' });
        await this.refrescar();
    }

    // --------------------------------------------------------------- internos

    /**
     * El backend exige una mesa para cada canción. Para las que agrega el administrador se usa la mesa 0
     * si existe; si no, la de número más bajo.
     */
    private async obtenerCodigoMesaAdmin(): Promise<string> {
        if (this.codigoMesaAdmin) return this.codigoMesaAdmin;
        const r = await this.api.pedir<{ data: { code: string; number: number }[] }>('admin', 'GET', '/table');
        const mesas = [...(r.data ?? [])].sort((a, b) => a.number - b.number);
        if (!mesas.length) throw new Error('No hay mesas creadas en el backend.');
        this.codigoMesaAdmin = mesas[0].code;
        return this.codigoMesaAdmin;
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
}