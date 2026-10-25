import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { GetAllQueryDto } from '../../common/dto/getAllQuery.dto';
import { Admin } from '../../decorators/admin.decorator';
import { Private } from '../../decorators/private.decorator';
import { AllQueryPipe } from '../../pipes/allQuery.pipe';
import { AudioErrorCode, AudioOk, AudioSummary } from './audio.constants';
import { AudioService } from './audio.service';
import { CreateAudioDto } from './dto/create-song.dto';
import { UpdateAudioDto } from './dto/update-audio.dto';
import { AudioEntity } from './entities/audio.entity';

@Private() @Admin() @ApiBearerAuth()
@Controller('audio')
export class AudioController {
  constructor(private readonly audioService: AudioService) {}

  @ApiOperation({ summary: AudioSummary.ALL() })
  @ApiOkResponse({ description: AudioOk.ALL(), type: [AudioEntity] })
  @Get()
  async getAll(@Query(AllQueryPipe) query: GetAllQueryDto) {
    return this.audioService.findAll(query);
  }
    
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, callback) => {
          const uploadPath = './uploads/audios';
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          callback(null, uploadPath);
        },
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          callback(null, `audio-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        const allowedExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];
        const ext = extname(file.originalname).toLowerCase();

        if (!file.mimetype.startsWith('audio/') && !allowedExtensions.includes(ext)) {
          return callback(
            new BadRequestException(AudioErrorCode.BAD_REQUEST('BODY', '¡Solo se permiten archivos de audio (MP3, WAV, OGG, FLAC, etc.)!')),
            false,
          );
        }

        callback(null, true);
      },
      limits: {
        fileSize: 1024 * 1024 * 50, // Límite de 50MB para audios (puedes ajustarlo)
      },
    }),
  )
  @ApiOperation({ summary: AudioSummary.CREATE() })
  @ApiCreatedResponse({ description: AudioOk.CREATE() })
  @ApiConsumes('multipart/form-data')
  @Post()
  async create(
    @UploadedFile() file: any,
    @Body() createAudioDto: CreateAudioDto,
  ) {
    return this.audioService.create(createAudioDto, file);
  }

  @ApiOperation({ summary: AudioSummary.EDIT() })
  @ApiOkResponse({ description: AudioOk.EDIT() })
  @ApiNotFoundResponse({ description: 'No existe ese audio' })
  @Patch()
  async patchOne(@Body() updateAudioDto: UpdateAudioDto) {
    return this.audioService.update(updateAudioDto);
  }

  @ApiOperation({ summary: 'Elimina un audio' })
  @ApiOkResponse({ description: 'Audio eliminado con éxito' })
  @ApiNotFoundResponse({ description: 'No existe ese audio' })
  @Delete(':uuid')
  async deleteOne(@Param('uuid') uuid: string) {
    return this.audioService.remove(uuid);
  }
}