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
    this.player.reproducirIntermission([{ ...item, url: urlResuelta }]);
    this.mostrarToast(`Emitiendo "${item.title}" en pantalla`);
  }

  async reproducirEnSiguientePausa(item: IntermissionItem) {
    try {
      const msg = await this.intermissions.reproducirEnSiguientePausa(item.uuid);
      this.mostrarToast(msg || 'Anuncio programado para sonar en la siguiente pausa');
    } catch (e: any) {
      this.mostrarToast(e?.message || 'Error al programar anuncio');
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

  private mostrarToast(mensaje: string) {
    this.toast.set(mensaje);
    setTimeout(() => {
      if (this.toast() === mensaje) this.toast.set('');
    }, 3500);
  }
}