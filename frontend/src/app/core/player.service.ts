import { effect, inject, Injectable, signal } from '@angular/core';
import { AppState } from './app-state';
import { Cancion } from './models';
import { YoutubeService } from './youtube.service';
import { QueueService } from './queue.service';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export type PlayerRole = 'admin' | 'pantalla';

export interface PlayerBroadcastMessage {
  type: 'PLAY' | 'PAUSE' | 'CHANGE_SONG' | 'SEEK' | 'SYNC_STATE' | 'REQUEST_SYNC';
  song?: Cancion | null;
  time?: number;
  playing?: boolean;
}

@Injectable({ providedIn: 'root' })
export class PlayerService {
  private state = inject(AppState);
  private yt = inject(YoutubeService);
  private queue = inject(QueueService);

  private player: any = null;
  private currentElementId = 'admin-yt-player';
  private currentContainerId = 'admin-player-container';
  private currentVideoId = '';
  private loadingVideoId = '';
  private pendingSong: Cancion | null = null;
  private timer: any = null;
  private apiLoadedPromise: Promise<void> | null = null;
  private channel: BroadcastChannel | null = null;
  private role: PlayerRole = 'admin';

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

  constructor() {
    this.iniciarBroadcastChannel();

    // Sincronización reactiva con la canción actual
    effect(() => {
      const cancion = this.state.sonando();
      if (!cancion) {
        this.detenerTicker();
        this.progreso.set(0);
        this.tiempoFormateado.set('0:00');
        this.currentVideoId = '';
        this.loadingVideoId = '';
        this.pendingSong = null;
        if (this.player && typeof this.player.stopVideo === 'function') {
          try { this.player.stopVideo(); } catch {}
        }
        if (this.role === 'admin') this.broadcast({ type: 'CHANGE_SONG', song: null, playing: false });
        return;
      }

      const vId = cancion.videoId;
      if (this.listo()) {
        if (!vId || vId !== this.currentVideoId) {
          this.cargarCancion(cancion, true);
        }
      } else {
        this.pendingSong = cancion;
      }
    });
  }

  setRole(r: PlayerRole) {
    this.role = r;
  }

  private iniciarBroadcastChannel() {
    if (typeof BroadcastChannel === 'undefined') return;
    this.channel = new BroadcastChannel('escenario89_player');
    this.channel.onmessage = (event: MessageEvent<PlayerBroadcastMessage>) => {
      const msg = event.data;
      if (!msg) return;

      if (this.role === 'pantalla') {
        if (msg.type === 'CHANGE_SONG') {
          this.state.sonando.set(msg.song ?? null);
          if (msg.song) {
            this.cargarCancion(msg.song, msg.playing ?? true);
          } else if (this.player && typeof this.player.stopVideo === 'function') {
            this.player.stopVideo();
          }
        } else if (msg.type === 'PLAY') {
          this.play(false);
        } else if (msg.type === 'PAUSE') {
          this.pause(false);
        } else if (msg.type === 'SEEK' && typeof msg.time === 'number') {
          this.seekTo(msg.time, false);
        } else if (msg.type === 'SYNC_STATE') {
          if (msg.song) {
            this.state.sonando.set(msg.song);
            this.cargarCancion(msg.song, msg.playing ?? false);
            if (typeof msg.time === 'number') {
              setTimeout(() => this.seekTo(msg.time!, false), 500);
            }
          }
        }
      } else if (this.role === 'admin') {
        if (msg.type === 'REQUEST_SYNC') {
          this.broadcast({
            type: 'SYNC_STATE',
            song: this.state.sonando(),
            time: this.tiempoSegundos(),
            playing: this.state.reproduciendo(),
          });
        }
      }
    };

    if (this.role === 'pantalla') {
      this.broadcast({ type: 'REQUEST_SYNC' });
    }
  }

