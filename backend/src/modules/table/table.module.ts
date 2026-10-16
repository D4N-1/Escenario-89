import { Module } from "@nestjs/common";
import { TableController } from "./table.controller.js";
import { TableService } from "./table.service.js";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TableEntity } from "./entities/table.entity.js";

@Module({
    imports: [
        TypeOrmModule.forFeature([TableEntity])
    ],
    controllers: [ TableController ],
    providers: [ TableService ]
})
export class TableModule {}