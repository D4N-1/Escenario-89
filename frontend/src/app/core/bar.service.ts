import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { AppState } from './app-state';
import { EstadoLocal } from './models';
import { SessionService } from './session.service';
import { SocketService } from './socket.service';

export type BackendBarStatus = 'OPEN' | 'CLOSING' | 'CLOSED';

export interface BarDto {
  id?: number;
  status: BackendBarStatus;
  closeHour: string;
}

export function convertirStatusAEstadoLocal(status: BackendBarStatus | string): EstadoLocal {
  switch (status) {
    case 'OPEN':
      return 'abierto';
    case 'CLOSING':
      return 'cerrando';
    case 'CLOSED':
      return 'cerrado';
    default:
      return 'abierto';
  }
}

export function convertirEstadoLocalAStatus(estado: EstadoLocal): BackendBarStatus {
  switch (estado) {
    case 'abierto':
      return 'OPEN';
    case 'cerrando':
      return 'CLOSING';
    case 'cerrado':
      return 'CLOSED';
    default:
      return 'OPEN';
  }
}

/** Convierte "03:00" o "03:00:00" a "3:00 am" */
export function convertirHora24a12(hora24: string): string {
  if (!hora24) return '3:00 am';
  const partes = hora24.split(':').map(Number);
  let h = partes[0] ?? 0;
  const m = (partes[1] ?? 0).toString().padStart(2, '0');
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

/** Convierte "3:00 am" o "12:00 am" a "03:00" */
export function convertirHora12a24(hora12: string): string {
  if (!hora12) return '03:00';
  const clean = hora12.trim().toLowerCase();
  const match = clean.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!match) return hora12;
  let h = parseInt(match[1], 10);
  const m = match[2];
  const ampm = match[3].toLowerCase();
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  return `${h.toString().padStart(2, '0')}:${m}`;
}

@Injectable({ providedIn: 'root' })
export class BarService {
  private api = inject(ApiService);
  private state = inject(AppState);
  private socket = inject(SocketService);
  private session = inject(SessionService);

  private unsubscribeSocketBar?: () => void;
  private sincronizando = false;

  async obtenerEstado(): Promise<BarDto | null> {
    try {
      let res: { message: string; data: BarDto } | null = await this.api.pedirPublico<{ message: string; data: BarDto }>('GET', '/bar');


      const data = res?.data;
      if (data) {
        this.aplicarBar(data);
        return data;
      }
      return null;
    } catch (e) {
      console.warn('No se pudo obtener el estado del bar:', e);
      return null;
    }
  }

  iniciarSincronizacion() {
    if (this.sincronizando) return;
    this.sincronizando = true;
    this.obtenerEstado();

    this.unsubscribeSocketBar = this.socket.onBar((data: BarDto) => {
      if (data) {
        this.aplicarBar(data);
      }
    });
  }

  detenerSincronizacion() {
    if (this.unsubscribeSocketBar) {
      this.unsubscribeSocketBar();
      this.unsubscribeSocketBar = undefined;
    }
    this.sincronizando = false;
  }

  async cambiarEstado(estado: EstadoLocal): Promise<void> {
    const status = convertirEstadoLocalAStatus(estado);
    this.state.setEstado(estado);

    try {
      const res = await this.api.pedir<{ message: string; data: BarDto }>('admin', 'PATCH', '/bar', {
        status,
      });
      if (res?.data) {
        this.aplicarBar(res.data);
      }
    } catch (e) {
      console.error('Error al actualizar estado del bar:', e);
      // Revertir o volver a cargar
      await this.obtenerEstado();
      throw e;
    }
  }

  async cambiarHoraCierre(hora12: string): Promise<void> {
    const close = convertirHora12a24(hora12);
    this.state.setHoraCierre(hora12);

    try {
      const res = await this.api.pedir<{ message: string; data: BarDto }>('admin', 'PATCH', '/bar', {
        close,
      });
      if (res?.data) {
        this.aplicarBar(res.data);
      }
    } catch (e) {
      console.error('Error al actualizar hora de cierre:', e);
      await this.obtenerEstado();
      throw e;
    }
  }

  private aplicarBar(data: BarDto) {
    if (data.status) {
      const estado = convertirStatusAEstadoLocal(data.status);
      this.state.setEstado(estado);
    }
    if (data.closeHour) {
      const hora12 = convertirHora24a12(data.closeHour);
      this.state.setHoraCierre(hora12);
    }
  }
}