  private broadcast(msg: PlayerBroadcastMessage) {
    try {
      this.channel?.postMessage(msg);
    } catch {}
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

      // Polling de seguridad por si ya se cargó o está a punto de completarse
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

      // Timeout de contingencia (5s)
      setTimeout(() => {
        clearInterval(interval);
        resolve();
      }, 5000);
    });

    return this.apiLoadedPromise;
  }

  /** Inicializa el reproductor sobre un contenedor HTML */
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

    await this.cargarApi();

    const cancionActual = this.state.sonando();
    const videoId = videoIdInicial || cancionActual?.videoId || '';
    const hayCancionReal = !!videoId;

    // Si el player ya existe y responde, simplemente cargamos la canción
    if (this.player && typeof this.player.loadVideoById === 'function' && this.listo()) {
      if (hayCancionReal && cancionActual) {
        await this.cargarCancion(cancionActual, true);
      }
      return;
    }

    // Asegurar que el elemento DOM es un <div> limpio y no un <iframe> reciclado
    let el = document.getElementById(elementId);
    const container = this.currentContainerId
      ? document.getElementById(this.currentContainerId)
      : el?.parentElement;

    if (!el || el.tagName === 'IFRAME') {
      if (container) {
        if (this.player) {
          try { this.player.destroy(); } catch {}
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

        this.player = new window.YT.Player(elementId, {
          width: '100%',
          height: '100%',
          videoId: videoId || 'dQw4w9WgXcQ', // fallback temporal si no hay canción aún
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
            origin: originUrl,
          },
          events: {
            onReady: (event: any) => {
              this.listo.set(true);
              this.cargando.set(false);

              // Asignar permisos al iframe generado para permitir reproducción de audio/video y pantalla completa
              try {
                const iframe = document.getElementById(elementId) as HTMLIFrameElement;
                if (iframe) {
                  iframe.setAttribute(
                    'allow',
                    'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
                  );
                  iframe.setAttribute('allowfullscreen', 'true');
                }
              } catch {}

              const userActive = typeof navigator !== 'undefined' && !!(navigator as any).userActivation?.hasBeenActive;
              if (this.role === 'pantalla' && !userActive && hayCancionReal) {
                // Chromium Autoplay: arrancar silenciado para no ser bloqueado por el navegador
                try {
                  event.target.mute();
                  this.muteado.set(true);
                  event.target.playVideo();
                  this.state.reproduciendo.set(true);
                  this.necesitaInteraccion.set(true);
                } catch {}
              } else if (muted || !hayCancionReal) {
                try {
                  event.target.mute();
                  this.muteado.set(true);
                  event.target.pauseVideo();
                  this.state.reproduciendo.set(false);
                } catch {}
              } else {
                try {
                  event.target.unMute();
                  this.muteado.set(false);
                  event.target.setVolume(this.volumen());
                  event.target.playVideo();
                  this.state.reproduciendo.set(true);
                  this.necesitaInteraccion.set(false);
                } catch {}
              }

              this.actualizarProgreso();

              // Si había una canción esperando mientras cargaba el reproductor
              if (this.pendingSong) {
                const pend = this.pendingSong;
                this.pendingSong = null;
                this.cargarCancion(pend, true);
              }

              resolve();
            },
            onStateChange: (event: any) => {
              this.onPlayerStateChange(event.data);
            },
            onError: (event: any) => {
              this.handlePlayerError(event.data);
            },
          },
        });
      } catch (e) {
        console.error('Error al inicializar YouTube Player:', e);
        this.error.set('No se pudo inicializar el reproductor de YouTube');
        resolve();
      }
    });
  }

  private onPlayerStateChange(stateCode: number) {
    // -1: UNSTARTED, 0: ENDED, 1: PLAYING, 2: PAUSED, 3: BUFFERING, 5: VIDEO CUED
    if (stateCode === 1) { // PLAYING
      this.state.reproduciendo.set(true);
      this.cargando.set(false);
      this.iniciarTicker();
    } else if (stateCode === 2) { // PAUSED
      this.state.reproduciendo.set(false);
      this.cargando.set(false);
      this.detenerTicker();
    } else if (stateCode === 0) { // ENDED
      this.detenerTicker();
      this.state.reproduciendo.set(false);
      this.cargando.set(false);
      this.next();
    } else if (stateCode === 3) { // BUFFERING
      this.cargando.set(true);
    } else if (stateCode === 5) { // CUED
      this.cargando.set(false);
    }
  }

  private async handlePlayerError(code: number) {
    this.cargando.set(false);
    console.warn(`YouTube Player error (${code})`);

    // 101 o 150: El autor del video prohibió reproducirlo incrustado en otras webs
    if (code === 150 || code === 101) {
      this.error.set('Este video tiene restricciones de reproducción embebida en YouTube. Buscando versión alternativa...');
      const cancion = this.state.sonando();
      if (cancion) {
        try {
          const alts = await this.yt.buscar(`${cancion.titulo} ${cancion.artista} karaoke`);
          const alt = alts.find(a => a.id !== cancion.videoId);
          if (alt) {
            cancion.videoId = alt.id;
            cancion.miniatura = alt.miniatura;
            await this.cargarCancion(cancion, true);
            return;
          }
        } catch {}
      }
      setTimeout(() => this.next(), 3500);
    } else if (code === 2) {
      this.error.set('El identificador del video de YouTube es inválido.');
    } else {
      this.error.set(`Error de YouTube (${code}). Intenta reproducir otra canción.`);
    }
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
    } catch {}
  }

  private segundosAString(sec: number): string {
    const s = Math.floor(sec);
    const m = Math.floor(s / 60);
    const resto = s % 60;
    return `${m}:${resto.toString().padStart(2, '0')}`;
  }

  /** Carga una canción en el reproductor */
  async cargarCancion(cancion: Cancion, autoplay = true) {
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

    // Evitar invocaciones duplicadas simultáneas
    if (this.loadingVideoId === vId) return;

    if (this.currentVideoId === vId && this.listo() && this.player) {
      if (autoplay && !this.state.reproduciendo()) {
        this.play();
      }
      return;
    }

    this.loadingVideoId = vId;
    this.cargando.set(true);
    this.error.set('');

    if (this.player && typeof this.player.loadVideoById === 'function' && this.listo()) {
      try {
        const userActive = typeof navigator !== 'undefined' && !!(navigator as any).userActivation?.hasBeenActive;
        if (this.role === 'pantalla' && !userActive) {
          try {
            this.player.mute();
            this.muteado.set(true);
            this.necesitaInteraccion.set(true);
          } catch {}
        } else {
          try {
            this.player.unMute();
            this.muteado.set(false);
            this.player.setVolume(this.volumen());
            this.necesitaInteraccion.set(false);
          } catch {}
        }

        if (autoplay) {
          this.player.loadVideoById({ videoId: vId, startSeconds: 0 });
          this.state.reproduciendo.set(true);
        } else {
          this.player.cueVideoById({ videoId: vId, startSeconds: 0 });
          this.state.reproduciendo.set(false);
        }
        this.cargando.set(false);
        this.progreso.set(0);
        this.tiempoFormateado.set('0:00');
      } catch (err) {
        console.warn('Error al llamar loadVideoById, reinicializando...', err);
        await this.inicializar(this.currentElementId, this.role, this.currentContainerId, vId, false);
      } finally {
        this.loadingVideoId = '';
      }
    } else {
      this.pendingSong = cancion;
      await this.inicializar(this.currentElementId, this.role, this.currentContainerId, vId, false);
      this.loadingVideoId = '';
    }

    if (this.role === 'admin') {
      this.broadcast({
        type: 'CHANGE_SONG',
        song: cancion,
        playing: autoplay,
      });
    }
  }

  /** Desbloquea el audio en Chromium tras la primera interacción del usuario */
  desbloquearAudio() {
    this.necesitaInteraccion.set(false);
    if (this.player) {
      try {
        if (typeof this.player.unMute === 'function') {
          this.player.unMute();
        }
        if (typeof this.player.setVolume === 'function') {
          this.player.setVolume(this.volumen() || 100);
        }
        this.muteado.set(false);
        if (typeof this.player.playVideo === 'function') {
          this.player.playVideo();
        }
      } catch {}
    }
  }

  play(emitir = true) {
    const cancion = this.state.sonando();
    if (!cancion) {
      if (this.state.cola().length > 0) {
        this.next();
      }
      return;
    }

    if (this.player && typeof this.player.playVideo === 'function' && this.listo()) {
      try {
        this.player.unMute();
        this.muteado.set(false);
        this.player.setVolume(this.volumen());

        if (cancion.videoId && this.currentVideoId !== cancion.videoId) {
          this.cargarCancion(cancion, true);
          return;
        }

        this.player.playVideo();
        this.state.reproduciendo.set(true);
      } catch (e) {
        console.warn('Error al reproducir:', e);
        this.cargarCancion(cancion, true);
      }
      if (emitir && this.role === 'admin') this.broadcast({ type: 'PLAY' });
    } else {
      this.cargarCancion(cancion, true);
    }
  }

  pause(emitir = true) {
    if (this.player && typeof this.player.pauseVideo === 'function') {
      try {
        this.player.pauseVideo();
        this.state.reproduciendo.set(false);
      } catch {}
      if (emitir && this.role === 'admin') this.broadcast({ type: 'PAUSE' });
    }
  }

  togglePlay() {
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

  /** Pasa a la siguiente canción en la cola */
  next() {
    // La cola vive en el backend: se marca la canción como terminada y el backend sube la siguiente.
    const actual = this.state.sonando();
    if (actual?.uuid) {
      if (this.role === 'admin') {
        this.detenerTicker();
        this.queue.finalizar(actual.uuid).catch((e) => {
          this.error.set(e instanceof Error ? e.message : 'No se pudo pasar a la siguiente canción.');
        });
      }
      return;
    }

    // Sin backend (datos de ejemplo): se maneja la cola local
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
      this.loadingVideoId = '';
      if (this.player && typeof this.player.stopVideo === 'function') {
        try { this.player.stopVideo(); } catch {}
      }
      if (this.role === 'admin') {
        this.broadcast({ type: 'CHANGE_SONG', song: null, playing: false });
      }
    }
  }

  /** Reinicia la canción actual o regresa */
  prev() {
    this.seekTo(0);
  }

  seekTo(segundos: number, emitir = true) {
    if (this.player && typeof this.player.seekTo === 'function') {
      try {
        this.player.seekTo(segundos, true);
        this.actualizarProgreso();
      } catch {}
      if (emitir && this.role === 'admin') {
        this.broadcast({ type: 'SEEK', time: segundos });
      }
    }
  }

  seekPorcentaje(porcentaje: number) {
    const dur = this.duracionSegundos();
    if (dur > 0) {
      const seg = (porcentaje / 100) * dur;
      this.seekTo(seg);
    }
  }

  setVolumen(vol: number) {
    const v = Math.max(0, Math.min(100, vol));
    this.volumen.set(v);
    if (this.player && typeof this.player.setVolume === 'function') {
      try { this.player.setVolume(v); } catch {}
    }
  }

  toggleMute() {
    if (!this.player) return;
    try {
      if (this.muteado()) {
        this.player.unMute();
        this.muteado.set(false);
      } else {
        this.player.mute();
        this.muteado.set(true);
      }
    } catch {}
  }

  destruir() {
    this.detenerTicker();
    if (this.player) {
      try { this.player.destroy(); } catch {}
      this.player = null;
    }
    this.listo.set(false);
    this.currentVideoId = '';
    this.loadingVideoId = '';
  }
}