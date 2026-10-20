import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { QueueEntity, QueueRelations, SongStatus, UpdateSongStatus } from './entities/queue.entity.js';
import { Repository } from 'typeorm';
import type { DataSource, FindOptionsRelations } from 'typeorm';
import { ResAllInterface } from '../../common/interfaces/resAll.interface.js';
import { CreateQueueDto } from './dto/create-queue.dto.js';
import { QueueResCreateInterface } from './interface/queue-resCreate.interface.js';
import { SongService } from '../song/song.service.js';
import { TableService } from '../table/table.service.js';
import { GetAllQueueDto } from './dto/get-queue.dto.js';
import { randomUUID } from 'node:crypto';
import { UpdateQueueDto } from './dto/update-queue.dto.js';
import { QueueErrorCode } from './queue.constants.js';
import { AnyRequest } from '../../common/types/payload.type.js';
import { TypeRequest } from '../../common/enums/typeRequest.enum.js';

@Injectable()
export class QueueService {

    constructor(

        @InjectRepository(QueueEntity)
        private readonly queueRepository: Repository<QueueEntity>,

        @InjectDataSource()
        private readonly dataSource: DataSource,

        private readonly songService: SongService,
        private readonly tableService: TableService,

    ) { }


    findOne = {
    
        position: async( position: number ): Promise<QueueEntity> => {
    
            const queue = await this.queueRepository.findOne({
                where: { position }
            })
    
            if (!queue) throw new NotFoundException( QueueErrorCode.NOT_FOUND('No existe esa canción en cola') )
                return queue
        },

        uuid: async( uuid: string ): Promise<QueueEntity> => {

            const queue = await this.queueRepository.findOne({
                where: { uuid }
            })

            if (!queue) throw new NotFoundException( QueueErrorCode.NOT_FOUND('No existe esa cancion en cola') )
                return queue
        }

    }
    
    findOrNull = {

        position: async( position: number ): Promise<QueueEntity|null> => {
    
            return this.queueRepository.findOne({
                where: { position }
            })
    
        },

        uuid: async( uuid: string ): Promise<QueueEntity|null> => {

            return this.queueRepository.findOne({
                where: { uuid }
            })
        }

    }

    async findAll(query:GetAllQueueDto): Promise<ResAllInterface> {

        const { all = false, include, limit = 10, page = 1 } = query;

        const skip = (page - 1) * limit;

        const rawRelations = include ? include.split(',')
            : [];
        const relations: Record<string, boolean> = {};
        rawRelations.forEach(rel => {
            if (QueueRelations.includes(rel)) {
                relations[rel as keyof FindOptionsRelations<QueueEntity>] = true;
            }
        });

        const DbQuery: Record<string, any> = {
            relations,
            order: { position: 'ASC' }
        }

        if (!all) {
            DbQuery.where = [
                { status: SongStatus.PLAYING },
                { status: SongStatus.WAITING }
            ]
        }

        if (limit !== 0) {
            DbQuery.skip = skip;
            DbQuery.take = limit;
        }

        const [ data, total ] = await this.queueRepository.findAndCount(DbQuery)

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

    async create(createQueueDto: CreateQueueDto, user: AnyRequest): Promise<QueueResCreateInterface> {

        const { songId, tableCode, uuid } = createQueueDto;

        const newData: Partial<QueueEntity> = { }

        const exist = uuid ? await this.findOrNull.uuid(uuid) : null;
        if (exist) return {
            message: 'La cancion ya ha sido añadida a la lista previamente',
            position: exist.position,
            status: exist.status,
            fixed: exist.fixed,
            data: exist
        }

        const song = await this.songService.findOne.id(songId)

        let table;

        if (user.type === TypeRequest.TABLE) table = await this.tableService.findOne.number(user.number)
        else table = await this.tableService.findOne.code(tableCode)

        return await this.dataSource.transaction( async(manager) => {

            const Queue: QueueEntity[] = await manager.find(QueueEntity, {
                where: [
                    { status: SongStatus.PLAYING },
                    { status: SongStatus.WAITING }
                ],
                order: { position: 'ASC' },
                relations: { table: true }
            })

            newData.song = song;
            newData.table = table;
            newData.uuid = uuid || randomUUID();


            const waitingSongs = Queue.filter( (q) => q.table?.code === table.code )

            const value = waitingSongs.length
            newData.value = value

            const prev = Queue.findLastIndex( (q) => q.value === value)
            const position = prev === -1 ? Queue.length
                : prev + 1

            newData.position = position
            newData.status = newData.position == 0 ? SongStatus.PLAYING : SongStatus.WAITING

            Queue.forEach( (q) => q.position! >= position ? q.position!++ : null )

            const newQueue = this.queueRepository.create(newData)

            Queue.splice(position, 0, newQueue)

            return {
                message: `Cancion añadida a la lista`,
                position,
                status: newQueue.status,
                fixed: newQueue.fixed,
                data: await manager.save(QueueEntity, Queue)
            }

        })

    }

    async update(updateQueueDto: UpdateQueueDto): Promise<QueueResCreateInterface> {
        const { uuid, fixed, position, status } = updateQueueDto;

        const newQueue = await this.findOne.uuid(uuid);
        const oldPosition = newQueue.position;

        return this.dataSource.transaction(async (manager) => {

            const queueList: QueueEntity[] = await manager.find(QueueEntity, {
                where: [
                    { status: SongStatus.PLAYING },
                    { status: SongStatus.WAITING }
                ],
                order: { position: 'ASC' }
            });

            const isCancelledOrFinished = status === SongStatus.CANCELLED || status === SongStatus.FINISHED;

            const updatedQueueList = this.modifyQueue(
                queueList,
                oldPosition,
                position,
                status,
                newQueue
            );

            if (fixed !== undefined) newQueue.fixed = fixed;

            if (status !== undefined) {
                newQueue.status = status;

                if (isCancelledOrFinished) {

                    newQueue.position = null;
                    newQueue.value = null;

                } else if (position !== undefined) newQueue.position = position;
                
            } else if (position !== undefined) newQueue.position = position;
            

            const editQueue = manager.create(QueueEntity, newQueue);
            await manager.save(QueueEntity, editQueue);

            const savedQueue = await manager.save(QueueEntity, updatedQueueList);

            return {
                message: 'Canción editada de la lista',
                position: editQueue.position,
                status: editQueue.status,
                fixed: editQueue.fixed,
                data: savedQueue
            };
        });
    }

    modifyQueue(
        queue: QueueEntity[],
        oldPosition: number | null,
        newPosition?: number | undefined,
        status?: SongStatus | undefined,
        item?: QueueEntity
    ): QueueEntity[] {
        const isCancelledOrFinished = status === SongStatus.CANCELLED || status === SongStatus.FINISHED;

        if (oldPosition === null && (isCancelledOrFinished || newPosition === undefined)) {
            return queue;
        }

        if (oldPosition !== null && isCancelledOrFinished) queue.splice(oldPosition, 1);
    
        else if (oldPosition !== null && newPosition !== undefined) {
            const [movedItem] = queue.splice(oldPosition, 1);
            queue.splice(Math.max(newPosition, 0), 0, movedItem);
        }

        else if (oldPosition === null &&
            !isCancelledOrFinished &&
            item &&
            newPosition !== undefined) queue.splice(Math.max(newPosition, 0), 0, item);

        return queue.map((queueItem, index) => ({
            ...queueItem,
            status: index === 0 ? SongStatus.PLAYING : SongStatus.WAITING,
            position: index
        }));
    }

}

