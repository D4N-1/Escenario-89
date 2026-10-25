import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BarSeederService } from "../../common/seeders/bar-seeder.service";
import { QueueEntity } from "../queue/entities/queue.entity";
import { QueueSocketModule } from "../queue-socket/queue-socket.module";
import { BarMonitorService } from "./bar-monitor.service";
import { BarController } from "./bar.controller";
import { BarService } from "./bar.service";
import { BarEntity } from "./entities/bar.entity";


@Module({
    imports: [
        TypeOrmModule.forFeature([BarEntity, QueueEntity]),
        QueueSocketModule
    ],
    providers: [ BarService, BarSeederService, BarMonitorService ],
    controllers: [ BarController ],
    exports: [ BarService ]

})
export class BarModule { }