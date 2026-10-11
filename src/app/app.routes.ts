import { Routes } from '@angular/router';
import { Home } from './client/home/home';
import { Results } from './client/results/results';
import { Added } from './client/added/added';
import { ConfirmDialog } from './shared/confirm-dialog/confirm-dialog';
import { Splash } from './splash/splash';
import { Login } from './admin/login/login';
import { Layout } from './admin/layout/layout';
import { Panel } from './admin/panel/panel';
import { PanelCerrando } from './admin/panel-cerrando/panel-cerrando';
import { PanelCerrado } from './admin/panel-cerrado/panel-cerrado';
import { Anuncios } from './admin/anuncios/anuncios';
import { Audios } from './admin/audios/audios';
import { Pantalla } from './pantalla/pantalla';
import { Vistas } from './vistas/vistas';

export const routes: Routes = [
  // Cliente (móvil, se llega por QR)
  { path: '', component: Home },
  { path: 'buscar', component: Results },
  { path: 'agregado', component: Added },
  { path: 'confirmar', component: ConfirmDialog },

  // Pantalla secundaria (TV / proyector) y splash
  { path: 'pantalla', component: Pantalla },
  { path: 'splash', component: Splash },

  // Administración
  { path: 'admin/login', component: Login },
  {
    path: 'admin',
    component: Layout,
    children: [
      { path: '', component: Panel },
      { path: 'cerrando', component: PanelCerrando },
      { path: 'cerrado', component: PanelCerrado },
      { path: 'anuncios', component: Anuncios },
      { path: 'anuncios/nuevo', component: Anuncios, data: { modal: true } },
      { path: 'audios', component: Audios },
    ],
  },

  // Índice de todas las vistas (solo desarrollo)
  { path: 'vistas', component: Vistas },
  { path: '**', redirectTo: '' },
];
