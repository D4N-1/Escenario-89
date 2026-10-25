import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import path from 'path';
import { Repository } from 'typeorm';
import { CreateIntermissionDto } from './dto/create-intermission.dto';
import { IntermissionEntity } from './entities/intermission.entity';

import { randomUUID } from 'crypto';
import ffmpegInstaller from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'node:fs/promises';
import { EXAMPLE } from '../../common/constants/dto.constants';
import { GetAllQueryDto } from '../../common/dto/getAllQuery.dto';
import { ResAllInterface } from '../../common/interfaces/resAll.interface';
import { ResCreateInterface } from '../../common/interfaces/resCreate.interface';
import { ResUpdateInterface } from '../../common/interfaces/resUpdate.interface';
import { PlayIntermissionDto } from './dto/play-intermission.dto';
import { UpdateIntermissionDto } from './dto/update-intermission.dto';
import { IntermissionErrorCode } from './intermission.constant';

const ffmpegPath =
  (typeof ffmpegInstaller === 'string' ? ffmpegInstaller : null) ||
  (ffmpegInstaller as any)?.default ||
  (ffmpegInstaller as any)?.path ||
  '';

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}



export type IntermissionInMemory = IntermissionEntity & { current: number }


@Injectable()
export class IntermissionService {

  private counters: Map<string, IntermissionInMemory> = new Map();
  private next: Map<string, IntermissionEntity> = new Map();

  constructor(

    @InjectRepository(IntermissionEntity)
    private readonly intermissionRepository: Repository<IntermissionEntity>

  ) { }

  async onModuleInit() {
    await this.syncCounters();
  }

  async syncCounters(uuid?: string) {

    if (uuid) {
      const intermission = await this.findOrNull.uuid(uuid)

      if (intermission?.everySongs) this.counters.set(intermission.uuid, {
        ...intermission,
        current: 0
      })

      return
    }

    const intermissions = await this.intermissionRepository.find({ where: { active: true } });

    this.counters.clear()

    for (const item of intermissions) {

      if (!item.everySongs) continue;

      this.counters.set(item.uuid, {
        ...item,
        current: 0
      });

    }
  }

