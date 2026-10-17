import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueueEntity, QueueRelations, SongStatus } from './entities/queue.entity.js';
import { Repository } from 'typeorm';
import type { FindOptionsRelations } from 'typeorm';
import { ResAllInterface } from '../../common/interfaces/resAll.interface.js';
import { CreateQueueDto } from './dto/create-queue.dto.js';
import { QueueResCreateInterface } from './interface/queue-resCreate.interface.js';
import { SongService } from '../song/song.service.js';
import { TableService } from '../table/table.service.js';
import { GetAllQueueDto } from './dto/get-queue.dto.js';

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

    async findAll(query:GetAllQueueDto): Promise<ResAllInterface> {

        const { all, include, limit = 10, page = 1 } = query;

        const skip = (page - 1) * limit;

        const rawRelations = all ? QueueRelations :
            include ? include.split(',')
            : [];
        const relations: Record<string, boolean> = {};
        rawRelations.forEach(rel => {
            if (QueueRelations.includes(rel)) {
                relations[rel as keyof FindOptionsRelations<QueueEntity>] = true;
            }
        });

        const [ data, total ] = await this.queueRepository.findAndCount({
            relations,
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

    async create(createQueueDto: CreateQueueDto): Promise<QueueResCreateInterface> {

        const { songId, tableCode } = createQueueDto;

        const newData: Partial<QueueEntity> = { }

        const song = await this.songService.findOne.id(songId)
        const table = await this.tableService.findOne.code(tableCode)

        newData.song = song;
        newData.table = table;

        const queueResult = await this.findAll({ all: true })
        const queue: QueueEntity[] = queueResult.data

        const waitingSongs = queue.filter( (q) => q.table?.code === table.code )

        const value = waitingSongs.length
        newData.value = value

        const prev = queue.findLastIndex( (q) => q.value === value)
        const position = prev === -1 ? queue.length
            : prev + 1

        newData.position = position
        newData.status = newData.position == 0 ? SongStatus.PLAYING : SongStatus.WAITING

        queue.forEach( (q) => q.position >= position ? q.position++ : null )

        const newQueue = this.queueRepository.create(newData)

        await this.queueRepository.save(queue)

        return {
            message: `Cancion añadida a la lista`,
            position,
            status: newData.status,
            data: await this.queueRepository.save(newQueue)
        }


    }
}

