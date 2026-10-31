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

        const hasPlaying = initialQueue.some(q => q.status === SongStatus.PLAYING);
        if (!hasPlaying && initialQueue.length > 0) {
            initialQueue[0].status = SongStatus.PLAYING;
            initialQueue[0].position = 0;
            await this.queueRepository.save(initialQueue[0]);
        }

        this.queueSocketService.setQueue(initialQueue)

    }

    findOne = {

        position: async (position: number): Promise<QueueEntity> => {

            const queue = await this.queueRepository.findOne({
                where: { position }
            })

            if (!queue) throw new NotFoundException(QueueErrorCode.NOT_FOUND('No existe esa canción en cola'))
            return queue
        },

        uuid: async (uuid: string): Promise<QueueEntity> => {

            const queue = await this.queueRepository.findOne({
                where: { uuid }
            })

            if (!queue) throw new NotFoundException(QueueErrorCode.NOT_FOUND('No existe esa cancion en cola'))
            return queue
        }

    }

    findOrNull = {

        position: async (position: number): Promise<QueueEntity | null> => {

            return this.queueRepository.findOne({
                where: { position }
            })

        },

        uuid: async (uuid: string): Promise<QueueEntity | null> => {

            return this.queueRepository.findOne({
                where: { uuid }
            })
        }

    }

    async findAll(query: GetAllQueueDto): Promise<ResAllInterface> {

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

        const [data, total] = await this.queueRepository.findAndCount(DbQuery)

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

        const newData: Partial<QueueEntity> = {}

        const exist = uuid ? await this.findOrNull.uuid(uuid) : null;
        const queue = await this.queueRepository.find({
            where: [
                { status: SongStatus.PLAYING },
                { status: SongStatus.WAITING }
            ],
            order: { position: 'ASC' },
            relations: { table: true, song: true }
        })

        if (exist) return {
            message: 'La cancion ya ha sido añadida a la lista previamente',
            position: exist.position,
            status: exist.status,
            fixed: exist.fixed,
            data: queue
        }

        const song = await this.songService.findOne.id(songId)

        if (!song) throw new NotFoundException(QueueErrorCode.NOT_FOUND('No esta registrada esa cancion'))

        let table: TableEntity | null
        let user: UserEntity | null;

        if (anyRequest.type === TypeRequest.TABLE) table = await this.tableService.findOne.number(anyRequest.number)
        else if (anyRequest.type === TypeRequest.USER) user = await this.userService.findOne.name(anyRequest.name)
        else {
            if (!tableCode) throw new NotFoundException(QueueErrorCode.NOT_FOUND('No se ha especificado un codigo de mesa'))
            table = await this.tableService.findOne.code(tableCode)
        }

        return await this.dataSource.transaction(async (manager) => {

            const Queue: QueueEntity[] = await manager.find(QueueEntity, {
                where: [
                    { status: SongStatus.PLAYING },
                    { status: SongStatus.WAITING }
                ],
                order: { position: 'ASC' },
                relations: { table: true, user: true },
                lock: { mode: 'pessimistic_write' }
            })

            newData.song = song;
            newData.table = table;
            newData.user = user;
            newData.uuid = uuid || randomUUID();
            newData.fixed = false;

            const hasPlaying = Queue.some((q) => q.status === SongStatus.PLAYING);

            if (!hasPlaying || Queue.length === 0) {
                newData.position = 0;
                newData.status = SongStatus.PLAYING;
                newData.value = 0;

                Queue.forEach((q) => q.position!++);
                const newQueueItem = this.queueRepository.create(newData);
                Queue.unshift(newQueueItem);
                await manager.save(QueueEntity, Queue);
            } else {
                // Round-Robin por rondas activas:
                // Identificamos las canciones activas del mismo solicitante (Mesa o Admin)
                const isSameRequester = (q: QueueEntity) => {
                    if (table && q.table?.code === table.code) return true;
                    if (user && q.user?.name === user.name) return true;
                    return false;
                };

                const requesterActiveSongs = Queue.filter(isSameRequester);

                let round: number;

                if (requesterActiveSongs.length > 0) {
                    // Si el solicitante ya tiene canciones en la cola, entra a la siguiente ronda
                    // con respecto a la ronda más alta que tenga activa
                    const maxActiveRound = Math.max(...requesterActiveSongs.map((q) => q.value ?? 0));
                    round = maxActiveRound + 1;
                } else {
                    // Si es una mesa o admin sin canciones en cola, entra a la primera ronda disponible.
                    // Se toma la ronda más baja entre las canciones que están en espera (WAITING),
                    // o la ronda de la canción que está sonando si nadie más espera.
                    const waitingSongs = Queue.filter((q) => q.status === SongStatus.WAITING);
                    if (waitingSongs.length > 0) {
                        round = Math.min(...waitingSongs.map((q) => q.value ?? 0));
                    } else {
                        const playingSong = Queue.find((q) => q.status === SongStatus.PLAYING);
                        round = playingSong?.value ?? 0;
                    }
                }

                newData.value = round;
                newData.status = SongStatus.WAITING;

                // Encontrar la última canción que pertenezca a una ronda menor o igual a 'round'
                const prev = Queue.findLastIndex((q) => (q.value ?? 0) <= round);
                const position = prev === -1 ? 1 : prev + 1;

                newData.position = position;

                // Desplazar las canciones posteriores
                Queue.forEach((q) => ((q.position ?? 0) >= position ? q.position!++ : null));

                const newQueueItem = this.queueRepository.create(newData);
                Queue.splice(position, 0, newQueueItem);
                await manager.save(QueueEntity, Queue);
            }

            const newQueue = await manager.find(QueueEntity, {
                where: [
                    { status: SongStatus.PLAYING },
                    { status: SongStatus.WAITING }
                ],
                order: { position: 'ASC' },
                relations: { table: true, song: true, user: true }
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
                relations: { table: true, song: true },
                lock: { mode: 'pessimistic_write' }
            });

            const isCancelledOrFinished = status === SongStatus.CANCELLED || status === SongStatus.FINISHED;

            let songFinishedTriggered = false;

            if (position === 0) {
                const playingSong = queueList.find(q => (q.status === SongStatus.PLAYING || q.position === 0) && q.uuid !== uuid);
                if (playingSong) {
                    playingSong.status = SongStatus.FINISHED;
                    playingSong.position = null;
                    playingSong.value = null;
                    await manager.save(QueueEntity, playingSong);
                    const idx = queueList.indexOf(playingSong);
                    if (idx !== -1) queueList.splice(idx, 1);
                    songFinishedTriggered = true;
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

            for (const item of updatedQueueList) {
                await manager.save(QueueEntity, item);
            }

            const finalQueueList = await manager.find(QueueEntity, {
                where: [
                    { status: SongStatus.PLAYING },
                    { status: SongStatus.WAITING }
                ],
                order: { position: 'ASC' },
                relations: { table: true, song: true, user: true }
            });

            this.queueSocketService.updateQueue(finalQueueList);

            if (editQueue.status === SongStatus.FINISHED || songFinishedTriggered) {
                const intermissions = this.intermissionService.processSongFinished();
                console.log(intermissions);
                if (intermissions.length > 0) this.queueSocketService.updateIntermission(intermissions);
            }

            return {
                message: 'Canción editada de la lista',
                position: editQueue.position,
                status: editQueue.status,
                fixed: editQueue.fixed,
                data: finalQueueList
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

