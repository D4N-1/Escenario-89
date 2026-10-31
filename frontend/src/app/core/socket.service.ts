import { inject, Injectable, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { SessionService } from './session.service';

export type SocketRol = 'admin' | 'mesa';

function obtenerSocketConfig(): { url: string; path: string } {

  const api = environment.apiUrl || 'http://localhost:3000';
  const u = new URL(api);

  if ( api.includes('https://escenario89.danidev.top') ) {
    return { url: `${u.protocol}//${u.host}`, path: '/api/socket.io' };
  }

  return { url: `${u.protocol}//${u.host}`,  path: '/socket.io' };
}

@Injectable({ providedIn: 'root' })
export class SocketService {
  private session = inject(SessionService);
  private socket: Socket | null = null;
  private rolActual: SocketRol | null = null;
  private tokenActual: string | null = null;

  conectado = signal<boolean>(false);
  id = signal<string | null>(null);
  ultimoMensaje = signal<string>('');

  private listenersCola: Array<(datos: any[]) => void> = [];
  private listenersIntermission: Array<(datos: any) => void> = [];
  private listenersIntermissionScheduled: Array<(datos: any) => void> = [];
  private listenersBar: Array<(bar: any) => void> = [];

  conectar(rol: SocketRol): Socket | null {
    const token = rol === 'admin' ? this.session.tokenAdmin() : this.session.tokenMesa();
    if (!token) {
      this.desconectar();
      return null;
    }

    if (this.socket && this.socket.connected && this.rolActual === rol && this.tokenActual === token) {
      return this.socket;
    }

    this.desconectar();

    this.rolActual = rol;
    this.tokenActual = token;
    const cfg = obtenerSocketConfig();

    this.socket = io(cfg.url, {
      path: cfg.path,
      auth: {
        authorization: token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      this.conectado.set(true);
      this.id.set(this.socket?.id ?? null);
    });

    this.socket.on('disconnect', () => {
      this.conectado.set(false);
      this.id.set(null);
    });

    this.socket.on('connect_error', () => {
      this.conectado.set(false);
    });

    this.socket.on('general', (data: any) => {
      if (data?.message) this.ultimoMensaje.set(data.message);
    });

    this.socket.on('queue', (payload: any) => {
      const datos = Array.isArray(payload) ? payload : (payload?.data ?? []);
      for (const cb of this.listenersCola) {
        try {
          cb(datos);
        } catch { }
      }
    });

    this.socket.on('intermission', (payload: any) => {
      for (const cb of this.listenersIntermission) {
        try {
          cb(payload);
        } catch { }
      }
    });

    this.socket.on('intermission:scheduled', (payload: any) => {
      for (const cb of this.listenersIntermissionScheduled) {
        try {
          cb(payload);
        } catch { }
      }
    });

    this.socket.on('bar', (bar: any) => {
      for (const cb of this.listenersBar) {
        try {
          cb(bar);
        } catch { }
      }
    });

    return this.socket;
  }

  onQueue(callback: (datos: any[]) => void): () => void {
    this.listenersCola.push(callback);
    return () => {
      this.listenersCola = this.listenersCola.filter(cb => cb !== callback);
    };
  }

  onIntermission(callback: (datos: any) => void): () => void {
    this.listenersIntermission.push(callback);
    return () => {
      this.listenersIntermission = this.listenersIntermission.filter(cb => cb !== callback);
    };
  }

  onIntermissionScheduled(callback: (datos: any) => void): () => void {
    this.listenersIntermissionScheduled.push(callback);
    return () => {
      this.listenersIntermissionScheduled = this.listenersIntermissionScheduled.filter(cb => cb !== callback);
    };
  }

  onBar(callback: (bar: any) => void): () => void {
    this.listenersBar.push(callback);
    return () => {
      this.listenersBar = this.listenersBar.filter(cb => cb !== callback);
    };
  }

  desconectar() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.conectado.set(false);
    this.id.set(null);
    this.rolActual = null;
    this.tokenActual = null;
  }
}
