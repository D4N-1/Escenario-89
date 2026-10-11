import { Component, input } from '@angular/core';
import { Icon } from '../icon/icon';
import { NOW_PLAYING, QUEUE, QueueItem } from '../../mock-data';

@Component({
  selector: 'app-queue-panel',
  imports: [Icon],
  templateUrl: './queue-panel.html',
  styleUrl: './queue-panel.css',
})
export class QueuePanel {
  /** Muestra anuncios mezclados en la cola (vistas Anuncios / Audios) */
  showAds = input(false);
  now = NOW_PLAYING;

  get items(): QueueItem[] {
    const list = [...QUEUE];
    if (this.showAds()) {
      list.splice(4, 0, { title: 'La hora del brindis', artist: 'Anuncio', dur: '0:15', mesa: 0, ad: true });
      list.push({ title: 'Tu canción, tu escenario', artist: 'Anuncio', dur: '0:10', mesa: 0, ad: true });
    }
    return list;
  }
}
