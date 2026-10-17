import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueueEntity, SongStatus } from './entities/queue.entity.js';
import { Repository } from 'typeorm';
import { GetAllQueryDto } from '../../common/dto/getAllQuery.dto.js';
import { ResAllInterface } from '../../common/interfaces/resAll.interface.js';
import { CreateQueueDto } from './dto/create-queue.dto.js';
import { ResCreateInterface } from '../../common/interfaces/resCreate.interface.js';
import { SongService } from '../song/song.service.js';
import { TableService } from '../table/table.service.js';

@Injectable()
export class QueueService {

    constructor(

        @InjectRepository(QueueEntity)
        private readonly queueRepository: Repository<QueueEntity>,

        private readonly songService: SongService,
        private readonly tableService: TableService

    ) { }


    findOne = {
    
        position: async( position: number ): Promise<QueueEntity> => {
    
            const table = await this.queueRepository.findOne({
                where: { position }
            })
    
            if (!table) throw new NotFoundException('No existe ese codigo de mesa')
                return table
        }

    }
    
    
    findOrNull = {

        position: async( position: number ): Promise<QueueEntity|null> => {
    
            return this.queueRepository.findOne({
                where: { position }
            })
    
        }

    }

    async findAll(query?:GetAllQueryDto): Promise<ResAllInterface> {

        const page = Math.max(1, Number(query?.page) );
        const limit = Math.max(1, Number(query?.limit) );
        const skip = (page - 1) * limit;

        const [ data, total ] = await this.queueRepository.findAndCount({
            skip,
            take: limit,
            order: { position: 'ASC' },
            where: [
                { status: SongStatus.PLAYING },
                { status: SongStatus.WAITING }
            ]
        })

        return {
            data,
            meta: {
                total,
                count: data.length,
                perPage: limit,
                totalPages: Math.ceil(total / limit),
                currentPage: page
            }
        }
        
    }

    async create(createQueueDto: CreateQueueDto): Promise<ResCreateInterface> {

        const { songId, tableCode } = createQueueDto;

        const newData: Partial<QueueEntity> = { }

        const song = await this.songService.findOne.id(songId)
        const table = await this.tableService.findOne.code(tableCode)

        newData.song = song;
        newData.table = table;

        const queue: QueueEntity[] = (await this.findAll()).data

        const waitingSongs = queue.filter( (p) => p.table.code === tableCode )

        console.log(waitingSongs)

        newData.value = 1;
        newData.position = 1;

        const newQueue = await this.queueRepository.create(newData)

        return {
            message: '',
            data: await this.queueRepository.save(newQueue)
        }


    }
}

