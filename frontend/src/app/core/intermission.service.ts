import { Injectable, computed, inject, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { ApiService } from './api.service';
import { AppState } from './app-state';
import { Anuncio, AudioItem, EstadoAnuncio, IntermissionItem, ScheduledIntermissionState, AnuncioProgramadoItem, ContadorAnuncio } from './models';
import { SocketService } from './socket.service';

export interface NuevoAnuncioDto {
  file: File;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  everySongs?: number | null;
  active?: boolean;
}

export interface ActualizarAnuncioDto {
  uuid: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  everySongs?: number | null;
  active?: boolean;
}

@Injectable({ providedIn: 'root' })
export class IntermissionService {
  private api = inject(ApiService);
  private state = inject(AppState);
  private socket = inject(SocketService);

  items = signal<IntermissionItem[]>([]);
  cargando = signal(false);
  guardando = signal(false);
  error = signal('');
  ultimoMensaje = signal('');

  // Estado en tiempo real de anuncios programados
  programacion = signal<ScheduledIntermissionState | null>(null);
  manualProgramadoUuid = computed(() => this.programacion()?.manual?.uuid ?? null);
  proximaEnPausa = computed(() => {
    const p = this.programacion()?.nextBreak;
    if (!p) return null;
    return {
      ...p,
      image: p.image ? this.resolverUrl(p.image) : '',
      url: this.resolverUrl(p.url),
    };
  });
  contadores = computed(() => this.programacion()?.counters ?? []);

  anuncios = computed(() => this.items().filter(i => !this.esAudio(i)));
  audios = computed(() => this.items().filter(i => this.esAudio(i)));
  todosLosItems = computed(() => this.items());

  constructor() {
    // Escuchar eventos de intermission emitidos por el websocket
    this.socket.onIntermission((payload) => {
      if (payload?.message) {
        this.ultimoMensaje.set(payload.message);
      }
      this.cargar().catch(() => {});
      this.cargarProgramacion().catch(() => {});
    });

    // Escuchar actualizaciones de programación en tiempo real
    this.socket.onIntermissionScheduled((payload) => {
      if (payload) {
        this.programacion.set(payload);
      }
    });

    this.cargarProgramacion().catch(() => {});
  }

  esAudio(item: IntermissionItem): boolean {
    const ext = item.url?.split('.').pop()?.toLowerCase() ?? '';
    if (['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac', 'weba', 'opus'].includes(ext)) return true;
    if (!item.image && !['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) return true;
    return false;
  }

  calcularEstado(item: IntermissionItem): EstadoAnuncio {
    if (!item.active) return 'Sin usar';
    if (item.everySongs && item.everySongs > 0) return 'Programado';
    return 'En cola';
  }

  resolverUrl(path: string | undefined): string {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:') || path.startsWith('data:')) return path;

    const baseApi = (environment?.apiUrl || 'http://localhost:3000').replace(/\/+$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;

    if (baseApi.endsWith('/api') && cleanPath.startsWith('/api/')) {
      return `${baseApi.slice(0, -4)}${cleanPath}`;
    }

    return `${baseApi}${cleanPath}`;
  }

  async cargar(): Promise<IntermissionItem[]> {
    this.cargando.set(true);
    this.error.set('');
    try {
      const res = await this.api.pedir<{ data: IntermissionItem[] }>('admin', 'GET', '/intermission?limit=100');
      const lista = (res?.data ?? []).map(item => ({
        ...item,
        image: item.image ? this.resolverUrl(item.image) : '',
        url: this.resolverUrl(item.url),
      }));
      this.items.set(lista);
      this.sincronizarConAppState(lista);
      return lista;
    } catch (err: any) {
      const msg = err?.message || 'No se pudieron cargar los anuncios';
      this.error.set(msg);
      return [];
    } finally {
      this.cargando.set(false);
    }
  }

  async crear(dto: NuevoAnuncioDto): Promise<void> {
    this.guardando.set(true);
    this.error.set('');
    try {
      const formData = new FormData();
      formData.append('file', dto.file);
      formData.append('title', dto.title.trim());
      if (dto.description?.trim()) {
        formData.append('description', dto.description.trim());
      }
      formData.append('startTime', dto.startTime);
      formData.append('endTime', dto.endTime);
      formData.append('active', String(dto.active ?? true));

      if (dto.everySongs !== null && dto.everySongs !== undefined && dto.everySongs > 0) {
        formData.append('everySongs', String(dto.everySongs));
      }

      await this.api.pedir('admin', 'POST', '/intermission', formData);
      await this.cargar();
    } catch (err: any) {
      const msg = err?.message || 'Error al guardar el anuncio';
      this.error.set(msg);
      throw err;
    } finally {
      this.guardando.set(false);
    }
  }

  async actualizar(dto: ActualizarAnuncioDto): Promise<void> {
    this.guardando.set(true);
    this.error.set('');
    try {
      const payload: Record<string, any> = {
        uuid: dto.uuid,
        title: dto.title.trim(),
        description: dto.description?.trim() ?? '',
        startTime: dto.startTime,
        endTime: dto.endTime,
        active: dto.active ?? true,
        everySongs: (dto.everySongs !== null && dto.everySongs !== undefined && dto.everySongs > 0)
          ? dto.everySongs
          : null,
      };

      await this.api.pedir('admin', 'PATCH', '/intermission', payload);
      this.items.update(lista =>
        lista.map(x => (x.uuid === dto.uuid ? { ...x, ...payload } : x))
      );
      this.sincronizarConAppState(this.items());
    } catch (err: any) {
      const msg = err?.message || 'Error al actualizar el anuncio';
      this.error.set(msg);
      throw err;
    } finally {
      this.guardando.set(false);
    }
  }

  async alternarEstado(item: IntermissionItem): Promise<void> {
    const nuevoEstado = !item.active;
    try {
      await this.api.pedir('admin', 'PATCH', '/intermission', {
        uuid: item.uuid,
        active: nuevoEstado,
      });
      this.items.update(lista =>
        lista.map(x => (x.uuid === item.uuid ? { ...x, active: nuevoEstado } : x))
      );
      this.sincronizarConAppState(this.items());
    } catch (err: any) {
      this.error.set(err?.message || 'No se pudo cambiar el estado');
      throw err;
    }
  }

  async cargarProgramacion(): Promise<ScheduledIntermissionState | null> {
    try {
      const res = await this.api.pedir<ScheduledIntermissionState>('admin', 'GET', '/intermission/scheduled');
      if (res) {
        this.programacion.set(res);
      }
      return res ?? null;
    } catch {
      return null;
    }
  }

  obtenerContador(uuid: string): ContadorAnuncio | null {
    return this.contadores().find(c => c.uuid === uuid) ?? null;
  }

  async reproducirEnSiguientePausa(uuid: string): Promise<{ message: string; scheduled: boolean }> {
    try {
      // Si ya está programado este anuncio, alternar y desprogramarlo (toggle)
      if (this.manualProgramadoUuid() === uuid) {
        return await this.cancelarSiguientePausa(uuid);
      }

      const res = await this.api.pedir<{ message?: string; scheduled?: boolean; status?: ScheduledIntermissionState }>('admin', 'POST', '/intermission/play', { uuid });
      const msg = res?.message || 'Anuncio programado para la siguiente pausa';
      this.ultimoMensaje.set(msg);
      if (res?.status) {
        this.programacion.set(res.status);
      } else {
        await this.cargarProgramacion();
      }
      return { message: msg, scheduled: true };
    } catch (err: any) {
      const msg = err?.message || 'No se pudo programar el anuncio';
      this.error.set(msg);
      throw err;
    }
  }

  async cancelarSiguientePausa(uuid?: string): Promise<{ message: string; scheduled: boolean }> {
    try {
      const endpoint = uuid ? `/intermission/play/${uuid}` : '/intermission/cancel';
      const res = await this.api.pedir<{ message?: string; scheduled?: boolean; status?: ScheduledIntermissionState }>('admin', uuid ? 'DELETE' : 'POST', endpoint);
      const msg = res?.message || 'Anuncio retirado de la siguiente pausa';
      this.ultimoMensaje.set(msg);
      if (res?.status) {
        this.programacion.set(res.status);
      } else {
        await this.cargarProgramacion();
      }
      return { message: msg, scheduled: false };
    } catch (err: any) {
      const msg = err?.message || 'No se pudo retirar el anuncio';
      this.error.set(msg);
      throw err;
    }
  }

  async eliminar(uuid: string): Promise<void> {
    try {
      await this.api.pedir('admin', 'DELETE', `/intermission/${uuid}`);
      this.items.update(lista => lista.filter(x => x.uuid !== uuid));
      this.sincronizarConAppState(this.items());
    } catch (err: any) {
      this.error.set(err?.message || 'No se pudo eliminar el anuncio');
      throw err;
    }
  }

  private sincronizarConAppState(lista: IntermissionItem[]) {
    // Sincronizar anuncios para que QueuePanel y AppState los vean
    const anuncios: Anuncio[] = lista.map((item, idx) => ({
      id: item.id ?? idx + 1,
      titulo: item.title,
      detalle: item.description || (item.everySongs ? `Cada ${item.everySongs} canciones` : 'Horario programado'),
      estado: this.calcularEstado(item),
      programacion: `${item.startTime.substring(0, 5)} - ${item.endTime.substring(0, 5)}`,
      duracion: item.everySongs ? `Cada ${item.everySongs} cancs.` : 'Pausa',
    }));
    this.state.anuncios.set(anuncios);
  }
}
