import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'node:fs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../decorators/public.decorator.js';
import { PlayVideoDto } from './dto/play-video.dto.js';
import { PlaybackControlDto } from './dto/playback-control.dto.js';
import { PlayerService } from './player.service.js';

@ApiTags('Player')
@Public()
@Controller('player')
export class PlayerController {
  constructor(private readonly playerService: PlayerService) { }

  @ApiOperation({ summary: 'Obtener estado del reproductor y reproducción' })
  @Get('status')
  async getStatus() {
    return this.playerService.getStatus();
  }

  @ApiOperation({ summary: 'Cargar o cambiar video en Chromium' })
  @Post('play')
  async playVideo(@Body() body: PlayVideoDto) {
    const success = await this.playerService.playOrChangeVideo(
      body.url || '',
      body.startSeconds || 0,
      body.forceLaunch ?? false,
      body.startPaused ?? false
    );
    return { success, url: body.url };
  }

  @ApiOperation({ summary: 'Lanzar navegador Chromium en la TV al pulsar Duplicar TV' })
  @Post('launch')
  async launchBrowser(@Body() body: PlayVideoDto) {
    const success = await this.playerService.launchTvBrowser(
      body.url,
      body.startSeconds || 0,
      body.startPaused ?? false
    );
    const status = await this.playerService.getStatus();
    return { success, status };
  }

  @ApiOperation({ summary: 'Vista de espera cuando no hay canciones sonando' })
  @Get('idle-view')
  getIdleView(@Res() res: Response) {
    const html = this.playerService.generateIdlePlayerHtml();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @ApiOperation({ summary: 'Obtener logo en alta definición' })
  @Get('logohd.png')
  getLogoHd(@Res() res: Response) {
    const filePath = this.playerService.getLogoHdPath();
    if (filePath && fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.sendFile(filePath);
    }
    return res.status(404).send('Logo no encontrado');
  }

  @ApiOperation({ summary: 'Obtener logo (alias para compatibilidad)' })
  @Get('logo.png')
  getLogo(@Res() res: Response) {
    return this.getLogoHd(res);
  }

  @ApiOperation({ summary: 'Verificar si un video de YouTube permite reproducción embebida' })
  @Get('check-embed')
  async checkEmbed(@Query('videoId') videoId: string) {
    const embeddable = await this.playerService.checkEmbeddable(videoId || '');
    return { videoId: videoId || '', embeddable };
  }

  @ApiOperation({ summary: 'Controlar reproducción (play, pause, toggle, seek, restart, skip)' })
  @Post('playback')
  async controlPlayback(@Body() body: PlaybackControlDto) {
    const result = await this.playerService.controlVideoPlayback(body.action, body.value);
    return result;
  }

  @ApiOperation({ summary: 'Alternar o forzar pantalla completa' })
  @Post('fullscreen')
  async fullscreen() {
    const ok = await this.playerService.triggerFullscreenOnActiveTab();
    return { success: ok };
  }

  @ApiOperation({ summary: 'Vista HTML a pantalla completa para reproducir anuncios en Chromium' })
  @Get('ad-view')
  getAdView(
    @Query('url') rawUrl: string,
    @Query('title') title: string,
    @Res() res: Response
  ) {
    const html = this.playerService.generateAdPlayerHtml(rawUrl, title);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @ApiOperation({ summary: 'Cerrar ventana de video' })
  @Post('close')
  async close() {
    const ok = await this.playerService.closeCurrentVideo();
    return { success: ok };
  }
}
