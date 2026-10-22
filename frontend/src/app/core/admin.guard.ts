import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from './session.service';

/** Las rutas /admin solo se abren con sesión de administrador. */
export const adminGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  return session.esAdmin() ? true : inject(Router).createUrlTree(['/admin/login']);
};