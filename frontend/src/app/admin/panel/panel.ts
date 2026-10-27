import { Component, OnDestroy, OnInit, effect, inject, signal, untracked } from '@angular/core';
import { Icon } from '../../shared/icon/icon';
import { Buscador } from '../../shared/buscador/buscador';
import { AppState } from '../../core/app-state';
import { PlayerService } from '../../core/player.service';
import { YtSlot } from '../../shared/yt-player/yt-slot';

declare const window: any;

@Component({
  selector: 'app-panel',
  imports: [Icon, Buscador, YtSlot],
  templateUrl: './panel.html',
  styleUrl: './panel.css',
})
export class Panel implements OnInit, OnDestroy {
  state = inject(AppState);
  player = inject(PlayerService);

  previewRestringido = signal<boolean>(false);
  private ytPlayer: any = null;
  private ultimoVideoId = '';
  private isDestroyed = false;
  private isCreatingPlayer = false;
  private lastSeekTimestamp = 0;
  private lastPausedTimeApplied = -1;

  constructor() {
    // Sincronizar canción y cargar en el reproductor de preview
    effect(() => {
      const cancion = this.state.sonando();
      const vId = cancion?.videoId || '';
      const introActivo = this.player.karaokeIntroActivo();
      const intermission = !!this.player.intermissionActual();
      const estado = this.state.estado();

      if (!vId || estado === 'cerrado') {
        this.ultimoVideoId = '';
        this.previewRestringido.set(false);
        this.destruirPlayer();
        return;
      }

      // Si hay intro de karaoke o pausa publicitaria, pausar preview y esperar
      if (introActivo || intermission) {
        this.pausarODestruir();
        return;
      }

      // Si cambió el video o si el reproductor aún no se ha instanciado
      if (vId !== this.ultimoVideoId || !this.ytPlayer) {
        this.ultimoVideoId = vId;
        this.previewRestringido.set(false);
        this.lastPausedTimeApplied = -1;
        this.cargarOActualizarPlayer(vId);
      }
    });

    // Sincronizar estado Play / Pause con el reproductor principal de la TV
    effect(() => {
      const isPlaying = this.state.reproduciendo();
      const introActivo = this.player.karaokeIntroActivo();
      const intermission = !!this.player.intermissionActual();
      const navActivo = this.player.navegadorActivo();
      const cargando = this.player.cargando();

      if (!this.ytPlayer || introActivo || intermission) return;

      try {
        if (isPlaying && navActivo && !cargando) {
          this.lastPausedTimeApplied = -1;
          if (typeof this.ytPlayer.mute === 'function') {
            this.ytPlayer.mute();
          }

          const pState = typeof this.ytPlayer.getPlayerState === 'function' ? this.ytPlayer.getPlayerState() : -1;
          // Solo si no está ya reproduciendo o cargando, saltar e iniciar
          if (pState !== 1 && pState !== 3) {
            const curTv = untracked(() => this.player.tiempoSegundos());
            if (curTv > 0 && typeof this.ytPlayer.seekTo === 'function') {
              this.ytPlayer.seekTo(curTv, true);
              this.lastSeekTimestamp = Date.now();
            }
            if (typeof this.ytPlayer.playVideo === 'function') {
              this.ytPlayer.playVideo();
            }
          }
        } else if ((!isPlaying || !navActivo || cargando) && typeof this.ytPlayer.pauseVideo === 'function') {
          this.ytPlayer.pauseVideo();
          const t = untracked(() => this.player.tiempoSegundos());
          if (typeof this.ytPlayer.seekTo === 'function') {
            this.ytPlayer.seekTo(t, true);
            this.lastPausedTimeApplied = t;
            this.lastSeekTimestamp = Date.now();
          }
        }
      } catch { }
    });

    // Sincronizar tiempo cuando el usuario busca o retrocede/adelanta
    effect(() => {
      const tiempo = this.player.tiempoSegundos();
      const isPlaying = this.state.reproduciendo();
      const introActivo = this.player.karaokeIntroActivo();
      const intermission = !!this.player.intermissionActual();

      if (introActivo || intermission || !this.ytPlayer) return;

      // Si está en pausa y el usuario arrastró o retrocedió/adelantó en la barra:
      if (!isPlaying && typeof this.ytPlayer.seekTo === 'function') {
        if (Math.abs(this.lastPausedTimeApplied - tiempo) > 0.5 && Date.now() - this.lastSeekTimestamp > 300) {
          try {
            this.ytPlayer.seekTo(tiempo, true);
            this.ytPlayer.pauseVideo();
            this.lastPausedTimeApplied = tiempo;
            this.lastSeekTimestamp = Date.now();
          } catch { }
        }
        return;
      }

      // Si está reproduciendo, solo sincronizar si hay un salto grande manual (seek)
      if (isPlaying) {
        this.sincronizarTiempoPreview(tiempo);
      }
    });
  }

