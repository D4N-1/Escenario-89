import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ResCreateInterface } from "../../common/interfaces/resCreate.interface";
import { ResUpdateInterface } from "../../common/interfaces/resUpdate.interface";
import { QueueSocketService } from "../queue-socket/queue-socket.service";
import { CreateBarDto } from "./dto/create-bar.dto";
import { UpdateBarDto } from "./dto/update-bar.dto";
import { BarEntity } from "./entities/bar.entity";


@Injectable()
export class BarService {

    private cachedBar: BarEntity;
    private lastFetchTime: number = 0;
    private readonly CACHE_TTL = 10000;

    constructor(

        @InjectRepository(BarEntity)
        private readonly barRepository: Repository<BarEntity>,

        private readonly queueSocketService: QueueSocketService
        
    ) { }


    async getBar(cached?: boolean): Promise<ResCreateInterface|null> {
        const now = Date.now();

        if ( (now - this.lastFetchTime > this.CACHE_TTL ) || cached == false) {

            const bar = await this.barRepository.find()
            if (!bar) return null

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

        this.cachedBar = bar;
        this.lastFetchTime = Date.now();

        if (status) newData.status = status
        if (close) newData.closeHour = close

        const editBar = this.barRepository.merge(bar, newData)

        this.queueSocketService.updateBar(editBar)
        
        return {
           message: 'Bar actualizado con exito',
           change: newData,
           data: await this.barRepository.save(editBar)
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