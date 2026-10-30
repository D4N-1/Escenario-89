import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { TableService } from "../../modules/table/table.service.js";
import { loadSeedsData } from "./seed-loader.util.js";


@Injectable()
export class TableSeederService implements OnModuleInit {
    private readonly logger = new Logger(TableSeederService.name, { timestamp: true })

    constructor(

        private readonly tableService: TableService

    ) { }

    async onModuleInit() {

        await this.seedTables()

        this.logger.debug('Table Seeder executed')

    }

    async seedTables() {

        const { tables = [] } = loadSeedsData();

        for (const table of tables) {

            const exist = await this.tableService.findOrNull.number(table?.number)

            if (!exist) await this.tableService.create(table)
        }
    }
}