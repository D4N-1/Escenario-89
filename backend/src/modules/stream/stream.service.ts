import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { Readable } from 'node:stream';
import { promisify } from 'node:util';
import type { Request, Response } from 'express';

const execFileAsync = promisify(execFile);

interface CacheEntry {
  url: string;
  expiresAt: number;
}

@Injectable()
export class StreamService {
  private readonly logger = new Logger(StreamService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly pendingRequests = new Map<string, Promise<string>>();

  /**
   * Obtiene la URL directa de reproducción de Google Video usando yt-dlp.
   */
  async getDirectStreamUrl(videoId: string): Promise<string> {
    const cleanId = (videoId || '').trim();
    if (!cleanId || !/^[a-zA-Z0-9_-]{6,20}$/.test(cleanId)) {
      throw new BadRequestException('ID de video de YouTube inválido');
    }

    // Verificar caché en memoria (las URLs de GoogleVideo expiran en aprox. 6h; usamos 2h para seguridad)
    const cached = this.cache.get(cleanId);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.url;
    }

    // Si ya hay una extracción en curso para este videoId, reutilizamos la misma promesa
    if (this.pendingRequests.has(cleanId)) {
      return this.pendingRequests.get(cleanId)!;
    }

    const promise = this.extractStreamUrl(cleanId)
      .then((url) => {
        this.cache.set(cleanId, {
          url,
          expiresAt: Date.now() + 2 * 60 * 60 * 1000, // 2 horas
        });
        return url;
      })
      .finally(() => {
        this.pendingRequests.delete(cleanId);
      });

    this.pendingRequests.set(cleanId, promise);
    return promise;
  }

  private async extractStreamUrl(videoId: string): Promise<string> {
    this.logger.log(`Extrayendo stream directo para YouTube ID: ${videoId}...`);
    const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Argumentos optimizados para yt-dlp:
    // - Prioriza formatos MP4 con audio y video muxed (18 = 360p, 22 = 720p)
    // - Usa el runtime de node y ejs:github para resolver el n-challenge
    const args = [
      '-m',
      'yt_dlp',
      '--js-runtimes',
      'node',
      '--remote-components',
      'ejs:github',
      '-f',
      '18/22/best[ext=mp4]/best[vcodec!=none][acodec!=none]/best',
      '-g',
      ytUrl,
    ];

    const pythonBin = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');

    try {
      const { stdout, stderr } = await execFileAsync(pythonBin, args, {
        timeout: 30000,
        windowsHide: true,
      });

      if (stderr && stderr.includes('ERROR')) {
        this.logger.warn(`yt-dlp stderr: ${stderr}`);
      }

      const lines = stdout.trim().split(/\r?\n/).filter((l) => l.startsWith('http'));
      if (lines.length === 0) {
        throw new Error('No se obtuvo URL de streaming de yt-dlp');
      }

      const directUrl = lines[0].trim();
      this.logger.log(`Stream extraído con éxito para ${videoId}`);
      return directUrl;
    } catch (err: any) {
      this.logger.error(`Error al extraer stream con yt-dlp para ${videoId}:`, err?.message || err);
      throw new InternalServerErrorException(
        `No se pudo obtener el flujo de video para este contenido: ${err?.message || 'Error desconocido'}`
      );
    }
  }

  /**
   * Transmite el flujo de video al cliente soportando peticiones de rango (HTTP 206 Partial Content).
   */
  async proxyStream(videoId: string, req: Request, res: Response): Promise<void> {
    let directUrl: string;
    try {
      directUrl = await this.getDirectStreamUrl(videoId);
    } catch (e: any) {
      res.status(e?.status || 500).json({
        statusCode: e?.status || 500,
        message: e?.message || 'Error al obtener el stream del video',
      });
      return;
    }

    const abortController = new AbortController();
    res.on('close', () => {
      abortController.abort();
    });

    const headers: Record<string, string> = {
      'User-Agent': (req.headers['user-agent'] as string) || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      Accept: '*/*',
    };

    if (req.headers.range) {
      headers['Range'] = req.headers.range as string;
    }

    let upstreamRes: globalThis.Response;
    try {
      upstreamRes = await fetch(directUrl, {
        headers,
        signal: abortController.signal,
      });

      // Si la URL expiró o fue rechazada (ej. 403), reintentar una vez invalidando caché
      if (upstreamRes.status === 403) {
        this.cache.delete(videoId);
        directUrl = await this.extractStreamUrl(videoId);
        this.cache.set(videoId, {
          url: directUrl,
          expiresAt: Date.now() + 2 * 60 * 60 * 1000,
        });

        upstreamRes = await fetch(directUrl, {
          headers,
          signal: abortController.signal,
        });
      }
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(502).json({
          statusCode: 502,
          message: 'Error al conectar con el servidor de streaming',
        });
      }
      return;
    }

    res.status(upstreamRes.status);

    const headersToForward = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'last-modified',
      'etag',
    ];

    for (const h of headersToForward) {
      const val = upstreamRes.headers.get(h);
      if (val) {
        res.setHeader(h, val);
      }
    }

    if (!res.getHeader('accept-ranges')) {
      res.setHeader('accept-ranges', 'bytes');
    }
    res.setHeader('Cache-Control', 'public, max-age=3600');

    if (upstreamRes.body) {
      try {
        const stream = Readable.fromWeb(upstreamRes.body as any);
        stream.on('error', (streamErr) => {
          this.logger.debug(`Stream finalizado o cancelado por cliente: ${streamErr.message}`);
        });
        stream.pipe(res);
      } catch (pipeErr) {
        this.logger.debug(`Error al entubar stream: ${pipeErr}`);
      }
    } else {
      res.end();
    }
  }

  /**
   * Comprueba de forma rápida si un video de YouTube permite reproducción embebida (Iframe).
   */
  async checkEmbeddable(videoId: string): Promise<boolean> {
    const cleanId = (videoId || '').trim();
    if (!cleanId || !/^[a-zA-Z0-9_-]{6,20}$/.test(cleanId)) {
      return false;
    }

    try {
      const res = await fetch(`https://www.youtube.com/embed/${cleanId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: 'http://localhost:3000',
        },
        signal: AbortSignal.timeout(3500),
      });

      if (!res.ok) return false;
      const html = await res.text();
      if (
        html.includes('"playableInEmbed":false') ||
        html.includes('"status":"UNPLAYABLE"') ||
        html.includes('"status":"ERROR"')
      ) {
        return false;
      }
      return true;
    } catch {
      return true;
    }
  }
}

