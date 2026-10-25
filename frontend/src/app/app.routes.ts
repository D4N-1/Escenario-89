import { Routes } from '@angular/router';
import { Home } from './client/home/home';
import { Results } from './client/results/results';
import { Added } from './client/added/added';
import { ConfirmDialog } from './shared/confirm-dialog/confirm-dialog';
import { Splash } from './splash/splash';
import { Login } from './admin/login/login';
import { Layout } from './admin/layout/layout';
import { Panel } from './admin/panel/panel';
import { Anuncios } from './admin/anuncios/anuncios';
import { Audios } from './admin/audios/audios';
import { Pantalla } from './pantalla/pantalla';
import { Vistas } from './vistas/vistas';
import { adminGuard } from './core/admin.guard';
import { mesaGuard } from './core/mesa.guard';
import { Mesa } from './client/mesa/mesa';

export const routes: Routes = [

  // Cliente: entra escaneando el QR de su mesa (dominio/mesa/CODIGO)
  { path: 'mesa/:codigo', component: Mesa },
  { path: 'sin-mesa', component: Mesa },
  { path: '', component: Home, canActivate: [mesaGuard] },
  { path: 'buscar', component: Results, canActivate: [mesaGuard] },
  { path: 'agregado', component: Added, canActivate: [mesaGuard] },
  { path: 'confirmar', component: ConfirmDialog },

  { path: 'pantalla', component: Pantalla },
  { path: 'splash', component: Splash },

  { path: 'admin/login', component: Login },
  {
    path: 'admin',
    component: Layout,
    canActivate: [adminGuard],
    children: [
      { path: '', component: Panel },
      { path: 'cerrando', component: Panel },
      { path: 'cerrado', component: Panel },
      { path: 'anuncios', component: Anuncios },
      { path: 'anuncios/nuevo', component: Anuncios, data: { modal: true } },
      { path: 'audios', component: Audios },
    ],
  },

  { path: 'vistas', component: Vistas },
  { path: '**', redirectTo: '' },
];