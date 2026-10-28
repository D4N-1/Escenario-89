import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { environment } from '../../environments/environment';
import { ApiService } from './api.service';
import { AppState } from './app-state';
import { Cancion, IntermissionItem } from './models';
import { QueueService } from './queue.service';
import { SocketService } from './socket.service';
import { YoutubeService } from './youtube.service';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export type PlayerRole = 'admin' | 'pantalla';

export interface PlayerBroadcastMessage {
  type: 'PLAY' | 'PAUSE' | 'CHANGE_SONG' | 'SEEK' | 'SYNC_STATE' | 'REQUEST_SYNC' | 'TIME_SYNC' | 'INTERMISSION_START' | 'INTERMISSION_END' | 'KARAOKE_INTRO_START' | 'KARAOKE_INTRO_END' | 'STREAM_LOADING';
  song?: Cancion | null;
  time?: number;
  playing?: boolean;
  sentAt?: number;
  intermission?: IntermissionItem | null;
  resumeSong?: boolean;
  audioIndex?: number;
  karaokeIntro?: boolean;
  streamUrl?: string | null;
  streamLoading?: boolean;
}

@Injectable({ providedIn: 'root' })
export class PlayerService {
  private state = inject(AppState);
  private yt = inject(YoutubeService);
  private queue = inject(QueueService);
  private socket = inject(SocketService);
  private api = inject(ApiService);

  private player: any = null;
  private currentElementId = 'admin-yt-player';
  private currentContainerId = 'admin-player-container';
  private currentVideoId = '';
  private currentSongUuid: string | undefined = '';
  private loadingVideoId = '';
  private pendingSong: Cancion | null = null;
  private pendingTime = 0;
  private syncTick = 0;
  private timer: any = null;

  // Stream directo (videos bloqueados en YT mediante yt-dlp)
  streamUrl = signal<string | null>(null);
  solicitandoStream = signal<boolean>(false);
  adminStreamVideo: HTMLVideoElement | null = null;
  tvStreamVideo: HTMLVideoElement | null = null;
  private reintentosStream = 0;
  private ultimoErrorStream = 0;
  private apiLoadedPromise: Promise<void> | null = null;
  private channel: BroadcastChannel | null = null;
  private role: PlayerRole = 'admin';
  private lastSyncSeekTime = 0;
  private currentPlaybackRate = 1.0;
  private lastAdminTime = 0;
  private lastAdminTimeAt = 0;
  private initialSyncDone = false;
  private listenerInteraccion: (() => void) | null = null;
  private timeoutAutoplay: any = null;
  private timeoutWatchdogPlayback: any = null;

  // Introducción karaoke tras canción normal
  karaokeIntroActivo = signal<boolean>(false);
  karaokeIntroHabilitado = signal<boolean>(
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('e89_karaoke_intro_habilitado') !== 'false'
      : true
  );

