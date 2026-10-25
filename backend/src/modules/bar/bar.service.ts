import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { ResCreateInterface } from "../../common/interfaces/resCreate.interface";
import { ResUpdateInterface } from "../../common/interfaces/resUpdate.interface";
import { QueueEntity, SongStatus } from "../queue/entities/queue.entity";
import { QueueSocketService } from "../queue-socket/queue-socket.service";
import { CreateBarDto } from "./dto/create-bar.dto";
import { UpdateBarDto } from "./dto/update-bar.dto";
import { BarEntity } from "./entities/bar.entity";
import { BarStatus } from "./enum/bar-status.enum";


@Injectable()
export class BarService {

    private cachedBar: BarEntity;
    private lastFetchTime: number = 0;
    private readonly CACHE_TTL = 10000;

    constructor(

        @InjectRepository(BarEntity)
        private readonly barRepository: Repository<BarEntity>,

        @InjectRepository(QueueEntity)
        private readonly queueRepository: Repository<QueueEntity>,

        private readonly queueSocketService: QueueSocketService
        
    ) { }


    async getBar(cached?: boolean): Promise<ResCreateInterface|null> {
        const now = Date.now();

        if ( (now - this.lastFetchTime > this.CACHE_TTL ) || cached == false || !this.cachedBar) {

            const bar = await this.barRepository.find()
            if (!bar || bar.length === 0) return null

            this.cachedBar = bar[0]
            this.lastFetchTime = now;
        }

        return {
            message: 'Estado del bar',
            data: this.cachedBar
        }
    }

    async updateBar(updateBar: UpdateBarDto): Promise<ResUpdateInterface> {

        const { status, close } = updateBar;

        const barRes = await this.getBar(false)

        if (!barRes) throw new NotFoundException('NO EXISTE BAR')
            
        const bar = barRes?.data

        const newData: Partial<BarEntity> = {};

        if (status) newData.status = status
        if (close) newData.closeHour = close

        const editBar = this.barRepository.merge(bar, newData)
        const savedBar = await this.barRepository.save(editBar)

        this.cachedBar = savedBar;
        this.lastFetchTime = Date.now();

        // Notificar actualización de estado a través del socket
        await this.queueSocketService.updateBar(savedBar)

        // Cuando está CERRADO: se cancelan todas las canciones en cola y sonando
        if (savedBar.status === BarStatus.CLOSED) {
            await this.queueRepository.update(
                { status: In([SongStatus.PLAYING, SongStatus.WAITING]) },
                { status: SongStatus.CANCELLED, position: null as any, value: null as any }
            );
            await this.queueSocketService.updateQueue([]);
        }
        
        return {
           message: 'Bar actualizado con exito',
           change: newData,
           data: savedBar
        }


    }

    async createBar(createBar: CreateBarDto): Promise<ResCreateInterface> {

        const { close } = createBar

        const newData: Partial<BarEntity> = { ...createBar }

        newData.closeHour = close

        const newBar = this.barRepository.create(newData)

        return {
            message: 'El bar ha sido creado',
            data: await this.barRepository.save(newBar)
        }

    }
}