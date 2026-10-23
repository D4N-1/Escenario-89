import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from './session.service';

/**
 * Las pantallas del cliente (inicio, búsqueda, confirmación) solo se abren si ya escaneó el QR de su mesa.
 * - Con sesión de mesa: pasa.
 * - Con un enlace viejo /?mesa=CODIGO: lo manda a /mesa/CODIGO.
 * - Sin nada: pantalla "Escanea el QR de tu mesa".
 */
export const mesaGuard: CanActivateFn = (route) => {
  const session = inject(SessionService);
  const router = inject(Router);

  if (session.tokenMesa()) return true;

  const codigo = route.queryParamMap.get('mesa')?.trim();
  if (codigo) return router.createUrlTree(['/mesa', codigo]);

  return router.createUrlTree(['/sin-mesa']);
};