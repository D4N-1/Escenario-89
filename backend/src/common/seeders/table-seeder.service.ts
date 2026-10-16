import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { TableEntity } from "../../modules/table/entities/table.entity.js";
import { CreateTableDto } from "../../modules/table/dto/create-table.dto.js";
import { TableService } from "../../modules/table/table.service.js";


@Injectable()
export class TableSeederService implements OnModuleInit {
    private readonly logger = new Logger(TableSeederService.name)

    constructor(

        private readonly tableService: TableService

    ) {}

    async onModuleInit() {
        
        await this.seedTables()

        this.logger.log('Table Seeder executed')

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
            }
        ]

        for (const table of tablesToCreate) {

            const exist = await this.tableService.findOrNull.number(table?.number)

            console.log(exist)
            
            if (!exist) await this.tableService.create(table)
        }
    }
}