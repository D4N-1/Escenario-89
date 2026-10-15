import { Component } from '@angular/core';
import { Icon } from '../icon/icon';

/** Menú contextual de una canción en cola (Mover / Eliminar) */
@Component({
  selector: 'app-queue-menu',
  imports: [Icon],
  template: `
    <div class="menu">
      <button>Mover <app-icon name="swap" /></button>
      <button class="del">Eliminar <app-icon name="delete" /></button>
    </div>`,
  styles: `
    .menu { background: #1c1c1c; border: 1px solid #333; border-radius: 8px; padding: 6px; width: 150px; }
    button { display: flex; width: 100%; justify-content: space-between; align-items: center; background: none; border: 0; color: var(--c-title); padding: 8px 10px; font-size: 12px; }
    .del app-icon { color: #e02020; } button:first-child app-icon { color: var(--c-gold); }`,
})
export class QueueMenu {}
