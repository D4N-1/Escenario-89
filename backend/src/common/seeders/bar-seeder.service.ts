import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { BarService } from "../../modules/bar/bar.service.js";
import { loadSeedsData } from "./seed-loader.util.js";


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

        const { bars = [] } = loadSeedsData();

        for (const bar of bars) {

            const exist = await this.barService.getBar(false)

            if (!exist?.data) await this.barService.createBar(bar)
        }
    }
}