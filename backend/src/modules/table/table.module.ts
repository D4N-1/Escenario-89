import { Module } from "@nestjs/common";
import { TableController } from "./table.controller.js";
import { TableService } from "./table.service.js";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TableEntity } from "./entities/table.entity.js";
import { TableSeederService } from "../../common/seeders/table-seeder.service.js";

@Module({
    imports: [
        TypeOrmModule.forFeature([TableEntity])
    ],
    controllers: [ TableController ],
    providers: [ TableService, TableSeederService ],
    exports: [ TableService ]
})
export class TableModule {}