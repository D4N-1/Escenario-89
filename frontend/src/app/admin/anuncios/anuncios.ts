import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Icon } from '../../shared/icon/icon';
import { AppState } from '../../core/app-state';
import { IntermissionService, NuevoAnuncioDto } from '../../core/intermission.service';
import { PlayerService } from '../../core/player.service';
import { IntermissionItem } from '../../core/models';

type TabFiltro = 'todos' | 'activos' | 'programados' | 'inactivos';

@Component({
  selector: 'app-anuncios',
  imports: [Icon, RouterLink, FormsModule],
  templateUrl: './anuncios.html',
  styleUrl: './anuncios.css',
})
export class Anuncios implements OnInit {
  state = inject(AppState);
  intermissions = inject(IntermissionService);
  player = inject(PlayerService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  modal = signal(false);

  // Filtros
  tabActiva = signal<TabFiltro>('todos');
  busqueda = signal('');

  // Notificación rápida
  toast = signal('');
  procesandoPausaUuid = signal<string | null>(null);

  // Formulario de creación
  formTitle = signal('');
  formDescription = signal('');
  formStartTime = signal('20:00');
  formEndTime = signal('04:00');
  formEverySongs = signal<number | null>(5);
  formConFrecuencia = signal(true);
  formActive = signal(true);
  selectedFile = signal<File | null>(null);
  formError = signal('');

  // Formulario de edición (sin archivo)
  modalEditar = signal(false);
  itemEditando = signal<IntermissionItem | null>(null);
  editUuid = signal('');
  editTitle = signal('');
  editDescription = signal('');
  editStartTime = signal('20:00');
  editEndTime = signal('04:00');
  editEverySongs = signal<number | null>(5);
  editConFrecuencia = signal(true);
  editActive = signal(true);
  editError = signal('');
  guardandoEdicion = signal(false);

  ngOnInit() {
    this.intermissions.cargar();
    this.route.url.subscribe(() => {
      this.modal.set(!!this.route.snapshot.data['modal']);
    });
  }

  // Lista filtrada
  items = computed(() => {
    let lista = this.intermissions.anuncios();
    const q = this.busqueda().trim().toLowerCase();
    if (q) {
      lista = lista.filter(item =>
        item.title.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q))
      );
    }
    const tab = this.tabActiva();
    if (tab === 'activos') {
      lista = lista.filter(item => item.active);
    } else if (tab === 'programados') {
      lista = lista.filter(item => item.active && item.everySongs && item.everySongs > 0);
    } else if (tab === 'inactivos') {
      lista = lista.filter(item => !item.active);
    }
    return lista;
  });

  // Contadores
  total = computed(() => this.intermissions.anuncios().length);
  activos = computed(() => this.intermissions.anuncios().filter(i => i.active).length);
  programados = computed(() => this.intermissions.anuncios().filter(i => i.active && i.everySongs && i.everySongs > 0).length);
  inactivos = computed(() => this.intermissions.anuncios().filter(i => !i.active).length);

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile.set(input.files[0]);
      this.formError.set('');
    }
  }

  async guardar() {
    const title = this.formTitle().trim();
    if (!title) {
      this.formError.set('Ingresa un título para el anuncio.');
      return;
    }
    if (!this.selectedFile()) {
      this.formError.set('Debes seleccionar un archivo de video o audio.');
      return;
    }
    if (!this.formStartTime() || !this.formEndTime()) {
      this.formError.set('Especifica las horas de inicio y fin (HH:mm).');
      return;
    }

    try {
      this.formError.set('');
      const dto: NuevoAnuncioDto = {
        title,
        description: this.formDescription().trim() || undefined,
        startTime: this.formStartTime(),
        endTime: this.formEndTime(),
        everySongs: this.formConFrecuencia() ? this.formEverySongs() : null,
        active: this.formActive(),
        file: this.selectedFile()!,
      };

      await this.intermissions.crear(dto);
      this.mostrarToast('Anuncio creado con éxito');
      this.cerrarModal();
    } catch (e: any) {
      this.formError.set(e?.message || 'Error al guardar el anuncio.');
    }
  }

  probarEnPantalla(item: IntermissionItem) {
    const urlResuelta = this.intermissions.resolverUrl(item.url);
    const imgResuelta = item.image ? this.intermissions.resolverUrl(item.image) : '';
    this.player.reproducirIntermission([{ ...item, url: urlResuelta, image: imgResuelta }]);
    this.mostrarToast(`Emitiendo "${item.title}" en pantalla`);
  }

  estaEnSiguientePausa(item: IntermissionItem): boolean {
    return this.intermissions.manualProgramadoUuid() === item.uuid;
  }

  esProximoAutomatico(item: IntermissionItem): boolean {
    return this.intermissions.proximaEnPausa()?.uuid === item.uuid && this.intermissions.proximaEnPausa()?.type === 'auto';
  }

  obtenerContador(item: IntermissionItem) {
    return this.intermissions.obtenerContador(item.uuid);
  }

  async reproducirEnSiguientePausa(item: IntermissionItem) {
    if (this.procesandoPausaUuid()) return;
    this.procesandoPausaUuid.set(item.uuid);
    try {
      const res = await this.intermissions.reproducirEnSiguientePausa(item.uuid);
      this.mostrarToast(res.message);
    } catch (e: any) {
      this.mostrarToast(e?.message || 'Error al programar anuncio');
    } finally {
      this.procesandoPausaUuid.set(null);
    }
  }

  async alternarEstado(item: IntermissionItem) {
    try {
      await this.intermissions.alternarEstado(item);
      this.mostrarToast(!item.active ? 'Anuncio activado' : 'Anuncio pausado');
    } catch (e: any) {
      this.mostrarToast(e?.message || 'Error al cambiar estado');
    }
  }

  async eliminar(item: IntermissionItem) {
    if (!confirm(`¿Eliminar el anuncio "${item.title}"?`)) return;
    try {
      await this.intermissions.eliminar(item.uuid);
      this.mostrarToast('Anuncio eliminado con éxito');
    } catch (e: any) {
      this.mostrarToast(e?.message || 'Error al eliminar');
    }
  }

  cerrarModal() {
    this.router.navigate(['/admin/anuncios']);
    this.formTitle.set('');
    this.formDescription.set('');
    this.selectedFile.set(null);
    this.formError.set('');
  }

  abrirModalEditar(item: IntermissionItem) {
    this.itemEditando.set(item);
    this.editUuid.set(item.uuid);
    this.editTitle.set(item.title);
    this.editDescription.set(item.description || '');
    this.editStartTime.set(item.startTime ? item.startTime.substring(0, 5) : '20:00');
    this.editEndTime.set(item.endTime ? item.endTime.substring(0, 5) : '04:00');
    const conFreq = !!(item.everySongs && item.everySongs > 0);
    this.editConFrecuencia.set(conFreq);
    this.editEverySongs.set(conFreq ? item.everySongs! : 5);
    this.editActive.set(item.active);
    this.editError.set('');
    this.modalEditar.set(true);
  }

  cerrarModalEditar() {
    this.modalEditar.set(false);
    this.itemEditando.set(null);
    this.editError.set('');
    this.guardandoEdicion.set(false);
  }

  async guardarEdicion() {
    const uuid = this.editUuid();
    const title = this.editTitle().trim();
    if (!uuid) return;
    if (!title) {
      this.editError.set('Ingresa un título para el anuncio.');
      return;
    }
    if (!this.editStartTime() || !this.editEndTime()) {
      this.editError.set('Especifica las horas de inicio y fin (HH:mm).');
      return;
    }

    this.guardandoEdicion.set(true);
    this.editError.set('');

    try {
      await this.intermissions.actualizar({
        uuid,
        title,
        description: this.editDescription().trim() || undefined,
        startTime: this.editStartTime(),
        endTime: this.editEndTime(),
        everySongs: this.editConFrecuencia() ? this.editEverySongs() : null,
        active: this.editActive(),
      });
      this.mostrarToast(`Anuncio "${title}" actualizado con éxito`);
      this.cerrarModalEditar();
    } catch (e: any) {
      this.editError.set(e?.message || 'Error al actualizar el anuncio.');
    } finally {
      this.guardandoEdicion.set(false);
    }
  }

  private mostrarToast(mensaje: string) {
    this.toast.set(mensaje);
    setTimeout(() => {
      if (this.toast() === mensaje) this.toast.set('');
    }, 3500);
  }
}