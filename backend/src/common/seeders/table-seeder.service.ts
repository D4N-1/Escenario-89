import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { CreateTableDto } from "../../modules/table/dto/create-table.dto.js";
import { TableService } from "../../modules/table/table.service.js";


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

        const tablesToCreate: CreateTableDto[] = [
            {
                number: 1
            },
            {
                number: 2
            },
            {
                number: 3
            },
            {
                number: 4
            },
            {
                number: 5
            },
            {
                number: 6
            },
            {
                number: 7
            },
            {
                number: 8
            },
            {
                number: 9
            },
            {
                number: 10
            },
            {
                number: 11
            },
            {
                number: 12
            },
            {
                number: 13
            },
            {
                number: 14
            },
            {
                number: 15
            },
            {
                number: 16
            },
            {
                number: 17
            },
            {
                number: 18
            },
            {
                number: 19
            },
            {
                number: 20
            },
            {
                number: 21
            },
            {
                number: 22
            },
            {
                number: 23
            },
            {
                number: 24
            },
            {
                number: 25
            },
            {
                number: 26
            },
            {
                number: 27
            },
            {
                number: 28
            },
            {
                number: 29
            },
            {
                number: 30
            }

        ]

        for (const table of tablesToCreate) {

            const exist = await this.tableService.findOrNull.number(table?.number)

            if (!exist) await this.tableService.create(table)
        }
    }
}