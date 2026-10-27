import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../environments/environment';
import { AppState } from './app-state';
import { Cancion, IntermissionItem } from './models';
import { YoutubeService } from './youtube.service';
import { QueueService } from './queue.service';
import { SocketService } from './socket.service';

export type PlayerRole = 'admin' | 'pantalla';

export interface PlayerBroadcastMessage {
  type: 'PLAY' | 'PAUSE' | 'CHANGE_SONG' | 'SEEK' | 'SYNC_STATE' | 'REQUEST_SYNC' | 'TIME_SYNC' | 'INTERMISSION_START' | 'INTERMISSION_END' | 'KARAOKE_INTRO_START' | 'KARAOKE_INTRO_END';
  song?: Cancion | null;
  time?: number;
  playing?: boolean;
  sentAt?: number;
  intermission?: IntermissionItem | null;
  resumeSong?: boolean;
  audioIndex?: number;
  karaokeIntro?: boolean;
}

@Injectable({ providedIn: 'root' })
export class PlayerService {
  private state = inject(AppState);
  private yt = inject(YoutubeService);
  private queue = inject(QueueService);
  private socket = inject(SocketService);
  private sanitizer = inject(DomSanitizer);

  // Mantenido para compatibilidad de interfaz (ya no se usan iframes)
  iframeUrl = signal<string>('');
  iframeSafeUrl = computed<SafeResourceUrl>(() => {
    return this.sanitizer.bypassSecurityTrustResourceUrl('about:blank');
  });

  private currentVideoId = '';
  private channel: BroadcastChannel | null = null;
  private role: PlayerRole = 'admin';

  // Introducción karaoke tras canción normal
  karaokeIntroActivo = signal<boolean>(false);
  private cancionPrevia: Cancion | null = null;
  private audioIntro: HTMLAudioElement | null = null;
  private timeoutIntro: any = null;
  private cancionIntroPendiente: Cancion | null = null;

  progreso = signal<number>(0);
  tiempoSegundos = signal<number>(0);
  duracionSegundos = signal<number>(0);
  tiempoFormateado = signal<string>('0:00');
  duracionFormateada = signal<string>('0:00');
  cargando = signal<boolean>(false);
  listo = signal<boolean>(true);
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
  private cancionInterrumpida: {
    cancion: Cancion;
    tiempo: number;
    estabaReproduciendo: boolean;
  } | null = null;

  // Estado del navegador Chromium externo en TV
  navegadorActivo = signal<boolean>(false);
  reproductorDesbloqueado = signal<boolean>(false);
  private desbloqueoTimer: any = null;

  // Ticker y sincronización vía WebSocket desde el navegador Chromium externo
  private tickerTimer: any = null;
  private lastSeekTime = 0;
  private ultimoSocketTime = 0;

  constructor() {
    this.iniciarBroadcastChannel();
    this.consultarEstadoNavegador();

    this.socket.onIntermission((payload: any) => {
      const data = payload?.data ?? (Array.isArray(payload) ? payload : []);
      if (Array.isArray(data) && data.length > 0) {
        this.reproducirIntermission(data);
      }
    });

    // Escuchar estado en vivo emitido por el backend vía WebSocket (cero peticiones GET HTTP)
    this.socket.onPlayer((status: any) => {
      this.aplicarEstadoDesdeSocket(status);
    });

    effect(() => {
      const cancion = this.state.sonando();
      // Si hay una pausa publicitaria en curso, NO interrumpir el anuncio en Chromium
      if (this.intermissionActual()) {
        return;
      }

      if (!cancion) {
        this.detenerTicker();
        this.progreso.set(0);
        this.tiempoSegundos.set(0);
        this.tiempoFormateado.set('0:00');
        this.currentVideoId = '';
        this.detenerAudioIntro();
        this.karaokeIntroActivo.set(false);
        this.cancionIntroPendiente = null;
        // NO CERRAR EL NAVEGADOR: si Chromium está abierto, mostrar la vista idle en la TV
        const baseApi = (environment?.apiUrl || 'http://localhost:3000').replace(/\/+$/, '');
        this.callPlayerApi('/play', 'POST', { url: `${baseApi}/player/idle-view`, startSeconds: 0 }).catch(() => { });
        if (this.role === 'admin') {
          this.broadcast({ type: 'CHANGE_SONG', song: null, playing: false });
        }
        return;
      }

      const vId = cancion.videoId;
      if (!vId || vId !== this.currentVideoId) {
        this.cargarCancion(cancion, true);
      }
    });
  }