  ngOnInit() {
    if (typeof window !== 'undefined') {
      window.addEventListener('message', this.onWindowMessage);
    }
  }

  ngOnDestroy() {
    this.isDestroyed = true;
    if (typeof window !== 'undefined') {
      window.removeEventListener('message', this.onWindowMessage);
    }
    this.destruirPlayer();
  }

  /**
   * Sincronizador de preview con la TV:
   * Solo salta si hay un salto manual grande (seek) para evitar que la preview se quede buffereando.
   */
  private sincronizarTiempoPreview(tiempoTv: number) {
    if (!this.ytPlayer || this.isDestroyed || this.previewRestringido() || !this.state.reproduciendo() || !this.player.navegadorActivo()) return;

    // Cooldown para no saturar YouTube con llamadas seekTo consecutivas
    if (Date.now() - this.lastSeekTimestamp < 2500) return;

    try {
      const cur = typeof this.ytPlayer.getCurrentTime === 'function' ? this.ytPlayer.getCurrentTime() : null;
      if (typeof cur !== 'number' || isNaN(cur)) return;

      const diff = Math.abs(cur - tiempoTv);

      // Solo saltar si hay un desvío o salto grande manual (ej. usuario adelantó o atrasó en la TV)
      if (diff >= 3.5) {
        this.ytPlayer.seekTo(tiempoTv, true);
        this.lastSeekTimestamp = Date.now();
      }
    } catch { }
  }

