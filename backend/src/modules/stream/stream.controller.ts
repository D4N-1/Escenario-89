import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../../decorators/public.decorator.js';
import { StreamService } from './stream.service.js';

@ApiTags('Stream')
@Controller(['stream', 'api/stream'])
export class StreamController {
  constructor(private readonly streamService: StreamService) {}

  @Public()
  @Get('video')
  @ApiOperation({
    summary: 'Transmite el video y audio de una canción de YouTube sin restricciones de iframe',
    description: 'Soporta streaming HTTP 206 (Range requests) para reproducción fluida en elementos HTML5 <video>',
  })
  @ApiQuery({ name: 'id', description: 'ID del video de YouTube', required: true, example: 'kJQP7kiw5Fk' })
  @ApiResponse({ status: 200, description: 'Stream de video MP4 completo' })
  @ApiResponse({ status: 206, description: 'Fragmento parcial de video MP4 (streaming continuo)' })
  async streamVideo(
    @Query('id') videoId: string,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    await this.streamService.proxyStream(videoId, req, res);
  }

  @Public()
  @Get('url')
  @ApiOperation({ summary: 'Obtiene la URL directa de streaming del video' })
  @ApiQuery({ name: 'id', description: 'ID del video de YouTube', required: true })
  async getStreamUrl(@Query('id') videoId: string): Promise<{ id: string; url: string }> {
    const url = await this.streamService.getDirectStreamUrl(videoId);
    return { id: videoId, url };
  }

  @Public()
  @Get('check')
  @ApiOperation({ summary: 'Comprueba si un video de YouTube permite reproducción embebida' })
  @ApiQuery({ name: 'id', description: 'ID del video de YouTube', required: true })
  async checkEmbed(@Query('id') videoId: string): Promise<{ id: string; embeddable: boolean }> {
    const embeddable = await this.streamService.checkEmbeddable(videoId);
    return { id: videoId, embeddable };
  }
}
