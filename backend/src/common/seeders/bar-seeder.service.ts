import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { BarService } from "../../modules/bar/bar.service.js";
import { CreateBarDto } from "../../modules/bar/dto/create-bar.dto";
import { BarStatus } from "../../modules/bar/enum/bar-status.enum.js";


@Injectable()
export class BarSeederService implements OnModuleInit {
    private readonly logger = new Logger(BarSeederService.name, { timestamp: true })

    constructor(

        private readonly barService: BarService

    ) { }

    async onModuleInit() {

        await this.seedBars()

        this.logger.debug('Bar seeder executed')

    }

    async seedBars() {

        const barsToCreate: CreateBarDto[] = [
            {
                close: '04:00',
                status: BarStatus.OPEN
            }
        ];

        for (const bar of barsToCreate) {

            const exist = await this.barService.getBar(false)

            console.log(exist)

            if (!exist?.data) await this.barService.createBar(bar)
        }
    }
}