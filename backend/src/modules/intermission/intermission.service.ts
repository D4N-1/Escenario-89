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
import { ResCreateInterface } from '../../common/interfaces/resCreate.interface';
import { ResUpdateInterface } from '../../common/interfaces/resUpdate.interface';
import { UpdateIntermissionDto } from './dto/update-intermission.dto';

if (ffmpegInstaller) ffmpeg.setFfmpegPath(ffmpegInstaller);



export type IntermissionInMemory = IntermissionEntity & { current: number }


@Injectable()
export class IntermissionService {

  private counters: Map<string, IntermissionInMemory> = new Map();

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
    const { uuid } = createDto;

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

    await this.generateThumbnail(newVideoPath, targetDir, thumbnailFilename);

    const videoUrl = `/uploads/intermissions/${finalUuid}/${file.filename}`;
    const imageUrl = `/uploads/intermissions/${finalUuid}/${thumbnailFilename}`;

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

  private generateThumbnail(videoPath: string, outputDir: string, filename: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: ['00:00:01'],
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
        message: 'Se debe especificar el uuid de la canción a editar junto a los cambios',
        example: { uuid: EXAMPLE.UUID, title: 'Hora del brindis!!!' }
    })
  
    const intermission = await this.findOne.uuid(uuid)
  
    const newData: Partial<IntermissionEntity> = { ...updateIntermissionDto }
  
    const editIntermission = this.intermissionRepository.merge(intermission, newData)

    this.syncCounters(uuid)

    return {
        message: "La cancion ha sido modificada con exito",
        change: updateIntermissionDto,
        data: await this.intermissionRepository.save(editIntermission)
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