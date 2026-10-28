import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SongEntity } from "./entities/song.entity.js";
import { SongService } from "./song.service.js";
import { SongController } from "./song.controller.js";
import { SongSeederService } from "../../common/seeders/song-seeder.service.js";

import { QueueEntity } from "../queue/entities/queue.entity.js";
import { QueueSocketModule } from "../queue-socket/queue-socket.module.js";

@Module({
    imports: [
        TypeOrmModule.forFeature([SongEntity, QueueEntity]),
        QueueSocketModule,
    ],
    providers: [ SongService, SongSeederService ],
    controllers: [ SongController ],
    exports: [ SongService ]
})
export class SongModule {}