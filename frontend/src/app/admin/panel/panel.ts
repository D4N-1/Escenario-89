import { Component, OnDestroy, OnInit, effect, inject, signal } from '@angular/core';
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
  private syncTimer: any = null;
  private lastSeekTimestamp = 0;
  private lastPausedTimeApplied = -1;

  constructor() {
    // Sincronizar canción y cargar en el reproductor de preview
    effect(() => {
      const cancion = this.state.sonando();
      const vId = cancion?.videoId || '';
      if (vId !== this.ultimoVideoId) {
        this.ultimoVideoId = vId;
        this.previewRestringido.set(false);
        this.lastPausedTimeApplied = -1;
        if (vId && this.state.estado() !== 'cerrado') {
          this.cargarOActualizarPlayer(vId);
        } else {
          this.pausarODestruir();
        }
      }
    });

    // Sincronizar estado Play / Pause con el reproductor principal de la TV
    effect(() => {
      const isPlaying = this.state.reproduciendo();
      if (this.ytPlayer) {
        try {
          if (isPlaying && typeof this.ytPlayer.playVideo === 'function') {
            this.lastPausedTimeApplied = -1;
            this.ytPlayer.playVideo();
          } else if (!isPlaying && typeof this.ytPlayer.pauseVideo === 'function') {
            this.ytPlayer.pauseVideo();
            // Al pausar, saltar una sola vez al segundo exacto para congelar el fotograma
            const t = this.player.tiempoSegundos();
            if (typeof this.ytPlayer.seekTo === 'function') {
              this.ytPlayer.seekTo(t, true);
              this.lastPausedTimeApplied = t;
              this.lastSeekTimestamp = Date.now();
            }
          }
        } catch { }
      }
    });

    // Sincronizar tiempo cuando el usuario busca o retrocede/adelanta
    effect(() => {
      const tiempo = this.player.tiempoSegundos();
      const isPlaying = this.state.reproduciendo();

      // Si está en pausa y el usuario arrastró o retrocedió/adelantó en la barra:
      if (!isPlaying && this.ytPlayer && typeof this.ytPlayer.seekTo === 'function') {
        if (Math.abs(this.lastPausedTimeApplied - tiempo) > 0.3 && Date.now() - this.lastSeekTimestamp > 300) {
          try {
            this.ytPlayer.seekTo(tiempo, true);
            this.ytPlayer.pauseVideo();
            this.lastPausedTimeApplied = tiempo;
            this.lastSeekTimestamp = Date.now();
          } catch { }
        }
        return;
      }

      // Si está reproduciendo, verificar y ajustar sincronía
      if (isPlaying) {
        this.sincronizarTiempoPreview(tiempo);
      }
    });
  }

  ngOnInit() {
    if (typeof window !== 'undefined') {
      window.addEventListener('message', this.onWindowMessage);
      const vId = this.state.sonando()?.videoId;
      if (vId && this.state.estado() !== 'cerrado') {
        this.cargarOActualizarPlayer(vId);
      }

      // Comprobación periódica suave de velocidad solo mientras se está reproduciendo
      this.syncTimer = setInterval(() => {
        if (!this.isDestroyed && this.state.sonando() && !this.previewRestringido() && this.state.reproduciendo()) {
          this.sincronizarTiempoPreview(this.player.tiempoSegundos());
        }
      }, 1000);
    }
  }

  ngOnDestroy() {
    this.isDestroyed = true;
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('message', this.onWindowMessage);
    }
    this.destruirPlayer();
  }

  /**
   * Sincronizador de alta precisión entre el video de la TV y la preview:
   * - Saltos grandes (>= 1.2s, al arrastrar o retroceder en la barra): seekTo directo con cooldown para evitar bucles.
   * - Desfases pequeños (0.2s - 1.2s): ajuste de velocidad continuo sin llamadas repetidas a seekTo.
   * - En pausa: NUNCA ejecuta bucles de seekTo; queda fijo en el fotograma.
   */
  private sincronizarTiempoPreview(tiempoTv: number) {
    if (!this.ytPlayer || this.isDestroyed || this.previewRestringido() || !this.state.reproduciendo()) return;

    // Respetar tiempo de asentamiento de YouTube tras un salto previo
    if (Date.now() - this.lastSeekTimestamp < 1000) return;

    try {
      const cur = typeof this.ytPlayer.getCurrentTime === 'function' ? this.ytPlayer.getCurrentTime() : null;
      if (typeof cur !== 'number' || isNaN(cur)) return;

      const diff = cur - tiempoTv; // > 0 preview adelantado, < 0 preview retrasado
      const absDiff = Math.abs(diff);

      // Si hay un salto mayor a 1.2 segundos (ej: retroceso o adelanto manual de varios segundos)
      if (absDiff >= 1.2) {
        this.ytPlayer.seekTo(tiempoTv + 0.05, true);
        this.lastSeekTimestamp = Date.now();
        if (typeof this.ytPlayer.setPlaybackRate === 'function') {
          this.ytPlayer.setPlaybackRate(1.0);
        }
        return;
      }

      // Micro-corrección de velocidad fluida sin pausas ni saltos bruscos
      if (typeof this.ytPlayer.setPlaybackRate === 'function') {
        if (diff < -0.2) {
          // El preview va un poco retrasado: acelerar sutilmente para alcanzar la TV
          this.ytPlayer.setPlaybackRate(1.25);
        } else if (diff > 0.2) {
          // El preview va un poco adelantado: ralentizar sutilmente para que la TV lo alcance
          this.ytPlayer.setPlaybackRate(0.75);
        } else {
          // En sincronía óptima (diferencia menor a 200ms)
          this.ytPlayer.setPlaybackRate(1.0);
        }
      }
    } catch { }
  }

  private initYtApi(callback: () => void) {
    if (typeof window === 'undefined') return;
    if (window.YT && window.YT.Player) {
      callback();
      return;
    }

    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prevReady === 'function') prevReady();
      if (!this.isDestroyed) callback();
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

      // Si el reproductor ya existe y está activo, reutilizarlo cargando el nuevo video
      if (this.ytPlayer && typeof this.ytPlayer.loadVideoById === 'function') {
        try {
          this.ytPlayer.loadVideoById({
            videoId: vId,
            startSeconds: startSec,
          });
          this.ytPlayer.mute();
          if (this.state.reproduciendo()) {
            this.ytPlayer.playVideo();
          } else {
            this.ytPlayer.pauseVideo();
          }
          return;
        } catch {
          this.destruirPlayer();
        }
      }

      // Si no existe, crear instancia oficial de YT.Player
      setTimeout(() => {
        if (this.isDestroyed) return;
        this.asegurarContenedorPlayer();

        try {
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
                if (this.isDestroyed) return;
                try {
                  e.target.mute();
                  const curTv = this.player.tiempoSegundos();
                  if (curTv > 0) {
                    e.target.seekTo(curTv + 0.06, true);
                  }
                  if (this.state.reproduciendo()) {
                    e.target.playVideo();
                  } else {
                    e.target.pauseVideo();
                  }
                } catch { }
              },
              onStateChange: (e: any) => {
                if (this.isDestroyed) return;
                // Si el preview empieza a reproducirse, sincronizar inmediatamente con el segundo actual de la TV
                if (e.data === 1) {
                  const curTv = this.player.tiempoSegundos();
                  const curPreview = typeof e.target.getCurrentTime === 'function' ? e.target.getCurrentTime() : 0;
                  if (Math.abs(curPreview - curTv) > 0.3) {
                    e.target.seekTo(curTv + 0.06, true);
                  }
                }
              },
              onError: (e: any) => {
                // Códigos de error de YouTube:
                // 150 / 101: Derechos de autor / reproducción embebida bloqueada por el autor
                // 2: ID inválido, 5: Error HTML5, 100: No encontrado
                console.warn('YouTube preview onError event:', e?.data);
                this.previewRestringido.set(true);
              },
            },
          });
        } catch (err) {
          console.warn('Error inicializando YT.Player preview:', err);
          this.previewRestringido.set(true);
        }
      }, 60);
    });
  }

  private asegurarContenedorPlayer() {
    if (typeof document === 'undefined') return;
    const wrap = document.querySelector('.stage-preview-player-wrap');
    if (!wrap) return;
    let el = document.getElementById('panel-preview-yt-player');
    if (!el) {
      el = document.createElement('div');
      el.id = 'panel-preview-yt-player';
      wrap.appendChild(el);
    }
  }

  private pausarODestruir() {
    if (this.ytPlayer && typeof this.ytPlayer.pauseVideo === 'function') {
      try { this.ytPlayer.pauseVideo(); } catch { }
    }
  }

  private destruirPlayer() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    if (this.ytPlayer) {
      try {
        if (typeof this.ytPlayer.destroy === 'function') {
          this.ytPlayer.destroy();
        }
      } catch { }
      this.ytPlayer = null;
    }
  }

  private onWindowMessage = (event: MessageEvent) => {
    try {
      if (!event.origin || !event.origin.includes('youtube')) return;

      let data = event.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch { }
      }
      if (data && (data.event === 'onError' || data.info === 101 || data.info === 150 || data.data === 150 || data.data === 101)) {
        this.previewRestringido.set(true);
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