  private initYtApi(callback: () => void) {
    if (typeof window === 'undefined') return;
    if (window.YT && window.YT.Player) {
      callback();
      return;
    }

    let hasCalled = false;
    const runOnce = () => {
      if (hasCalled || this.isDestroyed) return;
      hasCalled = true;
      if (checkInterval) clearInterval(checkInterval);
      callback();
    };

    const checkInterval = setInterval(() => {
      if (window.YT && window.YT.Player) {
        runOnce();
      }
    }, 50);

    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prevReady === 'function') {
        try { prevReady(); } catch { }
      }
      runOnce();
    };

    if (!document.getElementById('yt-iframe-api-script')) {
      const tag = document.createElement('script');
      tag.id = 'yt-iframe-api-script';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
  }

  private cargarOActualizarPlayer(vId: string) {
    if (!vId || this.isDestroyed) return;

    this.initYtApi(() => {
      if (this.isDestroyed || vId !== this.ultimoVideoId) return;

      const startSec = Math.max(0, Math.floor(this.player.tiempoSegundos() || 0));

      // Si el reproductor ya existe, no está restringido y tiene API activa, reutilizarlo
      if (this.ytPlayer && !this.previewRestringido() && (typeof this.ytPlayer.cueVideoById === 'function' || typeof this.ytPlayer.loadVideoById === 'function')) {
        try {
          const debeIniciarYa = this.state.reproduciendo() && this.player.navegadorActivo() && !this.player.cargando();
          if (debeIniciarYa && typeof this.ytPlayer.loadVideoById === 'function') {
            this.ytPlayer.loadVideoById({
              videoId: vId,
              startSeconds: startSec,
            });
          } else if (typeof this.ytPlayer.cueVideoById === 'function') {
            this.ytPlayer.cueVideoById({
              videoId: vId,
              startSeconds: startSec,
            });
          } else {
            this.ytPlayer.loadVideoById({
              videoId: vId,
              startSeconds: startSec,
            });
            this.ytPlayer.pauseVideo();
          }
          this.ytPlayer.mute();
          return;
        } catch {
          this.destruirPlayer();
        }
      }

      this.crearInstanciaPlayer(vId);
    });
  }

  private crearInstanciaPlayer(vId: string, intento = 0) {
    if (this.isDestroyed || vId !== this.ultimoVideoId) return;

    // Asegurar que el contenedor DOM esté disponible (reintento si Angular está pintando)
    if (!this.asegurarContenedorPlayer()) {
      if (intento < 15) {
        setTimeout(() => this.crearInstanciaPlayer(vId, intento + 1), 60);
      }
      return;
    }

    if (this.isCreatingPlayer) return;
    this.isCreatingPlayer = true;

    const startSec = Math.max(0, Math.floor(this.player.tiempoSegundos() || 0));

    try {
      this.destruirPlayer();
      this.asegurarContenedorPlayer();

      this.ytPlayer = new window.YT.Player('panel-preview-yt-player', {
        videoId: vId,
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          playsinline: 1,
          start: startSec,
          origin: window.location.origin,
        },
        events: {
          onReady: (e: any) => {
            this.isCreatingPlayer = false;
            if (this.isDestroyed) return;
            try {
              e.target.mute();
              const curTv = this.player.tiempoSegundos();
              if (curTv > 0) {
                e.target.seekTo(curTv, true);
              }
              if (
                this.state.reproduciendo() &&
                this.player.navegadorActivo() &&
                !this.player.cargando() &&
                !this.player.karaokeIntroActivo() &&
                !this.player.intermissionActual()
              ) {
                e.target.playVideo();
              } else {
                e.target.pauseVideo();
              }
            } catch { }
          },
          onStateChange: (e: any) => {
            if (this.isDestroyed) return;
            // Estado 1 = PLAYING (el video inició correctamente)
            if (e.data === 1) {
              this.previewRestringido.set(false);
              // Si la TV está inactiva o no se está reproduciendo, mantener pausado
              if (!this.state.reproduciendo() || !this.player.navegadorActivo()) {
                try { e.target.pauseVideo(); } catch { }
              }
            }
          },
          onError: (e: any) => {
            this.isCreatingPlayer = false;
            // Errores de YouTube: 150 / 101 (copyright / no embebible), 100 (no encontrado), 2 / 5 (inválido / HTML5)
            console.warn('YouTube preview onError event:', e?.data);
            this.previewRestringido.set(true);
          },
        },
      });
    } catch (err) {
      this.isCreatingPlayer = false;
      console.warn('Error al crear instancia YT.Player preview (intento ' + intento + '):', err);
      if (intento < 5) {
        setTimeout(() => this.crearInstanciaPlayer(vId, intento + 1), 100);
      } else {
        this.previewRestringido.set(true);
      }
    }
  }

  private asegurarContenedorPlayer(): boolean {
    if (typeof document === 'undefined') return false;
    const wrap = document.querySelector('.stage-preview-player-wrap');
    if (!wrap) return false;
    let el = document.getElementById('panel-preview-yt-player');
    if (!el || el.tagName.toLowerCase() !== 'div') {
      if (el) {
        el.remove();
      }
      el = document.createElement('div');
      el.id = 'panel-preview-yt-player';
      wrap.appendChild(el);
    }
    return true;
  }

  private pausarODestruir() {
    if (this.ytPlayer && typeof this.ytPlayer.pauseVideo === 'function') {
      try { this.ytPlayer.pauseVideo(); } catch { }
    }
  }

  private destruirPlayer() {
    if (this.ytPlayer) {
      try {
        if (typeof this.ytPlayer.destroy === 'function') {
          this.ytPlayer.destroy();
        }
      } catch { }
      this.ytPlayer = null;
    }
    this.isCreatingPlayer = false;
  }

  private onWindowMessage = (event: MessageEvent) => {
    try {
      if (!event.origin || !event.origin.includes('youtube')) return;

      let data = event.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch { }
      }
      if (data) {
        const isError =
          data.event === 'onError' ||
          data.info === 101 ||
          data.info === 150 ||
          data.data === 150 ||
          data.data === 101 ||
          (data.info && (data.info.errorCode === 150 || data.info.errorCode === 101));
        if (isError) {
          this.previewRestringido.set(true);
        }
      }
    } catch { }
  };

  stateLabel(s: 'abierto' | 'cerrando' | 'cerrado'): string {
    switch (s) {
      case 'abierto': return 'Abierto';
      case 'cerrando': return 'Cerrando';
      case 'cerrado': return 'Cerrado';
    }
  }

  toggleFullscreen() {
    this.player.toggleFullscreen();
  }

  duplicarTv() {
    this.player.duplicarEnTv();
    // Iniciar de inmediato la preview si no estaba reproduciendo
    if (this.ytPlayer) {
      try {
        if (typeof this.ytPlayer.mute === 'function') {
          this.ytPlayer.mute();
        }
        const pState = typeof this.ytPlayer.getPlayerState === 'function' ? this.ytPlayer.getPlayerState() : -1;
        if (pState !== 1 && pState !== 3) {
          const cur = this.player.tiempoSegundos();
          if (cur > 0 && typeof this.ytPlayer.seekTo === 'function') {
            this.ytPlayer.seekTo(cur, true);
          }
          if (typeof this.ytPlayer.playVideo === 'function') {
            this.ytPlayer.playVideo();
          }
        }
      } catch { }
    }
  }

  onStageClick(event: MouseEvent) {
    if (this.state.estado() === 'cerrado' || this.player.intermissionActual() || this.player.karaokeIntroActivo()) return;
    const target = event.target as HTMLElement;
    if (target.closest('.stage-top-actions, .stage-overlay, button, a, app-buscador')) {
      return;
    }
    if (this.player.necesitaInteraccion() || this.player.muteado() || !this.state.reproduciendo()) {
      this.player.desbloquearAudio();
      return;
    }
    this.player.togglePlay();
  }
}