import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { ApiService } from '../../core/api.service';
import { AppState } from '../../core/app-state';
import { AudioEntity, AudioItem } from '../../core/models';
import { Icon } from '../../shared/icon/icon';

@Component({
  selector: 'app-audios',
  imports: [Icon, FormsModule],
  templateUrl: './audios.html',
  styleUrl: './audios.css',
})
export class Audios implements OnInit, OnDestroy {
  api = inject(ApiService);
  state = inject(AppState);

  listaAudios = signal<AudioEntity[]>([]);
  cargando = signal(false);
  error = signal('');

  busqueda = signal('');
  reproduciendoUuid = signal<string | null>(null);
  tiempoActual = signal(0);
  duracion = signal(0);
  progreso = signal(0);
  toast = signal('');

  // Modal para subir audio
  modalSubir = signal(false);
  formFile = signal<File | null>(null);
  formTitle = signal('');
  formDescription = signal('');
  formError = signal('');
  subiendo = signal(false);

  // Modal para editar audio
  modalEditar = signal(false);
  editUuid = signal('');
  editTitle = signal('');
  editDescription = signal('');
  editError = signal('');
  guardandoEdicion = signal(false);

  private audioEl: HTMLAudioElement | null = null;

  ngOnInit() {
    this.cargar();
  }

  ngOnDestroy() {
    this.detener();
  }

  // Lista de items de audio filtrada por búsqueda
  items = computed<AudioEntity[]>(() => {
    let lista = this.listaAudios();
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
  total = computed(() => this.listaAudios().length);

  // Item que está sonando actualmente
  itemSonando = computed(() => {
    const uuid = this.reproduciendoUuid();
    if (!uuid) return null;
    return this.listaAudios().find(i => i.uuid === uuid) || null;
  });

  resolverUrl(path: string | undefined): string {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:') || path.startsWith('data:')) return path;

    const baseApi = (environment?.apiUrl || 'http://localhost:3000').replace(/\/+$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;

    if (baseApi.endsWith('/api') && cleanPath.startsWith('/api/')) {
      return `${baseApi.slice(0, -4)}${cleanPath}`;
    }

    return `${baseApi}${cleanPath}`;
  }

  // GET /audio
  async cargar(): Promise<AudioEntity[]> {
    this.cargando.set(true);
    this.error.set('');
    try {
      const res = await this.api.pedir<{ data: AudioEntity[] }>('admin', 'GET', '/audio?limit=100');
      const lista = (res?.data ?? []).map(item => ({
        ...item,
        url: this.resolverUrl(item.url),
      }));
      this.listaAudios.set(lista);
      this.sincronizarConAppState(lista);
      return lista;
    } catch (err: any) {
      const msg = err?.message || 'No se pudieron cargar los audios';
      this.error.set(msg);
      return [];
    } finally {
      this.cargando.set(false);
    }
  }

  private sincronizarConAppState(lista: AudioEntity[]) {
    const audios: AudioItem[] = lista.map((item, idx) => ({
      id: item.id ?? idx + 1,
      uuid: item.uuid,
      titulo: item.title,
      detalle: item.description || 'Audio del sistema',
      duracion: 'Audio',
      sonando: false,
      url: item.url,
    }));
    this.state.audios.set(audios);
  }

  togglePlay(item: AudioEntity) {
    if (this.reproduciendoUuid() === item.uuid) {
      this.detener();
      return;
    }

    this.detener();

    if (!item.url) {
      this.mostrarToast('Este audio no tiene una URL válida.');
      return;
    }

    const urlResuelta = this.resolverUrl(item.url);
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
      this.mostrarToast('No se pudo reproducir este archivo de audio.');
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

  prepararEnCabina(item: AudioEntity) {
    this.mostrarToast(`"${item.title}" preparado para reproducir en vivo`);
  }

  // --- MODAL DE SUBIDA (POST /audio) ---

  abrirModal() {
    this.formFile.set(null);
    this.formTitle.set('');
    this.formDescription.set('');
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
      this.formError.set('Selecciona un archivo de audio (.mp3, .wav, .ogg, .flac, etc.)');
      return;
    }
    if (!title) {
      this.formError.set('Ingresa un título para el audio');
      return;
    }

    this.subiendo.set(true);
    this.formError.set('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      if (this.formDescription().trim()) {
        formData.append('description', this.formDescription().trim());
      }

      await this.api.pedir('admin', 'POST', '/audio', formData);
      this.mostrarToast(`"${title}" subido con éxito`);
      this.cerrarModal();
      await this.cargar();
    } catch (e: any) {
      this.formError.set(e?.message || 'Error al subir el audio');
    } finally {
      this.subiendo.set(false);
    }
  }

  // --- MODAL DE EDICIÓN (PATCH /audio) ---

  abrirModalEditar(item: AudioEntity) {
    this.editUuid.set(item.uuid);
    this.editTitle.set(item.title);
    this.editDescription.set(item.description || '');
    this.editError.set('');
    this.modalEditar.set(true);
  }

  cerrarModalEditar() {
    this.modalEditar.set(false);
    this.guardandoEdicion.set(false);
  }

  async guardarEdicion() {
    const uuid = this.editUuid();
    const title = this.editTitle().trim();
    if (!uuid) return;
    if (!title) {
      this.editError.set('Ingresa un título para el audio');
      return;
    }

    this.guardandoEdicion.set(true);
    this.editError.set('');

    try {
      await this.api.pedir('admin', 'PATCH', '/audio', {
        uuid,
        title,
        description: this.editDescription().trim() || undefined,
      });

      this.listaAudios.update(lista =>
        lista.map(x => (x.uuid === uuid ? {
          ...x,
          title,
          description: this.editDescription().trim() || undefined,
        } : x))
      );
      this.sincronizarConAppState(this.listaAudios());

      this.mostrarToast(`"${title}" actualizado con éxito`);
      this.cerrarModalEditar();
    } catch (e: any) {
      this.editError.set(e?.message || 'Error al actualizar el audio');
    } finally {
      this.guardandoEdicion.set(false);
    }
  }

  // --- ELIMINAR (DELETE /audio/:uuid) ---

  async eliminar(item: AudioEntity) {
    if (!confirm(`¿Eliminar el audio "${item.title}"?`)) return;
    try {
      if (this.reproduciendoUuid() === item.uuid) {
        this.detener();
      }
      await this.api.pedir('admin', 'DELETE', `/audio/${item.uuid}`);
      this.listaAudios.update(lista => lista.filter(x => x.uuid !== item.uuid));
      this.sincronizarConAppState(this.listaAudios());
      this.mostrarToast('Audio eliminado con éxito');
    } catch (e: any) {
      this.mostrarToast(e?.message || 'Error al eliminar');
    }
  }

  formatearFechaHora(fecha?: string): string {
    if (!fecha) return 'Disponible en cabina';
    try {
      const d = new Date(fecha);
      if (isNaN(d.getTime())) return 'Disponible en cabina';
      return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      return 'Disponible en cabina';
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