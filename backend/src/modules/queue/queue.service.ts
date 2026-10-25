import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import type { DataSource, FindOptionsRelations } from 'typeorm';
import { Repository } from 'typeorm';
import { TypeRequest } from '../../common/enums/typeRequest.enum.js';
import { ResAllInterface } from '../../common/interfaces/resAll.interface.js';
import { AnyRequest } from '../../common/types/payload.type.js';
import { BarService } from '../bar/bar.service.js';
import { BarStatus } from '../bar/enum/bar-status.enum.js';
import { IntermissionService } from '../intermission/intermission.service.js';
import { QueueSocketService } from '../queue-socket/queue-socket.service.js';
import { SongEntity } from '../song/entities/song.entity.js';
import { SongService } from '../song/song.service.js';
import { TableEntity } from '../table/entities/table.entity.js';
import { TableService } from '../table/table.service.js';
import { UserEntity } from '../user/entities/user.entity.js';
import { UserService } from '../user/user.service.js';
import { CreateQueueDto } from './dto/create-queue.dto.js';
import { GetAllQueueDto } from './dto/get-queue.dto.js';
import { UpdateQueueDto } from './dto/update-queue.dto.js';
import { QueueEntity, QueueRelations, SongStatus } from './entities/queue.entity.js';
import { QueueResCreateInterface } from './interface/queue-resCreate.interface.js';
import { QueueErrorCode } from './queue.constants.js';

@Injectable()
export class QueueService implements OnModuleInit {

    constructor(

        @InjectRepository(QueueEntity)
        private readonly queueRepository: Repository<QueueEntity>,

        @InjectDataSource()
        private readonly dataSource: DataSource,

        private readonly songService: SongService,
        private readonly tableService: TableService,
        private readonly userService: UserService,
        private readonly queueSocketService: QueueSocketService,
        private readonly intermissionService: IntermissionService,
        private readonly barService: BarService

    ) { }


    async onModuleInit() {
        
        const initialQueue: QueueEntity[] = await this.queueRepository.find({
            where:
                [
                    { status: SongStatus.PLAYING },
                    { status: SongStatus.WAITING }
                ],
            order: { position: 'ASC' },
            relations: { table: true, song: true }
        }
        )

        this.queueSocketService.setQueue(initialQueue)

    }

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

    async create(createQueueDto: CreateQueueDto, anyRequest: AnyRequest): Promise<QueueResCreateInterface> {

        const barRes = await this.barService.getBar();
        const barStatus = barRes?.data?.status;

        if (barStatus === BarStatus.CLOSED) {
            throw new BadRequestException('El local está cerrado. No se pueden pedir canciones.');
        }

        if (barStatus === BarStatus.CLOSING) {
            throw new BadRequestException('El local está cerrando. Solo se reproducen las canciones que ya están en cola.');
        }

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

        if (!song) throw new NotFoundException( QueueErrorCode.NOT_FOUND('No esta registrada esa cancion') )

        let table: TableEntity|null
        let user: UserEntity|null;

        if (anyRequest.type === TypeRequest.TABLE) table = await this.tableService.findOne.number(anyRequest.number)
            else if (anyRequest.type === TypeRequest.USER) user = await this.userService.findOne.name(anyRequest.name)
                else {
                    if (!tableCode) throw new NotFoundException( QueueErrorCode.NOT_FOUND('No se ha especificado un codigo de mesa') )
                    table = await this.tableService.findOne.code(tableCode)
                }

        return await this.dataSource.transaction( async(manager) => {

            const Queue: QueueEntity[] = await manager.find(QueueEntity, {
                where: [
                    { status: SongStatus.PLAYING },
                    { status: SongStatus.WAITING }
                ],
                order: { position: 'ASC' },
                relations: { table: true },
                lock: { mode: 'pessimistic_write' }
            })

            newData.song = song;
            newData.table = table;
            newData.user = user;
            newData.uuid = uuid || randomUUID();
            newData.fixed = false;


            if (table) {

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

                await manager.save(QueueEntity, Queue)



            } else {

                newData.position = Queue.length
                newData.status = newData.position == 0 ? SongStatus.PLAYING : SongStatus.WAITING


                const newQueue = this.queueRepository.create(newData)

                await manager.save(QueueEntity, newQueue)

            }


            const newQueue = await manager.find(QueueEntity, {
                where: [
                    { status: SongStatus.PLAYING },
                    { status: SongStatus.WAITING }
                ],
                order: { position: 'ASC' },
                relations: { table: true, song: true }
            })
            this.queueSocketService.updateQueue(newQueue);

            song.count += 1
            await manager.save(SongEntity, song)


            return {
                message: `Cancion añadida a la lista`,
                position: newData.position,
                status: newData.status,
                fixed: newData.fixed,
                data: newQueue
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
                order: { position: 'ASC' },
                relations: { table: true, song: true }
            });

            const isCancelledOrFinished = status === SongStatus.CANCELLED || status === SongStatus.FINISHED;

            // Si se pasa una canción a posición 0 (reproducir ahora), la canción que estaba sonando se finaliza
            if (position === 0) {
                const playingSong = queueList.find(q => (q.status === SongStatus.PLAYING || q.position === 0) && q.uuid !== uuid);
                if (playingSong) {
                    playingSong.status = SongStatus.FINISHED;
                    playingSong.position = null;
                    playingSong.value = null;
                    await manager.save(QueueEntity, playingSong);
                    const idx = queueList.indexOf(playingSong);
                    if (idx !== -1) queueList.splice(idx, 1);
                }
            }

            const currentOldPos = queueList.findIndex(q => q.uuid === uuid);

            const updatedQueueList = this.modifyQueue(
                queueList,
                currentOldPos !== -1 ? currentOldPos : oldPosition,
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
                
            } else if (position !== undefined) {
                newQueue.position = position;
                if (position === 0) newQueue.status = SongStatus.PLAYING;
            }
            

            const editQueue = manager.create(QueueEntity, newQueue);
            await manager.save(QueueEntity, editQueue);

            const savedQueue = await manager.save(QueueEntity, updatedQueueList);

            this.queueSocketService.updateQueue(await manager.find(QueueEntity, {
                where: [
                    { status: SongStatus.PLAYING },
                    { status: SongStatus.WAITING }
                ],
                order: { position: 'ASC' },
                relations: { table: true, song: true }
            })
            );

            if (editQueue.status === SongStatus.FINISHED) {
                const intermissions = this.intermissionService.processSongFinished()

                console.log(intermissions)

                if (intermissions.length > 0) this.queueSocketService.updateIntermission(intermissions)
            }
            
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

