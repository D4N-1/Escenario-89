import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppState } from '../../core/app-state';
import { IntermissionService } from '../../core/intermission.service';
import { IntermissionItem } from '../../core/models';
import { Icon } from '../../shared/icon/icon';

type TabFiltro = 'todos' | 'activos' | 'programados' | 'inactivos';

@Component({
  selector: 'app-audios',
  imports: [Icon, FormsModule],
  templateUrl: './audios.html',
  styleUrl: './audios.css',
})
export class Audios implements OnInit, OnDestroy {
  state = inject(AppState);
  intermissions = inject(IntermissionService);

  busqueda = signal('');
  filtroActivo = signal<TabFiltro>('todos');
  reproduciendoUuid = signal<string | null>(null);
  tiempoActual = signal(0);
  duracion = signal(0);
  progreso = signal(0);
  toast = signal('');

  // Modal para subir audio a intermission
  modalSubir = signal(false);
  formFile = signal<File | null>(null);
  formTitle = signal('');
  formDescription = signal('');
  formStartTime = signal('20:00');
  formEndTime = signal('04:00');
  formEverySongs = signal<number | null>(5);
  formConFrecuencia = signal(true);
  formActive = signal(true);
  formError = signal('');
  subiendo = signal(false);

  private audioEl: HTMLAudioElement | null = null;

  ngOnInit() {
    this.intermissions.cargar();
  }

  ngOnDestroy() {
    this.detener();
  }

  // Lista de items de intermission filtrada
  items = computed<IntermissionItem[]>(() => {
    let lista = this.intermissions.items();
    const f = this.filtroActivo();

    if (f === 'activos') {
      lista = lista.filter(i => i.active);
    } else if (f === 'programados') {
      lista = lista.filter(i => i.active && i.everySongs && i.everySongs > 0);
    } else if (f === 'inactivos') {
      lista = lista.filter(i => !i.active);
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

  // Contadores
  total = computed(() => this.intermissions.items().length);
  activos = computed(() => this.intermissions.items().filter(i => i.active).length);
  programados = computed(() => this.intermissions.items().filter(i => i.active && i.everySongs && i.everySongs > 0).length);
  inactivos = computed(() => this.intermissions.items().filter(i => !i.active).length);

  // Item que está sonando actualmente
  itemSonando = computed(() => {
    const uuid = this.reproduciendoUuid();
    if (!uuid) return null;
    return this.intermissions.items().find(i => i.uuid === uuid) || null;
  });

  togglePlay(item: IntermissionItem) {
    if (this.reproduciendoUuid() === item.uuid) {
      this.detener();
      return;
    }

    this.detener();

    if (!item.url) {
      this.mostrarToast('Este elemento no tiene una URL válida.');
      return;
    }

    const urlResuelta = this.intermissions.resolverUrl(item.url);
    this.audioEl = new Audio(urlResuelta);

    this.audioEl.onloadedmetadata = () => {
      this.duracion.set(this.audioEl?.duration || 0);
    };

    this.audioEl.ontimeupdate = () => {
      if (!this.audioEl) return;
      const cur = this.audioEl.currentTime;
      const dur = this.audioEl.duration || 1;
      this.tiempoActual.set(cur);
      this.progreso.set(Math.min(100, (cur / dur) * 100));
    };

    this.audioEl.onended = () => {
      this.detener();
    };

    this.audioEl.onerror = () => {
      this.mostrarToast('No se pudo reproducir este archivo multimedia.');
      this.detener();
    };

    this.audioEl.play().then(() => {
      this.reproduciendoUuid.set(item.uuid);
    }).catch(err => {
      this.mostrarToast('Error al reproducir: ' + (err?.message || 'Error'));
      this.detener();
    });
  }

  detener() {
    if (this.audioEl) {
      try {
        this.audioEl.pause();
        this.audioEl.currentTime = 0;
      } catch {}
      this.audioEl = null;
    }
    this.reproduciendoUuid.set(null);
    this.progreso.set(0);
    this.tiempoActual.set(0);
  }

  onSeek(event: MouseEvent) {
    if (this.audioEl && this.audioEl.duration) {
      const target = event.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
      this.audioEl.currentTime = (pct / 100) * this.audioEl.duration;
      this.progreso.set(pct);
    }
  }

  async reproducirEnSiguientePausa(item: IntermissionItem) {
    try {
      const msg = await this.intermissions.reproducirEnSiguientePausa(item.uuid);
      this.mostrarToast(msg || `"${item.title}" programado para la siguiente pausa`);
    } catch (e: any) {
      this.mostrarToast(e?.message || 'Error al programar en pausa');
    }
  }

  async alternarEstado(item: IntermissionItem) {
    try {
      await this.intermissions.alternarEstado(item);
      this.mostrarToast(!item.active ? `"${item.title}" activado` : `"${item.title}" pausado`);
    } catch (e: any) {
      this.mostrarToast(e?.message || 'Error al cambiar estado');
    }
  }

  async eliminar(item: IntermissionItem) {
    if (!confirm(`¿Eliminar "${item.title}" de las pausas publicitarias?`)) return;
    try {
      if (this.reproduciendoUuid() === item.uuid) {
        this.detener();
      }
      await this.intermissions.eliminar(item.uuid);
      this.mostrarToast('Eliminado con éxito');
    } catch (e: any) {
      this.mostrarToast(e?.message || 'Error al eliminar');
    }
  }

  // --- MODAL DE SUBIDA ---

  abrirModal() {
    this.formFile.set(null);
    this.formTitle.set('');
    this.formDescription.set('');
    this.formStartTime.set('20:00');
    this.formEndTime.set('04:00');
    this.formEverySongs.set(5);
    this.formConFrecuencia.set(true);
    this.formActive.set(true);
    this.formError.set('');
    this.modalSubir.set(true);
  }

  cerrarModal() {
    this.modalSubir.set(false);
    this.subiendo.set(false);
  }

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const f = input.files[0];
      this.formFile.set(f);
      if (!this.formTitle()) {
        const nombreSinExt = f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        this.formTitle.set(nombreSinExt.charAt(0).toUpperCase() + nombreSinExt.slice(1));
      }
    }
  }

  async guardarAudio() {
    const file = this.formFile();
    const title = this.formTitle().trim();

    if (!file) {
      this.formError.set('Selecciona un archivo de audio o video');
      return;
    }
    if (!title) {
      this.formError.set('Ingresa un título');
      return;
    }

    this.subiendo.set(true);
    this.formError.set('');

    try {
      const everySongs = this.formConFrecuencia() ? Number(this.formEverySongs()) : null;
      await this.intermissions.crear({
        file,
        title,
        description: this.formDescription().trim() || undefined,
        startTime: this.formStartTime(),
        endTime: this.formEndTime(),
        everySongs,
        active: this.formActive(),
      });

      this.mostrarToast(`"${title}" subido y registrado`);
      this.cerrarModal();
      await this.intermissions.cargar();
    } catch (e: any) {
      this.formError.set(e?.message || 'Error al subir a intermission');
    } finally {
      this.subiendo.set(false);
    }
  }

  formatearTiempo(segundos: number): string {
    const s = Math.max(0, Math.floor(segundos));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem.toString().padStart(2, '0')}`;
  }

  formatearBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  mostrarToast(mensaje: string) {
    this.toast.set(mensaje);
    setTimeout(() => {
      if (this.toast() === mensaje) this.toast.set('');
    }, 3500);
  }
}