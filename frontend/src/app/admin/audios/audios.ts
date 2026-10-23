import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Icon } from '../../shared/icon/icon';
import { AppState } from '../../core/app-state';
import { IntermissionService } from '../../core/intermission.service';
import { IntermissionItem } from '../../core/models';

@Component({
  selector: 'app-audios',
  imports: [Icon, RouterLink, FormsModule],
  templateUrl: './audios.html',
  styleUrl: '../anuncios/anuncios.css',
})
export class Audios implements OnInit, OnDestroy {
  state = inject(AppState);
  intermissions = inject(IntermissionService);

  busqueda = signal('');
  reproduciendoUuid = signal<string | null>(null);
  toast = signal('');
  mostrarTodos = signal(false);

  private audioEl: HTMLAudioElement | null = null;

  ngOnInit() {
    this.intermissions.cargar();
  }

  ngOnDestroy() {
    this.detener();
  }

  items = computed(() => {
    let lista = this.mostrarTodos()
      ? this.intermissions.items()
      : this.intermissions.audios();

    // Si no hay audios específicos pero sí intermedios, mostramos todos para que no quede vacía
    if (!this.mostrarTodos() && lista.length === 0 && this.intermissions.items().length > 0) {
      lista = this.intermissions.items();
    }

    const q = this.busqueda().trim().toLowerCase();
    if (q) {
      lista = lista.filter(item =>
        item.title.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q))
      );
    }
    return lista;
  });

  totalAudios = computed(() => this.intermissions.audios().length);
  totalTodos = computed(() => this.intermissions.items().length);

  togglePlay(item: IntermissionItem) {
    if (this.reproduciendoUuid() === item.uuid) {
      this.detener();
      return;
    }

    this.detener();

    if (!item.url) {
      this.mostrarToast('El audio no tiene una URL válida.');
      return;
    }

    this.audioEl = new Audio(item.url);
    this.audioEl.onended = () => {
      this.reproduciendoUuid.set(null);
    };
    this.audioEl.onerror = () => {
      this.mostrarToast('No se pudo reproducir este archivo.');
      this.reproduciendoUuid.set(null);
    };

    this.audioEl.play().then(() => {
      this.reproduciendoUuid.set(item.uuid);
    }).catch(err => {
      this.mostrarToast('Error al iniciar reproducción: ' + (err?.message || 'Error'));
      this.reproduciendoUuid.set(null);
    });
  }

  detener() {
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.currentTime = 0;
      this.audioEl = null;
    }
    this.reproduciendoUuid.set(null);
  }

  async reproducirEnSiguientePausa(item: IntermissionItem) {
    try {
      const msg = await this.intermissions.reproducirEnSiguientePausa(item.uuid);
      this.mostrarToast(msg || 'Audio programado para la siguiente pausa');
    } catch (e: any) {
      this.mostrarToast(e?.message || 'Error al programar');
    }
  }

  async alternarEstado(item: IntermissionItem) {
    try {
      await this.intermissions.alternarEstado(item);
      this.mostrarToast(!item.active ? 'Audio activado' : 'Audio pausado');
    } catch (e: any) {
      this.mostrarToast(e?.message || 'Error al cambiar estado');
    }
  }

  async eliminar(item: IntermissionItem) {
    if (!confirm(`¿Eliminar el audio "${item.title}"?`)) return;
    try {
      if (this.reproduciendoUuid() === item.uuid) {
        this.detener();
      }
      await this.intermissions.eliminar(item.uuid);
      this.mostrarToast('Audio eliminado');
    } catch (e: any) {
      this.mostrarToast(e?.message || 'Error al eliminar');
    }
  }

  private mostrarToast(mensaje: string) {
    this.toast.set(mensaje);
    setTimeout(() => {
      if (this.toast() === mensaje) this.toast.set('');
    }, 3500);
  }
}