  toggleKaraokeIntroHabilitado(valor?: boolean) {
    const nuevo = valor !== undefined ? valor : !this.karaokeIntroHabilitado();
    this.karaokeIntroHabilitado.set(nuevo);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('e89_karaoke_intro_habilitado', String(nuevo));
      } catch {}
    }
    if (!nuevo && this.karaokeIntroActivo()) {
      this.saltarKaraokeIntro();
    }
  }
  private cancionPrevia: Cancion | null = null;
  private audioIntro: HTMLAudioElement | null = null;
  private timeoutIntro: any = null;
  private cancionIntroPendiente: Cancion | null = null;
  private introEjecutadaParaUuid: string | null = null;

  progreso = signal<number>(0);
  tiempoSegundos = signal<number>(0);
  duracionSegundos = signal<number>(0);
  tiempoFormateado = signal<string>('0:00');
  duracionFormateada = signal<string>('0:00');
  cargando = signal<boolean>(false);
  listo = signal<boolean>(false);
  volumen = signal<number>(100);
  muteado = signal<boolean>(false);
  necesitaInteraccion = signal<boolean>(false);
  error = signal<string>('');

  // Pausas publicitarias / Intermissions
  intermissionActual = signal<IntermissionItem | null>(null);
  intermissionCola = signal<IntermissionItem[]>([]);
  intermissionTiempo = signal<number>(0);
  intermissionDuracion = signal<number>(0);
  intermissionPausadaYoutube = signal<boolean>(false);
  cancionEnPausaUuid: string | null = null;

  constructor() {
    this.iniciarBroadcastChannel();

    this.socket.onIntermission((payload: any) => {
      const data = payload?.data ?? (Array.isArray(payload) ? payload : []);
      if (Array.isArray(data) && data.length > 0) {
        this.reproducirIntermission(data);
      }
    });
    
    effect(() => {
      const cancion = this.state.sonando();
      if (!cancion) {
        this.detenerTicker();
        this.progreso.set(0);
        this.tiempoFormateado.set('0:00');
        this.currentVideoId = '';
        this.currentSongUuid = '';
        this.loadingVideoId = '';
        this.pendingSong = null;
        this.reintentosStream = 0;
        this.detenerTodoAudio();
        this.streamUrl.set(null);
        this.solicitandoStream.set(false);
        this.karaokeIntroActivo.set(false);
        this.cancionIntroPendiente = null;
        this.introEjecutadaParaUuid = null;
        if (this.role === 'admin') this.broadcast({ type: 'CHANGE_SONG', song: null, playing: false });
        return;
      }

      const vId = cancion.videoId;
      const uuid = cancion.uuid;

      // Resetear bandera de intro si la canción es completamente nueva
      if (this.introEjecutadaParaUuid && this.introEjecutadaParaUuid !== uuid && this.introEjecutadaParaUuid !== vId) {
        this.introEjecutadaParaUuid = null;
      }

      // Si ya está sonando exactamente esta misma canción (mismo uuid y videoId), no hacer nada
      if (this.currentSongUuid && uuid && this.currentSongUuid === uuid && this.currentVideoId === vId) {
        return;
      }

      // Si la intro de karaoke está sonando activamente para esta misma canción, no recargar
      const introActiva = untracked(() => this.karaokeIntroActivo());
      if (introActiva && (this.cancionIntroPendiente?.uuid === uuid || this.cancionIntroPendiente?.videoId === vId)) {
        return;
      }

      if (untracked(() => this.listo())) {
        const intermissionActiva = untracked(() => this.intermissionActual());
        if (intermissionActiva) {
          // Si hay una pausa publicitaria activa en curso, no montar ni alterar el reproductor
          // para no interferir ni arrastrar tiempos; terminarIntermission() la cargará limpiamente al finalizar el anuncio.
          this.tiempoSegundos.set(0);
          this.tiempoFormateado.set('0:00');
          this.progreso.set(0);
          this.currentSongUuid = '';
          this.currentVideoId = '';
          return;
        }
        this.cargarCancion(cancion, true);
      } else {
        this.pendingSong = cancion;
      }
    });
  }

  setRole(r: PlayerRole) {
    this.role = r;
  }

  private setSpeed(desiredRate: number) {
    if (this.currentPlaybackRate === desiredRate) return;
    if (!this.player || typeof this.player.setPlaybackRate !== 'function') return;

    try {
      let rateToSet = desiredRate;
      if (typeof this.player.getAvailablePlaybackRates === 'function') {
        const available: number[] = this.player.getAvailablePlaybackRates();
        if (Array.isArray(available) && available.length > 0) {
          if (!available.includes(desiredRate)) {
            if (desiredRate > 1.0) {
              const higher = available.filter((r) => r > 1.0).sort((a, b) => a - b);
              rateToSet = higher[0] || 1.0;
            } else if (desiredRate < 1.0) {
              const lower = available.filter((r) => r < 1.0).sort((a, b) => b - a);
              rateToSet = lower[0] || 1.0;
            }
          }
        }
      }
      this.player.setPlaybackRate(rateToSet);
      this.currentPlaybackRate = rateToSet;
    } catch { }
  }

  private iniciarBroadcastChannel() {
    if (typeof BroadcastChannel === 'undefined') return;
    this.channel = new BroadcastChannel('escenario89_player');
    this.channel.onmessage = (event: MessageEvent<PlayerBroadcastMessage>) => {
      const msg = event.data;
      if (!msg) return;

      if (this.role === 'pantalla') {
        if (msg.type === 'CHANGE_SONG') {
          if (msg.song && msg.streamUrl) {
            msg.song.url = msg.streamUrl;
          }
          this.state.sonando.set(msg.song ?? null);
          if (msg.streamUrl !== undefined) {
            this.streamUrl.set(msg.streamUrl);
          }
          this.initialSyncDone = false;
          this.setSpeed(1.0);
          if (this.karaokeIntroActivo()) {
            return;
          }
          if (msg.song) {
            this.cargarCancion(msg.song, msg.playing ?? true, 0);
          } else {
            this.detenerTodoAudio();
          }
        } else if (msg.type === 'PLAY') {
          if (this.intermissionActual() || this.karaokeIntroActivo()) return;
          this.setSpeed(1.0);
          if (this.streamUrl() && this.tvStreamVideo) {
            if (typeof msg.time === 'number') this.tvStreamVideo.currentTime = msg.time;
            this.tvStreamVideo.muted = true;
            this.tvStreamVideo.volume = 0;
            this.tvStreamVideo.play().catch(() => {});
          }
          if (typeof msg.time === 'number') {
            let curTime = this.tiempoSegundos();
            if (this.player && typeof this.player.getCurrentTime === 'function') {
              try {
                const live = this.player.getCurrentTime();
                if (typeof live === 'number' && !isNaN(live) && live >= 0) curTime = live;
              } catch { }
            }
            const diff = Math.abs(curTime - msg.time);
            if (diff > 0.4) {
              this.lastSyncSeekTime = Date.now();
              this.seekTo(msg.time, false);
            }
          }
          this.play(false);
        } else if (msg.type === 'PAUSE') {
          if (this.intermissionActual()) return;
          this.setSpeed(1.0);
          if (this.tvStreamVideo) {
            try { this.tvStreamVideo.pause(); } catch { }
          }
          if (this.player && typeof this.player.pauseVideo === 'function') {
            try { this.player.pauseVideo(); } catch { }
          }
          if (typeof msg.time === 'number') {
            this.lastSyncSeekTime = Date.now();
            this.seekTo(msg.time, false);
          }
          this.pause(false);
        } else if (msg.type === 'SEEK' && typeof msg.time === 'number') {
          if (this.intermissionActual() || this.karaokeIntroActivo()) return;
          this.lastSyncSeekTime = Date.now();
          this.setSpeed(1.0);
          if (this.streamUrl() && this.tvStreamVideo) {
            this.tvStreamVideo.currentTime = msg.time;
          }
          this.seekTo(msg.time, false);
        } else if (msg.type === 'SYNC_STATE') {
          if (msg.streamUrl !== undefined) {
            this.streamUrl.set(msg.streamUrl);
          }
          if (msg.streamLoading !== undefined) {
            this.solicitandoStream.set(msg.streamLoading);
          }
          if (msg.intermission !== undefined) {
            const inter = msg.intermission ? {
              ...msg.intermission,
              url: this.resolverUrl(msg.intermission.url),
              image: msg.intermission.image ? this.resolverUrl(msg.intermission.image) : '',
            } : null;
            this.intermissionActual.set(inter);
            if (msg.intermission) {
              if (this.adminStreamVideo) {
                try { this.adminStreamVideo.pause(); } catch { }
              }
              if (this.tvStreamVideo) {
                try { this.tvStreamVideo.pause(); } catch { }
              }
              if (this.player && typeof this.player.pauseVideo === 'function') {
                try { this.player.pauseVideo(); } catch { }
              }
              this.state.reproduciendo.set(false);
              this.detenerTicker();
            }
          }
          if (msg.karaokeIntro !== undefined) {
            this.karaokeIntroActivo.set(msg.karaokeIntro);
            if (msg.karaokeIntro) {
              if (this.player && typeof this.player.pauseVideo === 'function') {
                try { this.player.pauseVideo(); } catch { }
              }
              this.state.reproduciendo.set(false);
              this.detenerTicker();
            }
          }
          if (msg.song) {
            if (msg.streamUrl) {
              msg.song.url = msg.streamUrl;
            }
            this.lastAdminTime = msg.time ?? 0;
            this.lastAdminTimeAt = Date.now();
            this.initialSyncDone = false;
            this.setSpeed(1.0);
            this.state.sonando.set(msg.song);
            if (!this.intermissionActual() && !this.karaokeIntroActivo()) {
              this.cargarCancion(msg.song, msg.playing ?? true, msg.time ?? 0);
            }
          }
        } else if (msg.type === 'KARAOKE_INTRO_START') {
          this.karaokeIntroActivo.set(true);
          if (this.timeoutAutoplay) {
            clearTimeout(this.timeoutAutoplay);
            this.timeoutAutoplay = null;
          }
          this.detenerTodoAudio();
          this.state.reproduciendo.set(false);
          this.detenerTicker();
        } else if (msg.type === 'KARAOKE_INTRO_END') {
          this.karaokeIntroActivo.set(false);
          if (msg.song) {
            this.ejecutarCargaCancion(msg.song, true, 0);
          }
        } else if (msg.type === 'STREAM_LOADING') {
          this.solicitandoStream.set(!!msg.streamLoading);
          if (msg.streamLoading) {
            this.cargando.set(false);
            if (this.player && typeof this.player.pauseVideo === 'function') {
              try { this.player.pauseVideo(); } catch { }
            }
          }
        } else if (msg.type === 'INTERMISSION_START') {
          if (this.adminStreamVideo) {
            try { this.adminStreamVideo.pause(); } catch { }
          }
          if (this.tvStreamVideo) {
            try { this.tvStreamVideo.pause(); } catch { }
          }
          if (this.player && typeof this.player.pauseVideo === 'function') {
            try { this.player.pauseVideo(); } catch { }
          }
          this.state.reproduciendo.set(false);
          this.detenerTicker();
          const inter = msg.intermission ? {
            ...msg.intermission,
            url: this.resolverUrl(msg.intermission.url),
            image: msg.intermission.image ? this.resolverUrl(msg.intermission.image) : '',
          } : null;
          this.intermissionActual.set(inter);
        } else if (msg.type === 'INTERMISSION_END') {
          this.intermissionActual.set(null);
          const cancion = this.state.sonando();
          if (cancion) {
            if (this.cancionEnPausaUuid && this.cancionEnPausaUuid === cancion.uuid && (this.streamUrl() || this.player)) {
              this.play(false);
            } else {
              this.cancionEnPausaUuid = null;
              this.currentSongUuid = '';
              this.currentVideoId = '';
              this.tiempoSegundos.set(0);
              this.tiempoFormateado.set('0:00');
              this.duracionSegundos.set(0);
              this.duracionFormateada.set('0:00');
              this.progreso.set(0);
              this.cargarCancion(cancion, true, 0);
            }
          }
        } else if (msg.type === 'TIME_SYNC') {
          if (this.intermissionActual() || this.karaokeIntroActivo()) return;
          if (typeof msg.time === 'number') {
            const now = Date.now();
            this.lastAdminTime = msg.time;
            this.lastAdminTimeAt = now;

            let playerState = -1;
            if (this.player && typeof this.player.getPlayerState === 'function') {
              try { playerState = this.player.getPlayerState(); } catch { }
            }

            if (this.streamUrl() && this.tvStreamVideo) {
              const curTime = this.tvStreamVideo.currentTime || 0;
              const diff = Math.abs(curTime - msg.time);
              if (diff > 0.8) {
                this.tvStreamVideo.currentTime = msg.time;
              }
              if (msg.playing && this.tvStreamVideo.paused) {
                this.tvStreamVideo.muted = true;
                this.tvStreamVideo.volume = 0;
                this.tvStreamVideo.play().catch(() => {});
              }
            }
            if (this.player && playerState === 1) {
              let curTime = this.tiempoSegundos();
              if (typeof this.player.getCurrentTime === 'function') {
                try {
                  const live = this.player.getCurrentTime();
                  if (typeof live === 'number' && !isNaN(live) && live >= 0) {
                    curTime = live;
                  }
                } catch { }
              }

              const transit = Math.max(0, (now - (msg.sentAt || now)) / 1000);
              const targetTime = msg.time + transit;
              const diff = targetTime - curTime;
              const absDiff = Math.abs(diff);

              if (absDiff > 2.0) {
                if (now - this.lastSyncSeekTime > 3000) {
                  this.lastSyncSeekTime = now;
                  this.setSpeed(1.0);
                  this.seekTo(targetTime + 0.25, false);
                }
              } else if (diff > 0.8) {
                this.setSpeed(1.5);
              } else if (diff > 0.15) {
                this.setSpeed(1.25);
              } else if (diff < -0.8) {
                this.setSpeed(0.5);
              } else if (diff < -0.15) {
                this.setSpeed(0.75);
              } else {
                this.setSpeed(1.0);
              }
            }
          }
          if (msg.playing && !this.state.reproduciendo()) {
            this.play(false);
          } else if (!msg.playing && this.state.reproduciendo()) {
            this.pause(false);
          }
        }
      } else if (this.role === 'admin') {
        if (msg.type === 'REQUEST_SYNC') {
          this.broadcast({
            type: 'SYNC_STATE',
            song: this.state.sonando(),
            time: this.tiempoSegundos(),
            playing: this.state.reproduciendo(),
            sentAt: Date.now(),
            intermission: this.intermissionActual(),
            karaokeIntro: this.karaokeIntroActivo(),
            streamUrl: this.streamUrl(),
            streamLoading: this.solicitandoStream(),
          });
        }
      }
    };
  }

 
  solicitarSincronizacion() {
    if (this.role !== 'pantalla') return;
    this.broadcast({ type: 'REQUEST_SYNC' });
    let retries = 0;
    const syncInterval = setInterval(() => {
      retries++;
      if (retries > 8 || (this.state.sonando() && this.tiempoSegundos() > 0)) {
        clearInterval(syncInterval);
        return;
      }
      this.broadcast({ type: 'REQUEST_SYNC' });
    }, 500);
  }

  private broadcast(msg: PlayerBroadcastMessage) {
    try {
      this.channel?.postMessage(msg);
    } catch { }
  }

  /** Carga dinámicamente y de forma segura la API de YouTube IFrame */
    cargarApi(): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve();
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (this.apiLoadedPromise) return this.apiLoadedPromise;

    this.apiLoadedPromise = new Promise<void>((resolve) => {
      if (window.YT && window.YT.Player) {
        resolve();
        return;
      }

      const interval = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(interval);
          resolve();
        }
      }, 50);

      const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]');
      if (!existingScript) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScript = document.getElementsByTagName('script')[0];
        firstScript?.parentNode?.insertBefore(tag, firstScript);
      }

      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        clearInterval(interval);
        if (typeof prev === 'function') prev();
        resolve();
      };

      setTimeout(() => {
        clearInterval(interval);
        resolve();
      }, 5000);
    });

    return this.apiLoadedPromise;
  }

  async inicializar(
    elementId: string,
    role: PlayerRole = 'admin',
    containerId?: string,
    videoIdInicial?: string,
    muted = false,
  ): Promise<void> {
    this.role = role;
    this.currentElementId = elementId;
    if (containerId) this.currentContainerId = containerId;
    this.error.set('');

    if (this.role === 'pantalla') {
      this.solicitarSincronizacion();
    }

    await this.cargarApi();

    const cancionActual = this.state.sonando();
    const videoId = videoIdInicial || cancionActual?.videoId || '';
    const hayCancionReal = !!videoId;
    if (hayCancionReal) {
      this.currentVideoId = videoId;
    }

    if (this.player && typeof this.player.loadVideoById === 'function' && this.listo()) {
      if (hayCancionReal && cancionActual && this.currentVideoId !== videoId) {
        await this.cargarCancion(cancionActual, true);
      }
      return;
    }

    let el = document.getElementById(elementId);
    const container = this.currentContainerId
      ? document.getElementById(this.currentContainerId)
      : el?.parentElement;

    if (!el || el.tagName === 'IFRAME') {
      if (container) {
        if (this.player) {
          try { this.player.destroy(); } catch { }
          this.player = null;
        }
        container.innerHTML = `<div id="${elementId}"></div>`;
        el = document.getElementById(elementId);
      }
    }

    if (!el) {
      console.warn(`Elemento #${elementId} no encontrado en el DOM`);
      return;
    }

    this.listo.set(false);
    this.cargando.set(hayCancionReal);

    return new Promise((resolve) => {
      try {
        const originUrl = typeof window !== 'undefined' ? window.location.origin : '';

        const playerConfig: any = {
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: hayCancionReal ? 1 : 0,
            controls: 0,
            rel: 0,
            modestbranding: 1,
            fs: 0,
            iv_load_policy: 3,
            disablekb: 1,
            playsinline: 1,
            enablejsapi: 1,
            cc_load_policy: 0,
            cc_lang_pref: 'none',
            mute: (this.role === 'pantalla' || muted) ? 1 : 0,
            origin: originUrl,
          },
          events: {
            onReady: (event: any) => {
              this.listo.set(true);
              this.cargando.set(false);
              if (hayCancionReal) {
                this.currentVideoId = videoId;
              }

              try {
                const iframe = document.getElementById(elementId) as HTMLIFrameElement;
                if (iframe) {
                  iframe.setAttribute(
                    'allow',
                    'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; compute-pressure',
                  );
                  iframe.setAttribute('allowfullscreen', 'true');
                }
              } catch { }

              if (this.role === 'pantalla' || muted) {
                try {
                  event.target.mute();
                  this.muteado.set(true);
                  this.necesitaInteraccion.set(false);
                  if (hayCancionReal && !this.intermissionActual() && !this.karaokeIntroActivo()) {
                    event.target.playVideo();
                    this.state.reproduciendo.set(true);
                  }
                } catch { }
              } else if (!hayCancionReal || this.intermissionActual() || this.karaokeIntroActivo()) {
                try {
                  event.target.mute();
                  this.muteado.set(true);
                  event.target.pauseVideo();
                  this.state.reproduciendo.set(false);
                } catch { }
              } else {
                try {
                  event.target.unMute();
                  this.muteado.set(false);
                  event.target.setVolume(this.volumen());
                  event.target.playVideo();
                  this.necesitaInteraccion.set(false);
                } catch { }
                this.intentarAutoplay(false);
              }

              this.desactivarSubtitulos();
              this.actualizarProgreso();

              if (this.pendingSong) {
                const pend = this.pendingSong;
                const pendTime = this.pendingTime;
                this.pendingSong = null;
                this.pendingTime = 0;
                this.cargarCancion(pend, true, pendTime);
              }

              resolve();
            },
            onStateChange: (event: any) => {
              this.onPlayerStateChange(event.data);
            },
            onError: (event: any) => {
              this.handlePlayerError(event.data);
              console.warn(event)
            },
          },
        };

        if (hayCancionReal) {
          playerConfig.videoId = videoId;
        }

        this.player = new window.YT.Player(elementId, playerConfig);
      } catch (e) {
        console.error('Error al inicializar YouTube Player:', e);
        this.error.set('No se pudo inicializar el reproductor de YouTube');
        resolve();
      }
    });
  }

  private onPlayerStateChange(stateCode: number) {
    if (this.streamUrl() || this.solicitandoStream()) {
      if (stateCode === 1) {
        try {
          this.player?.mute();
          this.player?.pauseVideo();
        } catch { }
      }
      return;
    }
    if (this.intermissionActual() || this.karaokeIntroActivo()) {
      if (stateCode === 1) { // PLAYING
        try {
          this.player?.mute();
          this.player?.setVolume(0);
          this.player?.pauseVideo();
          this.player?.stopVideo();
        } catch { }
      }
      this.state.reproduciendo.set(false);
      this.detenerTicker();
      return;
    }

    if (stateCode === 1) { // PLAYING
      if (this.role === 'pantalla') {
        try {
          this.player?.mute();
          this.player?.setVolume(0);
          this.muteado.set(true);
        } catch { }
      }
      this.desactivarSubtitulos();
      this.state.reproduciendo.set(true);
      this.cargando.set(false);
      this.iniciarTicker();
      if (!this.muteado() && this.role !== 'pantalla') {
        this.necesitaInteraccion.set(false);
        this.removerDesbloqueoInteraccion();
      }
      this.limpiarWatchdogPlayback();

      if (this.role === 'pantalla' && !this.initialSyncDone) {
        this.initialSyncDone = true;
        if (this.lastAdminTime > 1.0) {
          const elapsed = (Date.now() - this.lastAdminTimeAt) / 1000;
          const target = this.lastAdminTime + elapsed + 0.25;
          let live = this.tiempoSegundos();
          try {
            const t = this.player?.getCurrentTime();
            if (typeof t === 'number' && !isNaN(t) && t >= 0) live = t;
          } catch { }

          if (Math.abs(target - live) > 0.8) {
            this.lastSyncSeekTime = Date.now();
            this.seekTo(target, false);
          }
        }
      }
    } else if (stateCode === 2) { // PAUSED
      this.state.reproduciendo.set(false);
      this.cargando.set(false);
      this.detenerTicker();
      if (this.role === 'pantalla') {
        this.setSpeed(1.0);
      }
    } else if (stateCode === 0) { // ENDED
      this.detenerTicker();
      this.state.reproduciendo.set(false);
      this.cargando.set(false);
      if (this.role === 'pantalla') {
        this.setSpeed(1.0);
      }
      this.next();
    } else if (stateCode === 3) { // BUFFERING
      this.cargando.set(true);
    } else if (stateCode === 5 || stateCode === -1) { // CUED or UNSTARTED
      this.cargando.set(false);
      this.detenerTicker();
      if (!this.intermissionActual() && !this.karaokeIntroActivo() && this.state.sonando()) {
        if (this.role === 'admin' && this.state.reproduciendo()) {
          this.intentarAutoplay();
        } else if (this.role === 'pantalla') {
          try {
            this.player?.mute();
            this.player?.setVolume(0);
            this.player?.playVideo();
            this.state.reproduciendo.set(true);
          } catch { }
        } else {
          this.state.reproduciendo.set(false);
        }
      } else {
        this.state.reproduciendo.set(false);
      }
    }
  }

  registrarDesbloqueoInteraccion() {
    if (typeof window === 'undefined' || this.listenerInteraccion) return;
    this.listenerInteraccion = () => {
      if (this.intermissionActual() || this.karaokeIntroActivo()) return;
      this.removerDesbloqueoInteraccion();
      if (this.role === 'admin' && this.state.sonando() && this.state.reproduciendo()) {
        this.desbloquearAudio();
      }
    };
    window.addEventListener('click', this.listenerInteraccion, { capture: true });
    window.addEventListener('keydown', this.listenerInteraccion, { capture: true });
  }

  private removerDesbloqueoInteraccion() {
    if (typeof window === 'undefined' || !this.listenerInteraccion) return;
    window.removeEventListener('click', this.listenerInteraccion, { capture: true });
    window.removeEventListener('keydown', this.listenerInteraccion, { capture: true });
    this.listenerInteraccion = null;
  }

  private intentarAutoplay(reproducirInmediato = true) {
    if (this.intermissionActual() || this.karaokeIntroActivo() || this.streamUrl() || this.solicitandoStream()) return;
    if (this.role !== 'admin' || !this.state.sonando() || !this.player) return;
    if (!this.state.reproduciendo() && !this.cargando()) return;

    if (this.timeoutAutoplay) {
      clearTimeout(this.timeoutAutoplay);
      this.timeoutAutoplay = null;
    }

    if (reproducirInmediato) {
      try {
        this.player.unMute();
        this.player.setVolume(this.volumen() || 100);
        this.player.playVideo();
      } catch { }
    }

    this.timeoutAutoplay = setTimeout(() => {
      if (this.streamUrl() || this.solicitandoStream()) return;
      if (this.role === 'admin' && this.state.sonando() && this.player && !this.intermissionActual() && !this.karaokeIntroActivo() && this.state.reproduciendo()) {
        let st = -1;
        try { st = this.player.getPlayerState(); } catch { }
        if (st !== 1 && st !== 3) {
          try {
            this.player.mute();
            this.muteado.set(true);
            this.player.playVideo();
            this.necesitaInteraccion.set(true);
            this.registrarDesbloqueoInteraccion();
          } catch { }
        }
      }
    }, 1200);
  }

  iniciarWatchdogPlayback(cancion: Cancion | null, timeoutMs = 4500) {
    if (this.role !== 'admin' || !cancion?.videoId) return;
    if (this.streamUrl() || this.solicitandoStream()) return;
    this.limpiarWatchdogPlayback();

    this.timeoutWatchdogPlayback = setTimeout(async () => {
      this.timeoutWatchdogPlayback = null;
      if (this.role !== 'admin' || this.streamUrl() || this.solicitandoStream()) return;
      if (this.intermissionActual() || this.karaokeIntroActivo()) return;

      const sonando = this.state.sonando();
      if (!sonando || (sonando.uuid !== cancion.uuid && sonando.videoId !== cancion.videoId)) return;
      if (!this.state.reproduciendo()) return;

      let st = -1;
      let cur = 0;
      try {
        if (this.player) {
          if (typeof this.player.getPlayerState === 'function') st = this.player.getPlayerState();
          if (typeof this.player.getCurrentTime === 'function') cur = this.player.getCurrentTime() || 0;
        }
      } catch { }

      const curLive = this.tiempoSegundos();

      // Si está en BUFFERING (3), esperar 3 segundos más antes de forzar stream
      if (st === 3 && curLive === 0 && timeoutMs <= 4500) {
        console.log('[Watchdog] Video de YouTube en BUFFERING (3), concediendo 3s adicionales...');
        this.iniciarWatchdogPlayback(cancion, 3000);
        return;
      }

      // Si tras el tiempo de espera YouTube no está reproduciendo activamente (st !== 1) o está atascado en 0:00:
      if (st !== 1 || (cur === 0 && curLive === 0)) {
        console.warn(`[Watchdog] YouTube no inició la reproducción tras ${timeoutMs}ms (st: ${st}, cur: ${cur}, live: ${curLive}). Activando rescate con stream directo del backend.`);
        await this.solicitarStreamYReproducir(sonando, 0);
      }
    }, timeoutMs);
  }

  limpiarWatchdogPlayback() {
    if (this.timeoutWatchdogPlayback) {
      clearTimeout(this.timeoutWatchdogPlayback);
      this.timeoutWatchdogPlayback = null;
    }
  }

  private async handlePlayerError(code: number) {
    if (this.role !== 'admin' || this.streamUrl() || this.solicitandoStream()) return;
    this.cargando.set(false);
    this.limpiarWatchdogPlayback();
    console.warn(`YouTube Player error (${code})`);

    const cancion = this.state.sonando();

    // Intentar rescate automático mediante stream directo para CUALQUIER código de error
    if (cancion && cancion.videoId) {
      this.error.set('');
      const ok = await this.solicitarStreamYReproducir(cancion, 0);
      if (ok) return;
    }

    this.error.set(`Error de YouTube (${code}). No se pudo reproducir este video.`);
    setTimeout(() => this.next(), 3500);
  }

  async solicitarStreamYReproducir(cancion: Cancion, startSeconds = 0): Promise<boolean> {
    if (this.role !== 'admin' || !cancion?.videoId) return false;
    if (this.solicitandoStream()) return false;
    this.limpiarWatchdogPlayback();

    if (this.reintentosStream >= 3) {
      console.warn('Límite de reintentos alcanzado para stream:', cancion.titulo);
      this.error.set('No se pudo reproducir el stream tras varios intentos.');
      this.cargando.set(false);
      this.streamUrl.set(null);
      this.reintentosStream = 0;
      setTimeout(() => this.next(), 3500);
      return false;
    }

    if (this.timeoutAutoplay) {
      clearTimeout(this.timeoutAutoplay);
      this.timeoutAutoplay = null;
    }

    // Proteger contra seeking más allá de la duración de la canción
    const maxDur = cancion.duracion ? this.stringASegundos(cancion.duracion) : 0;
    if (maxDur > 0 && startSeconds >= maxDur - 2) {
      startSeconds = 0;
    }
    if (startSeconds === 0) {
      this.tiempoSegundos.set(0);
      this.tiempoFormateado.set('0:00');
      this.progreso.set(0);
    }

    this.solicitandoStream.set(true);
    this.reintentosStream++;
    this.cargando.set(false);
    this.error.set('');

    if (this.role === 'admin') {
      this.broadcast({
        type: 'STREAM_LOADING',
        streamLoading: true,
        song: cancion,
      });
    }

    try {
      const res = await this.api.pedir<{ url: string }>('admin', 'POST', '/song/stream', {
        id: cancion.videoId,
      });

      if (res?.url) {
        this.currentVideoId = cancion.videoId;
        this.currentSongUuid = cancion.uuid;
        cancion.url = res.url;
        this.streamUrl.set(res.url);
        this.error.set('');
        this.cargando.set(false);
        const shouldPlay = !this.intermissionActual() && !this.karaokeIntroActivo();
        this.state.reproduciendo.set(shouldPlay);
        this.necesitaInteraccion.set(false);

        if (this.player) {
          try {
            this.player.mute();
            if (typeof this.player.stopVideo === 'function') {
              this.player.stopVideo();
            }
          } catch { }
        }

        if (this.role === 'admin') {
          this.broadcast({
            type: 'CHANGE_SONG',
            song: cancion,
            playing: shouldPlay,
            time: startSeconds,
            streamUrl: res.url,
          });
        }

        setTimeout(() => {
          if (this.adminStreamVideo) {
            if (startSeconds > 0) {
              try { this.adminStreamVideo.currentTime = startSeconds; } catch { }
            }
            if (this.role === 'admin') {
              this.adminStreamVideo.muted = this.muteado();
              this.adminStreamVideo.volume = (this.volumen() || 100) / 100;
            }
            if (shouldPlay) {
              this.adminStreamVideo.play().catch((err) => {
                console.warn('Autoplay bloqueado para stream:', err);
                this.necesitaInteraccion.set(true);
                this.registrarDesbloqueoInteraccion();
              });
            } else {
              try { this.adminStreamVideo.pause(); } catch { }
            }
          }
        }, 150);

        return true;
      }
    } catch (err: any) {
      console.error('Error al pedir /song/stream:', err);
      this.error.set('No se pudo desbloquear la canción: ' + (err?.message || 'Error de stream'));
      setTimeout(() => this.next(), 3500);
    } finally {
      this.cargando.set(false);
      this.solicitandoStream.set(false);
      if (this.role === 'admin') {
        this.broadcast({
          type: 'STREAM_LOADING',
          streamLoading: false,
        });
      }
    }

    return false;
  }

  onStreamLoadedMetadata(v: HTMLVideoElement) {
    if (!v) return;
    this.adminStreamVideo = v;
    if (v.duration && !isNaN(v.duration)) {
      this.duracionSegundos.set(v.duration);
      this.duracionFormateada.set(this.segundosAString(v.duration));
      if (v.currentTime >= v.duration - 1) {
        try { v.currentTime = 0; } catch { }
        this.tiempoSegundos.set(0);
        this.tiempoFormateado.set('0:00');
        this.progreso.set(0);
      }
    }
    if (this.role === 'admin') {
      v.muted = this.muteado();
      v.volume = (this.volumen() || 100) / 100;
    }
    if (this.state.reproduciendo() && !this.intermissionActual() && !this.karaokeIntroActivo()) {
      v.play().catch((err) => {
        console.warn('Autoplay bloqueado en loadedmetadata:', err);
        this.necesitaInteraccion.set(true);
        this.registrarDesbloqueoInteraccion();
      });
    } else {
      try { v.pause(); } catch { }
    }
  }

  onTvStreamLoadedMetadata(v: HTMLVideoElement) {
    if (!v) return;
    this.tvStreamVideo = v;
    v.muted = true;
    v.volume = 0;
    if (v.duration && !isNaN(v.duration) && v.currentTime >= v.duration - 1) {
      try { v.currentTime = 0; } catch { }
    }
    if (this.state.reproduciendo() && !this.intermissionActual() && !this.karaokeIntroActivo()) {
      v.play().catch(() => {});
    } else {
      try { v.pause(); } catch { }
    }
  }

  onStreamTimeUpdate(v: HTMLVideoElement) {
    if (!v) return;
    this.adminStreamVideo = v;
    if (this.intermissionActual() || this.karaokeIntroActivo()) {
      try { v.pause(); } catch { }
      return;
    }
    const cur = v.currentTime || 0;
    const dur = v.duration || this.duracionSegundos() || 0;

    if (dur > 0 && cur > dur) {
      return;
    }

    this.tiempoSegundos.set(cur);
    if (dur > 0) this.duracionSegundos.set(dur);

    const fCur = this.segundosAString(cur);
    const fDur = this.segundosAString(dur);

    this.tiempoFormateado.set(fCur);
    this.duracionFormateada.set(fDur);
    this.state.tiempoActual.set(fCur);

    const pct = dur > 0 ? (cur / dur) * 100 : 0;
    this.progreso.set(Math.min(100, Math.max(0, pct)));

    if (this.role === 'admin' && this.state.reproduciendo()) {
      this.broadcast({
        type: 'TIME_SYNC',
        time: cur,
        playing: true,
        sentAt: Date.now(),
        streamUrl: this.streamUrl(),
      });
    }
  }

  onTvStreamTimeUpdate(v: HTMLVideoElement) {
    if (!v) return;
    this.tvStreamVideo = v;
    if (this.intermissionActual() || this.karaokeIntroActivo()) {
      try { v.pause(); } catch { }
      return;
    }
    if (!v.muted) v.muted = true;
    if (v.volume > 0) v.volume = 0;
    const cur = v.currentTime || 0;
    const dur = v.duration || this.duracionSegundos() || 0;

    if (dur > 0 && cur > dur) {
      return;
    }

    this.tiempoSegundos.set(cur);
    if (dur > 0) this.duracionSegundos.set(dur);

    const fCur = this.segundosAString(cur);
    const fDur = this.segundosAString(dur);

    this.tiempoFormateado.set(fCur);
    this.duracionFormateada.set(fDur);
    this.state.tiempoActual.set(fCur);

    const pct = dur > 0 ? (cur / dur) * 100 : 0;
    this.progreso.set(Math.min(100, Math.max(0, pct)));
  }

  onStreamEnded() {
    if (this.intermissionActual()) return;
    this.state.reproduciendo.set(false);
    this.streamUrl.set(null);
    this.next();
  }

  async onStreamError(v?: HTMLVideoElement) {
    if (this.role !== 'admin') return;

    // Si el video fue abortado intencionalmente (código 1) o no hay error real, ignorar
    if (!v?.error || v.error.code === 1) { // 1 = MEDIA_ERR_ABORTED
      return;
    }

    // Cooldown para evitar bucle inmediato
    const now = Date.now();
    if (now - this.ultimoErrorStream < 5000) {
      return;
    }
    this.ultimoErrorStream = now;

    console.warn('Error en reproducción de stream HTML5:', v.error.code, v.error.message);
    const cancion = this.state.sonando();
    if (cancion && cancion.videoId && this.reintentosStream < 3) {
      let tiempoActual = this.tiempoSegundos();
      const dur = this.duracionSegundos() || (cancion.duracion ? this.stringASegundos(cancion.duracion) : 0);
      if (dur > 0 && tiempoActual >= dur - 2) {
        tiempoActual = 0;
      }
      await this.solicitarStreamYReproducir(cancion, tiempoActual);
    } else {
      this.streamUrl.set(null);
      this.reintentosStream = 0;
      this.next();
    }
  }

  onTvStreamError(v?: HTMLVideoElement) {
    console.warn('Error en stream de TV:', v?.error);
  }

  private iniciarTicker() {
    this.detenerTicker();
    this.actualizarProgreso();
    this.timer = setInterval(() => this.actualizarProgreso(), 500);
  }

  private detenerTicker() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private actualizarProgreso() {
    if (this.intermissionActual() || this.karaokeIntroActivo()) return;
    if (!this.player || typeof this.player.getCurrentTime !== 'function') return;

    try {
      const cur = this.player.getCurrentTime() || 0;
      const dur = this.player.getDuration() || 0;

      this.tiempoSegundos.set(cur);
      this.duracionSegundos.set(dur);

      const fCur = this.segundosAString(cur);
      const fDur = this.segundosAString(dur);

      this.tiempoFormateado.set(fCur);
      this.duracionFormateada.set(fDur);
      this.state.tiempoActual.set(fCur);

      const pct = dur > 0 ? (cur / dur) * 100 : 0;
      this.progreso.set(Math.min(100, Math.max(0, pct)));
      if (cur > 0.8) {
        this.limpiarWatchdogPlayback();
      }

      if (this.role === 'admin' && this.state.reproduciendo()) {
        this.broadcast({
          type: 'TIME_SYNC',
          time: cur,
          playing: true,
          sentAt: Date.now(),
        });
      }
    } catch { }
  }

  private segundosAString(sec: number): string {
    const s = Math.floor(sec);
    const m = Math.floor(s / 60);
    const resto = s % 60;
    return `${m}:${resto.toString().padStart(2, '0')}`;
  }

  private stringASegundos(duracion: string | undefined): number {
    if (!duracion) return 0;
    return duracion.split(':').reduce((total, parte) => total * 60 + Number(parte), 0) || 0;
  }

  async cargarCancion(cancion: Cancion, autoplay = true, startSeconds = 0) {
    if (startSeconds === 0) {
      this.tiempoSegundos.set(0);
      this.tiempoFormateado.set('0:00');
      this.progreso.set(0);
    }
    if (this.karaokeIntroActivo()) {
      if (this.cancionIntroPendiente?.uuid === cancion.uuid || this.cancionIntroPendiente?.videoId === cancion.videoId) {
        return;
      }
      this.detenerAudioIntro();
      this.karaokeIntroActivo.set(false);
      this.cancionIntroPendiente = null;
    }

    const yaSonandoEsta = !!(this.currentSongUuid && cancion.uuid && this.currentSongUuid === cancion.uuid && this.currentVideoId === cancion.videoId);
    const yaEjecutoIntro = !!(this.introEjecutadaParaUuid && (this.introEjecutadaParaUuid === cancion.uuid || this.introEjecutadaParaUuid === cancion.videoId));
    const esTransicionKaraoke =
      !yaSonandoEsta &&
      !yaEjecutoIntro &&
      this.role === 'admin' &&
      autoplay &&
      startSeconds === 0 &&
      cancion.tipo === 'karaoke' &&
      this.karaokeIntroHabilitado() &&
      !this.karaokeIntroActivo() &&
      !this.intermissionActual();

    if (esTransicionKaraoke) {
      this.iniciarKaraokeIntro(cancion);
      return;
    }

    await this.ejecutarCargaCancion(cancion, autoplay && !this.intermissionActual(), startSeconds);
  }

  iniciarKaraokeIntro(cancion: Cancion) {
    if (!this.karaokeIntroHabilitado()) {
      this.ejecutarCargaCancion(cancion, true, 0);
      return;
    }
    this.detenerTodoAudio();
    this.streamUrl.set(null);

    if (this.timeoutAutoplay) {
      clearTimeout(this.timeoutAutoplay);
      this.timeoutAutoplay = null;
    }
    this.cancionIntroPendiente = cancion;
    this.introEjecutadaParaUuid = cancion.uuid || cancion.videoId || null;
    this.karaokeIntroActivo.set(true);
    this.state.reproduciendo.set(true);
    this.detenerTicker();

    if (this.player) {
      try {
        this.player.mute();
        this.player.setVolume(0);
        if (typeof this.player.pauseVideo === 'function') this.player.pauseVideo();
        if (typeof this.player.stopVideo === 'function') this.player.stopVideo();
      } catch { }
    }

    if (!cancion.videoId) {
      const query = `${cancion.titulo} ${cancion.artista}`.trim();
      this.yt.buscar(query).then((resultados) => {
        if (resultados.length > 0) {
          cancion.videoId = resultados[0].id;
          cancion.miniatura = resultados[0].miniatura;
        }
      }).catch(() => {});
    }

    const audioIndex = Math.floor(Math.random() * 3) + 1;
    const audioUrl = `/karaoke_0${audioIndex}.mp3`;

    this.broadcast({
      type: 'KARAOKE_INTRO_START',
      audioIndex,
      song: cancion,
    });

    try {
      if (this.role === 'admin') {
        this.muteado.set(false);
      }
      const vol = Math.max(0.1, (this.volumen() || 100) / 100);

      this.audioIntro = new Audio(audioUrl);
      this.audioIntro.volume = vol;
      this.audioIntro.preload = 'auto';

      let finalizado = false;
      const finalizar = () => {
        if (finalizado) return;
        finalizado = true;
        this.finalizarKaraokeIntro(cancion);
      };

      this.audioIntro.onended = finalizar;

      let errFallbackTimeout: any = null;
      this.audioIntro.onerror = (e) => {
        console.warn('Error al reproducir audio intro karaoke:', e);
        if (!finalizado) {
          errFallbackTimeout = setTimeout(() => finalizar(), 3000);
        }
      };

      this.audioIntro.onplay = () => {
        if (errFallbackTimeout) {
          clearTimeout(errFallbackTimeout);
          errFallbackTimeout = null;
        }
      };

      // Si conocemos la duración del audio, programar el timeout de seguridad para que NUNCA corte el audio antes de tiempo
      this.audioIntro.onloadedmetadata = () => {
        if (this.audioIntro && this.audioIntro.duration && !isNaN(this.audioIntro.duration)) {
          if (this.timeoutIntro) {
            clearTimeout(this.timeoutIntro);
          }
          const durMs = Math.ceil((this.audioIntro.duration + 4) * 1000);
          this.timeoutIntro = setTimeout(() => {
            finalizar();
          }, durMs);
        }
      };

      const playPromise = this.audioIntro.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Autoplay de audio intro bloqueado por el navegador:', err);
          errFallbackTimeout = setTimeout(() => finalizar(), 4000);
        });
      }

      // Timeout inicial generoso (30 segundos) en caso de retraso en buffering o carga de red
      this.timeoutIntro = setTimeout(() => {
        finalizar();
      }, 30000);
    } catch (e) {
      console.warn('Fallo al inicializar Audio intro:', e);
      setTimeout(() => this.finalizarKaraokeIntro(cancion), 3500);
    }
  }

  saltarKaraokeIntro() {
    if (!this.karaokeIntroActivo()) return;
    const cancion = this.cancionIntroPendiente || this.state.sonando();
    if (!cancion) {
      this.karaokeIntroActivo.set(false);
      return;
    }
    this.finalizarKaraokeIntro(cancion);
  }

  finalizarKaraokeIntro(cancion: Cancion) {
    this.detenerAudioIntro();
    this.cancionPrevia = cancion;
    this.karaokeIntroActivo.set(false);
    this.cancionIntroPendiente = null;
    this.introEjecutadaParaUuid = cancion.uuid || cancion.videoId || null;

    this.broadcast({
      type: 'KARAOKE_INTRO_END',
      song: cancion,
    });

    this.ejecutarCargaCancion(cancion, true, 0);
  }

  private detenerAudioIntro() {
    if (this.timeoutIntro) {
      clearTimeout(this.timeoutIntro);
      this.timeoutIntro = null;
    }
    if (this.audioIntro) {
      try {
        this.audioIntro.onended = null;
        this.audioIntro.onerror = null;
        this.audioIntro.onplay = null;
        this.audioIntro.onloadedmetadata = null;
        this.audioIntro.pause();
        this.audioIntro.currentTime = 0;
        this.audioIntro.removeAttribute('src');
        this.audioIntro.load();
      } catch { }
      this.audioIntro = null;
    }
  }

  detenerTodoAudio() {
    this.limpiarWatchdogPlayback();
    this.detenerAudioIntro();

    if (this.adminStreamVideo) {
      try {
        this.adminStreamVideo.pause();
        this.adminStreamVideo.removeAttribute('src');
        this.adminStreamVideo.load();
      } catch { }
      this.adminStreamVideo = null;
    }

    if (this.tvStreamVideo) {
      try {
        this.tvStreamVideo.pause();
        this.tvStreamVideo.removeAttribute('src');
        this.tvStreamVideo.load();
      } catch { }
      this.tvStreamVideo = null;
    }

    this.streamUrl.set(null);

    if (this.player) {
      try {
        if (typeof this.player.pauseVideo === 'function') {
          this.player.pauseVideo();
        }
        if (typeof this.player.stopVideo === 'function') {
          this.player.stopVideo();
        }
        if (typeof this.player.mute === 'function') {
          this.player.mute();
        }
      } catch { }
    }
  }

  async ejecutarCargaCancion(cancion: Cancion, autoplay = true, startSeconds = 0) {
    if (this.karaokeIntroActivo()) {
      return;
    }
    this.initialSyncDone = false;
    this.currentPlaybackRate = 1.0;
    this.cancionPrevia = cancion;
    if (this.currentSongUuid !== cancion.uuid) {
      this.reintentosStream = 0;
    }
    let vId = cancion.videoId;

    if (!vId) {
      this.cargando.set(true);
      try {
        const query = `${cancion.titulo} ${cancion.artista}`.trim();
        const resultados = await this.yt.buscar(query);
        if (resultados.length > 0) {
          vId = resultados[0].id;
          cancion.videoId = vId;
          cancion.miniatura = resultados[0].miniatura;
        }
      } catch (e) {
        console.warn('No se pudo obtener el videoId para', cancion.titulo, e);
      }
    }

    if (!vId) {
      this.cargando.set(false);
      this.error.set(`No se encontró video para "${cancion.titulo}"`);
      return;
    }

    const esStreamDirecto = !!(cancion.url && (cancion.url.includes('googlevideo.com') || (!cancion.url.includes('youtube.com') && !cancion.url.includes('youtu.be') && cancion.url.startsWith('http'))));
    if (esStreamDirecto) {
      if (this.streamUrl() === cancion.url && this.currentVideoId === vId && this.currentSongUuid === cancion.uuid) {
        return;
      }
      const maxDur = cancion.duracion ? this.stringASegundos(cancion.duracion) : 0;
      if (maxDur > 0 && startSeconds >= maxDur - 2) {
        startSeconds = 0;
      }
      if (startSeconds === 0) {
        this.tiempoSegundos.set(0);
        this.tiempoFormateado.set('0:00');
        this.progreso.set(0);
      }
      this.currentVideoId = vId;
      this.currentSongUuid = cancion.uuid;
      this.streamUrl.set(cancion.url!);
      if (this.player) {
        try {
          this.player.mute();
          if (typeof this.player.stopVideo === 'function') {
            this.player.stopVideo();
          } else if (typeof this.player.pauseVideo === 'function') {
            this.player.pauseVideo();
          }
        } catch { }
      }
      this.cargando.set(false);
      const shouldPlay = autoplay && !this.intermissionActual() && !this.karaokeIntroActivo();
      this.state.reproduciendo.set(shouldPlay);
      if (this.role === 'admin') {
        this.broadcast({
          type: 'CHANGE_SONG',
          song: cancion,
          playing: shouldPlay,
          time: startSeconds,
          streamUrl: cancion.url,
        });
      }
      setTimeout(() => {
        if (this.adminStreamVideo) {
          if (startSeconds > 0) {
            try { this.adminStreamVideo.currentTime = startSeconds; } catch { }
          }
          if (this.role === 'admin') {
            this.adminStreamVideo.muted = this.muteado();
            this.adminStreamVideo.volume = (this.volumen() || 100) / 100;
          }
          if (shouldPlay) {
            this.adminStreamVideo.play().catch(() => {});
          } else {
            try { this.adminStreamVideo.pause(); } catch { }
          }
        }
        if (this.tvStreamVideo) {
          if (startSeconds > 0) {
            try { this.tvStreamVideo.currentTime = startSeconds; } catch { }
          }
          this.tvStreamVideo.muted = true;
          this.tvStreamVideo.volume = 0;
          if (shouldPlay) {
            this.tvStreamVideo.play().catch(() => {});
          } else {
            try { this.tvStreamVideo.pause(); } catch { }
          }
        }
      }, 100);
      return;
    }

    // Si es YouTube estándar: detener cualquier stream HTML5 previo para que no siga sonando huérfano de fondo
    if (this.adminStreamVideo) {
      try {
        this.adminStreamVideo.pause();
        this.adminStreamVideo.removeAttribute('src');
        this.adminStreamVideo.load();
      } catch { }
      this.adminStreamVideo = null;
    }
    this.streamUrl.set(null);

    // Comprobar si ya está cargada esta canción exacta en el reproductor de YouTube
    const yaCargadoEnPlayer = (this.currentVideoId === vId && this.currentSongUuid === cancion.uuid);

    if (this.loadingVideoId === vId) return;

    if (yaCargadoEnPlayer && this.listo() && this.player) {
      if (typeof startSeconds === 'number' && startSeconds > 0) {
        let cur = this.tiempoSegundos();
        if (typeof this.player.getCurrentTime === 'function') {
          try {
            const live = this.player.getCurrentTime();
            if (typeof live === 'number' && !isNaN(live) && live >= 0) cur = live;
          } catch { }
        }
        if (Math.abs(cur - startSeconds) > 0.5) {
          this.lastSyncSeekTime = Date.now();
          this.seekTo(startSeconds, false);
        }
      }
      if (autoplay && !this.state.reproduciendo()) {
        this.play(false);
      }
      return;
    }

    this.loadingVideoId = vId;
    this.cargando.set(true);
    this.error.set('');

    if (this.player && typeof this.player.loadVideoById === 'function' && this.listo()) {
      try {
        if (this.role === 'pantalla') {
          try {
            this.player.mute();
            this.muteado.set(true);
            this.necesitaInteraccion.set(false);
          } catch { }
        } else {
          try {
            this.player.unMute();
            this.muteado.set(false);
            this.player.setVolume(this.volumen());
            this.necesitaInteraccion.set(false);
          } catch { }
        }

        if (autoplay && !this.intermissionActual() && !this.karaokeIntroActivo()) {
          this.state.reproduciendo.set(true);
          this.player.loadVideoById({ videoId: vId, startSeconds });
          if (this.role === 'admin') {
            this.iniciarWatchdogPlayback(cancion);
          }
          if (this.role === 'pantalla') {
            try {
              this.player.mute();
              this.player.setVolume(0);
              this.player.playVideo();
            } catch { }
            setTimeout(() => {
              try {
                if (this.role === 'pantalla' && this.player && typeof this.player.playVideo === 'function') {
                  this.player.mute();
                  this.player.setVolume(0);
                  this.player.playVideo();
                }
              } catch { }
            }, 150);
          }
          if (this.role === 'admin') {
            this.intentarAutoplay(false);
          }
        } else {
          this.player.cueVideoById({ videoId: vId, startSeconds });
          this.state.reproduciendo.set(false);
          try { this.player.pauseVideo(); } catch { }
        }
        this.currentVideoId = vId;
        this.currentSongUuid = cancion.uuid;
        this.desactivarSubtitulos();
        this.cargando.set(false);
        this.progreso.set(0);
        this.tiempoFormateado.set('0:00');
      } catch (err) {
        console.warn('Error al llamar loadVideoById, reinicializando...', err);
        await this.inicializar(this.currentElementId, this.role, this.currentContainerId, vId, this.role === 'pantalla');
      } finally {
        this.loadingVideoId = '';
      }
    } else {
      this.currentVideoId = vId;
      this.currentSongUuid = cancion.uuid;
      this.pendingSong = cancion;
      this.pendingTime = startSeconds;
      if (autoplay && !this.intermissionActual() && !this.karaokeIntroActivo() && this.role === 'admin') {
        this.iniciarWatchdogPlayback(cancion, 6000);
      }
      await this.inicializar(this.currentElementId, this.role, this.currentContainerId, vId, this.role === 'pantalla');
      this.loadingVideoId = '';
    }

    if (this.role === 'admin') {
      this.broadcast({
        type: 'CHANGE_SONG',
        song: cancion,
        playing: autoplay,
        streamUrl: null,
      });
    }
  }

  desactivarSubtitulos() {
    if (!this.player) return;
    try {
      if (typeof this.player.unloadModule === 'function') {
        this.player.unloadModule('captions');
        this.player.unloadModule('cc');
      }
      if (typeof this.player.setOption === 'function') {
        this.player.setOption('captions', 'track', {});
        this.player.setOption('cc', 'track', {});
        this.player.setOption('captions', 'reload', false);
      }
    } catch { }
  }

  desbloquearAudio() {
    this.removerDesbloqueoInteraccion();
    this.necesitaInteraccion.set(false);
    if (this.role === 'pantalla' || this.intermissionActual()) return;

    if (this.streamUrl()) {
      if (this.adminStreamVideo) {
        try {
          this.adminStreamVideo.muted = false;
          this.adminStreamVideo.volume = (this.volumen() || 100) / 100;
          this.adminStreamVideo.play().catch(() => {});
        } catch { }
      }
      this.muteado.set(false);
      this.state.reproduciendo.set(true);
      return;
    }

    if (this.audioIntro) {
      try {
        this.audioIntro.volume = (this.volumen() || 100) / 100;
        this.audioIntro.play().catch(() => {});
      } catch { }
    }
    if (this.player) {
      try {
        if (typeof this.player.unMute === 'function') {
          this.player.unMute();
        }
        if (typeof this.player.setVolume === 'function') {
          this.player.setVolume(this.volumen() || 100);
        }
        this.muteado.set(false);

        let cur = 0;
        try { cur = this.player.getCurrentTime() || 0; } catch { }
        if (cur > 0 && cur < 4) {
          try { this.player.seekTo(0, true); } catch { }
        }

        if (this.state.reproduciendo() && typeof this.player.playVideo === 'function') {
          this.player.playVideo();
          if (this.role === 'admin' && (cur === 0 || this.tiempoSegundos() === 0)) {
            this.iniciarWatchdogPlayback(this.state.sonando(), 2500);
          }
        }
      } catch { }
    }
  }

  reproducirPantallaMuted() {
    if (this.role !== 'pantalla') return;
    if (this.streamUrl() && this.tvStreamVideo) {
      this.tvStreamVideo.muted = true;
      this.tvStreamVideo.volume = 0;
      this.tvStreamVideo.play().catch(() => {});
    }
    if (this.player && typeof this.player.playVideo === 'function') {
      try {
        this.player.mute();
        this.player.setVolume(0);
        this.player.playVideo();
      } catch { }
    }
    this.state.reproduciendo.set(true);
  }

  play(emitir = true) {
    if (this.intermissionActual()) return;
    if (this.karaokeIntroActivo()) {
      if (this.audioIntro && this.audioIntro.paused) {
        this.audioIntro.play().catch(() => {});
        this.state.reproduciendo.set(true);
      }
      return;
    }
    const cancion = this.state.sonando();
    if (!cancion) {
      if (this.state.cola().length > 0) {
        this.next();
      }
      return;
    }

    if (this.streamUrl()) {
      if (this.player) {
        try {
          this.player.mute();
          if (typeof this.player.pauseVideo === 'function') this.player.pauseVideo();
        } catch { }
      }
      if (this.adminStreamVideo) {
        if (this.role === 'admin') {
          this.adminStreamVideo.muted = this.muteado();
          this.adminStreamVideo.volume = (this.volumen() || 100) / 100;
        }
        this.adminStreamVideo.play().catch(() => {});
      }
      if (this.tvStreamVideo) {
        this.tvStreamVideo.muted = true;
        this.tvStreamVideo.volume = 0;
        this.tvStreamVideo.play().catch(() => {});
      }
      this.state.reproduciendo.set(true);
      if (emitir && this.role === 'admin') {
        this.broadcast({ type: 'PLAY', time: this.tiempoSegundos(), streamUrl: this.streamUrl() });
      }
      return;
    }

    if (this.adminStreamVideo) {
      try {
        this.adminStreamVideo.pause();
        this.adminStreamVideo.removeAttribute('src');
        this.adminStreamVideo.load();
      } catch { }
      this.adminStreamVideo = null;
    }

    if (this.player && typeof this.player.playVideo === 'function' && this.listo()) {
      try {
        if (this.role === 'pantalla') {
          try {
            this.player.mute();
            this.muteado.set(true);
          } catch { }
        } else {
          try {
            this.player.unMute();
            this.muteado.set(false);
            this.player.setVolume(this.volumen());
          } catch { }
        }

        if (cancion.videoId && this.currentVideoId !== cancion.videoId) {
          this.cargarCancion(cancion, true);
          return;
        }
        this.player.playVideo();
        this.state.reproduciendo.set(true);
        if (this.role === 'admin') {
          this.iniciarWatchdogPlayback(cancion);
        }
      } catch (e) {
        console.warn('Error al reproducir:', e);
      }
      if (emitir && this.role === 'admin') {
        this.broadcast({ type: 'PLAY', time: this.tiempoSegundos() });
      }
    } else {
      this.cargarCancion(cancion, true);
    }
  }

  pause(emitir = true) {
    this.limpiarWatchdogPlayback();
    this.detenerTicker();
    this.state.reproduciendo.set(false);

    if (this.adminStreamVideo) {
      try { this.adminStreamVideo.pause(); } catch { }
    }
    if (this.tvStreamVideo) {
      try { this.tvStreamVideo.pause(); } catch { }
    }
    if (this.audioIntro) {
      try { this.audioIntro.pause(); } catch { }
    }
    if (this.player && typeof this.player.pauseVideo === 'function') {
      try { this.player.pauseVideo(); } catch { }
    }

    if (emitir && this.role === 'admin') {
      this.broadcast({
        type: 'PAUSE',
        time: this.tiempoSegundos(),
        streamUrl: this.streamUrl() ?? undefined,
      });
    }
  }

  togglePlay() {
    if (this.intermissionActual()) return;

    if (this.karaokeIntroActivo()) {
      if (this.audioIntro) {
        if (this.audioIntro.paused) {
          this.audioIntro.play().catch(() => {});
          this.state.reproduciendo.set(true);
        } else {
          this.audioIntro.pause();
          this.state.reproduciendo.set(false);
        }
      }
      return;
    }

    if (!this.state.sonando()) {
      if (this.state.cola().length > 0) {
        this.next();
      }
      return;
    }

    if (this.state.reproduciendo()) {
      this.pause();
    } else {
      this.play();
    }
  }

  next() {
    if (this.karaokeIntroActivo()) {
      this.saltarKaraokeIntro();
      return;
    }

    if (this.intermissionActual()) {
      this.saltarIntermission();
      return;
    }

    const actual = this.state.sonando();
    if (actual?.uuid) {
      if (this.role === 'admin') {
        this.detenerTicker();
        this.reintentosStream = 0;
        this.cancionEnPausaUuid = null;
        this.tiempoSegundos.set(0);
        this.tiempoFormateado.set('0:00');
        this.duracionSegundos.set(0);
        this.duracionFormateada.set('0:00');
        this.progreso.set(0);
        this.currentSongUuid = '';
        this.currentVideoId = '';
        this.detenerTodoAudio();
        this.broadcast({ type: 'CHANGE_SONG', song: null, playing: false });
        this.queue.finalizar(actual.uuid).catch((e) => {
          this.error.set(e instanceof Error ? e.message : 'No se pudo pasar a la siguiente canción.');
        });
      }
      return;
    }

    const lista = this.state.cola();
    if (lista.length > 0) {
      const [siguiente, ...resto] = lista;
      this.state.cola.set(resto);
      this.state.sonando.set(siguiente);
      this.cargarCancion(siguiente, true);
    } else {
      this.state.sonando.set(null);
      this.state.reproduciendo.set(false);
      this.progreso.set(0);
      this.tiempoFormateado.set('0:00');
      this.detenerTicker();
      this.currentVideoId = '';
      this.currentSongUuid = '';
      this.loadingVideoId = '';
      this.detenerTodoAudio();
      if (this.role === 'admin') {
        this.broadcast({ type: 'CHANGE_SONG', song: null, playing: false });
      }
    }
  }

  prev() {
    if (this.intermissionActual() || this.karaokeIntroActivo()) return;
    this.seekTo(0);
  }

  seekTo(segundos: number, emitir = true) {
    if (this.intermissionActual() || this.karaokeIntroActivo()) return;
    if (this.streamUrl()) {
      if (this.adminStreamVideo) {
        this.adminStreamVideo.currentTime = segundos;
        this.tiempoSegundos.set(segundos);
        this.tiempoFormateado.set(this.segundosAString(segundos));
      }
      if (emitir && this.role === 'admin') {
        this.broadcast({ type: 'SEEK', time: segundos, streamUrl: this.streamUrl() });
      }
      return;
    }
    if (this.player && typeof this.player.seekTo === 'function') {
      try {
        this.player.seekTo(segundos, true);
        this.actualizarProgreso();
      } catch { }
      if (emitir && this.role === 'admin') {
        this.broadcast({ type: 'SEEK', time: segundos });
      }
    }
  }

  seekPorcentaje(porcentaje: number) {
    if (this.intermissionActual() || this.karaokeIntroActivo()) return;
    const dur = this.duracionSegundos();
    if (dur > 0) {
      const seg = (porcentaje / 100) * dur;
      this.seekTo(seg);
    }
  }

  setVolumen(vol: number) {
    if (this.role === 'pantalla') return;
    const v = Math.max(0, Math.min(100, vol));
    this.volumen.set(v);
    if (this.adminStreamVideo) {
      try { this.adminStreamVideo.volume = this.muteado() ? 0 : v / 100; } catch { }
    }
    if (this.player && typeof this.player.setVolume === 'function') {
      try { this.player.setVolume(v); } catch { }
    }
    if (this.audioIntro) {
      try { this.audioIntro.volume = this.muteado() ? 0 : v / 100; } catch { }
    }
  }

  toggleMute() {
    if (this.role === 'pantalla') return;
    try {
      if (this.muteado()) {
        if (this.player && typeof this.player.unMute === 'function') this.player.unMute();
        if (this.adminStreamVideo) this.adminStreamVideo.muted = false;
        this.muteado.set(false);
        if (this.audioIntro) this.audioIntro.volume = (this.volumen() || 100) / 100;
      } else {
        if (this.player && typeof this.player.mute === 'function') this.player.mute();
        if (this.adminStreamVideo) this.adminStreamVideo.muted = true;
        this.muteado.set(true);
        if (this.audioIntro) this.audioIntro.volume = 0;
      }
    } catch { }
  }

  destruir() {
    this.limpiarWatchdogPlayback();
    this.detenerAudioIntro();
    this.karaokeIntroActivo.set(false);
    this.cancionIntroPendiente = null;
    this.removerDesbloqueoInteraccion();
    if (this.timeoutAutoplay) {
      clearTimeout(this.timeoutAutoplay);
      this.timeoutAutoplay = null;
    }
    this.detenerTicker();
    if (this.player) {
      try { this.player.destroy(); } catch { }
      this.player = null;
    }
    this.listo.set(false);
    this.currentVideoId = '';
    this.loadingVideoId = '';
    this.currentPlaybackRate = 1.0;
    this.initialSyncDone = false;
  }

  // ---- Control de Pausas Publicitarias (Intermissions) ----

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

  reproducirIntermission(items: IntermissionItem[]) {
    if (!items || items.length === 0) return;

    if (this.karaokeIntroActivo()) {
      this.detenerAudioIntro();
      this.karaokeIntroActivo.set(false);
      this.cancionIntroPendiente = null;
    }

    // Solo marcar para reanudar si estaba activamente reproduciéndose (no si estaba pausado o terminó)
    const habiaMusica = this.state.reproduciendo();
    this.intermissionPausadaYoutube.set(habiaMusica);
    this.cancionEnPausaUuid = habiaMusica ? (this.state.sonando()?.uuid ?? null) : null;

    // Pausar inmediatamente todo video/audio de fondo (Stream HTML5 y YouTube en Admin y TV)
    if (this.adminStreamVideo) {
      try { this.adminStreamVideo.pause(); } catch { }
    }
    if (this.tvStreamVideo) {
      try { this.tvStreamVideo.pause(); } catch { }
    }
    if (this.player && typeof this.player.pauseVideo === 'function') {
      try { this.player.pauseVideo(); } catch { }
    }
    this.state.reproduciendo.set(false);
    this.detenerTicker();

    const itemsResueltos = items.map(it => ({
      ...it,
      url: this.resolverUrl(it.url),
      image: it.image ? this.resolverUrl(it.image) : '',
    }));

    const [primero, ...resto] = itemsResueltos;
    this.intermissionCola.set(resto);
    this.intermissionActual.set(primero);
    this.intermissionTiempo.set(0);
    this.intermissionDuracion.set(0);

    if (this.role === 'admin') {
      this.broadcast({
        type: 'INTERMISSION_START',
        intermission: primero,
      });
    }
  }

  onIntermissionVideoEnded() {
    if (this.role === 'pantalla') return; // Admin controla la secuencia y notifica a la TV

    const cola = this.intermissionCola();
    if (cola.length > 0) {
      const [siguiente, ...resto] = cola;
      this.intermissionCola.set(resto);
      this.intermissionActual.set(siguiente);
      this.intermissionTiempo.set(0);
      this.intermissionDuracion.set(0);

      if (this.role === 'admin') {
        this.broadcast({
          type: 'INTERMISSION_START',
          intermission: siguiente,
        });
      }
    } else {
      this.terminarIntermission();
    }
  }

  saltarIntermission() {
    const cola = this.intermissionCola();
    if (cola.length > 0) {
      const [siguiente, ...resto] = cola;
      this.intermissionCola.set(resto);
      this.intermissionActual.set(siguiente);
      this.intermissionTiempo.set(0);
      this.intermissionDuracion.set(0);

      if (this.role === 'admin') {
        this.broadcast({
          type: 'INTERMISSION_START',
          intermission: siguiente,
        });
      }
    } else {
      this.terminarIntermission();
    }
  }

  terminarIntermission() {
    this.intermissionActual.set(null);
    this.intermissionCola.set([]);
    this.intermissionTiempo.set(0);
    this.intermissionDuracion.set(0);

    const reanudar = this.intermissionPausadaYoutube();
    this.intermissionPausadaYoutube.set(false);

    if (this.role === 'admin') {
      this.broadcast({
        type: 'INTERMISSION_END',
        resumeSong: true,
      });
    }

    const cancion = this.state.sonando();
    if (cancion) {
      // Si la misma canción ya estaba reproduciéndose antes del anuncio (se pausó a mitad)
      if (this.cancionEnPausaUuid && this.cancionEnPausaUuid === cancion.uuid && (this.streamUrl() || this.player)) {
        this.play();
      } else {
        // Es una canción nueva que entró en cola tras finalizar la anterior:
        // Cargarla limpiamente desde el segundo 0 con reproducción automática (y ejecutar intro karaoke si aplica)
        this.cancionEnPausaUuid = null;
        this.currentSongUuid = '';
        this.currentVideoId = '';
        this.tiempoSegundos.set(0);
        this.tiempoFormateado.set('0:00');
        this.duracionSegundos.set(0);
        this.duracionFormateada.set('0:00');
        this.progreso.set(0);
        this.cargarCancion(cancion, true, 0);
      }
    } else if (this.state.cola().length > 0) {
      this.next();
    }
  }

  onIntermissionTimeUpdate(videoEl: HTMLVideoElement) {
    if (!videoEl) return;
    this.intermissionTiempo.set(videoEl.currentTime || 0);
    this.intermissionDuracion.set(videoEl.duration || 0);
  }

  formatearTiempoIntermission(): string {
    const cur = Math.max(0, Math.floor(this.intermissionTiempo()));
    const dur = Math.max(0, Math.floor(this.intermissionDuracion()));
    const curM = Math.floor(cur / 60);
    const curS = (cur % 60).toString().padStart(2, '0');
    if (!dur || isNaN(dur)) return `${curM}:${curS}`;
    const durM = Math.floor(dur / 60);
    const durS = (dur % 60).toString().padStart(2, '0');
    return `${curM}:${curS} / ${durM}:${durS}`;
  }
}