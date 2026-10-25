import { Injectable, computed, inject, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { AppState } from './app-state';

const K_MESA_TOKEN = 'e89_mesa_token';
const K_MESA_CODIGO = 'e89_mesa_codigo';
const K_ADMIN_TOKEN = 'e89_admin_token';

function leer(clave: string): string | null {
  try { return localStorage.getItem(clave); } catch { return null; }
}
function guardar(clave: string, valor: string | null) {
  try {
    if (valor === null) localStorage.removeItem(clave);
    else localStorage.setItem(clave, valor);
  } catch { /* modo privado o sin almacenamiento: la sesión dura solo esta pestaña */ }
}

/** Lee el contenido (payload) de un JWT sin verificarlo: solo para mostrar datos en pantalla. */
function leerToken(token: string): any {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(base64))));
  } catch {
    return null;
  }
}

export function estaExpirado(token: string | null): boolean {
  if (!token) return true;
  const payload = leerToken(token);
  if (!payload || !payload.exp) return false;
  return (payload.exp * 1000) <= (Date.now() + 30000);
}

/** Mensaje legible a partir de la respuesta de error del backend (formatos distintos según el endpoint). */
export function mensajeDeError(cuerpo: any, porDefecto: string): string {
  const m = cuerpo?.message;
  if (typeof m === 'string') return m;
  if (Array.isArray(m) && m.length) return String(m[0]);
  if (m && typeof m.message === 'string') return m.message;
  if (typeof cuerpo?.error === 'string') return cuerpo.error;
  return porDefecto;
}

/** Sesiones del sistema: la mesa (cliente, por QR) y el administrador (usuario y contraseña). */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private state = inject(AppState);

  tokenMesa = signal<string | null>(leer(K_MESA_TOKEN));
  codigoMesa = signal<string | null>(leer(K_MESA_CODIGO));
  tokenAdmin = signal<string | null>(leer(K_ADMIN_TOKEN));
  esAdmin = computed(() => !!this.tokenAdmin());

  constructor() {
    // Si el token de admin ya expiró, limpiarlo
    const a = this.tokenAdmin();
    if (a && estaExpirado(a)) {
      this.salirAdmin();
    }

    // Si el cliente tenía token de mesa, comprobar si expiró
    const t = this.tokenMesa();
    const cod = this.codigoMesa();

    if (t) {
      if (estaExpirado(t)) {
        if (cod) {
          // Intentar renovar automáticamente en segundo plano
          this.entrarMesa(cod).catch(() => {
            this.salirMesa();
          });
        } else {
          this.salirMesa();
        }
      } else {
        const numero = leerToken(t)?.number;
        if (numero > 0) this.state.mesa.set(numero);
      }
    } else if (cod) {
      // Tenía código pero no token: intentar conectar
      this.entrarMesa(cod).catch(() => {});
    }
  }

  /** El cliente escaneó el QR de su mesa: /?mesa=CODIGO */
  async entrarMesa(codigo: string): Promise<void> {
    const url = environment.apiUrl + '/auth/table'
    console.log(url)
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: codigo }),
    });
    const cuerpo = await r.json().catch(() => null);
    if (!r.ok) throw new Error(mensajeDeError(cuerpo, 'No reconocemos esa mesa. Escanea de nuevo el QR.'));

    const token: string = cuerpo.access_token;
    this.tokenMesa.set(token);
    this.codigoMesa.set(codigo);
    guardar(K_MESA_TOKEN, token);
    guardar(K_MESA_CODIGO, codigo);
    const numero = leerToken(token)?.number;
    if (numero > 0) this.state.mesa.set(numero);
  }

  async entrarAdmin(clave: string): Promise<void> {
    const r = await fetch(environment.apiUrl + '/auth/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: clave }),
    });
    const cuerpo = await r.json().catch(() => null);
    if (!r.ok) throw new Error(mensajeDeError(cuerpo, 'Contraseña incorrecta'));
    if (cuerpo?.data?.role && cuerpo.data.role !== 'ADMIN') throw new Error('Este usuario no tiene permisos de administrador.');

    this.tokenAdmin.set(cuerpo.access_token);
    guardar(K_ADMIN_TOKEN, cuerpo.access_token);
  }

  salirAdmin() {
    this.tokenAdmin.set(null);
    guardar(K_ADMIN_TOKEN, null);
  }

  salirMesa() {
    this.tokenMesa.set(null);
    guardar(K_MESA_TOKEN, null);
  }
}