  // --- API para comunicarse con el reproductor Chromium externo ---
  private getPlayerApiUrl(endpoint: string): string {
    const base = (environment?.apiUrl || 'http://localhost:3000').replace(/\/+$/, '');
    return `${base}/player${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  }

  async callPlayerApi<T = any>(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any): Promise<T | null> {
    try {
      const url = this.getPlayerApiUrl(endpoint);
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback a puerto 4000 (app.js de prueba video independiente)
      try {
        const fallbackUrl = `http://localhost:4000/api${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
        const res = await fetch(fallbackUrl, {
          method,
          headers: body ? { 'Content-Type': 'application/json' } : undefined,
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(2000)
        });
        if (res.ok) {
          return await res.json();
        }
      } catch { }
    }
    return null;
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
          if (this.karaokeIntroActivo()) return;
          if (msg.song) {
            this.cargarCancion(msg.song, msg.playing ?? true, 0);
          }
        } else if (msg.type === 'PLAY') {
          if (this.intermissionActual() || this.karaokeIntroActivo()) return;
          this.play(false);
        } else if (msg.type === 'PAUSE') {
          if (this.intermissionActual()) return;
          this.pause(false);
        } else if (msg.type === 'SEEK' && typeof msg.time === 'number') {
          if (this.intermissionActual() || this.karaokeIntroActivo()) return;
          this.seekTo(msg.time, false);
        } else if (msg.type === 'SYNC_STATE') {
          if (msg.intermission !== undefined) {
            this.intermissionActual.set(msg.intermission);
          }
          if (msg.karaokeIntro !== undefined) {
            this.karaokeIntroActivo.set(msg.karaokeIntro);
          }
          if (msg.song) {
            this.state.sonando.set(msg.song);
            if (!this.intermissionActual() && !this.karaokeIntroActivo()) {
              this.cargarCancion(msg.song, msg.playing ?? true, msg.time ?? 0);
            }
          }
        } else if (msg.type === 'KARAOKE_INTRO_START') {
          this.karaokeIntroActivo.set(true);
          this.state.reproduciendo.set(false);
        } else if (msg.type === 'KARAOKE_INTRO_END') {
          this.karaokeIntroActivo.set(false);
          if (msg.song) {
            this.ejecutarCargaCancion(msg.song, true, 0);
          }
        } else if (msg.type === 'INTERMISSION_START') {
          this.state.reproduciendo.set(false);
          this.intermissionActual.set(msg.intermission ?? null);
        } else if (msg.type === 'INTERMISSION_END') {
          this.intermissionActual.set(null);
          if (msg.resumeSong && this.state.sonando()) {
            this.play(false);
          }
        } else if (msg.type === 'TIME_SYNC' && typeof msg.time === 'number') {
          if (this.intermissionActual() || this.karaokeIntroActivo()) return;
          this.tiempoSegundos.set(msg.time);
          this.tiempoFormateado.set(this.segundosAString(msg.time));
          const dur = this.duracionSegundos();
          if (dur > 0) {
            this.progreso.set(Math.min(100, Math.max(0, (msg.time / dur) * 100)));
          }
          if (msg.playing !== undefined) {
            this.state.reproduciendo.set(msg.playing);
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
          });
        }
      }
    };
  }

  solicitarSincronizacion() {
    if (this.role !== 'pantalla') return;
    this.broadcast({ type: 'REQUEST_SYNC' });
  }

  private broadcast(msg: PlayerBroadcastMessage) {
    try {
      this.channel?.postMessage(msg);
    } catch { }
  }

  async inicializar(
    elementId: string,
    role: PlayerRole = 'admin',
    containerId?: string,
    videoIdInicial?: string,
    muted = false,
  ): Promise<void> {
    this.role = role;
    this.error.set('');
    this.muteado.set(this.role === 'pantalla' || muted);

    if (this.role === 'pantalla') {
      this.solicitarSincronizacion();
    }

    const cancionActual = this.state.sonando();
    const videoId = videoIdInicial || cancionActual?.videoId || '';
    if (videoId && cancionActual) {
      await this.cargarCancion(cancionActual, true);
    } else {
      this.listo.set(true);
      this.cargando.set(false);
    }
  }

  stringASegundos(duracion: string | undefined): number {
    if (!duracion) return 0;
    return duracion.split(':').reduce((total, parte) => total * 60 + Number(parte), 0) || 0;
  }

  private segundosAString(sec: number): string {
    const s = Math.floor(sec);
    const m = Math.floor(s / 60);
    const resto = s % 60;
    return `${m}:${resto.toString().padStart(2, '0')}`;
  }

  async cargarCancion(cancion: Cancion, autoplay = true, startSeconds = 0) {
    const esTransicionKaraoke =
      this.role === 'admin' &&
      autoplay &&
      startSeconds === 0 &&
      cancion.tipo === 'karaoke' &&
      !this.karaokeIntroActivo() &&
      !this.intermissionActual();

    if (esTransicionKaraoke) {
      this.iniciarKaraokeIntro(cancion);
      return;
    }

    await this.ejecutarCargaCancion(cancion, autoplay, startSeconds);
  }

  iniciarKaraokeIntro(cancion: Cancion) {
    this.detenerAudioIntro();
    this.cancionIntroPendiente = cancion;
    this.karaokeIntroActivo.set(true);
    this.state.reproduciendo.set(false);
    this.detenerTicker();

    // Pausar video en el navegador Chromium externo
    this.callPlayerApi('/playback', 'POST', { action: 'pause' });

    if (!cancion.videoId) {
      const query = `${cancion.titulo} ${cancion.artista}`.trim();
      this.yt.buscar(query).then((resultados) => {
        if (resultados.length > 0) {
          cancion.videoId = resultados[0].id;
          cancion.miniatura = resultados[0].miniatura;
        }
      }).catch(() => { });
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
        if (this.player && typeof this.player.unMute === 'function') {
          try { this.player.unMute(); } catch { }
        }
      }
      const vol = Math.max(0.1, (this.volumen() || 100) / 100);

      this.audioIntro = new Audio(audioUrl);
      this.audioIntro.volume = vol;

      let finalizado = false;
      const finalizar = () => {
        if (finalizado) return;
        finalizado = true;
        this.finalizarKaraokeIntro(cancion);
      };

      this.audioIntro.onended = finalizar;
      this.audioIntro.onerror = (e) => {
        console.warn('Error al reproducir audio intro karaoke:', e);
        setTimeout(() => finalizar(), 3500);
      };

      const playPromise = this.audioIntro.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Autoplay de audio intro bloqueado por el navegador:', err);
          setTimeout(() => finalizar(), 3500);
        });
      }

      this.timeoutIntro = setTimeout(() => {
        finalizar();
      }, 15000);
    } catch (e) {
      console.warn('Fallo al inicializar Audio intro:', e);
      setTimeout(() => this.finalizarKaraokeIntro(cancion), 3500);
    }
  }

  saltarKaraokeIntro() {
    if (!this.karaokeIntroActivo() || !this.cancionIntroPendiente) return;
    const cancion = this.cancionIntroPendiente;
    this.detenerAudioIntro();
    this.finalizarKaraokeIntro(cancion);
  }

  finalizarKaraokeIntro(cancion: Cancion) {
    if (!this.karaokeIntroActivo()) return;
    this.detenerAudioIntro();
    this.cancionPrevia = cancion;
    this.karaokeIntroActivo.set(false);
    this.cancionIntroPendiente = null;

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
        this.audioIntro.pause();
        this.audioIntro.currentTime = 0;
        this.audioIntro.onended = null;
        this.audioIntro.onerror = null;
      } catch { }
      this.audioIntro = null;
    }
  }

  async consultarEstadoNavegador(): Promise<boolean> {
    try {
      const status = await this.callPlayerApi<any>('/status', 'GET');
      if (status) {
        this.aplicarEstadoDesdeSocket(status);
        return !!(status.active && status.playback?.found);
      }
    } catch { }
    return false;
  }

  async ejecutarCargaCancion(cancion: Cancion, autoplay = true, startSeconds = 0) {
    this.cancionPrevia = cancion;
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

    this.currentVideoId = vId;
    this.cargando.set(false);
    this.listo.set(true);
    this.error.set('');

    const dur = cancion.segundos || this.stringASegundos(cancion.duracion) || 0;
    this.duracionSegundos.set(dur);
    this.duracionFormateada.set(cancion.duracion || this.segundosAString(dur));
    this.tiempoSegundos.set(startSeconds || 0);
    this.tiempoFormateado.set(this.segundosAString(startSeconds || 0));
    this.progreso.set(dur > 0 ? ((startSeconds || 0) / dur) * 100 : 0);

    const shouldPlay = autoplay && !this.intermissionActual();
    this.state.reproduciendo.set(shouldPlay);

    // Cargar o cambiar video en Chromium externo (reutiliza la misma pestaña existente)
    const ytUrl = `https://www.youtube.com/watch?v=${vId}`;
    await this.callPlayerApi('/play', 'POST', { url: ytUrl, startSeconds });

    if (shouldPlay) {
      this.iniciarTicker();
    } else {
      this.detenerTicker();
    }

    if (this.role === 'admin') {
      this.broadcast({
        type: 'CHANGE_SONG',
        song: cancion,
        playing: autoplay,
      });
    }
  }

  private iniciarTicker() {
    this.detenerTicker();

    this.tickerTimer = setInterval(() => {
      if (!this.state.reproduciendo() || this.intermissionActual() || this.karaokeIntroActivo()) {
        return;
      }

      // Si el navegador de la TV está activo y el socket está enviando datos en tiempo real (cada 500ms),
      // no inventar segundos locales para no adelantarse al video real
      if (this.navegadorActivo() && Date.now() - this.ultimoSocketTime < 1100) {
        return;
      }

      // Incremento suave por segundo mientras no haya nuevo valor reciente del socket o seek
      if (Date.now() - this.lastSeekTime > 1200) {
        const cur = this.tiempoSegundos() + 1;
        const dur = this.duracionSegundos();
        this.tiempoSegundos.set(cur);
        const fCur = this.segundosAString(cur);
        this.tiempoFormateado.set(fCur);
        this.state.tiempoActual.set(fCur);

        if (dur > 0) {
          const pct = Math.min(100, Math.max(0, (cur / dur) * 100));
          this.progreso.set(pct);
        }

        if (this.role === 'admin') {
          this.broadcast({
            type: 'TIME_SYNC',
            time: cur,
            playing: true,
            sentAt: Date.now()
          });
        }

        // Si la canción llega al final de su duración, avanzar a la siguiente de la lista
        if (dur > 0 && cur >= dur) {
          this.detenerTicker();
          this.next();
          return;
        }
      }
    }, 1000);
  }

  private detenerTicker() {
    if (this.tickerTimer) {
      clearInterval(this.tickerTimer);
      this.tickerTimer = null;
    }
  }

  iniciarConteoDesbloqueo() {
    this.navegadorActivo.set(true);
    if (this.reproductorDesbloqueado()) return;

    if (!this.desbloqueoTimer) {
      this.desbloqueoTimer = setTimeout(() => {
        if (this.navegadorActivo()) {
          this.reproductorDesbloqueado.set(true);
        }
        this.desbloqueoTimer = null;
      }, 3000);
    }
  }

  bloquearReproductor() {
    this.navegadorActivo.set(false);
    this.reproductorDesbloqueado.set(false);
    if (this.desbloqueoTimer) {
      clearTimeout(this.desbloqueoTimer);
      this.desbloqueoTimer = null;
    }
    this.detenerTicker();
    this.state.reproduciendo.set(false);
  }

  aplicarEstadoDesdeSocket(status: any) {
    if (!status || this.karaokeIntroActivo()) return;

    const navegadorAbierto = !!status.active;

    if (navegadorAbierto) {
      this.iniciarConteoDesbloqueo();
    } else {
      // Si el navegador se cerró, bloquear y pausar de inmediato
      if (this.navegadorActivo()) {
        this.bloquearReproductor();
      }
      return;
    }

    // Si hay una pausa publicitaria activa en Chromium, sincronizar su progreso y detectar fin
    if (this.intermissionActual()) {
      if (status.playback && status.playback.found) {
        this.ultimoSocketTime = Date.now();
        const pb = status.playback;
        const liveTime = Math.round((pb.currentTime || 0) * 10) / 10;
        this.intermissionTiempo.set(liveTime);
        if (pb.duration && pb.duration > 0) {
          this.intermissionDuracion.set(Math.round(pb.duration * 10) / 10);
        }

        // Si el video del anuncio en Chromium ha finalizado
        if (pb.ended || (pb.duration > 0 && liveTime >= pb.duration - 0.4)) {
          this.onIntermissionVideoEnded();
        }
      }
      return;
    }

    if (!this.state.sonando()) return;

    if (status.playback && status.playback.found) {
      this.ultimoSocketTime = Date.now();
      const pb = status.playback;
      const liveTime = Math.round(pb.currentTime * 10) / 10;

      // Sincronizar el segundo exacto del video si el usuario no está arrastrando la barra de búsqueda
      if (Date.now() - this.lastSeekTime > 800) {
        this.tiempoSegundos.set(liveTime);
        const fCur = this.segundosAString(liveTime);
        this.tiempoFormateado.set(fCur);
        this.state.tiempoActual.set(fCur);

        if (pb.duration && pb.duration > 0) {
          this.duracionSegundos.set(pb.duration);
          this.duracionFormateada.set(this.segundosAString(pb.duration));
        }

        const dur = this.duracionSegundos();
        if (dur > 0) {
          const pct = Math.min(100, Math.max(0, (liveTime / dur) * 100));
          this.progreso.set(pct);
        }
      }

      // Sincronizar estado play / pause real del video de YouTube
      const estaPausado = !!pb.paused;
      this.state.reproduciendo.set(!estaPausado);
      if (!estaPausado) {
        if (!this.tickerTimer) {
          this.iniciarTicker();
        }
      } else {
        this.detenerTicker();
      }

      // Si el video de YouTube ha concluido, avanzar automáticamente a la siguiente canción
      const durActual = this.duracionSegundos();
      if (durActual > 0 && liveTime >= durActual - 1.5) {
        this.detenerTicker();
        this.next();
      }
    }
  }

  desbloquearAudio() {
    this.necesitaInteraccion.set(false);
    this.muteado.set(false);
    if (this.intermissionActual()) return;
    this.play();
  }

  play(emitir = true) {
    if (this.intermissionActual() || this.karaokeIntroActivo()) return;
    if (!this.reproductorDesbloqueado()) return;

    const cancion = this.state.sonando();
    if (!cancion) {
      if (this.state.cola().length > 0) {
        this.next();
      }
      return;
    }

    if (cancion.videoId && this.currentVideoId !== cancion.videoId) {
      this.cargarCancion(cancion, true);
      return;
    }

    // Reanudar el video exactamente en el punto donde se encuentra, sin provocar rebúfer
    this.state.reproduciendo.set(true);
    this.iniciarTicker();
    this.callPlayerApi('/playback', 'POST', { action: 'play' });

    // Consultar el estado real de YouTube poco después de reanudar para alinear la barra inmediatamente
    setTimeout(() => this.consultarEstadoNavegador(), 120);
    setTimeout(() => this.consultarEstadoNavegador(), 350);

    if (emitir && this.role === 'admin') {
      this.broadcast({ type: 'PLAY', time: this.tiempoSegundos() });
    }
  }

  pause(emitir = true) {
    this.state.reproduciendo.set(false);
    this.detenerTicker();
    this.callPlayerApi('/playback', 'POST', { action: 'pause' });
    setTimeout(() => this.consultarEstadoNavegador(), 100);

    if (emitir && this.role === 'admin') {
      this.broadcast({ type: 'PAUSE', time: this.tiempoSegundos() });
    }
  }

  togglePlay() {
    if (this.intermissionActual() || this.karaokeIntroActivo()) return;
    if (!this.reproductorDesbloqueado()) return;

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
      this.tiempoSegundos.set(0);
      this.tiempoFormateado.set('0:00');
      this.detenerTicker();
      this.currentVideoId = '';
      // NO CERRAR EL NAVEGADOR: si Chromium está abierto, mostrar la vista idle en la TV
      const baseApi = (environment?.apiUrl || 'http://localhost:3000').replace(/\/+$/, '');
      this.callPlayerApi('/play', 'POST', { url: `${baseApi}/player/idle-view`, startSeconds: 0 }).catch(() => { });
      if (this.role === 'admin') {
        this.broadcast({ type: 'CHANGE_SONG', song: null, playing: false });
      }
    }
  }

  prev() {
    if (this.intermissionActual() || this.karaokeIntroActivo()) return;
    this.seekTo(0);
    this.callPlayerApi('/playback', 'POST', { action: 'restart' });
  }

  seekTo(segundos: number, emitir = true) {
    if (this.intermissionActual() || this.karaokeIntroActivo()) return;
    this.lastSeekTime = Date.now();
    const safeSec = Math.max(0, segundos);
    this.tiempoSegundos.set(safeSec);
    const dur = this.duracionSegundos();
    const pct = dur > 0 ? (safeSec / dur) * 100 : 0;
    this.progreso.set(Math.min(100, Math.max(0, pct)));
    this.tiempoFormateado.set(this.segundosAString(safeSec));
    this.state.tiempoActual.set(this.segundosAString(safeSec));

    this.callPlayerApi('/playback', 'POST', { action: 'seek', value: safeSec });
    if (emitir && this.role === 'admin') {
      this.broadcast({ type: 'SEEK', time: safeSec });
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

  actualizarProgresoVisual(porcentaje: number) {
    this.lastSeekTime = Date.now();
    const safePct = Math.max(0, Math.min(100, porcentaje));
    this.progreso.set(safePct);
    const dur = this.duracionSegundos();
    if (dur > 0) {
      const seg = Math.round(((safePct / 100) * dur) * 10) / 10;
      this.tiempoSegundos.set(seg);
      const fCur = this.segundosAString(seg);
      this.tiempoFormateado.set(fCur);
      this.state.tiempoActual.set(fCur);
    }
  }

  setVolumen(vol: number) {
    const v = Math.max(0, Math.min(100, vol));
    this.volumen.set(v);
  }

  toggleMute() {
    const nuevoMute = !this.muteado();
    this.muteado.set(nuevoMute);
  }

  toggleFullscreen() {
    this.callPlayerApi('/fullscreen', 'POST');
  }

  async duplicarEnTv() {
    const cancion = this.state.sonando();
    const curTime = this.tiempoSegundos();
    let url: string | undefined = undefined;

    if (cancion?.videoId) {
      url = `https://www.youtube.com/watch?v=${cancion.videoId}`;
    }

    // Iniciar el navegador de la TV sin reproducción automática (pausado)
    const res = await this.callPlayerApi('/launch', 'POST', {
      url,
      startSeconds: curTime > 0 ? curTime : 0,
      startPaused: true
    });

    if (res && res.success !== false) {
      this.iniciarConteoDesbloqueo();
    }

    setTimeout(() => {
      this.consultarEstadoNavegador();
    }, 1000);
  }

  destruir() {
    if (this.desbloqueoTimer) {
      clearTimeout(this.desbloqueoTimer);
      this.desbloqueoTimer = null;
    }
    this.navegadorActivo.set(false);
    this.reproductorDesbloqueado.set(false);
    this.detenerAudioIntro();
    this.karaokeIntroActivo.set(false);
    this.cancionIntroPendiente = null;
    this.detenerTicker();
    this.listo.set(false);
    this.currentVideoId = '';
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

    // Comprobar si había una canción sonando en medio de su duración
    const cancionActual = this.state.sonando();
    const curTime = this.tiempoSegundos();
    const duracion = this.duracionSegundos();
    const estabaSonando = this.state.reproduciendo();

    // Solo se guarda como "en medio" si hay canción y aún no estaba prácticamente terminada
    if (!this.cancionInterrumpida && cancionActual && (duracion <= 0 || curTime < Math.max(0, duracion - 2))) {
      this.cancionInterrumpida = {
        cancion: { ...cancionActual },
        tiempo: curTime,
        estabaReproduciendo: estabaSonando,
      };
    }

    this.detenerTicker();
    this.state.reproduciendo.set(false);

    const itemsResueltos = items.map(it => ({
      ...it,
      url: this.resolverUrl(it.url),
    }));

    const [primero, ...resto] = itemsResueltos;
    this.intermissionCola.set(resto);
    this.intermissionActual.set(primero);
    this.intermissionTiempo.set(0);
    this.intermissionDuracion.set(0);

    // Cargar y reproducir el anuncio en la MISMA ventana de Chromium donde está YouTube
    this.cargarAnuncioEnChromium(primero);

    if (this.role === 'admin') {
      this.broadcast({
        type: 'INTERMISSION_START',
        intermission: primero,
      });
    }
  }

  private async cargarAnuncioEnChromium(inter: IntermissionItem) {
    const rawUrl = inter.url;
    let urlParaChromium = rawUrl;

    if (!rawUrl.includes('youtube.com') && !rawUrl.includes('youtu.be')) {
      const baseApi = (environment?.apiUrl || 'http://localhost:3000').replace(/\/+$/, '');
      const urlParam = encodeURIComponent(rawUrl);
      const titleParam = encodeURIComponent(inter.title || 'Pausa comercial');
      urlParaChromium = `${baseApi}/player/ad-view?url=${urlParam}&title=${titleParam}`;
    }

    await this.callPlayerApi('/play', 'POST', { url: urlParaChromium, startSeconds: 0 });
  }

  onIntermissionVideoEnded() {
    if (this.role === 'pantalla') return;

    const cola = this.intermissionCola();
    if (cola.length > 0) {
      const [siguiente, ...resto] = cola;
      this.intermissionCola.set(resto);
      this.intermissionActual.set(siguiente);
      this.intermissionTiempo.set(0);
      this.intermissionDuracion.set(0);

      this.cargarAnuncioEnChromium(siguiente);

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

      this.cargarAnuncioEnChromium(siguiente);

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

    const interrumpida = this.cancionInterrumpida;
    this.cancionInterrumpida = null;

    if (this.role === 'admin') {
      this.broadcast({
        type: 'INTERMISSION_END',
        resumeSong: !!interrumpida,
      });
    }

    // 1. Si el anuncio se puso en medio de una canción:
    // Debe volver al video con su mismo minuto donde se dejó
    if (interrumpida && interrumpida.cancion) {
      const cancion = interrumpida.cancion;
      const tiempoRetorno = Math.max(0, Math.floor(interrumpida.tiempo));
      this.currentVideoId = ''; // Forzar recarga en el navegador
      this.state.sonando.set(cancion);
      this.ejecutarCargaCancion(cancion, true, tiempoRetorno);
      return;
    }

    // 2. Si el anuncio se puso después de la música (o no había canción interrumpida):
    // Debe seguir con la canción siguiente
    if (this.state.sonando()) {
      const siguiente = this.state.sonando()!;
      this.currentVideoId = '';
      this.cargarCancion(siguiente, true, 0);
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