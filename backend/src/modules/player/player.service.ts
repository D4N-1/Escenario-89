import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { spawn, ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { QueueSocketService } from '../queue-socket/queue-socket.service.js';

const CDP_PORT = 9222;

const YOUTUBE_ADBLOCK_INJECTION_CODE = `
(() => {
  if (window.__ytUltraAdBlockerInstalled) return;
  window.__ytUltraAdBlockerInstalled = true;

  // 1. Sanitize initial player response so YouTube doesn't schedule ads
  const sanitizeAdData = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    try {
      delete obj.adPlacements;
      delete obj.playerAds;
      delete obj.adSlots;
      delete obj.adBreakHeartbeatParams;
      if (obj.playbackTracking) {
        delete obj.playbackTracking.videostatsPlaybackUrl;
        delete obj.playbackTracking.videostatsDelayplayUrl;
      }
    } catch (e) {}
    return obj;
  };

  let _ytResp = window.ytInitialPlayerResponse;
  try {
    Object.defineProperty(window, 'ytInitialPlayerResponse', {
      get: () => _ytResp,
      set: (val) => { _ytResp = sanitizeAdData(val); },
      configurable: true
    });
    if (_ytResp) sanitizeAdData(_ytResp);
  } catch (e) {}

  // 2. Intercept fetch to strip ads from player responses
  if (window.fetch) {
    const rawFetch = window.fetch;
    window.fetch = async function(...args) {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
      if (url.includes('/ad_break') || url.includes('/api/stats/ads') || url.includes('/pagead/') || url.includes('googleads') || url.includes('doubleclick.net')) {
        return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      const res = await rawFetch.apply(this, args);
      if (url.includes('/youtubei/v1/player')) {
        try {
          const clone = res.clone();
          const data = await clone.json();
          sanitizeAdData(data);
          return new Response(JSON.stringify(data), {
            status: res.status,
            statusText: res.statusText,
            headers: res.headers
          });
        } catch (e) {
          return res;
        }
      }
      return res;
    };
  }

  // 3. Inject CSS to hide all ad elements immediately
  const injectStyle = () => {
    if (document.getElementById('yt-adblock-styles')) return;
    const style = document.createElement('style');
    style.id = 'yt-adblock-styles';
    style.textContent = \`
      .video-ads, .ytp-ad-module, .ytp-ad-overlay-container,
      .ytp-ad-player-overlay, .ytp-ad-player-overlay-layout,
      ytd-promoted-sparkles-web-renderer, ytd-ad-slot-renderer,
      #player-ads, .ytd-merch-shelf-renderer,
      ytd-banner-promo-renderer,
      ytd-enforcement-message-view-model,
      tp-yt-paper-dialog:has(ytd-enforcement-message-view-model) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    \`;
    (document.head || document.documentElement).appendChild(style);
  };
  injectStyle();

  // Helper: Simulate real human click with Pointer and Mouse events
  const simulateClick = (el) => {
    if (!el) return;
    try {
      const opts = { bubbles: true, cancelable: true, view: window };
      el.dispatchEvent(new PointerEvent('pointerdown', opts));
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      el.dispatchEvent(new PointerEvent('pointerup', opts));
      el.dispatchEvent(new MouseEvent('mouseup', opts));
      el.dispatchEvent(new MouseEvent('click', opts));
      if (typeof el.click === 'function') el.click();
    } catch (e) {}
  };

  // 4. Ultra-fast ad skipper loop (runs every 50ms + on video timeupdate)
  let wasAdShowing = false;

  const skipActiveAds = () => {
    const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
    const video = document.querySelector('video');

    const isAd = player && (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting'));

    if (isAd) {
      wasAdShowing = true;

      if (video) {
        video.muted = true;
        video.playbackRate = 16;
        if (isFinite(video.duration) && video.duration > 0) {
          video.currentTime = video.duration;
          video.dispatchEvent(new Event('ended', { bubbles: true }));
        }
      }

      if (player && typeof player.skipAd === 'function') {
        try { player.skipAd(); } catch (e) {}
      }

      const skipSelectors = [
        '.ytp-skip-ad-button',
        '.ytp-ad-skip-button',
        '.ytp-ad-skip-button-modern',
        '.ytp-ad-skip-button-slot button',
        '.ytp-ad-skip-button-container button',
        'button.ytp-ad-skip-button-modern',
        'button.ytp-ad-skip-button-text',
        '.ytp-ad-overlay-close-button',
        '.videoAdUiSkipButton',
        '[id^="skip-button:"]',
        '[id^="skip-button:"] button',
        'button[class*="skip-button"]',
        'button[aria-label*="Saltar"]',
        'button[aria-label*="Skip"]',
        '.ytp-ad-text.ytp-ad-preview-text',
        '.ytp-ad-skip-button-slot',
        '.ytp-ad-skip-button-container'
      ];

      for (const sel of skipSelectors) {
        document.querySelectorAll(sel).forEach(el => {
          simulateClick(el);
          const b = el.querySelector('button') || el.closest('button');
          if (b && b !== el) simulateClick(b);
        });
      }

      const dismissBtns = document.querySelectorAll('tp-yt-paper-dialog #dismiss-button, ytd-popup-container #dismiss-button, ytd-enforcement-message-view-model button');
      dismissBtns.forEach(btn => simulateClick(btn));
    } else if (wasAdShowing) {
      wasAdShowing = false;
      if (video) {
        video.playbackRate = 1;
        video.muted = false;
        if (video.paused) {
          video.play().catch(() => {});
        }
      }
    }
  };

  // 5. High-precision continuous playback tracking for TV-preview sync
  const trackPlayback = () => {
    const v = document.querySelector('video');
    const yt = document.getElementById('movie_player');
    if (!v) return;
    let vId = '';
    if (yt && typeof yt.getVideoData === 'function') {
      try { vId = yt.getVideoData()?.video_id || ''; } catch (e) {}
    }
    window.__escenario_playback = {
      currentTime: v.currentTime || 0,
      duration: v.duration || 0,
      paused: v.paused,
      ended: v.ended,
      playbackRate: v.playbackRate || 1,
      videoId: vId,
      timestamp: Date.now()
    };
  };

  setInterval(skipActiveAds, 50);
  setInterval(injectStyle, 1000);

  const bindVideoEvents = () => {
    const video = document.querySelector('video');
    if (video && !video.__ytAdSkipBound) {
      video.__ytAdSkipBound = true;
      video.addEventListener('timeupdate', skipActiveAds);
      video.addEventListener('play', skipActiveAds);
      video.addEventListener('timeupdate', trackPlayback);
      video.addEventListener('play', trackPlayback);
      video.addEventListener('pause', trackPlayback);
      video.addEventListener('seeked', trackPlayback);
    }
  };
  setInterval(bindVideoEvents, 500);
  bindVideoEvents();

  skipActiveAds();
  trackPlayback();
})();
`;

export interface VideoPlaybackState {
  found: boolean;
  paused: boolean;
  currentTime: number;
  duration: number;
  title: string;
  ended?: boolean;
  isFullscreen?: boolean;
  ytState?: number | null;
  videoId?: string;
  timestamp?: number;
}

export interface CurrentVideoStatus {
  active: boolean;
  url: string;
  title: string;
  pid: number | null;
  playback: VideoPlaybackState;
}

@Injectable()
export class PlayerService implements OnModuleDestroy {
  private readonly logger = new Logger(PlayerService.name);

  private currentVideoProcess: ChildProcess | null = null;
  private currentVideoState: CurrentVideoStatus = {
    active: false,
    url: '',
    title: '',
    pid: null,
    playback: { found: false, paused: true, currentTime: 0, duration: 0, title: '', isFullscreen: false }
  };

  private cdpMsgCounter = 1;
  private currentCdpWs: WebSocket | null = null;
  private currentCdpTargetId: string | null = null;
  private pendingCdpCallbacks = new Map<number, (res: any) => void>();
  private fullscreenCheckTimer: any = null;
  private isTogglingFullscreen = false;
  private lastAutoFullscreenEnforce = 0;
  private statusBroadcastInterval: any = null;

  constructor(
    @Optional() private readonly queueSocketService?: QueueSocketService
  ) { }

  onModuleDestroy() {
    this.stopAutoFullscreenWatcher();
    this.stopStatusBroadcasting();
    this.closeCurrentVideo().catch(() => { });
  }

  startStatusBroadcasting() {
    if (this.statusBroadcastInterval) return;
    this.statusBroadcastInterval = setInterval(async () => {
      const status = await this.getStatus();
      this.broadcastStatus(status);

      // Verificación de respaldo suave: si el video de YouTube está reproduciendo y no está en pantalla completa
      const p = status?.playback;
      if (
        status?.active &&
        p?.found &&
        !p.paused &&
        p.currentTime > 4 &&
        p.isFullscreen === false &&
        status.url &&
        status.url.includes('youtube.com') &&
        !this.isTogglingFullscreen
      ) {
        const now = Date.now();
        if (now - this.lastAutoFullscreenEnforce > 10000) {
          this.lastAutoFullscreenEnforce = now;
          this.logger.log('Detectado que el video en reproducción no está en pantalla completa. Aplicando (1 sola vez)...');
          this.triggerFullscreenOnActiveTab().catch(() => { });
        }
      }

      if (!this.currentVideoProcess && !status.active) {
        this.stopStatusBroadcasting();
      }
    }, 250);
  }

  stopStatusBroadcasting() {
    if (this.statusBroadcastInterval) {
      clearInterval(this.statusBroadcastInterval);
      this.statusBroadcastInterval = null;
    }
  }

  broadcastStatus(status: CurrentVideoStatus) {
    try {
      this.queueSocketService?.updatePlayerStatus(status);
    } catch { }
  }

  getChromiumPath(): string | null {
    const possiblePaths = [
      path.join(process.env.LOCALAPPDATA || '', 'BraveSoftware\\Brave-Browser\\Application\\brave.exe'),
      'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
      'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
    ];

    for (const p of possiblePaths) {
      if (p && fs.existsSync(p)) {
        return p;
      }
    }
    return null;
  }

  getLoadedExtensions(): string | null {
    const rootDir = process.cwd();
    const possibleDirs = [
      path.resolve(rootDir, '../prueba video/extensions/ublock'),
      path.resolve(rootDir, 'prueba video/extensions/ublock'),
      path.resolve(rootDir, 'extensions/ublock'),
      path.resolve(__dirname, '../../../../prueba video/extensions/ublock'),
      path.resolve(__dirname, '../../../prueba video/extensions/ublock')
    ];

    for (const d of possibleDirs) {
      if (fs.existsSync(path.join(d, 'manifest.json'))) {
        return d;
      }
    }
    return null;
  }

  sanitizeVideoUrl(rawUrl: string, startSeconds = 0): string {
    const finalUrl = (rawUrl || '').trim();
    const ytMatch = finalUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]{11})/);
    if (ytMatch && ytMatch[1]) {
      const timeParam = startSeconds > 0 ? `&t=${Math.floor(startSeconds)}s` : '';
      return `https://www.youtube.com/watch?v=${ytMatch[1]}${timeParam}`;
    }
    return finalUrl;
  }

  closeCdpConnection() {
    if (this.currentCdpWs) {
      try {
        this.currentCdpWs.onopen = null;
        this.currentCdpWs.onmessage = null;
        this.currentCdpWs.onerror = null;
        this.currentCdpWs.onclose = null;
        this.currentCdpWs.close();
      } catch { }
      this.currentCdpWs = null;
    }
    this.currentCdpTargetId = null;
    for (const cb of this.pendingCdpCallbacks.values()) {
      try { cb({ error: { message: 'Conexión CDP reseteada' } }); } catch { }
    }
    this.pendingCdpCallbacks.clear();
  }

  async getActivePageTarget(): Promise<any> {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json`, { signal: AbortSignal.timeout(600) });
      const list: any = await res.json();
      if (!Array.isArray(list)) return null;
      return list.find((t: any) => t.type === 'page' && !t.url?.startsWith('chrome-devtools://'));
    } catch {
      return null;
    }
  }

  private initializeAdBlockingOnTarget(ws: WebSocket) {
    try {
      ws.send(JSON.stringify({ id: ++this.cdpMsgCounter, method: 'Network.enable' }));
      ws.send(JSON.stringify({
        id: ++this.cdpMsgCounter,
        method: 'Network.setBlockedURLs',
        params: {
          urls: [
            '*googleads*',
            '*doubleclick.net*',
            '*youtube.com/pagead/*',
            '*youtube.com/api/stats/ads*',
            '*youtube.com/youtubei/v1/player/ad_break*',
            '*youtube.com/get_midroll_info*'
          ]
        }
      }));

      ws.send(JSON.stringify({ id: ++this.cdpMsgCounter, method: 'Page.enable' }));
      ws.send(JSON.stringify({
        id: ++this.cdpMsgCounter,
        method: 'Page.addScriptToEvaluateOnNewDocument',
        params: { source: YOUTUBE_ADBLOCK_INJECTION_CODE }
      }));

      ws.send(JSON.stringify({
        id: ++this.cdpMsgCounter,
        method: 'Runtime.evaluate',
        params: { expression: YOUTUBE_ADBLOCK_INJECTION_CODE }
      }));
    } catch { }
  }

  async getCdpConnection(): Promise<WebSocket | null> {
    const target = await this.getActivePageTarget();
    if (!target || !target.webSocketDebuggerUrl) {
      this.closeCdpConnection();
      return null;
    }

    if (this.currentCdpWs && this.currentCdpTargetId === target.id && this.currentCdpWs.readyState === WebSocket.OPEN) {
      return this.currentCdpWs;
    }

    this.closeCdpConnection();

    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(target.webSocketDebuggerUrl);
        const timer = setTimeout(() => {
          try { ws.close(); } catch { }
          resolve(null);
        }, 2000);

        ws.onopen = () => {
          clearTimeout(timer);
          this.currentCdpWs = ws;
          this.currentCdpTargetId = target.id;
          this.initializeAdBlockingOnTarget(ws);
          resolve(ws);
        };

        ws.onmessage = (event) => {
          try {
            const dataStr = typeof event.data === 'string' ? event.data : event.data.toString();
            const msg = JSON.parse(dataStr);
            if (msg.id && this.pendingCdpCallbacks.has(msg.id)) {
              const cb = this.pendingCdpCallbacks.get(msg.id)!;
              this.pendingCdpCallbacks.delete(msg.id);
              cb(msg);
            }
          } catch { }
        };

        ws.onerror = () => {
          clearTimeout(timer);
          this.closeCdpConnection();
          resolve(null);
        };

        ws.onclose = () => {
          this.closeCdpConnection();
        };
      } catch {
        resolve(null);
      }
    });
  }

  async evaluateInActiveTab(expression: string, timeoutMs = 2500): Promise<{ ok: boolean; value?: any; error?: string }> {
    const ws = await this.getCdpConnection();
    if (!ws) {
      return { ok: false, error: 'No hay ventana activa de video conectada' };
    }

    const id = ++this.cdpMsgCounter;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingCdpCallbacks.delete(id);
        resolve({ ok: false, error: 'Timeout esperando respuesta de la página' });
      }, timeoutMs);

      this.pendingCdpCallbacks.set(id, (msg) => {
        clearTimeout(timer);
        if (msg.error) {
          resolve({ ok: false, error: msg.error.message || 'Error en CDP' });
        } else if (msg.result && msg.result.result) {
          resolve({ ok: true, value: msg.result.result.value });
        } else {
          resolve({ ok: true, value: null });
        }
      });

      try {
        ws.send(JSON.stringify({
          id,
          method: 'Runtime.evaluate',
          params: {
            expression,
            returnByValue: true,
            awaitPromise: true
          }
        }));
      } catch (err: any) {
        clearTimeout(timer);
        this.pendingCdpCallbacks.delete(id);
        this.closeCdpConnection();
        resolve({ ok: false, error: err?.message || 'Error al enviar por CDP' });
      }
    });
  }

  async getVideoPlaybackStatus(): Promise<VideoPlaybackState> {
    const res = await this.evaluateInActiveTab(`
      (() => {
        const yt = document.getElementById('movie_player');
        const hasYt = yt && typeof yt.getPlayerState === 'function';
        const v = document.querySelector('video');

        if (!hasYt && !v) {
          return { found: false, paused: true, currentTime: 0, duration: 0, title: '' };
        }

        let currentTime = 0;
        let duration = 0;
        let isPlaying = false;

        if (v) {
          currentTime = v.currentTime || 0;
          duration = v.duration || 0;
          isPlaying = (!v.paused && !v.ended && v.readyState >= 2);
        }

        let ytState = null;
        let videoId = '';
        if (hasYt) {
          try {
            const ytTime = yt.getCurrentTime();
            const ytDur = yt.getDuration();
            const state = yt.getPlayerState();
            ytState = typeof state === 'number' ? state : null;
            if (ytTime && ytTime > 0) currentTime = ytTime;
            if (ytDur && ytDur > 0) duration = ytDur;
            if (typeof yt.getVideoData === 'function') {
              videoId = yt.getVideoData()?.video_id || '';
            }
            // state: 1 = PLAYING, 2 = PAUSED, 3 = BUFFERING
            if (state === 1) {
              isPlaying = true;
            } else if (state === 2 || state === -1 || state === 5) {
              isPlaying = false;
            } else if (state === 3) {
              // Si está buffereando al inicio (currentTime === 0), no considerar reproduciendo aún
              isPlaying = (currentTime > 0);
            }
          } catch (e) {}
        }

        if (v && !v.paused && !v.ended && (currentTime > 0 || !v.seeking)) {
          isPlaying = true;
        }

        const paused = !isPlaying;

        if (!isFinite(duration) || isNaN(duration) || duration < 0) duration = 0;
        if (!isFinite(currentTime) || isNaN(currentTime) || currentTime < 0) currentTime = 0;

        let ytEnded = false;
        if (hasYt && typeof yt.getPlayerState === 'function') {
          try {
            ytEnded = (yt.getPlayerState() === 0);
          } catch (e) {}
        }
        const isEnded = ytEnded || (v ? (!!v.ended || (duration > 0 && currentTime >= duration - 0.8) || !!window.__adEnded) : false);

        const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement) ||
                     (yt && yt.classList && yt.classList.contains('ytp-fullscreen')) ||
                     (yt && typeof yt.isFullscreen === 'function' && yt.isFullscreen());

        return {
          found: true,
          paused: !!paused,
          currentTime: Math.round(currentTime * 100) / 100,
          duration: Math.round(duration * 10) / 10,
          title: document.title || '',
          ended: isEnded,
          isFullscreen: !!isFs,
          ytState: ytState,
          videoId: videoId,
          timestamp: Date.now()
        };
      })()
    `, 1200);

    if (res.ok && res.value && res.value.found) {
      return res.value;
    }
    return { found: false, paused: true, currentTime: 0, duration: 0, title: '', ended: false, isFullscreen: false, ytState: null };
  }

  async controlVideoPlayback(action: string, value?: any): Promise<{ success: boolean; action?: string; value?: any; error?: string }> {
    const code = `
      ((action, value) => {
        const yt = document.getElementById('movie_player');
        const hasYt = yt && typeof yt.getPlayerState === 'function';
        const v = document.querySelector('video');

        if (!hasYt && !v) {
          return { success: false, error: 'No se encontró reproductor de video en la página' };
        }

        try {
          if (action === 'play') {
            if (hasYt) yt.playVideo();
            if (v && v.paused) v.play().catch(() => {});
            return { success: true, action: 'play', paused: false };
          }

          if (action === 'pause') {
            if (hasYt) yt.pauseVideo();
            if (v && !v.paused) v.pause();
            return { success: true, action: 'pause', paused: true };
          }

          if (action === 'toggle') {
            let isPaused = true;
            if (hasYt) {
              const state = yt.getPlayerState();
              isPaused = (state !== 1 && state !== 3);
              if (isPaused) yt.playVideo();
              else yt.pauseVideo();
            } else if (v) {
              isPaused = v.paused;
              if (isPaused) v.play().catch(() => {});
              else v.pause();
            }
            return { success: true, action: isPaused ? 'play' : 'pause', paused: !isPaused };
          }

          if (action === 'seek') {
            const targetSec = Math.max(0, parseFloat(value) || 0);
            if (hasYt) yt.seekTo(targetSec, true);
            if (v) v.currentTime = targetSec;
            return { success: true, action: 'seek', time: targetSec };
          }

          if (action === 'restart') {
            if (hasYt) {
              yt.seekTo(0, true);
              yt.playVideo();
            }
            if (v) {
              v.currentTime = 0;
              v.play().catch(() => {});
            }
            return { success: true, action: 'restart', time: 0, paused: false };
          }

          if (action === 'skip') {
            const delta = parseFloat(value) || 0;
            let cur = 0;
            if (hasYt) cur = yt.getCurrentTime() || (v ? v.currentTime : 0) || 0;
            else if (v) cur = v.currentTime || 0;

            let dur = 0;
            if (hasYt) dur = yt.getDuration() || (v ? v.duration : 0) || 0;
            else if (v) dur = v.duration || 0;

            let newTime = Math.max(0, cur + delta);
            if (dur > 0 && newTime > dur) newTime = dur;

            if (hasYt) yt.seekTo(newTime, true);
            if (v) v.currentTime = newTime;
            return { success: true, action: 'skip', time: Math.round(newTime * 10) / 10 };
          }

          return { success: false, error: 'Acción no reconocida: ' + action };
        } catch (err) {
          return { success: false, error: err.message };
        }
      })(${JSON.stringify(action)}, ${JSON.stringify(value)})
    `;

    const res = await this.evaluateInActiveTab(code, 2000);
    if (res.ok && res.value) {
      setTimeout(async () => {
        const status = await this.getStatus();
        this.broadcastStatus(status);
      }, 30);
      setTimeout(async () => {
        const status = await this.getStatus();
        this.broadcastStatus(status);
      }, 250);
      return res.value;
    }
    return { success: false, error: res.error || 'Error al ejecutar comando de reproducción' };
  }

  async navigateExistingTab(targetUrl: string): Promise<boolean> {
    const ws = await this.getCdpConnection();
    if (!ws) {
      return false;
    }

    const id = ++this.cdpMsgCounter;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingCdpCallbacks.delete(id);
        resolve(false);
      }, 4000);

      this.pendingCdpCallbacks.set(id, (msg) => {
        clearTimeout(timer);
        setTimeout(() => this.closeCdpConnection(), 100);
        resolve(!msg.error);
      });

      try {
        ws.send(JSON.stringify({
          id,
          method: 'Page.navigate',
          params: { url: targetUrl }
        }));
      } catch {
        clearTimeout(timer);
        this.pendingCdpCallbacks.delete(id);
        this.closeCdpConnection();
        resolve(false);
      }
    });
  }

  async isVideoInFullscreen(): Promise<{ isFs: boolean; isYt: boolean; btnCoords?: { x: number; y: number } | null }> {
    const code = `
      (() => {
        const isYt = window.location.hostname.includes('youtube.com');
        if (!isYt) return { isFs: true, isYt: false, btnCoords: null };

        const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
        const v = document.querySelector('video');

        // 1. Verificación nativa de Fullscreen API
        let isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);

        // 2. Clase interna de YouTube .ytp-fullscreen o método isFullscreen()
        if (!isFs && player) {
          if (player.classList && player.classList.contains('ytp-fullscreen')) isFs = true;
          if (typeof player.isFullscreen === 'function' && player.isFullscreen()) isFs = true;
        }

        // 3. Inspección del botón de pantalla completa de YouTube
        const btn = document.querySelector('.ytp-fullscreen-button');
        let btnCoords = null;
        if (btn) {
          const title = (btn.getAttribute('title') || '').toLowerCase();
          const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
          const dataTitle = (btn.getAttribute('data-title-no-tooltip') || '').toLowerCase();
          if (
            title.includes('salir') || title.includes('exit') ||
            aria.includes('salir') || aria.includes('exit') ||
            dataTitle.includes('salir') || dataTitle.includes('exit')
          ) {
            isFs = true;
          }
          const r = btn.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            btnCoords = { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
          }
        }

        // 4. Verificación geométrica: el video ocupa toda la ventana visible
        if (!isFs && v && window.innerWidth > 0 && window.innerHeight > 0) {
          const vr = v.getBoundingClientRect();
          if (Math.abs(vr.width - window.innerWidth) <= 6 && Math.abs(vr.height - window.innerHeight) <= 6) {
            isFs = true;
          }
        }

        return { isFs, isYt, btnCoords };
      })()
    `;

    const res = await this.evaluateInActiveTab(code, 1500);
    if (res.ok && res.value) {
      return res.value;
    }
    return { isFs: false, isYt: true, btnCoords: null };
  }

  async triggerFullscreenOnActiveTab(force = false): Promise<boolean> {
    if (this.isTogglingFullscreen) return false;

    const check = await this.isVideoInFullscreen();

    if (!check.isYt) {
      return true;
    }

    if (check.isFs && !force) {
      this.logger.log('Ya está en Pantalla Completa. No se envía tecla F.');
      return true;
    }

    this.isTogglingFullscreen = true;
    this.lastAutoFullscreenEnforce = Date.now();

    // Desenfocar cualquier input (ej. buscador de YouTube) para que la pulsación no escriba texto
    await this.evaluateInActiveTab(`
      (() => {
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.isContentEditable)) {
          if (typeof document.activeElement.blur === "function") document.activeElement.blur();
        }
        const p = document.getElementById('movie_player') || document.querySelector('.html5-video-player') || document.querySelector('video');
        if (p && typeof p.focus === 'function') {
          p.focus();
        }
      })()
    `, 800).catch(() => { });

    const ws = await this.getCdpConnection();
    if (!ws) {
      this.isTogglingFullscreen = false;
      return false;
    }

    try {
      this.logger.log('Enviando pulsación de tecla F (1 sola vez)...');

      // Enviar ÚNICAMENTE la tecla F (sin clic de ratón que causaría doble toggle y salida de pantalla completa)
      ws.send(JSON.stringify({
        id: ++this.cdpMsgCounter,
        method: 'Input.dispatchKeyEvent',
        params: { type: 'rawKeyDown', key: 'f', code: 'KeyF', windowsVirtualKeyCode: 70, unmodifiedText: 'f', text: 'f' }
      }));
      ws.send(JSON.stringify({
        id: ++this.cdpMsgCounter,
        method: 'Input.dispatchKeyEvent',
        params: { type: 'keyUp', key: 'f', code: 'KeyF', windowsVirtualKeyCode: 70, unmodifiedText: 'f', text: 'f' }
      }));

      setTimeout(async () => {
        this.isTogglingFullscreen = false;
        const after = await this.isVideoInFullscreen();
        if (after.isFs) {
          this.logger.log('Pantalla Completa confirmada con éxito.');
        }
      }, 2000);

      return true;
    } catch {
      this.isTogglingFullscreen = false;
      return false;
    }
  }

  async ensureAdBlockerActive() {
    await this.evaluateInActiveTab(YOUTUBE_ADBLOCK_INJECTION_CODE, 1000).catch(() => { });
  }

  scheduleAutoFullscreen(isAd = false) {
    this.stopAutoFullscreenWatcher();

    if (isAd) {
      // Para anuncios en ad-view, la ventana ya corre en pantalla completa nativa sin marcos
      return;
    }

    this.logger.log('Video cambiado. Asegurando adblocker y programando Pantalla Completa...');
    setTimeout(() => this.ensureAdBlockerActive(), 800);

    // Esperar 3.8 segundos para que YouTube termine de cargar e iniciar el video
    this.fullscreenCheckTimer = setTimeout(async () => {
      await this.ensureAdBlockerActive();
      await this.triggerFullscreenOnActiveTab();
      this.fullscreenCheckTimer = null;
    }, 3800);
  }

  stopAutoFullscreenWatcher() {
    if (this.fullscreenCheckTimer) {
      clearTimeout(this.fullscreenCheckTimer);
      this.fullscreenCheckTimer = null;
    }
    this.isTogglingFullscreen = false;
  }

  async playOrChangeVideo(rawUrl: string, startSeconds = 0, forceLaunch = false, startPaused = false): Promise<boolean> {
    const isAd = rawUrl.includes('/player/ad-view') || (!rawUrl.includes('youtube.com') && !rawUrl.includes('youtu.be'));
    const finalUrl = isAd ? (rawUrl || '').trim() : this.sanitizeVideoUrl(rawUrl, startSeconds);

    // 0. Si ya hay una pestaña activa con este mismo video, asegurar reproducción sin recargar desde cero
    if (!isAd) {
      const activeTarget = await this.getActivePageTarget();
      if (activeTarget && activeTarget.url) {
        const vIdMatch = finalUrl.match(/(?:watch\?v=|embed\/|v\/|shorts\/)([\w-]{11})/);
        const currentTargetUrl = activeTarget.url;
        if (vIdMatch && currentTargetUrl.includes(vIdMatch[1])) {
          this.logger.log(`Video ya presente en pestaña activa de Chromium: ${currentTargetUrl}`);
          this.currentVideoState.active = true;
          this.currentVideoState.url = currentTargetUrl;
          this.scheduleAutoFullscreen(isAd);
          if (startPaused) {
            await this.controlVideoPlayback('pause');
          } else {
            await this.controlVideoPlayback('play');
          }
          if (startSeconds > 0) {
            const curPb = await this.getVideoPlaybackStatus();
            if (Math.abs(curPb.currentTime - startSeconds) > 2) {
              await this.controlVideoPlayback('seek', startSeconds);
            }
          }
          const status = await this.getStatus();
          this.broadcastStatus(status);
          this.startStatusBroadcasting();
          return true;
        }
      }
    }

    // 1. Intentar navegar la pestaña activa en la misma ventana de Chromium
    const navigated = await this.navigateExistingTab(finalUrl);
    if (navigated) {
      this.logger.log(`Navegando en la misma pestaña existente a: ${finalUrl}`);
      this.currentVideoState.active = true;
      this.currentVideoState.url = finalUrl;
      this.scheduleAutoFullscreen(isAd);

      if (!isAd) {
        if (startPaused) {
          setTimeout(() => {
            if (startSeconds > 0) this.controlVideoPlayback('seek', startSeconds);
            this.controlVideoPlayback('pause');
          }, 1500);
        } else {
          setTimeout(() => {
            if (startSeconds > 0) this.controlVideoPlayback('seek', startSeconds);
            this.controlVideoPlayback('play');
          }, 2200);
        }
      }
      this.startStatusBroadcasting();
      return true;
    }

    // 2. Si no hay pestaña activa, SOLO lanzar Chromium si se solicitó explícitamente (al pulsar Duplicar TV)
    if (!forceLaunch) {
      this.logger.log('Navegador de TV (Chromium) no está activo y no se solicitó lanzamiento explícito.');
      return false;
    }

    this.logger.log(`Lanzando navegador Chromium para TV: ${finalUrl} (startPaused=${startPaused})`);
    const launched = this.launchVideoFullscreen(finalUrl, isAd, startSeconds);
    if (launched) {
      this.scheduleAutoFullscreen(isAd);
      if (!isAd) {
        if (startPaused) {
          setTimeout(() => {
            if (startSeconds > 0) this.controlVideoPlayback('seek', startSeconds);
            this.controlVideoPlayback('pause');
          }, 2500);
        } else {
          setTimeout(() => {
            if (startSeconds > 0) this.controlVideoPlayback('seek', startSeconds);
            this.controlVideoPlayback('play');
          }, 3200);
        }
      }
      this.startStatusBroadcasting();
    }
    return launched;
  }

  async launchTvBrowser(targetUrl?: string, startSeconds = 0, startPaused = false): Promise<boolean> {
    const port = process.env.NEST_PORT || 3000;
    const defaultUrl = `http://localhost:${port}/player/idle-view`;
    const finalUrl = (targetUrl || '').trim() || defaultUrl;
    return this.playOrChangeVideo(finalUrl, startSeconds, true, startPaused);
  }

  launchVideoFullscreen(targetUrl: string, isAd = false, startSeconds = 0): boolean {
    const finalUrl = isAd ? targetUrl : this.sanitizeVideoUrl(targetUrl, startSeconds);
    const browserPath = this.getChromiumPath();
    const isBrave = Boolean(browserPath && browserPath.toLowerCase().includes('brave'));
    const tempProfileDir = path.join(os.tmpdir(), isBrave ? 'brave_video_profile' : 'chroplayer_video_profile');
    const browserName = isBrave ? 'Brave' : 'Chromium/Chrome';

    const flags = [
      `--app=${finalUrl}`,
      '--start-fullscreen',
      '--start-maximized',
      `--remote-debugging-port=${CDP_PORT}`,
      '--remote-debugging-address=127.0.0.1',
      `--user-data-dir=${tempProfileDir}`,
      '--disable-features=Translate',
      '--no-first-run',
      '--no-default-browser-check',
      '--autoplay-policy=no-user-gesture-required'
    ];

    if (!isBrave) {
      flags.push('--enable-extensions');
      const extPath = this.getLoadedExtensions();
      if (extPath) {
        this.logger.log(`Extensiones activadas: ${extPath}`);
        flags.push(`--disable-extensions-except=${extPath}`);
        flags.push(`--load-extension=${extPath}`);
      }
    } else {
      this.logger.log('Brave Shields activo (bloqueo nativo C++ de anuncios de YouTube).');
    }

    if (browserPath) {
      this.logger.log(`Abriendo ${browserName} en Pantalla Completa: ${finalUrl}`);
      const proc = spawn(browserPath, flags, { detached: false, stdio: 'ignore' });
      this.currentVideoProcess = proc;
      this.currentVideoState.active = true;
      this.currentVideoState.url = finalUrl;
      this.currentVideoState.pid = proc.pid || null;
      this.broadcastStatus(this.currentVideoState);
      this.startStatusBroadcasting();

      proc.on('exit', () => {
        this.logger.log('Ventana de Chromium cerrada.');
        this.currentVideoProcess = null;
        this.currentVideoState.active = false;
        this.currentVideoState.url = '';
        this.currentVideoState.title = '';
        this.currentVideoState.pid = null;
        this.currentVideoState.playback = { found: false, paused: true, currentTime: 0, duration: 0, title: '', ended: false };
        this.stopStatusBroadcasting();
        this.broadcastStatus(this.currentVideoState);
      });

      return true;
    } else {
      spawn('cmd', ['/c', 'start', finalUrl], { detached: true, stdio: 'ignore' }).unref();
      this.currentVideoState.active = true;
      this.currentVideoState.url = finalUrl;
      return true;
    }
  }

  async closeCurrentVideo(): Promise<boolean> {
    this.stopAutoFullscreenWatcher();
    this.closeCdpConnection();

    try {
      const target = await this.getActivePageTarget();
      if (target && target.id) {
        await fetch(`http://127.0.0.1:${CDP_PORT}/json/close/${target.id}`, { signal: AbortSignal.timeout(1000) });
      }
    } catch { }

    if (this.currentVideoProcess) {
      try {
        const pid = this.currentVideoProcess.pid;
        if (pid) {
          if (process.platform === 'win32') {
            spawn('taskkill', ['/PID', String(pid), '/T', '/F']);
          } else {
            this.currentVideoProcess.kill('SIGTERM');
          }
        }
      } catch (e: any) {
        this.logger.warn(`Error al cerrar proceso: ${e.message}`);
      }
      this.currentVideoProcess = null;
    }

    this.currentVideoState.active = false;
    this.currentVideoState.url = '';
    this.currentVideoState.title = '';
    this.currentVideoState.pid = null;
    this.currentVideoState.playback = { found: false, paused: true, currentTime: 0, duration: 0, title: '', isFullscreen: false };
    this.stopStatusBroadcasting();
    this.broadcastStatus(this.currentVideoState);
    return true;
  }

  async getStatus(): Promise<CurrentVideoStatus> {
    const target = await this.getActivePageTarget();
    if (target) {
      this.currentVideoState.active = true;
      this.currentVideoState.url = target.url || this.currentVideoState.url;
      this.currentVideoState.title = target.title || '';

      const playback = await this.getVideoPlaybackStatus();
      this.currentVideoState.playback = playback;
      if (playback.title && !this.currentVideoState.title) {
        this.currentVideoState.title = playback.title;
      }
    } else {
      this.currentVideoState.active = false;
      this.currentVideoState.url = '';
      this.currentVideoState.title = '';
      this.currentVideoState.playback = { found: false, paused: true, currentTime: 0, duration: 0, title: '' };
    }

    return this.currentVideoState;
  }

  generateAdPlayerHtml(rawUrl: string, title?: string): string {
    const cleanUrl = (rawUrl || '').trim();
    const safeTitle = (title || 'Pausa comercial').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const ext = path.extname(cleanUrl.split('?')[0]).toLowerCase();
    const isAudio = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'].includes(ext);

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100vw;
      height: 100vh;
      background: #000;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      user-select: none;
    }
    video {
      width: 100vw;
      height: 100vh;
      object-fit: contain;
      background: #000;
    }
    .hud {
      position: absolute;
      bottom: 35px;
      left: 35px;
      display: flex;
      align-items: center;
      gap: 14px;
      background: rgba(11, 15, 25, 0.88);
      border: 1px solid rgba(245, 158, 11, 0.45);
      border-radius: 9999px;
      padding: 10px 22px;
      backdrop-filter: blur(12px);
      box-shadow: 0 10px 30px rgba(0,0,0,0.7);
      z-index: 100;
      pointer-events: none;
      animation: slideUp 0.4s ease-out;
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: #0b0f19;
      font-weight: 800;
      font-size: 11px;
      padding: 4px 10px;
      border-radius: 9999px;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }
    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #0b0f19;
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
    .title {
      font-weight: 700;
      font-size: 15px;
      color: #f8fafc;
      max-width: 450px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .audio-stage {
      display: ${isAudio ? 'flex' : 'none'};
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 24px;
      z-index: 10;
    }
    .audio-waves {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      height: 70px;
    }
    .bar {
      width: 10px;
      background: linear-gradient(180deg, #f59e0b, #ef4444);
      border-radius: 6px;
      animation: wave 1.2s ease-in-out infinite alternate;
    }
    .bar:nth-child(1) { height: 30px; animation-delay: 0.1s; }
    .bar:nth-child(2) { height: 60px; animation-delay: 0.3s; }
    .bar:nth-child(3) { height: 40px; animation-delay: 0.5s; }
    .bar:nth-child(4) { height: 70px; animation-delay: 0.2s; }
    .bar:nth-child(5) { height: 45px; animation-delay: 0.4s; }
    @keyframes wave {
      0% { height: 15px; opacity: 0.5; }
      100% { height: 70px; opacity: 1; }
    }
    .audio-title {
      color: #fff;
      font-size: 24px;
      font-weight: 700;
      text-shadow: 0 4px 12px rgba(0,0,0,0.8);
    }
  </style>
</head>
<body>
  <video id="ad-video" src="${cleanUrl}" autoplay playsinline ${isAudio ? 'style="display:none"' : ''}></video>
  ${isAudio ? `
  <div class="audio-stage">
    <div class="audio-waves">
      <div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div>
    </div>
    <div class="audio-title">${safeTitle}</div>
  </div>
  ` : ''}
  <div class="hud">
    <div class="badge"><span class="dot"></span> Publicidad</div>
    <div class="title">${safeTitle}</div>
  </div>
  <script>
    const v = document.getElementById('ad-video');
    window.__adEnded = false;

    function iniciar() {
      if (!v) return;
      v.play().catch(function() {
        v.muted = true;
        v.play().then(function() {
          setTimeout(function() { v.muted = false; }, 300);
        });
      });
    }

    iniciar();
    document.addEventListener('click', iniciar);

    v.addEventListener('ended', function() {
      window.__adEnded = true;
    });

    v.addEventListener('error', function(e) {
      console.warn('Error en video:', e);
      window.__adEnded = true;
    });

    v.addEventListener('timeupdate', function() {
      if (v.duration && v.duration > 0 && v.currentTime >= v.duration - 0.4) {
        window.__adEnded = true;
      }
    });
  </script>
</body>
</html>`;
  }

  getLogoHdPath(): string | null {
    const candidatePaths = [
      path.resolve(process.cwd(), 'uploads/logohd.png'),
      path.resolve(process.cwd(), '../frontend/public/logohd.png'),
      path.resolve(process.cwd(), 'frontend/public/logohd.png'),
      path.resolve(__dirname, '../../../../frontend/public/logohd.png')
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
    return null;
  }

  generateIdlePlayerHtml(): string {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Escenario 89 - TV</title>
  <link rel="icon" type="image/png" href="/player/logohd.png">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100vw;
      height: 100vh;
      background: radial-gradient(circle at center, #1e1b4b 0%, #09090b 100%);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #fff;
      user-select: none;
    }
    .logo-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      animation: pulseGlow 3s ease-in-out infinite alternate;
      text-align: center;
    }
    .logo {
      width: 220px;
      height: 220px;
      object-fit: contain;
      filter: drop-shadow(0 0 45px rgba(245, 158, 11, 0.45));
    }
    h1 {
      font-size: 46px;
      font-weight: 800;
      letter-spacing: 2px;
      background: linear-gradient(135deg, #fef08a, #f59e0b, #d97706);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      text-transform: uppercase;
    }
    p {
      font-size: 20px;
      color: #94a3b8;
      font-weight: 500;
      letter-spacing: 0.5px;
    }
    .badge {
      margin-top: 18px;
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.35);
      padding: 10px 28px;
      border-radius: 9999px;
      font-size: 15px;
      color: #fde68a;
      letter-spacing: 1px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    }
    @keyframes pulseGlow {
      0% { transform: scale(0.98); opacity: 0.92; }
      100% { transform: scale(1.02); opacity: 1; }
    }
  </style>
</head>
<body>
  <div class="logo-box">
    <img src="/player/logohd.png" class="logo" alt="Escenario 89" onerror="this.onerror=null; this.src='/uploads/logohd.png'">
    <h1>Escenario 89</h1>
    <p>Karaoke Bar & Lounge</p>
    <div class="badge">Pide tu canción escaneando el código QR de tu mesa</div>
  </div>
</body>
</html>`;
  }

  async checkEmbeddable(videoId: string): Promise<boolean> {
    if (!videoId) return false;
    try {
      const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, {
        signal: AbortSignal.timeout(3500)
      });
      return res.ok;
    } catch {
      return true;
    }
  }
}
