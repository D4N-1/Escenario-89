import { Component, HostListener, OnDestroy, OnInit, effect, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { Icon } from '../../shared/icon/icon';
import { QueuePanel } from '../../shared/queue-panel/queue-panel';
import { AppState } from '../../core/app-state';
import { BarService } from '../../core/bar.service';
import { EstadoLocal } from '../../core/models';
import { PlayerService } from '../../core/player.service';
import { QueueService } from '../../core/queue.service';
import { YtPlayer } from '../../shared/yt-player/yt-player';

@Component({ selector: 'app-layout', imports: [RouterOutlet, RouterLink, Icon, QueuePanel, YtPlayer], templateUrl: './layout.html', styleUrl: './layout.css' })
export class Layout implements OnInit, OnDestroy {
  router = inject(Router);
  state = inject(AppState);
  bar = inject(BarService);
  player = inject(PlayerService);
  queue = inject(QueueService);

  estadoMenuOpen = false;
  hourMenuOpen = false;
  hoursList = ['12:00 am', '1:00 am', '2:00 am', '3:00 am', '4:00 am', '5:00 am', '6:00 am', '10:00 pm', '11:00 pm'];
  quickPresets = ['1:00 am', '2:00 am', '3:00 am', '4:00 am', '5:00 am', '12:00 am'];

  editHora = 12;
  editMinuto = 0;
  editAmPm: 'am' | 'pm' = 'am';
  inputHoraTexto = '';

  constructor() {
    this.sincronizarCamposDesdeHora(this.state.horaCierre());
    effect(() => {
      const hc = this.state.horaCierre();
      if (!this.hourMenuOpen) {
        this.sincronizarCamposDesdeHora(hc);
      }
    });
  }

  get editMinutoFormatted(): string {
    return this.editMinuto.toString().padStart(2, '0');
  }

  ngOnInit() {
    this.sincronizarCamposDesdeHora(this.state.horaCierre());
    // Sincronizar estado del bar y hora de cierre desde el backend y sockets
    this.bar.iniciarSincronizacion();
    // La cola vive en el backend: sincronizada vía WebSockets
    this.queue.iniciarPolling();
  }

  ngOnDestroy() {
    this.bar.detenerSincronizacion();
    this.queue.detenerPolling();
    this.player.destruir();
  }

  get path() { return this.router.url.split('?')[0]; }
  get isPanel() { return this.path === '/admin' || this.path === '/admin/cerrando' || this.path === '/admin/cerrado'; }
  get isAnuncios() { return this.path.startsWith('/admin/anuncios'); }
  get isAudios() { return this.path.startsWith('/admin/audios'); }

  get activeState(): EstadoLocal {
    return this.state.estado();
  }

  toggleEstadoMenu() {
    this.estadoMenuOpen = !this.estadoMenuOpen;
    if (this.estadoMenuOpen) {
      this.hourMenuOpen = false;
    }
  }

  async selectState(state: EstadoLocal) {
    this.estadoMenuOpen = false;
    try {
      await this.bar.cambiarEstado(state);
    } catch (e) {
      console.error('Error al cambiar estado:', e);
    }
  }

  stateLabel(state: EstadoLocal): string {
    switch (state) {
      case 'abierto': return 'Abierto';
      case 'cerrando': return 'Cerrando';
      case 'cerrado': return 'Cerrado';
    }
  }

  onPillFocus() {
    this.hourMenuOpen = true;
    this.estadoMenuOpen = false;
    this.sincronizarCamposDesdeHora(this.state.horaCierre());
  }

  toggleHourMenu() {
    this.hourMenuOpen = !this.hourMenuOpen;
    if (this.hourMenuOpen) {
      this.estadoMenuOpen = false;
      this.sincronizarCamposDesdeHora(this.state.horaCierre());
    }
  }

  sincronizarCamposDesdeHora(horaStr: string) {
    const parsed = this.parseHora(horaStr);
    this.editHora = parsed.hora;
    this.editMinuto = parsed.minuto;
    this.editAmPm = parsed.ampm;
    this.sincronizarTexto();
  }

  sincronizarTexto() {
    this.inputHoraTexto = this.formatearHora(this.editHora, this.editMinuto, this.editAmPm);
  }

  formatearHora(h: number, m: number, ampm: 'am' | 'pm'): string {
    const minStr = m.toString().padStart(2, '0');
    return `${h}:${minStr} ${ampm}`;
  }

  /**
   * Pone los dos puntos automáticamente mientras el usuario escribe los dígitos (ej. 12 -> 12:, 1234 -> 12:34 am)
   */
  autoFormatearHora(val: string, isDeleting: boolean): string {
    if (!val) return '';
    if (isDeleting) return val;

    const trimmed = val.trim();

    // 1. Detectar sufijo am/pm si existe
    const ampmMatch = trimmed.match(/\s*(am|pm)$/i);
    const ampmSuffix = ampmMatch ? ` ${ampmMatch[1].toLowerCase()}` : '';
    const sinAmPm = trimmed.replace(/\s*(am|pm)$/i, '').trim();

    // 2. Si ya contiene dos puntos ":", asegurar formato h:m
    if (sinAmPm.includes(':')) {
      const parts = sinAmPm.split(':');
      const hDigits = parts[0].replace(/\D/g, '').slice(0, 2);
      const mDigits = parts[1].replace(/\D/g, '').slice(0, 2);

      if (mDigits.length === 2 && !ampmSuffix) {
        return `${hDigits}:${mDigits} ${this.editAmPm}`;
      }
      return `${hDigits}:${mDigits}${ampmSuffix}`;
    }

    // 3. Extraer solo dígitos numéricos
    const digits = sinAmPm.replace(/\D/g, '');

    if (digits.length === 0) {
      return '';
    }

    if (digits.length === 1) {
      return digits;
    }

    if (digits.length === 2) {
      const num = parseInt(digits, 10);
      // Si el número es mayor a 24 (ej. 35 -> 3:5)
      if (num > 24) {
        return `${digits[0]}:${digits[1]}`;
      }
      // Hora válida de 2 dígitos (ej. 10, 11, 12, 01..), agregar ":" automáticamente
      return `${digits}:`;
    }

    if (digits.length === 3) {
      const firstTwo = parseInt(digits.slice(0, 2), 10);
      if (firstTwo >= 10 && firstTwo <= 12) {
        return `${digits.slice(0, 2)}:${digits[2]}`;
      }
      // Números como 130 -> 1:30, 230 -> 2:30, 945 -> 9:45
      const h = digits[0];
      const m = digits.slice(1, 3);
      const suffix = ampmSuffix || ` ${this.editAmPm}`;
      return `${h}:${m}${suffix}`;
    }

    if (digits.length >= 4) {
      // 4 dígitos continuos como 1234 -> 12:34
      const hStr = digits.slice(0, 2);
      const mStr = digits.slice(2, 4);
      let h = parseInt(hStr, 10);
      let autoAmPm = this.editAmPm;
      if (h > 12) {
        autoAmPm = 'pm';
        h = h % 12;
        if (h === 0) h = 12;
      }
      const suffix = ampmSuffix || ` ${autoAmPm}`;
      return `${h}:${mStr}${suffix}`;
    }

    return val;
  }

  parseHora(texto: string): { hora: number; minuto: number; ampm: 'am' | 'pm' } {
    if (!texto) return { hora: 12, minuto: 0, ampm: 'am' };
    const clean = texto.trim().toLowerCase();

    // 12 horas con am/pm: ej. "11:31 am", "1:00pm", "12 am"
    const match12 = clean.match(/^(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)$/i);
    if (match12) {
      let h = parseInt(match12[1], 10);
      const m = match12[2] ? parseInt(match12[2], 10) : 0;
      const ampm = match12[3].toLowerCase() as 'am' | 'pm';
      if (h < 1) h = 1;
      if (h > 12) h = 12;
      return { hora: h, minuto: Math.min(59, Math.max(0, m)), ampm };
    }

    // Con dos puntos con o sin am/pm: ej. "12:34", "23:30", "1:30", "12:"
    const matchColon = clean.match(/^(\d{1,2}):(\d{0,2})\s*(am|pm)?$/i);
    if (matchColon) {
      let h = parseInt(matchColon[1], 10);
      const m = matchColon[2] ? Math.min(59, Math.max(0, parseInt(matchColon[2], 10))) : 0;
      let ampm = (matchColon[3]?.toLowerCase() as 'am' | 'pm') || this.editAmPm || 'am';
      if (h > 12) {
        ampm = 'pm';
        h = h % 12;
        if (h === 0) h = 12;
      } else if (h < 1) {
        h = 12;
      }
      return { hora: h, minuto: m, ampm };
    }

    // 3 o 4 dígitos continuos: ej. "1234", "1130", "130", "230"
    const matchContinuous = clean.match(/^(\d{3,4})\s*(am|pm)?$/i);
    if (matchContinuous) {
      const d = matchContinuous[1];
      const ampmSpecified = matchContinuous[2]?.toLowerCase() as 'am' | 'pm' | undefined;
      let h = 0;
      let m = 0;
      if (d.length === 4) {
        h = parseInt(d.slice(0, 2), 10);
        m = parseInt(d.slice(2, 4), 10);
      } else {
        // 3 dígitos: ej. 130 -> 1:30, 230 -> 2:30
        h = parseInt(d[0], 10);
        m = parseInt(d.slice(1, 3), 10);
      }
      let ampm = ampmSpecified || this.editAmPm || 'am';
      if (h > 12) {
        ampm = 'pm';
        h = h % 12;
        if (h === 0) h = 12;
      } else if (h < 1) {
        h = 12;
      }
      return { hora: h, minuto: Math.min(59, Math.max(0, m)), ampm };
    }

    // Solo un número de 1 o 2 dígitos: ej. "3", "12"
    const matchNum = clean.match(/^(\d{1,2})$/);
    if (matchNum) {
      let h = parseInt(matchNum[1], 10);
      let ampm: 'am' | 'pm' = this.editAmPm || 'am';
      if (h > 12) {
        ampm = 'pm';
        h = h % 12;
        if (h === 0) h = 12;
      } else if (h < 1) {
        h = 12;
      }
      return { hora: h, minuto: 0, ampm };
    }

    return { hora: 12, minuto: 0, ampm: 'am' };
  }

  stepHour(delta: number) {
    let h = this.editHora + delta;
    if (h > 12) h = 1;
    if (h < 1) h = 12;
    this.editHora = h;
    this.sincronizarTexto();
  }

  stepMinute(delta: number) {
    let m = (this.editMinuto + delta) % 60;
    if (m < 0) m += 60;
    this.editMinuto = m;
    this.sincronizarTexto();
  }

  setAmPm(ampm: 'am' | 'pm') {
    this.editAmPm = ampm;
    this.sincronizarTexto();
  }

  onHoraInput(e: Event) {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    if (!isNaN(val)) {
      this.editHora = Math.min(12, Math.max(1, val));
      this.sincronizarTexto();
    }
  }

  onMinutoInput(e: Event) {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    if (!isNaN(val)) {
      this.editMinuto = Math.min(59, Math.max(0, val));
      this.sincronizarTexto();
    }
  }

  onInputHoraTexto(e: Event) {
    const input = e.target as HTMLInputElement;
    const isDeleting = (e as InputEvent).inputType?.startsWith('delete') || false;

    const formatted = this.autoFormatearHora(input.value, isDeleting);
    if (formatted !== input.value) {
      input.value = formatted;
    }

    this.inputHoraTexto = formatted;
    const parsed = this.parseHora(formatted);
    this.editHora = parsed.hora;
    this.editMinuto = parsed.minuto;
    this.editAmPm = parsed.ampm;
  }

  onPillBlur() {
    if (this.inputHoraTexto) {
      const parsed = this.parseHora(this.inputHoraTexto);
      this.editHora = parsed.hora;
      this.editMinuto = parsed.minuto;
      this.editAmPm = parsed.ampm;
      this.inputHoraTexto = this.formatearHora(parsed.hora, parsed.minuto, parsed.ampm);
    } else {
      this.sincronizarCamposDesdeHora(this.state.horaCierre());
    }
  }

  async guardarHoraPersonalizada() {
    const textoAUsar = this.inputHoraTexto?.trim() || this.state.horaCierre();
    const parsed = this.parseHora(textoAUsar);
    const horaFinal = this.formatearHora(parsed.hora, parsed.minuto, parsed.ampm);
    await this.selectHour(horaFinal);
  }

  async selectHour(hour: string) {
    this.hourMenuOpen = false;
    this.sincronizarCamposDesdeHora(hour);
    try {
      await this.bar.cambiarHoraCierre(hour);
    } catch (e) {
      console.error('Error al cambiar hora de cierre:', e);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.estado-selector')) {
      this.estadoMenuOpen = false;
    }
    if (!target.closest('.hour-selector')) {
      if (this.hourMenuOpen) {
        this.sincronizarCamposDesdeHora(this.state.horaCierre());
      }
      this.hourMenuOpen = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.hourMenuOpen) {
      this.sincronizarCamposDesdeHora(this.state.horaCierre());
    }
    this.hourMenuOpen = false;
    this.estadoMenuOpen = false;
  }

  onSeek(event: MouseEvent) {
    if (this.state.estado() === 'cerrado' || this.player.intermissionActual()) return;
    const el = event.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
    this.player.seekPorcentaje(pct);
  }
}