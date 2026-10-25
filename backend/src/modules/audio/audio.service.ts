import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import path from 'path';
import { Repository } from 'typeorm';
import { AudioEntity } from './entities/audio.entity';

import { randomUUID } from 'crypto';
import * as fs from 'node:fs/promises';
import { EXAMPLE } from '../../common/constants/dto.constants';
import { GetAllQueryDto } from '../../common/dto/getAllQuery.dto';
import { ResAllInterface } from '../../common/interfaces/resAll.interface';
import { ResCreateInterface } from '../../common/interfaces/resCreate.interface';
import { ResUpdateInterface } from '../../common/interfaces/resUpdate.interface';

import { AudioErrorCode } from './audio.constants';
import { CreateAudioDto } from './dto/create-song.dto';
import { UpdateAudioDto } from './dto/update-audio.dto';




export type AudioInMemory = AudioEntity & { current: number }


@Injectable()
export class AudioService {

  constructor(

    @InjectRepository(AudioEntity)
    private readonly audioRepository: Repository<AudioEntity>

  ) { }



  async findAll(query?:GetAllQueryDto): Promise<ResAllInterface> {

    const { limit = 10, page = 1 } = query || {};

    const skip = (page - 1) * limit;

    const [ data, total ] = await this.audioRepository.findAndCount({
        skip,
        take: limit,
        order: { index: 'ASC' }
    })


    return {
      data: data,
      meta: {
        total,
        count: data.length,
        perPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
    };
        
  }
  

  async create(createDto: CreateAudioDto, file: any): Promise<ResCreateInterface> {
    const { uuid=null } = createDto;

    if (!file) throw new BadRequestException( AudioErrorCode.BAD_REQUEST('BODY', 'No se proporcionó el archivo de audio', { required: { file: 'Binary' } }) )

    const audio = uuid ? await this.findOrNull.uuid(uuid) : null;
    if (audio) {
      await fs.unlink(file.path).catch(() => {});
      return {
        message: 'Audio ya está registrado',
        data: audio,
      };
    }

    const finalUuid = uuid || randomUUID();

    const targetDir = path.join('./uploads/audios', finalUuid);
    await fs.mkdir(targetDir, { recursive: true });

    const newAudioPath = path.join(targetDir, file.filename);
    await fs.rename(file.path, newAudioPath);

    const audioUrl = `/uploads/audios/${finalUuid}/${file.filename}`;

    const newAudio = this.audioRepository.create({
      ...createDto,
      uuid: finalUuid,
      url: audioUrl
    });

    await this.audioRepository.save(newAudio);

    return {
      message: 'Audio creado con exito',
      data: newAudio,
    };
  }

  async remove(uuid: string): Promise<{ message: string }> {
    const audio = await this.findOne.uuid(uuid);

    const targetDir = path.join('./uploads/audios', uuid);
    await fs.rm(targetDir, { recursive: true, force: true }).catch(() => {});

    await this.audioRepository.remove(audio);
    return {
      message: 'Audio eliminada con éxito'
    };
  }


  async update(updateAudioDto: UpdateAudioDto): Promise<ResUpdateInterface> {
          
    const { uuid } = updateAudioDto;
  
    if (!uuid) throw new BadRequestException({
        message: 'Se debe especificar el uuid del audio a editar junto a los cambios',
        example: { uuid: EXAMPLE.UUID, title: 'Hora del brindis!!!' }
    })
  
    const audio = await this.findOne.uuid(uuid)
  
    const newData: Partial<AudioEntity> = { ...updateAudioDto }
  
    const editAudio = this.audioRepository.merge(audio, newData)


    return {
        message: "El audio ha sido modificado con exito",
        change: updateAudioDto,
        data: await this.audioRepository.save(editAudio)
    }
  
  }


  findOne = {
      
  
    uuid: async( uuid: string ): Promise<AudioEntity> => {
  
      const audio = await this.audioRepository.findOne({
        where: { uuid }
      })

      if (!audio) throw new NotFoundException( 'No existe ese audio' )
        return audio
    }
  
  }
      
  findOrNull = {

    uuid: async( uuid: string ): Promise<AudioEntity|null> => {
  
      return this.audioRepository.findOne({
          where: { uuid }
      })
    }
  
  }
}