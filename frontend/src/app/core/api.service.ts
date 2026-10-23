import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService, mensajeDeError } from './session.service';

export type Rol = 'mesa' | 'admin';

export class ErrorApi extends Error {
  constructor(public estado: number, mensaje: string) {
    super(mensaje);
  }
}

/** Peticiones al backend con el token de la mesa o del administrador. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private session = inject(SessionService);
  private router = inject(Router);

  async pedir<T = any>(rol: Rol, metodo: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, cuerpo?: unknown): Promise<T> {
    return this.enviar<T>(rol, metodo, url, cuerpo, true);
  }

  private async enviar<T>(rol: Rol, metodo: string, url: string, cuerpo: unknown, reintentar: boolean): Promise<T> {
    const token = rol === 'admin' ? this.session.tokenAdmin() : this.session.tokenMesa();
    if (!token) {
      if (rol === 'admin') this.router.navigate(['/admin/login']);
      throw new ErrorApi(401, rol === 'admin' ? 'Inicia sesión como administrador.' : 'Escanea el QR de tu mesa para pedir canciones.');
    }

    const isFormData = typeof FormData !== 'undefined' && cuerpo instanceof FormData;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (cuerpo !== undefined && !isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    let r: Response;
    try {
      r = await fetch(url, {
        method: metodo,
        headers,
        body: cuerpo !== undefined ? (isFormData ? cuerpo : JSON.stringify(cuerpo)) : undefined,
      });
    } catch {
      throw new ErrorApi(0, 'No se pudo conectar con el servidor. ¿Está corriendo el backend?');
    }

    // Token vencido (dura unas horas)
    if (r.status === 401) {
      if (rol === 'admin') {
        this.session.salirAdmin();
        this.router.navigate(['/admin/login']);
      } else if (reintentar && this.session.codigoMesa()) {
        try {
          await this.session.entrarMesa(this.session.codigoMesa()!);
          return this.enviar<T>(rol, metodo, url, cuerpo, false);
        } catch {
          this.session.salirMesa();
          this.router.navigate(['/sin-mesa']);
        }
      } else if (rol === 'mesa') {
        this.session.salirMesa();
        this.router.navigate(['/sin-mesa']);
      }
    }

    const datos = await r.json().catch(() => null);
    if (!r.ok) throw new ErrorApi(r.status, mensajeDeError(datos, `El servidor respondió con error ${r.status}`));
    return datos as T;
  }
}