  async findAll(query?:GetAllQueryDto): Promise<ResAllInterface> {

    const { limit = 10, page = 1 } = query || {};

    const skip = (page - 1) * limit;

    const [ data, total ] = await this.intermissionRepository.findAndCount({
        skip,
        take: limit,
        order: { index: 'ASC' }
    })

    const sanitizedData = await Promise.all(
      data.map(async (item) => {
        if (item.image) {
          const localFilePath = path.join(process.cwd(), item.image.replace(/^\//, ''));
          try {
            await fs.access(localFilePath);
          } catch {
            item.image = '';
          }
        }
        return item;
      })
    );

    return {
      data: sanitizedData,
      meta: {
        total,
        count: sanitizedData.length,
        perPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
    };
        
  }
  
  /**
   * Se ejecuta cada vez que una canción finaliza.
   * Aumenta el contador interno para salir una pausa publicitaria
   */
  processSongFinished(): IntermissionEntity[] {
    const ahora = new Date();
    const triggeredIntermission: IntermissionEntity[] = [];

    for (const [uuid, intermission] of this.counters.entries()) {
      intermission.current++;

      const inTimeRange = this.isCurrentTimeInRange(ahora, intermission.startTime, intermission.endTime);

      if (inTimeRange && intermission.everySongs && intermission.current >= intermission.everySongs) {
        triggeredIntermission.push(intermission);
        
        intermission.current = 0;
      }

    }

    for (const [uuid, intermission] of this.next.entries() ) {
      triggeredIntermission.push(intermission)
    }

    this.next.clear();


    return triggeredIntermission;
  }

  private isCurrentTimeInRange(now: Date, startTimeStr: string, endTimeStr: string): boolean {
    const startClean = startTimeStr.substring(0, 5);
    const endClean = endTimeStr.substring(0, 5);

    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = startClean.split(':').map(Number);
    const [endHour, endMin] = endClean.split(':').map(Number);

    const startTotalMinutes = startHour * 60 + startMin;
    const endTotalMinutes = endHour * 60 + endMin;

    if (endTotalMinutes <= startTotalMinutes) {

      return currentMinutes >= startTotalMinutes || currentMinutes <= endTotalMinutes;
    } else {
      return currentMinutes >= startTotalMinutes && currentMinutes <= endTotalMinutes;
    }
  }

  async create(createDto: CreateIntermissionDto, file: any): Promise<ResCreateInterface> {
    const { uuid=null } = createDto;

    if (!file) throw new BadRequestException( IntermissionErrorCode.BAD_REQUEST('BODY', 'No se proporcionó el archivo de video', { required: { file: 'Binary' } }) )

    const intermission = uuid ? await this.findOrNull.uuid(uuid) : null;
    if (intermission) {
      await fs.unlink(file.path).catch(() => {});
      return {
        message: 'Video ya está registrado',
        data: intermission,
      };
    }

    const finalUuid = uuid || randomUUID();

    const targetDir = path.join('./uploads/intermissions', finalUuid);
    await fs.mkdir(targetDir, { recursive: true });

    const newVideoPath = path.join(targetDir, file.filename);
    await fs.rename(file.path, newVideoPath);

    const fileNameWithoutExt = path.parse(file.filename).name;
    const thumbnailFilename = `thumb-${fileNameWithoutExt}.jpg`;

    const ext = path.extname(file.filename).toLowerCase();
    const isVideo = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v'].includes(ext);

    let imageUrl = '';
    if (isVideo) {
      try {
        await this.generateThumbnail(newVideoPath, targetDir, thumbnailFilename);
        imageUrl = `/uploads/intermissions/${finalUuid}/${thumbnailFilename}`;
      } catch (err) {
        console.warn('No se pudo generar miniatura para el video:', err);
        imageUrl = '';
      }
    }

    const videoUrl = `/uploads/intermissions/${finalUuid}/${file.filename}`;

    const newIntermission = this.intermissionRepository.create({
      ...createDto,
      uuid: finalUuid,
      url: videoUrl,
      image: imageUrl,
    });

    await this.intermissionRepository.save(newIntermission);
    await this.syncCounters();

    return {
      message: 'Pausa publicitaria creada con exito',
      data: newIntermission,
    };
  }

  async remove(uuid: string): Promise<{ message: string }> {
    const intermission = await this.findOne.uuid(uuid);
    this.counters.delete(uuid);
    this.next.delete(uuid);

    const targetDir = path.join('./uploads/intermissions', uuid);
    await fs.rm(targetDir, { recursive: true, force: true }).catch(() => {});

    await this.intermissionRepository.remove(intermission);
    return {
      message: 'Pausa publicitaria eliminada con éxito'
    };
  }

  private generateThumbnail(videoPath: string, outputDir: string, filename: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: ['00:00:00.1'],
          filename: filename,
          folder: outputDir,
          size: '320x?',
        })
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err));
    });
  }

  async update(updateIntermissionDto: UpdateIntermissionDto): Promise<ResUpdateInterface> {
          
    const { uuid } = updateIntermissionDto;
  
    if (!uuid) throw new BadRequestException({
        message: 'Se debe especificar el uuid del video a editar junto a los cambios',
        example: { uuid: EXAMPLE.UUID, title: 'Hora del brindis!!!' }
    })
  
    const intermission = await this.findOne.uuid(uuid)
  
    const newData: Partial<IntermissionEntity> = { ...updateIntermissionDto }
  
    const editIntermission = this.intermissionRepository.merge(intermission, newData)

    this.syncCounters(uuid)

    return {
        message: "El video ha sido modificado con exito",
        change: updateIntermissionDto,
        data: await this.intermissionRepository.save(editIntermission)
    }
  
  }

  async playOne(playIntermission: PlayIntermissionDto) {

    const { uuid } = playIntermission;
    const intermission = await this.findOne.uuid(uuid)

    this.next.set(uuid, intermission)

    return {
      message: 'Anuncio listado para la siguiente pausa'
    }
  }

  findOne = {
      
  
    uuid: async( uuid: string ): Promise<IntermissionEntity> => {
  
      const intermission = await this.intermissionRepository.findOne({
        where: { uuid }
      })

      if (!intermission) throw new NotFoundException( 'No existe esa publicidad' )
        return intermission
    }
  
  }
      
  findOrNull = {

    uuid: async( uuid: string ): Promise<IntermissionEntity|null> => {
  
      return this.intermissionRepository.findOne({
          where: { uuid }
      })
    }
  
  }
}